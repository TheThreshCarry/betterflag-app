import {
  createClient,
  type EvaluationContext,
  type JsonValue,
  type ShipOSClient,
} from "@shiposapp/sdk";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ShipOSContext, type ShipOSContextValue } from "./context";

interface ShipOSProviderBaseProps {
  /** Default evaluation context for all hooks under this provider. */
  user?: EvaluationContext;
  /**
   * Initial values by flag key, rendered on the server AND on the first
   * client render (hydration-safe). Typically produced in an RSC via
   * `client.allFlags()` from `@shiposapp/sdk`.
   */
  bootstrap?: Record<string, JsonValue>;
  children?: ReactNode;
}

/** Bring your own client, the provider will NOT close it on unmount. */
export interface ShipOSProviderClientProps extends ShipOSProviderBaseProps {
  client: ShipOSClient;
}

/** Let the provider create (and own) the client, closed on unmount. */
export interface ShipOSProviderKeyProps extends ShipOSProviderBaseProps {
  clientKey: string;
  baseUrl?: string;
  defaults?: Record<string, JsonValue>;
  refreshInterval?: number;
}

export type ShipOSProviderProps = ShipOSProviderClientProps | ShipOSProviderKeyProps;

export function ShipOSProvider(props: ShipOSProviderProps) {
  const owned = useRef<ShipOSClient | null>(null);

  let client: ShipOSClient;
  if ("client" in props) {
    client = props.client;
  } else {
    if (owned.current === null) {
      owned.current = createClient({
        key: props.clientKey,
        baseUrl: props.baseUrl,
        defaults: props.defaults,
        refreshInterval: props.refreshInterval,
      });
    }
    client = owned.current;
  }

  // Close on unmount ONLY when this provider created the client; a
  // caller-supplied client's lifecycle belongs to the caller.
  useEffect(() => {
    return () => {
      owned.current?.close();
      owned.current = null;
    };
  }, []);

  // Bump a version on every config change so context consumers that read
  // it re-render; flag stores also listen to 'update' directly.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return client.on("update", () => setVersion((v) => v + 1));
  }, [client]);

  const value = useMemo<ShipOSContextValue>(
    () => ({ client, user: props.user, bootstrap: props.bootstrap, version }),
    [client, props.user, props.bootstrap, version],
  );

  return <ShipOSContext.Provider value={value}>{props.children}</ShipOSContext.Provider>;
}
