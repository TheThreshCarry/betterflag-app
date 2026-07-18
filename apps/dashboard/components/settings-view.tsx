"use client";

import { ANALYTICS_HOT_DAYS, ANALYTICS_RETENTION_DAYS, PLAN_LIMITS } from "@shipos/db";
import { useCallback, useEffect, useState } from "react";

import { Button, Card, Chip, ErrorNote, inputClass, type ChipColor } from "@/components/ui";
import { SettingsSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiOrg } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { tierForPlan, usePricingTiers } from "@/lib/use-pricing";

const ROLE_COLORS: Record<string, ChipColor> = {
  owner: "orange",
  admin: "blue",
  member: "gray",
};

export function SettingsView() {
  const [org, setOrg] = useState<ApiOrg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const loadOrg = useCallback(() => {
    void api<{ orgs: ApiOrg[] }>("/api/v1/orgs?members=1")
      .then(({ orgs }) => setOrg(orgs[0] ?? null))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load settings"),
      );
  }, []);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

  // Returning from Polar checkout: the plan updates via webhook (async), so
  // re-fetch shortly after so this page reflects the new plan.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setCheckoutSuccess(true);
      const timer = setTimeout(loadOrg, 4000);
      return () => clearTimeout(timer);
    }
  }, [loadOrg]);

  if (error) return <ErrorNote message={error} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Settings</h1>
        <p className="mt-0.5 text-[14px] text-ink-muted">Organization, plan and members.</p>
      </div>

      {checkoutSuccess ? (
        <div
          className="mb-6 rounded-2xl border px-5 py-4"
          style={{ borderColor: "#00BC72", backgroundColor: "rgba(0,188,114,0.06)" }}
        >
          <p className="text-[14px] font-semibold text-ink">Payment received</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Thanks! Your plan will update here in a few seconds.
          </p>
        </div>
      ) : null}

      {org?.restricted ? (
        <div
          className="mb-6 rounded-2xl border px-5 py-4"
          style={{ borderColor: "#FF5A1A", backgroundColor: "rgba(255,90,26,0.06)" }}
        >
          <p className="text-[14px] font-semibold text-ink">Account is read-only</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {org.billingMessage} Your flags keep serving, update payment to make changes again.
          </p>
        </div>
      ) : null}

      {!org ? (
        <SettingsSkeleton />
      ) : (
        <div className="data-in">
          <SettingsContent org={org} />
        </div>
      )}
    </div>
  );
}

