# 派发协议：当前仅文本（DELEGATE 行 + 正文 JSON）

本文档说明当前网关采用的派发方式，以及曾考虑过的 tool_calls 方案（已不再使用）。

## 当前协议（仅文本）

- **触发方式**：主 agent 在回复正文中任选其一  
  1. **DELEGATE 行**：每行 `DELEGATE: 子任务描述 | 子角色名 [| 依赖序号如 0,1]`，多任务多行。  
  2. **正文 JSON**：`{"name":"sessions_spawn","arguments":{"task":"…","role":"…"}}`（可多条）。
- **解析**：网关不向 Ollama 传 tools，不解析 `message.tool_calls`。仅从 `message.content` 用 `parseDelegate(content)` 与 `parseDelegateFromContent(content)` 解析；主回复用 `stripDelegateFromReply` / `stripSpawnJsonFromReply` 清洗。
- **人设约定**：AGENTS.md 要求必须用上述两种方式之一派发，禁止只写「task/role」自然语言描述。

## 曾考虑的 tool_calls 方案（已弃用）

此前曾考虑：请求 Ollama 时传入 `tools: [getDelegateToolDefinition()]`，用 `message.tool_calls` 解析派发。当前实现已去掉该路径，仅保留文本协议（DELEGATE 行 + 正文 JSON），以便所有模型统一通过正文格式触发派发。

## 涉及文件

| 文件 | 说明 |
|------|------|
| `gateway/src/delegate.ts` | `parseDelegate`、`parseDelegateFromContent`、`stripDelegateFromReply`、`stripSpawnJsonFromReply`；无 getDelegateToolDefinition / parseDelegateFromToolCalls。 |
| `gateway/src/ollama.ts` | 不传 tools，不解析 tool_calls；仅返回 content。 |
| `gateway/src/index.ts` | 派发来源仅 delegate_lines / content_json / none。 |
| `gateway/data/AGENTS.md` | 派发说明为 DELEGATE 行或正文 JSON。 |

## 与 OpenClaw 的对应

- 语义上仍对应「主 agent 派发子任务」；本项目通过正文 DELEGATE/JSON 触发，OpenClaw 通过工具调用。执行方式为同步：网关解析后按 DAG 执行子 agent，子结果拼成「[子任务结果]」再调主 agent 做综合回复。
