/**
 * Control-flow exceptions for tool handlers.
 *
 * - ToolError      → rendered as a tool result; `isError` only when the
 *                    failure is genuine (bad key, not found, conflict…).
 *                    Recoverable "please tell me more" situations (e.g.
 *                    ambiguous project) set `isError: false`.
 * - ApprovalPending → NOT an error. A guardrailed mutation returned 202 and
 *                    is staged for human approval; rendered as a friendly
 *                    guardrail message.
 */

export class ToolError extends Error {
  readonly isError: boolean;

  constructor(message: string, opts?: { isError?: boolean }) {
    super(message);
    this.name = "ToolError";
    this.isError = opts?.isError ?? true;
  }
}

export class ApprovalPending {
  constructor(
    readonly approvalId: string,
    readonly serverMessage: string | undefined,
    /** Human phrasing of what was gated, e.g. "the production kill-switch". */
    readonly actionLabel: string,
  ) {}

  render(): string {
    const lines = [
      `🛡️ Guardrail: ${this.actionLabel} requires human approval.`,
      `Nothing has been changed yet. Approval request ${this.approvalId} is now pending in the ShipOS dashboard (→ /approvals).`,
      `Check status with request_approval_status(approvalId="${this.approvalId}").`,
      `Once a teammate approves, the change executes immediately.`,
    ];
    if (this.serverMessage) lines.splice(1, 0, this.serverMessage);
    return lines.join("\n");
  }
}
