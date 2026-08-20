import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeBoothConfig } from "../boothConfig.ts";

const ENV_KEYS = [
  "ATTRACT_MODE",
  "ALLOW_PHONE_NUMBER_OVERRIDE",
  "DRINK_TYPE",
  "EVENT_NAME",
  "EVENT_DISPLAY_NAME",
  "MENU_ITEMS",
  "SIP_PHONE_ADDRESS",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("mergeBoothConfig", () => {
  it("falls back to hardcoded defaults when nothing is stored or set via env", () => {
    expect(mergeBoothConfig({})).toEqual({
      attractMode: false,
      allowPhoneNumberOverride: false,
      drinkType: "coffee",
      eventName: "booth",
      eventDisplayName: "",
      menuItems: "",
      sipPhoneAddress: "",
    });
  });

  it("falls back to env vars when nothing is stored", () => {
    process.env.ATTRACT_MODE = "true";
    process.env.ALLOW_PHONE_NUMBER_OVERRIDE = "true";
    process.env.DRINK_TYPE = "Smoothie";
    process.env.EVENT_NAME = "WeAreDevs";
    process.env.EVENT_DISPLAY_NAME = "  WeAreDevelopers World Congress  ";
    process.env.MENU_ITEMS = "Mango Blast";
    process.env.SIP_PHONE_ADDRESS = "sip:booth@example.com";

    expect(mergeBoothConfig({})).toEqual({
      attractMode: true,
      allowPhoneNumberOverride: true,
      drinkType: "smoothie",
      eventName: "WeAreDevs",
      eventDisplayName: "WeAreDevelopers World Congress",
      menuItems: "Mango Blast",
      sipPhoneAddress: "sip:booth@example.com",
    });
  });

  it("prefers stored overrides over env vars", () => {
    process.env.DRINK_TYPE = "coffee";
    process.env.EVENT_NAME = "booth";

    const result = mergeBoothConfig({ drinkType: "drinks", eventName: "signal-berlin" });

    expect(result.drinkType).toBe("drinks");
    expect(result.eventName).toBe("signal-berlin");
  });

  it("lets a stored false override an env var true for boolean flags", () => {
    process.env.ATTRACT_MODE = "true";
    process.env.ALLOW_PHONE_NUMBER_OVERRIDE = "true";

    const result = mergeBoothConfig({ attractMode: false, allowPhoneNumberOverride: false });

    expect(result.attractMode).toBe(false);
    expect(result.allowPhoneNumberOverride).toBe(false);
  });

  it("treats a stored empty string the same as unset for string fields (falls back to env/default)", () => {
    process.env.DRINK_TYPE = "smoothie";
    const result = mergeBoothConfig({ drinkType: "" });
    expect(result.drinkType).toBe("smoothie");
  });

  it("lowercases the drink type regardless of source", () => {
    expect(mergeBoothConfig({ drinkType: "DRINKS" }).drinkType).toBe("drinks");
  });

  it("trims eventDisplayName even when it comes from the stored value", () => {
    expect(mergeBoothConfig({ eventDisplayName: "  Signal Berlin  " }).eventDisplayName).toBe("Signal Berlin");
  });

  describe("sipPhoneAddress resolution", () => {
    it("picks the first candidate when nothing is stored", () => {
      process.env.SIP_PHONE_ADDRESS = "sip:booth1@example.com,sip:booth2@example.com";
      expect(mergeBoothConfig({}).sipPhoneAddress).toBe("sip:booth1@example.com");
    });

    it("keeps the stored selection when it's still one of the candidates", () => {
      process.env.SIP_PHONE_ADDRESS = "sip:booth1@example.com,sip:booth2@example.com";
      expect(mergeBoothConfig({ sipPhoneAddress: "sip:booth2@example.com" }).sipPhoneAddress).toBe("sip:booth2@example.com");
    });

    it("falls back to the first candidate when the stored selection is stale (no longer in the list)", () => {
      process.env.SIP_PHONE_ADDRESS = "sip:booth1@example.com,sip:booth2@example.com";
      expect(mergeBoothConfig({ sipPhoneAddress: "sip:retired@example.com" }).sipPhoneAddress).toBe("sip:booth1@example.com");
    });

    it("is backwards compatible with a single, non-list SIP_PHONE_ADDRESS", () => {
      process.env.SIP_PHONE_ADDRESS = "+14155551234";
      expect(mergeBoothConfig({}).sipPhoneAddress).toBe("+14155551234");
    });

    it("resolves to an empty string when SIP_PHONE_ADDRESS is unset", () => {
      expect(mergeBoothConfig({ sipPhoneAddress: "sip:booth1@example.com" }).sipPhoneAddress).toBe("");
    });

    it("trims whitespace around each candidate", () => {
      process.env.SIP_PHONE_ADDRESS = " sip:booth1@example.com , sip:booth2@example.com ";
      expect(mergeBoothConfig({}).sipPhoneAddress).toBe("sip:booth1@example.com");
      expect(mergeBoothConfig({ sipPhoneAddress: "sip:booth2@example.com" }).sipPhoneAddress).toBe("sip:booth2@example.com");
    });
  });
});
