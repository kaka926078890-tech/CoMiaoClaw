import fs from "fs";
import path from "path";
import { config } from "./config.js";

const MEMORY_PREFIX = "以下是与当前对话相关的过往记忆：\n\n";

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

/**
 * 读记忆原始文件内容（供历史记录页展示），不存在则返回空串。
 */
export function getMemoryRaw(): string {
  const filePath = config.memoryPath;
  if (!fs.existsSync(filePath)) return "";
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * 读记忆：取最近 N 段，总字符不超过上限，拼成一段文本。
 */
export function loadMemory(): string {
  const filePath = config.memoryPath;
  if (!fs.existsSync(filePath)) {
    console.log("[memory] loadMemory 文件不存在", { path: filePath });
    return "";
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    console.log("[memory] loadMemory 读取失败", { path: filePath, error: e });
    return "";
  }

  const segments = raw
    .split(/\n(?=## )/)
    .map((s) => s.trim())
    .filter(Boolean);
  const recent = segments.slice(-config.memoryInjectCount);
  let text = recent.join("\n\n");
  if (text.length > config.memoryInjectMaxChars) {
    text = text.slice(-config.memoryInjectMaxChars);
  }
  if (!text) return "";
  console.log("[memory] loadMemory 完成", { segmentsCount: segments.length, recentCount: recent.length, textLength: text.length });
  return MEMORY_PREFIX + text;
}

/**
 * 写记忆：截断后追加一段 Markdown 到文件末尾。
 */
export function appendMemory(userContent: string, assistantContent: string): void {
  const user = truncate(userContent, config.memoryEntryMaxChars);
  const assistant = truncate(assistantContent, config.memoryEntryMaxChars);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const block = `\n## ${dateStr}\n- **User:** ${user}\n- **Assistant:** ${assistant}\n`;

  const dir = path.dirname(config.memoryPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(config.memoryPath, block, "utf-8");
  console.log("[memory] appendMemory 已写入", { path: config.memoryPath, blockLength: block.length, userLen: user.length, assistantLen: assistant.length });
}

/**
 * 清空记忆文件内容。
 */
export function clearMemory(): void {
  const dir = path.dirname(config.memoryPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.memoryPath, "", "utf-8");
}
