import { vi } from "vitest";

export function createMockDb() {
  const mockQuery = {
    featureFlags: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    changelogs: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    changelogLabelAssignments: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    contentTypes: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    entries: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };

  const returningFn = vi.fn().mockResolvedValue([{}]);

  const chainable = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: returningFn,
  };

  const mockDb = {
    query: mockQuery,
    insert: vi.fn().mockReturnValue(chainable),
    update: vi.fn().mockReturnValue(chainable),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnValue(chainable),
  };

  return { mockDb, mockQuery, chainable, returningFn };
}
