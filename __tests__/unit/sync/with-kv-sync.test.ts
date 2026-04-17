import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { withKvSync } from "@/lib/sync/with-kv-sync"

const fetchMock = vi.fn()
const enqueueMock = vi.fn()

vi.mock("@/lib/sync/kv-sync", () => ({
  enqueueKvRetry: (...args: unknown[]) => enqueueMock(...args),
}))

describe("withKvSync", () => {
  beforeEach(() => {
    process.env.WORKER_API_URL = "http://worker.local"
    process.env.SERVICE_SECRET = "test-secret"
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
    enqueueMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("invokes the action, then writes each KV op", async () => {
    fetchMock.mockResolvedValue({ ok: true })
    const action = vi.fn(async (n: number) => ({ n, id: "abc" }))

    const wrapped = withKvSync(action, {
      sync: (r) => [
        { operation: "put", key: `tenant_${r.id}_flags`, payload: { n: r.n } },
      ],
    })

    const result = await wrapped(42)

    expect(result).toEqual({ n: 42, id: "abc" })
    expect(action).toHaveBeenCalledWith(42)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://worker.local/internal/kv/tenant_abc_flags")
    expect((init as RequestInit).method).toBe("PUT")
    expect((init as { headers: Record<string, string> }).headers["x-service-secret"]).toBe(
      "test-secret",
    )
  })

  it("enqueues retry on non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, text: async () => "boom" })
    const wrapped = withKvSync(
      async () => ({ id: "z" }),
      {
        sync: (r) => [{ operation: "put", key: `tenant_${r.id}_flags`, payload: {} }],
      },
    )

    await wrapped()

    expect(enqueueMock).toHaveBeenCalledOnce()
    expect(enqueueMock.mock.calls[0]![0]).toMatchObject({
      operation: "put",
      key: "tenant_z_flags",
    })
  })

  it("enqueues retry when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("net down"))
    const wrapped = withKvSync(
      async () => ({ id: "e" }),
      {
        sync: () => [{ operation: "delete", key: "tenant_e_flags" }],
      },
    )

    await wrapped()

    expect(enqueueMock).toHaveBeenCalledOnce()
    expect(enqueueMock.mock.calls[0]![0]).toMatchObject({
      operation: "delete",
      key: "tenant_e_flags",
    })
  })

  it("returns the action's result even if sync resolver throws", async () => {
    fetchMock.mockResolvedValue({ ok: true })
    const wrapped = withKvSync(
      async () => ({ id: "ok" }),
      {
        sync: () => {
          throw new Error("resolver boom")
        },
      },
    )

    const res = await wrapped()
    expect(res).toEqual({ id: "ok" })
  })
})
