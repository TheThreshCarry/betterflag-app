import { stableStringify } from "./stable-stringify";
import type {
  EvaluateResponse,
  EvaluationContext,
  EvaluationResult,
  JsonValue,
} from "./types";

/** Version stamped into the `X-Betterflag-SDK` header. Keep in sync with package.json. */
export const SDK_VERSION = "0.1.0";

const SDK_HEADER = `js/${SDK_VERSION}`;
const DEFAULT_BASE_URL = "https://api.betterflag.app";
const DEFAULT_REFRESH_INTERVAL_MS = 30_000;
const MIN_CACHE_TTL_MS = 5_000;

export interface BetterFlagClientOptions {
  /** SDK key (`bf_sdk_...`). Publishable, safe to ship to browsers. */
  key: string;
  /** API origin. Defaults to `https://api.betterflag.app`. */
  baseUrl?: string;
  /**
   * How often (ms) to poll `GET /v1/snapshot` for config changes, and the
   * TTL of the local evaluation cache (clamped to a 5s minimum).
   * Defaults to 30000. Pass 0 to disable background polling.
   */
  refreshInterval?: number;
  /**
   * Offline fallback values by flag key. Used when the network is
   * unreachable: `allFlags()` returns these, and `flagDetail()` falls back
   * to them when no per-call default is given. Per-call `default` always
   * wins over this map.
   */
  defaults?: Record<string, JsonValue>;
  /** Custom fetch implementation (tests, polyfills). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Called with every swallowed error (network, HTTP, parse). Never throws back. */
  onError?: (error: unknown) => void;
}

export interface FlagOptions<T extends JsonValue> {
  userId?: string;
  attributes?: Record<string, JsonValue>;
  /** Returned whenever the flag can't be evaluated (offline, error, unknown key). */
  default: T;
}

export interface FlagDetailOptions {
  userId?: string;
  attributes?: Record<string, JsonValue>;
  /** Value used in the synthesized result when evaluation fails. */
  default?: JsonValue;
}

type UpdateListener = () => void;

interface CacheEntry {
  result: EvaluationResult;
  timestamp: number;
}

/**
 * Betterflag feature-flags client for Node and the browser.
 *
 * Guarantees:
 * - `flag()` NEVER throws and never rejects, on any failure it resolves
 *   with the caller's default (offline-defaults guarantee).
 * - Zero runtime dependencies; talks plain `fetch`.
 * - The background poll timer is unref'd in Node, so it never holds the
 *   process open.
 */
export class BetterFlagClient {
  private readonly key: string;
  private readonly baseUrl: string;
  private readonly refreshInterval: number;
  private readonly cacheTtl: number;
  private readonly defaults: Record<string, JsonValue>;
  private readonly fetchImpl: typeof fetch;
  private readonly onError: ((error: unknown) => void) | undefined;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly listeners = new Set<UpdateListener>();

  private timer: ReturnType<typeof setInterval> | null = null;
  private pollingStarted = false;
  private closed = false;

  private etag: string | null = null;
  private snapshotVersion: number | null = null;

  // Ambient identity set by signIn(), merged into every evaluation context
  // until signOut(). Per-call userId/attributes always take precedence.
  private identityUserId: string | undefined = undefined;
  private identityAttributes: Record<string, JsonValue> | undefined = undefined;

  private readonly readyPromise: Promise<void>;
  private resolveReady: () => void = () => {};
  private readySettled = false;

  constructor(options: BetterFlagClientOptions) {
    this.key = options.key;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.refreshInterval = options.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.cacheTtl = Math.max(this.refreshInterval, MIN_CACHE_TTL_MS);
    this.defaults = options.defaults ?? {};
    const customFetch = options.fetch;
    // Wrap global fetch in an arrow so it isn't called with a bad `this`
    // ("Illegal invocation" in browsers).
    this.fetchImpl = customFetch ?? ((input, init) => globalThis.fetch(input, init));
    this.onError = options.onError;
    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
  }

  /**
   * Evaluate one flag for a user. Resolves with the flag's value, or with
   * `opts.default` on any network/HTTP failure or when the flag doesn't
   * exist. Never throws.
   */
  async flag<T extends JsonValue>(key: string, opts: FlagOptions<T>): Promise<T> {
    const result = await this.evaluate(key, {
      userId: opts.userId,
      attributes: opts.attributes,
    });
    if (result === null || result.reason === "not_found") return opts.default;
    // The server returns JsonValue; narrowing to T is the caller's contract
    // (their default establishes the expected shape).
    return result.value as T;
  }

