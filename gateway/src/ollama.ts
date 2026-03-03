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
function logOllamaRequest(label: string, url: string, body: { model: string; messages: OllamaMessage[]; stream: boolean; think?: boolean }) {
  const msgSummary = body.messages.map((m, i) => {
    const len = m.content?.length ?? 0;
    const preview = len > 200 ? `${m.content.slice(0, 100)}...${m.content.slice(-80)}` : m.content;
    return `[${i}] ${m.role} len=${len} content="${preview}"`;
  });
  console.log(`[ollama] ${label} POST ${url}`, {
    model: body.model,
    stream: body.stream,
    think: (body as { think?: boolean }).think,
    messagesCount: body.messages.length,
    messages: msgSummary,
  });
}

function logOllamaResponse(label: string, data: unknown, contentPreview?: string) {
  const content = typeof (data as { message?: { content?: string } }).message?.content === "string"
    ? (data as { message: { content: string } }).message.content
    : "";
  const len = content.length;
  const preview = contentPreview ?? (len > 300 ? `${content.slice(0, 150)}...${content.slice(-100)}` : content);
  console.log(`[ollama] ${label} response`, {
    hasMessage: !!(data as { message?: unknown }).message,
    contentLength: len,
    contentPreview: preview,
    rawKeys: data && typeof data === "object" ? Object.keys(data as object) : [],
  });
}

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
  logOllamaRequest("chatWithOllama", url, body);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ollama] chatWithOllama fetch error", {
      url,
      error: msg,
      hint: "若为 fetch failed / ECONNREFUSED，请确认 Ollama 已启动（如终端执行 ollama serve）并监听 " + config.ollamaHost,
    });
    throw new Error(
      `无法连接 Ollama（${config.ollamaHost}）：${msg}。若为连接失败，请确认 Ollama 已启动并监听该地址。`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[ollama] chatWithOllama non-ok", { status: res.status, body: text });
    throw new Error(`Ollama 返回 ${res.status}：${text || res.statusText}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  logOllamaResponse("chatWithOllama", data);
  if (data.error) {
    console.error("[ollama] chatWithOllama api error", { error: data.error });
    throw new Error(`Ollama 错误：${data.error}`);
  }
  const content = data.message?.content;
  if (typeof content !== "string") {
    console.error("[ollama] chatWithOllama invalid response", { data });
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
  let body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    think: true,
  };
  logOllamaRequest("streamChatWithOllama", url, { model, messages, stream: true } as { model: string; messages: OllamaMessage[]; stream: boolean; think?: boolean });

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && /does not support thinking/i.test(text)) {
      body = { model, messages, stream: true };
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama 返回 ${res.status}：${errText || res.statusText}`);
      }
    } else {
      throw new Error(`Ollama 返回 ${res.status}：${text || res.statusText}`);
    }
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Ollama 流式响应无 body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let firstChunk = true;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log("[ollama] streamChatWithOllama 流读取结束", { fullContentLength: fullContent.length });
      break;
    }
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
        if (typeof content === "string") {
          if (firstChunk) {
            console.log("[ollama] streamChatWithOllama 收到首块 content", { length: content.length, preview: content.slice(0, 80) });
            firstChunk = false;
          }
          fullContent += content;
          onChunk(content);
        }
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
      if (typeof content === "string") {
        fullContent += content;
        onChunk(content);
      }
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
  }
  console.log("[ollama] streamChatWithOllama done", {
    totalContentLength: fullContent.length,
    contentPreview: fullContent.length > 400 ? `${fullContent.slice(0, 200)}...${fullContent.slice(-150)}` : fullContent,
  });
}
