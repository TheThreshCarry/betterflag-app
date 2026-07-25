"use client";

import { useApp } from "@/components/app-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

const ENV_DOT: Record<string, string> = {
  dev: "bg-amber-500",
  staging: "bg-chip-orange",
  prod: "bg-chip-green",
};

function EnvDot({ slug }: { slug: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        ENV_DOT[slug] ?? "bg-muted-foreground",
      )}
    />
  );
}

/**
 * Environment selector. Deliberately quieter than the project switcher
 * above it: a single ghost row with a dot + name + chevron, no card
 * chrome, that opens a small dropdown. The environment is a modifier of
 * the current view, not a navigation level.
 */
export function EnvSwitcher() {
  const { environments, activeEnv, setActiveEnvSlug } = useApp();

  if (environments.length === 0) return null;

  return (
    <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            />
          }
        >
          <EnvDot slug={activeEnv?.slug ?? ""} />
          <span className="truncate">{activeEnv?.name ?? "Environment"}</span>
          <ChevronDownIcon className="ml-auto size-3 shrink-0 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Environment
            </DropdownMenuLabel>
            {environments.map((env) => {
              const active = activeEnv?.slug === env.slug;
              return (
                <DropdownMenuItem
                  key={env.id}
                  onClick={() => setActiveEnvSlug(env.slug)}
                  className="gap-2 text-[13px]"
                >
                  <EnvDot slug={env.slug} />
                  <span className="truncate">{env.name}</span>
                  {active && <CheckIcon className="ml-auto size-3.5" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
