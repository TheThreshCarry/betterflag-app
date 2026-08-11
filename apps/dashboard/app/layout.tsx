import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@appica/ui-react/providers/theme-provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { AppToaster } from "@/components/app-toaster";
import { PreferencesProvider } from "@/components/preferences-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DISABLE_ANIMATIONS_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/preferences";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://app.betterflag.app",
  ),
  title: "Betterflag: Feature flags for agentic teams",
  description:
    "Feature flags your agents can ship with. Targeting, percentage rollouts, and instant kill switches via MCP and REST.",
  openGraph: {
    type: "website",
    siteName: "Betterflag",
    title: "Betterflag: Feature flags for agentic teams",
    description:
      "Feature flags your agents can ship with. Targeting, percentage rollouts, and instant kill switches via MCP and REST.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@betterflag",
    title: "Betterflag: Feature flags for agentic teams",
    description:
      "Feature flags your agents can ship with. Targeting, percentage rollouts, and instant kill switches via MCP and REST.",
  },
  icons: {
    icon: "/brand/logo.svg",
    shortcut: "/brand/logo.svg",
    apple: "/brand/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <script
          dangerouslySetInnerHTML={{ __html: DISABLE_ANIMATIONS_SCRIPT }}
        />
        <NuqsAdapter>
          <ThemeProvider
            defaultTheme="system"
            enableSystem
            storageKey={THEME_STORAGE_KEY}
          >
            <PreferencesProvider>
              <AppToaster>
                <TooltipProvider>{children}</TooltipProvider>
              </AppToaster>
            </PreferencesProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
