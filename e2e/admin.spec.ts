import { expect, test } from "@playwright/test";

const AUTH_HEADER = "Basic " + Buffer.from("e2e-user:e2e-pass").toString("base64");

const MOCK_CONFIG = {
  attractMode: false,
  allowPhoneNumberOverride: true,
  drinkType: "drinks",
  eventName: "e2e-test",
  eventDisplayName: "",
  menuItems: "Irish Lovers(Espresso, Whiskey),Shakerato Lovers,Blue Gin Lovers",
};

test.describe("POST /api/admin/config validation (API-level, real server logic)", () => {
  test("rejects an invalid body with 400 and per-field error details", async ({ request }) => {
    const res = await request.post("/api/admin/config", {
      headers: { Authorization: AUTH_HEADER },
      data: {
        attractMode: true,
        allowPhoneNumberOverride: false,
        drinkType: "tea", // invalid
        eventName: "Not Valid!", // invalid
        eventDisplayName: "",
        menuItems: "", // invalid
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errors.drinkType).toContain("coffee");
    expect(body.errors.eventName).toContain("lowercase");
    expect(body.errors.menuItems).toBe("Menu items cannot be empty.");
  });

  test("accepts a fully valid body and does not report field errors", async ({ request }) => {
    // NB: this intentionally uses a body identical to what's already stored
    // so a real write is harmless if it goes through — but we still don't
    // want to depend on that succeeding, so we only assert it gets *past*
    // validation (never a 400/validation-error shape). A 500 here (from the
    // fake Twilio credentials failing to write to Sync) is acceptable.
    const res = await request.post("/api/admin/config", {
      headers: { Authorization: AUTH_HEADER },
      data: MOCK_CONFIG,
    });
    expect(res.status()).not.toBe(400);
  });
});

test.describe("/admin page", () => {
  test.use({ httpCredentials: { username: "e2e-user", password: "e2e-pass" } });

  async function mockAdminConfigApi(page: import("@playwright/test").Page, activeCalls = 0) {
    await page.route("**/api/admin/config", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ config: MOCK_CONFIG, activeCalls }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, restarting: true }),
        });
      }
    });
  }

  test("loads and populates the form from the current config", async ({ page }) => {
    await mockAdminConfigApi(page);
    await page.goto("/admin");

    await expect(page.locator("#drinkType")).toHaveValue("drinks");
    await expect(page.locator("#eventName")).toHaveValue("e2e-test");
    await expect(page.locator("#menuItems")).toHaveValue(MOCK_CONFIG.menuItems);
    await expect(page.locator("#allowPhoneNumberOverride")).toBeChecked();
    await expect(page.locator("#attractMode")).not.toBeChecked();
  });

  test("shows an inline error and disables Apply for an invalid event name", async ({ page }) => {
    await mockAdminConfigApi(page);
    await page.goto("/admin");

    await page.locator("#eventName").fill("Not Valid!");
    await expect(page.locator("#eventNameError")).toHaveText(
      "Must be lowercase letters, numbers, and hyphens only (e.g. wearedevs).",
    );
    await expect(page.locator("#applyBtn")).toBeDisabled();
  });

  test("clears the error and re-enables Apply once the event name is fixed", async ({ page }) => {
    await mockAdminConfigApi(page);
    await page.goto("/admin");

    await page.locator("#eventName").fill("Not Valid!");
    await expect(page.locator("#applyBtn")).toBeDisabled();

    await page.locator("#eventName").fill("valid-event");
    await expect(page.locator("#eventNameError")).toHaveText("");
    await expect(page.locator("#applyBtn")).toBeEnabled();
  });

  test("shows a restarting message after a successful save", async ({ page }) => {
    await mockAdminConfigApi(page);
    await page.goto("/admin");

    await page.locator("#applyBtn").click();
    await expect(page.locator("#statusMsg")).toHaveText("Saved — restarting server to apply changes…");
    await expect(page.locator("#statusMsg")).toHaveClass(/success/);
  });

  test("shows the active-calls badge when calls are in progress", async ({ page }) => {
    await mockAdminConfigApi(page, 3);
    await page.goto("/admin");

    await expect(page.locator("#activeCallsBadge")).toBeVisible();
    await expect(page.locator("#activeCallsBadge")).toContainText("3 calls in progress");
  });
});
