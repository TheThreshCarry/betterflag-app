import { createContext } from "react";
import type { EvaluationContext, JsonValue, BetterFlagClient } from "@betterflag/sdk";

export interface BetterFlagContextValue {
  client: BetterFlagClient;
  /** Default evaluation context applied by hooks unless overridden per call. */
  user?: EvaluationContext;
  /** Server-provided initial values by flag key (SSR bootstrap). */
  bootstrap?: Record<string, JsonValue>;
  /** Increments on every config 'update' event. */
  version: number;
}

export const BetterFlagContext = createContext<BetterFlagContextValue | null>(null);
