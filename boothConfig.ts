// Pure merge of admin-editable Sync overrides over env-var defaults. Only
// imports a type (erased at runtime) from sync.ts, so it stays dependency-free
// and can be unit tested without a Twilio client.

import type { BoothConfig } from "./sync.ts";

export function mergeBoothConfig(stored: BoothConfig) {
  return {
    attractMode: stored.attractMode ?? (process.env.ATTRACT_MODE === "true"),
    allowPhoneNumberOverride: stored.allowPhoneNumberOverride ?? (process.env.ALLOW_PHONE_NUMBER_OVERRIDE === "true"),
    drinkType: (stored.drinkType || process.env.DRINK_TYPE || "coffee").toLowerCase(),
    eventName: stored.eventName || process.env.EVENT_NAME || "booth",
    eventDisplayName: (stored.eventDisplayName ?? process.env.EVENT_DISPLAY_NAME ?? "").trim(),
    menuItems: stored.menuItems || process.env.MENU_ITEMS || "",
  };
}