  /**
   * Like `flag()` but returns the full evaluation result (reason, variation,
   * ruleId, bucket). On failure a synthesized result is returned: value from
   * `opts.default`, then the client-level `defaults` map, then `null`.
   */
  async flagDetail(key: string, opts: FlagDetailOptions = {}): Promise<EvaluationResult> {
    const result = await this.evaluate(key, {
      userId: opts.userId,
      attributes: opts.attributes,
    });
    if (result !== null && result.reason !== "not_found") return result;
    const fallback = opts.default !== undefined ? opts.default : this.defaults[key];
    return {
      key,
      value: fallback === undefined ? null : fallback,
      variation: "default",
      reason: result !== null ? "not_found" : "default",
    };
  }

  /**
   * Evaluate every flag in the environment for a context. Returns a map of
   * flag key → value. On failure returns the client-level `defaults` map
   * (`{}` when none was configured). Never throws.
   */
  async allFlags(context: EvaluationContext = {}): Promise<Record<string, JsonValue>> {
    try {
      this.startPolling();
      const response = await this.postEvaluate({
        context: normalizeContext(this.mergeIdentity(context)),
      });
      const flags: Record<string, JsonValue> = {};
      for (const result of response.results) {
        if (result.reason !== "not_found") flags[result.key] = result.value;
      }
      return flags;
    } catch (error) {
      this.reportError(error);
      return { ...this.defaults };
    }
  }

  /**
   * Identify the current user (PostHog-style). Sets an ambient evaluation
   * context, `userId` plus optional `metadata` attributes, that is merged
   * into every subsequent `flag()`, `flagDetail()`, and `allFlags()` call so
   * you don't repeat the user on each check:
   *
   * ```ts
   * betterflag.signIn("user-123", { plan: "pro", region: "eu" });
   * await betterflag.flag("new-checkout", { default: false }); // evaluated for user-123
   * ```
   *
   * A per-call `userId`/`attributes` always overrides the ambient identity.
   * Each `signIn` replaces the previous identity (it does not merge with it).
   * Purely local: Betterflag targets users at evaluation time, so there is no
   * network round-trip here. The evaluation cache is cleared and an
   * `'update'` event is emitted so React hooks re-evaluate for the new user.
   */
  signIn(userId: string, metadata?: Record<string, JsonValue>): void {
    if (typeof userId !== "string" || userId === "") {
      this.reportError(new Error("Betterflag: signIn(userId) requires a non-empty string"));
      return;
    }
    this.identityUserId = userId;
    this.identityAttributes = metadata;
    this.cache.clear();
    this.emitUpdate();
  }

  /**
   * Clear the ambient identity set by {@link signIn}. Subsequent evaluations
   * are anonymous again (unless a per-call `userId` is passed). Clears the
   * evaluation cache and emits `'update'`. Safe to call when not signed in.
   */
  signOut(): void {
    if (this.identityUserId === undefined && this.identityAttributes === undefined) {
      return;
    }
    this.identityUserId = undefined;
    this.identityAttributes = undefined;
    this.cache.clear();
    this.emitUpdate();
  }

  /**
   * The currently identified user, or `null` when anonymous. Returns a copy -
   * mutating it does not change the client's identity.
   */
  getUser(): { userId: string; attributes?: Record<string, JsonValue> } | null {
    if (this.identityUserId === undefined) return null;
    return this.identityAttributes === undefined
      ? { userId: this.identityUserId }
      : { userId: this.identityUserId, attributes: { ...this.identityAttributes } };
  }

