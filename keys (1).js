// keys.js - Multi-Provider API Key Pool & Rotation for ToxicAI

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'ghp_YOUR_GITHUB_TOKEN_HERE';

// Add multiple Groq keys for automatic rotation on rate limits (429)
export const GROQ_KEYS = [
    process.env.GROQ_API_KEY || 'gsk_YOUR_GROQ_KEY_1',
    process.env.GROQ_KEY_2 || '',
    process.env.GROQ_KEY_3 || ''
].filter(Boolean);

export const GROQ_API_KEY = GROQ_KEYS[0] || '';

// Optional: Add Gemini (free & super fast + native vision/PDFs) or OpenAI keys as instant fallbacks
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Faster & reliable active models on Groq
export const FAST_MODEL = 'llama-3.1-8b-instant'; // Note: Check active fast model or use openai/gpt-oss-20b
export const ACTIVE_FAST_MODEL = 'openai/gpt-oss-20b';
export const SMART_TOOL_MODEL = 'openai/gpt-oss-120b';
export const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

let currentGroqIdx = 0;
const failedKeys = new Map(); // key -> timestamp when marked failed
const COOLDOWN_RESET_MS = 60 * 1000;

export function getNextGroqKey() {
    if (!GROQ_KEYS.length) return '';
    const now = Date.now();
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        const idx = (currentGroqIdx + i) % GROQ_KEYS.length;
        const key = GROQ_KEYS[idx];
        const failTime = failedKeys.get(key) || 0;
        if (now - failTime > COOLDOWN_RESET_MS) {
            failedKeys.delete(key);
            currentGroqIdx = (idx + 1) % GROQ_KEYS.length;
            return key;
        }
    }
    return GROQ_KEYS[0];
}

export function markKeyFailed(key) {
    if (key) failedKeys.set(key, Date.now());
}
