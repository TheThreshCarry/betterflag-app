import { Skeleton } from "@/components/ui/skeleton";

function TableSkeleton({
  columns,
  rows = 5,
}: {
  columns: { label: string; width?: string }[];
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line">
      <table className="w-full text-left text-[14px]">
        <thead className="bg-surface text-[12px] text-ink-muted">
          <tr>
            {columns.map((col) => (
              <th key={col.label} className="px-5 py-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row} className="border-t border-line">
              {columns.map((col) => (
                <td key={col.label} className="px-5 py-3.5">
                  <Skeleton className={`h-4 ${col.width ?? "w-24"}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FlagsTableSkeleton() {
  return (
    <TableSkeleton
      columns={[
        { label: "Key", width: "w-28" },
        { label: "Name", width: "w-32" },
        { label: "Kind", width: "w-16" },
        { label: "Environments", width: "w-40" },
        { label: "Updated", width: "w-16" },
      ]}
    />
  );
}

export function KeysTableSkeleton() {
  return (
    <TableSkeleton
      columns={[
        { label: "Key", width: "w-20" },
        { label: "Name", width: "w-28" },
        { label: "Kind", width: "w-14" },
        { label: "Scope", width: "w-24" },
        { label: "Last used", width: "w-16" },
        { label: "Created", width: "w-16" },
        { label: "", width: "w-12" },
      ]}
    />
  );
}

export function AuditListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0"
        >
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

export function ApprovalsListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-line bg-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-5 w-64" />
              </div>
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Skeleton className="h-10 w-36 rounded-2xl" />
              <Skeleton className="h-10 w-36 rounded-2xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 max-w-sm space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="rounded-3xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white p-4">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-24" />
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UsageSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-3xl border border-line bg-surface p-6 lg:col-span-2">
        <div className="mb-4 flex items-baseline justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="mt-2 flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="space-y-6">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-3 h-9 w-24" />
          <Skeleton className="mt-2 h-4 w-44" />
          <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <div className="rounded-3xl border border-line bg-surface p-6">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-4 h-9 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function FlagDetailSkeleton() {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[13px]">
        <span className="text-ink-muted">Flags</span>
        <span className="text-ink-muted">/</span>
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-2xl" />
          <Skeleton className="h-8 w-20 rounded-2xl" />
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: 1 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <Skeleton className="mt-4 h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface p-4">
        <Skeleton className="mb-4 h-6 w-20" />
        <Skeleton className="mb-2 h-12 w-full rounded-lg" />
        <div className="mb-4 flex gap-1">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
        <div className="flex-1 space-y-1 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </aside>
      <div className="flex-1">
        <Skeleton className="h-14 w-full border-b border-line" />
        <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

export function OnboardingResumeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-2xl" />
      </div>
    </div>
  );
}
