"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createBrowserSupabase().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <Button variant="secondary" loading={busy} onClick={() => void signOut()}>
      {busy ? "Signing out…" : "Use a different account"}
    </Button>
  );
}
