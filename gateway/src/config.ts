import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(__dirname, "..", "data");

const WORKSPACE_DIR =
  typeof process.env.WORKSPACE === "string" && process.env.WORKSPACE.length > 0
    ? path.resolve(process.env.WORKSPACE)
    : defaultDataDir;

const OLLAMA_HOST =
  typeof process.env.OLLAMA_HOST === "string" && process.env.OLLAMA_HOST.length > 0
    ? process.env.OLLAMA_HOST.replace(/\/$/, "")
    : "http://127.0.0.1:11434";

const OLLAMA_MODEL_RAW =
  typeof process.env.OLLAMA_MODEL === "string" && process.env.OLLAMA_MODEL.length > 0
    ? process.env.OLLAMA_MODEL
    : "qwen2.5-coder:7b";
const OLLAMA_MODEL = OLLAMA_MODEL_RAW.includes(",")
  ? OLLAMA_MODEL_RAW.split(",")[0]?.trim() || OLLAMA_MODEL_RAW.trim()
  : OLLAMA_MODEL_RAW.trim();

const OLLAMA_MODELS_RAW =
  typeof process.env.OLLAMA_MODELS === "string" && process.env.OLLAMA_MODELS.length > 0
    ? process.env.OLLAMA_MODELS
    : "";
const OLLAMA_MODELS = OLLAMA_MODELS_RAW
  ? OLLAMA_MODELS_RAW.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const PORT = typeof process.env.PORT === "string" ? parseInt(process.env.PORT, 10) : 3000;

const MEMORY_PATH =
  typeof process.env.MEMORY_PATH === "string" && process.env.MEMORY_PATH.length > 0
    ? path.resolve(process.env.MEMORY_PATH)
    : path.join(WORKSPACE_DIR, "memory.md");

const PERSONA_PATH =
  typeof process.env.PERSONA_PATH === "string" && process.env.PERSONA_PATH.length > 0
    ? path.resolve(process.env.PERSONA_PATH)
    : path.join(defaultDataDir, "persona.md");

const SUBPERSONA_DIR =
  typeof process.env.SUBPERSONA_DIR === "string" && process.env.SUBPERSONA_DIR.length > 0
    ? path.resolve(process.env.SUBPERSONA_DIR)
    : path.join(defaultDataDir, "subpersona");

const AGENTS_DIR = (() => {
  const agentsDir = path.join(WORKSPACE_DIR, "agents");
  const subDir = path.join(WORKSPACE_DIR, "subpersona");
  if (fs.existsSync(agentsDir) && fs.statSync(agentsDir).isDirectory()) return agentsDir;
  if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) return subDir;
  return path.join(defaultDataDir, "agents");
})();

const AGENTS_PATH = (() => {
  const p = path.join(WORKSPACE_DIR, "AGENTS.md");
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  const fallback = path.join(defaultDataDir, "AGENTS.md");
  return fs.existsSync(fallback) ? fallback : p;
})();

const MEMORY_INJECT_COUNT =
  typeof process.env.MEMORY_INJECT_COUNT === "string"
    ? parseInt(process.env.MEMORY_INJECT_COUNT, 10)
    : 10;
const MEMORY_INJECT_MAX_CHARS =
  typeof process.env.MEMORY_INJECT_MAX_CHARS === "string"
    ? parseInt(process.env.MEMORY_INJECT_MAX_CHARS, 10)
    : 2000;
const MEMORY_ENTRY_MAX_CHARS =
  typeof process.env.MEMORY_ENTRY_MAX_CHARS === "string"
    ? parseInt(process.env.MEMORY_ENTRY_MAX_CHARS, 10)
    : 80;

const BOOTSTRAP_MAX_CHARS =
  typeof process.env.BOOTSTRAP_MAX_CHARS === "string"
    ? parseInt(process.env.BOOTSTRAP_MAX_CHARS, 10)
    : 20000;
const BOOTSTRAP_TOTAL_MAX_CHARS =
  typeof process.env.BOOTSTRAP_TOTAL_MAX_CHARS === "string"
    ? parseInt(process.env.BOOTSTRAP_TOTAL_MAX_CHARS, 10)
    : 150000;

