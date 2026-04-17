import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const LOGO_URL = "https://shipos.app/logo.png";

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img
              src={LOGO_URL}
              width="120"
              height="120"
              alt="ShipOS"
              style={logo}
            />
          </Section>
          <Section style={card}>{children}</Section>
          <Text style={footer}>
            &copy; {new Date().getFullYear()} ShipOS. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily:
    "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "40px 20px",
};

const logoSection: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: "20px",
};

const logo: React.CSSProperties = {
  borderRadius: "12%",
  margin: "0 auto",
};

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "32px",
};

const footer: React.CSSProperties = {
  textAlign: "center" as const,
  fontSize: "12px",
  color: "#9ca3af",
  paddingTop: "24px",
};
