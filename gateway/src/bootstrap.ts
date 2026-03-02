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

function parseSkillFrontmatter(raw: string): { name?: string; description?: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const nameMatch = block.match(/^name:\s*(.+)$/m);
  const descMatch = block.match(/^description:\s*(.+)$/m);
  const name = nameMatch?.[1]?.trim();
  const description = descMatch?.[1]?.trim();
  return { name, description };
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
      const { name: fmName, description: fmDesc } = parseSkillFrontmatter(raw);
      const body = raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim();
      const name = fmName ?? body.split(/\n/)[0]?.trim().replace(/^#\s*/, "") ?? e.name;
      const descSource = fmDesc ?? body.slice(body.indexOf("\n") + 1).trim().replace(/\s+/g, " ").slice(0, descMax);
      const desc = descSource ? descSource + (descSource.length >= descMax ? "…" : "") : "（无描述）";
      lines.push(`- **${e.name}**：${name} ${desc}`);
    } catch {
      lines.push(`- **${e.name}**：（未读）`);
    }
  }
  if (lines.length === 0) return "";
  return "**可用技能**（需要某技能时在回复中写 `SKILL: <技能名>`，系统会加载全文并再让你回复一轮；有 DELEGATE 时勿混用 SKILL）：\n" + lines.join("\n");
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
  console.log("[bootstrap] loadBootstrap 开始");
  const parts: string[] = [];
  const keys: string[] = [];
  for (const { key, getContent } of BOOTSTRAP_ORDER) {
    const content = getContent();
    if (content) {
      parts.push(content);
      keys.push(key);
    }
  }
  const memoryBlock = loadMemory();
  if (memoryBlock) {
    parts.push(memoryBlock);
    keys.push("MEMORY");
  }
  const combined = parts.join("\n\n");
  const total = combined.length;
  const capped = total <= config.bootstrapTotalMaxChars ? combined : capTotal(parts, config.bootstrapTotalMaxChars);
  console.log("[bootstrap] loadBootstrap 完成", {
    keys,
    partsCount: parts.length,
    totalChars: total,
    cappedChars: capped.length,
  });
  return capped;
}
