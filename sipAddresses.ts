// Pure parsing for SIP_PHONE_ADDRESS, which holds a comma-separated list of
// call destinations (SIP URIs and/or E.164 numbers). Kept dependency-free so
// it can be unit tested without booting the rest of the app.

export function parseSipAddresses(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
