import { expect, test } from "@playwright/test";

// ATTRACT_DEV=true in the test server env fires the popup once, 20s after
// load, instead of the random 5-10 minute production interval.
test.describe("attract mode popup (ATTRACT_DEV)", () => {
  test.beforeEach(async ({ page }) => {
    // Stub the real Twilio Sync CDN script so the popup's background
    // fetch('/api/attractCall') -> Sync map subscription flow never touches
    // the real Twilio Sync service.
    await page.route("https://media.twiliocdn.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `window.Twilio = { Sync: { Client: function() {
          return { map: async () => ({ get: async () => null, on: () => {} }) };
        } } };`,
      });
    });

    await page.route("**/api/attractCall", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, callSid: "CAe2etest0000000000000000000000" }),
      });
    });

    await page.clock.install();
  });

  test("appears after the dev idle delay and can be dismissed", async ({ page }) => {
    await page.goto("/start");
    await expect(page.locator("#attractOverlay")).not.toHaveClass(/visible/);

    await page.clock.fastForward(20_000);
    await expect(page.locator("#attractOverlay")).toHaveClass(/visible/);
    await expect(page.locator("#attractOverlay")).toBeVisible();

    await page.locator("#attractDismiss").click();
    await expect(page.locator("#attractOverlay")).not.toHaveClass(/visible/);
  });

  test("does not appear before the idle delay has elapsed", async ({ page }) => {
    await page.goto("/start");
    await page.clock.fastForward(19_000);
    await expect(page.locator("#attractOverlay")).not.toHaveClass(/visible/);
  });
});