  /**
   * Subscribe to config-change events. `'update'` fires after a snapshot
   * poll detects a new version (the evaluation cache has already been
   * cleared when listeners run). Returns an unsubscribe function.
   */
  on(event: "update", listener: UpdateListener): () => void {
    void event; // only 'update' exists today; the parameter keeps the API forward-compatible
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Resolves after the first snapshot fetch settles (success OR failure -
   * failures are reported via `onError` first). Resolves immediately when
   * polling is disabled. Never rejects.
   */
  ready(): Promise<void> {
    if (this.refreshInterval <= 0 || this.closed) return Promise.resolve();
    this.startPolling();
    return this.readyPromise;
  }

  /** Stop background polling and drop all listeners. Idempotent. */
  close(): void {
    this.closed = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.listeners.clear();
    this.settleReady();
  }

  // ---------------------------------------------------------------- internal

  private async evaluate(
    key: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult | null> {
    try {
      this.startPolling();
      const resolved = this.mergeIdentity(context);
      const cacheKey = `${key}|${resolved.userId ?? ""}|${stableStringify(resolved.attributes)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
        return cached.result;
      }
      const response = await this.postEvaluate({
        key,
        context: normalizeContext(resolved),
      });
      const result =
        response.results.find((entry) => entry.key === key) ??
        response.results[0] ??
        null;
      if (result !== null) {
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
      }
      return result;
    } catch (error) {
      this.reportError(error);
      return null;
    }
  }

  private async postEvaluate(body: {
    key?: string;
    context?: EvaluationContext;
  }): Promise<EvaluateResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/evaluate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        "X-Betterflag-SDK": SDK_HEADER,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Betterflag: POST /v1/evaluate responded ${response.status}`);
    }
    const parsed = (await response.json()) as Partial<EvaluateResponse>;
    return {
      version: typeof parsed.version === "number" ? parsed.version : 0,
      results: Array.isArray(parsed.results) ? parsed.results : [],
    };
  }

  private startPolling(): void {
    if (this.pollingStarted || this.closed || this.refreshInterval <= 0) return;
    this.pollingStarted = true;
    // First fetch runs immediately (it settles `ready()`), then on interval.
    void this.fetchSnapshot().finally(() => this.settleReady());
    const timer = setInterval(() => {
      void this.fetchSnapshot();
    }, this.refreshInterval);
    // In Node, don't let the poll timer hold the process open. In browsers
    // setInterval returns a number with no unref, feature-detect.
    const unrefable = timer as unknown as { unref?: () => void };
    if (typeof unrefable.unref === "function") unrefable.unref();
    this.timer = timer;
  }

  private async fetchSnapshot(): Promise<void> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.key}`,
        "X-Betterflag-SDK": SDK_HEADER,
      };
      if (this.etag !== null) headers["If-None-Match"] = this.etag;

      const response = await this.fetchImpl(`${this.baseUrl}/v1/snapshot`, {
        method: "GET",
        headers,
      });

      if (response.status === 304) return; // unchanged, keep the cache warm
      if (!response.ok) {
        throw new Error(`Betterflag: GET /v1/snapshot responded ${response.status}`);
      }

      const etag = response.headers.get("ETag");
      let version: number | null = null;
      try {
        const body = (await response.json()) as { version?: number };
        if (typeof body.version === "number") version = body.version;
      } catch {
        // Tolerate empty/malformed bodies, fall back to ETag comparison.
      }

      const previousVersion = this.snapshotVersion;
      const previousEtag = this.etag;
      if (version !== null) this.snapshotVersion = version;
      if (etag !== null) this.etag = etag;

      const changed =
        version !== null && previousVersion !== null
          ? version !== previousVersion
          : etag !== null && previousEtag !== null && etag !== previousEtag;

      if (changed) {
        this.cache.clear();
        this.emitUpdate();
      }
    } catch (error) {
      this.reportError(error);
    }
  }

  private emitUpdate(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        this.reportError(error);
      }
    }
  }

  private settleReady(): void {
    if (this.readySettled) return;
    this.readySettled = true;
    this.resolveReady();
  }

  /**
   * Merge the ambient identity (from `signIn`) with a per-call context.
   * The per-call `userId` and per-attribute values win; identity attributes
   * fill in the rest. Returns `{}` when both are empty.
   */
  private mergeIdentity(context: EvaluationContext): EvaluationContext {
    const userId = context.userId ?? this.identityUserId;
    const hasAttributes =
      this.identityAttributes !== undefined || context.attributes !== undefined;
    const attributes = hasAttributes
      ? { ...this.identityAttributes, ...context.attributes }
      : undefined;

    const merged: EvaluationContext = {};
    if (userId !== undefined) merged.userId = userId;
    if (attributes !== undefined) merged.attributes = attributes;
    return merged;
  }

  private reportError(error: unknown): void {
    try {
      this.onError?.(error);
    } catch {
      // A throwing error handler must never break the offline-defaults path.
    }
  }
}

/** Create a Betterflag client. See {@link BetterFlagClientOptions}. */
export function createClient(options: BetterFlagClientOptions): BetterFlagClient {
  return new BetterFlagClient(options);
}

function normalizeContext(context: EvaluationContext): EvaluationContext | undefined {
  if (context.userId === undefined && context.attributes === undefined) {
    return undefined;
  }
  const normalized: EvaluationContext = {};
  if (context.userId !== undefined) normalized.userId = context.userId;
  if (context.attributes !== undefined) normalized.attributes = context.attributes;
  return normalized;
}
