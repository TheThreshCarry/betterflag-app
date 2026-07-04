import { describe, expect, it } from "vitest";
import {
  createClient,
  createFlagStore,
  ShipOSContext,
  ShipOSProvider,
  useFlag,
  useFlagDetail,
  useShipOS,
} from "../src/index";

describe("public exports", () => {
  it("exposes the provider, hooks, store factory, and re-exported client", () => {
    expect(typeof ShipOSProvider).toBe("function");
    expect(typeof useFlag).toBe("function");
    expect(typeof useFlagDetail).toBe("function");
    expect(typeof useShipOS).toBe("function");
    expect(typeof createFlagStore).toBe("function");
    expect(typeof createClient).toBe("function");
    expect(ShipOSContext).toBeDefined();
  });
});
