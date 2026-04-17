import { Button, Hr, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./layout";

type VerificationType = "email-verification" | "password-reset";

interface VerificationEmailProps {
  url: string;
  type: VerificationType;
}

const config: Record<
  VerificationType,
  { heading: string; intro: string; preview: string; cta: string; buttonColor: string }
> = {
  "email-verification": {
    heading: "Welcome to ShipOS!",
    intro:
      "Thanks for signing up! You're just one click away from shipping faster than ever before.\n\nClick the button below to verify your email address and activate your account.",
    preview: "Click here to verify your email and get started with ShipOS",
    cta: "Verify my email \u2192",
    buttonColor: "#10b981",
  },
  "password-reset": {
    heading: "Reset your password",
    intro:
      "We received a request to reset the password for your ShipOS account. Click the button below to choose a new password.",
    preview: "Click here to reset your ShipOS password",
    cta: "Reset password \u2192",
    buttonColor: "#0f172a",
  },
};

export function VerificationEmail({ url, type }: VerificationEmailProps) {
  const { heading, intro, preview, cta, buttonColor } = config[type];
  const isVerification = type === "email-verification";

  return (
    <EmailLayout preview={preview}>
      <Text style={headingStyle}>{heading}</Text>
      <Text style={paragraph}>{intro}</Text>
      <Button style={{ ...button, backgroundColor: buttonColor }} href={url}>
        {cta}
      </Button>
      {type === "password-reset" && (
        <Text style={expiry}>This link expires in 1 hour for security reasons.</Text>
      )}
      <Hr style={divider} />
      <Text style={secondary}>
        Or copy and paste this link into your browser:
        <br />
        <Link href={url} style={link}>
          {url}
        </Link>
      </Text>
      <Hr style={divider} />
      {isVerification ? (
        <Text style={secondary}>
          If you didn&apos;t create a ShipOS account, please ignore this email.
        </Text>
      ) : (
        <Text style={secondary}>
          If you didn&apos;t request a password reset, someone may have typed
          your email by mistake. You can safely ignore this email — your password
          will remain unchanged.
          <br />
          <br />
          If you&apos;re concerned about your account security, please contact us
          at{" "}
          <Link href="mailto:support@shipos.app" style={link}>
            support@shipos.app
          </Link>
        </Text>
      )}
    </EmailLayout>
  );
}

const headingStyle: React.CSSProperties = {
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
  whiteSpace: "pre-line",
};

const button: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  borderRadius: "8px",
  padding: "14px 28px",
  textDecoration: "none",
  display: "inline-block",
};

const expiry: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "8px 0 0",
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
