"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@appica/ui-react/preview-card";

import { RelativeTime } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

interface FlagVersionEntry {
  version: number;
  action: string;
  summary: string;
  actorType: "user" | "agent";
  actorKeyPrefix: string | null;
  /** Present when actorType is user — resolved from auth.users. */
  actorEmail?: string | null;
  createdAt: string;
}

function actorLabel(entry: FlagVersionEntry): string | null {
  if (entry.actorKeyPrefix) return entry.actorKeyPrefix;
  if (entry.actorType === "user") return entry.actorEmail?.trim() || "human";
  return null;
}

interface FlagVersionsResponse {
  flagKey: string;
  env: string;
  currentVersion: number;
  versions: FlagVersionEntry[];
}

export function VersionHistoryBadge({
  flagId,
  flagKey,
  envSlug,
  version,
  className,
}: {
  flagId: string;
  flagKey: string;
  envSlug: string;
  version: number;
  className?: string;
}) {
  const [versions, setVersions] = useState<FlagVersionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function loadVersions() {
    if (loaded) return;
    setLoaded(true);
    void api<FlagVersionsResponse>(
      `/api/v1/flags/${flagId}/environments/${envSlug}/versions?limit=10`,
    )
      .then((result) => setVersions(result.versions))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load versions");
        setVersions([]);
      });
  }

  return (
    <PreviewCard
      onOpenChange={(open) => {
        if (open) loadVersions();
      }}
    >
      <PreviewCardTrigger
        className={cn(
          "cursor-default rounded-md px-1 py-0.5 font-mono text-[11px] text-ink-muted transition-colors hover:bg-canvas hover:text-ink",
          className,
        )}
        aria-label={`Version ${version}, show history`}
      >
        v{version}
      </PreviewCardTrigger>
      <PreviewCardContent
        arrow={false}
        side="bottom"
        align="start"
        className="w-72 max-w-[min(18rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <div className="border-b border-line px-3.5 py-2.5">
          <p className="text-[12px] font-medium">Version history</p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
            {flagKey} · {envSlug}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto px-1.5 py-1.5">
          {error ? (
            <p className="px-2 py-3 text-[12px] text-ink-muted">{error}</p>
          ) : versions === null ? (
            <div className="space-y-2 px-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-ink-muted">
              No prior versions yet. This is v{version}.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {versions.map((entry) => {
                const current = entry.version === version;
                const who = actorLabel(entry);
                return (
                  <li
                    key={`${entry.version}-${entry.createdAt}`}
                    className={cn(
                      "flex items-start justify-between gap-2 rounded-lg px-2 py-1.5",
                      current && "bg-surface",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] font-medium">
                          v{entry.version}
                        </span>
                        {current ? (
                          <span className="text-[10px] text-ink-muted">current</span>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] text-ink-muted">{entry.summary}</p>
                    </div>
                    <div className="min-w-0 shrink-0 text-right">
                      <p className="text-[11px] text-ink-muted">
                        <RelativeTime iso={entry.createdAt} />
                      </p>
                      {who ? (
                        <p
                          className={cn(
                            "max-w-[9rem] truncate text-[10px] text-ink-muted/80",
                            entry.actorKeyPrefix && "font-mono",
                          )}
                          title={who}
                        >
                          {who}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-line px-2 py-2">
          <Link
            href={`/settings/audit?subject=${encodeURIComponent(`flag:${flagKey}`)}`}
            className="flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface"
          >
            See all versions
          </Link>
        </div>
      </PreviewCardContent>
    </PreviewCard>
  );
}
