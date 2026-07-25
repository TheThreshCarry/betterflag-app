"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@appica/ui-react/hooks/use-theme";

import { usePreferences } from "@/components/preferences-provider";
import { Toggle } from "@/components/ui";
import type { ThemePreference } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof SunIcon;
}[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export function AppearanceSettings() {
  const { theme, setTheme, mounted: themeMounted } = useTheme();
  const {
    disableAnimations,
    setDisableAnimations,
    mounted: prefsMounted,
  } = usePreferences();

  const ready = themeMounted && prefsMounted;
  const activeTheme = (theme ?? "system") as ThemePreference;

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <p className="text-[14px] font-medium">Appearance</p>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Theme and motion for this browser.
        </p>
      </div>

      <div className="grid gap-1 border-b border-line px-5 py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-4">
        <p className="text-[13px] text-ink-muted">Theme</p>
        <div
          className={cn(
            "inline-flex w-full rounded-2xl border border-line bg-canvas p-1 sm:w-auto",
            !ready && "pointer-events-none opacity-60",
          )}
          role="radiogroup"
          aria-label="Theme"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = ready && activeTheme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!ready}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium sm:flex-none",
                  selected
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <p className="text-[13px] text-ink-muted">Animations</p>
        <div className="min-w-0">
          <p className="text-[14px] font-medium">
            {disableAnimations ? "Off" : "On"}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Entrance and stagger effects across the dashboard.
          </p>
        </div>
        <div className={cn("mt-2 sm:mt-0", !ready && "pointer-events-none opacity-60")}>
          <Toggle
            checked={ready ? !disableAnimations : true}
            onChange={(on) => setDisableAnimations(!on)}
            disabled={!ready}
            label="Enable interface animations"
          />
        </div>
      </div>
    </div>
  );
}
