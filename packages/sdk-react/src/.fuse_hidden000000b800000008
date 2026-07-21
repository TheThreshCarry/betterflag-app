import { createContext } from "react";
import type { EvaluationContext, JsonValue, ShipOSClient } from "@shiposapp/sdk";

export interface ShipOSContextValue {
  client: ShipOSClient;
  /** Default evaluation context applied by hooks unless overridden per call. */
  user?: EvaluationContext;
  /** Server-provided initial values by flag key (SSR bootstrap). */
  bootstrap?: Record<string, JsonValue>;
  /** Increments on every config 'update' event. */
  version: number;
}

export const ShipOSContext = createContext<ShipOSContextValue | null>(null);
