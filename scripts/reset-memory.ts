import "dotenv/config";

const phoneArg = process.argv[2];
if (!phoneArg) {
  console.error("Usage: pnpm reset-memory <phone-number>");
  console.error("Example: pnpm reset-memory +15551234567");
  process.exit(1);
}

const apiKey = process.env.TWILIO_API_KEY!;
const apiSecret = process.env.TWILIO_API_SECRET!;
const configId = process.env.TWILIO_CONVERSATION_CONFIGURATION_ID!;
const auth = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

async function twilioFetch(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: auth, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} → ${res.status} ${await res.text()}`);
  }
  return res.json();
}

const config = await twilioFetch(
  `https://conversations.twilio.com/v2/ControlPlane/Configurations/${configId}`,
);
const storeId: string | undefined = config.memoryStoreId;
if (!storeId) {
  console.error(`Configuration ${configId} has no memoryStoreId — nothing to reset.`);
  process.exit(1);
}

const lookup = await twilioFetch(
  `https://memory.twilio.com/v1/Stores/${storeId}/Profiles/Lookup`,
  { method: "POST", body: JSON.stringify({ idType: "phone", value: phoneArg }) },
);

const profiles: string[] = lookup.profiles ?? [];
if (profiles.length === 0) {
  console.log(`No profile found for ${lookup.normalizedValue ?? phoneArg}. Nothing to delete.`);
  process.exit(0);
}

console.log(`Deleting ${profiles.length} profile(s) for ${lookup.normalizedValue}:`);
for (const profileId of profiles) {
  await twilioFetch(`https://memory.twilio.com/v1/Stores/${storeId}/Profiles/${profileId}`, {
    method: "DELETE",
  });
  console.log(`  ✓ ${profileId}`);
}

console.log("Done. Deletion is asynchronous — the panel may take a moment to clear.");
