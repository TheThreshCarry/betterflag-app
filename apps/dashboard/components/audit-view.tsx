"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Button,
  Chip,
  EmptyState,
  ErrorNote,
  JsonBlock,
  RelativeTime,
} from "@/components/ui";
import { AuditListSkeleton } from "@/components/skeletons";
import type { ApiAuditEntry } from "@/lib/api-types";
import { api } from "@/lib/client-api";

type Filter = "all" | "user" | "agent";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "user", label: "Humans" },
  { value: "agent", label: "Agents" },
];

const PAGE_SIZE = 50;

export function AuditView() {
  const [filter, setFilter] = useState<Filter>("all");
  const [entries, setEntries] = useState<ApiAuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const fetchPage = useCallback(
    async (before?: string): Promise<ApiAuditEntry[]> => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (filter !== "all") params.set("actorType", filter);
      if (before) params.set("before", before);
      const { entries: page } = await api<{ entries: ApiAuditEntry[] }>(
        `/api/v1/audit?${params.toString()}`,
      );
      return page;
    },
    [filter],
  );

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setExhausted(false);
    setExpandedId(null);
    void fetchPage()
      .then((page) => {
        if (cancelled) return;
        setEntries(page);
        setExhausted(page.length < PAGE_SIZE);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load audit log");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  async function loadMore() {
    if (!entries || entries.length === 0) return;
    setLoadingMore(true);
    try {
      const last = entries[entries.length - 1];
      const page = await fetchPage(last?.createdAt);
      setEntries([...entries, ...page]);
      setExhausted(page.length < PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Audit log</h1>
          <p className="mt-0.5 text-[14px] text-ink-muted">
            Every mutation, human or machine, in one trail.
          </p>
        </div>
        <div className="flex rounded-2xl border border-line p-1">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-xl px-4 py-1.5 text-[13px] font-medium transition-colors ${
                filter === option.value ? "bg-ink text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorNote message={error} />

      {!entries ? (
        <AuditListSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={
            filter === "agent"
              ? "No agent activity yet. Create an agent key and let your agents ship."
              : "Mutations will show up here as they happen."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line">
          {entries.map((entry) => {
            const expanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface/60"
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                >
                  {entry.actorType === "agent" ? (
                    <Chip color="green" className="!px-2 !py-0.5 font-mono text-[11px]">
                      agent · {entry.actorKeyPrefix ?? "?"}
                    </Chip>
                  ) : (
                    <Chip color="gray" className="!px-2 !py-0.5 text-[11px]">
                      human
                    </Chip>
                  )}
                  <span className="w-44 shrink-0 text-[13px] font-medium">{entry.action}</span>
                  <span className="flex-1 truncate font-mono text-[12px] text-ink-muted">
                    {entry.subject}
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-muted">
                    <RelativeTime iso={entry.createdAt} />
                  </span>
                </button>
                {expanded ? (
                  <div className="grid gap-3 bg-surface/60 px-5 py-4 lg:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium text-ink-muted">Before</p>
                      {entry.before !== null ? (
                        <JsonBlock value={entry.before} />
                      ) : (
                        <p className="text-[12px] text-ink-muted">-</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium text-ink-muted">After</p>
                      {entry.after !== null ? (
                        <JsonBlock value={entry.after} />
                      ) : (
                        <p className="text-[12px] text-ink-muted">-</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {entries && entries.length > 0 && !exhausted ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          {loadingMore ? <AuditListSkeleton rows={3} /> : null}
          <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
