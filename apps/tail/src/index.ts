/**
 * Betterflag Tail Worker. Receives producer invocation traces and ships one
 * sanitized summary per event to the Betterflag Tail Better Stack source.
 *
 * Never attach this worker to itself. Never forward raw headers, URLs,
 * bodies, or duplicate console payloads.
 */
import { formatRelease, readObservability } from "@betterflag/observability";
import { summarizeTailItem, type TailItemLike } from "./sanitize";
import { VERSION } from "./version.gen";

export interface TailEnv {
  BETTER_STACK_SOURCE_TOKEN?: string;
  BETTER_STACK_LOGS_ENDPOINT?: string;
  BETTERFLAG_ENV?: string;
  BETTERFLAG_GIT_SHA?: string;
  BETTERFLAG_RELEASE?: string;
}

const handler = {
  async tail(events: TraceItem[], env: TailEnv, ctx: ExecutionContext): Promise<void> {
    const obs = readObservability(env as unknown as Record<string, unknown>, "betterflag-tail", {
      environment: env.BETTERFLAG_ENV,
      release: formatRelease({
        version: VERSION,
        gitSha: env.BETTERFLAG_GIT_SHA,
        override: env.BETTERFLAG_RELEASE,
      }),
      runtime: "node",
      console: false,
    });

    for (const event of events as TailItemLike[]) {
      const summary = summarizeTailItem(event);
      const fields = { ...summary };
      if (summary["event.outcome"] === "error") obs.logger.error("workers.invocation", fields);
      else obs.logger.info("workers.invocation", fields);
    }

    ctx.waitUntil(obs.flush());
  },
} satisfies ExportedHandler<TailEnv>;

export default handler;
export { summarizeTailItem } from "./sanitize";
