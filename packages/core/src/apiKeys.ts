/**
 * API key format shared by the control plane (mint/verify), the edge worker
 * (SDK key resolution from KV) and the MCP server (agent keys).
 *
 * Full key:   sos_<tag>_<40 lowercase hex>   (48 chars total)
 * Prefix:     first 16 chars, e.g. "sos_agt_ab12cd34" — safe to display,
 *             stored in api_keys.prefix and used for audit attribution.
 * Storage:    SHA-256 hex of the full key; plaintext shown once at creation.
 */

export type ApiKeyKind = "sdk" | "agent" | "admin";

const KIND_TAG: Record<ApiKeyKind, string> = { sdk: "sdk", agent: "agt", admin: "adm" };
const TAG_KIND: Record<string, ApiKeyKind> = { sdk: "sdk", agt: "agent", adm: "admin" };

export const API_KEY_RE = /^sos_(sdk|agt|adm)_[0-9a-f]{40}$/;
export const API_KEY_PREFIX_LENGTH = 16;

/** Pure formatter — the caller supplies 40 hex chars of CSPRNG output. */
export function formatApiKey(kind: ApiKeyKind, hex40: string): string {
  if (!/^[0-9a-f]{40}$/.test(hex40)) throw new Error("expected 40 lowercase hex chars");
  return `sos_${KIND_TAG[kind]}_${hex40}`;
}

export function keyPrefixOf(key: string): string {
  return key.slice(0, API_KEY_PREFIX_LENGTH);
}

export function kindOfKey(key: string): ApiKeyKind | null {
  const m = API_KEY_RE.exec(key);
  return m ? TAG_KIND[m[1]!]! : null;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish comparison for hex digests of equal length. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * KV entry the control plane writes at `key:{prefix}` when an SDK key is
 * created, and the edge worker reads to resolve a presented key without ever
 * touching Postgres.
 */
export interface SdkKeyKvEntry {
  orgId: string;
  projectId: string;
  envSlug: string;
  /** SHA-256 hex of the full key; edge verifies the presented key against it. */
  hash: string;
  revoked: boolean;
}
