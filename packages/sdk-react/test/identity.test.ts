import { describe, expect, it, vi } from "vitest";
import { createClient } from "@shiposapp/sdk";
import { createFlagStore } from "../src/store";

/**
 * These tests use a REAL @shiposapp/sdk client (with a fake fetch) inside a flag
 * store to prove the end-to-end wiring: an ambient identity set via
 * `client.signIn()` reaches evaluations even though the store passes no
 * explicit context, and a later `signIn`/`signOut` re-evaluates the store via
 * the client's `'update'` event.
 */

function fakeResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response;
}

function evaluateResponse(): Response {
  return fakeResponse({
    version: 1,
    results: [{ key: "checkout", value: true, variation: "on", reason: "rollout" }],
  });
}

/** Drain the microtask chains behind flagDetail().then(...). */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

function bodyOf(init: RequestInit | undefined): { context?: unknown } {
  return JSON.parse(String(init?.body));
}

describe("ambient identity through a flag store", () => {
  it("a client signIn identity reaches evaluation with no explicit hook context", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      evaluateResponse(),
    );
    const client = createClient({
      key: "k",
      fetch: fetch as unknown as typeof globalThis.fetch,
      refreshInterval: 0,
    });
    client.signIn("user-123", { plan: "pro" });

    const store = createFlagStore(client, "checkout", false); // no context passed
    store.subscribe(() => {});
    await flush();

    expect(store.getSnapshot().value).toBe(true);
    expect(bodyOf(fetch.mock.calls[0]![1]).context).toEqual({
      userId: "user-123",
      attributes: { plan: "pro" },
    });
    client.close();
  });

  it("re-evaluates the store when the identity changes", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      evaluateResponse(),
    );
    const client = createClient({
      key: "k",
      fetch: fetch as unknown as typeof globalThis.fetch,
      refreshInterval: 0,
    });

    const store = createFlagStore(client, "checkout", false);
    store.subscribe(() => {});
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1); // anonymous
    expect(bodyOf(fetch.mock.calls[0]![1]).context).toBeUndefined();

    client.signIn("user-9"); // clears cache + emits 'update' → store re-evaluates
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetch.mock.calls[1]![1]).context).toEqual({ userId: "user-9" });
    client.close();
  });
});
