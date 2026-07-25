import { Skeleton } from "@/components/ui/skeleton";

// Table loading states now live in <DataTableSkeleton> (components/data-table.tsx)
// so the skeleton and the loaded table share one fixed-width frame and never
// resize on load.

export function AuditListSkeleton({ rows = 8 }: { rows?: number }) {
  // Mirrors the loaded audit row exactly: chip · fixed-width action · flexible
  // subject · right-aligned time. Matching the flex layout (not just widths)
  // keeps the timestamp from jumping to the right edge when data loads.
  return (
    <div className="overflow-hidden rounded-3xl border border-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0"
        >
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-44 shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-4 w-14 shrink-0" />
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
            <div key={i} className="rounded-2xl border border-line bg-canvas p-4">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-24" />
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-canvas">
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

// The first-load shell now lives in <AppShellLoading> (components/app-shell-loading.tsx),
// which renders the real sidebar chrome instead of a full-page blank skeleton.

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
