import express, { Request, Response } from "express";
import { config } from "./config.js";
import { chatWithOllama } from "./ollama.js";
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

app.listen(config.port, () => {
  console.log(
    `Claw 网关已启动：http://localhost:${config.port}，Ollama: ${config.ollamaHost}，模型: ${config.ollamaModel}`
  );
});
