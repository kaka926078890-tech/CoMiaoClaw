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
  return "**可用技能**（需要某技能时在回复中写 `SKILL: <技能名>`，系统会加载全文并再让你回复一轮；问时间请直接看上方当前日期时间；有 DELEGATE 时勿混用 SKILL）：\n" + lines.join("\n");
}

function getCurrentDatetimeBlock(): string {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const str = now.toLocaleString("zh-CN", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `**当前日期时间（服务器）**：${str} ${tz}（你可直接据此回答用户问时间，不属超权）`;
}

export async function fetchExternalTime(): Promise<string> {
  try {
    const res = await fetch("https://worldtimeapi.org/api/ip", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return getCurrentDatetimeBlock();
    const data = (await res.json()) as { datetime?: string; timezone?: string };
    const dt = data.datetime;
    const tz = data.timezone ?? "UTC";
    if (!dt) return getCurrentDatetimeBlock();
    const date = new Date(dt);
    const str = date.toLocaleString("zh-CN", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return `**当前日期时间（网络）**：${str} ${tz}（你可直接据此回答用户问时间，不属超权）`;
  } catch {
    return getCurrentDatetimeBlock();
  }
}

const BOOTSTRAP_ORDER: { key: string; getContent: () => string }[] = [
  { key: "AGENTS", getContent: readAgents },
  { key: "AGENT_LIST", getContent: getAgentListBlock },
  { key: "SOUL", getContent: () => readOptional(config.soulPath) },
  { key: "IDENTITY", getContent: () => readOptional(config.identityPath) },
  { key: "USER", getContent: () => readOptional(config.userPath) },
  { key: "TOOLS", getContent: () => readOptional(config.toolsPath) },
  { key: "LOCAL_FILE", getContent: getLocalFileBlock },
  { key: "SKILLS", getContent: getSkillsListBlock },
  { key: "CURRENT_DATETIME", getContent: getCurrentDatetimeBlock },
];

function getLocalFileBlock(): string {
  if (!config.localFileRoot) return "";
  return "**本地文件操作**（已开启，供你直接操作用户电脑上的文件）：路径均相对于 LOCAL_FILE_ROOT 配置的根目录（如用户桌面）。\n- 列出目录：`LIST_DIR: <相对路径>`，系统返回该目录下的文件名列表。\n- 读文件：`READ_FILE: <相对路径>`，系统将文件内容注入下一轮。\n- 写文件：`WRITE_FILE: <相对路径>` 换行后写文件内容，直到下一行出现 LIST_DIR/READ_FILE/WRITE_FILE 或结尾。可在一轮回复中写多个 WRITE_FILE 以创建整个工程（如新建 React 项目：先写 package.json、再写 index.html、src/App.jsx 等）。父目录不存在时会自动创建。";
}

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

export interface BootstrapOverrides {
  currentDatetime?: string;
}

export function loadBootstrap(overrides?: BootstrapOverrides): string {
  console.log("[bootstrap] loadBootstrap 开始");
  const parts: string[] = [];
  const keys: string[] = [];
  for (const { key, getContent } of BOOTSTRAP_ORDER) {
    const content =
      key === "CURRENT_DATETIME" && overrides?.currentDatetime
        ? overrides.currentDatetime
        : getContent();
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

const EXECUTION_PERSONA = `# 任务执行模式

你是任务执行器。下一条「用户」消息是**需要立即执行的任务指令**（例如：在某目录创建文件、抓取网页、列出目录等）。

你必须**通过输出协议行来执行**，不要只回复确认或描述。可用协议：
- \`WRITE_FILE: <相对路径>\` 换行后写内容
- \`READ_FILE: <相对路径>\`
- \`LIST_DIR: <相对路径>\`
- \`FETCH_URL: <url>\`
- \`BROWSER_NAVIGATE: <url>\`
- \`SKILL: <技能名>\`（需要某技能时）

**路径约定**：WRITE_FILE/READ_FILE/LIST_DIR 的路径均相对于 LOCAL_FILE_ROOT（即用户配置的工作根目录，通常即「work」）。任务描述中的「work 目录下的 test」即指根目录下的 test 文件夹，相对路径应写 \`test/文件名\`，不要写 \`work/test/文件名\`，否则会重复一层 work。

禁止在本模式下输出 TIME_TASK、DELEGATE 或仅做文字确认；必须输出上述协议行以实际执行任务。`;

export function loadBootstrapForExecution(overrides?: BootstrapOverrides): string {
  const parts: string[] = [EXECUTION_PERSONA];
  const datetime =
    overrides?.currentDatetime ?? getCurrentDatetimeBlock();
  if (datetime) parts.push(datetime);
  const localFile = getLocalFileBlock();
  if (localFile) parts.push(localFile);
  const skills = getSkillsListBlock();
  if (skills) parts.push(skills);
  const out = parts.join("\n\n");
  console.log("[bootstrap] loadBootstrapForExecution 完成", { length: out.length });
  return out;
}
