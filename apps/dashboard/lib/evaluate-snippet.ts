const DEFAULT_API_URL = "https://api.betterflag.app";
const DEFAULT_SDK_KEY = "bf_sdk_YOUR_KEY";
const DEFAULT_USER_ID = "u_123";

export function evaluateApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

/** curl that hits POST /v1/evaluate for one flag. SDK key selects the env. */
export function buildEvaluateCurl(opts: {
  flagKey: string;
  apiUrl?: string;
  sdkKey?: string | null;
  userId?: string;
}): string {
  const apiUrl = opts.apiUrl ?? evaluateApiUrl();
  const sdkKey = opts.sdkKey && opts.sdkKey.length > 0 ? opts.sdkKey : DEFAULT_SDK_KEY;
  const userId = opts.userId && opts.userId.length > 0 ? opts.userId : DEFAULT_USER_ID;
  const body = JSON.stringify({ key: opts.flagKey, context: { userId } });
  return `curl -X POST ${apiUrl}/v1/evaluate \\
  -H "Authorization: Bearer ${sdkKey}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`;
}
