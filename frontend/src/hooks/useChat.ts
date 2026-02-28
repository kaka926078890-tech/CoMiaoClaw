import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types/chat";
import { sendMessageStreaming } from "@/api/gateway";

function nextId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseChatOptions {
  onReplyComplete?: () => void;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
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

  const send = useCallback(async (text: string) => {
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
    sendMessageStreaming(
      trimmed,
      (chunk) => {
        streamingContentRef.current += chunk;
        setMessages((prev) => {
          const hasPlaceholder = prev.some((m) => m.id === assistantId);
          if (!hasPlaceholder) {
            return [
              ...prev,
              { ...placeholder, content: streamingContentRef.current },
            ];
          }
          return prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: streamingContentRef.current }
              : m
          );
        });
      },
      () => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === assistantId)) return prev;
          return [
            ...prev,
            { ...placeholder, content: streamingContentRef.current },
          ];
        });
        setIsLoading(false);
        onReplyCompleteRef.current?.();
      },
      (err) => {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setIsLoading(false);
        setError(err);
      }
    );
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { messages, send, isLoading, error, clearError };
}
