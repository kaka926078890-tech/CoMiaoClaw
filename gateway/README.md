# Claw 网关

按 [docs/minimal-mvp.md](../docs/minimal-mvp.md) 实现的聊天网关：提供 `POST /chat`，内部调用本地 Ollama 千问/其他模型。

## 环境变量

- `PORT`：网关监听端口，默认 `3000`。
- `OLLAMA_HOST`：Ollama 地址，默认 `http://127.0.0.1:11434`。
- `OLLAMA_MODEL`：模型名，默认 `qwen2.5-coder:7b`。使用千问可设为 `qwen2.5:7b` 或你本机已拉取的模型名。

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

网关监听 `http://localhost:3000`，前端通过 Vite proxy 将 `/chat` 转发到此端口。

## 生产

```bash
npm run build
PORT=3000 npm start
```

若 Ollama 未启动或模型不可用，`POST /chat` 将返回 503 及错误说明，而不会返回 500。
