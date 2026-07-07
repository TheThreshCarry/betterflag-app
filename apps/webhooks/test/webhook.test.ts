import { describe, expect, it } from "vitest";

import {
  computeBillingPatch,
  computeStandardWebhookSignature,
  normalizeSubscriptionEvent,
  processPolarWebhook,
  verifyPolarSignature,
  webhookEventSchema,
  type BillingStore,
  type NormalizedSubscription,
  type OrgBillingPatch,
  type OrgBillingRow,
} from "../src/index";

const SECRET = "whsec_test_846d7a48c8484eb59f45531606489940";
const NOW = new Date("2026-07-07T12:00:00.000Z");
const NOW_TS = String(Math.floor(NOW.getTime() / 1000));

async function signHeaders(
  rawBody: string,
  opts?: { secret?: string; id?: string; ts?: string },
): Promise<Record<string, string>> {
  const id = opts?.id ?? "msg_abc";
  const ts = opts?.ts ?? NOW_TS;
  const sig = await computeStandardWebhookSignature(opts?.secret ?? SECRET, id, ts, rawBody);
  return {
    "webhook-id": id,
    "webhook-timestamp": ts,
    "webhook-signature": `v1,${sig}`,
  };
}

function subscriptionEvent(over?: {
  type?: string;
  status?: string;
  planKey?: string | null;
  timestamp?: string;
  orgId?: string | null;
  externalId?: string;
  omitProductMeta?: boolean;
  customerId?: string;
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (over?.orgId !== null) metadata.org_id = over?.orgId ?? "org_1";
  if (over?.planKey !== undefined && over?.omitProductMeta) {
    if (over.planKey !== null) metadata.plan_key = over.planKey;
  }
  return {
    type: over?.type ?? "subscription.updated",
    timestamp: over?.timestamp ?? "2026-07-07T11:59:30.000Z",
    data: {
      id: "sub_1",
      status: over?.status ?? "active",
      customer_id: over?.customerId ?? "cust_1",
      metadata,
      ...(over?.omitProductMeta
        ? {}
        : { product: { metadata: { plan_key: over?.planKey ?? "launch" } } }),
      ...(over?.externalId ? { customer: { id: "cust_1", external_id: over.externalId } } : {}),
    },
  };
}

const baseOrg: OrgBillingRow = {
  id: "org_1",
  plan: "launch",
  polar_customer_id: null,
  past_due_since: null,
  billing_synced_at: null,
};

function fakeStore(org: OrgBillingRow | null) {
  const updates: { id: string; patch: OrgBillingPatch }[] = [];
  const store: BillingStore = {
    async findOrg() {
      return org;
    },
    async updateOrg(id, patch) {
      updates.push({ id, patch });
    },
  };
  return { store, updates };
}

// ---------------------------------------------------------------------------
describe("verifyPolarSignature", () => {
  it("accepts a correctly signed payload", async () => {
    const body = JSON.stringify({ hello: "world" });
    const headers = await signHeaders(body);
    expect(await verifyPolarSignature(body, headers, SECRET, { now: NOW })).toEqual({ ok: true });
  });

  it("rejects a tampered body", async () => {
    const headers = await signHeaders(JSON.stringify({ hello: "world" }));
    const res = await verifyPolarSignature(JSON.stringify({ hello: "evil" }), headers, SECRET, {
      now: NOW,
    });
    expect(res).toEqual({ ok: false, reason: "no matching signature" });
  });

  it("rejects the wrong secret", async () => {
    const body = JSON.stringify({ a: 1 });
    const headers = await signHeaders(body);
    const res = await verifyPolarSignature(body, headers, "whsec_other", { now: NOW });
    expect(res.ok).toBe(false);
  });

  it("rejects missing headers", async () => {
    const res = await verifyPolarSignature("{}", {}, SECRET, { now: NOW });
    expect(res).toEqual({ ok: false, reason: "missing signature headers" });
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const body = JSON.stringify({ a: 1 });
    const staleTs = String(Math.floor(NOW.getTime() / 1000) - 3600);
    const headers = await signHeaders(body, { ts: staleTs });
    const res = await verifyPolarSignature(body, headers, SECRET, { now: NOW });
    expect(res).toEqual({ ok: false, reason: "timestamp outside tolerance" });
  });

  it("accepts when one of several signatures matches", async () => {
    const body = JSON.stringify({ a: 1 });
    const good = (await signHeaders(body))["webhook-signature"];
    const headers = {
      "webhook-id": "msg_abc",
      "webhook-timestamp": NOW_TS,
      "webhook-signature": `v1,AAAAinvalid ${good}`,
    };
    expect(await verifyPolarSignature(body, headers, SECRET, { now: NOW })).toEqual({ ok: true });
  });

  it("supports svix-* header names", async () => {
    const body = JSON.stringify({ a: 1 });
    const sig = await computeStandardWebhookSignature(SECRET, "msg_abc", NOW_TS, body);
    const headers = {
      "svix-id": "msg_abc",
      "svix-timestamp": NOW_TS,
      "svix-signature": `v1,${sig}`,
    };
    expect(await verifyPolarSignature(body, headers, SECRET, { now: NOW })).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
describe("normalizeSubscriptionEvent", () => {
  it("normalizes a subscription.updated with product metadata plan", () => {
    const event = webhookEventSchema.parse(subscriptionEvent({ status: "active" }));
    const norm = normalizeSubscriptionEvent(event);
    expect(norm).toMatchObject({
      subId: "sub_1",
      status: "active",
      customerId: "cust_1",
      orgId: "org_1",
      planKey: "launch",
      occurredAt: "2026-07-07T11:59:30.000Z",
    });
  });

  it("ignores non-subscription events", () => {
    const event = webhookEventSchema.parse({ type: "order.paid", data: { id: "ord_1" } });
    expect(normalizeSubscriptionEvent(event)).toBeNull();
  });

  it("returns null for malformed subscription data", () => {
    const event = webhookEventSchema.parse({ type: "subscription.updated", data: { foo: 1 } });
    expect(normalizeSubscriptionEvent(event)).toBeNull();
  });

  it("falls back to subscription metadata plan_key", () => {
    const event = webhookEventSchema.parse(
      subscriptionEvent({ planKey: "scale", omitProductMeta: true }),
    );
    expect(normalizeSubscriptionEvent(event)?.planKey).toBe("scale");
  });

  it("drops an unknown plan_key", () => {
    const event = webhookEventSchema.parse(subscriptionEvent({ planKey: "enterprise" }));
    expect(normalizeSubscriptionEvent(event)?.planKey).toBeUndefined();
  });

  it("resolves org from customer external_id when metadata has none", () => {
    const event = webhookEventSchema.parse(
      subscriptionEvent({ orgId: null, externalId: "org_from_customer" }),
    );
    expect(normalizeSubscriptionEvent(event)?.orgId).toBe("org_from_customer");
  });
});

// ---------------------------------------------------------------------------
describe("computeBillingPatch", () => {
  const nowIso = NOW.toISOString();

  it("records an active subscription and clears past_due_since", () => {
    const norm: NormalizedSubscription = {
      subId: "sub_1",
      status: "active",
      customerId: "cust_1",
      planKey: "launch",
      occurredAt: "2026-07-07T10:00:00.000Z",
    };
    const res = computeBillingPatch(norm, { ...baseOrg, past_due_since: "2026-07-01T00:00:00Z" }, nowIso);
    expect("patch" in res && res.patch).toMatchObject({
      subscription_status: "active",
      plan: "launch",
      past_due_since: null,
      billing_synced_at: "2026-07-07T10:00:00.000Z",
      polar_subscription_id: "sub_1",
      polar_customer_id: "cust_1",
    });
  });

  it("stamps past_due_since on the first past_due", () => {
    const norm: NormalizedSubscription = {
      subId: "sub_1",
      status: "past_due",
      occurredAt: "2026-07-07T09:00:00.000Z",
    };
    const res = computeBillingPatch(norm, baseOrg, nowIso);
    expect("patch" in res && res.patch.past_due_since).toBe("2026-07-07T09:00:00.000Z");
  });

  it("keeps the earliest past_due_since on subsequent past_due events", () => {
    const norm: NormalizedSubscription = {
      subId: "sub_1",
      status: "past_due",
      occurredAt: "2026-07-07T09:00:00.000Z",
    };
    const res = computeBillingPatch(
      norm,
      { ...baseOrg, past_due_since: "2026-07-05T00:00:00.000Z", billing_synced_at: "2026-07-05T00:00:00.000Z" },
      nowIso,
    );
    expect("patch" in res && res.patch.past_due_since).toBe("2026-07-05T00:00:00.000Z");
  });

  it("keeps the last plan on cancellation (no plan in patch)", () => {
    const norm: NormalizedSubscription = { subId: "sub_1", status: "canceled", occurredAt: nowIso };
    const res = computeBillingPatch(norm, baseOrg, nowIso);
    expect("patch" in res && res.patch).toMatchObject({ subscription_status: "canceled" });
    expect("patch" in res && "plan" in res.patch).toBe(false);
  });

  it("skips stale (out-of-order) events", () => {
    const norm: NormalizedSubscription = {
      subId: "sub_1",
      status: "active",
      occurredAt: "2026-07-01T00:00:00.000Z",
    };
    const res = computeBillingPatch(
      norm,
      { ...baseOrg, billing_synced_at: "2026-07-06T00:00:00.000Z" },
      nowIso,
    );
    expect(res).toEqual({ skip: "stale-event" });
  });

  it("retains the stored polar_customer_id when the event omits it", () => {
    const norm: NormalizedSubscription = { subId: "sub_1", status: "active", occurredAt: nowIso };
    const res = computeBillingPatch(norm, { ...baseOrg, polar_customer_id: "cust_saved" }, nowIso);
    expect("patch" in res && res.patch.polar_customer_id).toBe("cust_saved");
  });

  it("defaults occurredAt to now when the event has no timestamp", () => {
    const norm: NormalizedSubscription = { subId: "sub_1", status: "active" };
    const res = computeBillingPatch(norm, baseOrg, nowIso);
    expect("patch" in res && res.patch.billing_synced_at).toBe(nowIso);
  });
});

// ---------------------------------------------------------------------------
describe("processPolarWebhook (end to end)", () => {
  it("verifies, maps and persists a past_due event", async () => {
    const rawBody = JSON.stringify(
      subscriptionEvent({ status: "past_due", timestamp: "2026-07-07T11:59:30.000Z" }),
    );
    const headers = await signHeaders(rawBody);
    const { store, updates } = fakeStore(baseOrg);

    const res = await processPolarWebhook({ rawBody, headers, secret: SECRET, store, now: NOW });
    expect(res).toEqual({ status: 200, body: "ok" });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.patch).toMatchObject({
      subscription_status: "past_due",
      past_due_since: "2026-07-07T11:59:30.000Z",
      plan: "launch",
    });
  });

  it("rejects a bad signature with 401 and never touches the store", async () => {
    const rawBody = JSON.stringify(subscriptionEvent());
    const headers = await signHeaders(rawBody, { secret: "whsec_wrong" });
    const { store, updates } = fakeStore(baseOrg);
    const res = await processPolarWebhook({ rawBody, headers, secret: SECRET, store, now: NOW });
    expect(res.status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it("ignores non-subscription events with 200", async () => {
    const rawBody = JSON.stringify({ type: "order.paid", data: { id: "ord_1" } });
    const headers = await signHeaders(rawBody);
    const { store, updates } = fakeStore(baseOrg);
    const res = await processPolarWebhook({ rawBody, headers, secret: SECRET, store, now: NOW });
    expect(res.status).toBe(200);
    expect(res.body).toContain("ignored");
    expect(updates).toHaveLength(0);
  });

  it("returns 400 for invalid JSON (but valid signature)", async () => {
    const rawBody = "{ not json";
    const headers = await signHeaders(rawBody);
    const { store } = fakeStore(baseOrg);
    const res = await processPolarWebhook({ rawBody, headers, secret: SECRET, store, now: NOW });
    expect(res.status).toBe(400);
  });

  it("returns 202 when the org cannot be found", async () => {
    const rawBody = JSON.stringify(subscriptionEvent());
    const headers = await signHeaders(rawBody);
    const { store, updates } = fakeStore(null);
    const res = await processPolarWebhook({ rawBody, headers, secret: SECRET, store, now: NOW });
    expect(res.status).toBe(202);
    expect(updates).toHaveLength(0);
  });

  it("returns 202 when the event carries no org reference", async () => {
    const rawBody = JSON.stringify(
      subscriptionEvent({ orgId: null, customerId: undefined }),
    );
    // Remove customer_id entirely for this case.
    const parsed = JSON.parse(rawBody);
    delete parsed.data.customer_id;
    const body2 = JSON.stringify(parsed);
    const headers = await signHeaders(body2);
    const { store } = fakeStore(baseOrg);
    const res = await processPolarWebhook({ rawBody: body2, headers, secret: SECRET, store, now: NOW });
    expect(res.status).toBe(202);
  });

  it("skips stale events without updating the store", async () => {
    const rawBody = JSON.stringify(
      subscriptionEvent({ status: "active", timestamp: "2026-07-01T00:00:00.000Z" }),
    );
    const headers = await signHeaders(rawBody);
    const { store, updates } = fakeStore({ ...baseOrg, billing_synced_at: "2026-07-06T00:00:00.000Z" });
    const res = await processPolarWebhook({ rawBody, headers, secret: SECRET, store, now: NOW });
    expect(res).toEqual({ status: 200, body: "stale-event" });
    expect(updates).toHaveLength(0);
  });
});
