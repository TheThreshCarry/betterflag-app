import { Button, Hr, Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailLayout } from "../components/layout"
import { button, divider, heading, link, paragraph, secondary } from "./_styles"

/**
 * Supabase template: "Reset password".
 * Vars: {{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }}
 */
export default function ResetPasswordEmail() {
  return (
    <EmailLayout preview="Reset your ShipOS password">
      <Text style={heading}>Reset your password</Text>
      <Text style={paragraph}>
        We received a request to reset the password for your ShipOS account.
        Click the button below to choose a new password. This link expires in
        1 hour.
      </Text>
      <Button style={button()} href="{{ .ConfirmationURL }}">
        Reset password &rarr;
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
        If you didn&apos;t request a password reset, someone may have typed
        your email by mistake. You can safely ignore this email — your password
        will remain unchanged.
        <br />
        <br />
        If you&apos;re concerned about your account security, contact{" "}
        <Link href="mailto:support@shipos.app" style={link}>
          support@shipos.app
        </Link>
        .
      </Text>
    </EmailLayout>
  )
}
