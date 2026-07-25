"use client";

import { useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@appica/ui-react/hooks/use-theme";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const VIEW_TRANSITION_MS = 780;
/** Softens the hard clip-path edge while the circle expands. */
const EDGE_BLUR_PX = 14;

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-disable-animations")
  );
}

/**
 * Animated light/dark toggle for the user menu.
 * Sun/moon morph + circular View Transition reveal when supported.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme, mounted } = useTheme();
  const itemRef = useRef<HTMLElement | null>(null);
  const isDark = resolvedTheme === "dark";
  const nextLabel = isDark ? "Light mode" : "Dark mode";

  const toggle = useCallback(() => {
    if (!mounted) return;
    const next = isDark ? "light" : "dark";
    const el = itemRef.current;

    const apply = () => {
      flushSync(() => setTheme(next));
    };

    if (
      !el ||
      prefersReducedMotion() ||
      typeof document.startViewTransition !== "function"
    ) {
      apply();
      return;
    }

    const { top, left, width, height } = el.getBoundingClientRect();
    const x = (left + width / 2) * 1.1;
    const y = (top + height / 2) * 1.1;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const root = document.documentElement;
    root.dataset.themeTransition = "";

    const cleanup = () => {
      delete root.dataset.themeTransition;
    };

    const transition = document.startViewTransition(apply);
    transition.finished.finally(cleanup).catch(cleanup);

    transition.ready
      .then(() => {
        // clip-path interpolates reliably; mask-image gradients do not (stuck circle).
        // Blur softens the hard clip edge, then clears as the reveal finishes.
        root.animate(
          [
            {
              clipPath: `circle(0px at ${x}px ${y}px)`,
              filter: `blur(${EDGE_BLUR_PX}px)`,
            },
            {
              clipPath: `circle(${maxRadius * 0.55}px at ${x}px ${y}px)`,
              filter: `blur(${EDGE_BLUR_PX}px)`,
              offset: 0.55,
            },
            {
              clipPath: `circle(${maxRadius}px at ${x}px ${y}px)`,
              filter: "blur(0px)",
            },
          ],
          {
            duration: VIEW_TRANSITION_MS,
            easing: "ease-in-out",
            fill: "forwards",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {});
  }, [isDark, mounted, setTheme]);

  return (
    <DropdownMenuItem
      ref={itemRef}
      closeOnClick={false}
      disabled={!mounted}
      onClick={toggle}
      className={cn(className)}
      aria-label={nextLabel}
    >
      <span className="relative size-4 shrink-0" aria-hidden>
        <SunIcon
          className={cn(
            "absolute inset-0 size-4 transition-all duration-300 ease-out",
            isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
        />
        <MoonIcon
          className={cn(
            "absolute inset-0 size-4 transition-all duration-300 ease-out",
            isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0",
          )}
        />
      </span>
      {nextLabel}
    </DropdownMenuItem>
  );
}
