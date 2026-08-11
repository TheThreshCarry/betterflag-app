/**
 * The single branded email shell, as a React Email component. Every Betterflag
 * transactional email is this Layout wrapping an editable body (rich HTML
 * produced by the admin React Email editor). The chrome — brand lockup, white
 * card, eyebrow, heading, footer — is code so branding stays consistent; the
 * body is data so copy is editable at runtime.
 */
import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { FONT, TOKENS } from "./tokens";

export interface EmailLayoutProps {
  /** Hidden inbox preview (preheader) text. */
  preview: string;
  /** Small uppercase tracked label above the heading. */
  eyebrow: string;
  /** Display headline. */
  heading: string;
  /**
   * Editable body as an HTML string (the React Email editor's export). Rendered
   * inside the card. May contain `{{variable}}` merge tags, which are left
   * untouched here and substituted at send time.
   */
  bodyHtml: string;
}

const FOOTER_NOTE =
  "You're getting this because you created a Betterflag account. It's a short 3-email onboarding series, then I'll leave your inbox alone. Reply any time, it lands in my actual inbox.";

/**
 * Org logo slot uses merge tags so the pre-compiled HTML can show a customer
 * logo at send time. Pass `orgLogoDisplay=none` (and empty url) when unset.
 */
export function EmailLayout({ preview, eyebrow, heading, bodyHtml }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, background: TOKENS.canvas, fontFamily: FONT }}>
        <Container style={{ width: "100%", maxWidth: 600, padding: "32px 16px" }}>
          <Section style={{ padding: "0 4px 20px" }}>
            <Row>
              <Column style={{ width: 34 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: TOKENS.badgeDark,
                    color: "#ffffff",
                    fontFamily: FONT,
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: "34px",
                    textAlign: "center",
                  }}
                >
                  S
                </div>
              </Column>
              <Column style={{ paddingLeft: 10 }}>
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: TOKENS.ink,
                  }}
                >
                  Betterflag
                </span>
              </Column>
              <Column style={{ width: 44, paddingLeft: 14, textAlign: "right" }}>
                <Img
                  src="{{orgLogoUrl}}"
                  width={34}
                  height={34}
                  alt=""
                  style={{
                    display: "{{orgLogoDisplay}}",
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    objectFit: "cover",
                    border: `1px solid ${TOKENS.line}`,
                  }}
                />
              </Column>
            </Row>
          </Section>

          <Section
            style={{
              background: "#ffffff",
              border: `1px solid ${TOKENS.line}`,
              borderRadius: 24,
              padding: "40px 36px",
            }}
          >
            <Text
              style={{
                margin: "0 0 12px",
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: TOKENS.orange,
              }}
            >
              {eyebrow}
            </Text>
            <Heading
              as="h1"
              style={{
                margin: "0 0 20px",
                fontFamily: FONT,
                fontSize: 24,
                lineHeight: 1.25,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: TOKENS.ink,
              }}
            >
              {heading}
            </Heading>
            {/* Editable body. Raw HTML from the editor, brand-styled inline. */}
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          <Section style={{ padding: "20px 24px 0" }}>
            <Text style={{ margin: "0 0 6px", fontFamily: FONT, fontSize: 12, lineHeight: 1.6, color: TOKENS.muted }}>
              {FOOTER_NOTE}
            </Text>
            <Text style={{ margin: 0, fontFamily: FONT, fontSize: 12, lineHeight: 1.6, color: TOKENS.faint }}>
              Betterflag · Feature flags with no seat tax and no MAU bill.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
