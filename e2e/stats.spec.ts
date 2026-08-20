import { expect, test } from "@playwright/test";

test.describe("/stats dashboard", () => {
  test.use({ httpCredentials: { username: "e2e-user", password: "e2e-pass" } });

  test("renders KPI values and header from mocked /api/stats data", async ({ page }) => {
    await page.route("**/api/stats", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total: 20,
          orderRate: 0.5,
          questionRate: 0.75,
          bothRate: 0.4,
          twilioRate: 0.6,
          avgMessages: 8.3,
          avgDuration: 95,
          sentiment: { positive: 10, neutral: 5, negative: 2, unknown: 3 },
          drinkLabel: "drinks",
        }),
      });
    });

    await page.goto("/stats");

    await expect(page.locator("#headerIcon")).toHaveText("🍸");
    await expect(page.locator("#headerTitle")).toHaveText("Twilio — Olivia (Drinkss)");

    const kpiGrid = page.locator("#kpiGrid");
    await expect(kpiGrid).toContainText("20");
    await expect(kpiGrid).toContainText("50.0%");
    await expect(kpiGrid).toContainText("1m 35s");

    await expect(page.locator("#bottomRow")).toBeVisible();
    await expect(page.locator("#sentimentBars")).toContainText("10");
  });

  test("shows a failure message when /api/stats errors", async ({ page }) => {
    await page.route("**/api/stats", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });

    await page.goto("/stats");
    await expect(page.locator("#kpiGrid")).toContainText("Failed to load stats.");
  });
});
