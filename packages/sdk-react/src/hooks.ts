import {
  stableStringify,
  type EvaluationContext,
  type JsonValue,
  type BetterFlagClient,
} from "@betterflag/sdk";
import { useContext, useMemo, useSyncExternalStore } from "react";
import { BetterFlagContext, type BetterFlagContextValue } from "./context";
import { createFlagStore, type FlagState } from "./store";

/** Per-call evaluation context, taking precedence over the provider's `user`. */
export interface FlagOverrides {
  userId?: string;
  attributes?: Record<string, JsonValue>;
}

function useBetterFlagContext(): BetterFlagContextValue {
  const ctx = useContext(BetterFlagContext);
  if (ctx === null) {
    throw new Error(
      "Betterflag hooks must be used within <BetterFlagProvider>. Wrap your tree in " +
        '<BetterFlagProvider clientKey="bf_sdk_...">...</BetterFlagProvider> or pass ' +
        "an existing client via the `client` prop.",
    );
  }
  return ctx;
}

/** The underlying BetterFlagClient. Throws a helpful error outside the provider. */
export function useBetterFlag(): BetterFlagClient {
  return useBetterFlagContext().client;
}

/**
 * Evaluate a flag and return `{ value, reason, loading }`.
 *
 * SSR-safe: the server render and the first client render both return
 * `defaultValue` (or the provider's `bootstrap[key]`); the real value
 * arrives after mount and on every config `'update'` event.
 */
export function useFlagDetail<T extends JsonValue>(
  key: string,
  defaultValue: T,
  overrides?: FlagOverrides,
): FlagState<T> {
  const { client, user, bootstrap } = useBetterFlagContext();
  const context: EvaluationContext = overrides ?? user ?? {};

  // Serialized identities: callers pass fresh object literals every render;
  // only recreate the store (and re-evaluate) when content actually changes.
  const contextKey = stableStringify({
    userId: context.userId ?? null,
    attributes: context.attributes ?? null,
  });
  const defaultKey = stableStringify(defaultValue);
  const bootstrapValue = bootstrap === undefined ? undefined : bootstrap[key];

  const store = useMemo(
    () =>
      createFlagStore<T>(
        client,
        key,
        defaultValue,
        context,
        // The bootstrap map is untyped by key; trusting it to match T is the
        // same contract as the server value itself.
        bootstrapValue as T | undefined,
      ),
    // context/defaultValue are tracked through their serialized keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, key, contextKey, defaultKey, bootstrap],
  );

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/**
 * Evaluate a flag and return just its value. Returns `defaultValue` until
 * the first evaluation resolves, and whenever evaluation fails (offline).
 */
export function useFlag<T extends JsonValue>(
  key: string,
  defaultValue: T,
  overrides?: FlagOverrides,
): T {
  return useFlagDetail(key, defaultValue, overrides).value;
}
