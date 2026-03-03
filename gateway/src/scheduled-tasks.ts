import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { getMemoryRaw } from "./memory.js";

export type ScheduledTaskType = "memory-compact" | "heartbeat";

export interface ScheduledTask {
  id: string;
  name: string;
  type: ScheduledTaskType;
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt?: number;
}

const DEFAULT_PATH = path.join(config.workspaceDir, "scheduled-tasks.json");
let tasks: ScheduledTask[] = [];
let tickId: ReturnType<typeof setInterval> | undefined;

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

function runTask(task: ScheduledTask): void {
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
