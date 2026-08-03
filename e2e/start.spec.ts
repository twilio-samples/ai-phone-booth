import { expect, test } from "@playwright/test";

test.describe("/start page", () => {
  test("renders the persona and menu for the configured drink type (drinks/cocktails)", async ({ page }) => {
    await page.goto("/start");

    await expect(page.locator(".hero-brand-text")).toHaveText("Cocktail Bar");
    await expect(page.locator(".identity-role")).toContainText("Mixologist");
    await expect(page.locator(".hero img")).toHaveAttribute("src", "/barkeeper.png");

    // Menu summary card should mention the configured menu items.
    await expect(page.locator(".card.optional .card-desc")).toContainText("Irish Lovers");
  });

  test("shows the phone number override input when ALLOW_PHONE_NUMBER_OVERRIDE is enabled", async ({ page }) => {
    await page.goto("/start");
    await expect(page.locator("#phoneInput")).toBeVisible();
  });

  test("start button is enabled and ready before any interaction", async ({ page }) => {
    await page.goto("/start");
    await expect(page.locator("#startBtn")).toBeEnabled();
    await expect(page.locator("#statusMsg")).toHaveText("");
  });
});
