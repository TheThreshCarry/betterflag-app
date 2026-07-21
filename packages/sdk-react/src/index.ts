export {
  ShipOSProvider,
  type ShipOSProviderProps,
  type ShipOSProviderClientProps,
  type ShipOSProviderKeyProps,
} from "./provider";
export { useFlag, useFlagDetail, useShipOS, type FlagOverrides } from "./hooks";
export { ShipOSContext, type ShipOSContextValue } from "./context";
export {
  createFlagStore,
  type FlagClient,
  type FlagState,
  type FlagStore,
} from "./store";

// Re-export the core client API so server code (RSC, route handlers) can
// import everything from one place.
export {
  createClient,
  ShipOSClient,
  type ShipOSClientOptions,
  type JsonValue,
  type EvaluationContext,
  type EvaluationReason,
  type EvaluationResult,
} from "shipos";
