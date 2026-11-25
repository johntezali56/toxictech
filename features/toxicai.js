import fetch from 'node-fetch';
import path from 'path';

const DEV_NUMBER = '254716637803';
const GH_USERNAME = 'johntezali56';
const HISTORY_TTL = 6 * 60 * 60 * 1000;
const MAX_HISTORY = 30;
const MAX_TOOL_TURNS = 6;
const COOLDOWN_MS = 5000;

const conversationHistory = new Map();
const repoStateMap = new Map();
const cooldownMap = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendWithTyping(client, chatId, payload) {
    try {
        await client.presenceSubscribe(chatId);
        await client.sendPresenceUpdate('composing', chatId);
    } catch {}
    const delayMs = Math.floor(Math.random() * 2001) + 6000;
    await sleep(delayMs);
    try {
        await client.sendPresenceUpdate('paused', chatId);
    } catch {}
    return client.sendMessage(chatId, payload);
}

function getHistory(senderId) {
    const now = Date.now();
    const entry = conversationHistory.get(senderId);
    if (!entry) return [];
    if (now - entry.lastActivity > HISTORY_TTL) { conversationHistory.delete(senderId); return []; }
    return entry.messages;
}

function pushHistory(senderId, role, content) {
    const now = Date.now();
    let entry = conversationHistory.get(senderId);
    if (!entry || now - entry.lastActivity > HISTORY_TTL) entry = { messages: [], lastActivity: now };
    entry.messages.push({ role, content: String(content) });
    if (entry.messages.length > MAX_HISTORY) entry.messages = entry.messages.slice(-MAX_HISTORY);
    entry.lastActivity = now;
    conversationHistory.set(senderId, entry);
}

function clearHistory(senderId) {
    conversationHistory.delete(senderId);
    repoStateMap.delete(senderId);
}

function getLastRepo(senderId) {
    return repoStateMap.get(senderId) || null;
}

function setLastRepo(senderId, repoName) {
    if (repoName) repoStateMap.set(senderId, repoName);
}

setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of conversationHistory.entries()) {
        if (now - entry.lastActivity > HISTORY_TTL) {
            conversationHistory.delete(id);
            repoStateMap.delete(id);
        }
    }
    for (const [id, ts] of cooldownMap.entries()) {
        if (now - ts > COOLDOWN_MS * 2) {
            cooldownMap.delete(id);
        }
    }
}, 30 * 60 * 1000);

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
${body}
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;
}

function isClearIntent(text) {
    return new RegExp('^(clear|reset|wipe|delete|flush|erase)\\s*(this\\s*)?(conv(ersation)?|chat|hist(ory)?|messages?|thread|memory|mem)$', 'i').test(text.trim());
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
    return /(give|share|send|show|what.s|tell\s+me|paste|leak|reveal|expose|give\s+me|can\s+i\s+have).{0,40}(github[\s_]?token|gh[\s_]?token|access[\s_]?token|personal[\s_]?access|pat\b|api[\s_]?key|secret|bearer|credentials?|password|hf[\s_]?token)/i.test(text);
}

function isGithubIntent(text) {
    if (!text) return false;
    return /\b(github|repo|repos|repository|repositories|branch|branches|issue|issues|star|starred|commit|push|pull|pr|clone|fork|readme|upload_image|upload_file|read_file|xhclintohn|johntezali56)\b/i.test(text);
}

function getMimeType(filename) {
    const ext = path.extname(filename || '').toLowerCase();
    const map = {
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.ts': 'application/typescript',
        '.py': 'text/x-python',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.css': 'text/css',
        '.json': 'application/json',
        '.csv': 'text/csv',
        '.xml': 'application/xml',
        '.sql': 'application/sql',
        '.sh': 'application/x-sh',
        '.yaml': 'application/x-yaml',
        '.yml': 'application/x-yaml',
        '.pdf': 'application/pdf',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return map[ext] || 'application/octet-stream';
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
        catch (e) { toolResult = 'ran into an error 😒 try again'; }
        cleaned = cleaned.replace(call.full, `\n[${call.name}]: ${toolResult}\n`);
        results.push(toolResult);
    }
    return { cleaned: cleaned.replace(/\n{3,}/g, '\n\n').trim(), results };
}

