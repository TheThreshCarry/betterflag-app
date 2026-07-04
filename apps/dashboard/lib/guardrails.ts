/**
 * Guardrails: org-level rules that force agent-initiated mutations through
 * human approval. They apply ONLY when the actor is an agent key —
 * session users and admin keys execute directly.
 */

import { jsonValueSchema, targetingRulesSchema } from "@shipos/core";
import type { ApprovalRow } from "@shipos/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { unwrap } from "./errors";

export type GuardrailAction = "kill_switch" | "rollout_100" | "promote_prod" | (string & {});

/** Staged config patch replayed via the update_flag_config RPC on approval. */
export const stagedPatchSchema = z.object({
  enabled: z.boolean().optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
  rules: targetingRulesSchema.optional(),
  valueOn: jsonValueSchema.optional(),
  valueOff: jsonValueSchema.optional(),
  clearKill: z.boolean().optional(),
  expectedVersion: z.number().int().optional(),
});

/** The staged mutation stored in approvals.action, replayed on approval. */
export const stagedActionSchema = z.object({
  action: z.enum(["kill_flag", "update_flag_config", "promote"]),
  flagId: z.uuid(),
  flagKey: z.string(),
  projectId: z.uuid(),
  environmentId: z.uuid(),
  envSlug: z.string(),
  patch: stagedPatchSchema.optional(),
  fromEnvSlug: z.string().optional(),
});

export type StagedAction = z.infer<typeof stagedActionSchema>;
export type StagedPatch = z.infer<typeof stagedPatchSchema>;

interface GuardrailMatchRow {
  requires_approval: boolean;
}

/**
 * True when a guardrail row matches (org, environment-or-null, action) with
 * requires_approval. A NULL environment_id guardrail applies to every
 * environment of the org.
 */
export async function checkGuardrail(
  service: SupabaseClient,
  orgId: string,
  environmentId: string | null,
  action: GuardrailAction,
): Promise<boolean> {
  let query = service
    .from("guardrails")
    .select("requires_approval")
    .eq("org_id", orgId)
    .eq("action", action);
  query = environmentId
    ? query.or(`environment_id.is.null,environment_id.eq.${environmentId}`)
    : query.is("environment_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as GuardrailMatchRow[]).some((row) => row.requires_approval);
}

/** Insert a pending approval carrying the staged action; returns the row. */
export async function stageApproval(
  service: SupabaseClient,
  input: {
    orgId: string;
    projectId: string;
    requestedByKey: string;
    action: StagedAction;
  },
): Promise<ApprovalRow> {
  const approval = unwrap(
    await service
      .from("approvals")
      .insert({
        org_id: input.orgId,
        requested_by_key: input.requestedByKey,
        action: input.action,
      })
      .select("*")
      .single(),
  ) as ApprovalRow;

  // Staging itself is auditable: "the agent asked" is part of the story.
  const { error: auditError } = await service.rpc("record_audit", {
    p_org: input.orgId,
    p_project: input.projectId,
    p_actor_type: "agent",
    p_actor_id: null,
    p_actor_key_prefix: input.requestedByKey,
    p_action: "approval.request",
    p_subject: `approval:${approval.id}`,
    p_before: null,
    p_after: input.action,
  });
  if (auditError) throw auditError;

  return approval;
}
