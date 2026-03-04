import { useState, useEffect, useCallback } from "react";
import type { ChatMessage } from "@/types/chat";
import { User, Bot, ChevronDown, ChevronRight, Copy, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ROLE_LABEL: Record<string, string> = { researcher: "研究员", coder: "程序员" };

interface MessageBubbleProps {
  message: ChatMessage;
  onResend?: (text: string) => void;
}

function getBubbleText(message: ChatMessage): string {
  const parts: string[] = [];
  if (message.thinking?.trim()) parts.push(message.thinking.trim());
  if (message.subAgents?.length) {
    for (const sub of message.subAgents) {
      const label = ROLE_LABEL[sub.role] ?? sub.role;
      if (sub.thinking?.trim()) parts.push(`【${label} 思考过程】\n${sub.thinking.trim()}`);
      if (sub.content?.trim()) parts.push(`【${label} 结论】\n${sub.content.trim()}`);
    }
  }
  const mainText = message.mainReplyClean?.trim() ?? message.content?.trim();
  if (mainText) parts.push(mainText);
  if (message.summary?.trim()) parts.push(`【综合回复】\n${message.summary.trim()}`);
  return parts.join("\n\n");
}

export function MessageBubble({ message, onResend }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [thinkingFolded, setThinkingFolded] = useState(!!message.content);
  const [subFolded, setSubFolded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (message.content) setThinkingFolded(true);
  }, [message.content]);

  const handleCopy = useCallback(() => {
    const text = getBubbleText(message);
    void navigator.clipboard.writeText(text);
  }, [message]);

  const handleResend = useCallback(() => {
    const text = message.role === "user" ? message.content : getBubbleText(message);
    onResend?.(text);
  }, [message, onResend]);

  const toggleSub = (role: string) =>
    setSubFolded((prev) => ({ ...prev, [role]: !prev[role] }));

  return (
    <div
      className={`flex w-full gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}
      data-role={message.role}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
        }`}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div className={`flex min-w-0 max-w-[80%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        <span className="mb-1 text-xs font-medium text-[var(--color-text-subtle)]">
          {isUser ? "你" : "Claw"}
        </span>
        <div className="flex flex-col gap-2">
          {!isUser && (message.protocolUsed?.skills?.length ?? 0) + (message.protocolUsed?.urls?.length ?? 0) > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
              {message.protocolUsed?.skills?.length ? (
                <span>已加载技能：{message.protocolUsed.skills.join("、")}</span>
              ) : null}
              {message.protocolUsed?.skills?.length && message.protocolUsed?.urls?.length ? "；" : null}
              {message.protocolUsed?.urls?.length ? (
                <span>已抓取 URL：{message.protocolUsed.urls.length} 个</span>
              ) : null}
            </div>
          )}
          {!isUser && message.thinking && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
              <button
                type="button"
                onClick={() => setThinkingFolded((v) => !v)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-[var(--color-text-subtle)] hover:bg-[var(--color-bg)]/80"
              >
                {thinkingFolded ? <ChevronRight className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
                思考过程
              </button>
              {!thinkingFolded && (
                <div className="border-t border-[var(--color-border)] px-3 py-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                  <div className="whitespace-pre-wrap break-words">{message.thinking}</div>
                </div>
              )}
            </div>
          )}
          {!isUser && message.subAgents?.length
            ? message.subAgents.map((sub) => {
                const label = ROLE_LABEL[sub.role] ?? sub.role;
                const thinkingFolded = subFolded[sub.role] ?? !!sub.content?.trim();
                return (
                  <div key={sub.role} className="flex flex-col gap-2">
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSub(sub.role)}
                        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-[var(--color-text-subtle)] hover:bg-[var(--color-bg)]/80"
                      >
                        {thinkingFolded ? <ChevronRight className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
                        {label}（子 agent）思考过程
                      </button>
                      {!thinkingFolded && sub.thinking?.trim() && (
                        <div className="border-t border-[var(--color-border)] px-3 py-2 text-[13px] leading-relaxed text-[var(--color-text-muted)] whitespace-pre-wrap break-words">
                          {sub.thinking}
                        </div>
                      )}
                    </div>
                    {sub.content?.trim() && (
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                        <div className="text-xs font-medium text-[var(--color-text-subtle)] mb-1.5">{label}（子 agent）结论</div>
                        <div className="prose prose-sm max-w-none text-[var(--color-text)] dark:prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{sub.content}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            : null}
          {!isUser && (() => {
            const hasSubOrSummary = (message.subAgents?.length ?? 0) > 0 || (message.summary?.trim()?.length ?? 0) > 0;
            const mainText = message.mainReplyClean?.trim();
            const toShow = hasSubOrSummary ? (mainText || "已派发子任务。") : (mainText || message.content?.trim() || "…");
            if (!toShow) return null;
            return (
              <div className="rounded-[var(--radius-lg)] px-4 py-2.5 text-[15px] leading-relaxed bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-bubble)]">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{toShow}</ReactMarkdown>
                </div>
              </div>
            );
          })()}
          {isUser && (
            <div className="rounded-[var(--radius-lg)] px-4 py-2.5 text-[15px] leading-relaxed bg-[var(--color-primary)] text-white shadow-[var(--shadow-bubble)]">
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            </div>
          )}
          {!isUser && message.summary?.trim() && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary)]/30 bg-[var(--color-primary-muted)]/50 px-4 py-2.5">
              <div className="text-xs font-medium text-[var(--color-primary)] mb-2">综合回复</div>
              <div className="prose prose-sm max-w-none text-[var(--color-text)] dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.summary}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            title="复制"
          >
            <Copy className="size-3.5" />
            复制
          </button>
          {onResend && (
            <button
              type="button"
              onClick={handleResend}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
              title={isUser ? "重发" : "以此为内容发送"}
            >
              <RotateCcw className="size-3.5" />
              {isUser ? "重发" : "以此为内容发送"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
