import fs from 'fs';
import path from 'path';

function loadFromFile(envPath: string, out: Record<string, string>): void {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      out[key] = val;
    }
  }
}

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const cwd = process.cwd();
    loadFromFile(path.resolve(cwd, '.env'), out);
    loadFromFile(path.resolve(cwd, '..', '.env'), out);
  } catch {
  }
  return out;
}

const env = loadEnv();

function get(key: string, fallback: string): string {
  return process.env[key] ?? env[key] ?? fallback;
}

export const config = {
  port: parseInt(get('PORT', '3000'), 10),
  deepseekApiKey: get('DEEPSEEK_API_KEY', ''),
  deepseekBaseUrl: get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').replace(/\/$/, ''),
  defaultModel: get('DEEPSEEK_DEFAULT_MODEL', 'deepseek-chat'),
  allowedModels: ['deepseek-chat', 'deepseek-reasoner'],
};