const FETCH_URL_TIMEOUT_MS =
  typeof process.env.FETCH_URL_TIMEOUT_MS === "string"
    ? parseInt(process.env.FETCH_URL_TIMEOUT_MS, 10)
    : 15000;
const FETCH_URL_MAX_BODY =
  typeof process.env.FETCH_URL_MAX_BODY === "string"
    ? parseInt(process.env.FETCH_URL_MAX_BODY, 10)
    : 200000;

const USE_EXTERNAL_TIME_RAW = typeof process.env.USE_EXTERNAL_TIME === "string" ? process.env.USE_EXTERNAL_TIME.trim().toLowerCase() : "";
const USE_EXTERNAL_TIME = /^(0|false|no)$/.test(USE_EXTERNAL_TIME_RAW) ? false : true;

const BROWSER_TIMEOUT_MS =
  typeof process.env.BROWSER_TIMEOUT_MS === "string"
    ? parseInt(process.env.BROWSER_TIMEOUT_MS, 10)
    : 15000;
const BROWSER_SNAPSHOT_MAX_CHARS =
  typeof process.env.BROWSER_SNAPSHOT_MAX_CHARS === "string"
    ? parseInt(process.env.BROWSER_SNAPSHOT_MAX_CHARS, 10)
    : 30000;

export const config = {
  port: Number.isFinite(PORT) ? PORT : 3000,
  ollamaHost: OLLAMA_HOST,
  ollamaModel: OLLAMA_MODEL,
  ollamaModels: OLLAMA_MODELS,
  memoryPath: MEMORY_PATH,
  personaPath: PERSONA_PATH,
  subpersonaDir: SUBPERSONA_DIR,
  workspaceDir: WORKSPACE_DIR,
  agentsPath: AGENTS_PATH,
  agentsDir: AGENTS_DIR,
  soulPath: path.join(WORKSPACE_DIR, "SOUL.md"),
  identityPath: path.join(WORKSPACE_DIR, "IDENTITY.md"),
  userPath: path.join(WORKSPACE_DIR, "USER.md"),
  toolsPath: path.join(WORKSPACE_DIR, "TOOLS.md"),
  skillsDir: path.join(WORKSPACE_DIR, "skills"),
  memoryInjectCount: Number.isFinite(MEMORY_INJECT_COUNT) && MEMORY_INJECT_COUNT > 0 ? MEMORY_INJECT_COUNT : 10,
  memoryInjectMaxChars: Number.isFinite(MEMORY_INJECT_MAX_CHARS) && MEMORY_INJECT_MAX_CHARS > 0 ? MEMORY_INJECT_MAX_CHARS : 2000,
  memoryEntryMaxChars: Number.isFinite(MEMORY_ENTRY_MAX_CHARS) && MEMORY_ENTRY_MAX_CHARS > 0 ? MEMORY_ENTRY_MAX_CHARS : 80,
  bootstrapMaxChars: Number.isFinite(BOOTSTRAP_MAX_CHARS) && BOOTSTRAP_MAX_CHARS > 0 ? BOOTSTRAP_MAX_CHARS : 20000,
  bootstrapTotalMaxChars: Number.isFinite(BOOTSTRAP_TOTAL_MAX_CHARS) && BOOTSTRAP_TOTAL_MAX_CHARS > 0 ? BOOTSTRAP_TOTAL_MAX_CHARS : 150000,
  fetchUrlTimeoutMs: Number.isFinite(FETCH_URL_TIMEOUT_MS) && FETCH_URL_TIMEOUT_MS > 0 ? FETCH_URL_TIMEOUT_MS : 15000,
  fetchUrlMaxBody: Number.isFinite(FETCH_URL_MAX_BODY) && FETCH_URL_MAX_BODY > 0 ? FETCH_URL_MAX_BODY : 200000,
  useExternalTime: USE_EXTERNAL_TIME,
  browserTimeoutMs: Number.isFinite(BROWSER_TIMEOUT_MS) && BROWSER_TIMEOUT_MS > 0 ? BROWSER_TIMEOUT_MS : 15000,
  browserSnapshotMaxChars: Number.isFinite(BROWSER_SNAPSHOT_MAX_CHARS) && BROWSER_SNAPSHOT_MAX_CHARS > 0 ? BROWSER_SNAPSHOT_MAX_CHARS : 30000,
} as const;
