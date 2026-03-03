import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ConsoleLogEntry, ConsoleLogLevel } from "@/console-log";
import { setConsoleLogEmitter } from "@/console-log";

const MAX_LOGS = 500;

interface ConsoleLogContextValue {
  logs: ConsoleLogEntry[];
  addLog: (level: ConsoleLogLevel, message: string, meta?: Record<string, unknown>) => void;
  clearLogs: () => void;
}

const ConsoleLogContext = createContext<ConsoleLogContextValue | null>(null);

export function ConsoleLogProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);

  const pushEntry = useCallback((entry: ConsoleLogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
    });
  }, []);

  useEffect(() => {
    setConsoleLogEmitter(pushEntry);
    return () => setConsoleLogEmitter(null);
  }, [pushEntry]);

  const addLog = useCallback((level: ConsoleLogLevel, message: string, meta?: Record<string, unknown>) => {
    pushEntry({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      level,
      message,
      time: Date.now(),
      meta,
    });
  }, [pushEntry]);

  const clearLogs = useCallback(() => setLogs([]), []);

  const value = useMemo(
    () => ({ logs, addLog, clearLogs }),
    [logs, addLog, clearLogs]
  );

  return (
    <ConsoleLogContext.Provider value={value}>
      {children}
    </ConsoleLogContext.Provider>
  );
}

export function useConsoleLog(): ConsoleLogContextValue {
  const ctx = useContext(ConsoleLogContext);
  if (!ctx) throw new Error("useConsoleLog must be used within ConsoleLogProvider");
  return ctx;
}
