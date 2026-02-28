import { useState, useCallback, KeyboardEvent } from "react";
import styles from "./MessageInput.module.css";

interface MessageInputProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = "输入消息，Enter 发送，Shift+Enter 换行",
}: MessageInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSend(trimmed);
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className={styles.wrap}>
      <textarea
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        aria-label="消息输入"
      />
      <button
        type="button"
        className={styles.button}
        onClick={() => void handleSubmit()}
        disabled={disabled || !value.trim()}
        aria-label="发送"
      >
        发送
      </button>
    </div>
  );
}
