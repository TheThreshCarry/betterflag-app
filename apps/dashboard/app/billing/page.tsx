import { redirect } from "next/navigation";

import { BillingWall } from "@/components/billing-wall";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * The hard billing wall. AppShell redirects here when the org has no active
 * plan (trial expired, no subscription). Lives OUTSIDE the (app) layout so it
 * renders without the gated shell.
 */
export default async function BillingPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <BillingWall userEmail={user.email ?? null} />;
}
