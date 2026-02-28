import { useRef, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import styles from "./ChatConsole.module.css";

export function ChatConsole() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onReplyComplete = useCallback(() => {
    inputRef.current?.focus();
  }, []);
  const { messages, send, isLoading, error, clearError } = useChat({
    onReplyComplete,
  });

  return (
    <div className={styles.console}>
      <header className={styles.header}>
        <h1 className={styles.title}>Claw 对话控制台</h1>
        <p className={styles.subtitle}>用于与本地模型对话（MVP 单会话）</p>
      </header>

      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError} className={styles.dismiss}>
            关闭
          </button>
        </div>
      )}

      <MessageList messages={messages} isLoading={isLoading} />
      <MessageInput ref={inputRef} onSend={send} disabled={isLoading} />
    </div>
  );
}