function SettingsContent({ org }: { org: ApiOrg }) {
  // Plan limits + price come from Polar (the single source of truth) via
  // /api/pricing; fall back to the PLAN_LIMITS enforcement mirror while loading.
  const tiers = usePricingTiers();
  const tier = tierForPlan(tiers, org.plan);
  const limits = tier
    ? {
        projects: tier.projects,
        agentKeys: tier.agentKeys,
        includedEvalsPerMonth: tier.includedEvaluations,
      }
    : PLAN_LIMITS[org.plan];

  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function startCheckout(plan: string) {
    setCheckoutError(null);
    setCheckingOut(plan);
    try {
      const { url } = await api<{ url: string }>("/api/v1/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Could not start checkout");
      setCheckingOut(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-[16px] font-semibold">Organization</h2>
        <div className="mt-4 max-w-sm">
          <label className="mb-1.5 block text-[13px] font-medium">Name</label>
          <input className={inputClass} value={org.name} readOnly disabled />
          <p className="mt-1.5 text-[12px] text-ink-muted">
            Renaming and member management are coming soon.
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[16px] font-semibold">Plan</h2>
            {tier ? (
              <span className="text-[13px] text-ink-muted">
                {tier.name} · {tier.price}
                {tier.period}
              </span>
            ) : null}
          </div>
          <Chip color={org.billingState === "trialing" ? "orange" : "green"}>
            {org.plan}
            {org.billingState === "trialing" ? " (trial)" : ""}
          </Chip>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="font-mono text-[22px] font-semibold">
              {limits.projects === null ? "∞" : limits.projects}
            </p>
            <p className="text-[13px] text-ink-muted">projects</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="font-mono text-[22px] font-semibold">
              {limits.agentKeys === null ? "∞" : limits.agentKeys}
            </p>
            <p className="text-[13px] text-ink-muted">agent keys</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="font-mono text-[22px] font-semibold">
              {(limits.includedEvalsPerMonth / 1_000_000).toLocaleString()}M
            </p>
            <p className="text-[13px] text-ink-muted">evaluations / month</p>
          </div>
        </div>
        {org.billingState === "trialing" ? (
          <p className="mt-4 text-[13px] text-ink-muted">
            Trial ends{" "}
            <span className="font-medium text-ink">
              {new Date(org.trialEndsAt).toLocaleDateString()}
            </span>
            . Add payment below to keep the dashboard unlocked, your flags keep serving either
            way.
          </p>
        ) : null}
      </Card>

      {tiers === null || tiers.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">Change plan</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Pick a plan, you&apos;ll be taken to Polar to complete payment. 14-day free
            trial, no card up front.
          </p>
          {checkoutError ? (
            <p className="mt-3 text-[13px]" style={{ color: "#E5484D" }}>
              {checkoutError}
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {tiers === null
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col rounded-2xl border border-line bg-white p-4"
                  >
                    <div className="flex items-baseline justify-between">
                      <p className="text-[15px] font-semibold">
                        <Skeleton className="inline-block h-[1em] w-16 align-middle" />
                      </p>
                    </div>
                    <p className="mt-1 font-mono text-[20px] font-semibold">
                      <Skeleton className="inline-block h-[1em] w-20 align-middle" />
                    </p>
                    <p className="mt-1 text-[12px]">
                      <Skeleton className="inline-block h-[1em] w-28 align-middle" />
                    </p>
                    <Skeleton className="mt-4 h-8 w-full rounded-2xl" />
                  </div>
                ))
              : tiers.map((t) => {
              const isCurrent = t.key === org.plan;
              return (
                <div
                  key={t.key}
                  className="flex flex-col rounded-2xl border border-line bg-white p-4"
                  style={t.popular ? { borderColor: "#FF5A1A" } : undefined}
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-[15px] font-semibold">{t.name}</p>
                    {t.popular ? (
                      <Chip color="orange" className="!px-2 !py-0.5 text-[11px]">
                        Popular
                      </Chip>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-[20px] font-semibold">
                    {t.price}
                    <span className="text-[12px] font-normal text-ink-muted">{t.period}</span>
                  </p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    {(t.includedEvaluations / 1_000_000).toLocaleString()}M evaluations / mo
                  </p>
                  <Button
                    variant={isCurrent ? "secondary" : "primary"}
                    size="sm"
                    className="mt-4 w-full"
                    loading={checkingOut === t.key}
                    disabled={isCurrent || checkingOut !== null}
                    onClick={() => startCheckout(t.key)}
                  >
                    {isCurrent
                      ? "Current plan"
                      : checkingOut === t.key
                        ? "Starting…"
                        : org.plan === "trial"
                          ? `Choose ${t.name}`
                          : `Switch to ${t.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="text-[16px] font-semibold">Analytics data retention</h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          Evaluation analytics stay in fast storage for {ANALYTICS_HOT_DAYS} days, then move to
          cold storage until your plan&apos;s retention window ends, after which they&apos;re
          deleted. Aggregated charts and the billing meter are unaffected.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="font-mono text-[22px] font-semibold">{ANALYTICS_HOT_DAYS} days</p>
            <p className="text-[13px] text-ink-muted">hot storage (all plans)</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="font-mono text-[22px] font-semibold">
              {ANALYTICS_RETENTION_DAYS[org.plan]} days
            </p>
            <p className="text-[13px] text-ink-muted">total retention on your plan</p>
          </div>
        </div>
        {org.plan !== "scale" ? (
          <p className="mt-3 text-[12px] text-ink-muted">
            Need longer retention? The Scale plan keeps analytics for{" "}
            {ANALYTICS_RETENTION_DAYS.scale} days.
          </p>
        ) : null}
      </Card>

      <Card className="p-6">
        <h2 className="text-[16px] font-semibold">Members</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          {(org.members ?? []).map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
            >
              <div>
                <p className="text-[14px] font-medium">
                  {member.email ?? `${member.userId.slice(0, 8)}…`}
                </p>
                <p className="text-[12px] text-ink-muted">
                  joined {new Date(member.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Chip color={ROLE_COLORS[member.role] ?? "gray"} className="!px-2.5 !py-0.5 text-[12px]">
                {member.role}
              </Chip>
            </div>
          ))}
          {(org.members ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-muted">
              Member list unavailable.
            </p>
          ) : null}
        </div>
        <p className="mt-3 text-[12px] text-ink-muted">
          Invites are read-only for now, ask us to add teammates during the alpha.
        </p>
      </Card>
    </div>
  );
}