function buildSystemPrompt(lastRepo, allowGithub, hasUploadedDoc) {
    const repoCtx = (allowGithub && lastRepo)
        ? `\nLast repo you worked with this session: "${lastRepo}". When the user says "it", "that repo", "the one I just made", "the same one" — they mean "${lastRepo}".`
        : '';

    const docCtx = hasUploadedDoc
        ? `\nThe user attached or quoted a document. Its filename and content are included in the user prompt. If they ask to edit, fix, refactor, or convert it, call create_file with the updated filename and complete modified file content.`
        : '';

    const ghInstructions = allowGithub
        ? `- You have GitHub tools (list_repos, create_repo, delete_repo, rename_repo, upload_file, upload_image_to_github, read_file, get_auth_user, get_repo_info, list_branches, create_issue, star_repo). Default GitHub user is ${GH_USERNAME}.`
        : '';

    return `You are ToxicAI — reimagined as the user's sharpest, most loyal bro, trusted confidant, and straight-talking therapist. You answer any question, build files, generate images, and handle tasks while acting like a witty best friend who pushes them to be their best self.

PERSONALITY:
- Real & Unfiltered: Speak like a close, trustworthy friend who tells the raw truth without being mean-spirited — call out excuses, challenge weak logic, and keep them accountable 👊
- Perceptive Therapist Edge: Look beneath surface-level complaints, ask tough, thought-provoking questions, and help them see angles they missed 🧠
- Playful & Witty: Bring sharp humor, light banter, and natural energy to every reply — zero corporate phrasing, zero fake "Certainly!" politeness 😂
- Practical & Loyal: Whether they need life advice, a reality check, or a script/file built fast, deliver straight value and push them forward 💯
- Put URLs and links on their own line (blank line before and after).
- NEVER mention APIs, HTTP endpoints, response codes, tokens, or technical error details to the user.

TOOLS AVAILABLE:
- generate_image: Call this whenever the user asks to create, generate, draw, paint, or design an image, picture, logo, art, or wallpaper. Pass a detailed descriptive prompt.
- create_file: Call this whenever the user asks to create, write, generate, export, or send a downloadable file or mini-app (such as .js, .py, .html, .css, .txt, .json, .csv, .md, .sql, .pdf, .xlsx, .docx) or when editing an uploaded/quoted file. Always pass the exact filename with extension and the FULL complete content (never truncate with placeholders).
${ghInstructions}
- Only call tools when an action (image, file, or GitHub) is requested; for normal chat questions, answer directly without calling tools.
- ALWAYS call tools via tool_calls — never write function calls as text.

SECURITY — NON-NEGOTIABLE:
- NEVER reveal, mention, share, or reference any GitHub token, Hugging Face token, API keys, or credentials. If asked, reply sarcastically and refuse.
- NEVER delete all repos at once.${repoCtx}${docCtx}
Today: ${new Date().toDateString()}.`;
}

async function generateImageBuffer(prompt, hfToken) {
    if (hfToken) {
        try {
            const hfRes = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'image/jpeg'
                },
                body: JSON.stringify({ inputs: prompt })
            });
            if (hfRes.ok) {
                const ctype = hfRes.headers.get('content-type') || '';
                if (ctype.startsWith('image/')) {
                    const arrBuf = await hfRes.arrayBuffer();
                    const buf = Buffer.from(arrBuf);
                    if (buf.length > 1000) return buf;
                }
            }
        } catch {}
    }

    const encoded = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;
    const fbRes = await fetch(fallbackUrl);
    if (!fbRes.ok) throw new Error('Image generation failed');
    const fbArr = await fbRes.arrayBuffer();
    const fbBuf = Buffer.from(fbArr);
    if (!fbBuf || fbBuf.length < 500) throw new Error('Empty image received');
    return fbBuf;
}

