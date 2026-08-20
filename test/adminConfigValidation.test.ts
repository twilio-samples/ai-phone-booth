import { describe, expect, it } from "vitest";
import { validateAdminConfig } from "../adminConfigValidation.ts";

const DEFAULT_OPTIONS = { sipPhoneAddresses: ["sip:booth@example.com", "sip:booth2@example.com"] };

const VALID_BODY = {
  attractMode: true,
  allowPhoneNumberOverride: false,
  drinkType: "coffee",
  eventName: "wearedevs",
  eventDisplayName: "WeAreDevelopers World Congress",
  menuItems: "Espresso,Cortado",
  sipPhoneAddress: "sip:booth@example.com",
};

describe("validateAdminConfig", () => {
  it("accepts a fully valid body and returns no errors", () => {
    const result = validateAdminConfig(VALID_BODY, DEFAULT_OPTIONS);
    expect(result.errors).toEqual({});
    expect(result.config).toEqual(VALID_BODY);
  });

  it("normalizes drinkType and eventName casing/whitespace before validating", () => {
    const result = validateAdminConfig(
      { ...VALID_BODY, drinkType: "  DRINKS  ", eventName: "  WeAreDevs  " },
      DEFAULT_OPTIONS,
    );
    expect(result.errors).toEqual({});
    expect(result.config?.drinkType).toBe("drinks");
    expect(result.config?.eventName).toBe("wearedevs");
  });

  it("rejects a non-boolean attractMode", () => {
    const result = validateAdminConfig({ ...VALID_BODY, attractMode: "true" }, DEFAULT_OPTIONS);
    expect(result.errors.attractMode).toBe("Must be true or false.");
    expect(result.config).toBeNull();
  });

  it("rejects a non-boolean allowPhoneNumberOverride", () => {
    const result = validateAdminConfig({ ...VALID_BODY, allowPhoneNumberOverride: 1 }, DEFAULT_OPTIONS);
    expect(result.errors.allowPhoneNumberOverride).toBe("Must be true or false.");
  });

  it("rejects an unrecognized drinkType", () => {
    const result = validateAdminConfig({ ...VALID_BODY, drinkType: "tea" }, DEFAULT_OPTIONS);
    expect(result.errors.drinkType).toBe('Must be "coffee", "smoothie", or "drinks".');
  });

  it("accepts each of the three valid drink types", () => {
    for (const drinkType of ["coffee", "smoothie", "drinks"]) {
      const result = validateAdminConfig({ ...VALID_BODY, drinkType }, DEFAULT_OPTIONS);
      expect(result.errors.drinkType).toBeUndefined();
    }
  });

  it("lowercases an uppercase eventName instead of rejecting it", () => {
    const result = validateAdminConfig({ ...VALID_BODY, eventName: "WeAreDevs" }, DEFAULT_OPTIONS);
    expect(result.errors.eventName).toBeUndefined();
    expect(result.config?.eventName).toBe("wearedevs");
  });

  it("rejects an eventName with spaces or punctuation", () => {
    const result = validateAdminConfig({ ...VALID_BODY, eventName: "signal berlin!" }, DEFAULT_OPTIONS);
    expect(result.errors.eventName).toBeDefined();
  });

  it("accepts an eventName with hyphens and numbers", () => {
    const result = validateAdminConfig({ ...VALID_BODY, eventName: "signal-berlin-2026" }, DEFAULT_OPTIONS);
    expect(result.errors.eventName).toBeUndefined();
  });

  it("rejects an eventDisplayName longer than 80 characters", () => {
    const result = validateAdminConfig({ ...VALID_BODY, eventDisplayName: "x".repeat(81) }, DEFAULT_OPTIONS);
    expect(result.errors.eventDisplayName).toBe("Must be 80 characters or fewer.");
  });

  it("rejects an eventDisplayName containing angle brackets", () => {
    const result = validateAdminConfig({ ...VALID_BODY, eventDisplayName: "<script>" }, DEFAULT_OPTIONS);
    expect(result.errors.eventDisplayName).toBe("Cannot contain < or > characters.");
  });

  it("allows an empty eventDisplayName", () => {
    const result = validateAdminConfig({ ...VALID_BODY, eventDisplayName: "" }, DEFAULT_OPTIONS);
    expect(result.errors.eventDisplayName).toBeUndefined();
  });

  it("rejects empty menuItems", () => {
    const result = validateAdminConfig({ ...VALID_BODY, menuItems: "" }, DEFAULT_OPTIONS);
    expect(result.errors.menuItems).toBe("Menu items cannot be empty.");
  });

  it("rejects malformed menuItems (unmatched parenthesis)", () => {
    const result = validateAdminConfig({ ...VALID_BODY, menuItems: "Macarena(Strawberry" }, DEFAULT_OPTIONS);
    expect(result.errors.menuItems).toBe("Unmatched '(' in menu items.");
  });

  it("accepts each configured sipPhoneAddress candidate", () => {
    for (const sipPhoneAddress of DEFAULT_OPTIONS.sipPhoneAddresses) {
      const result = validateAdminConfig({ ...VALID_BODY, sipPhoneAddress }, DEFAULT_OPTIONS);
      expect(result.errors.sipPhoneAddress).toBeUndefined();
    }
  });

  it("rejects a sipPhoneAddress not in the configured candidates", () => {
    const result = validateAdminConfig({ ...VALID_BODY, sipPhoneAddress: "sip:unknown@example.com" }, DEFAULT_OPTIONS);
    expect(result.errors.sipPhoneAddress).toBe(
      "Must be one of the configured SIP addresses: sip:booth@example.com, sip:booth2@example.com.",
    );
    expect(result.config).toBeNull();
  });

  it("rejects an empty sipPhoneAddress", () => {
    const result = validateAdminConfig({ ...VALID_BODY, sipPhoneAddress: "" }, DEFAULT_OPTIONS);
    expect(result.errors.sipPhoneAddress).toBeDefined();
  });

  it("reports a clear error when no SIP addresses are configured at all", () => {
    const result = validateAdminConfig({ ...VALID_BODY, sipPhoneAddress: "" }, { sipPhoneAddresses: [] });
    expect(result.errors.sipPhoneAddress).toBe("No SIP addresses are configured (set SIP_PHONE_ADDRESS).");
  });

  it("accumulates multiple errors at once", () => {
    const result = validateAdminConfig(
      {
        attractMode: "yes",
        allowPhoneNumberOverride: "no",
        drinkType: "tea",
        eventName: "Not Valid!",
        eventDisplayName: "<b>",
        menuItems: "",
        sipPhoneAddress: "sip:unknown@example.com",
      },
      DEFAULT_OPTIONS,
    );
    expect(Object.keys(result.errors).sort()).toEqual([
      "allowPhoneNumberOverride",
      "attractMode",
      "drinkType",
      "eventDisplayName",
      "eventName",
      "menuItems",
      "sipPhoneAddress",
    ]);
    expect(result.config).toBeNull();
  });

  it("treats a missing field the same as an empty/invalid value rather than throwing", () => {
    expect(() => validateAdminConfig({}, DEFAULT_OPTIONS)).not.toThrow();
    const result = validateAdminConfig({}, DEFAULT_OPTIONS);
    expect(result.config).toBeNull();
    expect(Object.keys(result.errors).length).toBeGreaterThan(0);
  });
});
