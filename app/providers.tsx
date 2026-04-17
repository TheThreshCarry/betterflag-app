"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

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
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Toaster />
      <PostHogProvider bootstrapData={bootstrapData}>
        {children}
      </PostHogProvider>
    </ThemeProvider>
  );
}
