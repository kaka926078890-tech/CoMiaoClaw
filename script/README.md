# Claw 脚本

统一启动、停止、重启网关与前端。

## 使用前

- 在项目根目录已执行：`cd gateway && npm install`、`cd frontend && npm install`
- 若使用本地模型，请先启动 Ollama（如 `ollama run qwen2.5-coder:7b`）

## 命令

在项目根目录执行（或直接执行脚本绝对路径）：

| 命令 | 说明 |
|------|------|
| `./script/start.sh` | 启动网关(3000) + 前端(5173)，后台运行，PID 写入 `script/claw.pids`，日志在 `script/logs/` |
| `./script/stop.sh` | 按 PID 与端口结束网关、前端 |
| `./script/restart.sh` | 先 stop 再 start |

## 日志

- `script/logs/gateway.log` — 网关标准输出/错误
- `script/logs/frontend.log` — 前端标准输出/错误
