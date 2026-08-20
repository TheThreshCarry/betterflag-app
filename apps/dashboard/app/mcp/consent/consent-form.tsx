"use client";

/**
 * Native form so Approve actually submits. The Appica Button wrapper defaults
 * to type="button" and does not reliably forward formAction, so clicks no-op.
 */
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ConsentOrg } from "@/lib/mcp-oauth";

import { approveConsent, denyConsent } from "./actions";

function Submit({
  children,
  formAction,
  variant,
  disabled,
}: {
  children: string;
  formAction: (data: FormData) => Promise<void>;
  variant: "primary" | "ghost";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const className =
    variant === "primary"
      ? "flex-1 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-canvas disabled:opacity-50"
      : "flex-1 rounded-xl px-4 py-2.5 text-[14px] font-medium text-ink-muted disabled:opacity-50";
  return (
    <button type="submit" formAction={formAction} disabled={pending || disabled} className={className}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function ConsentForm({
  txnId,
  clientName,
  orgs,
}: {
  txnId: string;
  clientName: string;
  orgs: ConsentOrg[];
}) {
  const allIds = useMemo(() => orgs.map((org) => org.id), [orgs]);
  const [selected, setSelected] = useState<string[]>(allIds);
  const allSelected = selected.length === orgs.length && orgs.length > 0;

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? (current.includes(id) ? current : [...current, id]) : current.filter((item) => item !== id),
    );
  }

  return (
    <form className="mt-6">
      <input type="hidden" name="txnId" value={txnId} />
      <input type="hidden" name="clientName" value={clientName} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">Give access to organizations</legend>
        {orgs.length > 1 ? (
          <label className="mb-2 flex cursor-pointer items-center gap-3 px-1 py-1 text-[13px] text-ink-muted">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => setSelected(event.target.checked ? allIds : [])}
              className="size-4 accent-accent"
            />
            Select all
          </label>
        ) : null}
        <div className="space-y-2">
          {orgs.map((org) => (
            <label
              key={org.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3 transition-colors hover:border-line-strong has-[:checked]:border-accent"
            >
              <input
                type="checkbox"
                name="orgId"
                value={org.id}
                checked={selected.includes(org.id)}
                onChange={(event) => toggle(org.id, event.target.checked)}
                className="size-4 accent-accent"
              />
              <span className="flex-1 text-[14px] font-medium text-ink">{org.name}</span>
                  <span className="text-[12px] capitalize text-ink-muted">{org.plan}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
        Approving creates a dedicated agent key per selected organization (they do not count
        against your plan&apos;s agent-key limit). Revoke any of them on the Keys page to disconnect.
      </p>

      <div className="mt-6 flex gap-3">
        <Submit formAction={approveConsent} variant="primary" disabled={selected.length === 0}>
          Approve
        </Submit>
        <Submit formAction={denyConsent} variant="ghost">
          Deny
        </Submit>
      </div>
    </form>
  );
}
