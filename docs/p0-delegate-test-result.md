# P0 主·子 Agent（DELEGATE）测试结论

**日期**：2026-03-01  
**结论**：**实现目标已完成**；端到端验收已通过（主/子共用同一模型，流式出现「正在执行子任务…」+ 综合回复）。

---

## 1. 实现目标（已完成）

| 项目 | 状态 |
|------|------|
| 约定 DELEGATE 格式，实现 `parseDelegate(reply)` | ✅ `gateway/src/delegate.ts` |
| 子角色配置与 `getSubPersona(role)` | ✅ `gateway/data/subpersona/*.md` + `subpersona.ts` |
| `runSubAgents(delegates, model?)` 串行子任务 | ✅ |
| POST /chat 接入：主回复 → 解析 → 子调用 → 再调主 agent → 综合回复 | ✅ |
| POST /chat/stream 接入：主流式结束 → 解析 → 子调用 → SSE 追加综合 → [DONE] | ✅ |
| 主机器人人设（persona.md）含 DELEGATE 与子角色说明 | ✅ |

---

## 2. 本轮重启后测试

- **方式**：`node script/test-delegate-stream.mjs`（请求 `POST http://localhost:5173/chat/stream`，消息为「先让 researcher 查 REST API，再让 coder 写 Node fetch 示例」）。
- **现象**：接口正常，流式返回完整回复并 [DONE]；回复内容为主模型**直接回答**（自写「研究员」「程序员」两段），**未出现** `DELEGATE: ... | researcher` 等行，因此**未出现**「正在执行子任务…」及子 agent 综合回复。
- **原因**：主模型（如 deepseek-r1:8b）未在当条回复中按人设输出 DELEGATE 格式，`parseDelegate(fullReply)` 得到空数组，网关不进入子 agent 分支。

---

## 3. 管道验证（假主回复）

- **方式**：`node script/verify-delegate-pipeline.mjs`（用含 DELEGATE 的假主回复调用 `parseDelegate` + `runSubAgents`）。
- **结果**：
  - `parseDelegate` 正确解析出 2 条：`researcher`、`coder`。
  - `runSubAgents` 被正确调用；子 agent 请求因默认模型 `qwen2.5-coder:7b` 未安装返回 404，属环境配置，非逻辑错误。
- **结论**：当主回复**包含** DELEGATE 行时，网关的解析与子 agent 调用逻辑正确。

---

## 4. 是否完成目标

- **功能与实现**：**已完成**。主/子 agent 协同的约定、解析、子角色配置、子 agent 调用、非流式/流式接入、persona 说明均已落地；管道在「假主回复」下验证通过。
- **端到端验收**：**未在真实对话中触发**。因主模型未输出 DELEGATE 行，需依赖：
  - 主模型对人设的遵守程度，或
  - 更强约束的 persona/提示（如明确要求「必须且仅能通过 DELEGATE 行派发」），或
  - 换用更易遵守格式的模型。

---

## 5. 主/子共用同一模型（已确认）

主 agent 与子 agent **共用同一 Ollama 模型**（如 deepseek-r1:8b），仅 system 不同（主用 `persona.md`，子用 `subpersona/<role>.md`）。测试脚本已从 `/config` 读取 `ollamaModel` 并传给 `/chat/stream`，保证与网关使用同一模型。管道验证脚本支持 `OLLAMA_MODEL=deepseek-r1:8b node script/verify-delegate-pipeline.mjs`，子 agent 调用成功并返回 researcher + coder 结果。

---

## 6. 端到端验收（已达成）

- 强化 `persona.md` 后，主模型在用户说「先让 researcher 查 REST API，再让 coder 写 Node fetch 示例」时输出 DELEGATE 行。
- 流式测试中已出现：**主回复（含 DELEGATE 行）→ [正在执行子任务…] → 综合回复**，且子 agent 使用与主 agent 相同的模型。
