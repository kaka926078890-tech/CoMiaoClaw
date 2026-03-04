import type { OllamaMessage } from "./ollama.js";

export interface Session {
  id: string;
  messages: OllamaMessage[];
  title: string;
  updatedAt: number;
}

const sessions = new Map<string, Session>();

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createSession(): Session {
  const id = uuid();
  const session: Session = {
    id,
    messages: [],
    title: "新对话",
    updatedAt: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function getOrCreateSession(id: string | undefined): Session {
  if (id) {
    const existing = sessions.get(id);
    if (existing) return existing;
  }
  return createSession();
}

export function listSessions(): { id: string; title: string; updatedAt: number }[] {
  return Array.from(sessions.values())
    .map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function updateSessionTitle(id: string, firstUserMessage: string): void {
  const s = sessions.get(id);
  if (!s) return;
  const title = firstUserMessage.trim().slice(0, 50) || "新对话";
  s.title = title;
  s.updatedAt = Date.now();
}

export function clearSession(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  s.messages.length = 0;
  s.title = "新对话";
  s.updatedAt = Date.now();
  return true;
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}
