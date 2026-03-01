import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(__dirname, "..", "data");

/**
 * 网关与 Ollama 配置。
 * 可通过环境变量覆盖：PORT、OLLAMA_HOST、OLLAMA_MODEL、MEMORY_PATH、PERSONA_PATH 等。
 */
const OLLAMA_HOST =
  typeof process.env.OLLAMA_HOST === "string" && process.env.OLLAMA_HOST.length > 0
    ? process.env.OLLAMA_HOST.replace(/\/$/, "")
    : "http://127.0.0.1:11434";

const OLLAMA_MODEL =
  typeof process.env.OLLAMA_MODEL === "string" && process.env.OLLAMA_MODEL.length > 0
    ? process.env.OLLAMA_MODEL
    : "qwen2.5-coder:7b";

const PORT = typeof process.env.PORT === "string" ? parseInt(process.env.PORT, 10) : 3000;

const MEMORY_PATH =
  typeof process.env.MEMORY_PATH === "string" && process.env.MEMORY_PATH.length > 0
    ? process.env.MEMORY_PATH
    : path.join(defaultDataDir, "memory.md");

const PERSONA_PATH =
  typeof process.env.PERSONA_PATH === "string" && process.env.PERSONA_PATH.length > 0
    ? process.env.PERSONA_PATH
    : path.join(defaultDataDir, "persona.md");

const SUBPERSONA_DIR =
  typeof process.env.SUBPERSONA_DIR === "string" && process.env.SUBPERSONA_DIR.length > 0
    ? process.env.SUBPERSONA_DIR
    : path.join(defaultDataDir, "subpersona");

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

export const config = {
  port: Number.isFinite(PORT) ? PORT : 3000,
  ollamaHost: OLLAMA_HOST,
  ollamaModel: OLLAMA_MODEL,
  memoryPath: MEMORY_PATH,
  personaPath: PERSONA_PATH,
  subpersonaDir: SUBPERSONA_DIR,
  memoryInjectCount: Number.isFinite(MEMORY_INJECT_COUNT) && MEMORY_INJECT_COUNT > 0 ? MEMORY_INJECT_COUNT : 10,
  memoryInjectMaxChars: Number.isFinite(MEMORY_INJECT_MAX_CHARS) && MEMORY_INJECT_MAX_CHARS > 0 ? MEMORY_INJECT_MAX_CHARS : 2000,
  memoryEntryMaxChars: Number.isFinite(MEMORY_ENTRY_MAX_CHARS) && MEMORY_ENTRY_MAX_CHARS > 0 ? MEMORY_ENTRY_MAX_CHARS : 80,
} as const;
