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
vi.mock("@/lib/cache/content-types", () => ({
  getCachedContentTypes: vi.fn((_orgId: string, fn: Function) => fn()),
  getCachedContentType: vi.fn((_id: string, fn: Function) => fn()),
  getCachedContentTypeBySlug: vi.fn((_orgId: string, _slug: string, fn: Function) => fn()),
  invalidateContentTypeCache: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

mockGetOrganizationId();
mockNextCache();
mockNextHeaders();

const {
  getContentTypes,
  getContentType,
  createContentType,
  updateContentType,
  deleteContentType,
  setContentTypeStatus,
} = await import("@/lib/actions/content-types");

describe("content-types actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContentTypes", () => {
    it("queries content types for current org", async () => {
      mockQuery.contentTypes.findMany.mockResolvedValueOnce([]);
      const result = await getContentTypes();
      expect(result).toEqual([]);
    });
  });

  describe("getContentType", () => {
    it("finds content type by id", async () => {
      const ct = { id: "ct-1", name: "Blog Post" };
      mockQuery.contentTypes.findFirst.mockResolvedValueOnce(ct);
      const result = await getContentType("ct-1");
      expect(result).toEqual(ct);
    });
  });

  describe("createContentType", () => {
    it("creates with slug derived from name", async () => {
      const created = { id: "ct-new", name: "Blog Post", slug: "blog-post" };
      returningFn.mockResolvedValueOnce([created]);

      const result = await createContentType({ name: "Blog Post" });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe("updateContentType", () => {
    it("updates and regenerates slug if name changed", async () => {
      const updated = { id: "ct-1", name: "Article", slug: "article", organizationId: TEST_ORG_ID };
      returningFn.mockResolvedValueOnce([updated]);

      const result = await updateContentType("ct-1", { name: "Article" });
      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  describe("deleteContentType", () => {
    it("looks up the content type then deletes it", async () => {
      mockQuery.contentTypes.findFirst.mockResolvedValueOnce({
        id: "ct-1",
        organizationId: TEST_ORG_ID,
        slug: "blog-post",
      });
      await deleteContentType("ct-1");
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("setContentTypeStatus", () => {
    it("sets status and returns updated entry", async () => {
      const updated = { id: "ct-1", status: "active", organizationId: TEST_ORG_ID, slug: "blog" };
      returningFn.mockResolvedValueOnce([updated]);

      const result = await setContentTypeStatus("ct-1", "active");
      expect(result?.status).toBe("active");
    });
  });
});
