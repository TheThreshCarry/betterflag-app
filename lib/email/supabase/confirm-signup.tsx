import { Button, Hr, Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailLayout } from "../components/layout"
import { button, divider, heading, link, paragraph, secondary } from "./_styles"

/**
 * Supabase template: "Confirm signup".
 * Preserves Go template tokens verbatim for pasting into Supabase Dashboard.
 * Vars: {{ .ConfirmationURL }}, {{ .Email }}
 */
export default function ConfirmSignupEmail() {
  return (
    <EmailLayout preview="Confirm your email to activate your ShipOS account">
      <Text style={heading}>Welcome to ShipOS</Text>
      <Text style={paragraph}>
        Thanks for signing up. Click the button below to confirm your email
        address and activate your account.
      </Text>
      <Button style={button("#10b981")} href="{{ .ConfirmationURL }}">
        Confirm my email &rarr;
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
        If you didn&apos;t create a ShipOS account, please ignore this email.
      </Text>
    </EmailLayout>
  )
}
