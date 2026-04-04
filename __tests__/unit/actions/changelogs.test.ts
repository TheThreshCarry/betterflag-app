import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb } from "../../helpers/db-mock";
import {
  TEST_ORG_ID,
  TEST_USER_ID,
  mockGetOrganizationId,
  mockNextCache,
  mockNextHeaders,
} from "../../helpers/auth-mock";

const { mockDb, mockQuery, chainable, returningFn } = createMockDb();

vi.mock("@/lib/db", () => ({ default: mockDb }));

mockGetOrganizationId();
mockNextCache();
mockNextHeaders();

const {
  getChangelogs,
  getChangelog,
  createChangelog,
  updateChangelog,
  publishChangelog,
  unpublishChangelog,
  deleteChangelog,
} = await import("@/lib/actions/changelogs");

describe("changelogs actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getChangelogs", () => {
    it("queries changelogs for current org", async () => {
      mockQuery.changelogs.findMany.mockResolvedValueOnce([]);
      const result = await getChangelogs();
      expect(mockQuery.changelogs.findMany).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("getChangelog", () => {
    it("finds a single changelog by id", async () => {
      const cl = { id: "cl-1", title: "v1.0" };
      mockQuery.changelogs.findFirst.mockResolvedValueOnce(cl);
      const result = await getChangelog("cl-1");
      expect(result).toEqual(cl);
    });
  });

  describe("createChangelog", () => {
    it("slugifies title and inserts", async () => {
      const created = {
        id: "cl-new",
        title: "My First Release",
        slug: "my-first-release",
        organizationId: TEST_ORG_ID,
        authorId: TEST_USER_ID,
      };
      returningFn.mockResolvedValueOnce([created]);

      const result = await createChangelog({ title: "My First Release" });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe("updateChangelog", () => {
    it("updates with new title and regenerates slug", async () => {
      const updated = { id: "cl-1", title: "Updated Title", slug: "updated-title" };
      returningFn.mockResolvedValueOnce([updated]);

      const result = await updateChangelog("cl-1", { title: "Updated Title" });
      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  describe("publishChangelog", () => {
    it("sets status to published and sets publishedAt", async () => {
      const published = { id: "cl-1", status: "published" };
      returningFn.mockResolvedValueOnce([published]);

      const result = await publishChangelog("cl-1");
      expect(result?.status).toBe("published");
    });
  });

  describe("unpublishChangelog", () => {
    it("sets status back to draft and clears publishedAt", async () => {
      const draft = { id: "cl-1", status: "draft", publishedAt: null };
      returningFn.mockResolvedValueOnce([draft]);

      const result = await unpublishChangelog("cl-1");
      expect(result?.status).toBe("draft");
    });
  });

  describe("deleteChangelog", () => {
    it("deletes label assignments then the changelog", async () => {
      mockQuery.changelogs.findFirst.mockResolvedValueOnce({
        id: "cl-1",
        organizationId: TEST_ORG_ID,
      });
      await deleteChangelog("cl-1");
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });
  });
});
