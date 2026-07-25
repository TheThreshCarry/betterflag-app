"use client";

/**
 * Hard billing wall, shown when the org has no active plan (trial expired
 * and never subscribed). The one honest promise stays visible: flags keep
 * serving from the edge, production is never held hostage.
 *
 * Picking a tier goes straight to Polar checkout; the webhook flips
 * subscription_status and the next /api/v1/orgs read lets AppShell through.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { Button, Chip, ErrorNote } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiOrg } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { usePricingTiers } from "@/lib/use-pricing";

export function BillingWall({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();
  const tiers = usePricingTiers();
  const [org, setOrg] = useState<ApiOrg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<{ orgs: ApiOrg[] }>("/api/v1/orgs")
      .then(({ orgs }) => {
        if (cancelled) return;
        const first = orgs[0] ?? null;
        if (!first) {
          router.replace("/onboarding");
          return;
        }
        // Already back in good standing (e.g. webhook landed): let them in.
        if (first.billingState !== "expired") {
          router.replace("/flags");
          return;
        }
        setOrg(first);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load billing");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function startCheckout(plan: string) {
    setError(null);
    setCheckingOut(plan);
    try {
      const { url } = await api<{ url: string }>("/api/v1/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setCheckingOut(null);
    }
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center justify-between px-8">
        <Logo href="/billing" size="sm" showText />
        {userEmail ? (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="max-w-[220px] truncate text-ink-muted">{userEmail}</span>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut()}
              className="font-medium text-ink underline underline-offset-2 disabled:opacity-50"
            >
              {signingOut ? "Logging out…" : "logout"}
            </button>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-[32px] border border-line bg-surface p-10">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[32px] font-semibold tracking-[-0.02em]">
              Your trial has ended.
            </h1>
            {org ? <Chip color="orange">no active plan</Chip> : null}
          </div>
          <p className="mt-2 text-[15px] text-ink-muted">
            Your flags are <strong className="text-ink">still serving from the edge</strong>;
            production is never held hostage over billing. But the dashboard and API are locked
            until you pick a plan{org ? <> for <strong className="text-ink">{org.name}</strong></> : null}.
          </p>

          {!tiers || !org ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-2xl border border-line bg-canvas p-5"
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-[15px] font-semibold">
                      <Skeleton className="inline-block h-[1em] w-16 align-middle" />
                    </p>
                  </div>
                  <p className="mt-1 font-mono text-[22px] font-semibold">
                    <Skeleton className="inline-block h-[1em] w-20 align-middle" />
                  </p>
                  <p className="mt-1 flex-1 text-[12px]">
                    <Skeleton className="inline-block h-[1em] w-28 align-middle" />
                  </p>
                  <Skeleton className="mt-4 h-8 w-full rounded-2xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {tiers.map((tier) => (
                <div
                  key={tier.key}
                  className="flex flex-col rounded-2xl border border-line bg-canvas p-5"
                  style={tier.popular ? { borderColor: "#FF5A1A" } : undefined}
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-[15px] font-semibold">{tier.name}</p>
                    {tier.popular ? (
                      <Chip color="orange" className="!px-2 !py-0.5 text-[11px]">
                        Popular
                      </Chip>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-[22px] font-semibold">
                    {tier.price}
                    <span className="text-[12px] font-normal text-ink-muted">{tier.period}</span>
                  </p>
                  <p className="mt-1 flex-1 text-[12px] text-ink-muted">
                    {(tier.includedEvaluations / 1_000_000).toLocaleString()}M evaluations / mo
                  </p>
                  <Button
                    size="sm"
                    variant={tier.key === org.plan || tier.popular ? "primary" : "secondary"}
                    className="mt-4 w-full"
                    loading={checkingOut === tier.key}
                    disabled={checkingOut !== null}
                    onClick={() => void startCheckout(tier.key)}
                  >
                    {checkingOut === tier.key
                      ? "Starting…"
                      : tier.key === org.plan
                        ? `Continue on ${tier.name}`
                        : `Choose ${tier.name}`}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-[12px] text-ink-muted">
            You&apos;ll be taken to Polar to complete payment. Everything you built (flags,
            targeting, keys, audit log) is exactly where you left it.
          </p>
          <ErrorNote message={error} />
        </div>
      </main>
    </div>
  );
}
