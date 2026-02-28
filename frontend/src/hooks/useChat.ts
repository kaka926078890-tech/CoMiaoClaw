import { useState, useCallback } from "react";
import type { ChatMessage } from "@/types/chat";
import { sendMessage } from "@/api/gateway";

function nextId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * 单会话聊天状态与发送逻辑：维护 messages，调用网关发送并追加 user/assistant。
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: nextId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setError(null);
    setIsLoading(true);

    const outcome = await sendMessage(trimmed);

    setIsLoading(false);

    if (outcome.success) {
      const assistantMessage: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: outcome.reply,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } else {
      setError(outcome.error);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { messages, send, isLoading, error, clearError };
}
