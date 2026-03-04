const BROWSER_NAVIGATE_REGEX = /BROWSER_NAVIGATE:\s*(\S+)/g;
const BROWSER_NAVIGATE_LINE_REGEX = /^\s*BROWSER_NAVIGATE:\s*\S+\s*$/;
const HTTP_ONLY = /^https?:\/\//i;

export function parseBrowserNavigateUrls(reply: string): string[] {
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  BROWSER_NAVIGATE_REGEX.lastIndex = 0;
  while ((m = BROWSER_NAVIGATE_REGEX.exec(reply)) !== null) {
    const url = m[1].trim();
    if (url && HTTP_ONLY.test(url) && !urls.includes(url)) urls.push(url);
  }
  if (urls.length > 0) console.log("[browser-protocol] parseBrowserNavigateUrls", { replyLength: reply.length, urls });
  return urls;
}

export function stripBrowserNavigateFromReply(reply: string): string {
  return reply
    .split("\n")
    .filter((line) => !BROWSER_NAVIGATE_LINE_REGEX.test(line.trim()))
    .join("\n")
    .trim();
}
