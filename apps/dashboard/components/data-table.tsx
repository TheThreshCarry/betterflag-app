"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@appica/ui-react/table";

import { Skeleton } from "@/components/ui/skeleton";
import { staggerStyle } from "@/lib/stagger";
import { cn } from "@/lib/utils";

/** Matches `.skeleton-out` in globals.css. */
export const SKELETON_OUT_MS = 280;

/**
 * Shared Appica table frame so loading skeleton + loaded table share the same
 * `table-fixed` + `<colgroup>` widths — no column jump when data arrives.
 */
export interface Column {
  /** Stable key + header text. */
  key: string;
  label: string;
  /** Fixed column width (Tailwind class, e.g. "w-[24%]"). Shared by both states. */
  colWidth: string;
  /** Width of the shimmer bar shown while loading (e.g. "w-24"). */
  skeletonWidth?: string;
  /** Cell alignment. */
  align?: "left" | "right";
}

export type SkeletonPhase = "in" | "out" | "done";

function animationsDisabled(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.disableAnimations !== undefined) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Keep skeleton mounted through a fade-out when `loading` flips false,
 * then report `"done"` so callers can mount real rows / empty state.
 */
export function useSkeletonPhase(loading: boolean): SkeletonPhase {
  const [phase, setPhase] = useState<SkeletonPhase>(loading ? "in" : "done");

  useEffect(() => {
    if (loading) {
      setPhase("in");
      return;
    }
    setPhase((current) => {
      if (current === "done") return "done";
      if (animationsDisabled()) return "done";
      return "out";
    });
  }, [loading]);

  useEffect(() => {
    if (phase !== "out") return;
    const timer = window.setTimeout(() => setPhase("done"), SKELETON_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return phase;
}

function SkeletonRows({
  columns,
  rows,
  exiting,
}: {
  columns: readonly Column[];
  rows: number;
  exiting: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <TableRow key={row} className={exiting ? "skeleton-out" : undefined}>
          {columns.map((col) => (
            <TableCell key={col.key}>
              <Skeleton
                className={cn(
                  "h-4",
                  col.skeletonWidth ?? "w-24",
                  col.align === "right" && "ml-auto",
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function DataTable({
  columns,
  children,
  hoverableRows = false,
  caption,
  stagger = true,
  staggerFrom = 0,
  staggerSelf: _staggerSelf = true,
  loading = false,
  skeletonRows = 5,
  empty,
}: {
  columns: readonly Column[];
  children: ReactNode;
  hoverableRows?: boolean;
  caption?: string;
  /** Body rows blur/fade in. Header always paints immediately. Default on. */
  stagger?: boolean;
  /** Offset so page-level <Stagger> can continue the chain into body rows. */
  staggerFrom?: number;
  /** Marker for <Stagger>: continue chain inside instead of animating the table as one block. */
  staggerSelf?: boolean;
  /** When true, body shows skeleton rows. On false, skeleton fades out then data mounts. */
  loading?: boolean;
  skeletonRows?: number;
  /** Rendered instead of the table once loading finishes and this is set. */
  empty?: ReactNode;
}) {
  const phase = useSkeletonPhase(loading);
  const showSkeleton = phase === "in" || phase === "out";

  if (phase === "done" && empty) {
    return <>{empty}</>;
  }

  const staggeredChildren =
    stagger && !showSkeleton
      ? Children.map(children, (child, index) => {
          if (!isValidElement(child)) return child;
          const el = child as ReactElement<{ className?: string; style?: CSSProperties }>;
          return cloneElement(el, {
            className: cn(el.props.className, "stagger-in"),
            style: { ...el.props.style, ...staggerStyle(staggerFrom + index) },
          });
        })
      : children;

  return (
    <Table
      size="md"
      borderStyle="solid"
      // Paint hover on cells (not the <tr>) so corner radius on edge cells
      // isn't covered by a square row background.
      hoverableRows={false}
      className={cn(
        "table-fixed",
        hoverableRows &&
          "[&>tbody>tr:hover>td]:bg-background-subtle [&>tbody>tr:hover>td]:transition-colors",
      )}
    >
      <colgroup>
        {columns.map((col) => (
          <col key={col.key} className={col.colWidth} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(col.align === "right" && "text-end")}
            >
              {col.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody key={showSkeleton ? "skeleton" : "data"}>
        {showSkeleton ? (
          <SkeletonRows
            columns={columns}
            rows={skeletonRows}
            exiting={phase === "out"}
          />
        ) : (
          staggeredChildren
        )}
      </TableBody>
      {caption && !showSkeleton ? (
        <caption
          className={cn(
            "caption-bottom pt-4 text-foreground-muted",
            stagger && "stagger-in",
          )}
          style={
            stagger
              ? staggerStyle(staggerFrom + Children.count(children))
              : undefined
          }
        >
          {caption}
        </caption>
      ) : null}
    </Table>
  );
}

/**
 * Standalone skeleton table. Pass `exiting` (from `useSkeletonPhase`) so rows
 * fade out before unmount. Accepts `staggerSelf` so page-level <Stagger>
 * does not fade the whole frame.
 */
export function DataTableSkeleton({
  columns,
  rows = 5,
  exiting = false,
  staggerSelf: _staggerSelf = true,
  staggerFrom: _staggerFrom,
}: {
  columns: readonly Column[];
  rows?: number;
  /** Fade skeleton rows out (keep mounted until animation ends). */
  exiting?: boolean;
  staggerSelf?: boolean;
  staggerFrom?: number;
}) {
  return (
    <Table size="md" borderStyle="solid" hoverableRows={false} className="table-fixed">
      <colgroup>
        {columns.map((col) => (
          <col key={col.key} className={col.colWidth} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(col.align === "right" && "text-end")}
            >
              {col.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <SkeletonRows columns={columns} rows={rows} exiting={exiting} />
      </TableBody>
    </Table>
  );
}

export { TableRow, TableCell };
