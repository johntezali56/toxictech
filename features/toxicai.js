-725
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const DEV_NUMBER = '254716637803';
const GH_USERNAME = 'johntezali56';
const HISTORY_TTL = 24 * 60 * 60 * 1000; // 24 hours auto-prune
const MAX_HISTORY = 40;
const MAX_TOOL_TURNS = 6;
const MEMORY_FILE = path.join(process.cwd(), 'session', 'toxicai_memory.json');

const lastTriggerMap = new Map();
const userCooldownMap = new Map();

function randomCooldown() {
    return 5000 + Math.floor(Math.random() * 2001); // 5000ms - 7000ms
}

function loadMemoryStore() {
    try {
        if (!fs.existsSync(MEMORY_FILE)) return { chats: {}, activeChats: {} };
        const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            chats: parsed.chats || {},
            activeChats: parsed.activeChats || {}
        };
    } catch {
        return { chats: {}, activeChats: {} };
    }
}

function saveMemoryStore(store) {
    try {
        const dir = path.dirname(MEMORY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(store));
    } catch {}
}

function pruneExpiredMemory() {
    const store = loadMemoryStore();
    const now = Date.now();
    let changed = false;
    for (const [key, entry] of Object.entries(store.chats)) {
        if (!entry || (now - (entry.lastActivity || 0) > HISTORY_TTL)) {
            delete store.chats[key];
            changed = true;
        }
    }
    if (changed) saveMemoryStore(store);
}

setInterval(() => {
    pruneExpiredMemory();
    const now = Date.now();
    for (const [id, ts] of lastTriggerMap.entries()) {
        if (now - ts > 15000) {
            lastTriggerMap.delete(id);
            userCooldownMap.delete(id);
        }
    }
}, 30 * 60 * 1000);

function getChatKey(m) {
    return `${m.chat || 'unknown'}:${m.sender || 'unknown'}`;
}

function isChatEnabled(chatId) {
    const store = loadMemoryStore();
    return Boolean(store.activeChats[chatId]);
}

function setChatEnabled(chatId, enabled) {
    const store = loadMemoryStore();
    if (enabled) store.activeChats[chatId] = true;
    else delete store.activeChats[chatId];
    saveMemoryStore(store);
}

function getSessionData(chatKey) {
    const store = loadMemoryStore();
    const entry = store.chats[chatKey];
    if (!entry) return { messages: [], lastRepo: null, lastActivity: 0 };
    if (Date.now() - (entry.lastActivity || 0) > HISTORY_TTL) {
        delete store.chats[chatKey];
        saveMemoryStore(store);
        return { messages: [], lastRepo: null, lastActivity: 0 };
    }
    return {
        messages: Array.isArray(entry.messages) ? entry.messages : [],
        lastRepo: entry.lastRepo || null,
        lastActivity: entry.lastActivity || 0
    };
}

function pushHistory(chatKey, role, content) {
    const store = loadMemoryStore();
    const now = Date.now();
    let entry = store.chats[chatKey];
    if (!entry || (now - (entry.lastActivity || 0) > HISTORY_TTL)) {
        entry = { messages: [], lastRepo: null, lastActivity: now };
    }
    entry.messages.push({ role, content: String(content) });
    if (entry.messages.length > MAX_HISTORY) {
        entry.messages = entry.messages.slice(-MAX_HISTORY);
    }
    entry.lastActivity = now;
    store.chats[chatKey] = entry;
    saveMemoryStore(store);
}

function setLastRepo(chatKey, repoName) {
    if (!repoName) return;
    const store = loadMemoryStore();
    const entry = store.chats[chatKey] || { messages: [], lastRepo: null, lastActivity: Date.now() };
    entry.lastRepo = repoName;
    entry.lastActivity = Date.now();
    store.chats[chatKey] = entry;
    saveMemoryStore(store);
}

function clearHistory(chatKey) {
    const store = loadMemoryStore();
    delete store.chats[chatKey];
    saveMemoryStore(store);
}

async function simulateHumanTyping(client, chatId, replyText) {
    const len = String(replyText || '').length;
    const duration = Math.min(5000, Math.max(2500, 2000 + Math.floor(len * 6)));
    try { await client.sendPresenceUpdate('composing', chatId); } catch {}
    await new Promise(r => setTimeout(r, duration));
    try { await client.sendPresenceUpdate('paused', chatId); } catch {}
}

