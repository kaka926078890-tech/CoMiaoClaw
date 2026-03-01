import { chatWithOllama, streamChatWithOllama } from "./ollama.js";
import type { OllamaMessage } from "./ollama.js";
import { getSubPersona } from "./subpersona.js";

export type SubAgentStreamEvent =
  | { type: "sub_thinking"; role: string; thinking: string }
  | { type: "sub_chunk"; role: string; chunk: string }
  | { type: "sub_done"; role: string };

const DELEGATE_REGEX = /DELEGATE:\s*(.+?)\s*\|\s*(\S+)/g;

export interface DelegateItem {
  task: string;
  role: string;
}

/**
 * 从主 agent 回复中解析所有 DELEGATE: 子任务描述 | 子角色名，返回数组；无则 []。
 */
export function parseDelegate(reply: string): DelegateItem[] {
  const out: DelegateItem[] = [];
  let m: RegExpExecArray | null;
  DELEGATE_REGEX.lastIndex = 0;
  while ((m = DELEGATE_REGEX.exec(reply)) !== null) {
    const task = m[1].trim();
    const role = m[2].trim();
    if (task && role) out.push({ task, role });
  }
  return out;
}

/**
 * 去掉回复中的 DELEGATE 行，用于写入主会话的「主回复」部分。
 */
export function stripDelegateFromReply(reply: string): string {
  return reply
    .split("\n")
    .filter((line) => !/^\s*DELEGATE:\s*.+\s*\|\s*\S+/.test(line.trim()))
    .join("\n")
    .trim();
}

const SUB_RESULT_SEP = "\n\n---\n\n";

/**
 * 串行执行子 agent，将各子回复用分隔符拼成一段 subResult。
 * 未配置的 role 会跳过并记一句说明。
 */
export async function runSubAgents(
  delegates: DelegateItem[],
  modelOverride?: string
): Promise<string> {
  const parts: string[] = [];
  for (const { task, role } of delegates) {
    const system = getSubPersona(role);
    if (!system) {
      parts.push(`[子角色 "${role}" 未配置，跳过]`);
      continue;
    }
    const messages: OllamaMessage[] = [
      { role: "system", content: system },
      { role: "user", content: task },
    ];
    const subReply = await chatWithOllama(messages, modelOverride);
    parts.push(subReply);
  }
  return parts.join(SUB_RESULT_SEP);
}

/**
 * 串行执行子 agent，每个子 agent 流式输出思考与内容，通过 onEvent 推给调用方；并返回拼接后的 subResult。
 */
export async function runSubAgentsStreaming(
  delegates: DelegateItem[],
  modelOverride: string | undefined,
  onEvent: (ev: SubAgentStreamEvent) => void
): Promise<string> {
  const parts: string[] = [];
  for (const { task, role } of delegates) {
    const system = getSubPersona(role);
    if (!system) {
      parts.push(`[子角色 "${role}" 未配置，跳过]`);
      continue;
    }
    const messages: OllamaMessage[] = [
      { role: "system", content: system },
      { role: "user", content: task },
    ];
    let thinkingAcc = "";
    let contentAcc = "";
    await streamChatWithOllama(
      messages,
      {
        onThinking: (t) => {
          thinkingAcc += t;
          onEvent({ type: "sub_thinking", role, thinking: t });
        },
        onChunk: (c) => {
          contentAcc += c;
          onEvent({ type: "sub_chunk", role, chunk: c });
        },
      },
      modelOverride
    );
    onEvent({ type: "sub_done", role });
    parts.push(contentAcc);
  }
  return parts.join(SUB_RESULT_SEP);
}
