import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className={styles.list} role="log" aria-live="polite">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && (
        <div className={styles.loading} aria-busy="true">
          <span className={styles.loadingDot}>·</span>
          <span className={styles.loadingDot}>·</span>
          <span className={styles.loadingDot}>·</span>
        </div>
      )}
    </div>
  );
}
