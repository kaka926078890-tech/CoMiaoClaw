import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { getMemoryRaw } from "./memory.js";
import { chatWithOllama } from "./ollama.js";
import { runInstructionHeadless } from "./run-headless.js";

export type ScheduledTaskType = "memory-compact" | "heartbeat" | "time-file" | "agent-prompt" | "agent-run";

export type ScheduledTaskAction = "log" | "file";

export interface ScheduledTask {
  id: string;
  name: string;
  type: ScheduledTaskType;
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt?: number;
  prompt?: string;
  action?: ScheduledTaskAction;
  instruction?: string;
}

const DEFAULT_PATH = path.join(config.workspaceDir, "scheduled-tasks.json");
let tasks: ScheduledTask[] = [];
let tickId: ReturnType<typeof setInterval> | undefined;
const runningAgentRunIds = new Set<string>();

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function loadFromFile(): void {
  try {
    if (fs.existsSync(DEFAULT_PATH)) {
      const raw = fs.readFileSync(DEFAULT_PATH, "utf-8");
      const data = JSON.parse(raw) as { tasks?: ScheduledTask[] };
      tasks = Array.isArray(data.tasks) ? data.tasks : [];
    } else {
      tasks = [];
    }
  } catch {
    tasks = [];
  }
}

function saveToFile(): void {
  try {
    const dir = path.dirname(DEFAULT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DEFAULT_PATH, JSON.stringify({ tasks }, null, 2), "utf-8");
  } catch (e) {
    console.error("[scheduled-tasks] saveToFile", e);
  }
}

const AGENT_PROMPT_SYSTEM =
  "你是助手。根据用户要求直接回复内容，不要输出 DELEGATE、SKILL、FETCH_URL 等协议，只输出用户要的正文。";