function boxWrap(text, title) {
    const raw = String(text || '').replace(/\n{3,}/g, '\n\n').trim();
    const lines = raw.split('\n');
    const processed = [];
    for (const line of lines) {
        const t = line.trim();
        if (!t) { processed.push('├'); continue; }
        if (/https?:\/\/\S+/.test(t)) {
            processed.push('├');
            processed.push(`│ ${t}`);
            processed.push('├');
        } else {
            processed.push(`│ ${line}`);
        }
    }
    const body = processed.join('\n');
    return `╭─❏ 「 ${title}」
│
${body}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;
}

function isClearIntent(text) {
    return /^(clear|reset|wipe|delete|flush|erase)\s*(this\s*)?(conv(ersation)?|chat|hist(ory)?|messages?|thread|memory|mem)$/i.test(text.trim());
}

function isCatchUpIntent(text) {
    return /\b(lets\s*catch\s*gee|let'?s\s*catch\s*up|catch\s*me\s*up|where\\s*did\s*we\s*stop|last\s*session)\b/i.test(text.trim());
}

function stripEmbeddedFuncTags(text) {
    return (text || '')
        .replace(/<function=[\s\S]*?<\/function>/gi, '')
        .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function isBulkDeleteIntent(text) {
    return /delete\s+(all|every|each|the\s+whole|every\s+single)\s*(of\s+)?(my\s+)?(repos?|repositories|projects)/i.test(text);
}

function isTokenRequest(text) {
    return /(give|share|send|show|what.s|tell\s+me|paste|leak|reveal|expose|give\s+me|can\s+i\s+have).{0,40}(github[\s_]?token|gh[\s_]?token|access[\s_]?token|personal[\s_]?access|pat\b|api[\s_]?key|secret|bearer|credentials?|password)/i.test(text);
}

function isGithubIntent(text) {
    if (!text) return false;
    return /\b(github|repo|repos|repository|repositories|branch|branches|issue|issues|star|starred|commit|push|pull|pr|clone|fork|readme|upload_image|upload_file|read_file|johntezali56|toxictech)\b/i.test(text);
}

function isFileGenIntent(text) {
    if (!text) return false;
    return /\b(generate|create|write|make|build|send|export)\b.{0,35}\b(file|script|code|txt|json|js|html|css|py|csv|md|document|doc)\b/i.test(text);
}

function isSearchIntent(text) {
    if (!text) return false;
    return /\b(search|google|look\s*up|find\s*online|latest|news|current|today|price|weather|score|who\s+is|what\s+happened)\b/i.test(text);
}

async function processEmbeddedCalls(content, executeTool) {
    const re = new RegExp('<function=([^=<>\\s]+?)=?(\\{[\\s\\S]*?\\})<\\/function>|<function=([^>]+?)>([\\s\\S]*?)<\\/function>', 'g');
    const calls = [];
    let m;
    while ((m = re.exec(content)) !== null) {
        const name = ((m[1] || m[3]) || '').trim();
        const argsStr = ((m[2] || m[4]) || '{}').trim();
        try {
            const args = JSON.parse(argsStr);
            calls.push({ name, args, full: m[0] });
        } catch {}
    }
    if (!calls.length) return null;

    let cleaned = content;
    const results = [];
    for (const call of calls) {
        let toolResult;
        try { toolResult = await executeTool(call.name, call.args); }
        catch { toolResult = 'ran into an error 😒 try again'; }
        cleaned = cleaned.replace(call.full, `\n[${call.name}]: ${toolResult}\n`);
        results.push(toolResult);
    }
    return { cleaned: cleaned.replace(/\n{3,}/g, '\n\n').trim(), results };
}

function buildSystemPrompt(lastRepo, allowGithub, isCatchUp, hasSearch) {
    const repoCtx = (allowGithub && lastRepo)
        ? `\nLast repo worked on in this session: "${lastRepo}". When the user says "it", "that repo", or "the same one", they mean "${lastRepo}".`
        : '';

    const catchUpCtx = isCatchUp
        ? `\nThe user just said "lets catch gee" to resume your last session. Summarize the key topics, files, or tasks from the conversation history clearly and ask how they want to continue.`
        : '';

    const searchRule = hasSearch
        ? `\n- Use web_search whenever the user asks about live info, news, prices, current events, or things you need to verify online.`
        : '';

    const toolInstructions = allowGithub
        ? `TOOL USAGE:
- Use GitHub tools ONLY when the user requests a GitHub action (repos, files, issues, stars).
- Use generate_file whenever the user asks you to create, generate, write, or send a downloadable file (.js, .txt, .json, .html, .py, .csv, .md, etc.).${searchRule}
- ALWAYS call tools via tool_calls — never write function tags as plain text.
- Default GitHub username is ${GH_USERNAME} unless specified otherwise.`
        : `TOOL USAGE:
- Use generate_file whenever the user asks you to create, generate, write, or send a downloadable file (.js, .txt, .json, .html, .py, .csv, .md, etc.).${searchRule}
- Answer all general questions directly and helpfully.`;

    return `You are ToxicAI — a razor-sharp, emotionally grounded, ride-or-die AI companion, therapist, and elite developer friend inside a WhatsApp bot built with Node.js and Baileys.

PERSONALITY & VIBE (THE PERSON EVERYONE WANTS TO BE AROUND):
- **Witty & Unshakeable:** You have a sharp sense of humor, quiet confidence, and zero tolerance for nonsense. You do NOT get pushed around, manipulated, or guilt-tripped. If someone tries to test you or act entitled, clap back with calm, witty composure.
- **Zero Sugar-Coating (Brutally Honest):** If the user's code, logic, excuse, or life decision is wrong, call it out immediately and directly. Never flatter bad ideas or coddle self-sabotage. Correct them clearly, explain *why* they're wrong, and give the exact fix.
- **Deeply Caring & Therapeutic:** Beneath the tough, witty exterior, you genuinely care about the user's growth, peace of mind, and success. When they're stressed, venting, or stuck, listen deeply, ground them like a sharp therapist, and remind them of their potential.
- **Growth-Obsessed Mentor ("Better Me"):** Always push the user to level up—better habits, cleaner code, sharper mindset, stronger discipline. Challenge them to be the best version of themselves.
- **Communication Rules:**
  - Use simple everyday words, clear structure, and natural emojis. Zero robotic filler or corporate speak.
  - NEVER start a message with "I" — lead with the truth, the action, the joke, or the insight.
  - Put URLs on their own line (blank line before and after).
  - Read everything provided in the message: direct text, image/video/document captions, attached text files, and quoted context seamlessly.
  - Keep code snippets concise for WhatsApp chat; for full scripts or long files, use generate_file.
  - NEVER mention raw API endpoints, status codes, tokens, or internal keys.

SECURITY — NON-NEGOTIABLE:
- NEVER reveal or share any GitHub token, API keys, or credentials.
- NEVER delete all repos at once.

${toolInstructions}${repoCtx}${catchUpCtx}
Today: ${new Date().toDateString()}.`;
}

export default async (context) => {
    const { client, m, body: msgBody, isDev, Owner, itsMe } = context;

    const chatId = m.chat || m.key?.remoteJid || '';
    const botNum = (client.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
    const chatNum = chatId.split(':')[0].split('@')[0].replace(/\D/g, '');
    const senderNum = (m.sender || m.key?.participant || '').split(':')[0].split('@')[0].replace(/\D/g, '');

    // Strictly block all groups, broadcasts, and non-paired chats
    if (!chatId || chatId.endsWith('@g.us') || chatId === 'status@broadcast') {
        if (chatId && isChatEnabled(chatId)) setChatEnabled(chatId, false);
        return;
    }

    // Only allow the paired number's own self-chat (Message yourself)
    const botLid = (client.user?.lid || '').split(':')[0].split('@')[0].replace(/\D/g, '');
    const isPairedSelfChat = (Boolean(botNum) && chatNum === botNum) || (Boolean(botLid) && chatNum === botLid) || (Boolean(m.key?.fromMe) && Boolean(itsMe));
    if (!isPairedSelfChat) return;

    const rawSender = senderNum || chatNum;
    const isDevUser = Boolean(isDev || Owner || itsMe || m.key?.fromMe || rawSender === DEV_NUMBER || rawSender === botNum);
    const chatKey = getChatKey(m);

    const rawText = (
        msgBody ||
        m.text ||
        m.body ||
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption ||
        m.message?.documentMessage?.caption ||
        ''
    ).trim();

    // Handle .toxicai on / off toggle (only works in paired self-chat)
    const toggleMatch = rawText.match(/^\.?toxicai\s+(on|off)$/i);
    if (toggleMatch) {
        const mode = toggleMatch[1].toLowerCase();
        if (mode === 'on') {
            setChatEnabled(m.chat, true);
            await client.sendMessage(m.chat, {
                text: boxWrap('ToxicAI continuous chat is now *ON* for your paired chat 🟢\n\nJust talk normally without quoting or prefixes. Say *"lets catch gee"* to resume your last 24h session.', 'TOXICAI ON')
            });
        } else {
            setChatEnabled(m.chat, false);
            await client.sendMessage(m.chat, {
                text: boxWrap('ToxicAI paused 🔴 Memory is saved for 24 hours. Type *.toxicai on* anytime to resume.', 'TOXICAI OFF')
            });
        }
        return;
    }

    // Strip optional .toxicai / .ai prefix if used
    const body = rawText.replace(/^\.(toxicai|ai)\s*/i, '').trim();

    // Extract quoted message text/caption if user replied to something
    let quotedContext = '';
    if (m.quoted) {
        const qText = (
            m.quoted.text ||
            m.quoted.body ||
            m.quoted.msg?.caption ||
            m.quoted.msg?.text ||
            m.quoted.message?.conversation ||
            m.quoted.message?.extendedTextMessage?.text ||
            m.quoted.message?.imageMessage?.caption ||
            m.quoted.message?.videoMessage?.caption ||
            m.quoted.message?.documentMessage?.caption ||
            ''
        ).trim();
        if (qText) quotedContext = qText;
    }

    if (!body && !quotedContext && !m.message?.imageMessage && !m.message?.documentMessage && !m.quoted) return;

    // 5-7 second randomized cooldown per user
    const now = Date.now();
    const lastTime = lastTriggerMap.get(m.sender) || 0;
    const activeCooldown = userCooldownMap.get(m.sender) || randomCooldown();
    if (now - lastTime < activeCooldown) return;
    lastTriggerMap.set(m.sender, now);
    userCooldownMap.set(m.sender, randomCooldown());

    let keysMod = {};
    try {
        const imported = await import('../keys.js');
        keysMod = imported.default || imported;
    } catch (e) {
        console.error('[TOXICAI KEYS IMPORT ERROR]', e.message);
    }

    const cleanKey = (val) => (val && !String(val).startsWith('PASTE_')) ? String(val).trim() : '';

    const getNextGroqKey = keysMod.getNextGroqKey;
    const markKeyFailed = keysMod.markKeyFailed;
    let GROQ_KEY = cleanKey(typeof getNextGroqKey === 'function' ? getNextGroqKey() : '') || cleanKey(process.env.GROQ_KEY_1) || cleanKey(process.env.GROQ_API_KEY);
    const GEMINI_KEY = cleanKey(keysMod.GEMINI_API_KEY) || cleanKey(process.env.GEMINI_API_KEY);
    const OPENAI_KEY = cleanKey(keysMod.OPENAI_API_KEY) || cleanKey(process.env.OPENAI_API_KEY);
    const GH_TOKEN = cleanKey(keysMod.GITHUB_TOKEN) || cleanKey(process.env.GITHUB_TOKEN) || cleanKey(process.env.GH_TOKEN);
    const TAVILY_KEY = cleanKey(keysMod.TAVILY_API_KEY) || cleanKey(process.env.TAVILY_API_KEY);
    const SERPER_KEY = cleanKey(keysMod.SERPER_API_KEY) || cleanKey(process.env.SERPER_API_KEY);

    const FAST_MODEL = keysMod.GROQ_MODELS?.fast || 'openai/gpt-oss-20b';
    const SMART_MODEL = keysMod.GROQ_MODELS?.tools || 'openai/gpt-oss-120b';
    const VISION_MODEL = keysMod.GROQ_MODELS?.vision || 'meta-llama/llama-4-scout-17b-16e-instruct';

    if (!GROQ_KEY && !GEMINI_KEY && !OPENAI_KEY) {
        await client.sendMessage(m.chat, { text: boxWrap('missing AI keys in keys.js 🙄 add at least one GROQ, GEMINI, or OPENAI key first.', 'TOXICAI') });
        return;
    }

    const ghHeaders = {
        'Authorization': `token ${GH_TOKEN}`,
        'User-Agent': 'ToxicAgent/5.0',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    if (body && isClearIntent(body)) {
        clearHistory(chatKey);
        try { await client.sendMessage(m.chat, { react: { text: '🗑️', key: m.reactKey } }); } catch {}
        await client.sendMessage(m.chat, { text: boxWrap('session memory wiped clean 🗑️ fresh start.', 'MEMORY CLEARED') });
        return;
    }

    if (body && isBulkDeleteIntent(body)) {
        try { await client.sendMessage(m.chat, { react: { text: '💀', key: m.reactKey } }); } catch {}
        await client.sendMessage(m.chat, { text: boxWrap('yeah no. not deleting ALL your repos 💀 pick one specific repo name.', 'TOXICAI') });
        return;
    }

    if (body && isTokenRequest(body)) {
        try { await client.sendMessage(m.chat, { react: { text: '🙄', key: m.reactKey } }); } catch {}
        await client.sendMessage(m.chat, { text: boxWrap('nice try 🙄 not leaking tokens or API keys. ever.', 'TOXICAI') });
        return;
    }

    try { await client.sendMessage(m.chat, { react: { text: '🤖', key: m.reactKey } }); } catch {}

    // Inspect incoming/quoted images and readable documents
    let pendingImageBuf = null;
    let pendingImageMime = 'image/jpeg';
    let pendingImageExt = 'jpg';
    let attachedFileText = '';
    let attachedFileName = '';
    let imageUploadedUrl = null;

    const TEXT_EXTS = new Set(['txt', 'js', 'mjs', 'cjs', 'ts', 'json', 'py', 'html', 'css', 'md', 'csv', 'log', 'yml', 'yaml', 'xml', 'sh', 'env']);

    // Check quoted media/document
    if (m.quoted) {
        const qi = m.quoted.msg || m.quoted;
        const qmime = qi.mimetype || '';
        const qFileName = qi.fileName || '';
        const qExt = qFileName.split('.').pop()?.toLowerCase() || '';

        if (qmime.startsWith('image/') && !qmime.startsWith('image/gif')) {
            try {
                const buf = await m.quoted.download();
                if (buf?.length) {
                    pendingImageBuf = buf;
                    pendingImageMime = qmime.split(';')[0];
                    pendingImageExt = pendingImageMime.split('/')[1] || 'jpg';
                }
            } catch {}
        } else if (qmime.startsWith('text/') || qmime.includes('json') || qmime.includes('javascript') || TEXT_EXTS.has(qExt)) {
            try {
                const buf = await m.quoted.download();
                if (buf?.length) {
                    attachedFileName = qFileName || `quoted.${qExt || 'txt'}`;
                    attachedFileText = buf.toString('utf8').slice(0, 12000);
                }
            } catch {}
        }
    }

    // Check direct image
    if (!pendingImageBuf && m.message?.imageMessage) {
        try {
            const buf = await client.downloadMediaMessage(m);
            if (buf?.length) {
                pendingImageBuf = buf;
                pendingImageMime = (m.message.imageMessage.mimetype || 'image/jpeg').split(';')[0];
                pendingImageExt = pendingImageMime.split('/')[1] || 'jpg';
            }
        } catch {}
    }

    // Check direct document
    if (!attachedFileText && m.message?.documentMessage) {
        const dMsg = m.message.documentMessage;
        const dMime = dMsg.mimetype || '';
        const dName = dMsg.fileName || 'file.txt';
        const dExt = dName.split('.').pop()?.toLowerCase() || '';
        if (dMime.startsWith('text/') || dMime.includes('json') || dMime.includes('javascript') || TEXT_EXTS.has(dExt)) {
            try {
                const buf = await client.downloadMediaMessage(m);
                if (buf?.length) {
                    attachedFileName = dName;
                    attachedFileText = buf.toString('utf8').slice(0, 12000);
                }
            } catch {}
        }
    }

    // --- TOOLS ---
    async function webSearch(query) {
        if (TAVILY_KEY) {
            try {
                const tRes = await fetch('https://api.tavily.com/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: 'basic', include_answer: true, max_results: 4 })
                });
                if (tRes.ok) {
                    const tData = await tRes.json();
                    const snippets = (tData.results || []).map(r => `- ${r.title}: ${r.content} (${r.url})`).join('\n');
                    return (tData.answer ? `Summary: ${tData.answer}\n\n` : '') + (snippets || 'No results found.');
                }
            } catch {}
        }
        if (SERPER_KEY) {
            try {
                const sRes = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: query, num: 4 })
                });
                if (sRes.ok) {
                    const sData = await sRes.json();
                    const organic = (sData.organic || []).map(r => `- ${r.title}: ${r.snippet} (${r.link})`).join('\n');
                    return organic || 'No results found.';
                }
            } catch {}
        }
        return 'Live search unavailable (no Tavily or Serper key configured).';
    }

    async function generateAndSendFile(fileName, content, caption) {
        try {
            const safeName = String(fileName || 'output.txt').replace(/[^a-zA-Z0-9._-]/g, '_');
            const ext = safeName.split('.').pop()?.toLowerCase() || 'txt';
            const mimeMap = {
                js: 'application/javascript',
                json: 'application/json',
                html: 'text/html',
                css: 'text/css',
                py: 'text/x-python',
                csv: 'text/csv',
                md: 'text/markdown',
                txt: 'text/plain'
            };
            const mimetype = mimeMap[ext] || 'text/plain';
            const buf = Buffer.from(String(content || ''), 'utf8');
            await client.sendMessage(m.chat, {
                document: buf,
                fileName: safeName,
                mimetype,
                caption: caption || `📄 *${safeName}*`
            });
            return `sent file "${safeName}" directly to chat ✅`;
        } catch (e) {
            return `couldn't send file 😒 (${e.message})`;
        }
    }

    async function listRepos(username) {
        try {
            const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers: ghHeaders });
            if (!res.ok) return 'something went wrong fetching repos 😒';
            const repos = await res.json();
            if (!repos.length) return `${username} has zero repos.`;
            return repos.map(r => `- ${r.name} (${r.private ? '🔒 private' : '🌐 public'}, ⭐${r.stargazers_count})`).join('\n');
        } catch { return 'ran into an error getting repos 😒'; }
    }

    async function createRepo(name, description, isPrivate) {
        try {
            const res = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: ghHeaders,
                body: JSON.stringify({ name, description: description || '', private: !!isPrivate, auto_init: true })
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'failed'); }
            const r = await res.json();
            setLastRepo(chatKey, r.name);
            return `created "${r.name}" (${r.private ? '🔒 private' : '🌐 public'}) — done ✅\n\n${r.html_url}`;
        } catch (e) { return `couldn't create repo 😒 — ${e.message}`; }
    }

    async function deleteRepo(owner, name) {
        if (!name || /^(all|every|each|\*)$/i.test(name)) {
            return 'nope. not deleting all your repos. pick one specific name 💀';
        }
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, { method: 'DELETE', headers: ghHeaders });
            if (res.status === 204) return `"${name}" is gone forever 💀 done.`;
            if (res.status === 404) return `"${name}" doesn't exist 😒`;
            return 'deletion failed 😒 check repo name';
        } catch { return 'ran into an error deleting 😒'; }
    }

    async function renameRepo(owner, oldName, newName) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${oldName}`, {
                method: 'PATCH', headers: ghHeaders,
                body: JSON.stringify({ name: newName })
            });
            if (!res.ok) return 'rename failed 😒 check names';
            const r = await res.json();
            setLastRepo(chatKey, newName);
            return `renamed "${oldName}" → "${newName}" — done ✅\n\n${r.html_url}`;
        } catch { return 'ran into an error renaming 😒'; }
    }

    async function uploadFile(owner, repo, filePath, content, message) {
        try {
            let sha;
            const check = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, { headers: ghHeaders });
            if (check.ok) {
                const existing = await check.json();
                if (existing?.sha) sha = existing.sha;
            }
            const encoded = Buffer.from(content).toString('base64');
            const payload = { message: message || 'Update via ToxicAI', content: encoded };
            if (sha) payload.sha = sha;
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
                method: 'PUT', headers: ghHeaders,
                body: JSON.stringify(payload)
            });
            if (!res.ok) return 'upload failed 😒 check repo and path';
            const r = await res.json();
            setLastRepo(chatKey, repo);
            return `uploaded "${filePath}" to ${repo} — done ✅\n\n${r.content?.html_url || `https://github.com/${owner}/${repo}/blob/main/${filePath}`}`;
        } catch { return 'ran into an error uploading 😒'; }
    }

    async function uploadImageToGithub(owner, repo, imgBuf, ext) {
        const ts = Date.now();
        const filePath = `uploads/img_${ts}.${ext || 'jpg'}`;
        const encoded = imgBuf.toString('base64');
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            method: 'PUT', headers: ghHeaders,
            body: JSON.stringify({ message: 'Upload image via ToxicAI', content: encoded })
        });
        if (!res.ok) throw new Error('upload failed');
        const r = await res.json();
        setLastRepo(chatKey, repo);
        return r.content?.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
    }

    async function readFile(owner, repo, filePath) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, { headers: ghHeaders });
            if (!res.ok) return 'couldn\'t find that file 😒';
            const data = await res.json();
            if (Array.isArray(data)) return `Contents of ${filePath}:\n` + data.map(f => `- ${f.name} (${f.type})`).join('\n');
            if (!data.content) return 'file found but no readable content';
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            setLastRepo(chatKey, repo);
            return content.slice(0, 3500) + (content.length > 3500 ? '\n...(truncated)' : '');
        } catch { return 'ran into an error reading that file 😒'; }
    }

    async function getRepoInfo(owner, repo) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
            if (!res.ok) return `repo "${repo}" not found 😒`;
            const r = await res.json();
            setLastRepo(chatKey, r.name);
            return `${r.full_name} — ${r.description || 'no description'}\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count} | ${r.private ? '🔒 private' : '🌐 public'}\n\n${r.html_url}`;
        } catch { return 'ran into an error 😒'; }
    }

    async function executeTool(toolName, args) {
        if (toolName === 'web_search') {
            return webSearch(args.query);
        }
        if (toolName === 'generate_file') {
            return generateAndSendFile(args.file_name, args.content, args.caption);
        }
        if (!isDevUser) return 'access denied — GitHub actions are restricted to the bot owner.';
        if (toolName === 'list_repos') return listRepos(args.username || GH_USERNAME);
        if (toolName === 'create_repo') return createRepo(args.name, args.description, args.is_private || args.private);
        if (toolName === 'delete_repo') return deleteRepo(args.owner || GH_USERNAME, args.name);
        if (toolName === 'rename_repo') return renameRepo(args.owner || GH_USERNAME, args.old_name, args.new_name);
        if (toolName === 'upload_file') return uploadFile(args.owner || GH_USERNAME, args.repo, args.file_path, args.content, args.message);
        if (toolName === 'upload_image_to_github') {
            if (!pendingImageBuf) return 'no image found. send or quote an image first.';
            try {
                const url = await uploadImageToGithub(args.owner || GH_USERNAME, args.repo || 'toxictech', pendingImageBuf, pendingImageExt);
                imageUploadedUrl = url;
                return `image uploaded 📎 link: ${url}`;
            } catch { return 'image upload failed 😒'; }
        }
        if (toolName === 'read_file') return readFile(args.owner || GH_USERNAME, args.repo, args.file_path || args.path);
        if (toolName === 'get_repo_info') return getRepoInfo(args.owner || GH_USERNAME, args.repo);
        return 'unknown action 😒';
    }

    const hasSearch = Boolean(TAVILY_KEY || SERPER_KEY);

    const tools = [
        {
            type: 'function',
            function: {
                name: 'generate_file',
                description: 'Generate a downloadable file (.js, .txt, .json, .html, .py, .csv, .md) and send it directly in the WhatsApp chat',
                parameters: {
                    type: 'object',
                    properties: {
                        file_name: { type: 'string', description: 'Filename with extension, e.g. index.js or notes.txt' },
                        content: { type: 'string', description: 'Complete text content of the file' },
                        caption: { type: 'string', description: 'Short caption for the file' }
                    },
                    required: ['file_name', 'content']
                }
            }
        }
    ];

    if (hasSearch) {
        tools.push({
            type: 'function',
            function: {
                name: 'web_search',
                description: 'Search the live internet for real-time news, facts, prices, or information',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' }
                    },
                    required: ['query']
                }
            }
        });
    }

    if (isDevUser) {
        tools.push(
            { type: 'function', function: { name: 'list_repos', description: 'List GitHub repositories for a user', parameters: { type: 'object', properties: { username: { type: 'string' } }, required: ['username'] } } },
            { type: 'function', function: { name: 'create_repo', description: 'Create a new GitHub repository', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, is_private: { type: 'boolean' } }, required: ['name'] } } },
            { type: 'function', function: { name: 'delete_repo', description: 'Permanently delete a single named GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, name: { type: 'string' } }, required: ['owner', 'name'] } } },
            { type: 'function', function: { name: 'rename_repo', description: 'Rename a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, old_name: { type: 'string' }, new_name: { type: 'string' } }, required: ['owner', 'old_name', 'new_name'] } } },
            { type: 'function', function: { name: 'upload_file', description: 'Create or update a file in a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, file_path: { type: 'string' }, content: { type: 'string' }, message: { type: 'string' } }, required: ['owner', 'repo', 'file_path', 'content'] } } },
            { type: 'function', function: { name: 'upload_image_to_github', description: 'Upload the attached or quoted image to GitHub', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['repo'] } } },
            { type: 'function', function: { name: 'read_file', description: 'Read a file from a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, file_path: { type: 'string' } }, required: ['owner', 'repo', 'file_path'] } } },
            { type: 'function', function: { name: 'get_repo_info', description: 'Get details about a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] } } }
        );
    }

    const wantsGithubUpload = isDevUser && pendingImageBuf && /\b(upload|github|repo|push|save)\b/i.test(body);
    const needsTools = isFileGenIntent(body) || (hasSearch && isSearchIntent(body)) || (isDevUser && (isGithubIntent(body) || wantsGithubUpload));

    let lastProviderError = '';
const GEMINI_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash'];


    async function fetchGeminiWithFallback(payload) {
        let lastRes = null;
        for (const model of GEMINI_MODELS) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_KEY
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) return res;
            lastRes = res;
            if (res.status !== 503 && res.status !== 429 && res.status !== 404) {
                return res;
            }
        }
        return lastRes;
    }

    async function callFallbackProviders(msgs, toolsRanOut) {
        if (GEMINI_KEY) {
            try {
                const sys = msgs.find(x => x.role === 'system')?.content || '';
                const contents = msgs.filter(x => x.role !== 'system').map((x, idx, arr) => {
                    const isLastUser = idx === arr.length - 1 && x.role === 'user';
                    const parts = [{ text: typeof x.content === 'string' ? x.content : JSON.stringify(x.content) }];
                    if (isLastUser && pendingImageBuf && !wantsGithubUpload) {
                        parts.push({
                            inlineData: {
                                mimeType: pendingImageMime,
                                data: pendingImageBuf.toString('base64')
                            }
                        });
                    }
                    return {
                        role: x.role === 'assistant' ? 'model' : 'user',
                        parts
                    };
                });

                const geminiTools = [{
                    functionDeclarations: tools.map(t => ({
                        name: t.function.name,
                        description: t.function.description,
                        parameters: t.function.parameters
                    }))
                }];

                for (let gTurn = 0; gTurn < MAX_TOOL_TURNS; gTurn++) {
                    const gPayload = {
                        systemInstruction: { parts: [{ text: sys }] },
                        contents,
                        generationConfig: { maxOutputTokens: 2048 }
                    };
                    if (needsTools) gPayload.tools = geminiTools;

                    const gRes = await fetchGeminiWithFallback(gPayload);
                    const gData = await gRes.json().catch(() => ({}));
                    if (!gRes.ok) {
                        lastProviderError = `Gemini: ${gData.error?.message || gRes.status}`;
                        break;
                    }

                    const candidate = gData.candidates && gData.candidates[0];
                    const parts = candidate && candidate.content && candidate.content.parts ? candidate.content.parts : [];
                    const fnPart = parts.find(p => p.functionCall);

                    if (fnPart && fnPart.functionCall) {
                        const fnName = fnPart.functionCall.name;
                        const fnArgs = fnPart.functionCall.args || {};
                        let toolResult = '';
                        try {
                            toolResult = await executeTool(fnName, fnArgs);
                            if (toolsRanOut) toolsRanOut.push(toolResult);
                        } catch {
                            toolResult = 'ran into an error 😒';
                        }
                        contents.push({ role: 'model', parts: [fnPart] });
                        contents.push({
                            role: 'user',
                            parts: [{
                                functionResponse: {
                                    name: fnName,
                                    response: { result: toolResult }
                                }
                            }]
                        });
                        continue;
                    }

                    const textParts = parts.filter(p => p.text).map(p => p.text).join('').trim();
                    if (textParts) return textParts;
                    break;
                }
            } catch (e) {
                lastProviderError = `Gemini error: ${e.message}`;
            }
        }
        if (OPENAI_KEY) {
            try {
                const openaiUrl = 'https://api.openai.com/v1/chat/completions';
                const oMessages = msgs.map((x, idx, arr) => {
                    const isLastUser = idx === arr.length - 1 && x.role === 'user';
                    if (isLastUser && pendingImageBuf && !wantsGithubUpload) {
                        return {
                            role: 'user',
                            content: [
                                { type: 'text', text: String(x.content) },
                                { type: 'image_url', image_url: { url: `data:${pendingImageMime};base64,${pendingImageBuf.toString('base64')}` } }
                            ]
                        };
                    }
                    return x;
                });

                for (let oTurn = 0; oTurn < MAX_TOOL_TURNS; oTurn++) {
                    const oPayload = { model: 'gpt-4o-mini', messages: oMessages, max_tokens: 2048 };
                    if (needsTools) {
                        oPayload.tools = tools;
                        oPayload.tool_choice = 'auto';
                    }
                    const oRes = await fetch(openaiUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(oPayload)
                    });
                    const oData = await oRes.json().catch(() => ({}));
                    if (!oRes.ok) {
                        lastProviderError = `OpenAI: ${oData.error?.message || oRes.status}`;
                        break;
                    }
                    const oChoice = oData.choices && oData.choices[0];
                    if (oChoice && oChoice.finish_reason === 'tool_calls' && oChoice.message?.tool_calls?.length) {
                        const tc = oChoice.message.tool_calls[0];
                        let args = {};
                        try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
                        let toolResult = '';
                        try {
                            toolResult = await executeTool(tc.function.name, args);
                            if (toolsRanOut) toolsRanOut.push(toolResult);
                        } catch {
                            toolResult = 'ran into an error 😒';
                        }
                        oMessages.push(oChoice.message);
                        oMessages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
                        continue;
                    }
                    const txt = oChoice && oChoice.message && oChoice.message.content ? oChoice.message.content.trim() : '';
                    if (txt) return txt;
                    break;
                }
            } catch (e) {
                lastProviderError = `OpenAI error: ${e.message}`;
            }
        }
        return null;
    }

    async function callGroq(msgs, useTools, overrideModel = null) {
        const modelName = overrideModel || (useTools ? SMART_MODEL : FAST_MODEL);
        const payload = { model: modelName, messages: msgs, max_tokens: 2048 };
        if (useTools) {
            payload.tools = tools;
            payload.tool_choice = 'auto';
            payload.parallel_tool_calls = false;
        }
        let currentKey = GROQ_KEY;
        for (let attempt = 0; attempt < 5; attempt++) {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.status === 429 || res.status === 401 || res.status === 403) {
                if (markKeyFailed) markKeyFailed(currentKey);
                const nextKey = getNextGroqKey ? getNextGroqKey() : null;
                if (!nextKey || nextKey === currentKey) {
                    if (!overrideModel) {
                        const altModel = modelName === FAST_MODEL ? SMART_MODEL : FAST_MODEL;
                        return callGroq(msgs, useTools, altModel);
                    }
                    return res;
                }
                currentKey = nextKey;
                continue;
            }
            return res;
        }
        return fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    try {
        const session = getSessionData(chatKey);
        const isCatchUp = Boolean(body && isCatchUpIntent(body));
        const systemPrompt = buildSystemPrompt(session.lastRepo, isDevUser, isCatchUp, hasSearch);

        // Assemble full context from direct message, quoted text, and attached readable files
        let combinedUserPrompt = body || '';
        if (quotedContext) {
            combinedUserPrompt = combinedUserPrompt
                ? `[Quoted message]: "${quotedContext}"\n\n[User message]: ${combinedUserPrompt}`
                : `[Quoted message]: "${quotedContext}"`;
        }
        if (attachedFileText) {
            combinedUserPrompt += `\n\n[Attached File: ${attachedFileName}]:\n\`\`\`\n${attachedFileText}\n\`\`\``;
        }
        if (!combinedUserPrompt && pendingImageBuf) {
            combinedUserPrompt = wantsGithubUpload ? 'upload this image to github' : 'describe and explain what is in this image';
        }
        if (!combinedUserPrompt) combinedUserPrompt = 'what can you do?';

        // Handle image vision directly via Groq when available
        if (pendingImageBuf && !wantsGithubUpload && GROQ_KEY) {
            const b64 = pendingImageBuf.toString('base64');
            const visionMessages = [
                { role: 'system', content: systemPrompt },
                ...session.messages.slice(-8),
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: combinedUserPrompt },
                        { type: 'image_url', image_url: { url: `data:${pendingImageMime};base64,${b64}` } }
                    ]
                }
            ];
            const vRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: VISION_MODEL, messages: visionMessages, max_tokens: 1500 })
            });
            if (vRes.ok) {
                const vData = await vRes.json();
                const vReply = stripEmbeddedFuncTags(vData.choices?.[0]?.message?.content?.trim() || '');
                if (vReply) {
                    pushHistory(chatKey, 'user', combinedUserPrompt);
                    pushHistory(chatKey, 'assistant', vReply);
                    await simulateHumanTyping(client, m.chat, vReply);
                    await client.sendMessage(m.chat, { text: boxWrap(vReply, 'TOXICAI') });
                    try { await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }); } catch {}
                    return;
                }
            }
        }

        let turnMessages = [
            { role: 'system', content: systemPrompt },
            ...session.messages,
            { role: 'user', content: combinedUserPrompt }
        ];
        pushHistory(chatKey, 'user', combinedUserPrompt);

        let finalReply = '';
        let toolsRan = [];

        if (GROQ_KEY) {
            for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
                const res = await callGroq(turnMessages, needsTools);

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    const errCode = err?.error?.code || '';
                    if (errCode === 'tool_use_failed' && err?.error?.failed_generation) {
                        const fm = err.error.failed_generation.match(/<function=([^=<>\s]+?)=?(\{[\s\S]*?\})<\/function>/);
                        if (fm) {
                            try {
                                const args = JSON.parse(fm[2]);
                                const toolResult = await executeTool(fm[1].trim(), args);
                                toolsRan.push(toolResult);
                                turnMessages.push({ role: 'assistant', content: `[executed ${fm[1]}]` });
                                turnMessages.push({ role: 'user', content: `Tool result: ${toolResult}\nNow give your final reply.` });
                                continue;
                            } catch {}
                        }
                    }
                    if (turn === 0) {
                        const fb = await callGroq([...turnMessages], false, FAST_MODEL).catch(() => null);
                        if (fb?.ok) {
                            const fbData = await fb.json().catch(() => ({}));
                            const fbContent = fbData.choices?.[0]?.message?.content?.trim() || '';
                            if (fbContent) { finalReply = stripEmbeddedFuncTags(fbContent); break; }
                        }
                        const extFb = await callFallbackProviders(turnMessages, toolsRan);
                        if (extFb) { finalReply = stripEmbeddedFuncTags(extFb); break; }
                    }
                    finalReply = `something went wrong 😒 (${err?.error?.message || `HTTP ${res.status}`})`;
                    break;
                }

                const data = await res.json();
                const choice = data.choices?.[0];
                if (!choice) break;

                if (choice.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length) {
                    const toolCall = choice.message.tool_calls[0];
                    const toolName = toolCall.function.name;
                    let args = {};
                    try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}
                    let toolResult = '';
                    try { toolResult = await executeTool(toolName, args); toolsRan.push(toolResult); }
                    catch { toolResult = 'ran into an error 😒'; }
                    turnMessages.push(choice.message);
                    turnMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult });
                } else {
                    const rawContent = choice.message?.content?.trim() || '';
                    if (rawContent.includes('<function=')) {
                        const embedded = await processEmbeddedCalls(rawContent, executeTool);
                        if (embedded) { toolsRan.push(...embedded.results); finalReply = stripEmbeddedFuncTags(embedded.cleaned); }
                        else finalReply = stripEmbeddedFuncTags(rawContent);
                    } else {
                        finalReply = rawContent;
                    }
                    break;
                }
            }
        } else {
            const extReply = await callFallbackProviders(turnMessages, toolsRan);
            finalReply = extReply
                ? stripEmbeddedFuncTags(extReply)
                : `AI error 😒 (${lastProviderError || 'paste a valid Groq, Gemini, or OpenAI key in keys.js'})`;
        }

        if (!finalReply) {
            finalReply = toolsRan.length ? toolsRan.join('\n') : 'something went sideways 🤦';
        }

        if (finalReply && toolsRan.length) {
            for (const tr of toolsRan) {
                const ghM = String(tr).match(/https:\/\/github\.com\/\S+/);
                if (ghM && !finalReply.includes(ghM[0])) finalReply += `\n\n${ghM[0]}`;
            }
        }

        pushHistory(chatKey, 'assistant', finalReply);
        await simulateHumanTyping(client, m.chat, finalReply);
        await client.sendMessage(m.chat, { text: boxWrap(finalReply, 'TOXICAI') });

        if (imageUploadedUrl) {
            await client.sendMessage(m.chat, {
                text: `╭─❏ 「 IMAGE UPLOADED」
│
│ 🔗 ${imageUploadedUrl}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`
            });
        }
        try { await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }); } catch {}

    } catch (err) {
        console.error('[TOXICAI CRASH]', err);
        try { await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }); } catch {}
        await client.sendMessage(m.chat, { text: boxWrap(`ran into an error 🙄 (${err?.message || 'unknown'})`, 'TOXICAI') });
    }
};
