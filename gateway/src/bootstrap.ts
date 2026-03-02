import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { loadMemory } from "./memory.js";

function readFileTruncated(filePath: string, maxChars: number): string {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return "";
  try {
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (raw.length <= maxChars) return raw;
    return raw.slice(0, maxChars) + "…";
  } catch {
    return "";
  }
}

function readOptional(absolutePath: string): string {
  return readFileTruncated(absolutePath, config.bootstrapMaxChars);
}

function readAgents(): string {
  return readFileTruncated(config.agentsPath, config.bootstrapMaxChars);
}

function getAgentListBlock(): string {
  const dir = config.agentsDir;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const lines: string[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md")) continue;
    const role = e.name.slice(0, -3);
    if (!/^[\w-]+$/.test(role)) continue;
    const filePath = path.join(dir, e.name);
    try {
      const raw = fs.readFileSync(filePath, "utf-8").trim();
      const firstLine = raw.split(/\n/)[0]?.trim().slice(0, 120) ?? role;
      lines.push(`- **${role}**：${firstLine}`);
    } catch {
      lines.push(`- **${role}**：（未读）`);
    }
  }
  if (lines.length === 0) return "";
  return "**当前子角色及其能力**（仅对以下角色可派发）：\n" + lines.join("\n");
}

function getSkillsListBlock(): string {
  const dir = config.skillsDir;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const lines: string[] = [];
  const descMax = 200;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillPath = path.join(dir, e.name, "SKILL.md");
    if (!fs.existsSync(skillPath) || !fs.statSync(skillPath).isFile()) continue;
    try {
      const raw = fs.readFileSync(skillPath, "utf-8").trim();
      const firstLine = raw.split(/\n/)[0]?.trim() ?? e.name;
      const rest = raw.slice(firstLine.length).trim().replace(/\s+/g, " ").slice(0, descMax);
      const desc = rest ? rest + (rest.length >= descMax ? "…" : "") : "（无描述）";
      lines.push(`- **${e.name}**：${firstLine} ${desc}`);
    } catch {
      lines.push(`- **${e.name}**：（未读）`);
    }
  }
  if (lines.length === 0) return "";
  return "**可用技能**（需要时可由用户或后续 read 工具加载 SKILL.md 全文）：\n" + lines.join("\n");
}

const BOOTSTRAP_ORDER: { key: string; getContent: () => string }[] = [
  { key: "AGENTS", getContent: readAgents },
  { key: "AGENT_LIST", getContent: getAgentListBlock },
  { key: "SOUL", getContent: () => readOptional(config.soulPath) },
  { key: "IDENTITY", getContent: () => readOptional(config.identityPath) },
  { key: "USER", getContent: () => readOptional(config.userPath) },
  { key: "TOOLS", getContent: () => readOptional(config.toolsPath) },
  { key: "SKILLS", getContent: getSkillsListBlock },
];

function capTotal(parts: string[], totalMax: number): string {
  let out = "";
  for (const p of parts) {
    if (!p) continue;
    const next = out ? out + "\n\n" + p : p;
    if (next.length > totalMax) {
      const remaining = totalMax - out.length - 2;
      if (remaining <= 0) break;
      out = out ? out + "\n\n" + p.slice(0, remaining) + "…" : p.slice(0, remaining) + "…";
      break;
    }
    out = next;
  }
  return out;
}

export function loadBootstrap(): string {
  const parts: string[] = [];
  for (const { getContent } of BOOTSTRAP_ORDER) {
    const content = getContent();
    if (content) parts.push(content);
  }
  const memoryBlock = loadMemory();
  if (memoryBlock) parts.push(memoryBlock);
  const combined = parts.join("\n\n");
  if (combined.length <= config.bootstrapTotalMaxChars) return combined;
  return capTotal(parts, config.bootstrapTotalMaxChars);
}
