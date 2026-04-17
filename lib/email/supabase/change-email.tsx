import { Button, Hr, Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailLayout } from "../components/layout"
import { button, divider, heading, link, paragraph, secondary } from "./_styles"

/**
 * Supabase template: "Change Email Address".
 * Vars: {{ .ConfirmationURL }}, {{ .Email }}, {{ .NewEmail }}, {{ .Token }}
 */
export default function ChangeEmailEmail() {
  return (
    <EmailLayout preview="Confirm your new email address on ShipOS">
      <Text style={heading}>Confirm your new email</Text>
      <Text style={paragraph}>
        You requested to change the email on your ShipOS account from{" "}
        {"{{ .Email }}"} to {"{{ .NewEmail }}"}. Click the button below to
        confirm the change.
      </Text>
      <Button style={button()} href="{{ .ConfirmationURL }}">
        Confirm new email &rarr;
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
        If you didn&apos;t request this change, please ignore this email or
        contact{" "}
        <Link href="mailto:support@shipos.app" style={link}>
          support@shipos.app
        </Link>{" "}
        immediately.
      </Text>
    </EmailLayout>
  )
}
