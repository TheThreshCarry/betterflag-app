#!/usr/bin/env bun
/**
 * Render every lib/email/supabase/*.tsx component to static HTML under
 * supabase/email-templates/*.html for copy-paste into the Supabase dashboard.
 *
 * Supabase uses Go template syntax ({{ .ConfirmationURL }}, {{ .Token }}, etc.)
 * inside email templates — we embed those tokens as literal strings inside
 * the JSX so they survive @react-email/render.
 *
 * Run:
 *   bun run scripts/build-supabase-email-templates.ts
 */
import { render } from "@react-email/render"
import { mkdir, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import ConfirmSignupEmail from "../lib/email/supabase/confirm-signup"
import MagicLinkEmail from "../lib/email/supabase/magic-link"
import InviteEmail from "../lib/email/supabase/invite"
import ResetPasswordEmail from "../lib/email/supabase/reset-password"
import ChangeEmailEmail from "../lib/email/supabase/change-email"
import ReauthenticationEmail from "../lib/email/supabase/reauthentication"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const outDir = join(__dirname, "..", "supabase", "email-templates")

const templates = [
  { file: "confirm-signup.html", Component: ConfirmSignupEmail, slot: "Confirm signup" },
  { file: "magic-link.html", Component: MagicLinkEmail, slot: "Magic Link" },
  { file: "invite.html", Component: InviteEmail, slot: "Invite user" },
  { file: "reset-password.html", Component: ResetPasswordEmail, slot: "Reset password" },
  { file: "change-email.html", Component: ChangeEmailEmail, slot: "Change Email Address" },
  { file: "reauthentication.html", Component: ReauthenticationEmail, slot: "Reauthentication" },
] as const

async function main() {
  await mkdir(outDir, { recursive: true })

  for (const { file, Component, slot } of templates) {
    const html = await render(<Component />, { pretty: true })
    // Guard against react-email escaping Go template double-braces.
    // Replace any HTML-escaped variant back to the canonical form.
    const normalized = html
      .replaceAll("&#123;&#123;", "{{")
      .replaceAll("&#125;&#125;", "}}")
      .replaceAll("%7B%7B", "{{")
      .replaceAll("%7D%7D", "}}")

    const outPath = join(outDir, file)
    await writeFile(outPath, normalized, "utf8")
    console.log(`[supabase-email] rendered ${slot.padEnd(22)} → ${file}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
