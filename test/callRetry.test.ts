import { describe, expect, it } from "vitest";
import { isRetryableCallStatus, MAX_CALL_RETRIES, nextRetryDelayMs, RETRY_BASE_DELAY_MS, RETRY_JITTER_MS, shouldRetryCall } from "../callRetry.ts";

describe("isRetryableCallStatus", () => {
  it("treats busy as retryable", () => {
    expect(isRetryableCallStatus("busy")).toBe(true);
  });

  it("treats no-answer as retryable", () => {
    expect(isRetryableCallStatus("no-answer")).toBe(true);
  });

  it("treats failed as retryable (SIP INVITE timeout to slow gateway)", () => {
    expect(isRetryableCallStatus("failed")).toBe(true);
  });

  it("does not treat completed as retryable", () => {
    expect(isRetryableCallStatus("completed")).toBe(false);
  });

  it("does not treat in-progress as retryable", () => {
    expect(isRetryableCallStatus("in-progress")).toBe(false);
  });
});

describe("nextRetryDelayMs", () => {
  it("returns a value in [base, base + jitter)", () => {
    for (let i = 0; i < 100; i++) {
      const d = nextRetryDelayMs();
      expect(d).toBeGreaterThanOrEqual(RETRY_BASE_DELAY_MS);
      expect(d).toBeLessThan(RETRY_BASE_DELAY_MS + RETRY_JITTER_MS);
    }
  });
});

describe("shouldRetryCall", () => {
  it("retries a busy call on the first attempt (retryCount 0)", () => {
    expect(shouldRetryCall("busy", 0)).toBe(true);
  });

  it("retries a no-answer call on the second attempt (retryCount 1)", () => {
    expect(shouldRetryCall("no-answer", 1)).toBe(true);
  });

  it("stops retrying once MAX_CALL_RETRIES has been reached", () => {
    expect(shouldRetryCall("busy", MAX_CALL_RETRIES)).toBe(false);
  });

  it("stops retrying past MAX_CALL_RETRIES", () => {
    expect(shouldRetryCall("busy", MAX_CALL_RETRIES + 1)).toBe(false);
  });

  it("never retries a non-retryable status regardless of retryCount", () => {
    expect(shouldRetryCall("completed", 0)).toBe(false);
  });

  it("respects a custom maxRetries override", () => {
    expect(shouldRetryCall("busy", 3, 5)).toBe(true);
    expect(shouldRetryCall("busy", 5, 5)).toBe(false);
  });
});
