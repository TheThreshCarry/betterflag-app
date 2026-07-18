import { redirect } from "next/navigation";

import { AccessDenied } from "@/components/access-denied";
import { AdminShell } from "@/components/admin-shell";
import { isAdminEmail } from "@/lib/admin-auth";
import { createSessionClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminEmail(user.email)) {
    return <AccessDenied email={user.email ?? "unknown"} />;
  }

  return <AdminShell userEmail={user.email ?? ""}>{children}</AdminShell>;
}
