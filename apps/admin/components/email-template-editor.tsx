"use client";

import { EmailEditor, type EmailEditorRef } from "@react-email/editor";
import type { EmailTemplateKey, EmailVariable } from "@betterflag/emails";
import { useRef, useState, useTransition } from "react";

import { previewEmailTemplate, saveEmailTemplate } from "@/lib/email-actions";

interface Fields {
  subject: string;
  preview: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  text: string;
}

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-ink/30";
const labelClass = "mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted";

export function EmailTemplateEditor({
  templateKey,
  initial,
  variables,
}: {
  templateKey: EmailTemplateKey;
  initial: Fields;
  variables: EmailVariable[];
}) {
  const editorRef = useRef<EmailEditorRef>(null);
  const [fields, setFields] = useState<Omit<Fields, "bodyHtml">>({
    subject: initial.subject,
    preview: initial.preview,
    eyebrow: initial.eyebrow,
    heading: initial.heading,
    text: initial.text,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof fields>(k: K, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  async function collect(): Promise<Fields> {
    const body = (await editorRef.current?.getEmail()) ?? { html: initial.bodyHtml, text: "" };
    return { ...fields, bodyHtml: body.html };
  }

  function onSave() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const input = { key: templateKey, ...(await collect()) };
      const res = await saveEmailTemplate(input);
      if (res.ok) setStatus("Saved. New sends use this version.");
      else setError(res.error);
    });
  }

  function onPreview() {
    setError(null);
    startTransition(async () => {
      const input = { key: templateKey, ...(await collect()) };
      const res = await previewEmailTemplate(input);
      if (res.ok) setPreviewHtml(res.html);
      else setError(res.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <div className="rounded-3xl border border-line bg-white p-5">
          <label className={labelClass}>Subject</label>
          <input className={inputClass} value={fields.subject} onChange={(e) => set("subject", e.target.value)} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Eyebrow</label>
              <input className={inputClass} value={fields.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Heading</label>
              <input className={inputClass} value={fields.heading} onChange={(e) => set("heading", e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Inbox preview text</label>
            <input className={inputClass} value={fields.preview} onChange={(e) => set("preview", e.target.value)} />
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-white p-5">
          <label className={labelClass}>Body</label>
          <div className="rounded-2xl border border-line">
            <EmailEditor ref={editorRef} content={initial.bodyHtml} theme="basic" />
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-white p-5">
          <label className={labelClass}>Plain-text version</label>
          <textarea
            className={`${inputClass} min-h-[160px] font-mono text-[13px]`}
            value={fields.text}
            onChange={(e) => set("text", e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={pending}
            className="rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {pending ? "Working…" : "Save & publish"}
          </button>
          <button
            onClick={onPreview}
            disabled={pending}
            className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-medium disabled:opacity-50"
          >
            Preview
          </button>
          {status ? <span className="text-[13px] text-[#00875a]">{status}</span> : null}
          {error ? <span className="text-[13px] text-[#e5484d]">{error}</span> : null}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="rounded-3xl border border-line bg-white p-5">
          <p className={labelClass}>Variables</p>
          {variables.length === 0 ? (
            <p className="text-[13px] text-ink-muted">This template has no variables.</p>
          ) : (
            <ul className="space-y-2">
              {variables.map((v) => (
                <li key={v.name} className="text-[13px]">
                  <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono">{`{{${v.name}}}`}</code>
                  <span className="ml-2 text-ink-muted">{v.label}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-ink-muted">
            Type a tag like <code className="font-mono">{"{{orgName}}"}</code> anywhere in the
            subject, heading or body. It's replaced per recipient at send time.
          </p>
        </div>

        {previewHtml ? (
          <div className="rounded-3xl border border-line bg-white p-3">
            <p className={`${labelClass} px-2`}>Preview (sample values)</p>
            <iframe title="preview" srcDoc={previewHtml} className="h-[640px] w-full rounded-2xl border border-line bg-canvas" />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
