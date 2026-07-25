import type { Metadata } from "next";

import { LostAtSea } from "@/components/lost-at-sea";

export const metadata: Metadata = {
  title: "404 — Lost at sea · ShipOS",
  description: "This page sailed off the map.",
};

export default function NotFound() {
  return <LostAtSea />;
}
