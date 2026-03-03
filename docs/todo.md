# 项目 Todo（长线对标 OpenClaw）

**长线目标**：对标 [OpenClaw](https://docs.openclaw.ai) 产品，实现主/子智能体协同、任务拆分与派发、并行执行、结果通告与总结等能力，达到「自己的 claw」可用效果。

**文档维护**：每完成一项须及时更新本文档——在对应条目前加删除线（`~~...~~`）、在行末或单独一行记录完成时间（如 `完成：YYYY-MM-DD`），不直接删除条目。

---

## 一、当前项目情况简述

- **已脱离最小 MVP**：以完整主/子 agent 能力为目标，支持 DELEGATE 依赖表达与 DAG 分层调度（层内并行、层间串行）。
- **P0 主/子 agent 已实现**：DELEGATE 解析、子 agent 执行、综合阶段再调主 agent、前端主回复/子 agent 思考·结论/综合回复分块展示。
- **本阶段**：扩展 DELEGATE 格式（可选依赖）、按依赖建 DAG、分层执行（无依赖并行，有依赖则下游在上游完成后执行并注入结果）。

---

## 二、待办（按优先级）

### P0：核心体验与修 bug

- ~~- [ ] 综合回复强制为「对子 agent 内容的总结」：避免综合阶段主 agent 再次输出 DELEGATE，加强 system/user 约束或 persona。~~ 完成：2026-03-02
- ~~- [ ] 主回复区不展示 DELEGATE 行：有 subAgents 或 summary 时只展示 mainReplyClean；mainReplyClean 为空时展示「已派发子任务。」，不 fallback 到含 DELEGATE 的 content。~~ 完成：2026-03-02
- ~~- [ ] 子 agent 流式观感：确保前端在接收 sub_thinking/sub_chunk 时对应子 agent 块可感知（如默认展开或流式期间展开）。~~ 完成：2026-03-02

### P0：DELEGATE 扩展格式与依赖调度

- ~~- [ ] **扩展格式**：`DELEGATE: 任务 | 角色` 可带可选第三段依赖，如 `| 0,1` 表示依赖第 0、1 条（按出现顺序）；`parseDelegate` 返回带 `deps?: number[]` 的列表。~~ 完成：2026-03-02
- ~~- [ ] **DAG 分层执行**：根据 `deps` 建图，按层执行——层内并行（`Promise.all`）、层间串行；下游任务执行前注入上游结果到其输入。~~ 完成：2026-03-02
- ~~- [ ] **兼容**：无第三段或 `deps` 为空视为无依赖，全部进入第 0 层并行；若存在环则降级为串行。~~ 完成：2026-03-02

~~**实现步骤**：① 扩展 `parseDelegate` 与 `DelegateItem`；② `delegate.ts` 内实现 DAG 分层（拓扑/层划分）；③ `runSubAgents` / `runSubAgentsStreaming` 按层并行、层间串行并注入上游结果；④ 更新 persona 说明（可选依赖语法）；⑤ 联调验证（无依赖并行、A/B 并行且 C 依赖 A 和 B）。~~ 完成：2026-03-02

### OpenClaw 对齐（2026-03-02）

- ~~- [ ] 阶段一：工作区与文件名对齐（workspace、AGENTS.md、MEMORY.md、agents/、bootstrap 注入顺序）~~ 完成：2026-03-02
- ~~- [ ] 阶段二：派发流程与主/子 agent 设定（AGENTS.md 原则驱动、动态子角色列表注入、子 agent system + TOOLS.md）~~ 完成：2026-03-02
- ~~- [ ] 阶段三：Skill 机制（workspace/skills、SKILL.md 格式、技能列表注入；read 工具为方案 A 文档约定）~~ 完成：2026-03-02
- ~~- [ ] Skill 能力接入与使用流程：SKILL: / FETCH_URL: 协议、frontmatter 解析、注入再调一轮、测试 skill web-fetch/url-scraper~~ 完成：2026-03-02

### P1：工具与多会话

- [ ] 跨对话记忆：为会话/用户维护记忆条目，请求前注入相关记忆，可选向量检索。
- [ ] 技能/工具：~~workspace/skills + SKILL.md + frontmatter + 列表注入已实现；SKILL:/FETCH_URL: 协议已实现（加载全文、联网抓取、注入再调一轮）。~~ read 工具（按需加载 SKILL.md）待 Ollama function call 或方案 B。
- ~~- [ ] 多会话 / 会话管理：按 session_id 隔离上下文与记忆，可选会话列表与切换。~~ 完成：2026-03-03

### P1：控制台

- ~~- [ ] 控制台页面添加工作区文件的编辑与查看：如 AGENTS.md、SOUL.md、MEMORY.md、TOOLS.md、agents/*.md、skills 等，支持在控制台内查看与编辑并落盘到 workspace。~~ 完成：2026-03-03
- ~~- [ ] 控制台添加定时任务模块：支持配置与展示定时任务（如记忆整理、心跳等），与网关或 OpenClaw 风格对齐。~~ 完成：2026-03-03

### P2：体验与扩展

- [ ] **定时任务改用 Redis**：任务定义与调度迁到 Redis（替代当前 JSON 文件 + 内存轮询）；到点触发或 worker 拉取任务，执行器（runInstructionHeadless、runTask 等）不变；便于多实例、持久化与扩展。
- [ ] 多端 / 多 channel：Telegram、微信等入口统一转内部消息，参考 OpenClaw channel 抽象。
- [ ] Compaction / 摘要：对话过长时对旧消息摘要或压缩。
- [ ] 多模型与 fallback：多模型配置与不可用时的 fallback。

### 开放问题（待讨论后拆成具体 todo）

- [ ] 子 agent 可否由主 agent 动态创建（临时定义子角色）。
- [ ] 聊天执行任务时能否随时插入新任务并与当前任务并发（任务队列、取消/优先级）。

---

## 三、已完成（保留记录，用删除线 + 完成时间）

- ~~综合回复强制为「对子 agent 内容的总结」~~ 完成：2026-03-02
- ~~主回复区不展示 DELEGATE 行~~ 完成：2026-03-02
- ~~子 agent 流式观感~~ 完成：2026-03-02
- ~~DELEGATE 扩展格式（可选 | 0,1 依赖）~~ 完成：2026-03-02
- ~~DAG 分层执行（层内并行、层间串行、下游注入上游结果）~~ 完成：2026-03-02
- ~~环检测降级串行、persona 说明更新~~ 完成：2026-03-02
- ~~OpenClaw 对齐：工作区与文件名、bootstrap、派发流程与动态子角色、Skill 列表注入~~ 完成：2026-03-02
- ~~Skill 能力接入与使用流程：SKILL:/FETCH_URL: 协议、frontmatter、注入再调一轮、测试 skill web-fetch/url-scraper~~ 完成：2026-03-02
- ~~控制台工作区文件查看/编辑/新增（AGENTS、agents、skills 等）、控制台日志系统（请求与错误记录）~~ 完成：2026-03-03

---

**最后更新**：2026-03-03（定时任务模块、多会话与历史加载、侧栏默认展开已完成）
