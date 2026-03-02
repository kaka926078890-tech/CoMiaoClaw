import { chatWithOllama, streamChatWithOllama } from "./ollama.js";
import type { OllamaMessage } from "./ollama.js";
import { getSubAgentSystem } from "./subpersona.js";

export type SubAgentStreamEvent =
  | { type: "sub_thinking"; role: string; index: number; thinking: string }
  | { type: "sub_chunk"; role: string; index: number; chunk: string }
  | { type: "sub_done"; role: string; index: number };

const DELEGATE_REGEX = /DELEGATE:\s*(.+?)\s*\|\s*(\S+)(?:\s*\|\s*([\d,\s]+))?/g;
const DELEGATE_LINE_REGEX = /^\s*DELEGATE:\s*.+\s*\|\s*\S+(?:\s*\|\s*[\d,\s]*)?\s*$/;

function parseDeps(raw: string | undefined): number[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

function normalizeDelegateText(s: string): string {
  return s.replace(/\uFF1A/g, ":").trim();
}

export interface DelegateItem {
  task: string;
  role: string;
  deps?: number[];
}

export function parseDelegate(reply: string): DelegateItem[] {
  const normalized = normalizeDelegateText(reply);
  const out: DelegateItem[] = [];
  let m: RegExpExecArray | null;
  DELEGATE_REGEX.lastIndex = 0;
  console.log("[delegate] parseDelegate input", {
    replyLength: reply.length,
    normalizedLength: normalized.length,
    replyPreview: reply.length > 500 ? `${reply.slice(0, 250)}...${reply.slice(-200)}` : reply,
  });
  while ((m = DELEGATE_REGEX.exec(normalized)) !== null) {
    const task = m[1].trim();
    const role = m[2].trim();
    const deps = parseDeps(m[3]);
    if (task && role) out.push({ task, role, deps: deps.length ? deps : undefined });
    console.log("[delegate] parseDelegate match", { fullMatch: m[0], task, role, deps });
  }
  console.log("[delegate] parseDelegate result", { delegatesCount: out.length, delegates: out });
  return out;
}

export function stripDelegateFromReply(reply: string): string {
  return reply
    .split("\n")
    .filter((line) => !DELEGATE_LINE_REGEX.test(normalizeDelegateText(line)))
    .join("\n")
    .trim();
}

export const SUB_RESULT_SEP = "\n\n---\n\n";

function buildLayers(delegates: DelegateItem[]): number[][] {
  const n = delegates.length;
  if (n === 0) return [];
  const layerOf = new Array<number>(n).fill(0);
  const safeDeps = delegates.map((d, i) => (d.deps ?? []).filter((j) => j >= 0 && j < n && j !== i));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      const deps = safeDeps[i];
      if (deps.length === 0) continue;
      const next = Math.max(...deps.map((j) => layerOf[j])) + 1;
      if (next > layerOf[i]) {
        layerOf[i] = next;
        changed = true;
      }
    }
  }
  if (layerOf.some((l) => l >= n)) {
    return [Array.from({ length: n }, (_, i) => i)];
  }
  const maxL = Math.max(...layerOf);
  const layers: number[][] = [];
  for (let l = 0; l <= maxL; l++) {
    layers.push(layerOf.map((ly, i) => (ly === l ? i : -1)).filter((i) => i >= 0));
  }
  return layers;
}

function buildTaskWithDeps(delegates: DelegateItem[], index: number, parts: string[]): string {
  const d = delegates[index];
  const deps = (d.deps ?? []).filter((j) => j >= 0 && j < delegates.length && parts[j] != null);
  if (deps.length === 0) return d.task;
  const block = deps
    .map((j) => `[${delegates[j].role}]:\n${parts[j]}`)
    .join("\n\n");
  return `[以下为依赖子任务的结果]\n\n${block}\n\n---\n\n${d.task}`;
}

export async function runSubAgents(
  delegates: DelegateItem[],
  modelOverride?: string
): Promise<string> {
  const parts: string[] = new Array(delegates.length);
  const layers = buildLayers(delegates);
  console.log("[delegate] runSubAgents", { delegatesCount: delegates.length, delegates, layers });
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    console.log("[delegate] runSubAgents layer", { layerIndex: li, indices: layer });
    await Promise.all(
      layer.map(async (idx) => {
        const d = delegates[idx];
        const system = getSubAgentSystem(d.role);
        if (!system) {
          parts[idx] = `[子角色 "${d.role}" 未配置，跳过]`;
          return;
        }
        const userContent = buildTaskWithDeps(delegates, idx, parts);
        const messages: OllamaMessage[] = [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ];
        const subReply = await chatWithOllama(messages, modelOverride);
        parts[idx] = subReply;
        console.log("[delegate] runSubAgents sub done", { role: d.role, index: idx, replyLength: subReply.length });
      })
    );
  }
  const result = delegates.map((_, i) => parts[i] ?? "").join(SUB_RESULT_SEP);
  console.log("[delegate] runSubAgents complete", { subResultLength: result.length, partsLengths: parts.map((p) => p?.length ?? 0) });
  return result;
}

export async function runSubAgentsStreaming(
  delegates: DelegateItem[],
  modelOverride: string | undefined,
  onEvent: (ev: SubAgentStreamEvent) => void
): Promise<string> {
  const parts: string[] = new Array(delegates.length);
  const layers = buildLayers(delegates);
  console.log("[delegate] runSubAgentsStreaming", { delegatesCount: delegates.length, delegates, layers });
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    console.log("[delegate] runSubAgentsStreaming layer", { layerIndex: li, indices: layer });
    await Promise.all(
      layer.map(async (idx) => {
        const d = delegates[idx];
        const system = getSubAgentSystem(d.role);
        if (!system) {
          parts[idx] = `[子角色 "${d.role}" 未配置，跳过]`;
          onEvent({ type: "sub_done", role: d.role, index: idx });
          return;
        }
        const userContent = buildTaskWithDeps(delegates, idx, parts);
        const messages: OllamaMessage[] = [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ];
        let contentAcc = "";
        await streamChatWithOllama(
          messages,
          {
            onThinking: (t) => onEvent({ type: "sub_thinking", role: d.role, index: idx, thinking: t }),
            onChunk: (c) => {
              contentAcc += c;
              onEvent({ type: "sub_chunk", role: d.role, index: idx, chunk: c });
            },
          },
          modelOverride
        );
        onEvent({ type: "sub_done", role: d.role, index: idx });
        parts[idx] = contentAcc;
        console.log("[delegate] runSubAgentsStreaming sub done", { role: d.role, index: idx, replyLength: contentAcc.length });
      })
    );
  }
  const result = delegates.map((_, i) => parts[i] ?? "").join(SUB_RESULT_SEP);
  console.log("[delegate] runSubAgentsStreaming complete", { subResultLength: result.length, partsLengths: parts.map((p) => p?.length ?? 0) });
  return result;
}
