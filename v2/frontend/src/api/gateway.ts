const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string) || 'http://localhost:3000';

export interface ConfigResponse {
  models: string[];
  defaultModel: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
}

export type StreamChunk =
  | { type: 'thinking'; text: string }
  | { type: 'content'; text: string }
  | { type: 'done'; reply: string; model: string }
  | { type: 'error'; error: string };

export async function getConfig(): Promise<ConfigResponse> {
  const res = await fetch(`${GATEWAY_URL}/config`);
  if (!res.ok) throw new Error(`Config failed: ${res.status}`);
  return res.json();
}

export async function postChat(message: string, model?: string): Promise<ChatResponse> {
  const res = await fetch(`${GATEWAY_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || 'Chat request failed');
  }
  return res.json();
}

export async function postChatStream(
  message: string,
  model: string | undefined,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, model, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || 'Chat request failed');
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6);
      if (jsonStr === '[DONE]') continue;
      try {
        const data = JSON.parse(jsonStr) as StreamChunk;
        onChunk(data);
      } catch {
      }
    }
  }
  if (buffer.trim()) {
    const line = buffer.trim();
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6)) as StreamChunk;
        onChunk(data);
      } catch {
      }
    }
  }
}
