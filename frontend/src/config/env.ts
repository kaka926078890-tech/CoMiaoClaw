/**
 * 网关与运行时常量。
 * 开发时通过 Vite proxy 转发 /api -> 网关；生产环境可替换为实际网关地址。
 */
const gatewayOrigin =
  typeof import.meta.env.VITE_GATEWAY_ORIGIN === "string" &&
  import.meta.env.VITE_GATEWAY_ORIGIN.length > 0
    ? import.meta.env.VITE_GATEWAY_ORIGIN
    : "";

/** 前端配置的 Ollama 模型名（如 qwen2.5-coder:7b），空则使用网关默认 */
const ollamaModel =
  typeof import.meta.env.VITE_OLLAMA_MODEL === "string" &&
  import.meta.env.VITE_OLLAMA_MODEL.length > 0
    ? import.meta.env.VITE_OLLAMA_MODEL.trim()
    : "";

export const config = {
  /** 网关基础 URL，空则用当前站点 origin（依赖 dev proxy 或同源） */
  gatewayOrigin: gatewayOrigin || "",
  /** 聊天接口路径（相对 gatewayOrigin 或当前 origin） */
  chatPath: "/chat",
  /** Ollama 模型名，空则使用网关端默认（如 qwen2.5-coder:7b） */
  ollamaModel,
} as const;

export function getChatUrl(): string {
  const base = config.gatewayOrigin || "";
  return `${base}${config.chatPath}`;
}

export function getChatStreamUrl(): string {
  const base = config.gatewayOrigin || "";
  return `${base}${config.chatPath}/stream`;
}
