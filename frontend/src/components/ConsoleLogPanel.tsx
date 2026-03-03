import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Info, Trash2 } from "lucide-react";
import { useConsoleLog } from "@/context/ConsoleLogContext";
import type { ConsoleLogLevel } from "@/console-log";

const levelConfig: Record<ConsoleLogLevel, { label: string; icon: typeof Info; className: string }> = {
  request: {
    label: "请求",
    icon: CheckCircle,
    className: "text-[var(--color-text-muted)]",
  },
  error: {
    label: "错误",
    icon: AlertCircle,
    className: "text-[var(--color-error-text)]",
  },
  info: {
    label: "信息",
    icon: Info,
    className: "text-[var(--color-primary)]",
  },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
}

export function ConsoleLogPanel() {
  const { logs, clearLogs } = useConsoleLog();
  const [filter, setFilter] = useState<ConsoleLogLevel | "all">("all");

  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((e) => e.level === filter);
  }, [logs, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 shadow-[var(--shadow-header)]">
        <span className="font-semibold text-[var(--color-text)]">控制台日志</span>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ConsoleLogLevel | "all")}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
          >
            <option value="all">全部</option>
            <option value="request">请求</option>
            <option value="error">错误</option>
            <option value="info">信息</option>
          </select>
          <button
            type="button"
            onClick={clearLogs}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-text)]"
          >
            <Trash2 className="size-3.5" />
            清空
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-relaxed">
        {filtered.length === 0 ? (
          <span className="text-[var(--color-text-subtle)]">暂无日志</span>
        ) : (
          filtered.map((entry) => {
            const cfg = levelConfig[entry.level];
            const Icon = cfg.icon;
            return (
              <div
                key={entry.id}
                className={`flex gap-2 py-1 border-b border-[var(--color-border)] last:border-0 ${cfg.className}`}
              >
                <span className="shrink-0 text-[var(--color-text-subtle)]">{formatTime(entry.time)}</span>
                <Icon className="size-3.5 shrink-0 mt-0.5" />
                <span className="min-w-0 flex-1">{entry.message}</span>
                {entry.meta && Object.keys(entry.meta).length > 0 && (
                  <span className="shrink-0 text-[var(--color-text-subtle)]">
                    {JSON.stringify(entry.meta)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </pre>
    </div>
  );
}
