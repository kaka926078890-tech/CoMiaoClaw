import type { ChatMessage } from "@/types/chat";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div
      className={`${styles.bubble} ${isUser ? styles.user : styles.assistant}`}
      data-role={message.role}
    >
      <span className={styles.label}>{isUser ? "你" : "助手"}</span>
      <div className={styles.content}>{message.content}</div>
    </div>
  );
}
