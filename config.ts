/**
 * Runtime booth configuration — merges admin-editable overrides (stored in a
 * Twilio Sync Document) over env-var defaults. Resolved once at process
 * startup; the /admin page writes to Sync and restarts the process to apply
 * changes, so nothing here needs to be re-read mid-process.
 */
import { config } from "dotenv";
import { getBoothConfig } from "./sync.ts";
import { mergeBoothConfig } from "./boothConfig.ts";

config();

// Tests boot the server without real Twilio credentials — skip the live Sync
// fetch so startup doesn't depend on network access.
const stored = process.env.SKIP_SYNC_CONFIG_FETCH === "true" ? {} : await getBoothConfig();

export const resolvedConfig = mergeBoothConfig(stored);
