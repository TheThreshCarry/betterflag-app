"use client";

import { useState, type FormEvent } from "react";

import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Busy = "password" | "magic" | null;

/**
 * Team sign-in only. There is no signup here: admins use their existing
 * Betterflag account, and the BETTERFLAG_ADMIN_EMAILS allowlist decides who gets
 * past the layout gate after authenticating.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setBusy("password");
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    window.location.href = "/";
  }

  async function sendMagicLink() {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setBusy("magic");
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    setBusy(null);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setMagicSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8 shadow-[0_12px_48px_rgba(0,0,0,0.06)]">
        <div className="mb-6 flex items-center gap-2">
          <span className="text-[19px] font-semibold tracking-[-0.02em]">Betterflag</span>
          <span className="h-2 w-2 rounded-full bg-chip-orange" aria-hidden />
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
            Admin
          </span>
        </div>

        <p className="mb-6 text-[14px] text-ink-muted">
          Team access only. Sign in with your Betterflag account.
        </p>

        {magicSent ? (
          <div className="rounded-xl bg-chip-green/10 px-4 py-3 text-[13px] font-medium text-chip-green">
            Magic link sent to {email}. Check your inbox.
          </div>
        ) : (
          <form onSubmit={(event) => void submitPassword(event)} className="flex flex-col gap-4">
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="you@betterflag.app"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </Field>
            <ErrorNote message={error} />
            <Button type="submit" disabled={busy !== null}>
              {busy === "password" ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => void sendMagicLink()}
            >
              {busy === "magic" ? "Sending…" : "Email me a magic link instead"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
