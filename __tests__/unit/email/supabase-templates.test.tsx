/**
 * Assert the Supabase Go template tokens survive @react-email/render.
 * If react-email starts escaping `{{ .ConfirmationURL }}` into
 * `&#123;&#123; ... &#125;&#125;`, our build script's normalization is the
 * last line of defense. These tests exercise both layers.
 */
import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"
import ChangeEmailEmail from "@/lib/email/supabase/change-email"
import ConfirmSignupEmail from "@/lib/email/supabase/confirm-signup"
import InviteEmail from "@/lib/email/supabase/invite"
import MagicLinkEmail from "@/lib/email/supabase/magic-link"
import ReauthenticationEmail from "@/lib/email/supabase/reauthentication"
import ResetPasswordEmail from "@/lib/email/supabase/reset-password"

const cases = [
  { name: "confirm-signup", Component: ConfirmSignupEmail, tokens: ["{{ .ConfirmationURL }}"] },
  {
    name: "magic-link",
    Component: MagicLinkEmail,
    tokens: ["{{ .ConfirmationURL }}", "{{ .Token }}"],
  },
  {
    name: "invite",
    Component: InviteEmail,
    tokens: [
      "{{ .ConfirmationURL }}",
      "{{ .Data.organization_name }}",
      "{{ .Data.inviter_email }}",
    ],
  },
  {
    name: "reset-password",
    Component: ResetPasswordEmail,
    tokens: ["{{ .ConfirmationURL }}"],
  },
  {
    name: "change-email",
    Component: ChangeEmailEmail,
    tokens: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .NewEmail }}"],
  },
  { name: "reauthentication", Component: ReauthenticationEmail, tokens: ["{{ .Token }}"] },
] as const

function normalizeGoTokens(html: string): string {
  return html
    .replaceAll("&#123;&#123;", "{{")
    .replaceAll("&#125;&#125;", "}}")
    .replaceAll("%7B%7B", "{{")
    .replaceAll("%7D%7D", "}}")
}

describe("Supabase email templates", () => {
  for (const { name, Component, tokens } of cases) {
    it(`${name} preserves Go template tokens after render+normalize`, async () => {
      const html = await render(<Component />)
      const normalized = normalizeGoTokens(html)
      for (const token of tokens) {
        expect(normalized).toContain(token)
      }
    })

    it(`${name} produces non-empty HTML`, async () => {
      const html = await render(<Component />)
      expect(html.length).toBeGreaterThan(500)
      expect(html).toMatch(/<html/i)
    })
  }
})
