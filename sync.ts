import twilio from "twilio";

export interface CintelSummary {
  sentiment?: string;
  summary?: string;
}

export interface CallTrackerItem {
  status: "calling" | "in-progress" | "completed" | "failed";
  tasks: { order_placed: boolean; drink_question_asked: boolean; twilio_question_asked: boolean };
  history: { role: "user" | "ai"; text: string }[];
  duration?: number;
  viSid?: string;
  cintel?: CintelSummary;
  observations?: string[];
  summaries?: string[];
}

export const SYNC_MAP_NAME = "callTracker";
export const SYNC_ITEM_TTL = 604800;

// Retry state for outbound-call retry chains, keyed by any CallSid in the
// chain → entry pointing back to the original CallSid and the params needed
// to place another attempt. Persisted so a restart mid-chain doesn't orphan
// the tracker at status="calling" forever.
export const RETRY_MAP_NAME = "callRetry";
export const RETRY_ITEM_TTL = 3600;

export interface RetryEntry {
  originalCallSid: string;
  retryCount: number;
  to: string;
  from: string;
  twimlUrl: string;
  statusCallbackUrl: string;
}

export async function readRetryEntry(callSid: string): Promise<RetryEntry | undefined> {
  const syncServiceSid = process.env.TWILIO_SYNC_SERVICE_SID!;
  try {
    const item = await getTwilio().sync.v1.services(syncServiceSid)
      .syncMaps(RETRY_MAP_NAME).syncMapItems(callSid).fetch();
    return item.data as RetryEntry;
  } catch (err: any) {
    if (err?.status === 404) return undefined;
    console.error(`[sync] readRetryEntry error (${callSid}):`, err);
    return undefined;
  }
}

export async function writeRetryEntry(callSid: string, entry: RetryEntry): Promise<void> {
  const syncServiceSid = process.env.TWILIO_SYNC_SERVICE_SID!;
  const client = getTwilio();
  const maps = client.sync.v1.services(syncServiceSid).syncMaps;
  try {
    await maps(RETRY_MAP_NAME).syncMapItems.create({
      key: callSid,
      ttl: RETRY_ITEM_TTL,
      data: entry,
    });
  } catch (err: any) {
    if (err?.status === 404) {
      await maps.create({ uniqueName: RETRY_MAP_NAME });
      await maps(RETRY_MAP_NAME).syncMapItems.create({
        key: callSid,
        ttl: RETRY_ITEM_TTL,
        data: entry,
      });
      return;
    }
    // Item may already exist from a duplicate callback — overwrite.
    if (err?.status === 409) {
      await maps(RETRY_MAP_NAME).syncMapItems(callSid).update({ data: entry, ttl: RETRY_ITEM_TTL });
      return;
    }
    throw err;
  }
}

export async function deleteRetryEntry(callSid: string): Promise<void> {
  const syncServiceSid = process.env.TWILIO_SYNC_SERVICE_SID!;
  try {
    await getTwilio().sync.v1.services(syncServiceSid)
      .syncMaps(RETRY_MAP_NAME).syncMapItems(callSid).remove();
  } catch (err: any) {
    if (err?.status === 404) return;
    console.error(`[sync] deleteRetryEntry error (${callSid}):`, err);
  }
}

export interface BoothConfig {
  attractMode?: boolean;
  allowPhoneNumberOverride?: boolean;
  drinkType?: string;
  eventName?: string;
  eventDisplayName?: string;
  menuItems?: string;
  sipPhoneAddress?: string;
}

export const CONFIG_DOC_NAME = "boothConfig";

function getTwilio() {
  return twilio(process.env.TWILIO_API_KEY!, process.env.TWILIO_API_SECRET!, { accountSid: process.env.TWILIO_ACCOUNT_SID! });
}

// Admin-editable overrides for env-var-backed settings, persisted as a single
// Sync Document. Falls back to {} (i.e. env-var defaults everywhere) if the
// document doesn't exist yet or Sync is unreachable.
export async function getBoothConfig(): Promise<BoothConfig> {
  const syncServiceSid = process.env.TWILIO_SYNC_SERVICE_SID!;
  try {
    const doc = await getTwilio().sync.v1.services(syncServiceSid)
      .documents(CONFIG_DOC_NAME).fetch();
    return doc.data as BoothConfig;
  } catch (err: any) {
    if (err?.status === 404) return {};
    console.error("[sync] getBoothConfig error:", err);
    return {};
  }
}

export async function writeBoothConfig(cfg: BoothConfig): Promise<void> {
  const syncServiceSid = process.env.TWILIO_SYNC_SERVICE_SID!;
  const client = getTwilio();
  const documents = client.sync.v1.services(syncServiceSid).documents;
  try {
    await documents(CONFIG_DOC_NAME).update({ data: cfg });
  } catch (err: any) {
    if (err?.status === 404) {
      await documents.create({ uniqueName: CONFIG_DOC_NAME, data: cfg });
      return;
    }
    throw err;
  }
}

export function getSyncItem(callSid: string) {
  return getTwilio().sync.v1
    .services(process.env.TWILIO_SYNC_SERVICE_SID!)
    .syncMaps(SYNC_MAP_NAME)
    .syncMapItems(callSid);
}

export async function updateCallTracker(callSid: string, patch: Partial<CallTrackerItem>, attempt = 0): Promise<void> {
  try {
    const item = await getSyncItem(callSid).fetch();
    const current = item.data as CallTrackerItem;
    await getSyncItem(callSid).update({
      data: { ...current, ...patch },
      ttl: SYNC_ITEM_TTL,
    });
  } catch (err: any) {
    // Sync item not yet created — race between callStatus webhook and Sync write.
    if (err?.status === 404 && attempt < 5) {
      await new Promise(r => setTimeout(r, 200 * 2 ** attempt));
      return updateCallTracker(callSid, patch, attempt + 1);
    }
    console.error(`[sync] updateCallTracker error (${callSid}):`, err);
  }
}
