/**
 * Structured logger. Records are sanitized, mirrored to console as JSON, and
 * (Node only) POSTed to a Better Stack logs source on flush().
 *
 * Worker runtime (`runtime: "worker"`) is console-only: Cloudflare OTel export
 * ships console output. A telemetry failure never throws.
 */

import { sanitizeFields, type Fields } from "./fields";

export type { Fields };
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerConfig {
  service: string;
  environment?: string;
  release?: string;
  sourceToken?: string;
  endpoint?: string;
  minLevel?: LogLevel;
  fields?: Fields;
  console?: boolean;
  fetchImpl?: typeof fetch;
  /** Worker runtime skips HTTP ingest (Cloudflare OTel export covers logs). */
  runtime?: "worker" | "node";
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
  child(fields: Fields): Logger;
  flush(): Promise<void>;
  readonly enabled: boolean;
}

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
    return { error: { name: value.name, message: value.message, stack: value.stack } };
  }
  return { error: value };
}

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
    const merged = sanitizeFields({
      ...this.sink.base,
      ...this.fields,
      ...normalizeFields(fields),
    });
    const record: LogRecord = {
      dt: new Date().toISOString(),
      level,
      message: String(message).slice(0, 500),
      ...merged,
    };
    if (this.sink.console) {
      consoleFor(level)(JSON.stringify(record));
    }
    if (this.sink.enabled) {
      this.sink.buffer.push(record);
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
    return new LoggerImpl(this.sink, sanitizeFields({ ...this.fields, ...fields }));
  }

  flush(): Promise<void> {
    return this.sink.flush();
  }
}

export function createLogger(config: LoggerConfig): Logger {
  const endpoint = config.endpoint?.replace(/\/+$/, "");
  const token = config.sourceToken;
  const httpEnabled = config.runtime !== "worker" && Boolean(endpoint) && Boolean(token);
  const fetchImpl = config.fetchImpl ?? fetch;

  const base: Fields = sanitizeFields({
    service: config.service,
    ...(config.environment ? { environment: config.environment } : {}),
    ...(config.release ? { release: config.release } : {}),
    ...(config.fields ?? {}),
  });

  const sink: Sink = {
    buffer: [],
    enabled: httpEnabled,
    minLevel: LEVEL_ORDER[config.minLevel ?? "info"],
    console: config.console ?? true,
    base,
    async flush(): Promise<void> {
      if (!httpEnabled || this.buffer.length === 0) return;
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
        // Best-effort.
      }
    },
  };

  return new LoggerImpl(sink, {});
}
