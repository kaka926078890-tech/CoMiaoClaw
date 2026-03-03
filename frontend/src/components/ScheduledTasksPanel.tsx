import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Plus, Trash2, X } from "lucide-react";
import type { ScheduledTask } from "@/api/gateway";
import {
  listScheduledTasks,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
} from "@/api/gateway";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

export function ScheduledTasksPanel() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"memory-compact" | "heartbeat">("heartbeat");
  const [formInterval, setFormInterval] = useState(60);
  const [formEnabled, setFormEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listScheduledTasks();
      setTasks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    const name = formName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await createScheduledTask({
        name,
        type: formType,
        intervalMinutes: formInterval,
        enabled: formEnabled,
      });
      setFormName("");
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [formName, formType, formInterval, formEnabled, load]);

  const handleToggleEnabled = useCallback(
    async (task: ScheduledTask) => {
      try {
        await updateScheduledTask(task.id, { enabled: !task.enabled });
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [load]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("确定删除该定时任务？")) return;
      try {
        await deleteScheduledTask(id);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [load]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 shadow-[var(--shadow-header)]">
        <span className="font-semibold text-[var(--color-text)]">定时任务</span>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-text)]"
        >
          <Plus className="size-3.5" />
          {showForm ? "取消" : "新建"}
        </button>
      </div>
      {error && (
        <div className="shrink-0 bg-[var(--color-error-bg)] px-4 py-2 text-sm text-[var(--color-error-text)]" role="alert">
          {error}
        </div>
      )}
      {showForm && (
        <div className="shrink-0 border-b border-[var(--color-border)] p-4 space-y-3">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="任务名称"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-text-muted)]">类型</span>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as "memory-compact" | "heartbeat")}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
              >
                <option value="heartbeat">心跳（仅日志）</option>
                <option value="memory-compact">记忆整理（保留最近 20 条）</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-text-muted)]">间隔(分钟)</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={formInterval}
                onChange={(e) => setFormInterval(Number(e.target.value) || 60)}
                className="w-20 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
              />
              <span className="text-[var(--color-text-muted)]">启用</span>
            </label>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !formName.trim()}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            添加
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="size-4 animate-spin" />
            加载中…
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--color-text-subtle)]">
            暂无定时任务，点击「新建」添加
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 shrink-0 text-[var(--color-text-subtle)]" />
                    <span className="font-medium text-[var(--color-text)]">{t.name}</span>
                    {!t.enabled && (
                      <span className="text-xs text-[var(--color-text-subtle)]">已禁用</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {t.type === "memory-compact" ? "记忆整理" : "心跳"} · 每 {t.intervalMinutes} 分钟
                    {t.lastRunAt != null && ` · 上次运行: ${formatTime(t.lastRunAt)}`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(t)}
                    className="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                  >
                    {t.enabled ? "禁用" : "启用"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error-text)]"
                    aria-label="删除"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
