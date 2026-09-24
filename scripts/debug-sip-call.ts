/**
 * Manually place a single outbound SIP call to debug the SIP gateway.
 *
 * Usage:
 *   pnpm debug-sip-call <sip-address> [base-url]
 *
 * Examples:
 *   pnpm debug-sip-call sip:emea1@ai-booth.sip.twilio.com
 *     → uses TwiML/callback URLs on http://localhost:8000 (no server needed if you just
 *       want to test whether the gateway itself answers)
 *
 *   pnpm debug-sip-call sip:emea1@ai-booth.sip.twilio.com https://ai-phone-booth.purplefield-1189830e.northeurope.azurecontainerapps.io
 *     → uses the deployed Azure server for TwiML + status callbacks
 *
 * After the call, this script fetches Twilio's notifications and events for it
 * so you can see the exact SIP response codes and any callback errors.
 */
import twilio from "twilio";
import { loadEnv } from "../loadEnv.ts";

loadEnv();

const [, , sipAddress, baseUrlArg] = process.argv;
if (!sipAddress) {
  console.error("Usage: pnpm debug-sip-call <sip-address> [base-url]");
  process.exit(1);
}

const client = twilio(process.env.TWILIO_API_KEY!, process.env.TWILIO_API_SECRET!, {
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
});

// Base URL for TwiML + callbacks. If a server isn't reachable here, Twilio
// will still place the call (INVITE the gateway) — you just won't get media.
// That's fine for debugging whether the gateway itself answers.
const baseUrl = baseUrlArg ?? "http://localhost:8000";

console.log(`Placing call:
  from:           ${process.env.TWILIO_PHONE_NUMBER}
  to:             ${sipAddress}
  TwiML URL:      ${baseUrl}/twiml
  statusCallback: ${baseUrl}/api/callStatus
  ring timeout:   30s`);

const call = await client.calls.create({
  to: sipAddress,
  from: process.env.TWILIO_PHONE_NUMBER!,
  url: `${baseUrl}/twiml`,
  timeout: 30,
  statusCallback: `${baseUrl}/api/callStatus`,
  statusCallbackMethod: "POST",
  statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
});

console.log(`\nCall SID: ${call.sid}`);
console.log("Polling call status every 2s (Ctrl-C to stop)…\n");

let lastStatus = "";
while (true) {
  const c = await client.calls(call.sid).fetch();
  if (c.status !== lastStatus) {
    console.log(`  [${new Date().toISOString()}] status=${c.status}${c.duration ? ` duration=${c.duration}s` : ""}`);
    lastStatus = c.status;
  }
  if (["completed", "failed", "busy", "no-answer", "canceled"].includes(c.status)) break;
  await new Promise((r) => setTimeout(r, 2000));
}

console.log("\n=== Final call ===");
const final = await client.calls(call.sid).fetch();
console.log(`  status:    ${final.status}`);
console.log(`  duration:  ${final.duration}s`);
console.log(`  start:     ${final.startTime?.toISOString?.() ?? final.startTime}`);
console.log(`  end:       ${final.endTime?.toISOString?.() ?? final.endTime}`);

console.log("\n=== Notifications (warnings / errors from Twilio) ===");
const notes = await client.calls(call.sid).notifications.list({ limit: 10 });
if (notes.length === 0) console.log("  (none)");
for (const n of notes) {
  console.log(`  ${n.dateCreated?.toISOString?.() ?? n.dateCreated}  err=${n.errorCode}  url=${n.requestUrl}`);
  console.log(`    ${decodeURIComponent(n.messageText ?? "")}`);
}

console.log("\n=== Events (URL fetches Twilio made) ===");
try {
  // The Events subresource isn't in the SDK; use REST directly.
  const auth = Buffer.from(`${process.env.TWILIO_API_KEY}:${process.env.TWILIO_API_SECRET}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls/${call.sid}/Events.json?PageSize=20`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  const body = (await res.json()) as { events?: Array<{ request?: any; response?: any }> };
  for (const e of body.events ?? []) {
    const url = e.request?.url ?? e.request?.parameters?.url;
    const status = e.response?.response_code;
    console.log(`  ${e.response?.date_created ?? ""}  ${status ?? "-"}  ${url ?? ""}`);
  }
} catch (err) {
  console.error("  events fetch failed:", err);
}