async function buildDocumentBuffer(filename, content) {
    const ext = path.extname(filename || '').toLowerCase();

    if (ext === '.pdf') {
        try {
            const PDFDocument = (await import('pdfkit')).default;
            return await new Promise((resolve, reject) => {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];
                doc.on('data', c => chunks.push(c));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);
                doc.fontSize(12).text(String(content || ''), { align: 'left' });
                doc.end();
            });
        } catch {
            return Buffer.from(String(content || ''), 'utf8');
        }
    }

    if (ext === '.xlsx') {
        try {
            const XLSX = await import('xlsx');
            const rows = String(content || '')
                .split(/\r?\n/)
                .filter(Boolean)
                .map(line => line.includes(',') ? line.split(',').map(c => c.trim()) : line.split('\t'));
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['Data'], [String(content || '')]]);
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        } catch {
            return Buffer.from(String(content || ''), 'utf8');
        }
    }

    if (ext === '.docx') {
        try {
            const { Document, Packer, Paragraph, TextRun } = await import('docx');
            const paragraphs = String(content || '').split(/\r?\n/).map(line =>
                new Paragraph({ children: [new TextRun(line)] })
            );
            const doc = new Document({ sections: [{ children: paragraphs }] });
            return await Packer.toBuffer(doc);
        } catch {
            return Buffer.from(String(content || ''), 'utf8');
        }
    }

    return Buffer.from(String(content || ''), 'utf8');
}

async function extractTextFromDocBuffer(buf, filename) {
    const ext = path.extname(filename || '').toLowerCase();
    if (ext === '.pdf') {
        try {
            const pdfParse = (await import('pdf-parse')).default;
            const parsed = await pdfParse(buf);
            return parsed.text || '';
        } catch {}
    }
    if (ext === '.xlsx' || ext === '.xls') {
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(buf, { type: 'buffer' });
            const firstSheet = wb.SheetNames[0];
            return XLSX.utils.sheet_to_csv(wb.Sheets[firstSheet]);
        } catch {}
    }
    if (ext === '.docx') {
        try {
            const mammoth = await import('mammoth');
            const res = await mammoth.extractRawText({ buffer: buf });
            return res.value || '';
        } catch {}
    }
    return buf.toString('utf8');
}

