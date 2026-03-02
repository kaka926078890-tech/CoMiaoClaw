# OpenClaw 对齐说明

本文档记录本项目与 [OpenClaw](https://docs.openclaw.ai) 在工作区结构、bootstrap 注入、派发流程上的对应关系与实现差异。

## 工作区结构

默认工作区目录为 `gateway/data`（可通过环境变量 `WORKSPACE` 覆盖）。其下采用 OpenClaw 风格文件名：

| 文件/目录 | 说明 | 注入顺序 |
|-----------|------|----------|
| AGENTS.md | 主 agent 操作契约（规则、派发、记忆使用等） | 1 |
| SOUL.md | 人设/语气/边界（可选） | 2 |
| IDENTITY.md | 名字、角色、目标（可选） | 3 |
| USER.md | 用户偏好（可选） | 4 |
| TOOLS.md | 环境/工具约定（可选） | 5 |
| MEMORY.md | 长期记忆，按段注入 | 6 |
| agents/ | 子 agent 定义，每文件 `<role>.md` 即该角色的 system | 子 agent 时按 role 读取 |
| skills/ | 技能目录，每子目录内含 SKILL.md（name、description） | 7（列表摘要注入主 agent） |

向后兼容：若不存在 `AGENTS.md` 则使用 `persona.md`；若不存在 `MEMORY.md` 则使用 `memory.md`；若不存在 `agents/` 则使用 `subpersona/`。

## Bootstrap 注入顺序

网关在每次构建 system 时（`loadBootstrap()`）按以下顺序拼接内容：

1. AGENTS.md（或 persona.md）
2. SOUL.md（存在则注入）
3. IDENTITY.md（存在则注入）
4. USER.md（存在则注入）
5. TOOLS.md（存在则注入）
6. 可用技能列表（扫描 workspace/skills 下各 SKILL.md 的 name + 描述摘要）
7. MEMORY.md（或 memory.md）经 `loadMemory()` 处理后的记忆块

每文件最大字符数由 `config.bootstrapMaxChars`（默认 20000）限制，总长度由 `config.bootstrapTotalMaxChars`（默认 150000）限制。缺失文件不报错，不注入内容。

## 派发流程与 OpenClaw 的对应

| OpenClaw | 本项目 |
|----------|--------|
| 主 agent 调用工具 `sessions_spawn(task, agentId?, ...)` | 主 agent 在回复正文中写 DELEGATE 行或 `sessions_spawn` JSON，网关从 content 解析后执行（不传 tools、不解析 tool_calls） |
| 子智能体在独立会话中非阻塞运行，完成后通过 **announce** 回传结果 | 子 agent 由网关同步调用（DAG 分层：层内并行、层间串行），子结果拼成一段后作为「[子任务结果]」再调主 agent |
| 主渠道收到「子任务完成 + 结果摘要」 | 主 agent 再被调一次得到**综合回复**，推给前端并写入记忆 |

即：一条 DELEGATE 行等价于一次 `sessions_spawn`；综合回复等价于 OpenClaw 中主 agent 收到子结果后的总结。差异为本项目**同步执行**子任务，OpenClaw 为**非阻塞 + 通告**。

子 agent 上下文：OpenClaw 子智能体仅注入 AGENTS.md + TOOLS.md（promptMode=minimal）。本项目子 agent 的 system = `workspace/agents/<role>.md` + 可选 `workspace/TOOLS.md`。

## 与 OpenClaw 的差异

- OpenClaw 注入 `MEMORY.md`、`BOOTSTRAP.md`、`HEARTBEAT.md`、`USER.md`、`IDENTITY.md`、`TOOLS.md`、`SOUL.md`、`AGENTS.md` 等；本项目采用上述精简顺序，且暂无 BOOTSTRAP、HEARTBEAT。
- 子 agent：OpenClaw 使用 `agents.list[]` 配置；本项目使用 `workspace/agents/<role>.md` 文件驱动，等价于每个 role 的「AGENTS」内容。

## 配置项

- `WORKSPACE`：工作区根路径
- `PERSONA_PATH`：覆盖主 agent 契约文件（默认 workspace/AGENTS.md 或 persona.md）
- `MEMORY_PATH`：覆盖记忆文件（默认 workspace/MEMORY.md 或 memory.md）
- `SUBPERSONA_DIR`：覆盖子 agent 目录（默认 workspace/agents 或 workspace/subpersona）
- `BOOTSTRAP_MAX_CHARS`、`BOOTSTRAP_TOTAL_MAX_CHARS`：单文件与总长度上限

## 技能（Skills）

目录 `workspace/skills/` 下每个子目录可包含 **SKILL.md**（或 `skill.md`），格式与 ClawHub/OpenClaw 对齐：支持 **YAML frontmatter**（`name`、`description`、`version`、可选 `metadata.openclaw` 等）与正文。网关列表与加载均按此解析。

- **Bootstrap 列表**：扫描各子目录的 SKILL.md，优先从 frontmatter 取 `name`/`description`，无则退化为首行/前约 200 字，拼成可用技能列表注入 system。
- **调用协议**（网关自定义）：
  - **SKILL: &lt;技能名&gt;**：主 agent 在回复正文中写该行，技能名为 `workspace/skills` 下子目录名；网关读取对应 SKILL.md 全文（可设长度上限），拼成 `[已加载技能：name1, name2]\n\n--- 技能 name1 ---\n{content}\n\n...` 作为一条 user 消息追加，再调一次主 agent 后返回。可多行加载多个技能。
  - **FETCH_URL: &lt;url&gt;**：主 agent 在回复中写该行（完整 http(s) 地址）；网关 GET 该 URL（超时、User-Agent、body 上限），将响应转为文本（HTML 简单去标签），拼成 `[已获取 URL 内容]\n\n&lt;url&gt;\n\n{内容}` 追加为 user 消息，再调主 agent。用于联网、扒地址。
- **解析顺序**：DELEGATE 优先；无 DELEGATE 时再解析 SKILL，再解析 FETCH_URL；同轮可同时处理 SKILL 与 FETCH_URL，合并为一条注入再调一轮。
- **配置**：`FETCH_URL_TIMEOUT_MS`（默认 15000）、`FETCH_URL_MAX_BODY`（默认 200000）；仅允许 http(s)。
