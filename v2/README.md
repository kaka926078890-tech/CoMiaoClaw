# Claw V2

重写版工程，按 [docs/claw-v2-design.md](docs/claw-v2-design.md) 分层；阶段与待办见 [docs/todo.md](docs/todo.md)。前端已搭好，gateway 为骨架待实现。

## 快速启动

在 `v2` 目录下执行：

```bash
./dev.sh start all        # 启动 frontend + gateway（gateway 暂无 dev 时会跳过）
./dev.sh start frontend   # 仅启动前端 (http://localhost:5173)
./dev.sh start gateway    # 仅启动网关 (http://localhost:3000，需 gateway 有 dev 脚本)
./dev.sh stop all         # 停止全部
./dev.sh restart all      # 重启全部
./dev.sh restart frontend # 仅重启前端
./dev.sh restart gateway  # 仅重启网关
```

依赖：`v2/frontend` 下先执行 `npm install`。日志在 `v2/logs/`，PID 在 `v2/.dev/`。

## 目录

- `gateway/src/transport/` — 接入层：HTTP/SSE、路由、校验
- `gateway/src/application/` — 应用层：chat pipeline、会话用例
- `gateway/src/domain/` — 领域层：tools 注册表、各工具执行器
- `gateway/src/infrastructure/` — 基础设施层：LLM 客户端、记忆/向量、skill runner、工作区
- `gateway/src/shared/` — 类型、常量、错误码
- `frontend/` — 前端（React + Vite，端口 5173）
