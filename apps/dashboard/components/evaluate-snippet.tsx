"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildEvaluateCurl } from "@/lib/evaluate-snippet";
import { toast } from "@/lib/toast";

/**
 * macOS-window curl mockup from onboarding. Dark surface is intentional:
 * DESIGN.md reserves window/terminal dark for mockups only.
 */
export function EvaluateTerminal({
  snippet,
  filename = "evaluate.sh",
}: {
  snippet: string;
  filename?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] shadow-[0_12px_48px_rgba(0,0,0,0.09),0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2 bg-window-dark px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff6058]" />
        <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono text-[12px] text-white/60">{filename}</span>
        <TerminalCopyButton text={snippet} />
      </div>
      <pre className="overflow-x-auto bg-terminal-dark p-5 font-mono text-[12.5px] leading-relaxed text-[#d7dae0]">
        {snippet}
      </pre>
    </div>
  );
}

export function FlagEvaluateCard({
  flagKey,
  envSlug,
  envName,
}: {
  flagKey: string;
  envSlug: string;
  envName: string;
}) {
  const snippet = useMemo(() => buildEvaluateCurl({ flagKey }), [flagKey]);

  return (
    <div className="mt-8 rounded-3xl border border-line bg-surface p-6">
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[16px] font-semibold">Test this feature flag</h2>
          <span className="font-mono text-[12px] text-ink-muted">{envSlug}</span>
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">
          Hit evaluate for <span className="font-mono text-[12px] text-ink">{flagKey}</span> in{" "}
          {envName}. Swap in an SDK key for this environment from{" "}
          <Link href="/keys" className="font-medium text-ink underline underline-offset-2">
            Keys
          </Link>
          .
        </p>
      </div>
      <EvaluateTerminal snippet={snippet} />
    </div>
  );
}

function TerminalCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.copied("Command copied to clipboard");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1600);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied to clipboard" : "Copy command"}
      className={`ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
        copied ? "text-[#28c840]" : "text-white/55 hover:bg-white/10 hover:text-white/90"
      }`}
    >
      <span key={copied ? "check" : "copy"} className="animate-in zoom-in-75 fade-in duration-200">
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path
              d="M1.5 5.5l2.5 2.5 4.5-6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
