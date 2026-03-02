# 子 Agent 流程说明（当前实现）

## 1. 两个子 agent 是并行还是串行？主 agent 会总结吗？

### 子 agent：**串行**执行

当前实现里，多个 DELEGATE（如 researcher + coder）是**串行**执行的，不是并行：

- 在 `gateway/src/delegate.ts` 的 `runSubAgents` / `runSubAgentsStreaming` 中，按**依赖分层**：同一层内的多个子任务用 **`Promise.all`** 并行执行，不同层之间串行（有依赖的等前置层完成后再跑）。
- 解析仅识别标准格式 `DELEGATE:`；若主 agent 输出错误格式（如 `DELEG:`），应追究模型/人设/示例原因并修正，不做格式兜底。

若希望**无依赖时并行**以缩短总耗时，可后续改为对无依赖的子任务用 `Promise.all` 并发执行，有依赖的仍按 DAG 串行（参见 `docs/openclaw-delegate-questions.md`）。

### 主 agent：**会**对子 agent 内容做总结

子任务全部执行完后，主 agent **会**再被调一次，专门对子结果做综合：

1. 网关把「主回复（去掉 DELEGATE 行）」写入会话，再追加一条**用户消息**：`[子任务结果]\n\n` + 所有子 agent 的回复（用 `\n\n---\n\n` 分隔）。
2. 用当前会话（含人设 + 记忆）**再调一次主 agent**（`chatWithOllama(messagesForSummary)`），得到 **`finalReply`**。
3. 该 `finalReply` 即主 agent 基于子任务结果的**综合回复**，推给前端并写入记忆。

所以：**子 agent 串行执行 → 子结果拼成一段 → 主 agent 再调一次 → 产出总结**。

---

## 2. 子 agent 整体流程（OpenClaw / 本网关）

本项目中「主 agent + 子 agent」的流程与 `docs/p0-main-sub-agent-plan.md` 一致，可视为当前 OpenClaw 子 agent 流程的实现方式，如下。

### 端到端顺序

```
用户发消息
    ↓
网关：会话里追加 user 消息，buildMessagesWithSystem(persona + memory)，调主 agent（流式）
    ↓
主 agent 流式输出 fullReply（可能含多行 DELEGATE: 任务 | 角色）
    ↓
网关：流式结束 → parseDelegate(fullReply)
    ↓
若无 DELEGATE → 直接写会话、写记忆、返回/DONE
若有 DELEGATE ↓
    ↓
网关：发「[正在执行子任务…]」「[子任务结果]」等占位 chunk（可选）
    ↓
对每个 DELEGATE 项按层执行（**同层并行**、**跨层串行**）：
    子 agent = 同模型，system = getSubPersona(role)，messages = [system, user: task]
    非流式：chatWithOllama → 得到一段 subReply，拼入 subResult
    流式：streamChatWithOllama → 通过 onEvent 发 sub_thinking / sub_chunk / sub_done，同时累积 content 拼入 subResult
    ↓
网关：会话里追加 assistant（主回复去 DELEGATE 行）+ user（"[子任务结果]\n\n" + subResult）
    ↓
再调主 agent（非流式）→ 得到 finalReply（综合回复）
    ↓
网关：把「[综合回复]\n\n」+ finalReply 推给前端，写会话与记忆，发 [DONE]
```

### 涉及文件与职责

| 环节           | 文件 / 位置 | 职责 |
|----------------|-------------|------|
| 解析派发       | `gateway/src/delegate.ts` | `parseDelegate(reply)` 提取 `DELEGATE: 任务 \| 角色`；`stripDelegateFromReply` 清洗主回复 |
| 子角色 system  | `gateway/src/subpersona.ts` + `gateway/data/agents/<role>.md`（或 `subpersona/` 兼容） | `getSubAgentSystem(role)` 返回子 agent 的 system（角色 md + 可选 TOOLS.md） |
| 子 agent 执行  | `gateway/src/delegate.ts` | `runSubAgents`（非流式串行）、`runSubAgentsStreaming`（流式串行，带 sub_* 事件） |
| 会话与再调主   | `gateway/src/index.ts` | POST /chat、POST /chat/stream：拼 subResult、写会话、再调主 agent 得 finalReply |
| 主 agent 人设   | `gateway/data/AGENTS.md`（或 persona.md 兼容） | 约定 DELEGATE 格式、子角色由 bootstrap 动态注入，以及「收到 [子任务结果] 时只做综合、不再次 DELEGATE」 |

### 小结

- **子 agent**：**同层并行**、**跨层串行**（无依赖时多子任务并行）；主 agent **会**在子任务全部完成后，根据「[子任务结果]」再调一次并给出总结（综合回复）。
- **流程**：主 agent 输出 DELEGATE 行（标准格式）→ 网关解析 → 按层并行跑子 agent（同模型、不同 system）→ 子结果拼成一段写回会话 → 再调主 agent → 综合回复返回/推流。  
更细的「依赖 / 动态子角色」等开放问题见 `docs/openclaw-delegate-questions.md`。

---

## 3. OpenClaw 官方的任务拆分与并行、总结（参考）

[OpenClaw](https://docs.openclaw.ai) 是官方开源项目，子智能体与多智能体设计可作参考。

### 任务拆分与派发

- **工具**：`sessions_spawn`（见 [子智能体 - OpenClaw](https://docs.openclaw.ai/zh-CN/tools/subagents)）。
- **行为**：主智能体通过工具派发任务；子智能体在**独立会话**（`agent:<agentId>:subagent:<uuid>`）中运行，**不阻塞**主对话。
- **入口**：工具入口与执行链路涉及 `sessions-spawn-tool`、`subagent-registry`；派发后通过 gateway 的 `agent` 方法触发子任务，可为子会话覆盖模型和 thinking 配置。

### 并行与总结

- **并行**：`sessions_spawn` **非阻塞**，调用后立即返回 `{ status: "accepted", runId, childSessionKey }`；子智能体在专用进程内队列（通道名 `subagent`）中运行，并发数由 `agents.defaults.subagents.maxConcurrent` 控制（默认 8）。
- **总结 / 回传**：子智能体**完成后**通过**通告（announce）**步骤把结果回传到请求者聊天渠道；通告消息包含 Status、Result 摘要等，规范化为稳定模板。主对话侧收到的是「子任务完成 + 结果摘要」，而不是边跑边流式塞进主气泡。
- **限制**：子智能体不能再生子智能体（防止递归）；默认不获得会话类工具；可配置更便宜的模型给子智能体以控制成本。

### 与本项目的差异（简要）

| 维度     | OpenClaw 官方                         | 本项目（Claw 网关）                          |
|----------|----------------------------------------|-----------------------------------------------|
| 派发方式 | 工具 `sessions_spawn`，非阻塞         | 主回复中写 `DELEGATE: 任务 \| 角色`，网关解析 |
| 并行     | 子智能体并行（队列 + maxConcurrent）   | 当前为串行，可后续改为无依赖时并行           |
| 结果回传 | 通告步骤，完成后一条摘要回主渠道       | 子结果拼成一段 → 再调主 agent 得综合回复     |
| 展示     | 主渠道只看到「完成 + 摘要」            | 主回复（去 DELEGATE）+ 子 agent 思考/结论 + 综合回复 |

如需对接或借鉴 OpenClaw 的并行与通告机制，可查阅其 [子智能体文档](https://docs.openclaw.ai/zh-CN/tools/subagents) 与 [多智能体概念](https://docs.openclaw.ai/zh-CN/concepts/multi-agent)。
