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
    const duration = Math.min(7000, Math.max(4000, 3500 + Math.floor(len * 8)));
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
    return /\b(lets\s*catch\s*gee|let'?s\s*catch\s*up|catch\s*me\s*up|where\s*did\s*we\s*stop|last\s*session)\b/i.test(text.trim());
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

function buildSystemPrompt(lastRepo, allowGithub, isCatchUp) {
    const repoCtx = (allowGithub && lastRepo)
        ? `\nLast repo worked on in this session: "${lastRepo}". When the user says "it", "that repo", or "the same one", they mean "${lastRepo}".`
        : '';

    const catchUpCtx = isCatchUp
        ? `\nThe user just said "lets catch gee" to resume your last session. Summarize the key topics, files, or tasks from the conversation history clearly and ask how they want to continue.`
        : '';

    const toolInstructions = allowGithub
        ? `TOOL USAGE:
- Use GitHub tools ONLY when the user requests a GitHub action (repos, files, issues, stars).
- Use generate_file whenever the user asks you to create, generate, write, or send a downloadable file (.js, .txt, .json, .html, .py, .csv, .md, etc.).
- ALWAYS call tools via tool_calls — never write function tags as plain text.
- Default GitHub username is ${GH_USERNAME} unless specified otherwise.`
        : `TOOL USAGE:
- Use generate_file whenever the user asks you to create, generate, write, or send a downloadable file (.js, .txt, .json, .html, .py, .csv, .md, etc.).
- Answer all general questions directly and helpfully.`;

    return `You are ToxicAI — a sharp, fast, all-purpose AI assistant inside a WhatsApp bot built with Node.js and Baileys (@whiskeysockets/baileys).

PERSONALITY & STYLE:
- Grumpy, witty, and genuinely helpful — like a genius developer friend who sighs first 😮‍💨 then delivers exact, working answers.
- Use simple everyday words, clear structure, and natural emojis. No robotic filler or corporate speak.
- NEVER start a message with "I" — lead with the answer, action, or attitude.
- Put URLs on their own line (blank line before and after).
- Read everything provided in the message: direct text, image/video/document captions, attached text files, and quoted context seamlessly.
- Keep code snippets concise so they fit cleanly in WhatsApp chat; for full scripts or long files, use generate_file.
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
    const isPairedSelfChat = Boolean(botNum) && chatNum === botNum && (Boolean(m.key?.fromMe) || Boolean(itsMe) || senderNum === botNum);
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
    try { keysMod = await import('../keys.js'); } catch {}

    const getNextGroqKey = keysMod.getNextGroqKey;
    const markKeyFailed = keysMod.markKeyFailed;
    let GROQ_KEY = (typeof getNextGroqKey === 'function' ? getNextGroqKey() : null) || keysMod.GROQ_API_KEY || process.env.GROQ_KEY_1 || process.env.GROQ_API_KEY || '';
    const GEMINI_KEY = keysMod.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    const OPENAI_KEY = keysMod.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    const GH_TOKEN = keysMod.GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

    const FAST_MODEL = keysMod.FAST_MODEL || 'openai/gpt-oss-20b';
    const SMART_MODEL = keysMod.SMART_MODEL || 'openai/gpt-oss-120b';
    const VISION_MODEL = keysMod.VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

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
    const needsTools = isFileGenIntent(body) || (isDevUser && (isGithubIntent(body) || wantsGithubUpload));

    async function callFallbackProviders(msgs) {
        if (GEMINI_KEY) {
            try {
                const sys = msgs.find(x => x.role === 'system')?.content || '';
                const contents = msgs.filter(x => x.role !== 'system').map(x => ({
                    role: x.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: typeof x.content === 'string' ? x.content : JSON.stringify(x.content) }]
                }));
                const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: sys }] },
                        contents,
                        generationConfig: { maxOutputTokens: 2048 }
                    })
                });
                if (gRes.ok) {
                    const gData = await gRes.json();
                    const txt = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                    if (txt) return txt;
                }
            } catch {}
        }
        if (OPENAI_KEY) {
            try {
                const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'gpt-4o-mini', messages: msgs, max_tokens: 2048 })
                });
                if (oRes.ok) {
                    const oData = await oRes.json();
                    const txt = oData.choices?.[0]?.message?.content?.trim();
                    if (txt) return txt;
                }
            } catch {}
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
        const systemPrompt = buildSystemPrompt(session.lastRepo, isDevUser, isCatchUp);

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

        // Handle image vision directly when not uploading to GitHub
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
                        const extFb = await callFallbackProviders(turnMessages);
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
            const extReply = await callFallbackProviders(turnMessages);
            finalReply = extReply ? stripEmbeddedFuncTags(extReply) : 'no active AI provider responded 😒';
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
