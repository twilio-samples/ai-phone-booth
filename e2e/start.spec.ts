import { expect, test } from "@playwright/test";

test.describe("/start page", () => {
  // start.html unconditionally loads the real Twilio Sync SDK from a CDN,
  // and page.goto waits for the load event — stub it so these tests don't
  // depend on that external network call's latency.
  test.beforeEach(async ({ page }) => {
    await page.route("https://media.twiliocdn.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.Twilio = { Sync: { Client: function() { return { map: async () => ({ get: async () => null, on: () => {} }) }; } } };",
      });
    });
  });

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
