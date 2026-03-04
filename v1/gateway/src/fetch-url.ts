import { config } from "./config.js";

const FETCH_URL_REGEX = /FETCH_URL:\s*(\S+)/g;
const FETCH_URL_LINE_REGEX = /^\s*FETCH_URL:\s*\S+\s*$/;

const HTTP_ONLY = /^https?:\/\//i;

function toPlainText(html: string): string {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, "");
  const text = noStyle.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

export function parseFetchUrls(reply: string): string[] {
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  FETCH_URL_REGEX.lastIndex = 0;
  while ((m = FETCH_URL_REGEX.exec(reply)) !== null) {
    const url = m[1].trim();
    if (url && HTTP_ONLY.test(url) && !urls.includes(url)) urls.push(url);
  }
  if (urls.length > 0) console.log("[fetch-url] parseFetchUrls", { replyLength: reply.length, urls });
  return urls;
}

export async function fetchUrlContent(url: string): Promise<string> {
  console.log("[fetch-url] fetchUrlContent 开始", { url, timeoutMs: config.fetchUrlTimeoutMs });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.fetchUrlTimeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "Claw-Gateway/1.0" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.log("[fetch-url] fetchUrlContent 非 2xx", { url, status: res.status });
      return `[请求失败 ${res.status}]\n${url}`;
    }
    const contentType = res.headers.get("content-type") ?? "";
    const isHtml = /html/i.test(contentType);
    let body = await res.text();
    if (body.length > config.fetchUrlMaxBody) body = body.slice(0, config.fetchUrlMaxBody) + "\n…";
    if (isHtml) body = toPlainText(body);
    console.log("[fetch-url] fetchUrlContent 完成", { url, status: res.status, bodyLength: body.length, isHtml });
    return body;
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[fetch-url] fetchUrlContent 异常", { url, error: msg });
    return `[获取失败]\n${url}\n${msg}`;
  }
}

export async function fetchUrlsContent(urls: string[]): Promise<string> {
  if (urls.length === 0) return "";
  console.log("[fetch-url] fetchUrlsContent 开始", { urlsCount: urls.length, urls });
  const parts = await Promise.all(
    urls.map(async (url) => {
      const content = await fetchUrlContent(url);
      return `${url}\n\n${content}`;
    })
  );
  const out = "[已获取 URL 内容]\n\n" + parts.join("\n\n---\n\n");
  console.log("[fetch-url] fetchUrlsContent 完成", { totalLength: out.length });
  return out;
}

export function stripFetchUrlFromReply(reply: string): string {
  return reply
    .split("\n")
    .filter((line) => !FETCH_URL_LINE_REGEX.test(line.trim()))
    .join("\n")
    .trim();
}
