"use client";

import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import posthog from "posthog-js";

import { authClient } from "@/lib/auth/auth-client";
import {
  PostHogProvider,
  type BootstrapData,
} from "@/components/posthog/posthog-provider";
import { Toaster } from "sonner";

export function Providers({
  children,
  bootstrapData,
}: {
  children: ReactNode;
  bootstrapData: BootstrapData | null;
}) {
  const router = useRouter();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Toaster />
      <AuthUIProvider
        authClient={authClient}
        navigate={router.push}
        replace={router.replace}
        onSessionChange={() => {
          posthog.reset();
          router.refresh();
        }}
        Link={Link}
      >
        <PostHogProvider bootstrapData={bootstrapData}>
          {children}
        </PostHogProvider>
      </AuthUIProvider>
    </ThemeProvider>
  );
}
