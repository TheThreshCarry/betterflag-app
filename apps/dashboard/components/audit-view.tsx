"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@appica/ui-react/table";

import {
  Button,
  Chip,
  EmptyState,
  ErrorNote,
  JsonBlock,
  RelativeTime,
} from "@/components/ui";
import {
  DataTableSkeleton,
  useSkeletonPhase,
  type Column,
} from "@/components/data-table";
import { AuditListSkeleton } from "@/components/skeletons";
import { Stagger } from "@/components/stagger";
import type { ApiAuditEntry } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { staggerStyle } from "@/lib/stagger";
import { cn } from "@/lib/utils";

type Filter = "all" | "user" | "agent";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "user", label: "Humans" },
  { value: "agent", label: "Agents" },
];

const PAGE_SIZE = 50;

const AUDIT_COLUMNS: readonly Column[] = [
  { key: "actor", label: "Actor", colWidth: "w-[16%]", skeletonWidth: "w-20" },
  { key: "action", label: "Action", colWidth: "w-[24%]", skeletonWidth: "w-32" },
  { key: "subject", label: "Subject", colWidth: "w-[44%]", skeletonWidth: "w-48" },
  {
    key: "when",
    label: "When",
    colWidth: "w-[16%]",
    skeletonWidth: "w-16",
    align: "right",
  },
];

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

  const skeletonPhase = useSkeletonPhase(!entries);

  return (
    <Stagger>
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

      {skeletonPhase !== "done" ? (
        <DataTableSkeleton
          columns={AUDIT_COLUMNS}
          rows={5}
          exiting={skeletonPhase === "out"}
          staggerSelf
        />
      ) : entries && entries.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={
            filter === "agent"
              ? "No agent activity yet. Create an agent key and let your agents ship."
              : "Mutations will show up here as they happen."
          }
        />
      ) : entries ? (
        <AuditTable
          staggerSelf
          entries={entries}
          expandedId={expandedId}
          exhausted={exhausted}
          onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
        />
      ) : null}

      {skeletonPhase === "done" && entries && entries.length > 0 && !exhausted ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          {loadingMore ? <AuditListSkeleton rows={3} /> : null}
          <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      ) : null}
    </Stagger>
  );
}

function AuditTable({
  entries,
  expandedId,
  exhausted,
  onToggle,
  staggerFrom = 0,
  staggerSelf: _staggerSelf,
}: {
  entries: ApiAuditEntry[];
  expandedId: number | null;
  exhausted: boolean;
  onToggle: (id: number) => void;
  staggerFrom?: number;
  staggerSelf?: boolean;
}) {
  return (
    <Table
      size="md"
      borderStyle="solid"
      className="[&>tbody>tr:hover>td]:bg-background-subtle [&>tbody>tr:hover>td]:transition-colors"
    >
      <TableHeader>
        <TableRow>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead className="text-end">When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, index) => {
          const expanded = expandedId === entry.id;
          return (
            <Fragment key={entry.id}>
              <TableRow
                highlighted={expanded}
                className={cn("stagger-in cursor-pointer")}
                style={staggerStyle(staggerFrom + index)}
                onClick={() => onToggle(entry.id)}
              >
                <TableCell className="whitespace-nowrap">
                  {entry.actorType === "agent" ? (
                    <Chip color="green" className="px-2! py-0.5! font-mono text-[11px]">
                      agent · {entry.actorKeyPrefix ?? "?"}
                    </Chip>
                  ) : (
                    <Chip color="gray" className="px-2! py-0.5! text-[11px]">
                      human
                    </Chip>
                  )}
                </TableCell>
                <TableCell className="text-foreground-strong font-medium whitespace-nowrap">
                  {entry.action}
                </TableCell>
                <TableCell className="max-w-70 truncate font-mono text-[12px] text-foreground-muted">
                  {entry.subject}
                </TableCell>
                <TableCell className="text-end whitespace-nowrap text-foreground-muted tabular-nums">
                  <RelativeTime iso={entry.createdAt} />
                </TableCell>
              </TableRow>
              {expanded ? (
                <TableRow className="hover:bg-transparent!">
                  <TableCell colSpan={4} className="bg-background-subtle">
                    <div className="grid gap-3 py-1 lg:grid-cols-2">
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-foreground-muted">
                          Before
                        </p>
                        {entry.before !== null ? (
                          <JsonBlock value={entry.before} />
                        ) : (
                          <p className="text-[12px] text-foreground-muted">-</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-foreground-muted">
                          After
                        </p>
                        {entry.after !== null ? (
                          <JsonBlock value={entry.after} />
                        ) : (
                          <p className="text-[12px] text-foreground-muted">-</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
      <TableCaption
        position="bottom"
        className="stagger-in"
        style={staggerStyle(staggerFrom + entries.length)}
      >
        {entries.length} event{entries.length === 1 ? "" : "s"}
        {exhausted ? "" : " · load more below"}
      </TableCaption>
    </Table>
  );
}
