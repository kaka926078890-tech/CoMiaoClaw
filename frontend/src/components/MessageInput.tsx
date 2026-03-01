import { useState, useCallback, KeyboardEvent, forwardRef, useRef } from "react";
import { ArrowUp, Paperclip } from "lucide-react";

interface MessageInputProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  models?: string[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}

export const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
  function MessageInput(
    {
      onSend,
      disabled = false,
      placeholder = "输入消息，Enter 发送…",
      models = [],
      selectedModel = "",
      onModelChange,
    },
    ref
  ) {
    const [value, setValue] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = useCallback(async () => {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      setValue("");
      setSelectedFile(null);
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
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2 rounded-[var(--radius-xl)] bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-input)] transition-shadow focus-within:shadow-[var(--shadow-input-focus)]">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            aria-hidden
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-subtle)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            aria-label="选择文件"
          >
            <Paperclip className="size-4" />
          </button>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="min-h-[26px] max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none disabled:opacity-50"
            aria-label="消息输入"
          />
          {models.length > 0 && (
            <select
              value={selectedModel}
              onChange={(e) => onModelChange?.(e.target.value)}
              disabled={disabled}
              className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-50 max-w-[180px]"
              aria-label="选择模型"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={disabled || !value.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:hover:bg-[var(--color-primary)]"
            aria-label="发送"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        {selectedFile && (
          <span className="text-xs text-[var(--color-text-muted)] truncate px-1">
            已选文件: {selectedFile.name}
          </span>
        )}
      </div>
    );
  }
);
