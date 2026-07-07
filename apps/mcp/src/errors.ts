/**
 * Control-flow exceptions for tool handlers.
 *
 * - ToolError → rendered as a tool result; `isError` only when the failure is
 *               genuine (bad key, not found, conflict…). Recoverable "please
 *               tell me more" situations (e.g. ambiguous project) set
 *               `isError: false`.
 */

export class ToolError extends Error {
  readonly isError: boolean;

  constructor(message: string, opts?: { isError?: boolean }) {
    super(message);
    this.name = "ToolError";
    this.isError = opts?.isError ?? true;
  }
}
