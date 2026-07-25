"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type DiffLineKind = "same" | "add" | "remove";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

function toPrettyJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

/** Line-level LCS diff over pretty-printed JSON. */
export function diffJsonLines(before: unknown, after: unknown): DiffLine[] {
  const a = toPrettyJson(before);
  const b = toPrettyJson(after);
  const aLines = a.length === 0 ? [] : a.split("\n");
  const bLines = b.length === 0 ? [] : b.split("\n");

  const n = aLines.length;
  const m = bLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        aLines[i] === bLines[j]
          ? (dp[i + 1]![j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ kind: "same", text: aLines[i]! });
      i++;
      j++;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      out.push({ kind: "remove", text: aLines[i]! });
      i++;
    } else {
      out.push({ kind: "add", text: bLines[j]! });
      j++;
    }
  }
  while (i < n) {
    out.push({ kind: "remove", text: aLines[i]! });
    i++;
  }
  while (j < m) {
    out.push({ kind: "add", text: bLines[j]! });
    j++;
  }
  return out;
}

const LINE_STYLES: Record<DiffLineKind, string> = {
  same: "text-ink",
  add: "bg-chip-green/10 text-chip-green",
  remove: "bg-chip-pink/10 text-chip-pink",
};

const GUTTER: Record<DiffLineKind, string> = {
  same: " ",
  add: "+",
  remove: "−",
};

export function JsonDiffViewer({
  before,
  after,
  className,
}: {
  before: unknown;
  after: unknown;
  className?: string;
}) {
  const lines = useMemo(() => diffJsonLines(before, after), [before, after]);
  const empty = before == null && after == null;
  const unchanged =
    !empty && lines.length > 0 && lines.every((line) => line.kind === "same");

  if (empty) {
    return (
      <p className="text-[12px] text-ink-muted data-in">No before/after payload.</p>
    );
  }

  if (unchanged) {
    return (
      <div className={cn("data-in", className)}>
        <p className="mb-2 text-[12px] text-ink-muted">No changes in payload.</p>
        <pre className="max-h-72 overflow-auto rounded-xl border border-line bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink">
          {toPrettyJson(after ?? before)}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "data-in max-h-72 overflow-auto rounded-xl border border-line bg-canvas",
        className,
      )}
      role="region"
      aria-label="JSON diff"
    >
      <pre className="min-w-0 p-1 font-mono text-[12px] leading-relaxed">
        {lines.map((line, index) => (
          <div
            key={`${index}-${line.kind}-${line.text.slice(0, 24)}`}
            className={cn(
              "flex gap-2 rounded-lg px-2 py-0.5 whitespace-pre-wrap break-all",
              LINE_STYLES[line.kind],
            )}
          >
            <span
              className="w-3 shrink-0 select-none text-center opacity-70"
              aria-hidden
            >
              {GUTTER[line.kind]}
            </span>
            <span className="min-w-0 flex-1">{line.text || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
