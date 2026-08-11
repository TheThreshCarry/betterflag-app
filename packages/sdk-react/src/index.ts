export {
  BetterFlagProvider,
  type BetterFlagProviderProps,
  type BetterFlagProviderClientProps,
  type BetterFlagProviderKeyProps,
} from "./provider";
export { useFlag, useFlagDetail, useBetterFlag, type FlagOverrides } from "./hooks";
export { BetterFlagContext, type BetterFlagContextValue } from "./context";
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
  BetterFlagClient,
  type BetterFlagClientOptions,
  type JsonValue,
  type EvaluationContext,
  type EvaluationReason,
  type EvaluationResult,
} from "@betterflag/sdk";
