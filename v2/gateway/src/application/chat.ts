import { chatCompletion } from '../infrastructure/deepseek.js';
import { config } from '../shared/config.js';

const DEFAULT_PERSONA = `You are Claw, a helpful AI assistant. Reply concisely and clearly.`;

function buildSystemPrompt(): string {
  const now = new Date();
  const timeStr = now.toISOString();
  return `${DEFAULT_PERSONA}\n\nCurrent time (ISO): ${timeStr}`;
}

export interface SingleTurnInput {
  message: string;
  model?: string;
}

export interface SingleTurnOutput {
  reply: string;
  model: string;
}

export async function singleTurnChat(input: SingleTurnInput): Promise<SingleTurnOutput> {
  const model = input.model && config.allowedModels.includes(input.model)
    ? input.model
    : config.defaultModel;
  const systemContent = buildSystemPrompt();
  const result = await chatCompletion({
    apiKey: config.deepseekApiKey,
    baseUrl: config.deepseekBaseUrl,
    model,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: input.message },
    ],
  });
  return { reply: result.content, model: result.model };
}
