import { describe, expect, it } from "vitest";
import { parseMenuItems, validateMenuItems } from "../menu.ts";

describe("parseMenuItems", () => {
  it("parses plain comma-separated names with no descriptions", () => {
    expect(parseMenuItems("Espresso,Cortado,Cappuccino")).toEqual([
      { name: "Espresso", description: "" },
      { name: "Cortado", description: "" },
      { name: "Cappuccino", description: "" },
    ]);
  });

  it("parses a description in Name(ingredient, ingredient) syntax", () => {
    expect(parseMenuItems("Macarena(Strawberry, Pineapple, Vanilla)")).toEqual([
      { name: "Macarena", description: "Strawberry, Pineapple, Vanilla" },
    ]);
  });

  it("does not split on commas inside parentheses", () => {
    const result = parseMenuItems("Macarena(Strawberry, Pineapple),La Isla Bonita(Banana, Coconut)");
    expect(result).toEqual([
      { name: "Macarena", description: "Strawberry, Pineapple" },
      { name: "La Isla Bonita", description: "Banana, Coconut" },
    ]);
  });

  it("trims whitespace around names and descriptions", () => {
    expect(parseMenuItems(" Espresso , Cortado ")).toEqual([
      { name: "Espresso", description: "" },
      { name: "Cortado", description: "" },
    ]);
  });

  it("drops empty entries caused by trailing/double commas", () => {
    expect(parseMenuItems("Espresso,,Cortado,")).toEqual([
      { name: "Espresso", description: "" },
      { name: "Cortado", description: "" },
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseMenuItems("")).toEqual([]);
  });

  it("mixes items with and without descriptions", () => {
    expect(parseMenuItems("Espresso,Macarena(Strawberry, Vanilla)")).toEqual([
      { name: "Espresso", description: "" },
      { name: "Macarena", description: "Strawberry, Vanilla" },
    ]);
  });
});

describe("validateMenuItems", () => {
  it("accepts a well-formed plain list", () => {
    expect(validateMenuItems("Espresso,Cortado,Cappuccino")).toBeNull();
  });

  it("accepts a well-formed list with descriptions", () => {
    expect(validateMenuItems("Macarena(Strawberry, Pineapple)")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateMenuItems("")).toBe("Menu items cannot be empty.");
  });

  it("rejects a whitespace-only string", () => {
    expect(validateMenuItems("   ")).toBe("Menu items cannot be empty.");
  });

  it("rejects an unmatched closing paren", () => {
    expect(validateMenuItems("Espresso)")).toBe("Unmatched ')' in menu items.");
  });

  it("rejects an unmatched opening paren", () => {
    expect(validateMenuItems("Macarena(Strawberry")).toBe("Unmatched '(' in menu items.");
  });

  it("rejects a ')' that closes before any '(' was opened", () => {
    expect(validateMenuItems("Espresso, Cortado)(")).toBe("Unmatched ')' in menu items.");
  });

  it("rejects input that parses to zero items", () => {
    expect(validateMenuItems(",,,")).toBe("Menu items cannot be empty.");
  });
});
