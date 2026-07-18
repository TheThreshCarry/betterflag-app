"use client";

import { Button } from "@/components/ui";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function AccessDenied({ email }: { email: string }) {
  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8 text-center shadow-[0_12px_48px_rgba(0,0,0,0.06)]">
        <h1 className="mb-2 text-[20px] font-semibold tracking-[-0.01em]">Access denied</h1>
        <p className="mb-6 text-[14px] text-ink-muted">
          {email} is not on the ShipOS admin allowlist. This console is for the ShipOS team only.
        </p>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
