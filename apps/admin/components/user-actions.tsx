"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Dialog, ErrorNote, Field, inputClass } from "@/components/ui";
import { banUser, deleteUser, unbanUser } from "@/lib/actions";

export function UserActions({
  userId,
  email,
  banned,
  protected: isProtected,
}: {
  userId: string;
  email: string | null;
  banned: boolean;
  /** True for admin-allowlisted accounts; server enforces, this is UX. */
  protected: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"ban" | "delete" | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isProtected) {
    return <span className="text-[12px] text-ink-muted">team account</span>;
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDialog(null);
      setConfirmEmail("");
      router.refresh();
    });
  }

  const displayName = email ?? userId;

  return (
    <div className="flex items-center justify-end gap-2">
      {banned ? (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => unbanUser(userId))}>
          Unban
        </Button>
      ) : (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => setDialog("ban")}>
          Ban
        </Button>
      )}
      <Button variant="danger" size="sm" disabled={pending} onClick={() => setDialog("delete")}>
        Delete
      </Button>

      <Dialog open={dialog === "ban"} onClose={() => setDialog(null)} title="Ban this user?">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-ink-muted">
            {displayName} will be unable to sign in or refresh a session. Their data and org
            memberships are kept, and you can unban them at any time.
          </p>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button disabled={pending} onClick={() => run(() => banUser(userId))}>
              {pending ? "Banning…" : "Ban user"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete this user?">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-ink-muted">
            This permanently deletes the account and removes it from every organization. Orgs where
            they were the only member are kept and show up as orphaned in the orgs list.
          </p>
          <Field label="Type the user's email to confirm" hint={displayName}>
            <input
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              className={inputClass}
              placeholder={email ?? ""}
            />
          </Field>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending || confirmEmail.trim().toLowerCase() !== (email ?? "").toLowerCase()}
              onClick={() => run(() => deleteUser(userId, confirmEmail))}
            >
              {pending ? "Deleting…" : "Delete forever"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
