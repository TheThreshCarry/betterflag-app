"use client";

import { Building2, ChartLine, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { createBrowserSupabase } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Overview", icon: ChartLine },
  { href: "/orgs", label: "Organizations", icon: Building2 },
  { href: "/users", label: "Users", icon: Users },
];

export function AdminShell({ userEmail, children }: { userEmail: string; children: ReactNode }) {
  const pathname = usePathname();

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-line bg-surface px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="text-[17px] font-semibold tracking-[-0.02em]">ShipOS</span>
          <span className="h-2 w-2 rounded-full bg-chip-orange" aria-hidden />
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
            Admin
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors ${
                  active ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.05)]" : "text-ink-muted hover:bg-white/60 hover:text-ink"
                }`}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line pt-4">
          <p className="truncate px-2 text-[12px] text-ink-muted" title={userEmail}>
            {userEmail}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-white/60 hover:text-ink"
          >
            <LogOut size={15} strokeWidth={1.8} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <main className="ml-60 min-h-screen flex-1 bg-canvas px-10 py-8">{children}</main>
    </div>
  );
}
