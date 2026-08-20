import { expect, test } from "@playwright/test";

const AUTH_HEADER = "Basic " + Buffer.from("e2e-user:e2e-pass").toString("base64");
const WRONG_AUTH_HEADER = "Basic " + Buffer.from("wrong:creds").toString("base64");

test.describe("basic auth gates", () => {
  test("GET /admin requires auth", async ({ request }) => {
    const res = await request.get("/admin");
    expect(res.status()).toBe(401);
  });

  test("GET /admin succeeds with correct credentials", async ({ request }) => {
    const res = await request.get("/admin", { headers: { Authorization: AUTH_HEADER } });
    expect(res.status()).toBe(200);
  });

  test("GET /admin rejects incorrect credentials", async ({ request }) => {
    const res = await request.get("/admin", { headers: { Authorization: WRONG_AUTH_HEADER } });
    expect(res.status()).toBe(401);
  });

  test("GET /stats requires auth", async ({ request }) => {
    const res = await request.get("/stats");
    expect(res.status()).toBe(401);
  });

  test("GET /api/stats requires auth", async ({ request }) => {
    const res = await request.get("/api/stats");
    expect(res.status()).toBe(401);
  });

  test("GET /api/admin/config requires auth", async ({ request }) => {
    const res = await request.get("/api/admin/config");
    expect(res.status()).toBe(401);
  });

  test("POST /api/admin/config requires auth", async ({ request }) => {
    const res = await request.post("/api/admin/config", { data: {} });
    expect(res.status()).toBe(401);
  });

  test("unauthenticated requests get a WWW-Authenticate challenge header", async ({ request }) => {
    const res = await request.get("/stats");
    expect(res.headers()["www-authenticate"]).toContain("Basic");
  });
});
