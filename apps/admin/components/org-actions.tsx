"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Dialog, ErrorNote, Field, inputClass } from "@/components/ui";
import { deleteOrg, freezeOrg, unfreezeOrg } from "@/lib/actions";

export function OrgActions({
  orgId,
  orgName,
  frozen,
}: {
  orgId: string;
  orgName: string;
  frozen: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"freeze" | "delete" | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDialog(null);
      setConfirmName("");
      if (done) done();
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {frozen ? (
        <Button variant="secondary" disabled={pending} onClick={() => run(() => unfreezeOrg(orgId))}>
          Unfreeze organization
        </Button>
      ) : (
        <Button variant="secondary" disabled={pending} onClick={() => setDialog("freeze")}>
          Freeze organization
        </Button>
      )}
      <Button variant="danger" disabled={pending} onClick={() => setDialog("delete")}>
        Delete organization
      </Button>
      {dialog === null ? <ErrorNote message={error} /> : null}

      <Dialog open={dialog === "freeze"} onClose={() => setDialog(null)} title="Freeze this organization?">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-ink-muted">
            Freezing {orgName} blocks every control-plane write (dashboard, REST API, MCP) until
            unfrozen. Flags keep serving at the edge, so their production apps stay up.
          </p>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button disabled={pending} onClick={() => run(() => freezeOrg(orgId))}>
              {pending ? "Freezing…" : "Freeze"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete this organization?">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-ink-muted">
            This permanently deletes {orgName}: projects, environments, flags, API keys, audit log,
            and the edge snapshots serving its flags. Members' user accounts are kept. A live Polar
            subscription is not canceled automatically; cancel it in Polar afterwards.
          </p>
          <Field label={`Type the organization name to confirm`} hint={orgName}>
            <input
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              className={inputClass}
              placeholder={orgName}
            />
          </Field>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending || confirmName.trim() !== orgName}
              onClick={() =>
                run(
                  () => deleteOrg(orgId, confirmName),
                  () => router.push("/orgs"),
                )
              }
            >
              {pending ? "Deleting…" : "Delete forever"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
