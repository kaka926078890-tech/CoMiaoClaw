import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { fetchMemoryContent, clearMemory } from "@/api/gateway";

export function MemoryHistory() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await fetchMemoryContent();
      setContent(text || "（暂无记忆内容）");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setContent("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClearMemory = useCallback(async () => {
    if (clearing || !confirm("确定清空历史记忆？此操作不可恢复。")) return;
    setClearing(true);
    setError(null);
    try {
      await clearMemory();
      setContent("（暂无记忆内容）");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setClearing(false);
    }
  }, [clearing]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 shadow-[var(--shadow-header)]">
        <p className="text-sm text-[var(--color-text-muted)]">记忆文件 memory.md 内容，便于对照</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearMemory}
            disabled={loading || clearing}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text-muted)] shadow-[var(--shadow-subtle)] hover:bg-gray-100 hover:text-[var(--color-text)] disabled:opacity-50"
            title="清空历史记忆"
          >
            <Trash2 className="size-3.5" />
            {clearing ? "清空中" : "清空记忆"}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text-muted)] shadow-[var(--shadow-subtle)] hover:bg-gray-100 hover:text-[var(--color-text)] disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "加载中" : "刷新"}
          </button>
        </div>
      </div>
      {error && (
        <div className="shrink-0 bg-[var(--color-error-bg)] px-4 py-2 text-sm text-[var(--color-error-text)]" role="alert">
          {error}
        </div>
      )}
      <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-4 text-[13px] leading-relaxed text-[var(--color-text)]">
        {content}
      </pre>
    </div>
  );
}
