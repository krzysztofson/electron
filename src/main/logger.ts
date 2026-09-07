/**
 * Minimal leveled logger.
 *
 * The previous code had 66 bare `console.*` calls, several on hot paths -- one
 * pretty-printed the full JSON of every transcription event several times a
 * second, and the renderer worked around its own noise with
 * `if (Math.random() < 0.1)`. Anything per-audio-frame belongs at `debug`.
 */

const LEVELS = ["error", "warn", "info", "debug"] as const;

export type LogLevel = (typeof LEVELS)[number];

function resolveLevel(): LogLevel {
  const fromEnv = process.env.LOG_LEVEL?.toLowerCase();
  if (fromEnv && (LEVELS as readonly string[]).includes(fromEnv)) {
    return fromEnv as LogLevel;
  }
  return process.env.NODE_ENV === "development" ? "info" : "warn";
}

let threshold = LEVELS.indexOf(resolveLevel());

/** Re-read `LOG_LEVEL`; call once after the `.env` file has been loaded. */
export function refreshLogLevel(): void {
  threshold = LEVELS.indexOf(resolveLevel());
}

function emit(level: LogLevel, scope: string, args: readonly unknown[]): void {
  if (LEVELS.indexOf(level) > threshold) return;
  const sink =
    level === "error" || level === "warn" ? console.error : console.log;
  sink(`[${level}] ${scope}:`, ...args);
}

export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export function createLogger(scope: string): Logger {
  return {
    error: (...args) => emit("error", scope, args),
    warn: (...args) => emit("warn", scope, args),
    info: (...args) => emit("info", scope, args),
    debug: (...args) => emit("debug", scope, args),
  };
}

/** Normalises the `error instanceof Error` dance that appeared four times. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}
