import { useRef, useCallback, useState, useEffect } from "react";
import {
  MessageCircle,
  PanelLeft,
  Plus,
  MoreVertical,
  History,
  X,
  Menu,
} from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { clearSession } from "@/api/gateway";
import { getGatewayConfig, fetchModels } from "@/config/env";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { MemoryHistory } from "./MemoryHistory";

const SIDEBAR_WIDTH = 260;

export function ChatConsole() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [clearErrorMsg, setClearErrorMsg] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    getGatewayConfig().then((cfg) => setSelectedModel(cfg.ollamaModel || ""));
    fetchModels().then(setModels).catch(() => setModels([]));
  }, []);

  const onReplyComplete = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const { messages, send, clearMessages, isLoading, error, clearError } = useChat({
    onReplyComplete,
    selectedModel: selectedModel || undefined,
  });

  const handleNewConversation = useCallback(async () => {
    setClearErrorMsg(null);
    setHistoryOpen(false);
    try {
      await clearSession();
      clearMessages();
      clearError();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setClearErrorMsg(`新启对话失败: ${msg}`);
    }
  }, [clearMessages, clearError]);

  return (
    <div className="flex h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* 左侧边栏 */}
      <aside
        className="flex flex-col shrink-0 overflow-hidden bg-[var(--color-surface)] transition-[width] duration-200 ease-out"
        style={{
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          boxShadow: sidebarOpen ? "var(--shadow-sidebar)" : "none",
        }}
      >
        {sidebarOpen && (
          <>
            <div className="flex h-14 shrink-0 items-center gap-2 px-4 shadow-[var(--shadow-header)]">
              <MessageCircle className="size-7 shrink-0 text-[var(--color-primary)]" strokeWidth={1.8} />
              <span className="font-semibold text-[var(--color-text)]">Claw</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <button
                type="button"
                onClick={handleNewConversation}
                disabled={isLoading}
                className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-primary-muted)] px-3 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                  <Plus className="size-4" strokeWidth={2.5} />
                </span>
                新对话
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="mt-2 flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition-colors"
              >
                <History className="size-4 shrink-0" />
                历史记录
              </button>
              <div className="mt-6 px-2 text-xs font-medium text-[var(--color-text-subtle)] uppercase tracking-wider">
                对话列表
              </div>
              <div className="mt-2 rounded-[var(--radius-md)] px-3 py-4 text-center text-sm text-[var(--color-text-subtle)]">
                暂无历史对话
                <br />
                <span className="text-xs">多会话即将支持</span>
              </div>
            </div>
            <div className="shrink-0 p-3 shadow-[0_-1px_0_0_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3">
                <span className="size-8 shrink-0 rounded-full bg-[var(--color-text)]" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">PiiKaQiu</span>
                <button
                  type="button"
                  className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-subtle)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                  aria-label="更多"
                >
                  <MoreVertical className="size-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* 主区域 */}
      <main className="flex min-w-0 flex-1 flex-col bg-[var(--color-surface)]">
        <header className="flex h-14 shrink-0 items-center gap-2 px-4 shadow-[var(--shadow-header)]">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          >
            {sidebarOpen ? <PanelLeft className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="font-semibold text-[var(--color-text)]">Claw</span>
        </header>

        {(clearErrorMsg || error) && (
          <div className="flex shrink-0 items-center justify-between gap-3 bg-[var(--color-error-bg)] px-4 py-2.5 text-sm text-[var(--color-error-text)]">
            <span className="min-w-0 flex-1 truncate">{clearErrorMsg || error}</span>
            <button
              type="button"
              onClick={() => {
                setClearErrorMsg(null);
                clearError();
              }}
              className="shrink-0 font-medium underline underline-offset-2"
            >
              关闭
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
              <div className="mb-8 flex size-20 items-center justify-center rounded-2xl bg-[var(--color-primary-muted)]">
                <MessageCircle className="size-10 text-[var(--color-primary)]" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">开始新对话</h2>
              <p className="mt-2 max-w-sm text-sm text-[var(--color-text-muted)]">
                在下方输入消息，与本地模型对话。支持流式回复与跨对话记忆。
              </p>
            </div>
          ) : (
            <MessageList messages={messages} isLoading={isLoading} onResend={send} />
          )}

          <div className="shrink-0 bg-[var(--color-surface)] px-4 pb-6 pt-4 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
            <div className="mx-auto max-w-3xl">
              <MessageInput
                ref={inputRef}
                onSend={send}
                disabled={isLoading}
                placeholder="输入消息，Enter 发送…"
                models={models}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            </div>
          </div>
        </div>
      </main>

      {/* 历史记录抽屉（右侧） */}
      {historyOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            aria-hidden
            onClick={() => setHistoryOpen(false)}
          />
          <aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[min(100%,400px)] flex-col bg-[var(--color-surface)] shadow-[var(--shadow-panel)]"
            role="dialog"
            aria-label="历史记录"
          >
            <div className="flex h-14 shrink-0 items-center justify-between px-4 shadow-[var(--shadow-header)]">
              <span className="font-semibold text-[var(--color-text)]">历史记录</span>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                aria-label="关闭"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <MemoryHistory />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
