import type { ChatRequest, ChatResponse } from "@/types/chat";
import { getChatUrl, getChatStreamUrl, getGatewayConfig } from "@/config/env";

export interface SendMessageResult {
  success: true;
  reply: string;
}

export interface SendMessageError {
  success: false;
  error: string;
}

export type SendMessageOutcome = SendMessageResult | SendMessageError;

/**
 * 调用网关 POST /chat，发送一条用户消息并获取助手回复（非流式）。
 * 网关约定：body { message }, response { reply }。
 */
export async function sendMessage(message: string): Promise<SendMessageOutcome> {
  const cfg = await getGatewayConfig();
  const url = getChatUrl();
  const body: ChatRequest = {
    message,
    ...(cfg.ollamaModel ? { model: cfg.ollamaModel } : {}),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `请求失败 ${res.status}: ${text || res.statusText}`,
      };
    }

    const data = (await res.json()) as ChatResponse;
    if (typeof data.reply !== "string") {
      return { success: false, error: "响应格式错误：缺少 reply" };
    }

    return { success: true, reply: data.reply };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `网络错误: ${msg}` };
  }
}

export function sendMessageStreaming(
  message: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): void {
  getGatewayConfig()
    .then((cfg) => {
      const url = getChatStreamUrl();
      const body: ChatRequest = {
        message,
        ...(cfg.ollamaModel ? { model: cfg.ollamaModel } : {}),
      };
      return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        onError(`请求失败 ${res.status}: ${text || res.statusText}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        onError("响应无 body");
        return;
      }
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
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") {
            onDone();
            return;
          }
          try {
            const data = JSON.parse(dataStr) as { chunk?: string; error?: string };
            if (data.error) {
              onError(data.error);
              return;
            }
            if (typeof data.chunk === "string") onChunk(data.chunk);
          } catch {
            // skip malformed
          }
        }
      }
      if (buffer.trim().startsWith("data: ")) {
        const dataStr = buffer.trim().slice(6);
        if (dataStr === "[DONE]") {
          onDone();
          return;
        }
        try {
          const data = JSON.parse(dataStr) as { chunk?: string; error?: string };
          if (data.error) onError(data.error);
          else if (typeof data.chunk === "string") onChunk(data.chunk);
        } catch {
          // skip
        }
      }
      onDone();
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      onError(`网络错误: ${msg}`);
    });
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      onError(`获取配置失败: ${msg}`);
    });
}
