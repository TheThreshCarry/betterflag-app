import { Button, Hr, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./layout";

interface MagicLinkEmailProps {
  url: string;
}

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Click here to sign in to your ShipOS account">
      <Text style={heading}>Sign in to ShipOS</Text>
      <Text style={paragraph}>
        Hi there,
        <br />
        <br />
        Click the button below to securely sign in to your ShipOS account. This
        link will expire in 10 minutes.
      </Text>
      <Button style={button} href={url}>
        Sign in now &rarr;
      </Button>
      <Hr style={divider} />
      <Text style={secondary}>
        Or copy and paste this link into your browser:
        <br />
        <Link href={url} style={link}>
          {url}
        </Link>
      </Text>
      <Hr style={divider} />
      <Text style={secondary}>
        If you didn&apos;t request this email, you can safely ignore it. Someone
        might have typed your email address by mistake.
      </Text>
    </EmailLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 16px",
};

const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#1a1a1a",
  margin: "0 0 24px",
};

const button: React.CSSProperties = {
  backgroundColor: "#0f172a",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  borderRadius: "8px",
  padding: "14px 28px",
  textDecoration: "none",
  display: "inline-block",
};

const divider: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const secondary: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: "#6b7280",
  margin: 0,
  wordBreak: "break-all" as const,
};

const link: React.CSSProperties = {
  color: "#3b82f6",
};
