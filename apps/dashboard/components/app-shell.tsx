"use client";

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

import { AppSidebar } from "@/components/app-sidebar";
import { AppShellSkeleton } from "@/components/skeletons";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
    return <AppShellSkeleton />;
  }

  return (
    <AppContext.Provider value={contextValue}>
      <SidebarProvider>
        <AppSidebar
          userEmail={userEmail}
          orgName={contextValue.org.name}
          signingOut={signingOut}
          onSignOut={() => void signOut()}
        />
        <SidebarInset>
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
          <main className="mx-auto max-w-5xl flex-1 px-8 py-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AppContext.Provider>
  );
}
