/**
 * Render an editable template into email-ready HTML by wrapping its body in the
 * branded <EmailLayout/> React Email component. Node-side only (pulls in
 * react-dom/server via @react-email/render) — used by the admin preview + save
 * path and the seed script, NEVER by the Cloudflare Workers (they read the
 * pre-compiled HTML from the DB and only substitute variables). Merge tags are
 * preserved so the same compiled HTML serves every recipient.
 */
import { render } from "@react-email/render";
import * as React from "react";

import { EmailLayout } from "./layout";
import type { EmailTemplateSeed } from "./templates";

export interface RenderableTemplate {
  preview: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
}

/** Compile a template's editable fields into full email HTML (tags intact). */
export async function renderTemplateHtml(input: RenderableTemplate): Promise<string> {
  return render(
    React.createElement(EmailLayout, {
      preview: input.preview,
      eyebrow: input.eyebrow,
      heading: input.heading,
      bodyHtml: input.bodyHtml,
    }),
  );
}

export interface CompiledTemplate {
  subject: string;
  /** Full HTML with `{{variable}}` tags intact. */
  html: string;
  /** Plain-text with `{{variable}}` tags intact. */
  text: string;
}

/** Compile a seed (or a DB row shaped like one) to storable subject/html/text. */
export async function compileTemplate(
  input: Pick<
    EmailTemplateSeed,
    "subject" | "preview" | "eyebrow" | "heading" | "bodyHtml" | "text"
  >,
): Promise<CompiledTemplate> {
  const html = await renderTemplateHtml(input);
  return { subject: input.subject, html, text: input.text };
}
