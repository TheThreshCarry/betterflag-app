/**
 * Admit users to the ShipOS private alpha (public.alpha_allowlist).
 *
 * Usage (from apps/dashboard):
 *   bun run alpha:admit someone@example.com another@example.com
 *   bun run alpha:admit --from-resend        # sync all contacts from the Resend audience
 *   bun run alpha:admit --list               # print the current allowlist
 *   bun run alpha:admit --remove someone@example.com
 *
 * Env (bun auto-loads .env / .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY, RESEND_AUDIENCE_ID       # only for --from-resend
 */

import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return value;
}

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

async function list(): Promise<void> {
  const { data, error } = await supabase
    .from("alpha_allowlist")
    .select("email, note, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) {
    console.log("Allowlist is empty.");
    return;
  }
  for (const row of data) {
    console.log(`${row.email}\t${row.created_at}\t${row.note ?? ""}`);
  }
  console.log(`\n${data.length} admitted.`);
}

async function admit(emails: string[], note: string): Promise<void> {
  const rows = [...new Set(emails.map(normalize))]
    .filter((e) => e.includes("@"))
    .map((email) => ({ email, note }));
  if (rows.length === 0) {
    console.error("No valid emails given.");
    process.exit(1);
  }
  const { error } = await supabase
    .from("alpha_allowlist")
    .upsert(rows, { onConflict: "email", ignoreDuplicates: true });
  if (error) throw error;
  console.log(`Admitted ${rows.length} email(s).`);
}

async function remove(emails: string[]): Promise<void> {
  const targets = emails.map(normalize);
  const { error } = await supabase.from("alpha_allowlist").delete().in("email", targets);
  if (error) throw error;
  console.log(`Removed ${targets.length} email(s).`);
}

interface ResendContact {
  email: string;
  unsubscribed: boolean;
}

async function fetchResendAudience(): Promise<string[]> {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const audienceId = requiredEnv("RESEND_AUDIENCE_ID");
  const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.error(`Resend API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const body = (await res.json()) as { data: ResendContact[] };
  return body.data.filter((c) => !c.unsubscribed).map((c) => c.email);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    await list();
  } else if (args.includes("--from-resend")) {
    const emails = await fetchResendAudience();
    console.log(`Fetched ${emails.length} subscribed contact(s) from Resend.`);
    await admit(emails, "resend-audience-sync");
  } else if (args[0] === "--remove") {
    await remove(args.slice(1));
  } else if (args.length > 0) {
    await admit(args, "manual");
  } else {
    console.log(
      "Usage: bun run alpha:admit <email...> | --from-resend | --list | --remove <email...>",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
