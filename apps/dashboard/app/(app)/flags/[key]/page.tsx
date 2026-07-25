import { Suspense } from "react";

import { FlagDetail } from "@/components/flag-detail";
import { FlagDetailSkeleton } from "@/components/skeletons";

export default async function FlagDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return (
    <Suspense fallback={<FlagDetailSkeleton />}>
      <FlagDetail flagKey={key} />
    </Suspense>
  );
}
