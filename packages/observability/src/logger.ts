/**
 * Structured logger that ships JSON to a Better Stack logs source over HTTP.
 *
 * - Every call is also mirrored to `console.*`, so logs survive even if the
 *   Better Stack POST fails (and still show up in Workers Logs / Vercel logs).
 * - Records are buffered and sent on `flush()`. In Workers, call `flush()`
 *   inside `ctx.waitUntil(...)` so shipping never blocks the response.
 *
 * Spec: https://betterstack.com/docs/logs/ingesting-data/http/logs/
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type Fields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerConfig {
  service: string;
  environment?: string;
  release?: string;
  /** Better Stack source token. When absent, logs are console-only. */
  sourceToken?: string;
  /** Ingesting host base URL, e.g. https://sXXXX.eu-fsn-3.betterstackdata.com. */
  endpoint?: string;
  /** Drop anything below this level. Default "info". */
  minLevel?: LogLevel;
  /** Fields merged into every record. */
  fields?: Fields;
  /** Mirror to console. Default true. */
  console?: boolean;
  /** Optional override for tests. */
  fetchImpl?: typeof fetch;
}

interface LogRecord extends Fields {
  dt: string;
  level: LogLevel;
  message: string;
}

export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
  /** A logger that merges `fields` into every record (e.g. request/span context). */
  child(fields: Fields): Logger;
  /** Ship + clear all buffered records. Best-effort; never throws. */
  flush(): Promise<void>;
  readonly enabled: boolean;
}

/** Shared transport + buffer for a logger and all of its children. */
interface Sink {
  buffer: LogRecord[];
  readonly enabled: boolean;
  readonly minLevel: number;
  readonly console: boolean;
  readonly base: Fields;
  flush(): Promise<void>;
}

function serializeError(value: unknown): Fields {
  if (value instanceof Error) {
    return {
      error: { name: value.name, message: value.message, stack: value.stack },
    };
  }
  return { error: value };
}

/** Normalize a fields bag: a bare Error becomes a structured `error` field. */
function normalizeFields(fields?: Fields): Fields {
  if (!fields) return {};
  if (fields instanceof Error) return serializeError(fields);
  return fields;
}

function consoleFor(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case "debug":
      return console.debug.bind(console);
    case "info":
      return console.info.bind(console);
    case "warn":
      return console.warn.bind(console);
    case "error":
      return console.error.bind(console);
  }
}

class LoggerImpl implements Logger {
  constructor(
    private readonly sink: Sink,
    private readonly fields: Fields,
  ) {}

  get enabled(): boolean {
    return this.sink.enabled;
  }

  private emit(level: LogLevel, message: string, fields?: Fields): void {
    if (LEVEL_ORDER[level] < this.sink.minLevel) return;
    const merged: Fields = { ...this.sink.base, ...this.fields, ...normalizeFields(fields) };
    if (this.sink.console) {
      consoleFor(level)(`[${String(merged["service"] ?? "betterflag")}] ${message}`, merged);
    }
    if (this.sink.enabled) {
      this.sink.buffer.push({ dt: new Date().toISOString(), level, message, ...merged });
    }
  }

  debug(message: string, fields?: Fields): void {
    this.emit("debug", message, fields);
  }
  info(message: string, fields?: Fields): void {
    this.emit("info", message, fields);
  }
  warn(message: string, fields?: Fields): void {
    this.emit("warn", message, fields);
  }
  error(message: string, fields?: Fields): void {
    this.emit("error", message, fields);
  }

  child(fields: Fields): Logger {
    return new LoggerImpl(this.sink, { ...this.fields, ...fields });
  }

  flush(): Promise<void> {
    return this.sink.flush();
  }
}

export function createLogger(config: LoggerConfig): Logger {
  const endpoint = config.endpoint?.replace(/\/+$/, "");
  const token = config.sourceToken;
  const enabled = Boolean(endpoint) && Boolean(token);
  const fetchImpl = config.fetchImpl ?? fetch;

  const base: Fields = {
    service: config.service,
    ...(config.environment ? { environment: config.environment } : {}),
    ...(config.release ? { release: config.release } : {}),
    ...(config.fields ?? {}),
  };

  const sink: Sink = {
    buffer: [],
    enabled,
    minLevel: LEVEL_ORDER[config.minLevel ?? "info"],
    console: config.console ?? true,
    base,
    async flush(): Promise<void> {
      if (!enabled || this.buffer.length === 0) return;
      const records = this.buffer;
      this.buffer = [];
      try {
        await fetchImpl(`${endpoint}/`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(records),
        });
      } catch {
        // Best-effort, records were already mirrored to console above.
      }
    },
  };

  return new LoggerImpl(sink, {});
}
