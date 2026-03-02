import fs from "fs";
import path from "path";
import { config } from "./config.js";

const SKILL_REGEX = /SKILL:\s*(\S+)/g;
const SKILL_LINE_REGEX = /^\s*SKILL:\s*\S+\s*$/;

export function parseSkillNames(reply: string): string[] {
  const names: string[] = [];
  let m: RegExpExecArray | null;
  SKILL_REGEX.lastIndex = 0;
  while ((m = SKILL_REGEX.exec(reply)) !== null) {
    const name = m[1].trim();
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length > 0) console.log("[skill] parseSkillNames", { replyLength: reply.length, names });
  return names;
}

function skillDirExists(name: string): boolean {
  const dir = path.join(config.skillsDir, name);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  const skillPath = path.join(dir, "SKILL.md");
  return fs.existsSync(skillPath) && fs.statSync(skillPath).isFile();
}

export function loadSkillContent(name: string, maxChars: number = config.bootstrapMaxChars): string {
  const skillPath = path.join(config.skillsDir, name, "SKILL.md");
  if (!fs.existsSync(skillPath) || !fs.statSync(skillPath).isFile()) return "";
  try {
    const raw = fs.readFileSync(skillPath, "utf-8").trim();
    if (raw.length <= maxChars) return raw;
    return raw.slice(0, maxChars) + "…";
  } catch {
    return "";
  }
}

export function loadSkillContents(names: string[]): { valid: string[]; content: string } {
  const valid = names.filter((n) => skillDirExists(n));
  console.log("[skill] loadSkillContents", { requested: names, valid, skillsDir: config.skillsDir });
  if (valid.length === 0) return { valid: [], content: "" };
  const parts = valid.map((name) => {
    const body = loadSkillContent(name);
    return `--- 技能 ${name} ---\n${body}`;
  });
  const content = `[已加载技能：${valid.join(", ")}]\n\n` + parts.join("\n\n");
  console.log("[skill] loadSkillContents 完成", { contentLength: content.length });
  return { valid, content };
}

export function stripSkillFromReply(reply: string): string {
  return reply
    .split("\n")
    .filter((line) => !SKILL_LINE_REGEX.test(line.trim()))
    .join("\n")
    .trim();
}
