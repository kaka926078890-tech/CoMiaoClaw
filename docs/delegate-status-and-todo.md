# 主·子 Agent（DELEGATE）当前状态与待办

**更新日期**：2026-03-01  
**用途**：新开对话时快速恢复上下文，承接此前主/子 agent 与前端展示的修改。

---

## 一、已处理内容（本轮及之前）

| 项目 | 状态 | 说明 |
|------|------|------|
| P0 主/子 agent 协同 | ✅ | 约定 DELEGATE 格式、parseDelegate、getSubPersona、runSubAgents/runSubAgentsStreaming、POST /chat 与 /chat/stream 接入、persona 与 subpersona 配置 |
| 主/子共用同一模型 | ✅ | 主与子均用同一 Ollama 模型，仅 system 不同（persona.md vs subpersona/*.md） |
| 网关结构化事件 | ✅ | 用 `main_reply_clean`、`summary`、`sub_thinking`/`sub_chunk`/`sub_done` 替代占位 chunk，不再向 SSE 推送「[正在执行子任务…]」等无意义文字 |
| 前端：主回复与综合回复分离 | ✅ | 支持 mainReplyClean（主回复去 DELEGATE）、summary（综合回复）单独展示；综合回复单独一块「综合回复」 |
| 前端：Markdown 渲染 | ✅ | 消息正文、子 agent 结论、综合回复用 react-markdown + remark-gfm |
| 前端：复制 / 重发按钮 | ✅ | 气泡下方复制、以此为内容发送 |
| 子 agent 思考/结论数据结构 | ✅ | subAgents[].thinking 与 subAgents[].content 分离；UI 上子 agent 块内分「思考过程」「结论」两段 |
| 文档：OpenClaw 参考 | ✅ | docs/sub-agent-flow.md 已补充 OpenClaw 任务拆分、并行、通告与总结的说明 |

---

## 二、当前问题（待修复或优化）

### 1. 综合回复应是「对子 agent 内容的总结」，而不是派发任务

- **现象**：综合回复里出现「DELEGATE: … | researcher DELEGATE: … | coder」，即主 agent 在第二次调用时又输出了 DELEGATE，而不是基于 [子任务结果] 做总结归纳。
- **已做**：网关在综合阶段写入的 user 消息前增加强约束：「请根据以下 [子任务结果] 用一段话总结并归纳给用户，直接输出综合回复内容。禁止输出 DELEGATE 或任何任务派发语句。」再拼接 [子任务结果] + subResult。若仍出现 DELEGATE，可再加强 persona 或单独 system 片段。

### 2. 红框无效内容（DELEGATE 行）不应展示

- **现象**：主回复气泡里仍出现两行「DELEGATE: … | researcher」等，用户标注为无效内容不应输出。
- **已做**：有 subAgents 或 summary 时，主回复区只展示 mainReplyClean；若 mainReplyClean 为空则展示「已派发子任务。」，**不再** fallback 到 content，避免展示 DELEGATE 行。

### 3. 子 agent 思考过程 / 结论流式与结论外置

- **结论外置**：已做。每个子 agent 现为两块——「xxx（子 agent）思考过程」可折叠；「xxx（子 agent）结论」独立一块在下方、不折叠，与思考过程分离。
- **流式**：网关已发 sub_thinking / sub_chunk，前端 onSubThinking/onSubChunk 会 setState；若观感上「没有流式」，可能是子 agent 块默认折叠导致看不到实时更新，或可考虑在接收流期间将对应子 agent 块默认展开。

### 4. 子 agent 并行（可选）

- **现状**：子 agent 串行执行。
- **待做**：无依赖时改为并行（如 Promise.all），参见 docs/openclaw-delegate-questions.md。

---

## 三、关键文件索引

| 用途 | 路径 |
|------|------|
| 网关流式与 DELEGATE 逻辑 | gateway/src/index.ts |
| 子 agent 解析与执行 | gateway/src/delegate.ts |
| 主 agent 人设 | gateway/data/persona.md |
| 综合阶段约束 | 待加：可在 index.ts 构造 messagesForSummary 时追加 system，或见上 2.1 |
| 前端消息展示 | frontend/src/components/MessageBubble.tsx |
| 前端流式与 sub/main/summary | frontend/src/hooks/useChat.ts, frontend/src/api/gateway.ts |
| 流程与 OpenClaw 参考 | docs/sub-agent-flow.md |
| 开放问题记录 | docs/openclaw-delegate-questions.md |

---

## 四、新开对话时建议

1. 先看本文档「二、当前问题」和「三、关键文件索引」。
2. 优先修：综合回复强制为总结（2.1）、红框 DELEGATE 不展示（2.2）、子 agent 结论外置且流式可感知（2.3）。
3. 需要时查 docs/sub-agent-flow.md 与 persona.md 综合段说明。
