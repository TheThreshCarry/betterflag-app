"use client";

import { useApp } from "@/components/app-shell";
import { cn } from "@/lib/utils";

const ENV_DOT: Record<string, string> = {
  dev: "bg-amber-500",
  staging: "bg-chip-orange",
  prod: "bg-chip-green",
};

export function EnvSwitcher() {
  const { environments, activeEnv, setActiveEnvSlug } = useApp();

  if (environments.length === 0) return null;

  return (
    <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
      <p className="mb-1.5 px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Environment
      </p>
      <div className="flex flex-wrap gap-1 px-1">
        {environments.map((env) => {
          const active = activeEnv?.slug === env.slug;
          return (
            <button
              key={env.id}
              type="button"
              onClick={() => setActiveEnvSlug(env.slug)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-[0_0_0_1px_var(--sidebar-border)]"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", ENV_DOT[env.slug] ?? "bg-muted-foreground")}
              />
              {env.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
