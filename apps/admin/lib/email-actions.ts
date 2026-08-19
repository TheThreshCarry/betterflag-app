"use server";

/**
 * Super-admin email-template mutations. The admin edits the source fields
 * (subject, headings, body HTML with {{merge tags}}); on save we re-render the
 * branded <EmailLayout/> via @betterflag/emails into compiled_html, which is what
 * the workers send after substituting variables. Every action re-checks
 * requireAdmin().
 */

import { compileTemplate, fillTemplate, TEMPLATE_SEEDS, type EmailTemplateKey } from "@betterflag/emails";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "./admin-auth";
import { logAdminAction } from "./observability";
import { createServiceClient } from "./supabase/server";

export interface EmailTemplateInput {
  key: EmailTemplateKey;
  subject: string;
  preview: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  text: string;
}

export type EmailActionResult = { ok: true } | { ok: false; error: string };

function failure(err: unknown): EmailActionResult {
  const message = err instanceof Error ? err.message : String(err);
  void logAdminAction("email.template", { outcome: "error", error: message });
  return { ok: false, error: message };
}

/** Save an edited template: re-compile the layout, upsert, bump version. */
export async function saveEmailTemplate(input: EmailTemplateInput): Promise<EmailActionResult> {
  try {
    const admin = await requireAdmin();
    const { html } = await compileTemplate(input);
    const service = createServiceClient();

    const { data: existing } = await service
      .from("email_templates")
      .select("version")
      .eq("key", input.key)
      .maybeSingle();
    const nextVersion = ((existing?.version as number | undefined) ?? 0) + 1;

    const { error } = await service
      .from("email_templates")
      .update({
        subject: input.subject,
        preview: input.preview,
        eyebrow: input.eyebrow,
        heading: input.heading,
        body_html: input.bodyHtml,
        text: input.text,
        compiled_html: html,
        version: nextVersion,
        updated_by: admin.email,
        updated_at: new Date().toISOString(),
      })
      .eq("key", input.key);
    if (error) throw new Error(error.message);

    revalidatePath(`/emails/${input.key}`);
    revalidatePath("/emails");
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Compile + fill a draft with sample variable values for the live preview,
 * without persisting. Returns the full send-ready HTML.
 */
export async function previewEmailTemplate(input: EmailTemplateInput): Promise<
  { ok: true; html: string; subject: string } | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const seed = TEMPLATE_SEEDS[input.key];
    const sampleVars = Object.fromEntries((seed?.variables ?? []).map((v) => [v.name, v.sample]));
    const compiled = await compileTemplate(input);
    const filled = fillTemplate(
      { subject: compiled.subject, html: compiled.html, text: compiled.text },
      sampleVars,
    );
    return { ok: true, html: filled.html, subject: filled.subject };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
