import { redirect } from "next/navigation";

import { createServiceClient, createSessionClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const { data } = await service
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1);

  if (!data || data.length === 0) {
    redirect("/onboarding");
  }

  redirect("/flags");
}
