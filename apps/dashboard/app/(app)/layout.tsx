import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createSessionClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell userEmail={user.email ?? null}>{children}</AppShell>;
}
