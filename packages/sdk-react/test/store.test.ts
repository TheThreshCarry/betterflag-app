import { describe, expect, it, vi } from "vitest";
import type { EvaluationResult, JsonValue } from "@shipos/sdk";
import { createFlagStore, type FlagClient } from "../src/store";

function detail(
  key: string,
  value: JsonValue,
  reason: EvaluationResult["reason"] = "rollout",
): EvaluationResult {
  return { key, value, variation: "on", reason };
}

interface MockClientHandle {
  client: FlagClient;
  flagDetail: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  fireUpdate: () => void;
  listenerCount: () => number;
  detachCount: () => number;
}

function mockClient(respond: (key: string) => Promise<EvaluationResult>): MockClientHandle {
  const updateListeners = new Set<() => void>();
  let detached = 0;
  const flagDetail = vi.fn((key: string) => respond(key));
  const on = vi.fn((_event: "update", listener: () => void) => {
    updateListeners.add(listener);
    return () => {
      updateListeners.delete(listener);
      detached += 1;
    };
  });
  return {
    client: { flagDetail, on } as unknown as FlagClient,
    flagDetail,
    on,
    fireUpdate: () => {
      for (const listener of [...updateListeners]) listener();
    },
    listenerCount: () => updateListeners.size,
    detachCount: () => detached,
  };
}

/** Drain the microtask chains behind flagDetail().then(...). */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe("createFlagStore", () => {
  it("starts with the default value, loading, and does not touch the client before subscribe", () => {
    const mock = mockClient(async (key) => detail(key, true));
    const store = createFlagStore(mock.client, "checkout", false);

    expect(store.getSnapshot()).toEqual({ value: false, reason: null, loading: true });
    expect(store.getServerSnapshot()).toBe(store.getSnapshot()); // hydration-safe
    expect(mock.flagDetail).not.toHaveBeenCalled();
    expect(mock.on).not.toHaveBeenCalled();
  });

  it("prefers the bootstrap value for the initial snapshot", () => {
    const mock = mockClient(async (key) => detail(key, "dark"));
    const store = createFlagStore(mock.client, "theme", "light", {}, "dark");

    expect(store.getSnapshot().value).toBe("dark");
    expect(store.getSnapshot().loading).toBe(true);
  });

  it("evaluates on first subscribe, passing context and default, then notifies", async () => {
    const mock = mockClient(async (key) => detail(key, true, "rule_match"));
    const store = createFlagStore(mock.client, "checkout", false, {
      userId: "u1",
      attributes: { plan: "pro" },
    });
    const listener = vi.fn();

    store.subscribe(listener);
    expect(mock.flagDetail).toHaveBeenCalledWith("checkout", {
      userId: "u1",
      attributes: { plan: "pro" },
      default: false,
    });

    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({
      value: true,
      reason: "rule_match",
      loading: false,
    });
    // Server snapshot never moves off the initial state.
    expect(store.getServerSnapshot()).toEqual({ value: false, reason: null, loading: true });
  });

  it("keeps the snapshot referentially stable between changes", async () => {
    const mock = mockClient(async (key) => detail(key, true));
    const store = createFlagStore(mock.client, "checkout", false);
    store.subscribe(() => {});
    await flush();

    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("re-evaluates on client 'update' events and skips notify when nothing changed", async () => {
    let value: JsonValue = "v1";
    const mock = mockClient(async (key) => detail(key, value));
    const store = createFlagStore(mock.client, "release", "v0");
    const listener = vi.fn();
    store.subscribe(listener);
    await flush();
    expect(store.getSnapshot().value).toBe("v1");
    expect(listener).toHaveBeenCalledTimes(1);

    value = "v2";
    mock.fireUpdate();
    await flush();
    expect(store.getSnapshot().value).toBe("v2");
    expect(listener).toHaveBeenCalledTimes(2);

    mock.fireUpdate(); // same value again — no notification, same snapshot object
    const snapshotBefore = store.getSnapshot();
    await flush();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toBe(snapshotBefore);
  });

  it("subscribes to the client once for many listeners and detaches after the last leaves", async () => {
    const mock = mockClient(async (key) => detail(key, true));
    const store = createFlagStore(mock.client, "checkout", false);

    const offA = store.subscribe(() => {});
    const offB = store.subscribe(() => {});
    expect(mock.on).toHaveBeenCalledTimes(1);
    expect(mock.flagDetail).toHaveBeenCalledTimes(1);

    offA();
    expect(mock.listenerCount()).toBe(1);
    offB();
    expect(mock.listenerCount()).toBe(0);
    expect(mock.detachCount()).toBe(1);
  });

  it("drops in-flight results that resolve after the last unsubscribe", async () => {
    let resolveEvaluation: ((result: EvaluationResult) => void) | undefined;
    const mock = mockClient(
      () => new Promise<EvaluationResult>((resolve) => (resolveEvaluation = resolve)),
    );
    const store = createFlagStore(mock.client, "checkout", false);
    const listener = vi.fn();

    const off = store.subscribe(listener);
    off(); // unsubscribe while evaluation is still pending

    resolveEvaluation?.(detail("checkout", true));
    await flush();

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({ value: false, reason: null, loading: true });
  });
});
