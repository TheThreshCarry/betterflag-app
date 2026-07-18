import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding-flow";
import { isAllowedEmail } from "@/lib/allowlist";
import { captureServer } from "@/lib/posthog-server";
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

  // Top of the onboarding funnel: an allowlisted, signed-in user reached the
  // flow. Fires per load; funnels dedupe by person on first occurrence.
  await captureServer({
    distinctId: user.id,
    event: "onboarding_started",
    properties: { email: user.email ?? null },
  });

  return <OnboardingFlow userEmail={user.email ?? null} />;
}
