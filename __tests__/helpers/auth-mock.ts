import { vi } from "vitest";

export const TEST_ORG_ID = "test-org-id-000";
export const TEST_USER_ID = "test-user-id-000";

export function mockGetOrganizationId(orgId = TEST_ORG_ID) {
  vi.doMock("@/lib/actions/utils", () => ({
    getOrganizationId: vi.fn().mockResolvedValue(orgId),
    getSessionData: vi.fn().mockResolvedValue({
      organizationId: orgId,
      userId: TEST_USER_ID,
    }),
  }));
}

export function mockNextCache() {
  vi.doMock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    unstable_cache: vi.fn((fn: Function) => fn),
  }));
}

export function mockNextHeaders() {
  vi.doMock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue(new Headers()),
    cookies: vi.fn().mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
    }),
  }));
}
