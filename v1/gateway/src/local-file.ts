import fs from "fs";
import path from "path";
import { config } from "./config.js";

const READ_FILE_REGEX = /^\s*READ_FILE:\s*(.+)$/;
const WRITE_FILE_REGEX = /^\s*WRITE_FILE:\s*(.+)$/;
const LIST_DIR_REGEX = /^\s*LIST_DIR:\s*(.+)$/;

let canonicalRoot = "";

function getCanonicalRoot(): string {
  if (!config.localFileRoot) return "";
  if (canonicalRoot) return canonicalRoot;
  canonicalRoot = path.resolve(config.localFileRoot);
  return canonicalRoot;
}

function isPathUnderRoot(absolutePath: string): boolean {
  const root = getCanonicalRoot();
  if (!root) return false;
  const resolved = path.resolve(absolutePath);
  if (resolved === root) return true;
  const prefix = root + path.sep;
  return resolved.startsWith(prefix);
}

function resolvePath(relativePath: string): { absolute: string; safe: boolean } {
  if (!config.localFileRoot) return { absolute: "", safe: false };
  if (path.isAbsolute(relativePath)) return { absolute: "", safe: false };
  const normalized = path.normalize(relativePath).replace(/^[/\\]+/, "");
  if (normalized.includes("..")) return { absolute: "", safe: false };
  const root = getCanonicalRoot();
  const absolute = path.resolve(root, normalized);
  if (!isPathUnderRoot(absolute)) return { absolute: "", safe: false };
  return { absolute, safe: true };
}

export function isLocalFileEnabled(): boolean {
  return config.localFileRoot.length > 0;
}

export function parseReadFiles(reply: string): string[] {
  if (!isLocalFileEnabled()) return [];
  const paths: string[] = [];
  const lines = reply.split(/\n/);
  for (const line of lines) {
    const m = line.match(READ_FILE_REGEX);
    if (m) {
      const p = m[1].trim();
      if (p && !paths.includes(p)) paths.push(p);
    }
  }
  return paths;
}

export interface WriteFileOp {
  path: string;
  content: string;
}

export function parseWriteFiles(reply: string): WriteFileOp[] {
  if (!isLocalFileEnabled()) return [];
  const out: WriteFileOp[] = [];
  const lines = reply.split(/\n/);
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(WRITE_FILE_REGEX);
    if (m) {
      const filePath = m[1].trim();
      if (filePath) {
        const contentLines: string[] = [];
        i++;
        while (i < lines.length && !READ_FILE_REGEX.test(lines[i]) && !WRITE_FILE_REGEX.test(lines[i]) && !LIST_DIR_REGEX.test(lines[i])) {
          contentLines.push(lines[i]);
          i++;
        }
        out.push({ path: filePath, content: contentLines.join("\n").trimEnd() });
        continue;
      }
    }
    i++;
  }
  return out;
}

export function parseListDirs(reply: string): string[] {
  if (!isLocalFileEnabled()) return [];
  const paths: string[] = [];
  const lines = reply.split(/\n/);
  for (const line of lines) {
    const m = line.match(LIST_DIR_REGEX);
    if (m && m[1] != null) {
      const p = m[1].trim();
      if (p && !paths.includes(p)) paths.push(p);
    }
  }
  return paths;
}

export function stripLocalFileFromReply(reply: string): string {
  const lines = reply.split(/\n/);
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (READ_FILE_REGEX.test(lines[i]) || WRITE_FILE_REGEX.test(lines[i]) || LIST_DIR_REGEX.test(lines[i])) {
      const isWrite = WRITE_FILE_REGEX.test(lines[i]);
      i++;
      if (isWrite) {
        while (i < lines.length && !READ_FILE_REGEX.test(lines[i]) && !WRITE_FILE_REGEX.test(lines[i]) && !LIST_DIR_REGEX.test(lines[i])) i++;
      }
      continue;
    }
    result.push(lines[i]);
    i++;
  }
  return result.join("\n").trim();
}

