import { Suspense } from "react";

import { AuditView } from "@/components/audit-view";
import { AuditListSkeleton } from "@/components/skeletons";

export default function SettingsAuditPage() {
  return (
    <Suspense fallback={<AuditListSkeleton />}>
      <AuditView />
    </Suspense>
  );
}
