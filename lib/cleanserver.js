import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';
import fs from 'fs';
import path from 'path';

const fmt = (msg) => `╭─❏ 「 SERVER CLEANUP 」\n│ ${msg}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

const TEMP_EXTENSIONS = new Set([
    '.tmp', '.temp', '.log', '.bak', '.old', '.cache',
    '.mp4', '.mp3', '.webp', '.jpg', '.jpeg', '.png', '.gif', '.opus', '.ogg', '.wav'
]);

const PROTECTED_ROOT_FILES = new Set([
    'toxic.jpg', 'package.json', 'package-lock.json', '.env', '.env.example',
    'session.json', 'creds.json', 'store.json', 'baileys_store.json'
]);

const TEMP_DIRS = ['temp', 'tmp', '.cache', '.toxic_update', 'downloads', 'trash'];

const SESSION_KEEP_PREFIXES = [
    '.gitkeep', 'creds.json', 'app-state-sync-version-', 'app-state-sync-key-'
];

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

function cleanDirectoryContents(dirPath, maxAgeMs = 0) {
    let filesDeleted = 0;
    let bytesFreed = 0;
    if (!fs.existsSync(dirPath)) return { filesDeleted, bytesFreed };

    const now = Date.now();
    for (const entry of fs.readdirSync(dirPath)) {
        if (entry === '.gitkeep') continue;
        const fullPath = path.join(dirPath, entry);
        try {
            const stat = fs.statSync(fullPath);
            if (maxAgeMs > 0 && (now - stat.mtimeMs) < maxAgeMs) continue;

            if (stat.isDirectory()) {
                const sub = cleanDirectoryContents(fullPath, 0);
                filesDeleted += sub.filesDeleted;
                bytesFreed += sub.bytesFreed;
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                bytesFreed += stat.size;
                fs.unlinkSync(fullPath);
                filesDeleted++;
            }
        } catch {}
    }
    return { filesDeleted, bytesFreed };
}

export default {
    name: 'cleanserver',
    aliases: ['cleanup', 'clearfiles', 'cleartemp', 'cleanjunk', 'freespace'],
    description: 'Remove temporary media, logs, update leftovers, and stale session cache files on the server',
    run: async (context) => {
        await ownerMiddleware(context, async () => {
            const { client, m } = context;
            const root = process.cwd();

            client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});

            let totalFiles = 0;
            let totalBytes = 0;

            try {
                // 1. Clean temporary folders (temp, tmp, .cache, .toxic_update, downloads, trash)
                for (const dirName of TEMP_DIRS) {
                    const dirPath = path.join(root, dirName);
                    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                        const res = cleanDirectoryContents(dirPath, 0);
                        totalFiles += res.filesDeleted;
                        totalBytes += res.bytesFreed;
                        if (dirName === '.toxic_update') {
                            fs.rmSync(dirPath, { recursive: true, force: true });
                        }
                    }
                }

                // 2. Clean leftover root temp media, logs, and update zip files
                for (const entry of fs.readdirSync(root)) {
                    if (PROTECTED_ROOT_FILES.has(entry.toLowerCase())) continue;
                    const fullPath = path.join(root, entry);
                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory()) continue;

                        const ext = path.extname(entry).toLowerCase();
                        const isUpdateZip = entry === '.toxic_update.zip' || entry.endsWith('_update.zip');
                        const isNpmLog = entry.startsWith('npm-debug.log') || entry.startsWith('yarn-error.log');

                        if (TEMP_EXTENSIONS.has(ext) || isUpdateZip || isNpmLog) {
                            totalBytes += stat.size;
                            fs.unlinkSync(fullPath);
                            totalFiles++;
                        }
                    } catch {}
                }

                // 3. Clean stale Baileys sender-key/pre-key session files older than 2 hours (protects creds.json & app-state)
                for (const sessFolder of ['Session', 'session', 'auth']) {
                    const sessDir = path.join(root, sessFolder);
                    if (!fs.existsSync(sessDir) || !fs.statSync(sessDir).isDirectory()) continue;

                    const now = Date.now();
                    const twoHoursMs = 2 * 60 * 60 * 1000;

                    for (const file of fs.readdirSync(sessDir)) {
                        const shouldKeep = SESSION_KEEP_PREFIXES.some((p) =>
                            p.endsWith('-') ? file.startsWith(p) : file === p
                        );
                        if (shouldKeep) continue;

                        const filePath = path.join(sessDir, file);
                        try {
                            const stat = fs.statSync(filePath);
                            if (!stat.isDirectory() && (now - stat.mtimeMs) > twoHoursMs) {
                                totalBytes += stat.size;
                                fs.unlinkSync(filePath);
                                totalFiles++;
                            }
                        } catch {}
                    }
                }

                if (global.gc) {
                    try { global.gc(); } catch {}
                }

                client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
                return sendInteractive(
                    client,
                    m,
                    fmt(
                        `Cleanup complete!\n` +
                        `│ Files removed: ${totalFiles}\n` +
                        `│ Space freed: ${formatBytes(totalBytes)}`
                    )
                );
            } catch (e) {
                client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt('Cleanup error: ' + String(e?.message || e).split('\n')[0]));
            }
        });
    }
};
