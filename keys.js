// keys.js — Safe template for GitHub (add your real keys on KataBump or via ENV)

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

// Add multiple Groq keys on KataBump for automatic rotation on rate limits (429)
export const GROQ_KEYS = [
  process.env.GROQ_API_KEY || process.env.GROQ_KEY_1 || '',
  process.env.GROQ_KEY_2 || '',
  process.env.GROQ_KEY_3 || ''
].filter(Boolean);

export const GROQ_API_KEY = GROQ_KEYS[0] || '';

// Optional AI fallbacks
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Web search APIs (used by ToxicAI for live Google/web lookups)
export const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
export const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

// Fixes SFW/anime plugin load errors (blush.js, hug.js, neko.js, etc.)
export const TOXIC_API_FALLBACK = process.env.TOXIC_API_FALLBACK || 'https://waifu.pics';

// Active Groq models
export const FAST_MODEL = 'openai/gpt-oss-20b';
export const ACTIVE_FAST_MODEL = 'openai/gpt-oss-20b';
export const SMART_TOOL_MODEL = 'openai/gpt-oss-120b';
export const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

let currentGroqIdx = 0;
const failedKeys = new Map();
const COOLDOWN_RESET_MS = 60 * 1000;

export function getNextGroqKey() {
  if (!GROQ_KEYS.length) return '';
  const now = Date.now();
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const idx = (currentGroqIdx + i) % GROQ_KEYS.length;
    const key = GROQ_KEYS[idx];
    const failedAt = failedKeys.get(key);
    if (!failedAt || now - failedAt > COOLDOWN_RESET_MS) {
      failedKeys.delete(key);
      currentGroqIdx = (idx + 1) % GROQ_KEYS.length;
      return key;
    }
  }
  return GROQ_KEYS[0] || '';
}

export function markKeyFailed(key) {
  if (key) failedKeys.set(key, Date.now());
}
