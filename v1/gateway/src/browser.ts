import { chromium } from "playwright";
import { config } from "./config.js";

export interface SnapshotResult {
  snapshot: string;
  title?: string;
  url?: string;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export async function navigateAndSnapshot(
  url: string,
  options?: { timeoutMs?: number }
): Promise<SnapshotResult> {
  const timeoutMs = options?.timeoutMs ?? config.browserTimeoutMs;
  const maxChars = config.browserSnapshotMaxChars;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const proxyServer =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy;
    const contextOptions: { userAgent: string; viewport: { width: number; height: number }; proxy?: { server: string } } = {
      userAgent: "Claw-Gateway/1.0",
      viewport: { width: 1280, height: 720 },
    };
    if (proxyServer && proxyServer.trim()) {
      contextOptions.proxy = { server: proxyServer.trim() };
      console.log("[browser] 使用代理", { server: proxyServer.trim() });
    }
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await new Promise((r) => setTimeout(r, 500));

    const title = await page.title();
    const currentUrl = page.url();

    const bodyText = await page.evaluate(() => {
      const el = document.body;
      if (!el) return "";
      return (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
    });

    const interactiveSummary = await page.evaluate(() => {
      const parts: string[] = [];
      const links = Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 0 && t.length < 80);
      if (links.length > 0) {
        const uniq = [...new Set(links)].slice(0, 30);
        parts.push("链接: " + uniq.join(" | "));
      }
      const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit'], input[type='button']"))
        .map((b) => (b.textContent ?? (b as HTMLInputElement).value ?? "").replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 0 && t.length < 80);
      if (buttons.length > 0) {
        const uniq = [...new Set(buttons)].slice(0, 20);
        parts.push("按钮/提交: " + uniq.join(" | "));
      }
      const inputs = Array.from(document.querySelectorAll("input:not([type='submit']):not([type='button']):not([type='hidden']), textarea"))
        .map((i) => (i.getAttribute("placeholder") ?? (i.getAttribute("name") ?? (i as HTMLInputElement).name) ?? "输入框").trim())
        .filter((t) => t.length > 0 && t.length < 60);
      if (inputs.length > 0) {
        const uniq = [...new Set(inputs)].slice(0, 15);
        parts.push("输入框: " + uniq.join(" | "));
      }
      return parts.join("\n");
    });

    const bodyTruncated = truncate(bodyText, Math.max(0, maxChars - 2000));
    const lines: string[] = [
      `**页面标题**：${title ?? ""}`,
      `**当前 URL**：${currentUrl}`,
      "",
      "**正文摘要**：",
      bodyTruncated,
    ];
    if (interactiveSummary) {
      lines.push("");
      lines.push("**可交互元素**：");
      lines.push(interactiveSummary);
    }
    const snapshot = lines.join("\n");
    await browser.close();
    return { snapshot, title: title ?? undefined, url: currentUrl };
  } catch (e) {
    if (browser) try { await browser.close(); } catch { /* ignore */ }
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[browser] navigateAndSnapshot 失败", { url, error: msg });
    return {
      snapshot: `[浏览器打开失败] ${url}\n原因: ${msg}`,
      url,
    };
  }
}
