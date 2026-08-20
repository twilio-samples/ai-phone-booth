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

export interface BoothConfig {
  attractMode?: boolean;
  allowPhoneNumberOverride?: boolean;
  drinkType?: string;
  eventName?: string;
  eventDisplayName?: string;
  menuItems?: string;
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
