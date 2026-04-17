import { Hr, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./layout";

type OTPType = "sign-in" | "email-verification" | "forget-password";

interface OTPEmailProps {
  otp: string;
  type: OTPType;
}

const config: Record<OTPType, { heading: string; intro: string; preview: string; codeColor: string }> = {
  "sign-in": {
    heading: "Your sign-in code",
    intro: "Use the following code to sign in to your ShipOS account. This code will expire in 5 minutes.",
    preview: "Your ShipOS sign-in code",
    codeColor: "#0f172a",
  },
  "email-verification": {
    heading: "Verify your email",
    intro: "You're almost there. Enter this code to verify your email address and complete your signup.",
    preview: "Your ShipOS verification code",
    codeColor: "#10b981",
  },
  "forget-password": {
    heading: "Reset your password",
    intro: "We received a request to reset your ShipOS password. Use the code below to set a new password.",
    preview: "Your ShipOS password reset code",
    codeColor: "#f59e0b",
  },
};

export function OTPEmail({ otp, type }: OTPEmailProps) {
  const { heading, intro, preview, codeColor } = config[type];

  return (
    <EmailLayout preview={`${preview}: ${otp}`}>
      <Text style={headingStyle}>{heading}</Text>
      <Text style={paragraph}>
        Hi there,
        <br />
        <br />
        {intro}
      </Text>
      <Text style={{ ...codeContainer, textAlign: "center" as const }}>
        <span
          style={{
            display: "inline-block",
            backgroundColor: codeColor,
            color: "#ffffff",
            fontSize: "32px",
            fontWeight: 700,
            letterSpacing: "8px",
            padding: "16px 32px",
            borderRadius: "12px",
            fontFamily: "'SF Mono', Monaco, 'Courier New', monospace",
          }}
        >
          {otp}
        </span>
      </Text>
      <Hr style={divider} />
      <Text style={secondary}>
        {type === "forget-password" ? (
          <>
            <strong>Didn&apos;t request this?</strong>
            <br />
            If you didn&apos;t request a password reset, your account may be at
            risk. We recommend updating your password immediately.
          </>
        ) : (
          <>
            Never share this code with anyone. ShipOS will never ask you for
            this code via phone or chat.
            <br />
            <br />
            If you didn&apos;t request this code, you can safely ignore this
            email.
          </>
        )}
      </Text>
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
};

const codeContainer: React.CSSProperties = {
  margin: "0 0 24px",
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
};
