import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { Chip } from "@/components/ui";
import { isAllowedEmail } from "@/lib/allowlist";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";

import { SignOutButton } from "./sign-out-button";

/**
 * Private-alpha holding screen. Signed-in users whose email isn't on the
 * allowlist land here instead of /onboarding. Admitted users and existing
 * org members are bounced straight back to the app.
 */
export default async function WaitlistPage() {
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
  const hasOrg = !!data && data.length > 0;

  if (hasOrg || (await isAllowedEmail(user.email ?? null))) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-8">
      <div className="w-full max-w-md rounded-2xl border border-line bg-canvas p-8">
        <Logo href="https://betterflag.app" size="default" showText />
        <div className="mt-6 flex gap-2">
          <Chip color="orange">Private alpha</Chip>
        </div>
        <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.01em]">
          You&apos;re almost in
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          Betterflag is in private alpha and I&apos;m admitting people from the
          waitlist in waves. Your account{" "}
          <span className="font-medium text-ink">{user.email}</span> is created
          and ready. As soon as you&apos;re admitted, you&apos;ll land straight
          in onboarding the next time you sign in.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          Not on the waitlist yet? Join at{" "}
          <a
            href="https://betterflag.app"
            className="font-medium text-ink underline underline-offset-2"
          >
            betterflag.app
          </a>{" "}
          with this same email. Alpha users get 50% off for life.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <SignOutButton />
          <a
            href="mailto:hi@betterflag.app"
            className="text-[13px] font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            hi@betterflag.app
          </a>
        </div>
      </div>
    </div>
  );
}
