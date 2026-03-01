/**
 * 网关与运行时常量。
 * 开发时通过 Vite proxy 转发 /chat、/config -> 网关；生产环境可替换为实际网关地址。
 */
const gatewayOrigin =
  typeof import.meta.env.VITE_GATEWAY_ORIGIN === "string" &&
  import.meta.env.VITE_GATEWAY_ORIGIN.length > 0
    ? import.meta.env.VITE_GATEWAY_ORIGIN
    : "";

export const config = {
  /** 网关基础 URL，空则用当前站点 origin（依赖 dev proxy 或同源） */
  gatewayOrigin: gatewayOrigin || "",
  /** 聊天接口路径（相对 gatewayOrigin 或当前 origin） */
  chatPath: "/chat",
} as const;

export function getChatUrl(): string {
  const base = config.gatewayOrigin || "";
  return `${base}${config.chatPath}`;
}

export function getChatStreamUrl(): string {
  const base = config.gatewayOrigin || "";
  return `${base}${config.chatPath}/stream`;
}

function getConfigUrl(): string {
  const base = config.gatewayOrigin || "";
  return `${base}/config`;
}

export interface GatewayConfig {
  ollamaModel: string;
}

let cached: Promise<GatewayConfig> | null = null;

/** 从网关拉取配置（模型等），单一配置源，结果缓存 */
export function getGatewayConfig(): Promise<GatewayConfig> {
  if (cached) return cached;
  const url = getConfigUrl();
  cached = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`配置请求失败 ${r.status}`);
      return r.json() as Promise<GatewayConfig>;
    })
    .then((data) => ({
      ollamaModel: typeof data.ollamaModel === "string" ? data.ollamaModel : "",
    }));
  return cached;
}
