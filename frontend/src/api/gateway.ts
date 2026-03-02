import type { ChatRequest, ChatResponse } from "@/types/chat";
import { getChatUrl, getChatStreamUrl, getGatewayConfig, getMemoryClearUrl, getMemoryUrl, getSessionClearUrl } from "@/config/env";

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
    onSkillLoaded?: (skills: string[]) => void;
    onFetchUrlDone?: (urls: string[]) => void;
  },
  model?: string
): void {
  const streamUrl = getChatStreamUrl();
  console.log("[frontend] sendMessageStreaming 调用", { messageLength: message.length, messagePreview: message.slice(0, 80), url: streamUrl, model });
  const getBody = () =>
    model
      ? Promise.resolve({ message, model })
      : getGatewayConfig().then((cfg) => ({
          message,
          ...(cfg.ollamaModel ? { model: cfg.ollamaModel } : {}),
        }));
  getBody()
    .then((body) => {
      console.log("[frontend] sendMessageStreaming 请求体", body);
      return fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    })
    .then(async (res) => {
      console.log("[frontend] sendMessageStreaming 响应", { status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()) });
      if (!res.ok) {
        const text = await res.text();
        let errMsg = text || res.statusText;
        if (res.status === 409) {
          try {
            const j = JSON.parse(text) as { error?: string };
            if (typeof j.error === "string") errMsg = j.error;
          } catch {
            /* use errMsg as is */
          }
        }
        console.log("[frontend] sendMessageStreaming 错误", { status: res.status, errMsg });
        callbacks.onError(res.status === 409 ? errMsg : `请求失败 ${res.status}: ${errMsg}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        console.log("[frontend] sendMessageStreaming 无 body");
        callbacks.onError("响应无 body");
        return;
      }
      console.log("[frontend] sendMessageStreaming 开始读取 SSE 流");
      const decoder = new TextDecoder();
      let buffer = "";
      let eventCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[frontend] sendMessageStreaming 流结束", { eventCount });
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") {
            console.log("[frontend] sendMessageStreaming 收到 [DONE]");
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
              skills?: string[];
              urls?: string[];
            };
            if (data.error) {
              console.log("[frontend] sendMessageStreaming SSE error", data.error);
              callbacks.onError(data.error);
              return;
            }
            const type = data.type ?? (data.chunk ? "chunk" : data.thinking ? "thinking" : "?");
            if (eventCount < 5 || type === "summary" || type === "main_reply_clean" || type === "skill_loaded" || type === "fetch_url_done")
              console.log("[frontend] sendMessageStreaming SSE 事件", { eventCount, type, hasChunk: !!data.chunk, hasThinking: !!data.thinking, contentLen: (data.content as string)?.length });
            eventCount++;
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
            else if (data.type === "skill_loaded" && Array.isArray(data.skills) && callbacks.onSkillLoaded)
              callbacks.onSkillLoaded(data.skills);
            else if (data.type === "fetch_url_done" && Array.isArray(data.urls) && callbacks.onFetchUrlDone)
              callbacks.onFetchUrlDone(data.urls);
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
            skills?: string[];
            urls?: string[];
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
          else if (data.type === "skill_loaded" && Array.isArray(data.skills) && callbacks.onSkillLoaded)
            callbacks.onSkillLoaded(data.skills);
          else if (data.type === "fetch_url_done" && Array.isArray(data.urls) && callbacks.onFetchUrlDone)
            callbacks.onFetchUrlDone(data.urls);
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
      console.log("[frontend] sendMessageStreaming 异常", { error: msg });
      callbacks.onError(`网络错误: ${msg}`);
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("[frontend] sendMessageStreaming 配置/请求异常", { error: msg });
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

/** 清空历史记忆文件内容 */
export async function clearMemory(): Promise<void> {
  const res = await fetch(getMemoryClearUrl(), { method: "POST" });
  if (!res.ok) throw new Error(`清空记忆失败 ${res.status}`);
}
