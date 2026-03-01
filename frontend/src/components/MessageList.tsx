import type { ChatMessage } from "@/types/chat";
import { Loader2 } from "lucide-react";
import { StickToBottom } from "use-stick-to-bottom";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onResend?: (text: string) => void;
}

export function MessageList({ messages, isLoading, onResend }: MessageListProps) {
  return (
    <StickToBottom className="flex min-h-0 flex-1 flex-col overflow-auto">
      <StickToBottom.Content className="flex flex-col py-2" role="log" aria-live="polite">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onResend={onResend} />
        ))}
        {isLoading && (
          <div className="flex px-4 py-3" aria-busy="true">
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
              <Loader2 className="size-5 shrink-0 animate-spin text-[var(--color-primary)]" />
              <span className="text-sm text-[var(--color-text-muted)]">正在回复…</span>
            </div>
          </div>
        )}
      </StickToBottom.Content>
    </StickToBottom>
  );
}
