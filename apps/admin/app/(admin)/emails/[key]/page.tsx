import { TEMPLATE_SEEDS, type EmailTemplateKey, type EmailVariable } from "@betterflag/emails";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmailTemplateEditor } from "@/components/email-template-editor";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface TemplateRow {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  preview: string;
  eyebrow: string;
  heading: string;
  body_html: string;
  text: string;
  variables: EmailVariable[];
}

export default async function EmailTemplatePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const service = createServiceClient();
  const { data } = await service
    .from("email_templates")
    .select("key,name,description,subject,preview,eyebrow,heading,body_html,text,variables")
    .eq("key", key)
    .maybeSingle();

  if (!data) notFound();
  const row = data as TemplateRow;
  // Prefer the DB row's declared variables; fall back to the seed's spec.
  const variables =
    row.variables?.length > 0 ? row.variables : (TEMPLATE_SEEDS[row.key]?.variables ?? []);

  return (
    <div className="data-in mx-auto max-w-6xl">
      <header className="mb-6">
        <Link href="/emails" className="text-[13px] text-ink-muted hover:underline">
          ← Emails
        </Link>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">{row.name}</h1>
        <p className="mt-1 text-[14px] text-ink-muted">{row.description}</p>
      </header>

      <EmailTemplateEditor
        templateKey={row.key}
        initial={{
          subject: row.subject,
          preview: row.preview,
          eyebrow: row.eyebrow,
          heading: row.heading,
          bodyHtml: row.body_html,
          text: row.text,
        }}
        variables={variables}
      />
    </div>
  );
}
