import { useState, useCallback, useRef } from "react";
import type { ChatMessage, SubAgentBlock } from "@/types/chat";
import { sendMessageStreaming } from "@/api/gateway";

function mergeSubAgents(
  arr: SubAgentBlock[] | undefined,
  role: string,
  upd: Partial<Pick<SubAgentBlock, "thinking" | "content">>
): SubAgentBlock[] {
  const list = [...(arr || [])];
  const i = list.findIndex((s) => s.role === role);
  const base = i >= 0 ? list[i]! : { role, thinking: "", content: "" };
  const next = { ...base, ...upd };
  if (i >= 0) list[i] = next;
  else list.push(next);
  return list;
}

function nextId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseChatOptions {
  onReplyComplete?: () => void;
  /** 当前选中模型，发请求时覆盖默认配置 */
  selectedModel?: string;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  clearMessages: () => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useChat(options?: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onReplyCompleteRef = useRef(options?.onReplyComplete);
  onReplyCompleteRef.current = options?.onReplyComplete;
  const selectedModel = options?.selectedModel ?? undefined;

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = {
        id: nextId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantId = nextId();
      const placeholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setError(null);
      setIsLoading(true);

      const streamingContentRef = { current: "" };
      const streamingThinkingRef = { current: "" };
      sendMessageStreaming(
        trimmed,
        {
          onThinking: (chunk) => {
            streamingThinkingRef.current += chunk;
            setMessages((prev) => {
              const hasPlaceholder = prev.some((m) => m.id === assistantId);
              const next = {
                ...placeholder,
                thinking: streamingThinkingRef.current,
                content: streamingContentRef.current,
                subAgents: (prev.find((m) => m.id === assistantId) as ChatMessage | undefined)?.subAgents,
              };
              if (!hasPlaceholder) return [...prev, next];
              return prev.map((m) =>
                m.id === assistantId ? { ...m, thinking: streamingThinkingRef.current, content: streamingContentRef.current } : m
              );
            });
          },
          onChunk: (chunk) => {
            streamingContentRef.current += chunk;
            setMessages((prev) => {
              const hasPlaceholder = prev.some((m) => m.id === assistantId);
              const next = {
                ...placeholder,
                thinking: streamingThinkingRef.current,
                content: streamingContentRef.current,
                subAgents: (prev.find((m) => m.id === assistantId) as ChatMessage | undefined)?.subAgents,
              };
              if (!hasPlaceholder) return [...prev, next];
              return prev.map((m) =>
                m.id === assistantId ? { ...m, thinking: streamingThinkingRef.current, content: streamingContentRef.current } : m
              );
            });
          },
          onSubThinking: (role, thinkingDelta) => {
            setMessages((prev) => {
              const has = prev.some((m) => m.id === assistantId);
              const current = has ? prev.find((m) => m.id === assistantId)?.subAgents?.find((s) => s.role === role) : undefined;
              const newThinking = (current?.thinking ?? "") + thinkingDelta;
              const merged = mergeSubAgents(has ? prev.find((m) => m.id === assistantId)?.subAgents : undefined, role, { thinking: newThinking });
              if (!has) return [...prev, { ...placeholder, subAgents: merged }];
              return prev.map((m) => (m.id === assistantId ? { ...m, subAgents: merged } : m));
            });
          },
          onSubChunk: (role, chunkDelta) => {
            setMessages((prev) => {
              const has = prev.some((m) => m.id === assistantId);
              const current = has ? prev.find((m) => m.id === assistantId)?.subAgents?.find((s) => s.role === role) : undefined;
              const newContent = (current?.content ?? "") + chunkDelta;
              const merged = mergeSubAgents(has ? prev.find((m) => m.id === assistantId)?.subAgents : undefined, role, { content: newContent });
              if (!has) return [...prev, { ...placeholder, subAgents: merged }];
              return prev.map((m) => (m.id === assistantId ? { ...m, subAgents: merged } : m));
            });
          },
          onMainReplyClean: (content) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, mainReplyClean: content } : m))
            );
          },
          onSummary: (content) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, summary: content } : m))
            );
          },
          onDone: () => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === assistantId)) return prev;
              return [
                ...prev,
                {
                  ...placeholder,
                  thinking: streamingThinkingRef.current,
                  content: streamingContentRef.current,
                },
              ];
            });
            setIsLoading(false);
            onReplyCompleteRef.current?.();
          },
          onError: (err) => {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            setIsLoading(false);
            setError(err);
          },
        },
        selectedModel
      );
    },
    [selectedModel]
  );

  const clearError = useCallback(() => setError(null), []);
  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, send, clearMessages, isLoading, error, clearError };
}
