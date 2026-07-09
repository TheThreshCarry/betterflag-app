import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding-flow";
import { isAllowedEmail } from "@/lib/allowlist";
import { createSessionClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Private alpha: only allowlisted emails may onboard.
  if (!(await isAllowedEmail(user.email ?? null))) {
    redirect("/waitlist");
  }

  return <OnboardingFlow userEmail={user.email ?? null} />;
}
