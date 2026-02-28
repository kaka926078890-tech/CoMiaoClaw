/**
 * 网关与 Ollama 配置。
 * 可通过环境变量覆盖：PORT、OLLAMA_HOST、OLLAMA_MODEL。
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

export const config = {
  port: Number.isFinite(PORT) ? PORT : 3000,
  ollamaHost: OLLAMA_HOST,
  ollamaModel: OLLAMA_MODEL,
} as const;
