"use client";

import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { FlagConfigRow, FlagRow } from "@betterflag/db";

import {
  toApiFlag,
  toApiFlagConfig,
  type ApiFlag,
  type ApiFlagConfig,
} from "@/lib/api-types";
import { createBrowserSupabase } from "@/lib/supabase/client";

export type FlagChangeEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  flag: ApiFlag | null;
  oldId: string | null;
};

export type FlagConfigChangeEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  config: ApiFlagConfig | null;
  oldId: string | null;
};

function rowId(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return null;
  if (!("id" in row)) return null;
  return typeof row.id === "string" ? row.id : null;
}

export function useFlagRealtime(
  projectId: string | undefined,
  callbacks: {
    onFlag?: (event: FlagChangeEvent) => void;
    onConfig?: (event: FlagConfigChangeEvent) => void;
  },
): void {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!projectId) return;

    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`flags:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "flags",
          filter: `project_id=eq.${projectId}`,
        },
        (payload: RealtimePostgresChangesPayload<FlagRow>) => {
          callbacksRef.current.onFlag?.({
            eventType: payload.eventType,
            flag: rowId(payload.new) ? toApiFlag(payload.new as FlagRow) : null,
            oldId: rowId(payload.old),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "flag_configs",
        },
        (payload: RealtimePostgresChangesPayload<FlagConfigRow>) => {
          callbacksRef.current.onConfig?.({
            eventType: payload.eventType,
            config: rowId(payload.new)
              ? toApiFlagConfig(payload.new as FlagConfigRow)
              : null,
            oldId: rowId(payload.old),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);
}
