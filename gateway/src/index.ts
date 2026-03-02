import "./loadenv.js";
import express, { Request, Response } from "express";
import { config } from "./config.js";
import { loadBootstrap } from "./bootstrap.js";
import { appendMemory, clearMemory, getMemoryRaw } from "./memory.js";
import { chatWithOllama, streamChatWithOllama } from "./ollama.js";
import type { OllamaMessage } from "./ollama.js";
import {
  parseDelegate,
  runSubAgents,
  runSubAgentsStreaming,
  stripDelegateFromReply,
} from "./delegate.js";
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

function buildMessagesWithSystem(sessionMessages: OllamaMessage[]): OllamaMessage[] {
  console.log("[flow] buildMessagesWithSystem 开始", { sessionCount: sessionMessages.length });
  const systemContent = loadBootstrap();
  console.log("[flow] loadBootstrap 完成", { systemLength: systemContent?.length ?? 0 });
  if (!systemContent) return sessionMessages;
  const out: OllamaMessage[] = [{ role: "system", content: systemContent }, ...sessionMessages];
  console.log("[flow] buildMessagesWithSystem 完成", { totalMessages: out.length, roles: out.map((m) => m.role) });
  return out;
}

function toSingleModel(s: string): string {
  const first = s.trim().split(",")[0]?.trim();
  return first && first.length > 0 ? first : s.trim();
}

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  const bodySize = req.body && typeof req.body === "object" ? JSON.stringify(req.body).length : 0;
  console.log("[gateway] 请求进入", {
    method: req.method,
    path: req.path,
    bodySize,
    query: req.query && Object.keys(req.query).length ? req.query : undefined,
  });
  next();
});

/** GET /config：返回当前网关配置，前端由此统一获取模型等（单一配置源） */
app.get("/config", (_req: Request, res: Response) => {
  console.log("[gateway] GET /config 被调用");
  const payload: { ollamaModel: string; ollamaModels?: string[] } = { ollamaModel: config.ollamaModel };
  if (config.ollamaModels.length > 0) payload.ollamaModels = config.ollamaModels;
  res.json(payload);
  console.log("[gateway] GET /config 返回", { ollamaModel: payload.ollamaModel });
});

/** GET /memory：返回记忆文件原始内容，供历史记录页对照 */
app.get("/memory", (_req: Request, res: Response) => {
  res.type("text/plain").send(getMemoryRaw());
});

/** POST /memory/clear：清空记忆文件内容 */
app.post("/memory/clear", (_req: Request, res: Response) => {
  clearMemory();
  console.log("[gateway] POST /memory/clear");
  res.json({ ok: true });
});

/** GET /models：若配置了 ollamaModels 则返回该列表，否则代理 Ollama /api/tags */
app.get("/models", async (_req: Request, res: Response) => {
  if (config.ollamaModels.length > 0) {
    res.json({ models: config.ollamaModels });
    return;
  }
  try {
    const r = await fetch(`${config.ollamaHost}/api/tags`);
    if (!r.ok) {
      res.status(502).json({ error: "无法获取模型列表" });
      return;
    }
    const data = (await r.json()) as { models?: { name: string }[] };
    const names = Array.isArray(data.models) ? data.models.map((m) => m.name ?? "").filter(Boolean) : [];
    res.json({ models: names });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /models]", msg);
    res.status(502).json({ error: "获取模型列表失败", detail: msg });
  }
});

/** 单会话内存：MVP 仅维护当前对话消息列表 */
const sessionMessages: OllamaMessage[] = [];

let chatLock = false;

/** POST /session/clear：清空当前会话消息，记忆文件不变，用于测试「新启对话保留记忆」 */
app.post("/session/clear", (_req: Request, res: Response) => {
  sessionMessages.length = 0;
  res.json({ ok: true });
});

