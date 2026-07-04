import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding-flow";
import { createSessionClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <OnboardingFlow />;
}
