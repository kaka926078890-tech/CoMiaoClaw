import type { ChatRequest, ChatResponse } from "@/types/chat";
import {
  getChatUrl,
  getChatStreamUrl,
  getGatewayConfig,
  getMemoryClearUrl,
  getMemoryUrl,
  getSessionClearUrl,
  getWorkspaceFilesUrl,
  getWorkspaceFileUrl,
  getWorkspaceFilePutUrl,
  getWorkspaceFilePostUrl,
  getSessionsUrl,
  getSessionUrl,
  getScheduledTasksUrl,
  getScheduledTaskUrl,
} from "@/config/env";
import { emitLog } from "@/console-log";

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

  emitLog("request", `POST ${url}`, { bodySize: JSON.stringify(body).length });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    emitLog("request", `POST ${url} → ${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      const err = `请求失败 ${res.status}: ${text || res.statusText}`;
      emitLog("error", err, { status: res.status });
      return {
        success: false,
        error: err,
      };
    }

    const data = (await res.json()) as ChatResponse;
    if (typeof data.reply !== "string") {
      return { success: false, error: "响应格式错误：缺少 reply" };
    }

    return { success: true, reply: data.reply };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitLog("error", `网络错误: ${msg}`);
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
    onSessionId?: (sessionId: string) => void;
  },
  model?: string,
  sessionId?: string
): void {
  const streamUrl = getChatStreamUrl();
  emitLog("request", `POST ${streamUrl} (stream)`, { messageLength: message.length, model, sessionId });
  const getBody = () =>
    model
      ? Promise.resolve({ message, model, ...(sessionId ? { sessionId } : {}) })
      : getGatewayConfig().then((cfg) => ({
          message,
          ...(cfg.ollamaModel ? { model: cfg.ollamaModel } : {}),
          ...(sessionId ? { sessionId } : {}),
        }));
  getBody()
    .then((body) => {
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
        emitLog("error", res.status === 409 ? errMsg : `请求失败 ${res.status}: ${errMsg}`, { status: res.status });
        callbacks.onError(res.status === 409 ? errMsg : `请求失败 ${res.status}: ${errMsg}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        emitLog("error", "响应无 body");
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
              sessionId?: string;
              role?: string;
              content?: string;
              skills?: string[];
              urls?: string[];
            };
            if (data.error) {
              callbacks.onError(data.error);
              return;
            }
            if (data.type === "session" && typeof data.sessionId === "string" && callbacks.onSessionId) {
              callbacks.onSessionId(data.sessionId);
            }
            const type = data.type ?? (data.chunk ? "chunk" : data.thinking ? "thinking" : "?");
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
            sessionId?: string;
            role?: string;
            content?: string;
            skills?: string[];
            urls?: string[];
          };
          if (data.error) callbacks.onError(data.error);
          else if (data.type === "session" && typeof data.sessionId === "string" && callbacks.onSessionId)
            callbacks.onSessionId(data.sessionId);
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
      emitLog("error", `网络错误: ${msg}`);
      callbacks.onError(`网络错误: ${msg}`);
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      emitLog("error", `获取配置失败: ${msg}`);
      callbacks.onError(`获取配置失败: ${msg}`);
    });
}

/** 拉取记忆文件原始内容（历史记录页） */
export async function fetchMemoryContent(): Promise<string> {
  const url = getMemoryUrl();
  emitLog("request", `GET ${url}`);
  try {
    const res = await fetch(url);
    emitLog("request", `GET ${url} → ${res.status}`);
    if (!res.ok) throw new Error(`记忆请求失败 ${res.status}`);
    return res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitLog("error", msg);
    throw e;
  }
}

/** 创建新会话，返回 sessionId */
export async function createSession(): Promise<string> {
  const url = getSessionsUrl();
  emitLog("request", `POST ${url}`);
  const res = await fetch(url, { method: "POST" });
  emitLog("request", `POST ${url} → ${res.status}`);
  if (!res.ok) throw new Error(`创建会话失败 ${res.status}`);
  const data = (await res.json()) as { sessionId: string };
  if (typeof data.sessionId !== "string") throw new Error("响应缺少 sessionId");
  return data.sessionId;
}

/** 会话列表 */
export interface SessionItem {
  id: string;
  title: string;
  updatedAt: number;
}

export async function listSessions(): Promise<SessionItem[]> {
  const url = getSessionsUrl();
  emitLog("request", `GET ${url}`);
  const res = await fetch(url);
  emitLog("request", `GET ${url} → ${res.status}`);
  if (!res.ok) throw new Error(`会话列表失败 ${res.status}`);
  const data = (await res.json()) as { sessions?: SessionItem[] };
  return Array.isArray(data.sessions) ? data.sessions : [];
}

/** 获取某会话的消息（用于恢复对话） */
export interface SessionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function getSession(sessionId: string): Promise<{ messages: SessionMessage[]; title: string; updatedAt: number }> {
  const url = getSessionUrl(sessionId);
  emitLog("request", `GET ${url}`);
  const res = await fetch(url);
  emitLog("request", `GET ${url} → ${res.status}`);
  if (!res.ok) throw new Error(`加载会话失败 ${res.status}`);
  return res.json() as Promise<{ messages: SessionMessage[]; title: string; updatedAt: number }>;
}

