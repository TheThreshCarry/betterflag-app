"use client";

import { useState, type FormEvent } from "react";

import { Button, Chip, ErrorNote, inputClass } from "@/components/ui";
import { createBrowserSupabase } from "@/lib/supabase/client";

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l4 3.09C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

type Busy = "password" | "magic" | "github" | "google" | null;
type Notice = { kind: "magic" | "confirm"; email: string } | null;

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setBusy("password");
    setError(null);
    const supabase = createBrowserSupabase();

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setBusy(null);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // Email confirmation on: no session until the user confirms.
      if (!data.session) {
        setNotice({ kind: "confirm", email });
        return;
      }
      window.location.assign("/");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(null);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    window.location.assign("/");
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(null);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setNotice({ kind: "magic", email });
  }

  async function signInWithProvider(provider: "github" | "google") {
    setBusy(provider);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setBusy(null);
      setError(oauthError.message);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-surface p-12 lg:flex">
        <div className="text-[20px] font-semibold tracking-[-0.01em]">ShipOS</div>
        <div className="max-w-md">
          <div className="mb-5 flex flex-wrap gap-2">
            <Chip color="orange">Feature flags</Chip>
            <Chip color="green">Agent-ready</Chip>
            <Chip color="pink">Kill switch</Chip>
            <Chip color="blue">Edge SDK</Chip>
          </div>
          <h1 className="text-[40px] font-semibold leading-tight tracking-[-0.02em]">
            Feature flags your agents can ship with.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">
            Agents ship flags through the MCP server and REST API. Every flip is audited, every
            flag has a kill switch.
          </p>
          <ul className="mt-6 space-y-2.5 text-[14px]">
            {[
              "Agent-native: create, target, and roll out via MCP",
              "Kill switches that land at the edge in seconds",
              "One audit trail for humans and machines",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-chip-green/10 text-chip-green">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M1.5 5.5l2.5 2.5 4.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[13px] text-ink-muted">shipos.app</p>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="text-[20px] font-semibold tracking-[-0.01em]">ShipOS</span>
          </div>
          <h2 className="text-[28px] font-semibold tracking-[-0.01em]">
            {mode === "signup" ? "Create your account" : "Sign in"}
          </h2>
          <p className="mt-1.5 text-[14px] text-ink-muted">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-ink underline underline-offset-2"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button
                  type="button"
                  className="font-medium text-ink underline underline-offset-2"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                >
                  Create an account
                </button>
              </>
            )}
          </p>

          <div className="mt-8 space-y-4">
            {notice ? (
              <div className="rounded-2xl border border-line bg-surface p-5 text-[14px]">
                <p className="font-medium">Check your inbox</p>
                <p className="mt-1 text-ink-muted">
                  {notice.kind === "magic" ? (
                    <>
                      We sent a magic link to{" "}
                      <span className="font-medium text-ink">{notice.email}</span>. Click it to sign
                      in.
                    </>
                  ) : (
                    <>
                      We sent a confirmation link to{" "}
                      <span className="font-medium text-ink">{notice.email}</span>. Confirm it to
                      finish creating your account.
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className="mt-3 text-[13px] font-medium text-ink underline underline-offset-2"
                  onClick={() => setNotice(null)}
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={(event) => void submitPassword(event)} className="space-y-3">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`${inputClass} h-12`}
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} h-12`}
                />
                <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
                  {busy === "password"
                    ? mode === "signup"
                      ? "Creating account…"
                      : "Signing in…"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-[13px] font-medium text-ink-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
                  disabled={busy !== null}
                  onClick={() => void sendMagicLink()}
                >
                  {busy === "magic" ? "Sending link…" : "Email me a magic link instead"}
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[12px] text-ink-muted">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={busy !== null}
              onClick={() => void signInWithProvider("github")}
            >
              <GitHubIcon /> Continue with GitHub
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={busy !== null}
              onClick={() => void signInWithProvider("google")}
            >
              <GoogleIcon /> Continue with Google
            </Button>

            <ErrorNote message={error} />
          </div>
        </div>
      </div>
    </div>
  );
}
