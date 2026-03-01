# 项目 Todo（长线对标 OpenClaw）

**长线目标**：对标 [OpenClaw](https://docs.openclaw.ai) 产品，实现主/子智能体协同、任务拆分与派发、并行执行、结果通告与总结等能力，达到「自己的 claw」可用效果。

**文档维护**：每完成一项须及时更新本文档——在对应条目前加删除线（`~~...~~`）、在行末或单独一行记录完成时间（如 `完成：YYYY-MM-DD`），不直接删除条目。

---

## 一、当前项目情况简述

- **MVP 已就绪**：本地模型（Ollama）+ 单会话聊天、网关 `POST /chat` 与流式、前端发消息与展示回复。
- **P0 主/子 agent 已实现**：DELEGATE 解析、子 agent 串行执行、综合阶段再调主 agent、前端主回复/子 agent 思考·结论/综合回复分块展示。
- **与 OpenClaw 差异**：派发方式为「主回复内 DELEGATE 文本」而非工具 `sessions_spawn`；子 agent 当前串行（OpenClaw 为并行 + 队列）；结果回传为「子结果拼段 + 再调主 agent」而非通告步骤。

---

## 二、待办（按优先级）

### P0：核心体验与修 bug

- [ ] 综合回复强制为「对子 agent 内容的总结」：避免综合阶段主 agent 再次输出 DELEGATE，加强 system/user 约束或 persona。
- [ ] 主回复区不展示 DELEGATE 行：有 subAgents 或 summary 时只展示 mainReplyClean；mainReplyClean 为空时展示「已派发子任务。」，不 fallback 到含 DELEGATE 的 content。
- [ ] 子 agent 流式观感：确保前端在接收 sub_thinking/sub_chunk 时对应子 agent 块可感知（如默认展开或流式期间展开）。

### P0：对标 OpenClaw 能力

- [ ] 子 agent 无依赖时并行：多个 DELEGATE 无依赖时用 `Promise.all` 等并行执行，有依赖时保留串行或后续做 DAG。
- [ ] （可选）DELEGATE 依赖表达：若需「C 依赖 A、B」则扩展格式或协议，网关支持依赖感知调度。

### P1：工具与多会话

- [ ] 跨对话记忆：为会话/用户维护记忆条目，请求前注入相关记忆，可选向量检索。
- [ ] 技能/工具：读文件、执行命令等 1～2 个简单工具，与主/子 agent 结合。
- [ ] 多会话 / 会话管理：按 session_id 隔离上下文与记忆，可选会话列表与切换。

### P2：体验与扩展

- [ ] 多端 / 多 channel：Telegram、微信等入口统一转内部消息，参考 OpenClaw channel 抽象。
- [ ] Compaction / 摘要：对话过长时对旧消息摘要或压缩。
- [ ] 多模型与 fallback：多模型配置与不可用时的 fallback。

### 开放问题（待讨论后拆成具体 todo）

- [ ] 子 agent 可否由主 agent 动态创建（临时定义子角色）。
- [ ] 聊天执行任务时能否随时插入新任务并与当前任务并发（任务队列、取消/优先级）。

---

## 三、已完成（保留记录，用删除线 + 完成时间）

（暂无；完成项将移动或标记于此，格式示例：`~~- [x] 某事项~~ 完成：YYYY-MM-DD`）

---

**最后更新**：2026-03-02
