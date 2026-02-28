import type { ChatRequest, ChatResponse } from "@/types/chat";
import { config, getChatUrl } from "@/config/env";

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
  const url = getChatUrl();
  const body: ChatRequest = {
    message,
    ...(config.ollamaModel ? { model: config.ollamaModel } : {}),
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
