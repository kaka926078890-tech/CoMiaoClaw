# V2 阶段待办

V2 按阶段推进，每阶段均可对接前端做联调与验证。完成项用删除线 + 完成时间标记，不删除。

---

## 阶段一：网关骨架 + 单轮对话

**目标**：网关可启动，DeepSeek 单轮对话（无 tools），前端能发消息并展示回复。

- [x] ~~网关工程：transport 层路由（POST /chat）、application 层单轮调用、infrastructure 层 DeepSeek 客户端；shared 类型与 config。~~ 完成：2025-03-04
- [x] ~~单轮对话：接收 message → 拼 system（人设、时间等，暂不拼记忆）→ 调 DeepSeek chat → 返回 reply。~~ 完成：2025-03-04
- [x] ~~前端对接：v2 前端聊天区请求网关 POST /chat，展示用户消息与助手回复；可切换模型（若网关提供 /config 或 /models）。~~ 完成：2025-03-04
- [x] ~~验证：`./dev.sh start all` 后前端发一条消息，能收到助手回复。~~ 完成：2025-03-04

---

## 阶段二：Tool 注册与 Chat Loop

**目标**：支持 tools 入参与 tool_calls 处理，实现 chat loop；至少 1～2 个 tool（如 fetch_url、call_sub_agent），前端可看到「工具调用过程」或结果。

- [ ] 工具注册表：domain 层定义 tools 数组（name、description、parameters、execute）；至少 fetch_url、call_sub_agent。
- [ ] Chat loop：应用层若响应含 tool_calls 则执行 → 拼 tool 结果 → 再请求，直到无 tool_calls 或达轮数上限。
- [ ] fetch_url：执行器在 infrastructure 层，抓取 URL 返回文本。
- [ ] call_sub_agent：读 agents/<role>.md 作 system，调 DeepSeek 完成子任务，返回结果。
- [ ] 前端对接：展示思考（若有）、子 agent 块、技能/工具调用状态（可折叠）；与 [figma-frontend-ui-brief.md](figma-frontend-ui-brief.md) 中 2.8、2.9 一致。
- [ ] 验证：发「让 researcher 查一下 XXX」或「抓取 https://example.com」能走 tool 并返回结果，前端有对应展示。

---

## 阶段三：记忆与向量检索

**目标**：记忆写入时做 embedding 入向量库；提供 search_memory tool；前端历史仅展示正文，可选「检索记忆」入口。

- [ ] 向量存储：infrastructure 层选型（本地向量库或托管），写入接口；对话结束后写入记忆并 embedding。
- [ ] search_memory tool：参数 query、可选 limit；执行检索，返回格式化的相关片段。
- [ ] 历史接口：加载会话时仅返回正文（不包含思考、子 agent、技能过程）；记忆文件存完整正文。
- [ ] 前端对接：历史记录加载后只展示正文；可选入口触发「检索记忆」或展示记忆片段。
- [ ] 验证：多轮对话后能检索到相关记忆；加载历史会话只显示正文。

---

## 阶段四：技能 / 定时任务 / 工作区 / 日志全量

**目标**：run_skill、create_scheduled_task、工作区文件读写、控制台日志等与前端全量对接。

- [ ] run_skill：文档型返回 SKILL 内容或走内置逻辑；脚本型子进程执行（固定 cwd、超时）。
- [ ] create_scheduled_task tool：参数 name、interval_minutes、instruction 等；与定时任务 CRUD 接口一致。
- [ ] 工作区：GET/PUT/POST /workspace/files、/workspace/file；前端工作区面板列表、编辑、Markdown 预览。
- [ ] 定时任务：GET/POST/PUT/DELETE /scheduled-tasks；前端定时任务面板列表、新建、编辑、启用/禁用。
- [ ] 控制台日志：请求/错误等写入日志；前端控制台面板可拉取或流式展示。
- [ ] 验证：前端工作区、定时任务、控制台与网关接口联调通过；技能调用在对话中有展示。

---

## 待优化 / 已知问题

- [ ] **前端 Markdown 渲染**：当前渲染仍存在问题（如代码块样式、部分 token 对比度、气泡与正文排版等），后续需统一优化至稳定可用。

---

## 参考

- 设计权威：[claw-v2-design.md](claw-v2-design.md)
- 前端 UI 与模块：[figma-frontend-ui-brief.md](figma-frontend-ui-brief.md)
