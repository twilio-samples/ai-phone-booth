import { config } from "dotenv";

/**
 * Load .env values, overriding any pre-existing shell-exported vars.
 *
 * Some developers have TWILIO_ACCOUNT_SID / TWILIO_API_KEY / etc. exported
 * globally in their shell (via ~/.zshrc or a zsh dotenv plugin). Without
 * `override: true`, dotenv silently no-ops for any var already in
 * process.env, so the wrong Twilio account gets used and calls go to the
 * wrong project.
 *
 * In production (Azure Container Apps) there is no .env in the image (see
 * .dockerignore), so `override: true` is safe — dotenv just doesn't find
 * anything to load and the platform-provided env vars stand.
 */
export function loadEnv(): void {
  config({ override: true });
}
