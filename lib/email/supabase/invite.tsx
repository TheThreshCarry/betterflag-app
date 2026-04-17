import { Button, Hr, Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailLayout } from "../components/layout"
import { button, divider, heading, link, paragraph, secondary } from "./_styles"

/**
 * Supabase template: "Invite user".
 * Vars: {{ .ConfirmationURL }}, {{ .Email }},
 *       {{ .Data.organization_name }}, {{ .Data.inviter_email }}
 * Pass metadata via supabase.auth.admin.inviteUserByEmail(email, {
 *   data: { organization_name, inviter_email }
 * }).
 */
export default function InviteEmail() {
  return (
    <EmailLayout preview="You've been invited to join a team on ShipOS">
      <Text style={heading}>
        You&apos;re invited to join {"{{ .Data.organization_name }}"}
      </Text>
      <Text style={paragraph}>
        {"{{ .Data.inviter_email }}"} invited you to join{" "}
        {"{{ .Data.organization_name }}"} on ShipOS. Click the button below to
        accept the invitation and set up your account.
      </Text>
      <Button style={button()} href="{{ .ConfirmationURL }}">
        Accept invitation &rarr;
      </Button>
      <Hr style={divider} />
      <Text style={secondary}>
        Or copy and paste this link into your browser:
        <br />
        <Link href="{{ .ConfirmationURL }}" style={link}>
          {"{{ .ConfirmationURL }}"}
        </Link>
      </Text>
      <Hr style={divider} />
      <Text style={secondary}>
        If you weren&apos;t expecting this invitation, you can safely ignore
        this email.
      </Text>
    </EmailLayout>
  )
}