/** POST /chat：接收 { message }，追加 user 消息、调 Ollama、返回 { reply } */
app.post("/chat", async (req: Request, res: Response) => {
  console.log("[flow] POST /chat 入口");
  if (chatLock) {
    console.log("[flow] POST /chat 拒绝：chatLock=true");
    res.status(409).json({ error: "请求处理中，请稍候" });
    return;
  }
  chatLock = true;
  try {
    const body = req.body;
    const message =
      typeof body === "object" && body !== null && typeof body.message === "string"
        ? String(body.message).trim()
        : "";
    console.log("[flow] POST /chat 解析 body", {
      hasBody: !!body,
      messageLength: message?.length ?? 0,
      messagePreview: message?.slice(0, 200) ?? "",
      rawMessageType: typeof (body?.message),
    });

    if (!message) {
      console.log("[flow] POST /chat 拒绝：message 为空");
      res.status(400).json({ error: "请求体需包含 message 字符串且非空" });
      return;
    }

    const modelOverride =
      typeof body === "object" && body !== null && typeof body.model === "string" && body.model.trim().length > 0
        ? String(body.model).trim()
        : undefined;
    const model = toSingleModel(modelOverride ?? config.ollamaModel);
    console.log("[flow] POST /chat 使用模型", { model, sessionMessagesCount: sessionMessages.length });

    sessionMessages.push({ role: "user", content: message });
    console.log("[flow] POST /chat 已追加 user 消息，session 长度", sessionMessages.length);

    const messagesForOllama = buildMessagesWithSystem(sessionMessages);
    console.log("[flow] POST /chat 即将调用 chatWithOllama", { messagesCount: messagesForOllama.length });
    const mainReply = await chatWithOllama(messagesForOllama, model);
    console.log("[flow] POST /chat mainReply 收到", {
      mainReplyLength: mainReply.length,
      mainReplyPreview: mainReply.slice(0, 400),
      mainReplyTail: mainReply.slice(-300),
    });

    const delegates = parseDelegate(mainReply);
    console.log("[flow] POST /chat parseDelegate 结果", { delegatesCount: delegates.length, delegates });

    if (delegates.length === 0) {
      const skillNames = parseSkillNames(mainReply);
      const fetchUrls = parseFetchUrls(mainReply);
      const hasSkill = skillNames.length > 0;
      const hasFetch = fetchUrls.length > 0;
      console.log("[flow] POST /chat 无 DELEGATE，解析协议", {
        skillNames,
        fetchUrls,
        hasSkill,
        hasFetch,
      });
      if (hasSkill || hasFetch) {
        const stripped = stripFetchUrlFromReply(stripSkillFromReply(mainReply)).trim() || "已加载资源。";
        sessionMessages.push({ role: "assistant", content: stripped });
        const injectParts: string[] = [];
        if (hasSkill) {
          const { valid, content: skillContent } = loadSkillContents(skillNames);
          console.log("[flow] POST /chat 加载技能", { requested: skillNames, valid, contentLength: skillContent.length });
          if (skillContent) injectParts.push(skillContent);
        }
        if (hasFetch) {
          console.log("[flow] POST /chat 即将抓取 URL", { urls: fetchUrls });
          const urlContent = await fetchUrlsContent(fetchUrls);
          console.log("[flow] POST /chat 抓取 URL 完成", { contentLength: urlContent.length });
          if (urlContent) injectParts.push(urlContent);
        }
        if (injectParts.length > 0) {
          sessionMessages.push({ role: "user", content: injectParts.join("\n\n") });
          console.log("[flow] POST /chat 注入后再次调用 Ollama", { sessionLength: sessionMessages.length });
          const messagesForProtocol = buildMessagesWithSystem(sessionMessages);
          const finalReply = await chatWithOllama(messagesForProtocol, model);
          console.log("[flow] POST /chat SKILL/FETCH 轮次完成", { finalReplyLength: finalReply.length });
          sessionMessages.push({ role: "assistant", content: finalReply });
          appendMemory(message, finalReply);
          console.log("[flow] POST /chat 返回 finalReply", { replyLength: finalReply.length });
          res.json({ reply: finalReply });
          return;
        }
      }
      sessionMessages.push({ role: "assistant", content: mainReply });
      appendMemory(message, mainReply);
      console.log("[flow] POST /chat 无协议，直接返回 mainReply", { replyLength: mainReply.length });
      res.json({ reply: mainReply });
      return;
    }

    console.log("[flow] POST /chat 进入 DELEGATE 分支", { delegatesCount: delegates.length });
    const subResult = await runSubAgents(delegates, model);
    console.log("[flow] POST /chat subResult 完成", {
      subResultLength: subResult.length,
      subResultPreview: subResult.slice(0, 300),
    });
    const mainReplyClean = stripDelegateFromReply(mainReply).trim() || "已派发子任务。";
    sessionMessages.push({ role: "assistant", content: mainReplyClean });
    sessionMessages.push({
      role: "user",
      content: "[子任务结果]\n\n" + subResult,
    });
    const messagesForSummary = buildMessagesWithSystem(sessionMessages);
    const finalReply = await chatWithOllama(messagesForSummary, model);
    console.log("[flow] POST /chat finalReply", { finalReplyLength: finalReply.length, finalReplyPreview: finalReply.slice(0, 300) });
    sessionMessages.push({ role: "assistant", content: finalReply });
    appendMemory(message, finalReply);
    console.log("[flow] POST /chat DELEGATE 完成，返回 finalReply", { replyLength: finalReply.length });
    res.json({ reply: finalReply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[flow] POST /chat 异常", { error: msg, stack });
    res.status(503).json({
      error: "模型服务暂时不可用",
      detail: msg,
    });
  } finally {
    chatLock = false;
  }
});

app.post("/chat/stream", async (req: Request, res: Response) => {
  console.log("[flow] POST /chat/stream 入口");
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let keepaliveId: ReturnType<typeof setInterval> | undefined;
  if (chatLock) {
    console.log("[flow] POST /chat/stream 拒绝：chatLock=true");
    res.status(409).json({ error: "请求处理中，请稍候" });
    return;
  }
  chatLock = true;
  try {
    const body = req.body;
    const message =
      typeof body === "object" && body !== null && typeof body.message === "string"
        ? String(body.message).trim()
        : "";
    console.log("[flow] POST /chat/stream 解析 body", {
      hasBody: !!body,
      messageLength: message?.length ?? 0,
      messagePreview: message?.slice(0, 200) ?? "",
    });
    if (!message) {
      console.log("[flow] POST /chat/stream 拒绝：message 为空");
      chatLock = false;
      res.status(400).json({ error: "请求体需包含 message 字符串且非空" });
      return;
    }
    const modelOverride =
      typeof body === "object" && body !== null && typeof body.model === "string" && body.model.trim().length > 0
        ? String(body.model).trim()
        : undefined;
    const model = toSingleModel(modelOverride ?? config.ollamaModel);
    console.log("[flow] POST /chat/stream 使用模型", { model, sessionMessagesCount: sessionMessages.length });

    sessionMessages.push({ role: "user", content: message });
    console.log("[flow] POST /chat/stream 已追加 user，开始 SSE", { sessionLength: sessionMessages.length });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const flush = (): void => {
      if (typeof (res as unknown as { flush?: () => void }).flush === "function") (res as unknown as { flush: () => void }).flush();
    };
    const write = (data: string): void => {
      res.write(data);
      flush();
    };
    write(": \n\n");

    const timeoutMs = 120000;
    const keepaliveMs = 15000;
    let fullReply = "";
    let chunkCount = 0;
    let thinkingCount = 0;
    const streamPromise = new Promise<void>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error("模型响应超时")), timeoutMs);
      keepaliveId = setInterval(() => {
        console.log("[flow] POST /chat/stream keepalive 发送");
        write(": keepalive\n\n");
      }, keepaliveMs);
      const messagesForOllama = buildMessagesWithSystem(sessionMessages);
      console.log("[flow] POST /chat/stream 开始 streamChatWithOllama", { messagesCount: messagesForOllama.length });
      streamChatWithOllama(
        messagesForOllama,
        {
          onThinking: (text) => {
            thinkingCount++;
            if (thinkingCount <= 3) console.log("[flow] POST /chat/stream onThinking", { index: thinkingCount, length: text.length });
            write(`data: ${JSON.stringify({ thinking: text })}\n\n`);
          },
          onChunk: (chunk) => {
            chunkCount++;
            if (chunkCount <= 3 || chunkCount % 50 === 0) console.log("[flow] POST /chat/stream onChunk", { index: chunkCount, chunkLength: chunk.length });
            fullReply += chunk;
            write(`data: ${JSON.stringify({ chunk })}\n\n`);
          },
        },
        model
      )
        .then(async () => {
          clearTimeout(timeoutId);
          console.log("[flow] POST /chat/stream 流结束", {
            fullReplyLength: fullReply.length,
            chunkCount,
            thinkingCount,
            fullReplyPreview: fullReply.slice(0, 400),
            fullReplyTail: fullReply.slice(-300),
          });
          const delegates = parseDelegate(fullReply);
          console.log("[flow] POST /chat/stream parseDelegate", { delegatesCount: delegates.length, delegates });

          if (delegates.length === 0) {
            const skillNames = parseSkillNames(fullReply);
            const fetchUrls = parseFetchUrls(fullReply);
            const hasSkill = skillNames.length > 0;
            const hasFetch = fetchUrls.length > 0;
            console.log("[flow] POST /chat/stream 无 DELEGATE", { skillNames, fetchUrls, hasSkill, hasFetch });
            if (hasSkill || hasFetch) {
              const stripped = stripFetchUrlFromReply(stripSkillFromReply(fullReply)).trim() || "已加载资源。";
              write(`data: ${JSON.stringify({ type: "main_reply_clean", content: stripped })}\n\n`);
              sessionMessages.push({ role: "assistant", content: stripped });
              const injectParts: string[] = [];
              if (hasSkill) {
                const { content: skillContent } = loadSkillContents(skillNames);
                if (skillContent) injectParts.push(skillContent);
              }
              if (hasFetch) {
                const urlContent = await fetchUrlsContent(fetchUrls);
                if (urlContent) injectParts.push(urlContent);
              }
              if (injectParts.length > 0) {
                sessionMessages.push({ role: "user", content: injectParts.join("\n\n") });
                if (hasSkill) write(`data: ${JSON.stringify({ type: "skill_loaded", skills: skillNames })}\n\n`);
                if (hasFetch) write(`data: ${JSON.stringify({ type: "fetch_url_done", urls: fetchUrls })}\n\n`);
                console.log("[flow] POST /chat/stream 注入完成，再调 Ollama", { injectPartsLength: injectParts.length });
                const messagesForProtocol = buildMessagesWithSystem(sessionMessages);
                const finalReply = await chatWithOllama(messagesForProtocol, model);
                console.log("[flow] POST /chat/stream 协议轮次完成", { finalReplyLength: finalReply.length });
                sessionMessages.push({ role: "assistant", content: finalReply });
                appendMemory(message, finalReply);
                write(`data: ${JSON.stringify({ type: "summary", content: finalReply })}\n\n`);
              } else {
                appendMemory(message, stripped);
                write(`data: ${JSON.stringify({ type: "summary", content: stripped })}\n\n`);
              }
            } else {
              sessionMessages.push({ role: "assistant", content: fullReply });
              appendMemory(message, fullReply);
            }
            console.log("[flow] POST /chat/stream 无 DELEGATE 分支结束，发送 [DONE]");
            if (keepaliveId) clearInterval(keepaliveId);
            keepaliveId = undefined;
            write("data: [DONE]\n\n");
            res.end();
            chatLock = false;
            resolve();
            return;
          }
          console.log("[flow] POST /chat/stream 进入 DELEGATE 分支", { delegatesCount: delegates.length });
          const mainReplyClean = stripDelegateFromReply(fullReply).trim() || "已派发子任务。";
          write(`data: ${JSON.stringify({ type: "main_reply_clean", content: mainReplyClean })}\n\n`);
          const subResult = await runSubAgentsStreaming(delegates, model, (ev) => {
            write(`data: ${JSON.stringify(ev)}\n\n`);
          });
          console.log("[flow] POST /chat/stream subResult", { subResultLength: subResult.length, subResultPreview: subResult.slice(0, 300) });
          sessionMessages.push({ role: "assistant", content: mainReplyClean });
          sessionMessages.push({
            role: "user",
            content: "[子任务结果]\n\n" + subResult,
          });
          const messagesForSummary = buildMessagesWithSystem(sessionMessages);
          const finalReply = await chatWithOllama(messagesForSummary, model);
          console.log("[flow] POST /chat/stream finalReply", { finalReplyLength: finalReply.length, finalReplyPreview: finalReply.slice(0, 300) });
          write(`data: ${JSON.stringify({ type: "summary", content: finalReply })}\n\n`);
          sessionMessages.push({ role: "assistant", content: finalReply });
          appendMemory(message, finalReply);
          if (keepaliveId) clearInterval(keepaliveId);
          keepaliveId = undefined;
          write("data: [DONE]\n\n");
          res.end();
          chatLock = false;
          resolve();
        })
        .catch((err) => {
          if (keepaliveId) clearInterval(keepaliveId);
          keepaliveId = undefined;
          chatLock = false;
          reject(err);
        });
    });
    await streamPromise;
  } catch (e) {
    if (typeof timeoutId !== "undefined") clearTimeout(timeoutId);
    if (typeof keepaliveId !== "undefined") clearInterval(keepaliveId);
    chatLock = false;
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[flow] POST /chat/stream 异常", { error: msg, stack });
    if (!res.headersSent) {
      res.status(503).json({ error: "模型服务暂时不可用", detail: msg });
    } else {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  }
});

app.listen(config.port, () => {
  console.log("[gateway] ========== 网关已启动 ==========");
  console.log("[gateway] 监听端口", config.port);
  console.log("[gateway] 配置", {
    ollamaHost: config.ollamaHost,
    ollamaModel: config.ollamaModel,
    workspaceDir: config.workspaceDir,
    skillsDir: config.skillsDir,
    memoryPath: config.memoryPath,
    agentsPath: config.agentsPath,
  });
  console.log("[gateway] 可用路由: GET /config, GET /memory, GET /models, POST /memory/clear, POST /session/clear, POST /chat, POST /chat/stream");
  console.log("[gateway] =====================================");
});
