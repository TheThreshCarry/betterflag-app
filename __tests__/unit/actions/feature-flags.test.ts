import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb } from "../../helpers/db-mock";
import {
  TEST_ORG_ID,
  mockGetOrganizationId,
  mockNextCache,
  mockNextHeaders,
} from "../../helpers/auth-mock";

const { mockDb, mockQuery, chainable, returningFn } = createMockDb();

vi.mock("@/lib/db", () => ({ default: mockDb }));
vi.mock("@/lib/sync/kv-sync", () => ({ syncFlags: vi.fn() }));

mockGetOrganizationId();
mockNextCache();
mockNextHeaders();

const {
  getFeatureFlags,
  getFeatureFlag,
  createFeatureFlag,
  updateFeatureFlag,
  toggleFeatureFlag,
  deleteFeatureFlag,
} = await import("@/lib/actions/feature-flags");

describe("feature-flags actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFeatureFlags", () => {
    it("queries flags for current organization", async () => {
      mockQuery.featureFlags.findMany.mockResolvedValueOnce([
        { id: "1", key: "beta", enabled: true },
      ]);
      const result = await getFeatureFlags();
      expect(mockQuery.featureFlags.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("filters by environment when provided", async () => {
      mockQuery.featureFlags.findMany.mockResolvedValueOnce([]);
      await getFeatureFlags("staging");
      expect(mockQuery.featureFlags.findMany).toHaveBeenCalled();
    });
  });

  describe("getFeatureFlag", () => {
    it("finds flag by id", async () => {
      const flag = { id: "abc", key: "test", enabled: false };
      mockQuery.featureFlags.findFirst.mockResolvedValueOnce(flag);
      const result = await getFeatureFlag("abc");
      expect(result).toEqual(flag);
    });
  });

  describe("createFeatureFlag", () => {
    it("inserts a new flag and returns it", async () => {
      const created = { id: "new-1", key: "new-flag", enabled: false };
      returningFn.mockResolvedValueOnce([created]);

      const result = await createFeatureFlag({
        key: "new-flag",
        name: "New Flag",
        enabled: false,
        environment: "production",
      });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe("updateFeatureFlag", () => {
    it("updates and returns the flag", async () => {
      const updated = { id: "1", key: "beta", enabled: true, organizationId: TEST_ORG_ID };
      returningFn.mockResolvedValueOnce([updated]);

      const result = await updateFeatureFlag("1", { enabled: true });
      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  describe("toggleFeatureFlag", () => {
    it("delegates to updateFeatureFlag", async () => {
      const updated = { id: "1", key: "beta", enabled: false, organizationId: TEST_ORG_ID };
      returningFn.mockResolvedValueOnce([updated]);

      const result = await toggleFeatureFlag("1", false);
      expect(result).toEqual(updated);
    });
  });

  describe("deleteFeatureFlag", () => {
    it("fetches flag then deletes it", async () => {
      mockQuery.featureFlags.findFirst.mockResolvedValueOnce({
        id: "1",
        organizationId: TEST_ORG_ID,
      });
      await deleteFeatureFlag("1");
      expect(mockQuery.featureFlags.findFirst).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
