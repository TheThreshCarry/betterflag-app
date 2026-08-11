import { describe, expect, it } from "vitest";
import {
  createClient,
  createFlagStore,
  BetterFlagContext,
  BetterFlagProvider,
  useFlag,
  useFlagDetail,
  useBetterFlag,
} from "../src/index";

describe("public exports", () => {
  it("exposes the provider, hooks, store factory, and re-exported client", () => {
    expect(typeof BetterFlagProvider).toBe("function");
    expect(typeof useFlag).toBe("function");
    expect(typeof useFlagDetail).toBe("function");
    expect(typeof useBetterFlag).toBe("function");
    expect(typeof createFlagStore).toBe("function");
    expect(typeof createClient).toBe("function");
    expect(BetterFlagContext).toBeDefined();
  });
});
