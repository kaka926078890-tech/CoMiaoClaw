# Claw 脚本

统一启动、停止、重启网关与前端。

## 使用前

- 依赖已安装：在项目根目录执行 `npm run install:all`，或分别 `cd gateway && npm install`、`cd frontend && npm install`
- 若使用本地模型，请先启动 Ollama（如 `ollama run deepseek-r1:8b`）

## 一句命令启动（推荐）

在**项目根目录**执行：

```bash
npm run dev
```

或：

```bash
npm start
```

会同时启动网关（http://localhost:3000）与前端（http://localhost:5173），终端会并排输出两边日志，Ctrl+C 一次即可全部退出。跨平台（Windows / macOS / Linux）可用。

## 脚本方式（可选）

在项目根目录执行（需 bash 环境）：

| 命令 | 说明 |
|------|------|
| `./script/start.sh` | 启动网关(3000) + 前端(5173)，后台运行，PID 写入 `script/claw.pids`，日志在 `script/logs/` |
| `./script/stop.sh` | 按 PID 与端口结束网关、前端 |
| `./script/restart.sh` | 先 stop 再 start |

## 日志

- `script/logs/gateway.log` — 使用 script 启动时的网关输出
- `script/logs/frontend.log` — 使用 script 启动时的前端输出

---

## 定时任务：每 2 分钟在 work/test 写时间文件

网关启动后，定时任务每分钟检查一次；若任务类型为「写时间文件」且间隔为 2 分钟，则每 2 分钟写入一个带当前时间 ISO 字符串的文件。**写入路径**：若在 `.env` 中配置了 `LOCAL_FILE_ROOT`，文件写入该目录下的 `test`（即 `LOCAL_FILE_ROOT/test`）；若未配置则写入 `WORKSPACE/work/test`，未配置 `WORKSPACE` 时默认为项目内 `gateway/data`。

### 方式一：控制台对话（推荐）

在**聊天页面**用自然语言说明需求，Claw 会自动创建定时任务并执行。例如在输入框发送：

- 「每隔 2 分钟在 work 下的 test 文件夹里添加一个文件，文件中记录当时的时间。」

模型须按标准格式输出一行：`TIME_TASK: 间隔分钟 | 任务`。例如「每隔 2 分钟在 work/test 写时间文件」→ `TIME_TASK: 2 | 在 work 下的 test 文件夹里添加一个文件，文件中记录当时的时间`。网关解析后创建任务并注入结果，Claw 再回复确认。到点后任务内容会交给模型拆解执行（如写文件等）。

### 方式二：定时任务面板

1. 启动网关与前端（如 `npm run dev`），打开 http://localhost:5173。
2. 侧栏点击「定时任务」打开面板。
3. 点击「新建」→ 任务名称随意（如「写时间」）→ 类型选「每 N 分钟在 work/test 写时间文件」→ 间隔填 **2** → 勾选「启用」→ 点击「添加」。

### 方式三：接口创建（curl）

```bash
curl -X POST http://localhost:3000/scheduled-tasks \
  -H "Content-Type: application/json" \
  -d '{"name":"写时间","type":"agent-run","intervalMinutes":2,"enabled":true,"instruction":"在 work 下的 test 文件夹里添加一个文件，文件中记录当时的时间"}'
```

创建后网关会按间隔在配置的目录下写文件。在 `.env` 中配置 `LOCAL_FILE_ROOT` 时写入该目录下的 `test`；或配置 `WORKSPACE` 时写入 `WORKSPACE/work/test`。

---

## 测试 DELEGATE（主/子 agent）

主 agent 在回复里输出 `DELEGATE: 子任务描述 | 子角色名` 时，网关会解析并调子 agent，再调主 agent 综合后返回。

### 前置条件

1. 网关与 Ollama 已启动（如 `npm run dev`）。
2. **人设需包含 DELEGATE 说明**：若没有 `gateway/data/persona.md`，从 `gateway/data/persona.md.example` 复制并改名为 `persona.md`（示例里已含派发格式与子角色 researcher、coder）。
3. 子角色文件存在：`gateway/data/subpersona/researcher.md`、`gateway/data/subpersona/coder.md`（项目已带示例）。

### 方式一：用前端测（推荐）

1. 打开 http://localhost:5173，在输入框发一句**能触发派发**的提问，例如：
   - 「先让 researcher 查一下什么是 REST API，再让 coder 写一段 Node 的 GET 请求示例。」
   - 「请用 researcher 查“幂等”的定义，再用 coder 写一个幂等的 POST 示例。」
2. 预期：先看到主回复（可能含“正在执行子任务”或思考），随后出现「正在执行子任务…」，最后是**综合回复**（主 agent 基于子任务结果总结的答案）。流式会先出主回复，再出一段综合内容。

### 方式二：用接口测（非流式）

网关默认 3000 端口。PowerShell 示例：

```powershell
Invoke-RestMethod -Uri http://localhost:3000/chat -Method POST -ContentType "application/json" -Body '{"message":"先让 researcher 查一下什么是 REST API，再让 coder 写一段简单的 Node fetch 示例。"}'
```

返回的 `reply` 应为**综合回复**（主 agent 在收到子任务结果后的最终回答）。

### 方式三：用接口测（流式）

```powershell
# 会持续输出 SSE 行，最后为 data: [DONE]
Invoke-WebRequest -Uri http://localhost:3000/chat/stream -Method POST -ContentType "application/json" -Body '{"message":"让 researcher 查 REST API 定义，再让 coder 写个 curl 示例。"}' -UseBasicParsing | Select-Object -ExpandProperty Content
```

预期：先收到主流式 chunk，再收到「正在执行子任务…」，再收到综合回复的 chunk，最后 `data: [DONE]`。

### 若主 agent 从不输出 DELEGATE

- 确认 `gateway/data/persona.md` 存在且内容里包含「DELEGATE」「子角色 researcher / coder」的说明（可对照 `persona.md.example`）。
- 提问尽量明确「先让 researcher … 再让 coder …」，便于主模型按人设输出 DELEGATE 行。
