# 跨对话记忆：实现流程规划

本文档为「跨对话记忆 + 人设文件」的**按步实现指南**，对齐 OpenClaw：记忆用 Markdown 文件、人设用各类文件保存，网关读入后注入 system，每轮结束后写记忆。实现时按下面步骤顺序进行即可。

---

## 一、目标与约定（简要）

- **记忆**：部署目录下单个 `.md` 文件，每轮对话结束追加一段（可摘要）；调用模型前取「最近 N 段」注入 system。
- **人设**：部署目录下单个或多个文本/Markdown 文件，每次请求前读取并拼进 system。
- **注入**：`system = 人设 + 记忆`，再拼当前 `sessionMessages`；Ollama 接口不改，仅调用方多传一条 system。
- **Token 压缩**：写记忆用规则截断（摘要）；读记忆设条数 + 总字符上限；人设保持简短。

---

## 二、实现流程（按顺序执行）

### 步骤 1：配置与目录

1. 在 **gateway/src/config.ts** 中增加（支持环境变量）：
   - `memoryPath`：记忆 .md 路径，默认如 `gateway/data/memory.md`，可用 `MEMORY_PATH` 覆盖。
   - `personaPath`：人设文件或目录路径，默认如 `gateway/data/persona.md`，可用 `PERSONA_PATH` 覆盖。
   - `memoryInjectCount`：注入时最多取最近几条记忆，如 `10`。
   - `memoryInjectMaxChars`：注入的记忆部分总字符上限，如 `2000`。
   - `memoryEntryMaxChars`：写记忆时单条 User/Assistant 最大字符（规则截断），如 `80`。

