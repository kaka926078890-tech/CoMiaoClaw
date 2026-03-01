import "./loadenv.js";
import express, { Request, Response } from "express";
import { config } from "./config.js";
import { loadMemory, appendMemory, getMemoryRaw } from "./memory.js";
import { loadPersona } from "./persona.js";
import { chatWithOllama, streamChatWithOllama } from "./ollama.js";
import type { OllamaMessage } from "./ollama.js";
import { parseDelegate, stripDelegateFromReply, runSubAgents, runSubAgentsStreaming } from "./delegate.js";

function buildMessagesWithSystem(sessionMessages: OllamaMessage[]): OllamaMessage[] {
  const personaText = loadPersona();
  const memoryText = loadMemory();
  const systemContent = [personaText, memoryText].filter(Boolean).join("\n\n");
  if (!systemContent) return sessionMessages;
  return [{ role: "system", content: systemContent }, ...sessionMessages];
}

const app = express();
app.use(express.json());

/** GET /config：返回当前网关配置，前端由此统一获取模型等（单一配置源） */
app.get("/config", (_req: Request, res: Response) => {
  res.json({ ollamaModel: config.ollamaModel });
});

/** GET /memory：返回记忆文件原始内容，供历史记录页对照 */
app.get("/memory", (_req: Request, res: Response) => {
  res.type("text/plain").send(getMemoryRaw());
});

/** GET /models：代理 Ollama /api/tags，返回本地模型名列表供前端下拉 */
app.get("/models", async (_req: Request, res: Response) => {
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

    if (!message) {
      res.status(400).json({ error: "请求体需包含 message 字符串且非空" });
      return;
    }

    const modelOverride =
      typeof body === "object" && body !== null && typeof body.model === "string" && body.model.trim().length > 0
        ? String(body.model).trim()
        : undefined;

    sessionMessages.push({ role: "user", content: message });

    const messagesForOllama = buildMessagesWithSystem(sessionMessages);
    const mainReply = await chatWithOllama(messagesForOllama, modelOverride);

    const delegates = parseDelegate(mainReply);
    if (delegates.length === 0) {
      sessionMessages.push({ role: "assistant", content: mainReply });
      appendMemory(message, mainReply);
      res.json({ reply: mainReply });
      return;
    }

    const subResult = await runSubAgents(delegates, modelOverride);
    const mainReplyClean = stripDelegateFromReply(mainReply);
    sessionMessages.push({ role: "assistant", content: mainReplyClean });
    sessionMessages.push({
      role: "user",
      content: "[子任务结果]\n\n" + subResult,
    });
    const messagesForSummary = buildMessagesWithSystem(sessionMessages);
    const finalReply = await chatWithOllama(messagesForSummary, modelOverride);
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
    if (!message) {
      res.status(400).json({ error: "请求体需包含 message 字符串且非空" });
      return;
    }
    const modelOverride =
      typeof body === "object" && body !== null && typeof body.model === "string" && body.model.trim().length > 0
        ? String(body.model).trim()
        : undefined;

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
        modelOverride
      )
        .then(async () => {
          clearTimeout(timeoutId);
          const delegates = parseDelegate(fullReply);
          if (delegates.length === 0) {
            sessionMessages.push({ role: "assistant", content: fullReply });
            appendMemory(message, fullReply);
            write("data: [DONE]\n\n");
            res.end();
            resolve();
            return;
          }
          const mainReplyClean = stripDelegateFromReply(fullReply);
          write(`data: ${JSON.stringify({ type: "main_reply_clean", content: mainReplyClean })}\n\n`);
          const subResult = await runSubAgentsStreaming(delegates, modelOverride, (ev) => {
            write(`data: ${JSON.stringify(ev)}\n\n`);
          });
          sessionMessages.push({ role: "assistant", content: mainReplyClean });
          sessionMessages.push({
            role: "user",
            content:
              "请根据以下 [子任务结果] 用一段话总结并归纳给用户，直接输出综合回复内容。禁止输出 DELEGATE 或任何任务派发语句。\n\n[子任务结果]\n\n" +
              subResult,
          });
          const messagesForSummary = buildMessagesWithSystem(sessionMessages);
          const finalReply = await chatWithOllama(messagesForSummary, modelOverride);
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
