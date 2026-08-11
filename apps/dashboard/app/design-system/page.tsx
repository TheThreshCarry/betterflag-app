import type { Metadata } from "next";

import { DesignSystemGallery } from "@/components/design-system-gallery";

export const metadata: Metadata = {
  title: "Design system — Betterflag",
  description: "Betterflag dashboard component gallery (Appica + DESIGN.md).",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return <DesignSystemGallery />;
}
