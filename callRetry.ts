// Outbound calls that come back busy, no-answer, or failed are retried this
// many times before being marked failed — see frontend.ts's /api/callStatus.
export const MAX_CALL_RETRIES = 2;

// Base delay + jitter between retries. A slow SIP gateway is unlikely to
// recover in 2 s, and firing all retries at the same millisecond offset from
// each callback amplifies bursty contention. Widen the gap and de-align the
// retriers.
export const RETRY_BASE_DELAY_MS = 5000;
export const RETRY_JITTER_MS = 3000;

export function isRetryableCallStatus(callStatus: string): boolean {
  return callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed";
}

export function shouldRetryCall(
  callStatus: string,
  retryCount: number,
  maxRetries: number = MAX_CALL_RETRIES,
): boolean {
  return isRetryableCallStatus(callStatus) && retryCount < maxRetries;
}

export function nextRetryDelayMs(): number {
  return RETRY_BASE_DELAY_MS + Math.floor(Math.random() * RETRY_JITTER_MS);
}
