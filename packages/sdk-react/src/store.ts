import type {
  EvaluationContext,
  EvaluationReason,
  JsonValue,
  BetterFlagClient,
} from "@betterflag/sdk";

/**
 * The slice of BetterFlagClient the flag store needs. Kept minimal so tests can
 * pass a plain mock object.
 */
export type FlagClient = Pick<BetterFlagClient, "flagDetail" | "on">;

export interface FlagState<T extends JsonValue> {
  value: T;
  /** null until the first evaluation resolves (or when it failed). */
  reason: EvaluationReason | null;
  /** true until the first evaluation settles. */
  loading: boolean;
}

/**
 * External store consumed by `useSyncExternalStore`. Pure, no React
 * imports, so the subscription logic is unit-testable on its own.
 */
export interface FlagStore<T extends JsonValue> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): FlagState<T>;
  /** Always the initial (default/bootstrap) state, hydration-safe. */
  getServerSnapshot(): FlagState<T>;
}

/**
 * Creates a store for one (flag, context) pair.
 *
 * - The initial snapshot is `bootstrapValue ?? defaultValue` with
 *   `loading: true`. `getServerSnapshot()` returns the same object forever,
 *   so server render === first client render (no hydration mismatch).
 * - Evaluation starts lazily on the FIRST subscribe (i.e. on mount).
 * - Re-evaluates whenever the client emits an `'update'` event.
 * - Detaches from the client when the last subscriber leaves; in-flight
 *   results arriving after that are dropped.
 */
export function createFlagStore<T extends JsonValue>(
  client: FlagClient,
  key: string,
  defaultValue: T,
  context: EvaluationContext = {},
  bootstrapValue?: T,
): FlagStore<T> {
  const initial: FlagState<T> = {
    value: bootstrapValue !== undefined ? bootstrapValue : defaultValue,
    reason: null,
    loading: true,
  };
  let state: FlagState<T> = initial;
  const listeners = new Set<() => void>();
  let detachUpdate: (() => void) | null = null;
  let evaluationToken = 0;

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const setState = (next: FlagState<T>): void => {
    if (
      next.value === state.value &&
      next.reason === state.reason &&
      next.loading === state.loading
    ) {
      return; // keep the snapshot referentially stable when nothing changed
    }
    state = next;
    notify();
  };

  const evaluate = (): void => {
    const token = ++evaluationToken;
    client
      .flagDetail(key, {
        userId: context.userId,
        attributes: context.attributes,
        default: defaultValue,
      })
      .then((result) => {
        if (token !== evaluationToken) return; // superseded or detached
        // flagDetail never resolves without a value: on any failure it
        // synthesizes a result carrying the default we passed above.
        setState({ value: result.value as T, reason: result.reason, loading: false });
      })
      .catch(() => {
        if (token !== evaluationToken) return;
        setState({ value: initial.value, reason: null, loading: false });
      });
  };

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) {
        detachUpdate = client.on("update", () => evaluate());
        evaluate();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          detachUpdate?.();
          detachUpdate = null;
          evaluationToken += 1; // drop any in-flight resolution
        }
      };
    },
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
  };
}
