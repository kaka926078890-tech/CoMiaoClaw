# Claw 网关

按 [docs/minimal-mvp.md](../docs/minimal-mvp.md) 实现的聊天网关：提供 `POST /chat`，内部调用本地 Ollama 千问/其他模型。

## 环境变量（单一配置源）

在**项目根目录**创建 `.env`（可复制 `.env.example`），配置一次即可被网关与前端统一使用：

- `OLLAMA_MODEL`：模型名，如 `deepseek-r1:8b`、`qwen2.5-coder:7b`。
- 可选 `PORT`：网关监听端口，默认 `3000`。
- 可选 `OLLAMA_HOST`：Ollama 地址，默认 `http://127.0.0.1:11434`。

网关启动时从根目录加载 `.env`，并暴露 `GET /config` 供前端拉取当前模型等配置。

## 运行前

1. 安装并启动 Ollama，拉取模型，例如：
   ```bash
   ollama run qwen2.5-coder:7b
   # 或千问：ollama run qwen2.5:7b
   ```
2. 确保 Ollama 在运行（默认 `http://127.0.0.1:11434`）。

## 开发

```bash
npm install
npm run dev
```

网关监听 `http://localhost:3000`，提供 `POST /chat`、`POST /chat/stream`、`GET /config`；前端通过 Vite proxy 转发到此端口。

## 生产

```bash
npm run build
PORT=3000 npm start
```

若 Ollama 未启动或模型不可用，`POST /chat` 将返回 503 及错误说明，而不会返回 500。
