import express, { Request, Response } from "express";
import { config } from "./config.js";
import { chatWithOllama, streamChatWithOllama } from "./ollama.js";
import type { OllamaMessage } from "./ollama.js";

const app = express();
app.use(express.json());

/** 单会话内存：MVP 仅维护当前对话消息列表 */
const sessionMessages: OllamaMessage[] = [];

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

    const reply = await chatWithOllama(sessionMessages, modelOverride);

    sessionMessages.push({ role: "assistant", content: reply });

    res.json({ reply });
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
    res.write(": \n\n");

    const timeoutMs = 120000;
    let fullReply = "";
    const streamPromise = new Promise<void>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error("模型响应超时")), timeoutMs);
      streamChatWithOllama(
        sessionMessages,
        (chunk) => {
          fullReply += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
        modelOverride
      )
        .then(() => {
          clearTimeout(timeoutId);
          sessionMessages.push({ role: "assistant", content: fullReply });
          res.write("data: [DONE]\n\n");
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
