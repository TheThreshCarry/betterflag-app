import { Hr, Text } from "@react-email/components"
import * as React from "react"
import { EmailLayout } from "../components/layout"
import { divider, heading, paragraph, secondary, tokenBox } from "./_styles"

/**
 * Supabase template: "Reauthentication".
 * Used by `supabase.auth.reauthenticate()` for sensitive actions.
 * Vars: {{ .Token }}, {{ .Email }}
 */
export default function ReauthenticationEmail() {
  return (
    <EmailLayout preview="Confirm this action on ShipOS">
      <Text style={heading}>Confirm this action</Text>
      <Text style={paragraph}>
        Enter the code below to confirm this sensitive action on your ShipOS
        account. This code expires in 10 minutes.
      </Text>
      <Text style={tokenBox}>{"{{ .Token }}"}</Text>
      <Hr style={divider} />
      <Text style={secondary}>
        If you didn&apos;t request this code, someone may have access to your
        account. Change your password immediately and contact{" "}
        support@shipos.app.
      </Text>
    </EmailLayout>
  )
}
