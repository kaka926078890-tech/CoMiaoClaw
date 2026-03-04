import fs from "fs";
import path from "path";
import { config } from "./config.js";

const ROOT_FILES = ["AGENTS.md", "SOUL.md", "MEMORY.md", "TOOLS.md", "IDENTITY.md", "USER.md"];

function isPathUnder(base: string, target: string): boolean {
  const baseNorm = path.resolve(base);
  const targetNorm = path.resolve(target);
  return targetNorm === baseNorm || targetNorm.startsWith(baseNorm + path.sep);
}

function resolveWorkspacePath(relativePath: string): { absolute: string; safe: boolean } {
  const normalized = path.normalize(relativePath).replace(/^\.[/\\]/, "");
  if (normalized.includes("..") || path.isAbsolute(relativePath)) {
    return { absolute: "", safe: false };
  }
  const absolute = path.join(config.workspaceDir, normalized);
  if (!isPathUnder(config.workspaceDir, absolute)) {
    return { absolute: "", safe: false };
  }
  return { absolute, safe: true };
}

export interface WorkspaceEntry {
  kind: "file" | "dir";
  name: string;
  path: string;
  children?: WorkspaceEntry[];
}

export function listWorkspace(): {
  rootFiles: WorkspaceEntry[];
  agents: WorkspaceEntry[];
  skills: WorkspaceEntry[];
} {
  const rootFiles: WorkspaceEntry[] = [];
  for (const name of ROOT_FILES) {
    const fullPath = path.join(config.workspaceDir, name);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      rootFiles.push({ kind: "file", name, path: name });
    }
  }
  const memoryRel = path.relative(config.workspaceDir, config.memoryPath);
  if (memoryRel && !memoryRel.startsWith("..") && fs.existsSync(config.memoryPath) && fs.statSync(config.memoryPath).isFile()) {
    const name = path.basename(config.memoryPath);
    if (!rootFiles.some((e) => e.name === name)) {
      rootFiles.push({ kind: "file", name, path: memoryRel });
    }
  }
  const agentsDir = config.agentsDir;
  const agents: WorkspaceEntry[] = [];
  if (fs.existsSync(agentsDir) && fs.statSync(agentsDir).isDirectory()) {
    const relBase = path.relative(config.workspaceDir, agentsDir);
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".md") && /^[\w-]+$/.test(e.name.slice(0, -3))) {
        agents.push({ kind: "file", name: e.name, path: path.join(relBase, e.name) });
      }
    }
  }
  const skillsDir = config.skillsDir;
  const skills: WorkspaceEntry[] = [];
  if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillPath = path.join(skillsDir, e.name, "SKILL.md");
      if (fs.existsSync(skillPath) && fs.statSync(skillPath).isFile()) {
        skills.push({
          kind: "file",
          name: `${e.name}/SKILL.md`,
          path: path.relative(config.workspaceDir, skillPath),
        });
      }
    }
  }
  return { rootFiles, agents, skills };
}

export function readWorkspaceFile(relativePath: string): { content: string; error?: string } {
  const { absolute, safe } = resolveWorkspacePath(relativePath);
  if (!safe || !absolute) return { content: "", error: "路径不合法" };
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return { content: "", error: "文件不存在" };
  }
  try {
    const content = fs.readFileSync(absolute, "utf-8");
    return { content };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: "", error: msg };
  }
}

export function writeWorkspaceFile(relativePath: string, content: string): { ok: boolean; error?: string } {
  const { absolute, safe } = resolveWorkspacePath(relativePath);
  if (!safe || !absolute) return { ok: false, error: "路径不合法" };
  const allowedExt = [".md"];
  const ext = path.extname(absolute);
  if (!allowedExt.includes(ext)) return { ok: false, error: "仅支持 .md 文件" };
  try {
    const dir = path.dirname(absolute);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absolute, content, "utf-8");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export function createWorkspaceFile(relativePath: string, content: string): { ok: boolean; error?: string } {
  const { absolute, safe } = resolveWorkspacePath(relativePath);
  if (!safe || !absolute) return { ok: false, error: "路径不合法" };
  if (fs.existsSync(absolute)) return { ok: false, error: "文件已存在" };
  const allowedExt = [".md"];
  const ext = path.extname(absolute);
  if (!allowedExt.includes(ext)) return { ok: false, error: "仅支持 .md 文件" };
  const dir = path.dirname(absolute);
  const parent = config.workspaceDir;
  if (!isPathUnder(parent, dir)) return { ok: false, error: "路径超出工作区" };
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absolute, content, "utf-8");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
