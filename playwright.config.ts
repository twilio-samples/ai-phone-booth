import { defineConfig } from "@playwright/test";

// Dummy-but-well-formed Twilio/OpenAI credentials so the real server.ts can
// boot without any live Twilio/OpenAI network dependency:
// - TAC's Conversation Orchestrator only initializes (and calls out to
//   Twilio) when TWILIO_CONVERSATION_CONFIGURATION_ID is set, so it's
//   deliberately omitted here — voice-only mode is a no-op at startup.
// - TWILIO_TAC_KNOWLEDGE_BASE_ID is omitted for the same reason (knowledge
//   base client creation is skipped when unset).
// - SKIP_SYNC_CONFIG_FETCH short-circuits config.ts's one live Sync read.
// Every var the app reads is set explicitly (even to "") so a real local
// .env file never leaks a credential or config value into the test run.
const TEST_ENV: Record<string, string> = {
  TWILIO_ACCOUNT_SID: "ACtest00000000000000000000000000",
  TWILIO_AUTH_TOKEN: "test_auth_token",
  TWILIO_API_KEY: "SKtest00000000000000000000000000",
  TWILIO_API_SECRET: "test_api_secret",
  TWILIO_PHONE_NUMBER: "+15550001234",
  TWILIO_SYNC_SERVICE_SID: "IStest00000000000000000000000000",
  TWILIO_CONVERSATION_CONFIGURATION_ID: "",
  TWILIO_TAC_CI_CONFIGURATION_ID: "",
  TWILIO_TAC_KNOWLEDGE_BASE_ID: "",
  OPENAI_API_KEY: "sk-test",
  ADMIN_USER: "e2e-user",
  ADMIN_PASS: "e2e-pass",
  SIP_PHONE_ADDRESS: "+15550005678,sip:booth2@example.com",
  NGROK_BASE_URL: "http://localhost:8931",
  MIXOLOGIST_BASE_URL: "http://localhost:9",
  MIXOLOGIST_AUTH: "user:pass",
  DRINK_TYPE: "drinks",
  EVENT_NAME: "e2e-test",
  EVENT_DISPLAY_NAME: "",
  MENU_ITEMS: "Irish Lovers(Espresso, Whiskey),Shakerato Lovers,Blue Gin Lovers",
  ALLOW_PHONE_NUMBER_OVERRIDE: "true",
  ATTRACT_MODE: "false",
  ATTRACT_DEV: "true",
  PORT: "8931",
  SKIP_SYNC_CONFIG_FETCH: "true",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8931",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx tsx server.ts",
    url: "http://localhost:8931/health",
    reuseExistingServer: !process.env.CI,
    env: TEST_ENV,
    timeout: 30_000,
  },
});
