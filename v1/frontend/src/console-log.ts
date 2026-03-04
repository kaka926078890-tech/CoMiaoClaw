export type ConsoleLogLevel = "request" | "error" | "info";

export interface ConsoleLogEntry {
  id: string;
  level: ConsoleLogLevel;
  message: string;
  time: number;
  meta?: Record<string, unknown>;
}

let emitter: ((entry: ConsoleLogEntry) => void) | null = null;

export function setConsoleLogEmitter(fn: ((entry: ConsoleLogEntry) => void) | null): void {
  emitter = fn;
}

export function emitLog(level: ConsoleLogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: ConsoleLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    level,
    message,
    time: Date.now(),
    meta,
  };
  emitter?.(entry);
}
