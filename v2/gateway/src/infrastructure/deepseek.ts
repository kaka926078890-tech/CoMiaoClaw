export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
}

export interface ChatCompletionResult {
  content: string;
  model: string;
}

export interface StreamDelta {
  reasoning_content?: string;
  content?: string;
}

export async function chatCompletion(opts: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  return { content, model: data.model ?? opts.model };
}

export async function* chatCompletionStream(
  opts: ChatCompletionOptions
): AsyncGenerator<StreamDelta, { model: string }, void> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: 4096,
      stream: true,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${errBody}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  const decoder = new TextDecoder();
  let buffer = '';
  let model = opts.model;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6);
      try {
        const data = JSON.parse(jsonStr) as {
          choices?: Array<{ delta?: { reasoning_content?: string; content?: string }; finish_reason?: string }>;
          model?: string;
        };
        if (data.model) model = data.model;
        const delta = data.choices?.[0]?.delta;
        if (!delta) continue;
        const out: StreamDelta = {};
        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) out.reasoning_content = delta.reasoning_content;
        if (typeof delta.content === 'string' && delta.content) out.content = delta.content;
        if (out.reasoning_content !== undefined || out.content !== undefined) yield out;
      } catch {
      }
    }
  }
  return { model };
}
