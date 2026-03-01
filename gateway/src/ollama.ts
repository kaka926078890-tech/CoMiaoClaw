import { config } from "./config.js";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Ollama /api/chat 非流式请求 */
interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream: false;
}

/** Ollama /api/chat 非流式响应 */
interface OllamaChatResponse {
  message?: { role?: string; content?: string };
  error?: string;
}

interface OllamaStreamChunk {
  response?: string;
  thinking?: string;
  message?: { role?: string; content?: string; thinking?: string };
  done?: boolean;
  error?: string;
}

/**
 * 调用 Ollama /api/chat（非流式），返回助手回复文本。
 * 若 Ollama 不可用或返回错误，抛出带 message 的 Error。
 * @param modelOverride 可选，覆盖网关默认模型（由前端传入时使用）
 */
export async function chatWithOllama(
  messages: OllamaMessage[],
  modelOverride?: string
): Promise<string> {
  const model = modelOverride ?? config.ollamaModel;
  const url = `${config.ollamaHost}/api/chat`;
  const body: OllamaChatRequest = {
    model,
    messages,
    stream: false,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`无法连接 Ollama（${config.ollamaHost}）：${msg}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama 返回 ${res.status}：${text || res.statusText}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  if (data.error) {
    throw new Error(`Ollama 错误：${data.error}`);
  }
  const content = data.message?.content;
  if (typeof content !== "string") {
    throw new Error("Ollama 响应格式异常：缺少 message.content");
  }
  return content;
}

export interface StreamCallbacks {
  onThinking?: (text: string) => void;
  onChunk: (text: string) => void;
}

export async function streamChatWithOllama(
  messages: OllamaMessage[],
  callbacks: StreamCallbacks,
  modelOverride?: string
): Promise<void> {
  const { onThinking, onChunk } = callbacks;
  const model = modelOverride ?? config.ollamaModel;
  const url = `${config.ollamaHost}/api/chat`;
  const body = {
    model,
    messages,
    stream: true,
    think: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama 返回 ${res.status}：${text || res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Ollama 流式响应无 body");

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed) as OllamaStreamChunk;
        if (data.error) throw new Error(data.error);
        const thinking = data.message?.thinking ?? data.thinking;
        const content = data.response ?? data.message?.content;
        if (typeof thinking === "string" && onThinking) onThinking(thinking);
        if (typeof content === "string") onChunk(content);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  if (buffer.trim()) {
    try {
      const data = JSON.parse(buffer.trim()) as OllamaStreamChunk;
      if (data.error) throw new Error(data.error);
      const thinking = data.message?.thinking ?? data.thinking;
      const content = data.response ?? data.message?.content;
      if (typeof thinking === "string" && onThinking) onThinking(thinking);
      if (typeof content === "string") onChunk(content);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
  }
}
