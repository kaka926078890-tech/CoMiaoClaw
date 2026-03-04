# 定时任务设计：可扩展、不写死

## 问题

- 定时任务不应是「固定几种类型 + 写死逻辑」：无法表达「每小时去某地址抓取、分析、整理报表、打印、推送」等复杂流程。
- 生产环境通常用 **Redis**（或类似）做任务存储与调度，任务本身是动态的、可配置的，而不是代码里 switch 几种 type。

## 目标

1. **任务 = 描述，不写死类型**：任务由一条**自然语言指令**（或后续扩展为工作流 ID）描述，执行器**通用**地解释并执行。
2. **执行器 = 多轮 Agent + 现有协议**：与对话流程一致，Agent 可输出 FETCH_URL、WRITE_FILE、SKILL、BROWSER_NAVIGATE 等，执行器解析、执行、注入结果，再让 Agent 继续，直到不再输出协议。这样「抓取 → 分析 → 报表 → 推送」就是一条复杂指令，由 Agent 多轮调用协议完成。
3. **存储可演进**：当前用 JSON 文件 + 内存轮询是过渡方案；目标是与 **Redis**（或其它任务队列）对接，任务模型不变：`{ id, name, interval, instruction, enabled }` 等。

## 任务模型（通用）

- **instruction**（必填）：自然语言描述「到点要做什么」。可长可复杂，例如：「去 https://example.com/data 抓取数据，对数据进行分析，整理成报表写入 workspace/reports/日报.md，并打印摘要」。
- **intervalMinutes**、**enabled**、**name** 等：调度与展示用。
- 不再为「写时间文件」「发脑筋急转弯」等单独加 type 分支；这些都可归为「agent-run：执行一条指令」。保留的固定 type（如 memory-compact、heartbeat）仅为内置维护任务，与「用户定义的复杂任务」分开。

## 执行器

- **runInstructionHeadless(instruction)**：无头、多轮执行。
  1. 构建 system（与对话一致：loadBootstrap）。
  2. messages = [system, user: instruction]。
  3. 循环：调用 Ollama → 解析回复中的 SKILL / FETCH_URL / READ_FILE / WRITE_FILE / LIST_DIR / BROWSER_NAVIGATE → 若有则执行并注入结果，追加到 messages，继续下一轮；若无则结束。
- 复用现有协议解析与执行逻辑（fetch-url、local-file、skill、browser），不重复写死。

## 存储演进（任务不写死、可接 Redis）

- **当前**：`gateway/data/scheduled-tasks.json`，内存轮询，每分钟 tick。任务类型包含内置维护（memory-compact、heartbeat）与用户定义（time-file、agent-prompt、**agent-run**）。用户复杂任务统一用 **agent-run + instruction**，不再为每种业务写死 type。
- **后续**：迁到 **Redis**（或其它队列）：任务定义存 Redis，调度由 Redis 过期/队列或独立 worker 拉取，执行器仍为同一套 `runInstructionHeadless`（及现有 runTask 分支），仅「任务来源」从 JSON 改为 Redis，任务模型（含 instruction）可保持不变。

## 与对话创建任务

- 用户说：「每隔一小时去某地址抓取数据、分析、整理报表、推送」→ 模型输出协议创建一条 **agent-run** 任务，instruction 为上述描述。
- 到点后执行器按该 instruction 跑多轮 Agent，无需在代码里为「抓取」「报表」「推送」各写一种 type。
