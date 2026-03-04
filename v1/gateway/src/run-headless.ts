import { config } from "./config.js";
import { loadBootstrapForExecution, fetchExternalTime } from "./bootstrap.js";
import { chatWithOllama } from "./ollama.js";
import type { OllamaMessage } from "./ollama.js";
import {
  parseSkillNames,
  loadSkillContents,
  stripSkillFromReply,
} from "./skill.js";
import {
  parseFetchUrls,
  fetchUrlsContent,
  stripFetchUrlFromReply,
} from "./fetch-url.js";
import {
  parseBrowserNavigateUrls,
  stripBrowserNavigateFromReply,
} from "./browser-protocol.js";
import { navigateAndSnapshot } from "./browser.js";
import {
  parseReadFiles,
  parseWriteFiles,
  parseListDirs,
  stripLocalFileFromReply,
  runLocalFileOps,
} from "./local-file.js";

const MAX_ROUNDS = 15;

function stripProtocolFromReply(reply: string): string {
  return stripLocalFileFromReply(
    stripBrowserNavigateFromReply(stripFetchUrlFromReply(stripSkillFromReply(reply)))
  ).trim();
}

export async function runInstructionHeadless(instruction: string): Promise<string> {
  let systemContent: string;
  if (config.useExternalTime) {
    const externalTime = await fetchExternalTime();
    systemContent = loadBootstrapForExecution({ currentDatetime: externalTime });
  } else {
    systemContent = loadBootstrapForExecution();
  }
  if (!systemContent) {
    systemContent =
      "你是任务执行器。用户消息是待执行的任务指令，请用 WRITE_FILE、READ_FILE、LIST_DIR、FETCH_URL、BROWSER_NAVIGATE、SKILL 等协议行执行，不要只回复确认。";
  }
  const messages: OllamaMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: instruction.trim() },
  ];
  let lastReply = "";
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const reply = await chatWithOllama(messages);
    lastReply = reply;
    const skillNames = parseSkillNames(reply);
    const fetchUrls = parseFetchUrls(reply);
    const browserUrls = parseBrowserNavigateUrls(reply);
    const readPaths = parseReadFiles(reply);
    const writeOps = parseWriteFiles(reply);
    const listPaths = parseListDirs(reply);
    const hasSkill = skillNames.length > 0;
    const hasFetch = fetchUrls.length > 0;
    const hasBrowser = browserUrls.length > 0;
    const hasLocalFile = readPaths.length > 0 || writeOps.length > 0 || listPaths.length > 0;
    if (!hasSkill && !hasFetch && !hasBrowser && !hasLocalFile) {
      console.log("[run-headless] 无协议，结束", { round: round + 1 });
      break;
    }
    const stripped = stripProtocolFromReply(reply);
    messages.push({ role: "assistant", content: stripped || "已处理。" });
    const injectParts: string[] = [];
    if (hasSkill) {
      const { content: skillContent } = loadSkillContents(skillNames);
      if (skillContent) injectParts.push(skillContent);
    }
    if (hasFetch) {
      const urlContent = await fetchUrlsContent(fetchUrls);
      if (urlContent) injectParts.push(urlContent);
    }
    if (hasBrowser && browserUrls[0]) {
      const { snapshot } = await navigateAndSnapshot(browserUrls[0]);
      if (snapshot) injectParts.push(`[浏览器页面快照]\n\n${snapshot}`);
    }
    if (hasLocalFile) {
      if (writeOps.length > 0) {
        console.log("[run-headless] 执行本地写文件", {
          count: writeOps.length,
          paths: writeOps.map((op) => op.path),
        });
      }
      const localResult = runLocalFileOps(readPaths, writeOps, listPaths);
      if (localResult) injectParts.push(localResult);
    }
    if (injectParts.length === 0) break;
    messages.push({ role: "user", content: injectParts.join("\n\n") });
    console.log("[run-headless] 协议轮次", { round: round + 1, injectPartsCount: injectParts.length });
  }
  return lastReply;
}
