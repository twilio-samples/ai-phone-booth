// Outbound calls that come back busy or no-answer are retried this many
// times (2s apart) before being marked failed — see frontend.ts's /api/callStatus.
export const MAX_CALL_RETRIES = 2;

export function isRetryableCallStatus(callStatus: string): boolean {
  return callStatus === "busy" || callStatus === "no-answer";
}

export function shouldRetryCall(
  callStatus: string,
  retryCount: number,
  maxRetries: number = MAX_CALL_RETRIES,
): boolean {
  return isRetryableCallStatus(callStatus) && retryCount < maxRetries;
}
