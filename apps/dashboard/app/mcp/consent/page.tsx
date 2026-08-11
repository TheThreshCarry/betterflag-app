/**
 * MCP OAuth consent screen (/mcp/consent?txn=…).
 *
 * The MCP worker parks the OAuth authorization request under a one-time txn
 * id and sends the browser here; the middleware guarantees a signed-in
 * Supabase session. The user picks which org the connection may access and
 * approves or denies, see actions.ts for what happens next.
 */
import { Logo } from "@/components/logo";
import { Button, Card, Chip } from "@/components/ui";
import { resolveSessionUser } from "@/lib/auth";
import { fetchConsentTxn, isValidTxnId, listConsentOrgs } from "@/lib/mcp-oauth";

import { approveConsent, denyConsent } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  bad_txn: "This connection request is malformed. Restart the connection from your MCP client.",
  bad_org: "That organization is not available to your account. Pick one of your organizations.",
  expired:
    "This connection request expired or was already used. Restart the connection from your MCP client.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="default" showText />
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center">
      <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Connection unavailable</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{message}</p>
    </Card>
  );
}

export default async function McpConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ txn?: string; error?: string }>;
}) {
  const params = await searchParams;

  const errorCopy = params.error ? ERROR_COPY[params.error] : undefined;
  if (errorCopy) {
    return (
      <Shell>
        <ErrorCard message={errorCopy} />
      </Shell>
    );
  }

  if (!isValidTxnId(params.txn)) {
    return (
      <Shell>
        <ErrorCard message={ERROR_COPY.bad_txn!} />
      </Shell>
    );
  }

  const [txn, { userId, email }] = await Promise.all([
    fetchConsentTxn(params.txn),
    resolveSessionUser(),
  ]);
  if (!txn) {
    return (
      <Shell>
        <ErrorCard message={ERROR_COPY.expired!} />
      </Shell>
    );
  }

  const orgs = await listConsentOrgs(userId);
  if (orgs.length === 0) {
    return (
      <Shell>
        <ErrorCard message="Your account has no organization yet. Finish onboarding in the dashboard first, then restart the connection." />
      </Shell>
    );
  }

  const clientName = txn.client.clientName?.trim() || "An MCP client";

  return (
    <Shell>
      <Card className="p-8">
        <div className="mb-5 flex items-center justify-between">
          <Chip color="orange">MCP connection</Chip>
          {email ? <span className="text-[12px] text-ink-muted">{email}</span> : null}
        </div>

        <h1 className="text-[22px] font-semibold leading-snug tracking-[-0.02em]">
          {clientName} wants to connect to Betterflag
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          It will be able to manage feature flags, create flags, change targeting, stage
          rollouts, and use kill switches, in the organization you choose. Every change is
          attributed in the audit log, and you can disconnect any time by revoking the key on the
          Keys page.
        </p>

        <form className="mt-6">
          <input type="hidden" name="txnId" value={txn.txnId} />
          <input type="hidden" name="clientName" value={txn.client.clientName ?? ""} />

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">
              Give access to organization
            </legend>
            <div className="space-y-2">
              {orgs.map((org, index) => (
                <label
                  key={org.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3 transition-colors hover:border-line-strong has-[:checked]:border-accent"
                >
                  <input
                    type="radio"
                    name="orgId"
                    value={org.id}
                    defaultChecked={index === 0}
                    required
                    className="size-4 accent-accent"
                  />
                  <span className="flex-1 text-[14px] font-medium text-ink">{org.name}</span>
                  <span className="text-[12px] capitalize text-ink-muted">{org.plan}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
            Approving creates a dedicated agent key for this connection (it does not count
            against your plan&apos;s agent-key limit).
          </p>

          <div className="mt-6 flex gap-3">
            <Button type="submit" formAction={approveConsent} className="flex-1">
              Approve
            </Button>
            <Button type="submit" formAction={denyConsent} variant="ghost" className="flex-1">
              Deny
            </Button>
          </div>
        </form>
      </Card>

      <p className="mt-4 text-center text-[12px] text-ink-muted">
        Redirects to{" "}
        <span className="font-mono">{new URL(txn.client.redirectUri).hostname}</span> after you
        decide.
      </p>
    </Shell>
  );
}
