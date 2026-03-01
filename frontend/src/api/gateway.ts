import type { ChatRequest, ChatResponse } from "@/types/chat";
import { getChatUrl, getChatStreamUrl, getGatewayConfig, getMemoryUrl, getSessionClearUrl } from "@/config/env";

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
  callbacks: {
    onThinking?: (text: string) => void;
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (err: string) => void;
    onSubThinking?: (role: string, thinking: string) => void;
    onSubChunk?: (role: string, content: string) => void;
    onSubDone?: (role: string) => void;
    onMainReplyClean?: (content: string) => void;
    onSummary?: (content: string) => void;
  },
  model?: string
): void {
  const getBody = () =>
    model
      ? Promise.resolve({ message, model })
      : getGatewayConfig().then((cfg) => ({
          message,
          ...(cfg.ollamaModel ? { model: cfg.ollamaModel } : {}),
        }));
  getBody()
    .then((body) => {
      const url = getChatStreamUrl();
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        callbacks.onError(`请求失败 ${res.status}: ${text || res.statusText}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError("响应无 body");
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
            callbacks.onDone();
            return;
          }
          try {
            const data = JSON.parse(dataStr) as {
              chunk?: string;
              thinking?: string;
              error?: string;
              type?: string;
              role?: string;
              content?: string;
            };
            if (data.error) {
              callbacks.onError(data.error);
              return;
            }
            if (data.type === "sub_thinking" && typeof data.role === "string" && typeof data.thinking === "string" && callbacks.onSubThinking)
              callbacks.onSubThinking(data.role, data.thinking);
            else if (data.type === "sub_chunk" && typeof data.role === "string" && typeof data.chunk === "string" && callbacks.onSubChunk)
              callbacks.onSubChunk(data.role, data.chunk);
            else if (data.type === "sub_done" && typeof data.role === "string" && callbacks.onSubDone)
              callbacks.onSubDone(data.role);
            else if (data.type === "main_reply_clean" && typeof data.content === "string" && callbacks.onMainReplyClean)
              callbacks.onMainReplyClean(data.content);
            else if (data.type === "summary" && typeof data.content === "string" && callbacks.onSummary)
              callbacks.onSummary(data.content);
            else {
              if (typeof data.thinking === "string" && callbacks.onThinking) callbacks.onThinking(data.thinking);
              if (typeof data.chunk === "string") callbacks.onChunk(data.chunk);
            }
          } catch {
            // skip malformed
          }
        }
      }
      if (buffer.trim().startsWith("data: ")) {
        const dataStr = buffer.trim().slice(6);
        if (dataStr === "[DONE]") {
          callbacks.onDone();
          return;
        }
        try {
          const data = JSON.parse(dataStr) as {
            chunk?: string;
            thinking?: string;
            error?: string;
            type?: string;
            role?: string;
            content?: string;
          };
          if (data.error) callbacks.onError(data.error);
          else if (data.type === "sub_thinking" && typeof data.role === "string" && typeof data.thinking === "string" && callbacks.onSubThinking)
            callbacks.onSubThinking(data.role, data.thinking);
          else if (data.type === "sub_chunk" && typeof data.role === "string" && typeof data.chunk === "string" && callbacks.onSubChunk)
            callbacks.onSubChunk(data.role, data.chunk);
          else if (data.type === "sub_done" && typeof data.role === "string" && callbacks.onSubDone)
            callbacks.onSubDone(data.role);
          else if (data.type === "main_reply_clean" && typeof data.content === "string" && callbacks.onMainReplyClean)
            callbacks.onMainReplyClean(data.content);
          else if (data.type === "summary" && typeof data.content === "string" && callbacks.onSummary)
            callbacks.onSummary(data.content);
          else {
            if (typeof data.thinking === "string" && callbacks.onThinking) callbacks.onThinking(data.thinking);
            if (typeof data.chunk === "string") callbacks.onChunk(data.chunk);
          }
        } catch {
          // skip
        }
      }
      callbacks.onDone();
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      callbacks.onError(`网络错误: ${msg}`);
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      callbacks.onError(`获取配置失败: ${msg}`);
    });
}

/** 拉取记忆文件原始内容（历史记录页） */
export async function fetchMemoryContent(): Promise<string> {
  const res = await fetch(getMemoryUrl());
  if (!res.ok) throw new Error(`记忆请求失败 ${res.status}`);
  return res.text();
}

/** 清空网关当前会话（记忆文件不变），用于新启对话 */
export async function clearSession(): Promise<void> {
  const res = await fetch(getSessionClearUrl(), { method: "POST" });
  if (!res.ok) throw new Error(`清空会话失败 ${res.status}`);
}
