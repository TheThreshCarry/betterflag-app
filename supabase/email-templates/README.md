# Supabase Auth Email Templates

Branded HTML templates for every Supabase Auth email slot. Source-of-truth components live in [`lib/email/supabase/`](../../lib/email/supabase/) — **do not edit `.html` files by hand**.

## Regenerate

```bash
bun run email:supabase:build
```

This renders each `.tsx` to static HTML in this folder, preserving Supabase's Go template tokens (`{{ .ConfirmationURL }}`, `{{ .Token }}`, etc.) verbatim.

## Copy-paste into Supabase Dashboard

1. Open your Supabase project → **Authentication → Email Templates**.
2. For each slot, pick the matching HTML file from this folder and paste its entire contents into the template body.

| Supabase slot | File | Vars used |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `{{ .ConfirmationURL }}` |
| Magic Link | `magic-link.html` | `{{ .ConfirmationURL }}`, `{{ .Token }}` |
| Invite user | `invite.html` | `{{ .ConfirmationURL }}`, `{{ .Data.organization_name }}`, `{{ .Data.inviter_email }}` |
| Reset password | `reset-password.html` | `{{ .ConfirmationURL }}` |
| Change Email Address | `change-email.html` | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` |
| Reauthentication | `reauthentication.html` | `{{ .Token }}` |

Subjects (set these in the same page above the body):

| Slot | Subject |
|---|---|
| Confirm signup | Confirm your email |
| Magic Link | Sign in to ShipOS |
| Invite user | You've been invited to {{ .Data.organization_name }} on ShipOS |
| Reset password | Reset your ShipOS password |
| Change Email Address | Confirm your new email on ShipOS |
| Reauthentication | Confirm this action on ShipOS |

## Invite metadata

The **Invite user** template reads `{{ .Data.organization_name }}` and `{{ .Data.inviter_email }}` from `user_metadata` passed when sending the invite. In server code:

```ts
import { createAdminClient } from "@/lib/supabase/admin"

const supabase = createAdminClient()
await supabase.auth.admin.inviteUserByEmail(email, {
  data: {
    organization_name: org.name,
    inviter_email: currentUser.email,
  },
  redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
})
```

`lib/actions/invitations.ts` wraps this call in Phase 2.

## SMTP: Resend

Recommend Resend via custom SMTP so branded emails come from `auth@shipos.app`. Supabase Dashboard → **Project Settings → Auth → SMTP Settings**:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `$RESEND_API_KEY` |
| Sender email | `auth@shipos.app` |
| Sender name | `ShipOS` |

For local dev, Supabase CLI ships Inbucket on `http://localhost:54324` — inspect emails without real SMTP.

## Preview locally

```bash
bun run email:preview
```

Opens the react-email dev server at `http://localhost:3001`. Source tokens (`{{ .ConfirmationURL }}` etc.) render as literal strings during preview — that's expected.

## Tests

`__tests__/unit/email/supabase-templates.test.ts` asserts Go template tokens survive `@react-email/render` untouched. Run:

```bash
bun run test:unit -- supabase-templates
```