/** 清空指定会话消息 */
export async function clearSession(sessionId: string): Promise<void> {
  const url = getSessionClearUrl();
  emitLog("request", `POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  emitLog("request", `POST ${url} → ${res.status}`);
  if (!res.ok) throw new Error(`清空会话失败 ${res.status}`);
}

/** 清空历史记忆文件内容 */
export async function clearMemory(): Promise<void> {
  const url = getMemoryClearUrl();
  emitLog("request", `POST ${url}`);
  try {
    const res = await fetch(url, { method: "POST" });
    emitLog("request", `POST ${url} → ${res.status}`);
    if (!res.ok) throw new Error(`清空记忆失败 ${res.status}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitLog("error", msg);
    throw e;
  }
}

export interface WorkspaceFiles {
  rootFiles: { kind: "file"; name: string; path: string }[];
  agents: { kind: "file"; name: string; path: string }[];
  skills: { kind: "file"; name: string; path: string }[];
}

export async function listWorkspaceFiles(): Promise<WorkspaceFiles> {
  const url = getWorkspaceFilesUrl();
  emitLog("request", `GET ${url}`);
  try {
    const res = await fetch(url);
    emitLog("request", `GET ${url} → ${res.status}`);
    if (!res.ok) throw new Error(`工作区列表失败 ${res.status}`);
    return res.json() as Promise<WorkspaceFiles>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitLog("error", msg);
    throw e;
  }
}

export async function getWorkspaceFileContent(path: string): Promise<string> {
  const url = getWorkspaceFileUrl(path);
  emitLog("request", `GET ${url}`);
  try {
    const res = await fetch(url);
    emitLog("request", `GET ${url} → ${res.status}`);
    if (!res.ok) throw new Error(`读取文件失败 ${res.status}`);
    return res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitLog("error", msg);
    throw e;
  }
}

export async function putWorkspaceFile(path: string, content: string): Promise<void> {
  const url = getWorkspaceFilePutUrl();
  emitLog("request", `PUT ${url}`, { path });
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    emitLog("request", `PUT ${url} → ${res.status}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      const err = data.error ?? `保存失败 ${res.status}`;
      emitLog("error", err);
      throw new Error(err);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("保存失败")) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    emitLog("error", msg);
    throw e;
  }
}

export async function createWorkspaceFile(path: string, content: string): Promise<void> {
  const url = getWorkspaceFilePostUrl();
  emitLog("request", `POST ${url}`, { path });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    emitLog("request", `POST ${url} → ${res.status}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      const err = data.error ?? `创建失败 ${res.status}`;
      emitLog("error", err);
      throw new Error(err);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("创建失败")) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    emitLog("error", msg);
    throw e;
  }
}

export interface ScheduledTask {
  id: string;
  name: string;
  type: "memory-compact" | "heartbeat" | "time-file" | "agent-prompt" | "agent-run";
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt?: number;
  prompt?: string;
  action?: "log" | "file";
  instruction?: string;
}

export async function listScheduledTasks(): Promise<ScheduledTask[]> {
  const url = getScheduledTasksUrl();
  emitLog("request", `GET ${url}`);
  const res = await fetch(url);
  emitLog("request", `GET ${url} → ${res.status}`);
  if (!res.ok) throw new Error(`定时任务列表失败 ${res.status}`);
  const data = (await res.json()) as { tasks?: ScheduledTask[] };
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function createScheduledTask(input: {
  name: string;
  type: "memory-compact" | "heartbeat" | "time-file" | "agent-prompt" | "agent-run";
  intervalMinutes: number;
  enabled?: boolean;
  prompt?: string;
  action?: "log" | "file";
  instruction?: string;
}): Promise<ScheduledTask> {
  const url = getScheduledTasksUrl();
  emitLog("request", `POST ${url}`);
  const body: Record<string, unknown> = { ...input, enabled: input.enabled ?? true };
  if (input.type === "agent-prompt" && input.prompt != null) body.prompt = input.prompt;
  if (input.type === "agent-prompt" && input.action != null) body.action = input.action;
  if (input.type === "agent-run" && input.instruction != null) body.instruction = input.instruction;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  emitLog("request", `POST ${url} → ${res.status}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `创建失败 ${res.status}`);
  }
  return res.json() as Promise<ScheduledTask>;
}

export async function updateScheduledTask(
  id: string,
  input: Partial<{
    name: string;
    type: "memory-compact" | "heartbeat" | "time-file" | "agent-prompt" | "agent-run";
    intervalMinutes: number;
    enabled: boolean;
    prompt: string;
    action: "log" | "file";
    instruction: string;
  }>
): Promise<ScheduledTask> {
  const url = getScheduledTaskUrl(id);
  emitLog("request", `PUT ${url}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  emitLog("request", `PUT ${url} → ${res.status}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `更新失败 ${res.status}`);
  }
  return res.json() as Promise<ScheduledTask>;
}

export async function deleteScheduledTask(id: string): Promise<void> {
  const url = getScheduledTaskUrl(id);
  emitLog("request", `DELETE ${url}`);
  const res = await fetch(url, { method: "DELETE" });
  emitLog("request", `DELETE ${url} → ${res.status}`);
  if (!res.ok) throw new Error(`删除失败 ${res.status}`);
}
