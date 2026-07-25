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
import { AppShellLoading } from "@/components/app-shell-loading";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ApiOrg, ApiProfile, ApiProject } from "@/lib/api-types";
import { api, ApiClientError } from "@/lib/client-api";
import { createBrowserSupabase } from "@/lib/supabase/client";

type ApiEnvironment = ApiProject["environments"][number];

interface AppContextValue {
  userEmail: string | null;
  /** Current user's profile avatar URL (media CDN), or null. */
  avatarUrl: string | null;
  org: ApiOrg;
  orgs: ApiOrg[];
  projects: ApiProject[];
  activeProject: ApiProject | null;
  setActiveProjectId: (id: string) => void;
  refreshOrgs: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  /** Patch one project in local state (e.g. after picture upload). */
  patchProject: (project: ApiProject) => void;
  /** Patch the active org in local state (e.g. after logo upload). */
  patchOrg: (org: ApiOrg) => void;
  /** Patch the current user's profile in local state. */
  patchProfile: (profile: ApiProfile) => void;
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [activeEnvSlug, setActiveEnvSlugState] = useState<string>(DEFAULT_ENV_SLUG);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const refreshOrgs = useCallback(async () => {
    const { orgs: fresh } = await api<{ orgs: ApiOrg[] }>("/api/v1/orgs");
    if (fresh.length === 0) {
      router.replace("/onboarding");
      return;
    }
    setOrgs(fresh);
  }, [router]);

  const refreshProjects = useCallback(async () => {
    try {
      const { projects: fresh } = await api<{ projects: ApiProject[] }>("/api/v1/projects");
      setProjects(fresh);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "no_org") return;
      throw err;
    }
  }, []);

  const patchProject = useCallback((project: ApiProject) => {
    setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
  }, []);

  const patchOrg = useCallback((next: ApiOrg) => {
    setOrgs((prev) => {
      if (!prev) return prev;
      return prev.map((o) =>
        o.id === next.id ? { ...next, members: next.members ?? o.members } : o,
      );
    });
  }, []);

  const patchProfile = useCallback((profile: ApiProfile) => {
    setAvatarUrl(profile.avatarUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [{ orgs: loadedOrgs }, me] = await Promise.all([
          api<{ orgs: ApiOrg[] }>("/api/v1/orgs"),
          api<{ profile: ApiProfile }>("/api/v1/me").catch(() => null),
        ]);
        if (cancelled) return;
        if (loadedOrgs.length === 0) {
          router.replace("/onboarding");
          return;
        }
        // No active plan (trial over, never subscribed): hard wall. Flags keep
        // serving from the edge; the dashboard requires picking a plan.
        if (loadedOrgs[0]!.billingState === "expired") {
          router.replace("/billing");
          return;
        }
        setOrgs(loadedOrgs);
        if (me) setAvatarUrl(me.profile.avatarUrl);

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

  const setActiveEnvSlug = useCallback(
    (slug: string) => {
      if (slug === activeEnvSlug) return;
      window.localStorage.setItem(ACTIVE_ENV_KEY, slug);
      setActiveEnvSlugState(slug);
    },
    [activeEnvSlug],
  );

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

  const [bannerEnv, setBannerEnv] = useState<ApiEnvironment | null>(null);
  const [envBarOpen, setEnvBarOpen] = useState(false);

  useEffect(() => {
    if (activeEnv && activeEnv.slug !== "prod") {
      setBannerEnv(activeEnv);
      // Mount closed, open next frame so height/opacity transition runs.
      const id = requestAnimationFrame(() => setEnvBarOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setEnvBarOpen(false);
  }, [activeEnv]);

  const org = orgs?.[0] ?? null;

  const contextValue = useMemo<AppContextValue | null>(() => {
    if (!org) return null;
    return {
      userEmail,
      avatarUrl,
      org,
      orgs: orgs ?? [],
      projects,
      activeProject,
      setActiveProjectId,
      refreshOrgs,
      refreshProjects,
      patchProject,
      patchOrg,
      patchProfile,
      environments,
      activeEnv,
      setActiveEnvSlug,
    };
  }, [
    org,
    userEmail,
    avatarUrl,
    orgs,
    projects,
    activeProject,
    setActiveProjectId,
    refreshOrgs,
    refreshProjects,
    patchProject,
    patchOrg,
    patchProfile,
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
    return <AppShellLoading />;
  }

  return (
    <AppContext.Provider value={contextValue}>
      <SidebarProvider
        className="env-bar-shell flex-col"
        style={
          {
            "--env-bar-h": envBarOpen ? "2.5rem" : "0px",
          } as React.CSSProperties
        }
      >
        {bannerEnv ? (
          <div
            className="env-bar sticky top-0 z-20 w-full shrink-0"
            data-open={envBarOpen ? "true" : "false"}
            aria-hidden={!envBarOpen}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className={`env-bar-inner flex h-10 w-full items-center gap-2 border-b px-8 text-[13px] font-medium ${
                  bannerEnv.slug === "staging"
                    ? "border-chip-orange/40 bg-chip-orange/20 text-chip-orange"
                    : "border-amber-400 bg-amber-100 text-amber-950"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    bannerEnv.slug === "staging" ? "bg-chip-orange" : "bg-amber-500"
                  }`}
                />
                <span>
                  You&rsquo;re in the{" "}
                  <span className="font-semibold mr-1">{bannerEnv.name}</span> environment,
                  changes here don&rsquo;t affect{" "}
                  <span className="font-semibold">production</span>.
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex min-h-0 w-full flex-1">
          <AppSidebar
            userEmail={userEmail}
            orgName={contextValue.org.name}
            avatarUrl={contextValue.avatarUrl}
            signingOut={signingOut}
            onSignOut={() => void signOut()}
          />
          <SidebarInset>
            <header className="sticky top-(--env-bar-h,0px) z-10 flex h-14 items-center border-b border-line bg-canvas/90 px-8 backdrop-blur transition-[top] duration-300 ease-out">
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
            <main
              // Env-scoped pages remount on switch; settings (org-wide) stays put.
              key={
                pathname.startsWith("/settings")
                  ? "settings"
                  : (activeEnv?.slug ?? "none")
              }
              className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-8"
            >
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AppContext.Provider>
  );
}
