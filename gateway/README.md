# Claw 网关

按 [docs/minimal-mvp.md](../docs/minimal-mvp.md) 实现的聊天网关：提供 `POST /chat`，内部调用本地 Ollama 千问/其他模型。

## 环境变量（单一配置源）

在**项目根目录**创建 `.env`（可复制 `.env.example`），配置一次即可被网关与前端统一使用：

- `OLLAMA_MODEL`：模型名，如 `deepseek-r1:8b`、`qwen2.5-coder:7b`。
- 可选 `PORT`：网关监听端口，默认 `3000`。
- 可选 `OLLAMA_HOST`：Ollama 地址，默认 `http://127.0.0.1:11434`。
- 可选 `MEMORY_PATH`、`PERSONA_PATH`：记忆与人设文件路径，默认 `gateway/data/memory.md`、`gateway/data/persona.md`。
- 可选 `MEMORY_INJECT_COUNT`、`MEMORY_INJECT_MAX_CHARS`、`MEMORY_ENTRY_MAX_CHARS`：读记忆条数(默认 10)、注入总字符上限(默认 2000)、写记忆单条截断(默认 80)。

网关启动时从根目录加载 `.env`，并暴露 `GET /config` 供前端拉取当前模型等配置。

## 跨对话记忆与人设

- **记忆**：每轮对话结束后会向 `gateway/data/memory.md`（或 `MEMORY_PATH`）追加一段；调用模型前会注入最近 N 段记忆（条数/总长见上）。
- **人设**：若存在 `gateway/data/persona.md`（或 `PERSONA_PATH`），会在每次请求前读入并拼入 system。可复制 `gateway/data/persona.md.example` 为 `persona.md` 并编辑。

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