2. 新建目录 **gateway/data/**（若不存在）。

3. 在 **.gitignore** 中增加：`gateway/data/memory.md`（真实记忆不提交）；可提交示例 `gateway/data/persona.md.example` 或空 `memory.md.example`。

**验收**：启动网关不报错；未配置时使用默认路径，配置后能读到环境变量。

---

### 步骤 2：记忆模块 gateway/src/memory.ts（新建）

1. **读记忆** `loadMemory(): string`：
   - 读取 `config.memoryPath` 指向的 .md 文件；若文件不存在返回空字符串。
   - 按段落拆分：以 `## ` 开头视为一段的起始，或按双换行 `\n\n` 拆段。
   - 取**最近** `memoryInjectCount` 段（文件末尾为最近），再按 `memoryInjectMaxChars` 从前往后截断（超出的段丢弃或截断尾部），拼成一段文本。
   - 返回拼好的字符串（可加前缀如「以下是与当前对话相关的过往记忆：\n\n」）。

2. **写记忆** `appendMemory(userContent: string, assistantContent: string): void`：
   - 对 `userContent`、`assistantContent` 做规则截断：各保留前 `memoryEntryMaxChars` 字，超出加「…」。
   - 生成一段 Markdown，例如：
     ```md
     ## 2025-02-28 12:00
     - **User:** （截断后的用户内容）
     - **Assistant:** （截断后的助手内容）
     ```
   - 以追加方式写入 `config.memoryPath`；若文件不存在则创建；使用 Node `fs.appendFileSync` 或等价 API。

3. 依赖 **config**，不依赖 Express 或 Ollama。

**验收**：单元或手测：写几段后读，能拿到最近 N 段且总长不超过上限；截断生效。

---

### 步骤 3：人设模块 gateway/src/persona.ts（新建）

1. **读人设** `loadPersona(): string`：
   - 读取 `config.personaPath`；若为文件则读该文件内容；若为目录则读目录下 `.md`/`.txt` 按文件名排序后拼接（首版可只支持单文件）。
   - 文件或目录不存在时返回空字符串。
   - 不做截断；建议部署方保持人设文件简短。

2. 依赖 **config**，不依赖 Express 或 Ollama。

**验收**：配置 persona 路径后，返回文件内容；未配置或文件不存在时返回空串。

---

### 步骤 4：在网关路由中接入（gateway/src/index.ts）

1. **调用模型前（读 + 注入）**  
   在 `POST /chat` 与 `POST /chat/stream` 中，在调用 `chatWithOllama` / `streamChatWithOllama` **之前**：
   - 调用 `loadPersona()` 得到 `personaText`。
   - 调用 `loadMemory()` 得到 `memoryText`。
   - 拼成一条 system：`systemContent = personaText + (personaText && memoryText ? "\n\n" : "") + (memoryText ? "以下是与当前对话相关的过往记忆：\n\n" + memoryText : "")`（无人设/无记忆时对应部分为空）。
   - 若 `systemContent` 非空，则构造发给 Ollama 的 messages：`messages = [{ role: "system", content: systemContent }, ...sessionMessages]`；否则仍用 `sessionMessages`。
   - 后续 `chatWithOllama(messages, ...)` / `streamChatWithOllama(messages, ...)` 使用该 `messages`。

2. **本轮对话结束后（写记忆）**  
   在 `POST /chat` 与 `POST /chat/stream` 中，在**本轮 assistant 回复已拿到并已 push 进 sessionMessages 之后**（且无错误）：
   - 取本轮的 user 消息与 assistant 回复文本（非流式从 `reply`，流式从 `fullReply`）。
   - 调用 `appendMemory(lastUserContent, lastAssistantContent)`。

3. 确保 **POST /chat** 与 **POST /chat/stream** 两处都做上述「读 + 注入」和「写记忆」；流式里写记忆在 `streamChatWithOllama` 完成并 push 完 sessionMessages 之后执行。

**验收**：发多轮对话后，`gateway/data/memory.md` 中有新增段落；新问题能结合人设与记忆回答（如人设写「你是小克」，记忆有「用户说叫小明」，问「我叫什么」能答小明）。

---

### 步骤 5：Token 压缩（首版用规则即可）

1. **写记忆**：已在步骤 2 中通过 `memoryEntryMaxChars` 做单条截断；无需额外实现。
2. **读记忆**：已在步骤 2 中通过 `memoryInjectCount` 与 `memoryInjectMaxChars` 做条数与总长上限；无需额外实现。
3. **人设**：不在代码中截断；在文档中说明部署方保持 persona 文件精简即可。
4. （可选）后续可增加：模型生成「本轮要点」再写入、旧记忆合并为「历史摘要」、当前会话 Compaction；见 roadmap P2。

**验收**：长对话多轮后，注入的 system 总长受控；模型不因上下文过长明显变慢或截断。

---

## 三、涉及文件清单

| 文件/目录 | 操作 |
|-----------|------|
| gateway/src/config.ts | 增加 memoryPath、personaPath、memoryInjectCount、memoryInjectMaxChars、memoryEntryMaxChars，支持环境变量 |
| gateway/src/memory.ts | 新建：loadMemory()、appendMemory(user, assistant) |
| gateway/src/persona.ts | 新建：loadPersona() |
| gateway/src/index.ts | 在 /chat 与 /chat/stream 中：调用模型前注入 system（人设+记忆）；本轮成功后写记忆 |
| gateway/data/ | 新建目录；可放 persona.md、memory.md（memory.md 建议 .gitignore） |
| .gitignore | 增加 gateway/data/memory.md（或 data/*.md 按需） |

---

## 四、验收标准

- 部署目录下存在 `memory.md`、`persona.md`（或配置的路径）；网关启动正常。
- 多轮对话后，`memory.md` 中按轮次追加了 Markdown 段落；单条内容被截断在约定字数内。
- 新的一轮中，模型回答能体现人设与过往记忆（例如记住用户说过的话）。
- 现有流式/非流式接口行为不变；前端无需改动。
- 注入的记忆部分条数、总字符数不超过配置上限。

---

## 五、与多会话的边界

- 首版为单会话：记忆单文件、人设单文件（或单目录）。
- 后续 P1 多会话时，可按 session_id 分文件（如 memory_{sessionId}.md），本实现中在 config 与 memory/persona 模块预留「单会话」即可。

完成以上步骤后，跨对话记忆与人设文件加载即按当前方案打通；若需扩展摘要生成或历史摘要合并，可在本流程基础上在 memory 层增加接口与配置即可。
