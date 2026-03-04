import { chatCompletion, chatCompletionStream } from '../infrastructure/deepseek.js';
import type { StreamDelta } from '../infrastructure/deepseek.js';
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

export async function* singleTurnChatStream(input: SingleTurnInput): AsyncGenerator<StreamDelta, SingleTurnOutput, void> {
  const model = input.model && config.allowedModels.includes(input.model)
    ? input.model
    : config.defaultModel;
  const systemContent = buildSystemPrompt();
  const stream = chatCompletionStream({
    apiKey: config.deepseekApiKey,
    baseUrl: config.deepseekBaseUrl,
    model,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: input.message },
    ],
  });
  let reply = '';
  let resultModel = model;
  while (true) {
    const { value, done } = await stream.next();
    if (done && value && typeof value === 'object' && 'model' in value) {
      resultModel = (value as { model: string }).model;
      break;
    }
    if (done) break;
    if (value?.content) reply += value.content;
    if (value) yield value;
  }
  return { reply, model: resultModel };
}
