import { describe, expect, it } from "vitest";
import {
  POLAR_METER_CRON,
  commitWatermark,
  ingestPolarDelta,
  meterKvKey,
  nextWatermark,
  parseWatermark,
  polarApiBase,
  polarEventExternalId,
  sdkKeyEntryForMeter,
  utcHour,
  utcMonth,
} from "../src/meter";

describe("polar meter watermark", () => {
  const month = "2026-08";
  const hour = "2026-08-20T10";

  it("starts at zero when KV is empty or from another month", () => {
    expect(parseWatermark(null, month)).toEqual({
      month,
      reported: 0,
      pendingHour: null,
      pendingReported: null,
    });
    expect(parseWatermark({ month: "2026-07", reported: 9, pendingHour: null, pendingReported: null }, month)).toEqual({
      month,
      reported: 0,
      pendingHour: null,
      pendingReported: null,
    });
  });

  it("emits the month-to-date delta and parks it as pending before Polar", () => {
    const step = nextWatermark({
      month,
      hour,
      used: 1_500,
      current: { month, reported: 1_000, pendingHour: null, pendingReported: null },
    });
    expect(step.delta).toBe(500);
    expect(step.ingestHour).toBe(hour);
    expect(step.watermark).toEqual({
      month,
      reported: 1_000,
      pendingHour: hour,
      pendingReported: 1_500,
    });
    expect(commitWatermark(step.watermark)).toEqual({
      month,
      reported: 1_500,
      pendingHour: null,
      pendingReported: null,
    });
  });

  it("retries the pending hour with the same external_id after Polar success + KV fail", () => {
    const pending = {
      month,
      reported: 1_000,
      pendingHour: "2026-08-20T09",
      pendingReported: 1_400,
    };
    const step = nextWatermark({ month, hour, used: 2_000, current: pending });
    expect(step.delta).toBe(400);
    expect(step.ingestHour).toBe("2026-08-20T09");
    expect(step.watermark).toEqual(pending);
    expect(polarEventExternalId("org-1", step.ingestHour)).toBe("eval:org-1:2026-08-20T09");
  });

  it("emits nothing when usage has not moved", () => {
    const step = nextWatermark({
      month,
      hour,
      used: 1_000,
      current: { month, reported: 1_000, pendingHour: null, pendingReported: null },
    });
    expect(step.delta).toBe(0);
    expect(step.watermark.pendingHour).toBeNull();
  });
});

describe("polar meter helpers", () => {
  it("pins the hourly cron and KV key prefix", () => {
    expect(POLAR_METER_CRON).toBe("0 * * * *");
    expect(meterKvKey("org-1")).toBe("meter:polar:org-1");
    expect(polarApiBase("sandbox")).toBe("https://sandbox-api.polar.sh");
    expect(polarApiBase("production")).toBe("https://api.polar.sh");
    expect(polarApiBase(undefined)).toBe("https://api.polar.sh");
  });

  it("formats UTC month/hour from the scheduled time", () => {
    const now = new Date("2026-08-20T10:00:00.000Z");
    expect(utcMonth(now)).toBe("2026-08");
    expect(utcHour(now)).toBe("2026-08-20T10");
  });

  it("stamps Starter quota and leaves Launch unthrottled", () => {
    const starter = sdkKeyEntryForMeter({
      orgId: "o",
      projectId: "p",
      envSlug: "prod",
      hash: "abc",
      revoked: false,
      plan: "starter",
      used: 1_000_000,
    });
    expect(starter.quota).toBe(3_000_000);
    expect(starter.used).toBe(1_000_000);
    expect(starter.plan).toBe("starter");

    const launch = sdkKeyEntryForMeter({
      orgId: "o",
      projectId: "p",
      envSlug: "prod",
      hash: "abc",
      revoked: false,
      plan: "launch",
      used: 9_000_000,
    });
    expect(launch.quota).toBeNull();
  });
});

describe("ingestPolarDelta", () => {
  it("POSTs a summable evaluation event with the hour-scoped external_id", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response("{}", { status: 200 });
    };
    await ingestPolarDelta(
      { POLAR_ACCESS_TOKEN: "tok", POLAR_SERVER: "sandbox" },
      { customerId: "cus_1", orgId: "org-1", hour: "2026-08-20T10", delta: 42 },
      fetchFn,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://sandbox-api.polar.sh/v1/events/ingest");
    expect(calls[0]!.body).toEqual({
      events: [
        {
          name: "evaluation",
          external_id: "eval:org-1:2026-08-20T10",
          customer_id: "cus_1",
          metadata: { evaluations: 42 },
        },
      ],
    });
  });

  it("no-ops when the token is missing or the delta is 0", async () => {
    let called = 0;
    const fetchFn: typeof fetch = async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    };
    await ingestPolarDelta({ POLAR_SERVER: "production" }, { customerId: "c", orgId: "o", hour: "h", delta: 10 }, fetchFn);
    await ingestPolarDelta(
      { POLAR_ACCESS_TOKEN: "tok" },
      { customerId: "c", orgId: "o", hour: "h", delta: 0 },
      fetchFn,
    );
    expect(called).toBe(0);
  });
});
