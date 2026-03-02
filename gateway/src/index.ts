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

function buildMessagesWithSystem(sessionMessages: OllamaMessage[]): OllamaMessage[] {
  const systemContent = loadBootstrap();
  if (!systemContent) return sessionMessages;
  return [{ role: "system", content: systemContent }, ...sessionMessages];
}

function toSingleModel(s: string): string {
  const first = s.trim().split(",")[0]?.trim();
  return first && first.length > 0 ? first : s.trim();
}

const app = express();
app.use(express.json());

/** GET /config：返回当前网关配置，前端由此统一获取模型等（单一配置源） */
app.get("/config", (_req: Request, res: Response) => {
  const payload: { ollamaModel: string; ollamaModels?: string[] } = { ollamaModel: config.ollamaModel };
  if (config.ollamaModels.length > 0) payload.ollamaModels = config.ollamaModels;
  res.json(payload);
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

/** POST /session/clear：清空当前会话消息，记忆文件不变，用于测试「新启对话保留记忆」 */
app.post("/session/clear", (_req: Request, res: Response) => {
  sessionMessages.length = 0;
  res.json({ ok: true });
});

/** POST /chat：接收 { message }，追加 user 消息、调 Ollama、返回 { reply } */
app.post("/chat", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const message =
      typeof body === "object" && body !== null && typeof body.message === "string"
        ? String(body.message).trim()
        : "";
    console.log("[flow] POST /chat request", { body, messageLength: message?.length, messagePreview: message?.slice(0, 200) });

    if (!message) {
      res.status(400).json({ error: "请求体需包含 message 字符串且非空" });
      return;
    }

    const modelOverride =
      typeof body === "object" && body !== null && typeof body.model === "string" && body.model.trim().length > 0
        ? String(body.model).trim()
        : undefined;
    const model = toSingleModel(modelOverride ?? config.ollamaModel);
    console.log("[flow] POST /chat model", { model, sessionMessagesCount: sessionMessages.length });

    sessionMessages.push({ role: "user", content: message });

    const messagesForOllama = buildMessagesWithSystem(sessionMessages);
    const mainReply = await chatWithOllama(messagesForOllama, model);
    console.log("[flow] POST /chat mainReply", { mainReplyLength: mainReply.length, mainReplyPreview: mainReply.slice(0, 400), mainReplyTail: mainReply.slice(-300) });

    const delegates = parseDelegate(mainReply);
    console.log("[flow] POST /chat parseDelegate", { delegatesCount: delegates.length, delegates });

    if (delegates.length === 0) {
      sessionMessages.push({ role: "assistant", content: mainReply });
      appendMemory(message, mainReply);
      console.log("[flow] POST /chat no delegates, returning mainReply");
      res.json({ reply: mainReply });
      return;
    }

    const subResult = await runSubAgents(delegates, model);
    console.log("[flow] POST /chat subResult", { subResultLength: subResult.length, subResultPreview: subResult.slice(0, 300) });
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
    res.json({ reply: finalReply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /chat]", msg);
    res.status(503).json({
      error: "模型服务暂时不可用",
      detail: msg,
    });
  }
});

app.post("/chat/stream", async (req: Request, res: Response) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const body = req.body;
    const message =
      typeof body === "object" && body !== null && typeof body.message === "string"
        ? String(body.message).trim()
        : "";
    console.log("[flow] POST /chat/stream request", { body, messageLength: message?.length, messagePreview: message?.slice(0, 200) });
    if (!message) {
      res.status(400).json({ error: "请求体需包含 message 字符串且非空" });
      return;
    }
    const modelOverride =
      typeof body === "object" && body !== null && typeof body.model === "string" && body.model.trim().length > 0
        ? String(body.model).trim()
        : undefined;
    const model = toSingleModel(modelOverride ?? config.ollamaModel);
    console.log("[flow] POST /chat/stream model", { model, sessionMessagesCount: sessionMessages.length });

    sessionMessages.push({ role: "user", content: message });

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
    let fullReply = "";
    const streamPromise = new Promise<void>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error("模型响应超时")), timeoutMs);
      const messagesForOllama = buildMessagesWithSystem(sessionMessages);
      streamChatWithOllama(
        messagesForOllama,
        {
          onThinking: (text) => write(`data: ${JSON.stringify({ thinking: text })}\n\n`),
          onChunk: (chunk) => {
            fullReply += chunk;
            write(`data: ${JSON.stringify({ chunk })}\n\n`);
          },
        },
        model
      )
        .then(async () => {
          clearTimeout(timeoutId);
          console.log("[flow] POST /chat/stream fullReply", { fullReplyLength: fullReply.length, fullReplyPreview: fullReply.slice(0, 400), fullReplyTail: fullReply.slice(-300) });
          const delegates = parseDelegate(fullReply);
          console.log("[flow] POST /chat/stream parseDelegate", { delegatesCount: delegates.length, delegates });

          if (delegates.length === 0) {
            sessionMessages.push({ role: "assistant", content: fullReply });
            appendMemory(message, fullReply);
            console.log("[flow] POST /chat/stream no delegates, done");
            write("data: [DONE]\n\n");
            res.end();
            resolve();
            return;
          }
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
          write("data: [DONE]\n\n");
          res.end();
          resolve();
        })
        .catch(reject);
    });
    await streamPromise;
  } catch (e) {
    if (typeof timeoutId !== "undefined") clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /chat/stream]", msg);
    if (!res.headersSent) {
      res.status(503).json({ error: "模型服务暂时不可用", detail: msg });
    } else {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  }
});

app.listen(config.port, () => {
  console.log(
    `Claw 网关已启动：http://localhost:${config.port}，Ollama: ${config.ollamaHost}，模型: ${config.ollamaModel}`
  );
});
