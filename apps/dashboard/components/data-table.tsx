import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * A single, shared table frame so the loading skeleton and the loaded table
 * are the *same* element structure with the *same* fixed column widths. This
 * is what stops columns from resizing/jumping when data arrives: both states
 * use `table-fixed` + an identical `<colgroup>`, so the browser never has to
 * recompute widths from content.
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

function alignClass(align: Column["align"]): string {
  return align === "right" ? "text-right" : "text-left";
}

export function DataTable({
  columns,
  children,
}: {
  columns: readonly Column[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line">
      <table className="w-full table-fixed text-left text-[14px]">
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} className={col.colWidth} />
          ))}
        </colgroup>
        <thead className="bg-surface text-[12px] text-ink-muted">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 font-medium ${alignClass(col.align)}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * The loading twin of <DataTable>. Same columns → same widths → no resize when
 * the real rows replace it.
 */
export function DataTableSkeleton({
  columns,
  rows = 5,
}: {
  columns: readonly Column[];
  rows?: number;
}) {
  return (
    <DataTable columns={columns}>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row} className="border-t border-line">
          {columns.map((col) => (
            <td key={col.key} className="px-5 py-3.5">
              <Skeleton
                className={`h-4 ${col.skeletonWidth ?? "w-24"} ${
                  col.align === "right" ? "ml-auto" : ""
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </DataTable>
  );
}
