import { Button, Hr, Link, Text } from "@react-email/components"
import * as React from "react"
import { EmailLayout } from "../components/layout"
import {
  button,
  divider,
  heading,
  link,
  paragraph,
  secondary,
  tokenBox,
} from "./_styles"

/**
 * Supabase template: "Magic Link".
 * Vars: {{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }}
 */
export default function MagicLinkEmail() {
  return (
    <EmailLayout preview="Sign in to ShipOS">
      <Text style={heading}>Sign in to ShipOS</Text>
      <Text style={paragraph}>
        Click the button below to securely sign in to your ShipOS account. This
        link expires in 10 minutes.
      </Text>
      <Button style={button()} href="{{ .ConfirmationURL }}">
        Sign in now &rarr;
      </Button>
      <Hr style={divider} />
      <Text style={paragraph}>
        Or enter this one-time code in the browser window that requested the
        sign in:
      </Text>
      <Text style={tokenBox}>{"{{ .Token }}"}</Text>
      <Hr style={divider} />
      <Text style={secondary}>
        Or copy and paste this link:
        <br />
        <Link href="{{ .ConfirmationURL }}" style={link}>
          {"{{ .ConfirmationURL }}"}
        </Link>
      </Text>
      <Hr style={divider} />
      <Text style={secondary}>
        If you didn&apos;t request this email, you can safely ignore it.
      </Text>
    </EmailLayout>
  )
}
