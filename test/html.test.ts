import { describe, expect, it } from "vitest";
import { escapeHtml } from "../html.ts";

describe("escapeHtml", () => {
  it("escapes all five reserved characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("Espresso, Cortado and Cappuccino")).toBe("Espresso, Cortado and Cappuccino");
  });

  it("escapes a script-injection attempt", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("handles an empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