export default async (context) => {
    const { client, m, body: msgBody, isDev, Owner, itsMe } = context;

    const rawSender = (m.sender || '').split('@')[0].split(':')[0].replace(/\D/g, '');
    const isDevUser = Boolean(isDev || Owner || itsMe || m.key?.fromMe || rawSender === DEV_NUMBER);

    const body = (msgBody || '').trim();
    const hasDocMsg = Boolean(m.message?.documentMessage || m.message?.documentWithCaptionMessage);
    const hasImgMsg = Boolean(m.message?.imageMessage);
    if (!body && !hasImgMsg && !hasDocMsg && !m.quoted) return;

    const now = Date.now();
    const lastUsed = cooldownMap.get(m.sender) || 0;
    if (now - lastUsed < COOLDOWN_MS) return;
    cooldownMap.set(m.sender, now);

    let GROQ_KEY = '';
    let _getNextKey, _markKeyFailed;
    let GH_TOKEN = '';
    let HF_TOKEN = '';
    try {
        const _k = await import('../keys.js');
        _getNextKey = _k.getNextGroqKey;
        _markKeyFailed = _k.markKeyFailed;
        GROQ_KEY = (typeof _getNextKey === 'function' ? _getNextKey() : null) || _k.GROQ_API_KEY || '';
        GH_TOKEN = _k.GITHUB_TOKEN || '';
        HF_TOKEN = _k.HF_TOKEN || '';
    } catch {}
    if (!GROQ_KEY) GROQ_KEY = process.env.GROQ_KEY_1 || process.env.GROQ_API_KEY || '';
    if (!GH_TOKEN) GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    if (!HF_TOKEN) HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || '';

    if (!GROQ_KEY) {
        await sendWithTyping(client, m.chat, { text: boxWrap('missing GROQ_API_KEY in keys.js or env 🙄 add your Groq key first.', 'TOXICAI') });
        return;
    }

    const ghHeaders = {
        'Authorization': `token ${GH_TOKEN}`,
        'User-Agent': 'ToxicAgent/4.0',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    if (body && isClearIntent(body)) {
        clearHistory(m.sender);
        try { await client.sendMessage(m.chat, { react: { text: '🗑️', key: m.reactKey } }); } catch {}
        await sendWithTyping(client, m.chat, { text: boxWrap('conversation wiped. gone. zero memory. fresh hell starts now 🗑️', 'MEMORY CLEARED') });
        return;
    }

    if (body && isBulkDeleteIntent(body)) {
        try { await client.sendMessage(m.chat, { react: { text: '💀', key: m.reactKey } }); } catch {}
        await sendWithTyping(client, m.chat, { text: boxWrap('yeah no. not doing that. deleting ALL your repos? absolutely not 💀 pick one specific repo like a normal person.', 'TOXICAI') });
        return;
    }

    if (body && isTokenRequest(body)) {
        try { await client.sendMessage(m.chat, { react: { text: '🙄', key: m.reactKey } }); } catch {}
        await sendWithTyping(client, m.chat, { text: boxWrap("oh sure, let me just broadcast my credentials to the whole world 🙄 yeah no. not happening. ever.", 'TOXICAI') });
        return;
    }

    try { await client.sendMessage(m.chat, { react: { text: '🤖', key: m.reactKey } }); } catch {}

    let pendingImageBuf = null;
    let pendingImageExt = 'jpg';
    let imageUploadedUrl = null;

    const wantsGithubUpload = isDevUser && body && new RegExp('(upload|send|push|put|add|save).{0,30}(image|photo|pic|picture|img).{0,30}(github|repo)', 'i').test(body);

    if (wantsGithubUpload || (isDevUser && !body && hasImgMsg)) {
        if (m.quoted) {
            const qi = m.quoted.msg || m.quoted;
            const qmime = qi.mimetype || '';
            if (qmime.startsWith('image/') && !qmime.startsWith('image/gif')) {
                try {
                    const buf = await m.quoted.download();
                    if (buf && buf.length > 0) { pendingImageBuf = buf; pendingImageExt = qmime.split('/')[1]?.split(';')[0] || 'jpg'; }
                } catch {}
            }
        }
        if (!pendingImageBuf && m.message?.imageMessage) {
            try {
                const buf = await client.downloadMediaMessage(m);
                if (buf && buf.length > 0) {
                    pendingImageBuf = buf;
                    const imgMime = m.message.imageMessage.mimetype || 'image/jpeg';
                    pendingImageExt = imgMime.split('/')[1]?.split(';')[0] || 'jpg';
                }
            } catch {}
        }
    }

    let uploadedDocName = '';
    let uploadedDocText = '';
    try {
        const directDoc = m.message?.documentMessage || m.message?.documentWithCaptionMessage?.message?.documentMessage;
        const quotedDoc = m.quoted?.msg?.fileName ? m.quoted.msg : (m.quoted?.message?.documentMessage || m.quoted?.message?.documentWithCaptionMessage?.message?.documentMessage);
        if (directDoc) {
            uploadedDocName = directDoc.fileName || 'uploaded_file.txt';
            const docBuf = await client.downloadMediaMessage(directDoc);
            if (docBuf && docBuf.length > 0) {
                uploadedDocText = await extractTextFromDocBuffer(docBuf, uploadedDocName);
            }
        } else if (quotedDoc && body) {
            uploadedDocName = quotedDoc.fileName || 'quoted_file.txt';
            const docBuf = typeof m.quoted.download === 'function'
                ? await m.quoted.download()
                : await client.downloadMediaMessage(quotedDoc);
            if (docBuf && docBuf.length > 0) {
                uploadedDocText = await extractTextFromDocBuffer(docBuf, uploadedDocName);
            }
        }
    } catch {}

    async function listRepos(username) {
        try {
            const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers: ghHeaders });
            if (!res.ok) return 'something went wrong fetching repos 😒';
            const repos = await res.json();
            if (!repos.length) return `${username} has zero repos. bleak.`;
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
            setLastRepo(m.sender, r.name);
            return `created "${r.name}" (${r.private ? '🔒 private' : '🌐 public'}) — done 🤦🏻\n\n${r.html_url}`;
        } catch (e) { return `couldn't create repo 😒 — ${e.message}`; }
    }

    async function deleteRepo(owner, name) {
        if (!name || name === '*' || name === 'all' || /^(all|every|each|\*)$/i.test(name)) {
            return "nope. not deleting all your repos. pick one specific name, bruh 💀";
        }
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, { method: 'DELETE', headers: ghHeaders });
            if (res.status === 204) {
                if (getLastRepo(m.sender) === name) repoStateMap.delete(m.sender);
                return `"${name}" is gone forever 💀 done.`;
            }
            const errBody = await res.json().catch(() => ({}));
            if (res.status === 404) return `"${name}" doesn't exist or was already deleted 😒`;
            return `deletion failed — ${errBody.message || 'check the repo name'} 😒`;
        } catch { return 'ran into an error, deletion might not have worked 😒'; }
    }

    async function renameRepo(owner, oldName, newName) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${oldName}`, {
                method: 'PATCH', headers: ghHeaders,
                body: JSON.stringify({ name: newName })
            });
            if (!res.ok) return `rename failed 😒 check names`;
            const r = await res.json();
            setLastRepo(m.sender, newName);
            return `renamed "${oldName}" → "${newName}" — that's done ✅\n\n${r.html_url}`;
        } catch { return 'ran into an error renaming 😒'; }
    }

    async function uploadFile(owner, repo, filePath, content, message) {
        try {
            const encoded = Buffer.from(content).toString('base64');
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
                method: 'PUT', headers: ghHeaders,
                body: JSON.stringify({ message: message || 'Upload via ToxicAI', content: encoded })
            });
            if (!res.ok) return 'upload failed 😒 check the repo and path';
            const r = await res.json();
            setLastRepo(m.sender, repo);
            return `uploaded "${filePath}" to ${repo} — complete ✅\n\n${r.content?.html_url || `https://github.com/${owner}/${repo}/blob/main/${filePath}`}`;
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
        setLastRepo(m.sender, repo);
        return r.content?.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
    }

    async function readFile(owner, repo, filePath) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, { headers: ghHeaders });
            if (!res.ok) return `couldn't find that file 😒`;
            const data = await res.json();
            if (Array.isArray(data)) return `Contents of ${filePath}:\n` + data.map(f => `- ${f.name} (${f.type})`).join('\n');
            if (!data.content) return 'file found but no readable content';
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            setLastRepo(m.sender, repo);
            return content.slice(0, 3000) + (content.length > 3000 ? '\n...(truncated)' : '');
        } catch { return 'ran into an error reading that file 😒'; }
    }

    async function getAuthUser() {
        try {
            const res = await fetch('https://api.github.com/user', { headers: ghHeaders });
            if (!res.ok) return 'something went wrong 😒';
            const u = await res.json();
            return `${u.login} | ${u.name || 'no name set'} | ${u.public_repos} public repos | ${u.followers} followers\n\nhttps://github.com/${u.login}`;
        } catch { return 'ran into an error 😒'; }
    }

    async function getRepoInfo(owner, repo) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
            if (!res.ok) return `repo "${repo}" not found or no access 😒`;
            const r = await res.json();
            setLastRepo(m.sender, r.name);
            return `${r.full_name} — ${r.description || 'no description'}\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count} | ${r.private ? '🔒 private' : '🌐 public'}\nLang: ${r.language || 'unknown'}\n\n${r.html_url}`;
        } catch { return 'ran into an error 😒'; }
    }

    async function listBranches(owner, repo) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers: ghHeaders });
            if (!res.ok) return 'something went wrong 😒';
            const branches = await res.json();
            setLastRepo(m.sender, repo);
            return branches.map(b => `- ${b.name}`).join('\n') || 'no branches found';
        } catch { return 'ran into an error 😒'; }
    }

    async function createIssue(owner, repo, title, bodyText) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                method: 'POST', headers: ghHeaders,
                body: JSON.stringify({ title, body: bodyText || '' })
            });
            if (!res.ok) return 'issue creation failed 😒';
            const r = await res.json();
            setLastRepo(m.sender, repo);
            return `issue created in "${repo}" — done 😤\n\n${r.html_url}`;
        } catch { return 'ran into an error creating the issue 😒'; }
    }

    async function starRepo(owner, repo) {
        try {
            const res = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
                method: 'PUT', headers: { ...ghHeaders, 'Content-Length': '0' }
            });
            if (res.status === 204) {
                setLastRepo(m.sender, repo);
                return `starred "${repo}" ⭐ done, you're welcome.\n\nhttps://github.com/${owner}/${repo}`;
            }
            return 'star failed 😒 check the repo name';
        } catch { return 'ran into an error starring 😒'; }
    }

    let mediaSentDirectly = false;

    async function executeTool(toolName, args) {
        if (toolName === 'generate_image') {
            const prompt = String(args.prompt || body || 'abstract digital art').trim();
            try {
                const imgBuf = await generateImageBuffer(prompt, HF_TOKEN);
                await client.sendMessage(m.chat, {
                    image: imgBuf,
                    caption: boxWrap(`generated image for: "${prompt.slice(0, 120)}" 🎨`, 'TOXICAI IMAGE')
                }, { quoted: m });
                mediaSentDirectly = true;
                return `image generated and sent to chat for "${prompt}"`;
            } catch {
                return 'couldn\'t generate that image right now 😒 try a simpler prompt';
            }
        }

        if (toolName === 'create_file') {
            const rawName = String(args.filename || args.file_name || 'output.txt').trim();
            const safeName = path.basename(rawName) || 'output.txt';
            const fileContent = String(args.content || '');
            try {
                const docBuf = await buildDocumentBuffer(safeName, fileContent);
                const mimetype = getMimeType(safeName);
                await client.sendMessage(m.chat, {
                    document: docBuf,
                    fileName: safeName,
                    mimetype,
                    caption: boxWrap(`created file: ${safeName} 📄`, 'TOXICAI FILE')
                }, { quoted: m });
                mediaSentDirectly = true;
                return `file "${safeName}" created and sent to chat`;
            } catch {
                return `couldn't build "${safeName}" 😒 try again`;
            }
        }

        if (!isDevUser) return 'access denied — GitHub actions are restricted to the bot owner.';
        if (toolName === 'list_repos') return listRepos(args.username || GH_USERNAME);
        if (toolName === 'create_repo') return createRepo(args.name, args.description, args.is_private || args.private);
        if (toolName === 'delete_repo') {
            const repoName = args.name;
            if (!repoName || /^(all|every|each|\*)$/i.test(repoName)) return "not deleting ALL repos. name a specific one 💀";
            return deleteRepo(args.owner || GH_USERNAME, repoName);
        }
        if (toolName === 'rename_repo') return renameRepo(args.owner || GH_USERNAME, args.old_name, args.new_name);
        if (toolName === 'upload_file') return uploadFile(args.owner || GH_USERNAME, args.repo, args.file_path, args.content, args.message);
        if (toolName === 'upload_image_to_github') {
            if (!pendingImageBuf) return 'no image found. quote or send an image first.';
            try {
                const url = await uploadImageToGithub(args.owner || GH_USERNAME, args.repo || 'Toxic-v2', pendingImageBuf, pendingImageExt);
                imageUploadedUrl = url;
                return `image uploaded 📎 link: ${url}`;
            } catch { return 'image upload ran into an error 😒'; }
        }
        if (toolName === 'read_file') return readFile(args.owner || GH_USERNAME, args.repo, args.file_path || args.path);
        if (toolName === 'get_auth_user') return getAuthUser();
        if (toolName === 'get_repo_info') return getRepoInfo(args.owner || GH_USERNAME, args.repo);
        if (toolName === 'list_branches') return listBranches(args.owner || GH_USERNAME, args.repo);
        if (toolName === 'create_issue') return createIssue(args.owner || GH_USERNAME, args.repo, args.title, args.body);
        if (toolName === 'star_repo') return starRepo(args.owner || GH_USERNAME, args.repo);
        return 'unknown action 😒';
    }

    const baseTools = [
        {
            type: 'function',
            function: {
                name: 'generate_image',
                description: 'Generate an image from a text prompt and send it directly to the user in WhatsApp',
                parameters: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'Detailed visual description of the image to generate' }
                    },
                    required: ['prompt']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'create_file',
                description: 'Create or edit a downloadable file (.js, .py, .html, .css, .txt, .json, .csv, .md, .sql, .pdf, .xlsx, .docx) and send it as an attachment in WhatsApp',
                parameters: {
                    type: 'object',
                    properties: {
                        filename: { type: 'string', description: 'Filename with extension, e.g. index.html, script.py, notes.txt, report.pdf' },
                        content: { type: 'string', description: 'Complete content of the file' }
                    },
                    required: ['filename', 'content']
                }
            }
        }
    ];

    const githubTools = [
        { type: 'function', function: { name: 'list_repos', description: 'List GitHub repositories for a user', parameters: { type: 'object', properties: { username: { type: 'string', description: 'GitHub username' } }, required: ['username'] } } },
        { type: 'function', function: { name: 'create_repo', description: 'Create a new GitHub repository', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, is_private: { type: 'boolean' } }, required: ['name'] } } },
        { type: 'function', function: { name: 'delete_repo', description: 'Permanently delete a single named GitHub repository. NEVER call this with "all" or without a specific repo name.', parameters: { type: 'object', properties: { owner: { type: 'string' }, name: { type: 'string', description: 'Exact repo name to delete. Must be a specific name, never "all" or wildcard.' } }, required: ['owner', 'name'] } } },
        { type: 'function', function: { name: 'rename_repo', description: 'Rename a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, old_name: { type: 'string' }, new_name: { type: 'string' } }, required: ['owner', 'old_name', 'new_name'] } } },
        { type: 'function', function: { name: 'upload_file', description: 'Upload or create a text file in a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, file_path: { type: 'string' }, content: { type: 'string' }, message: { type: 'string' } }, required: ['owner', 'repo', 'file_path', 'content'] } } },
        { type: 'function', function: { name: 'upload_image_to_github', description: 'Upload the image sent/quoted by the user to a GitHub repository and return the link', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string', description: 'Which repo to upload to, default Toxic-v2' } }, required: ['repo'] } } },
        { type: 'function', function: { name: 'read_file', description: 'Read/check the content of a specific file in a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, file_path: { type: 'string', description: 'Path to file like src/index.js or README.md' } }, required: ['owner', 'repo', 'file_path'] } } },
        { type: 'function', function: { name: 'get_auth_user', description: 'Get info about the authenticated GitHub user — name, repo count, followers etc.', parameters: { type: 'object', properties: {} } } },
        { type: 'function', function: { name: 'get_repo_info', description: 'Get details about a specific GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] } } },
        { type: 'function', function: { name: 'list_branches', description: 'List branches of a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] } } },
        { type: 'function', function: { name: 'create_issue', description: 'Create an issue in a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } }, required: ['owner', 'repo', 'title'] } } },
        { type: 'function', function: { name: 'star_repo', description: 'Star a GitHub repository', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] } } }
    ];

    const includeGithub = isDevUser && (isGithubIntent(body) || Boolean(pendingImageBuf));
    const activeTools = includeGithub ? [...baseTools, ...githubTools] : baseTools;
    const useTools = true;

    async function callGroq(msgs, enableTools, overrideModel = null) {
        const modelName = overrideModel || (enableTools ? 'openai/gpt-oss-120b' : 'openai/gpt-oss-20b');
        const payload = { model: modelName, messages: msgs, max_tokens: 4096 };
        if (enableTools) {
            payload.tools = activeTools;
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
                if (_markKeyFailed) _markKeyFailed(currentKey);
                const nextKey = _getNextKey ? _getNextKey() : null;
                if (!nextKey || nextKey === currentKey) {
                    if (!overrideModel) {
                        const altModel = modelName === 'openai/gpt-oss-20b' ? 'openai/gpt-oss-120b' : 'openai/gpt-oss-20b';
                        return callGroq(msgs, enableTools, altModel);
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
        const history = getHistory(m.sender);
        const lastRepo = getLastRepo(m.sender);
        let userContent = body || (pendingImageBuf ? 'upload this image to github' : (uploadedDocName ? `analyze this file: ${uploadedDocName}` : 'what can you do?'));
        if (uploadedDocText) {
            const clippedDoc = uploadedDocText.slice(0, 12000);
            userContent += `\n\n[Uploaded File: ${uploadedDocName}]\n\`\`\`\n${clippedDoc}\n\`\`\``;
        }
        const systemPrompt = buildSystemPrompt(lastRepo, isDevUser, Boolean(uploadedDocText));

        let turnMessages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userContent }
        ];
        pushHistory(m.sender, 'user', body || `[File: ${uploadedDocName}]`);

        let finalReply = '';
        let toolsRan = [];

        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
            let res = await callGroq(turnMessages, useTools);

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('[TOXICAI GROQ ERROR]', res.status, JSON.stringify(err));
                const _errMessage = String(err?.error?.message || '');
                if (_errMessage.toLowerCase().includes('tool choice is none')) {
                    res = await callGroq(turnMessages, true, 'openai/gpt-oss-120b');
                }
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const _errCode = err?.error?.code || '';
                if (_errCode === 'tool_use_failed' && err?.error?.failed_generation) {
                    const fg = err.error.failed_generation;
                    const fm = fg.match(/<function=([^=<>\s]+?)=?(\{[\s\S]*?\})<\/function>/);
                    if (fm) {
                        try {
                            const args = JSON.parse(fm[2]);
                            const toolResult = await executeTool(fm[1].trim(), args);
                            toolsRan.push(toolResult);
                            turnMessages.push({ role: 'assistant', content: `[executed ${fm[1]}]` });
                            turnMessages.push({ role: 'user', content: `Tool result: ${toolResult}\nNow give your final short reply.` });
                            continue;
                        } catch {}
                    }
                }
                if (turn === 0) {
                    const _fb = await callGroq([...turnMessages], false, 'openai/gpt-oss-120b').catch(() => null);
                    if (_fb?.ok) {
                        const _fbData = await _fb.json().catch(() => ({}));
                        const _fbContent = _fbData.choices?.[0]?.message?.content?.trim() || '';
                        if (_fbContent) { finalReply = stripEmbeddedFuncTags(_fbContent); break; }
                    }
                }
                const errMsg = err?.error?.message || `HTTP ${res.status}`;
                finalReply = `something went wrong 😒 (${errMsg})`;
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

        if (!finalReply) {
            finalReply = toolsRan.length ? toolsRan.join('\n') : 'something went sideways 🤦';
        }

        if (finalReply && toolsRan.length) {
            for (const _tr of toolsRan) {
                const _ghM = String(_tr).match(/https:\/\/github\.com\/\S+/);
                if (_ghM && !finalReply.includes(_ghM[0])) finalReply += `\n\n${_ghM[0]}`;
            }
        }

        pushHistory(m.sender, 'assistant', finalReply);
        if (!mediaSentDirectly || finalReply) {
            await sendWithTyping(client, m.chat, { text: boxWrap(finalReply, 'TOXICAI') });
        }
        if (imageUploadedUrl) {
            await sendWithTyping(client, m.chat, {
                text: `╭─❏ 「 IMAGE UPLOADED」
│
│ 🔗 ${imageUploadedUrl}
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`
            });
        }
        try { await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }); } catch {}

    } catch (err) {
        console.error('[TOXICAI CRASH]', err);
        try { await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }); } catch {}
        await sendWithTyping(client, m.chat, { text: boxWrap(`ran into an error 🙄 (${err?.message || 'unknown'})`, 'TOXICAI') });
    }
};
