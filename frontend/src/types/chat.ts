/** 单条消息：与 MVP 约定一致 */
export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

/** POST /chat 请求（非流式） */
export interface ChatRequest {
  message: string;
  /** 可选：Ollama 模型名（如 qwen2.5-coder:7b），由前端环境变量或配置传入 */
  model?: string;
}

/** POST /chat 响应（非流式） */
export interface ChatResponse {
  reply: string;
}