function ensureUnderRoot(absolutePath: string): boolean {
  try {
    const real = fs.realpathSync(absolutePath);
    return isPathUnderRoot(real);
  } catch {
    const parent = path.dirname(absolutePath);
    if (parent === absolutePath) return isPathUnderRoot(absolutePath);
    try {
      const realParent = fs.realpathSync(parent);
      return isPathUnderRoot(path.join(realParent, path.basename(absolutePath)));
    } catch {
      return isPathUnderRoot(absolutePath);
    }
  }
}

export function readLocalFile(relativePath: string): { content: string; error?: string } {
  const { absolute, safe } = resolvePath(relativePath);
  if (!safe || !absolute) return { content: "", error: "路径不合法或未配置 LOCAL_FILE_ROOT" };
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return { content: "", error: `文件不存在或非文件: ${relativePath}` };
  }
  if (!ensureUnderRoot(absolute)) return { content: "", error: "路径越界（含符号链接逃逸）" };
  try {
    const content = fs.readFileSync(absolute, "utf-8");
    return { content };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: "", error: msg };
  }
}

export function writeLocalFile(relativePath: string, content: string): { ok: boolean; error?: string } {
  const { absolute, safe } = resolvePath(relativePath);
  if (!safe || !absolute) return { ok: false, error: "路径不合法或未配置 LOCAL_FILE_ROOT" };
  const ext = path.extname(absolute).toLowerCase();
  const allowed = [".md", ".txt", ".json", ".yml", ".yaml", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".html", ".css", ".csv"];
  if (ext && !allowed.includes(ext)) return { ok: false, error: "仅支持常见文本/代码扩展名" };
  try {
    const dir = path.dirname(absolute);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!ensureUnderRoot(dir) || !ensureUnderRoot(absolute)) return { ok: false, error: "路径越界（含符号链接逃逸）" };
    fs.writeFileSync(absolute, content, "utf-8");
    console.log("[local-file] 已写入", { relativePath: relativePath, absolutePath: absolute });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export function listLocalDir(relativePath: string): { entries: string[]; error?: string } {
  const { absolute, safe } = resolvePath(relativePath);
  if (!safe || !absolute) return { entries: [], error: "路径不合法或未配置 LOCAL_FILE_ROOT" };
  if (!fs.existsSync(absolute)) return { entries: [], error: `目录不存在: ${relativePath}` };
  if (!fs.statSync(absolute).isDirectory()) return { entries: [], error: `不是目录: ${relativePath}` };
  if (!ensureUnderRoot(absolute)) return { entries: [], error: "路径越界（含符号链接逃逸）" };
  try {
    const names = fs.readdirSync(absolute);
    return { entries: names };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { entries: [], error: msg };
  }
}

export function runLocalFileOps(
  readPaths: string[],
  writeOps: WriteFileOp[],
  listPaths: string[]
): string {
  const parts: string[] = [];
  for (const p of listPaths) {
    const { entries, error } = listLocalDir(p);
    if (error) parts.push(`[列出目录失败] ${p}\n${error}`);
    else parts.push(`[目录] ${p}\n\n${entries.length === 0 ? "（空）" : entries.join("\n")}`);
  }
  for (const p of readPaths) {
    const { content, error } = readLocalFile(p);
    if (error) parts.push(`[读取失败] ${p}\n${error}`);
    else parts.push(`[已读取] ${p}\n\n${content}`);
  }
  for (const op of writeOps) {
    const { ok, error } = writeLocalFile(op.path, op.content);
    if (ok) parts.push(`[已写入] ${op.path}`);
    else parts.push(`[写入失败] ${op.path}\n${error}`);
  }
  if (parts.length === 0) return "";
  return "[本地文件操作结果]\n\n" + parts.join("\n\n---\n\n");
}