function runTask(task: ScheduledTask): void {
  if (task.type === "agent-run") {
    if (runningAgentRunIds.has(task.id)) {
      console.log("[scheduled-tasks] agent-run 跳过（上一轮未结束）", { taskId: task.id });
      return;
    }
    const instruction = (task.instruction ?? "").trim();
    if (!instruction) {
      console.error("[scheduled-tasks] agent-run 缺少 instruction", { taskId: task.id });
      task.lastRunAt = Date.now();
      saveToFile();
      return;
    }
    task.lastRunAt = Date.now();
    saveToFile();
    runningAgentRunIds.add(task.id);
    console.log("[scheduled-tasks] agent-run 开始", {
      taskId: task.id,
      taskName: task.name,
      instruction: instruction.slice(0, 120),
      localFileRoot: config.localFileRoot || "(未配置，WRITE_FILE 不会执行)",
    });
    runInstructionHeadless(instruction)
      .then((lastReply) => {
        console.log("[scheduled-tasks] agent-run 完成", {
          taskId: task.id,
          taskName: task.name,
          replyLength: lastReply.length,
        });
      })
      .catch((e) => {
        console.error("[scheduled-tasks] agent-run 失败", {
          taskId: task.id,
          error: e instanceof Error ? e.message : String(e),
        });
      })
      .finally(() => {
        runningAgentRunIds.delete(task.id);
      });
    return;
  }
  if (task.type === "agent-prompt") {
    const prompt = (task.prompt ?? "").trim();
    if (!prompt) {
      console.error("[scheduled-tasks] agent-prompt 缺少 prompt", { taskId: task.id });
      task.lastRunAt = Date.now();
      saveToFile();
      return;
    }
    task.lastRunAt = Date.now();
    saveToFile();
    chatWithOllama([
      { role: "system", content: AGENT_PROMPT_SYSTEM },
      { role: "user", content: prompt },
    ])
      .then((reply) => {
        const action = task.action === "log" ? "log" : "file";
        if (action === "log") {
          console.log("[scheduled-tasks] agent-prompt 结果", { taskId: task.id, taskName: task.name, reply: reply.slice(0, 200) });
        } else {
          const outDir = path.join(config.workspaceDir, "scheduled-output");
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          const safeName = task.name.replace(/[^\w\u4e00-\u9fff-]/g, "_").slice(0, 50);
          const filePath = path.join(outDir, `${safeName}.md`);
          const block = `\n## ${new Date().toISOString()}\n\n${reply.trim()}\n`;
          fs.appendFileSync(filePath, block, "utf-8");
          console.log("[scheduled-tasks] agent-prompt 已追加到文件", { path: filePath });
        }
      })
      .catch((e) => {
        console.error("[scheduled-tasks] agent-prompt 失败", { taskId: task.id, error: e instanceof Error ? e.message : String(e) });
      });
    return;
  }
  if (task.type === "memory-compact") {
    try {
      const raw = getMemoryRaw();
      const segments = raw.split(/\n(?=## )/).map((s) => s.trim()).filter(Boolean);
      const keep = 20;
      if (segments.length > keep) {
        const trimmed = segments.slice(-keep).join("\n\n");
        const dir = path.dirname(config.memoryPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(config.memoryPath, trimmed, "utf-8");
        console.log("[scheduled-tasks] memory-compact 完成", { kept: keep, removed: segments.length - keep });
      }
    } catch (e) {
      console.error("[scheduled-tasks] memory-compact 失败", e);
    }
  } else if (task.type === "heartbeat") {
    console.log("[scheduled-tasks] heartbeat", { taskId: task.id, taskName: task.name });
  } else if (task.type === "time-file") {
    const baseDir =
      config.localFileRoot.length > 0 ? config.localFileRoot : config.workspaceDir;
    const dir = path.join(baseDir, "test");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `time-${Date.now()}.txt`;
    const filePath = path.join(dir, filename);
    const content = new Date().toISOString();
    fs.writeFileSync(filePath, content, "utf-8");
    console.log("[scheduled-tasks] time-file 完成", { path: filePath });
  }
  task.lastRunAt = Date.now();
  saveToFile();
}

function tick(): void {
  const now = Date.now();
  for (const task of tasks) {
    if (!task.enabled) continue;
    const intervalMs = task.intervalMinutes * 60 * 1000;
    const last = task.lastRunAt ?? 0;
    if (now - last >= intervalMs) {
      runTask(task);
    }
  }
}

export function initScheduledTasks(): void {
  loadFromFile();
  if (tickId) clearInterval(tickId);
  tickId = setInterval(tick, 60000);
  console.log("[scheduled-tasks] 调度已启动，间隔 60s 检查");
}

export function listScheduledTasks(): ScheduledTask[] {
  loadFromFile();
  return [...tasks];
}

export function createScheduledTask(input: Omit<ScheduledTask, "id" | "lastRunAt">): ScheduledTask {
  loadFromFile();
  const task: ScheduledTask = {
    ...input,
    id: uuid(),
    lastRunAt: undefined,
  };
  tasks.push(task);
  saveToFile();
  return task;
}

export function updateScheduledTask(id: string, input: Partial<Omit<ScheduledTask, "id">>): ScheduledTask | null {
  loadFromFile();
  const i = tasks.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const next = { ...tasks[i]!, ...input, id: tasks[i]!.id };
  tasks[i] = next;
  saveToFile();
  return next;
}

export function deleteScheduledTask(id: string): boolean {
  loadFromFile();
  const i = tasks.findIndex((t) => t.id === id);
  if (i < 0) return false;
  tasks.splice(i, 1);
  saveToFile();
  return true;
}

const TIME_TASK_REGEX = /^\s*TIME_TASK:\s*(.+)$/;

function normalizeProtocolLine(line: string): string {
  return line
    .trim()
    .replace(/^`{3}\s*/, "")
    .replace(/\s*`{3}$/, "")
    .trim();
}

function slugName(s: string, maxLen: number): string {
  const t = s.replace(/[^\w\u4e00-\u9fff-]/g, "_").slice(0, maxLen).trim();
  return t || "定时任务";
}

export interface ParsedScheduledTaskCreate {
  name: string;
  type: ScheduledTaskType;
  intervalMinutes: number;
  prompt?: string;
  action?: ScheduledTaskAction;
  instruction?: string;
}

export function parseScheduledTaskCreate(reply: string): ParsedScheduledTaskCreate | null {
  const lines = reply.split(/\n/);
  for (const line of lines) {
    const normalized = normalizeProtocolLine(line);
    const m = normalized.match(TIME_TASK_REGEX);
    if (!m) continue;
    const rest = m[1].trim();
    const sep = " | ";
    const idx = rest.indexOf(sep);
    if (idx < 0) return null;
    const intervalStr = rest.slice(0, idx).trim();
    const taskContent = rest.slice(idx + sep.length).trim();
    if (!taskContent) return null;
    const intervalMinutes = parseInt(intervalStr, 10);
    if (Number.isNaN(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) return null;
    const name = slugName(taskContent, 30);
    return {
      name,
      type: "agent-run",
      intervalMinutes,
      instruction: taskContent,
    };
  }
  return null;
}

const TIME_TASK_LINE_REGEX = /^\s*TIME_TASK:\s*.+$/;

export function stripScheduledTaskCreateFromReply(reply: string): string {
  return reply
    .split("\n")
    .filter((line) => !TIME_TASK_LINE_REGEX.test(normalizeProtocolLine(line)))
    .join("\n")
    .trim();
}
