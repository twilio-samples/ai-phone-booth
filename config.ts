/**
 * Runtime booth configuration — merges admin-editable overrides (stored in a
 * Twilio Sync Document) over env-var defaults. Resolved once at process
 * startup; the /admin page writes to Sync and restarts the process to apply
 * changes, so nothing here needs to be re-read mid-process.
 */
import { config } from "dotenv";
import { getBoothConfig, type BoothConfig } from "./sync.ts";

config();

export function mergeBoothConfig(stored: BoothConfig) {
  return {
    attractMode: stored.attractMode ?? (process.env.ATTRACT_MODE === "true"),
    allowPhoneNumberOverride: stored.allowPhoneNumberOverride ?? (process.env.ALLOW_PHONE_NUMBER_OVERRIDE === "true"),
    drinkType: (stored.drinkType || process.env.DRINK_TYPE || "coffee").toLowerCase(),
    eventName: stored.eventName || process.env.EVENT_NAME || "signal-berlin",
    eventDisplayName: (stored.eventDisplayName ?? process.env.EVENT_DISPLAY_NAME ?? "").trim(),
    menuItems: stored.menuItems || process.env.MENU_ITEMS || "",
  };
}

export const resolvedConfig = mergeBoothConfig(await getBoothConfig());
