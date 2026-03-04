const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string) || 'http://localhost:3000';

export interface ConfigResponse {
  models: string[];
  defaultModel: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
}

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
