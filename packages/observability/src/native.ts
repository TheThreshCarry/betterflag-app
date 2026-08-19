/**
 * Optional Cloudflare native tracing adapter. Worker entrypoints call
 * `installNativeTracing(tracing)` after `import { tracing } from "cloudflare:workers"`.
 * Tests and Node never install it, so they keep the in-memory / OTLP tracer.
 */

export interface NativeSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  end?(): void;
  readonly isTraced?: boolean;
}

export interface NativeTracing {
  startActiveSpan<T>(name: string, fn: (span: NativeSpan) => T): T;
  enterSpan?<T>(name: string, fn: (span: NativeSpan) => T | Promise<T>): T | Promise<T>;
}

let installed: NativeTracing | undefined;

export function installNativeTracing(tracing: NativeTracing): void {
  installed = tracing;
}

export function nativeTracing(): NativeTracing | undefined {
  return installed;
}

export function resetNativeTracing(): void {
  installed = undefined;
}

/** ExecutionContext on Workers exposes `tracing`. Tests pass fakes without it. */
export function attachWorkerTracing(ctx: { tracing?: NativeTracing } | undefined): void {
  if (ctx?.tracing) installNativeTracing(ctx.tracing);
}
