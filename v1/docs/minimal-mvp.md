# 最小 MVP：自建 Claw（本地模型 + 单会话聊天）

## 目标与范围

**目标**：实现一个最小可用的「自己的 claw」—— 使用本地模型（如 qwen2.5-coder:7b）完成单会话聊天，能发消息、收回复（支持流式更佳）。

**在 MVP 内**：

- 模型层：对接 Ollama `/api/chat`（或同形态本地 API），支持非流式与流式。
- 会话：单会话，维护 `messages` 列表，可选 system prompt。
- 网关：常驻进程，提供 `POST /chat` 及可选 WebSocket，内部调模型并返回/流式返回。
- 前端：一个简单聊天页，发消息、展示回复（优先支持流式）。

**不纳入 MVP**（留作后续迭代）：

- 跨对话记忆
- 主 agent + 子 agent 协同
- 多 channel（如 Telegram、微信）
- 技能/工具（读文件、执行命令等）

---

## 模块说明

### 模型层

- 职责：向本地推理服务发请求，拿到模型回复。
- 实现要点：
  - 调用 Ollama：`POST http://127.0.0.1:11434/api/chat`，body 含 `model`（如 `qwen2.5-coder:7b`）、`messages`。
  - 支持 `stream: true` 时按 SSE 解析，实现流式输出。
- 可封装为统一接口：输入 `messages`，输出 `content` 或流式 chunk。

### 会话

- 职责：维护当前对话的上下文，供模型层使用。
- 实现要点：
  - 在内存（或简单存储）中维护 `messages: [{ role, content }]`，角色包括 `system`、`user`、`assistant`。
  - 可选一条固定的 `system` 消息（人设/规则）。
  - 请求模型时拼接：system（可选）+ 最近 N 轮 user/assistant，避免超出上下文长度。

### 网关

- 职责：常驻进程，对外提供聊天 API，内部调用会话 + 模型层。
- 实现要点：
  - HTTP：提供 `POST /chat`，body 如 `{ "message": "用户输入" }`，内部追加 user 消息、调模型、返回 `{ "reply": "..." }` 或流式 chunk。
  - 可选：WebSocket 连接，接收 `{ type: "message", text }`，服务端调模型并逐 chunk 推回，便于前端打字机效果。
  - 本地使用可暂不做认证；若暴露到公网，建议加 token 或 API key。

### 前端

- 职责：用户输入、发送、展示助手回复。
- 实现要点：
  - 单页即可：输入框 + 发送按钮 + 对话区域。
  - 调用网关的 `POST /chat` 或 WebSocket，将返回内容渲染到对话区域；流式时不断追加文本。

---

## 接口约定（示例）

### POST /chat（非流式）

- 请求：`{ "message": "用户消息" }`
- 响应：`{ "reply": "模型回复文本" }`

### POST /chat（流式，若支持）

- 请求：同上，可加 `"stream": true`。
- 响应：SSE 或 chunked，每块为一段文本，前端拼接展示。

### WebSocket（若支持）

- 客户端发送：`{ "type": "message", "text": "用户消息" }`
- 服务端推送：文本 chunk 或 `{ "type": "chunk", "text": "..." }`，结束可送 `{ "type": "done" }`。

---

## 本地运行方式（简要）

1. 确保 Ollama 已安装并拉取模型，例如：`ollama run qwen2.5-coder:7b`。
2. 启动网关：运行后端服务，监听指定端口（如 3000）。
3. 启动前端：打开聊天页，配置网关地址（如 `http://localhost:3000`）。
4. 在页面输入消息并发送，确认能收到模型回复（或流式输出）。

---

## 技术栈建议

- 本地模型：Ollama + qwen2.5-coder:7b（或其它已拉取的模型）。
- 后端：Node/TypeScript 或 Python（如 FastAPI），实现网关与模型调用。
- 前端：任意（纯 HTML/JS、React、Vue 等），优先保证「发一条、收一条/流式」稳定。
- 存储：MVP 阶段会话可仅放内存；需要持久化时再接入 SQLite 或 JSON 文件。
