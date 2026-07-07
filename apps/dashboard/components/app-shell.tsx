"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Chip, PageLoading, Spinner } from "@/components/ui";
import type { ApiOrg, ApiProject } from "@/lib/api-types";
import { api, ApiClientError } from "@/lib/client-api";
import { createBrowserSupabase } from "@/lib/supabase/client";

type ApiEnvironment = ApiProject["environments"][number];

interface AppContextValue {
  org: ApiOrg;
  orgs: ApiOrg[];
  projects: ApiProject[];
  activeProject: ApiProject | null;
  setActiveProjectId: (id: string) => void;
  refreshProjects: () => Promise<void>;
  environments: ApiEnvironment[];
  activeEnv: ApiEnvironment | null;
  setActiveEnvSlug: (slug: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside <AppShell>");
  return value;
}

const ACTIVE_PROJECT_KEY = "shipos.activeProjectId";
const ACTIVE_ENV_KEY = "shipos.activeEnvSlug";
const DEFAULT_ENV_SLUG = "dev";

const NAV_ITEMS = [
  { href: "/flags", label: "Flags" },
  { href: "/keys", label: "Keys" },
  { href: "/audit", label: "Audit" },
  { href: "/approvals", label: "Approvals" },
  { href: "/usage", label: "Usage" },
  { href: "/settings", label: "Settings" },
] as const;

const ENV_ORDER = ["dev", "staging", "prod"] as const;

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [orgs, setOrgs] = useState<ApiOrg[] | null>(null);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [activeEnvSlug, setActiveEnvSlugState] = useState<string>(DEFAULT_ENV_SLUG);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      const { projects: fresh } = await api<{ projects: ApiProject[] }>("/api/v1/projects");
      setProjects(fresh);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "no_org") return;
      throw err;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { orgs: loadedOrgs } = await api<{ orgs: ApiOrg[] }>("/api/v1/orgs");
        if (cancelled) return;
        if (loadedOrgs.length === 0) {
          router.replace("/onboarding");
          return;
        }
        setOrgs(loadedOrgs);

        let loadedProjects: ApiProject[] = [];
        try {
          const res = await api<{ projects: ApiProject[] }>("/api/v1/projects");
          loadedProjects = res.projects;
        } catch (err) {
          if (!(err instanceof ApiClientError && err.code === "no_org")) throw err;
        }
        if (cancelled) return;
        setProjects(loadedProjects);

        const stored =
          typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
        const initial =
          loadedProjects.find((p) => p.id === stored)?.id ?? loadedProjects[0]?.id ?? null;
        setActiveProjectIdState(initial);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load workspace");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void api<{ approvals: unknown[] }>("/api/v1/approvals?status=pending")
      .then(({ approvals }) => {
        if (!cancelled) setPendingApprovals(approvals.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_ENV_KEY) : null;
    if (stored) setActiveEnvSlugState(stored);
  }, []);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  }, []);

  const setActiveEnvSlug = useCallback((slug: string) => {
    setActiveEnvSlugState(slug);
    window.localStorage.setItem(ACTIVE_ENV_KEY, slug);
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [projects, activeProjectId],
  );

  const environments = useMemo<ApiEnvironment[]>(
    () =>
      activeProject
        ? [...activeProject.environments].sort(
            (a, b) =>
              ENV_ORDER.indexOf(a.slug as (typeof ENV_ORDER)[number]) -
              ENV_ORDER.indexOf(b.slug as (typeof ENV_ORDER)[number]),
          )
        : [],
    [activeProject],
  );

  const activeEnv = useMemo<ApiEnvironment | null>(
    () => environments.find((e) => e.slug === activeEnvSlug) ?? environments[0] ?? null,
    [environments, activeEnvSlug],
  );

  const org = orgs?.[0] ?? null;

  const contextValue = useMemo<AppContextValue | null>(() => {
    if (!org) return null;
    return {
      org,
      orgs: orgs ?? [],
      projects,
      activeProject,
      setActiveProjectId,
      refreshProjects,
      environments,
      activeEnv,
      setActiveEnvSlug,
    };
  }, [
    org,
    orgs,
    projects,
    activeProject,
    setActiveProjectId,
    refreshProjects,
    environments,
    activeEnv,
    setActiveEnvSlug,
  ]);

  async function signOut() {
    setSigningOut(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-sm rounded-3xl border border-line bg-surface p-8 text-center">
          <p className="text-[15px] font-medium">Could not load your workspace</p>
          <p className="mt-2 text-[13px] text-ink-muted">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!contextValue) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-line bg-surface">
          <div className="px-5 pb-2 pt-6">
            <Link href="/flags" className="text-[18px] font-semibold tracking-[-0.01em]">
              ShipOS
            </Link>
          </div>

          <div className="px-4 py-3">
            <label className="mb-1 block px-1 text-[11px] font-medium text-ink-muted">
              Project
            </label>
            {projects.length > 0 ? (
              <select
                value={activeProject?.id ?? ""}
                onChange={(event) => setActiveProjectId(event.target.value)}
                className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[13px] font-medium outline-none focus:border-line-strong"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            ) : (
              <Link
                href="/flags"
                className="block rounded-xl border border-dashed border-line-strong px-3 py-2 text-[13px] text-ink-muted"
              >
                No projects yet
              </Link>
            )}
          </div>

          {environments.length > 0 ? (
            <div className="px-4 pb-2">
              <label className="mb-1 block px-1 text-[11px] font-medium text-ink-muted">
                Environment
              </label>
              <select
                value={activeEnv?.slug ?? ""}
                onChange={(event) => setActiveEnvSlug(event.target.value)}
                className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[13px] font-medium outline-none focus:border-line-strong"
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.slug}>
                    {env.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <nav className="flex-1 space-y-0.5 px-3 py-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-[14px] font-medium transition-colors ${
                    active ? "bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.03)]" : "text-ink-muted hover:bg-white/60 hover:text-ink"
                  }`}
                >
                  {item.label}
                  {item.href === "/approvals" && pendingApprovals > 0 ? (
                    <Chip color="green" className="!px-2 !py-0 text-[11px]">
                      {pendingApprovals}
                    </Chip>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-line px-5 py-4">
            <p className="truncate text-[13px] font-medium">{userEmail ?? "Signed in"}</p>
            <p className="mt-0.5 truncate text-[12px] text-ink-muted">{contextValue.org.name}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="mt-2 text-[12px] font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="ml-60 flex-1">
          <div className="sticky top-0 z-10">
            {activeEnv && activeEnv.slug !== "prod" ? (
              <div
                className={`flex items-center gap-2 border-b px-8 py-2.5 text-[13px] font-medium ${
                  activeEnv.slug === "staging"
                    ? "border-chip-orange/40 bg-chip-orange/20 text-chip-orange"
                    : "border-amber-400 bg-amber-100 text-amber-950"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    activeEnv.slug === "staging" ? "bg-chip-orange" : "bg-amber-500"
                  }`}
                />
                <span>
                  You&rsquo;re in the{" "}
                  <span className="font-semibold">{activeEnv.name}</span> environment — changes here
                  don&rsquo;t affect <span className="font-semibold">production</span>.
                </span>
              </div>
            ) : null}
            <header className="flex h-14 items-center border-b border-line bg-canvas/90 px-8 backdrop-blur">
              <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                {activeProject ? (
                  <>
                    <span className="font-medium text-ink">{activeProject.name}</span>
                    <span className="font-mono text-[12px]">{activeProject.slug}</span>
                  </>
                ) : (
                  <span>No project selected</span>
                )}
              </div>
            </header>
          </div>
          <main className="mx-auto max-w-5xl px-8 py-8">{children ?? <PageLoading />}</main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
