import { describe, expect, it } from "vitest";
import { heroImageForDrinkType } from "../heroImage.ts";

describe("heroImageForDrinkType", () => {
  it("returns the barista photo for coffee", () => {
    expect(heroImageForDrinkType("coffee")).toBe("barista.png");
  });

  it("returns the smoothie photo for smoothie", () => {
    expect(heroImageForDrinkType("smoothie")).toBe("smoothie.png");
  });

  it("returns the barkeeper photo for drinks (cocktails)", () => {
    expect(heroImageForDrinkType("drinks")).toBe("barkeeper.png");
  });

  it("falls back to the barista photo for an unrecognized drink type", () => {
    expect(heroImageForDrinkType("tea")).toBe("barista.png");
  });
});
