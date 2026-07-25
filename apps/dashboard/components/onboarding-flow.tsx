"use client";

/**
 * Onboarding: org → pick plan → project, followed by a "first flag in
 * 5 minutes" checklist. Time-to-first-flag is THE activation metric: the
 * clock starts at org creation and stops when the first flag exists.
 *
 * The plan step starts the 14-day trial on the chosen tier: no card, no
 * checkout (settled positioning). Payment happens from Settings, either
 * immediately or when the trial-expiry billing wall appears.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { slugifyFlagKey, slugifyProjectSlug } from "@/components/flags-view";
import { Logo } from "@/components/logo";
import {
  Button,
  Chip,
  CopyButton,
  ErrorNote,
  Field,
  inputClass,
} from "@/components/ui";
import { OnboardingResumeSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiApiKey, ApiFlag, ApiOrg, ApiProject } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { usePricingTiers } from "@/lib/use-pricing";

type Step = "loading" | "org" | "plan" | "project" | "checklist";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function OnboardingFlow({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [org, setOrg] = useState<ApiOrg | null>(null);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [sdkKey, setSdkKey] = useState<string | null>(null);
  const [firstFlag, setFirstFlag] = useState<ApiFlag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/login");
  }, [router]);

  // Resume where the user left off.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { orgs } = await api<{ orgs: ApiOrg[] }>("/api/v1/orgs");
        if (cancelled) return;
        const existingOrg = orgs[0] ?? null;
        if (!existingOrg) {
          setStep("org");
          return;
        }
        setOrg(existingOrg);
        // plan === "trial" means no tier was ever picked; resume at the plan step.
        if (existingOrg.plan === "trial") {
          setStep("plan");
          return;
        }
        const { projects } = await api<{ projects: ApiProject[] }>("/api/v1/projects");
        if (cancelled) return;
        const existingProject = projects[0] ?? null;
        if (!existingProject) {
          setStep("project");
          return;
        }
        setProject(existingProject);
        setStep("checklist");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load onboarding state");
          setStep("org");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-16 items-center justify-between gap-4 px-8">
        <Logo href="/onboarding" size="sm" showText />
        {userEmail ? (
          <div className="flex shrink-0 items-center gap-2 text-[13px]">
            <span className="max-w-[140px] truncate text-ink-muted sm:max-w-[220px]">
              {userEmail}
            </span>
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        {/* Progress stepper, centered above the onboarding container. */}
        {step !== "loading" ? (
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            {(["Create org", "Pick plan", "Create project", "First flag"] as const).map((label, index) => {
              const stepIndex =
                step === "org" ? 0 : step === "plan" ? 1 : step === "project" ? 2 : 3;
              const done = index < stepIndex || (index === 3 && firstFlag !== null);
              const active = index === stepIndex;
              return (
                <span
                  key={label}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${
                    done
                      ? "bg-chip-green/10 text-chip-green"
                      : active
                        ? "bg-ink text-white"
                        : "bg-surface text-ink-muted"
                  }`}
                >
                  {done ? "✓" : index + 1} {label}
                </span>
              );
            })}
          </div>
        ) : null}

        {/* Keyed by step so each onboarding stage blurs + fades in. */}
        <div key={step} className={step === "loading" ? undefined : "stagger-in"}>
        {step === "loading" ? (
          <OnboardingResumeSkeleton />
        ) : step === "org" ? (
          <OrgStep
            onCreated={(createdOrg) => {
              setOrg(createdOrg);
              setStep("plan");
            }}
          />
        ) : step === "plan" && org ? (
          <PlanStep
            org={org}
            onSelected={(updatedOrg) => {
              setOrg(updatedOrg);
              setStep("project");
            }}
          />
        ) : step === "project" ? (
          <ProjectStep
            onCreated={(createdProject, plaintext) => {
              setProject(createdProject);
              setSdkKey(plaintext);
              setStep("checklist");
            }}
          />
        ) : org && project ? (
          <Checklist
            org={org}
            project={project}
            sdkKey={sdkKey}
            firstFlag={firstFlag}
            onFirstFlag={setFirstFlag}
            onDone={() => router.push("/flags")}
          />
        ) : null}
        </div>
        <ErrorNote message={error} />
      </main>

      <footer className="py-8 text-center text-[12px] text-ink-muted">
        ShipOS @ 2026
      </footer>
    </div>
  );
}

function OrgStep({ onCreated }: { onCreated: (org: ApiOrg) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { org } = await api<{ org: ApiOrg }>("/api/v1/orgs", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      onCreated(org);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[32px] border border-line bg-surface p-10">
      <h1 className="text-[32px] font-semibold tracking-[-0.02em]">Welcome aboard.</h1>
      <p className="mt-2 text-[15px] text-ink-muted">
        Name your organization, your team, your flags, your audit trail. The clock to your first
        flag starts now.
      </p>
      <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-4">
        <Field label="Organization name">
          <input
            className={`${inputClass} h-12`}
            value={name}
            required
            autoFocus
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Inc"
          />
        </Field>
        <ErrorNote message={error} />
        <Button type="submit" size="lg" loading={busy} disabled={name.trim().length === 0}>
          {busy ? "Creating…" : "Create organization"}
        </Button>
      </form>
    </div>
  );
}

function PlanStep({
  org,
  onSelected,
}: {
  org: ApiOrg;
  onSelected: (org: ApiOrg) => void;
}) {
  const tiers = usePricingTiers();
  const [selected, setSelected] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedTier = tiers?.find((tier) => tier.key === selected) ?? null;

  async function choose(planKey: string) {
    setError(null);
    setSelecting(planKey);
    try {
      const { org: updated } = await api<{ org: ApiOrg }>(`/api/v1/orgs/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ plan: planKey }),
      });
      onSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select plan");
      setSelecting(null);
    }
  }

  return (
    <div className="rounded-[32px] border border-line bg-surface p-10">
      <h1 className="text-[32px] font-semibold tracking-[-0.02em]">Pick your plan.</h1>
      <p className="mt-2 text-[15px] text-ink-muted">
        Every plan starts with a <strong className="text-ink">14-day free trial, no card</strong>.
        Unlimited flags, seats and environments on all of them; the only meter is evaluations.
      </p>

      {!tiers ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-line bg-canvas p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">
                  <Skeleton className="inline-block h-[1em] w-16 align-middle" />
                </p>
              </div>
              <p className="mt-2 font-mono text-[22px] font-semibold">
                <Skeleton className="inline-block h-[1em] w-20 align-middle" />
              </p>
              <p className="mt-2 text-[12px]">
                <Skeleton className="inline-block h-[1em] w-28 align-middle" />
              </p>
              <p className="mt-1 text-[12px]">
                <Skeleton className="inline-block h-[1em] w-24 align-middle" />
              </p>
              <span className="mt-4 flex items-center gap-1.5 text-[12px]">
                <span className="h-4 w-4 rounded-full border border-line-strong" />
                <Skeleton className="inline-block h-[1em] w-12 align-middle" />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {tiers.map((tier) => {
            const isSelected = selected === tier.key;
            return (
              <button
                key={tier.key}
                type="button"
                aria-pressed={isSelected}
                disabled={selecting !== null}
                onClick={() => setSelected(tier.key)}
                className={`flex flex-col rounded-2xl border bg-canvas p-5 text-left transition-colors disabled:opacity-60 ${
                  isSelected
                    ? "border-[#FF5A1A] ring-2 ring-[#FF5A1A]/30"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold">{tier.name}</p>
                  {tier.popular ? (
                    <Chip color="orange" className="!px-2 !py-0.5 text-[11px]">
                      Popular
                    </Chip>
                  ) : null}
                </div>
                <p className="mt-2 flex items-baseline gap-0.5 font-mono font-semibold">
                  <span className="text-[22px] tracking-tight tabular-nums">{tier.price}</span>
                  <span className="text-[12px] font-normal text-ink-muted">{tier.period}</span>
                </p>
                <p className="mt-2 text-[12px] text-ink-muted">
                  {(tier.includedEvaluations / 1_000_000).toLocaleString()}M evaluations / mo
                </p>
                <p className="mt-1 text-[12px] text-ink-muted">{tier.tagline}</p>
                <span
                  className={`mt-4 flex items-center gap-1.5 text-[12px] font-medium ${
                    isSelected ? "text-[#FF5A1A]" : "text-ink-muted"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      isSelected ? "border-[#FF5A1A] bg-[#FF5A1A] text-white" : "border-line-strong"
                    }`}
                  >
                    {isSelected ? (
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
                        <path
                          d="M1.5 5.5l2.5 2.5 4.5-6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  {isSelected ? "Selected" : "Select"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          loading={selecting !== null}
          disabled={!selectedTier}
          onClick={() => selectedTier && void choose(selectedTier.key)}
        >
          {selecting !== null
            ? "Starting trial…"
            : selectedTier
              ? `Start 14-day trial on ${selectedTier.name}`
              : "Select a plan to continue"}
        </Button>
      </div>

      <p className="mt-4 text-[12px] text-ink-muted">
        You won&apos;t pay anything today. When the trial ends, you add payment from Settings,
        and your flags keep serving either way. You can switch tiers any time.
      </p>
      <ErrorNote message={error} />
    </div>
  );
}

function ProjectStep({
  onCreated,
}: {
  onCreated: (project: ApiProject, sdkKeyPlaintext: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { project } = await api<{ project: ApiProject }>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name, slug: slug || slugifyProjectSlug(name) }),
      });

      // Mint a dev SDK key right away so the checklist has a copyable key.
      let plaintext: string | null = null;
      const devEnv =
        project.environments.find((env) => env.slug === "dev") ?? project.environments[0];
      if (devEnv) {
        try {
          const created = await api<{ apiKey: ApiApiKey; plaintext: string }>("/api/v1/keys", {
            method: "POST",
            body: JSON.stringify({
              kind: "sdk",
              name: `${project.slug} dev SDK key`,
              projectId: project.id,
              environmentId: devEnv.id,
            }),
          });
          plaintext = created.plaintext;
        } catch {
          // Non-fatal: the checklist still works, keys page can mint one.
        }
      }

      onCreated(project, plaintext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[32px] border border-line bg-surface p-10">
      <h1 className="text-[32px] font-semibold tracking-[-0.02em]">Create your first project.</h1>
      <p className="mt-2 text-[15px] text-ink-muted">
        A project gets three environments out of the box, dev, staging and prod, and every flag
        you create exists in all three.
      </p>
      <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-4">
        <Field label="Project name">
          <input
            className={`${inputClass} h-12`}
            value={name}
            required
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugifyProjectSlug(event.target.value));
            }}
            placeholder="My App"
          />
        </Field>
        <Field label="Slug">
          <input
            className={`${inputClass} h-12 font-mono`}
            value={slug}
            required
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugifyProjectSlug(event.target.value));
            }}
            placeholder="my-app"
          />
        </Field>
        <ErrorNote message={error} />
        <Button type="submit" size="lg" loading={busy} disabled={name.trim().length === 0}>
          {busy ? "Creating…" : "Create project"}
        </Button>
      </form>
    </div>
  );
}

function Checklist({
  org,
  project,
  sdkKey,
  firstFlag,
  onFirstFlag,
  onDone,
}: {
  org: ApiOrg;
  project: ApiProject;
  sdkKey: string | null;
  firstFlag: ApiFlag | null;
  onFirstFlag: (flag: ApiFlag) => void;
  onDone: () => void;
}) {
  const [flagName, setFlagName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const orgCreatedAt = useMemo(() => new Date(org.createdAt).getTime(), [org.createdAt]);
  const firstFlagAtRef = useRef<number | null>(null);

  // The activation clock.
  useEffect(() => {
    if (firstFlag) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [firstFlag]);

  // Poll: the user may create the flag from /flags in another tab.
  useEffect(() => {
    if (firstFlag) return;
    const timer = setInterval(() => {
      void api<{ flags: ApiFlag[] }>(`/api/v1/projects/${project.id}/flags`)
        .then(({ flags }) => {
          const flag = flags[0];
          if (flag) {
            firstFlagAtRef.current = Date.now();
            onFirstFlag(flag);
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [firstFlag, project.id, onFirstFlag]);

  const createFlag = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const { flag } = await api<{ flag: ApiFlag }>(`/api/v1/projects/${project.id}/flags`, {
          method: "POST",
          body: JSON.stringify({
            key: slugifyFlagKey(flagName),
            name: flagName,
            kind: "boolean",
          }),
        });
        firstFlagAtRef.current = Date.now();
        onFirstFlag(flag);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create flag");
      } finally {
        setBusy(false);
      }
    },
    [flagName, project.id, onFirstFlag],
  );

  const elapsed = (firstFlagAtRef.current ?? now) - orgCreatedAt;
  const edgeUrl = process.env.NEXT_PUBLIC_EDGE_URL ?? "https://edge.shipos.app";
  const flagKeyForSnippet = firstFlag?.key ?? (slugifyFlagKey(flagName) || "my-first-flag");
  const snippet = `curl -X POST ${edgeUrl}/v1/evaluate \\
  -H "Authorization: Bearer ${sdkKey ?? "sos_sdk_YOUR_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"${flagKeyForSnippet}","context":{"userId":"u_123"}}'`;

  const items: { label: string; done: boolean }[] = [
    { label: `Organization "${org.name}" created`, done: true },
    { label: `Project "${project.name}" created with dev / staging / prod`, done: true },
    { label: "SDK key minted for dev", done: sdkKey !== null },
    { label: "First flag shipped", done: firstFlag !== null },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-line bg-surface p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.02em]">
              {firstFlag ? "You're shipping." : "First flag in 5 minutes."}
            </h1>
            <p className="mt-2 text-[15px] text-ink-muted">
              {firstFlag
                ? "Your first flag exists in every environment, disabled and safe. Flip it in dev when you're ready."
                : "Everything below is done except the one that matters."}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-line bg-canvas px-4 py-3 text-center">
            <p className="font-mono text-[24px] font-semibold tabular-nums">
              {formatElapsed(elapsed)}
            </p>
            <p className="text-[11px] text-ink-muted">
              {firstFlag ? "time to first flag" : "clock's running"}
            </p>
          </div>
        </div>

        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-3 text-[14px]">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  item.done ? "bg-chip-green/10 text-chip-green" : "border border-line-strong text-transparent"
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <path d="M1.5 5.5l2.5 2.5 4.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={item.done ? "" : "text-ink-muted"}>{item.label}</span>
            </li>
          ))}
        </ul>

        {!firstFlag ? (
          <form onSubmit={(event) => void createFlag(event)} className="mt-8 flex gap-2">
            <input
              className={`${inputClass} h-12 flex-1`}
              value={flagName}
              autoFocus
              onChange={(event) => setFlagName(event.target.value)}
              placeholder="Name your first flag, e.g. New checkout flow"
            />
            <Button type="submit" size="lg" loading={busy} disabled={flagName.trim().length === 0}>
              {busy ? "Shipping…" : "Ship it"}
            </Button>
          </form>
        ) : (
          <div className="mt-8 flex items-center gap-3">
            <Button size="lg" onClick={onDone}>
              Go to your flags
            </Button>
            <Chip color="green">
              first flag in {formatElapsed(elapsed)}
            </Chip>
          </div>
        )}
        <ErrorNote message={error} />
      </div>

      {sdkKey ? (
        <div className="rounded-[24px] border border-line bg-surface p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-semibold">Your dev SDK key</p>
            <CopyButton text={sdkKey} label="Copy key" />
          </div>
          <code className="block break-all rounded-xl border border-line bg-canvas p-3 font-mono text-[12px]">
            {sdkKey}
          </code>
          <p className="mt-2 text-[12px] text-ink-muted">
            Shown once, it's publishable, but copy it somewhere handy. You can mint more on the
            Keys page.
          </p>
        </div>
      ) : null}

      {/* Code snippet in a macOS window mockup (the only dark surface, per design). */}
      <div className="overflow-hidden rounded-[20px] shadow-[0_12px_48px_rgba(0,0,0,0.09),0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 bg-window-dark px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-[#ff6058]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 font-mono text-[12px] text-white/60">evaluate.sh</span>
          <TerminalCopyButton text={snippet} />
        </div>
        <pre className="overflow-x-auto bg-terminal-dark p-5 font-mono text-[12.5px] leading-relaxed text-[#d7dae0]">
          {snippet}
        </pre>
      </div>
    </div>
  );
}

/**
 * Copy control for the dark terminal header. Button morphs to a green
 * check + "Copied"; Appica toaster confirms the clipboard write.
 */
function TerminalCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.copied("Command copied to clipboard");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1600);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied to clipboard" : "Copy command"}
      className={`ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
        copied
          ? "text-[#28c840]"
          : "text-white/55 hover:bg-white/10 hover:text-white/90"
      }`}
    >
      <span key={copied ? "check" : "copy"} className="animate-in zoom-in-75 fade-in duration-200">
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path
              d="M1.5 5.5l2.5 2.5 4.5-6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
