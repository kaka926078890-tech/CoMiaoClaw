/** 单条消息：与 MVP 约定一致 */
export type MessageRole = "user" | "assistant" | "system";

export interface SubAgentBlock {
  role: string;
  thinking: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** 助手消息的思考过程（如 deepseek-r1 think），可选 */
  thinking?: string;
  /** 子 agent 列表（researcher/coder 等的思考+结论），可选 */
  subAgents?: SubAgentBlock[];
  /** 主回复去 DELEGATE 后的纯叙述（有子任务时由网关下发，用于替代 content 展示） */
  mainReplyClean?: string;
  /** 主 agent 对子任务结果的综合回复（有子任务时由网关下发） */
  summary?: string;
  /** 本条回复触发的协议：已加载技能、已抓取 URL（由流式事件 skill_loaded / fetch_url_done 填充） */
  protocolUsed?: { skills?: string[]; urls?: string[] };
  createdAt: number;
}

/** POST /chat 请求（非流式） */
export interface ChatRequest {
  message: string;
  /** 可选：Ollama 模型名（如 qwen2.5-coder:7b），由前端环境变量或配置传入 */
  model?: string;
}

/** POST /chat 响应（非流式） */
export interface ChatResponse {
  reply: string;
}
