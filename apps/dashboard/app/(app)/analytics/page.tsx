import { Suspense } from "react";

import { AnalyticsView } from "@/components/analytics-view";
import { Skeleton } from "@/components/ui/skeleton";

function AnalyticsFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded-3xl" />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsFallback />}>
      <AnalyticsView />
    </Suspense>
  );
}
