import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("logger transport configuration", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("uses pino-pretty transport in development", async () => {
    process.env.NODE_ENV = "development"
    const pinoMock = vi.fn(() => ({
      child: vi.fn(() => ({})),
    }))
    pinoMock.transport = vi.fn(() => "mock-transport")

    vi.doMock("pino", () => ({ default: pinoMock }))

    await import("@/lib/logger")

    expect(pinoMock.transport).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "pino-pretty",
      }),
    )
  })

  it("includes @logtail/pino target in production when token is set", async () => {
    process.env.NODE_ENV = "production"
    process.env.BETTER_STACK_SOURCE_TOKEN = "test-token"
    process.env.BETTER_STACK_LOGS_ENDPOINT = "https://logs.example.com"

    const pinoMock = vi.fn(() => ({
      child: vi.fn(() => ({})),
    }))
    pinoMock.transport = vi.fn(() => "mock-transport")

    vi.doMock("pino", () => ({ default: pinoMock }))

    await import("@/lib/logger")

    expect(pinoMock.transport).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: expect.arrayContaining([
          expect.objectContaining({ target: "pino/file" }),
          expect.objectContaining({
            target: "@logtail/pino",
            options: expect.objectContaining({
              sourceToken: "test-token",
            }),
          }),
        ]),
      }),
    )
  })

  it("omits @logtail/pino target in production when token is not set", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.BETTER_STACK_SOURCE_TOKEN

    const pinoMock = vi.fn(() => ({
      child: vi.fn(() => ({})),
    }))
    pinoMock.transport = vi.fn(() => "mock-transport")

    vi.doMock("pino", () => ({ default: pinoMock }))

    await import("@/lib/logger")

    const transportCall = pinoMock.transport.mock.calls[0][0]
    expect(transportCall.targets).toHaveLength(1)
    expect(transportCall.targets[0].target).toBe("pino/file")
  })

  it("exports createLogger that returns a child logger", async () => {
    process.env.NODE_ENV = "development"
    const childMock = vi.fn(() => ({ info: vi.fn() }))
    const pinoMock = vi.fn(() => ({
      child: childMock,
    }))
    pinoMock.transport = vi.fn(() => "mock-transport")

    vi.doMock("pino", () => ({ default: pinoMock }))

    const { createLogger } = await import("@/lib/logger")
    createLogger("test-service")

    expect(childMock).toHaveBeenCalledWith({ service: "test-service" })
  })
})
