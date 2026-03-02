# 新对话提示词：Claw 派发与模型兼容现状

复制下面整段到新对话，便于继续排查或开发。

---

## 项目与目标

- **项目**：Claw，本地聊天网关（Node/Express，端口 3000）+ 前端（Vite/React，5173），对接 Ollama，对标 OpenClaw 的主/子 agent 派发。
- **派发流程**：用户发消息 → 主 agent 回复（可能含派发）→ 网关解析派发 → 跑子 agent（researcher/coder 等）→ 再调主 agent 做综合回复 → 返回/推流给前端。

## 当前派发协议（仅文本，无 tool_calls）

网关**不**向 Ollama 传 tools，**不**解析 `message.tool_calls`。派发只认以下两种正文格式：

1. **delegate_lines**：正文中的 `DELEGATE: 子任务描述 | 子角色名 [| 依赖]` 行，用 `parseDelegate(content)` 解析。
2. **content_json**：正文中的 `{"name":"sessions_spawn","arguments":{...}}` JSON，用 `parseDelegateFromContent(content)` 解析。

不解析「**task**：… **role**：xxx」等自然语言描述；模型需写出 DELEGATE 行或 JSON 才会触发派发。

主契约与人设：`gateway/data/AGENTS.md`。子角色：`gateway/data/agents/*.md`（如 researcher、coder）。详见 `docs/openclaw-alignment.md`、`docs/delegate-protocol-transition.md`。

## 当前问题与现象

- **各模型（含 DeepSeek R1、千问 2.5 等）**：网关一律不传 tools，主 agent 需在回复正文中写出 **DELEGATE 行**或 **sessions_spawn JSON** 才会触发派发。若只写「将任务拆解为…」「1. task: … role: …」等自然语言，不会触发。
- **人设与提示**：`AGENTS.md` 已说明派发方式为 DELEGATE 行或正文 JSON，并禁止只描述 task/role。

## 关键文件

- 派发与解析：`gateway/src/delegate.ts`（parseDelegate、parseDelegateFromContent、stripDelegateFromReply、stripSpawnJsonFromReply）。
- 与 Ollama 通信：`gateway/src/ollama.ts`（不传 tools，仅收 content）。
- 网关路由与派发来源逻辑：`gateway/src/index.ts`（delegateSource 仅 delegate_lines / content_json / none）。
- 协议说明：`docs/delegate-protocol-transition.md`。

## 希望在新对话里推进的事

（请按你的实际需求勾选或改写）

- [ ] 加强 AGENTS.md 或 bootstrap 提示，提高模型写出 DELEGATE 行或 JSON 的比例。
- [ ] 其他：_____________。

---

把上述「项目与目标」「当前派发协议」「当前问题与现象」「关键文件」和你在「希望在新对话里推进的事」中勾选/填写的内容，一起发给新对话即可。
