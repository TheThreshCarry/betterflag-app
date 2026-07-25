import type { CSSProperties } from "react";

/** Stagger step between entrance animations (matches `.stagger-in` in globals.css). */
export const STAGGER_STEP_MS = 120;

/** Cap so long lists / "load more" don't wait forever. */
export const STAGGER_MAX_INDEX = 16;

/**
 * Inline style for `.stagger-in` — header = 0, first row = 1, …
 */
export function staggerStyle(index: number): CSSProperties {
  const capped = Math.min(Math.max(index, 0), STAGGER_MAX_INDEX);
  return { ["--stagger" as string]: capped } as CSSProperties;
}
