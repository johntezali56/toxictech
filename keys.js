// ToxicTech MD v2.5 — API Keys & Model Configuration

// Core ToxicTech / External Media & Canvas APIs
export const TOXIC_API_URL = process.env.TOXIC_API_URL || 'https://davidcyriltech.my.id';
export const TOXIC_API_KEY = process.env.TOXIC_API_KEY || 'toxictech';
export const TOXIC_API_FALLBACK = 'https://waifu.pics';

// GitHub Token (used by .update and repo commands)
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Groq API Keys (supports comma-separated rotation in env or array entries)
export const GROQ_KEYS = process.env.GROQ_KEYS
    ? process.env.GROQ_KEYS.split(',').map(k => k.trim()).filter(Boolean)
    : [
        // 'gsk_your_groq_key_1',
        // 'gsk_your_groq_key_2',
    ];

// Active Groq / Llama Models
export const GROQ_MODELS = {
    fast: 'openai/gpt-oss-20b',
    tools: 'openai/gpt-oss-120b',
    vision: 'meta-llama/llama-4-scout-17b-16e-instruct',
};

// Optional Secondary AI & Live Search Keys
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
export const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

export default {
    TOXIC_API_URL,
    TOXIC_API_KEY,
    TOXIC_API_FALLBACK,
    GITHUB_TOKEN,
    GROQ_KEYS,
    GROQ_MODELS,
    GEMINI_API_KEY,
    OPENAI_API_KEY,
    SERPER_API_KEY,
    TAVILY_API_KEY,
};
