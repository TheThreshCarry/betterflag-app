"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { Button, Chip } from "@/components/ui";

const JOKES = [
  "This route walked the plank.",
  "404: coordinates not found. Even the compass gave up.",
  "Ye be lost, matey. This page sailed off the map.",
  "Betterflag? More like Ship-Oh-No.",
  "Captain: we hit a 404. Crew: is that worse than a reef?",
  "All hands on deck — except this page. It jumped ship.",
  "Arrr you looking for something? Wrong latitude.",
  "Our flags are feature flags. This one's just missing.",
  "Dead reckoning says this URL never existed.",
  "First mate checked the logs. Page not in the cargo hold.",
  "Abandoned ship. Please return to port.",
  "No treasure here — just empty ocean.",
  "We asked Neptune. He said 404.",
  "X marks the spot. Spot not found.",
  "Man overboard? More like route overboard.",
  "This page is swimming with the fishes.",
  "Lost at C:/sea.",
  "Keel-hauled by a bad path.",
  "The crow's nest saw nothing but 404s.",
  "Shiver me payloads — this endpoint be gone.",
  "Hoist the sails… wait, hoist the homepage.",
  "Batten down the hatches. The map ends here.",
  "Pirate tip: if the URL looks fishy, it probably is.",
  "We rolled a kill switch on this page. Permanently.",
];

export function LostAtSea() {
  const [joke, setJoke] = useState("This page sailed off the map.");

  useEffect(() => {
    setJoke(JOKES[Math.floor(Math.random() * JOKES.length)]!);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center data-in">
        <Chip color="orange">404</Chip>

        <div className="mt-8">
          <Logo href="/" size="xl" />
        </div>

        <h1 className="mt-8 text-[28px] font-semibold tracking-[-0.01em] text-ink">
          Lost at sea
        </h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-muted">
          {joke}
        </p>

        <Link href="/" className="mt-8">
          <Button>Back to port</Button>
        </Link>
      </div>
    </div>
  );
}
