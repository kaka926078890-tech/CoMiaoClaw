export interface ChatRequest {
  message: string;
  model?: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
}

export interface ConfigResponse {
  models: string[];
  defaultModel: string;
}
