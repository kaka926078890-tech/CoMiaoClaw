# Claw 对话控制台（前端）

按 [docs/minimal-mvp.md](../docs/minimal-mvp.md) 实现的单会话聊天界面：React + TypeScript，调用网关 `POST /chat`。

## 目录结构

- `src/api/` — 网关请求封装
- `src/components/` — UI 组件（ChatConsole、MessageList、MessageInput、MessageBubble）
- `src/config/` — 环境与常量
- `src/hooks/` — 业务逻辑（useChat）
- `src/types/` — 类型定义

## 开发

```bash
npm install
npm run dev
```

默认打开 http://localhost:5173。需**先启动网关**在 3000 端口提供 `POST /chat`（见仓库内 [gateway/](../gateway/README.md)）：`cd gateway && npm install && npm run dev`。开发时通过 Vite proxy 将 `/chat` 转发到 `http://localhost:3000`。

## 环境变量

- `VITE_GATEWAY_ORIGIN`：网关基础 URL，留空则用当前 origin（依赖 dev proxy）。
- `VITE_OLLAMA_MODEL`：Ollama 模型名（如 `qwen2.5-coder:7b`），留空则使用网关端默认；设置后会在每次请求中传给网关。

## 构建

```bash
npm run build
npm run preview
```

生产部署时配置 `VITE_GATEWAY_ORIGIN` 为实际网关地址，或通过 Nginx 等反向代理将 `/chat` 指到网关。
