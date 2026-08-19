import { describe, expect, it } from "vitest";
import { summarizeTailItem } from "../src/sanitize";

describe("summarizeTailItem", () => {
  it("emits a sanitized fetch summary with templated route and duration", () => {
    const summary = summarizeTailItem({
      scriptName: "betterflag-api",
      outcome: "ok",
      wallTime: 12.5,
      event: {
        request: {
          url: "https://api.betterflag.app/v1/evaluate?user=secret",
          method: "POST",
          cf: { colo: "LHR" },
        },
        response: { status: 200 },
      },
      logs: [
        {
          message: [
            JSON.stringify({
              duration_ms: 4.2,
              status: 200,
              authorization: "Bearer tok",
              email: "a@b.com",
            }),
          ],
        },
      ],
      exceptions: [],
    });

    expect(summary).toMatchObject({
      "service.name": "betterflag-tail",
      "event.name": "workers.invocation",
      "event.outcome": "ok",
      script: "betterflag-api",
      event_type: "fetch",
      route: "/v1/evaluate",
      method: "POST",
      status: 200,
      duration_ms: 12.5,
      colo: "LHR",
      exception_count: 0,
      outcome: "ok",
    });
    expect(JSON.stringify(summary)).not.toMatch(/Bearer|@b\.com|user=secret|authorization/i);
  });

  it("marks exceptions and 5xx as errors", () => {
    const summary = summarizeTailItem({
      scriptName: "betterflag-ingest",
      outcome: "exception",
      event: { queue: "betterflag-events-dlq" },
      exceptions: [{ name: "Error", message: "boom bf_sdk_abc" }],
    });
    expect(summary["event.outcome"]).toBe("error");
    expect(summary.event_type).toBe("queue");
    expect(summary.route).toBe("betterflag-events-dlq");
    expect(summary.exception_count).toBe(1);
    expect(JSON.stringify(summary)).not.toContain("bf_sdk_");
  });

  it("does not copy console payloads or headers onto the summary", () => {
    const summary = summarizeTailItem({
      scriptName: "betterflag-webhooks",
      outcome: "ok",
      event: {
        request: {
          url: "https://payment.betterflag.app/webhook",
          method: "POST",
        },
      },
      logs: [{ message: ["secret payload webhook-signature=abc"] }],
    });
    expect(summary).not.toHaveProperty("logs");
    expect(summary).not.toHaveProperty("headers");
    expect(JSON.stringify(summary)).not.toContain("webhook-signature");
    expect(JSON.stringify(summary)).not.toContain("secret payload");
  });
});
