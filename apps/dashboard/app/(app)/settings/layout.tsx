"use client";

import { usePathname } from "next/navigation";

import { SettingsNav, type SettingsSection } from "@/components/settings-view";
import { Stagger } from "@/components/stagger";

function sectionFromPath(pathname: string): SettingsSection {
  if (pathname.endsWith("/billing")) return "billing";
  if (pathname.endsWith("/project")) return "project";
  if (pathname.endsWith("/usage")) return "usage";
  if (pathname.endsWith("/account")) return "account";
  return "organization";
}

/**
 * Persistent settings chrome — title + side nav stay mounted across section
 * routes so they don't re-run entrance animations on every tab change.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = sectionFromPath(pathname);

  return (
    <div>
      <Stagger>
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Settings</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Workspace, usage, billing, and personal preferences.
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
          <SettingsNav active={section} />
          <div className="min-w-0">{children}</div>
        </div>
      </Stagger>
    </div>
  );
}
