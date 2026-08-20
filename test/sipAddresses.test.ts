import { describe, expect, it } from "vitest";
import { parseSipAddresses } from "../sipAddresses.ts";

describe("parseSipAddresses", () => {
  it("returns a single-item list for one address", () => {
    expect(parseSipAddresses("sip:booth@example.com")).toEqual(["sip:booth@example.com"]);
  });

  it("splits multiple comma-separated addresses", () => {
    expect(parseSipAddresses("sip:booth1@example.com,sip:booth2@example.com")).toEqual([
      "sip:booth1@example.com",
      "sip:booth2@example.com",
    ]);
  });

  it("trims whitespace around each address", () => {
    expect(parseSipAddresses(" sip:booth1@example.com , +14155551234 ")).toEqual([
      "sip:booth1@example.com",
      "+14155551234",
    ]);
  });

  it("drops empty entries from trailing/double commas", () => {
    expect(parseSipAddresses("sip:booth1@example.com,,+14155551234,")).toEqual([
      "sip:booth1@example.com",
      "+14155551234",
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseSipAddresses("")).toEqual([]);
  });

  it("returns an empty array for a whitespace-only string", () => {
    expect(parseSipAddresses("   ")).toEqual([]);
  });

  it("mixes SIP URIs and E.164 numbers", () => {
    expect(parseSipAddresses("sip:booth@example.com,+14155551234")).toEqual([
      "sip:booth@example.com",
      "+14155551234",
    ]);
  });
});
