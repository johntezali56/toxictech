import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

const execAsync = promisify(exec);
const REPO = process.env.GITHUB_REPO || 'johntezali56/toxictech';
const fmt = (msg) => `╭─❏ 「 UPDATE 」\n│ ${msg}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

const SKIP = new Set([
    '.git', 'node_modules', '.env', 'Session', 'session.json',
    '.toxic_update', '.toxic_update.zip', '.toxic_version', '.toxic_update_done.json'
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isShouldSkip = (relPath) => {
    if (!relPath) return true;
    const normalized = relPath.replace(/\\/g, '/');
    const top = normalized.split('/')[0];
    if (SKIP.has(top)) return true;
    if (normalized.endsWith('.session')) return true;
    if (top === 'database' && normalized.endsWith('.db')) return true;
    return false;
};

const doRestart = () => {
    const isManagedHost = !!(
        process.env.RENDER ||
        process.env.KOYEB_APP_ID ||
        process.env.RAILWAY_ENVIRONMENT ||
        process.env.P_SERVER_UUID ||
        process.env.SERVER_MEMORY
    );
    setTimeout(async () => {
        if (isManagedHost) {
            process.exit(0);
            return;
        }
        try {
            const { spawn } = await import('child_process');
            const child = spawn(process.execPath, process.argv.slice(1), {
                stdio: 'inherit',
                detached: true
            });
            child.unref();
        } catch {}
        process.exit(0);
    }, 1500);
};

// Post-restart "Done" notifier
(() => {
    const root = process.cwd();
    const markerPath = path.join(root, '.toxic_update_done.json');
    if (!fs.existsSync(markerPath)) return;

    let info = null;
    try {
        info = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        fs.unlinkSync(markerPath);
    } catch {
        try { fs.unlinkSync(markerPath); } catch {}
        return;
    }

    if (!info?.chat) return;

    let attempts = 0;
    const timer = setInterval(async () => {
        attempts++;
        const client = global._toxicCurrentClient || global._toxicSock;
        if (client?.user?.id && typeof client.sendMessage === 'function') {
            clearInterval(timer);
            const lines = [
                '✅ Update Done!',
                ...(info.shortSha ? [`Commit: ${info.shortSha}`] : []),
                ...(typeof info.changed === 'number' ? [`Updated: ${info.changed} file(s)`] : []),
                ...(info.depNote ? [`Deps: ${info.depNote}`] : []),
                'Bot is back online.'
            ];
            setTimeout(() => {
                client.sendMessage(info.chat, { text: fmt(lines.join('\n│ ')) }).catch(() => {});
            }, 2500);
        } else if (attempts >= 40) {
            clearInterval(timer);
        }
    }, 1500);
})();

async function checkUpdates(root, isGit, opts) {
    if (isGit) {
        await execAsync('git remote set-url origin https://github.com/' + REPO + '.git', opts).catch(() => {});
        await execAsync('git fetch origin main', opts);
        const { stdout: localHead } = await execAsync('git rev-parse HEAD', opts);
        const { stdout: remoteHead } = await execAsync('git rev-parse origin/main', opts);
        const localSha = localHead.trim();
        const remoteSha = remoteHead.trim();
        if (localSha === remoteSha) {
            return { upToDate: true, shortSha: remoteSha.slice(0, 7), message: '' };
        }
        const { stdout: logMsg } = await execAsync('git log -1 --pretty=%s origin/main', opts).catch(() => ({ stdout: '' }));
        const { stdout: countOut } = await execAsync('git rev-list --count HEAD..origin/main', opts).catch(() => ({ stdout: '1' }));
        return {
            upToDate: false,
            shortSha: remoteSha.slice(0, 7),
            fullSha: remoteSha,
            ahead: Number(countOut.trim()) || 1,
            message: logMsg.trim().split('\n')[0]
        };
    }

    const apiRes = await axios.get('https://api.github.com/repos/' + REPO + '/commits/main', {
        headers: { 'User-Agent': 'Toxic-MD' },
        timeout: 15000
    });
    const remoteSha = apiRes.data?.sha || '';
    const commitMsg = (apiRes.data?.commit?.message || '').split('\n')[0].trim();
    const verFile = path.join(root, '.toxic_version');
    const localSha = fs.existsSync(verFile) ? fs.readFileSync(verFile, 'utf8').trim() : '';

    if (remoteSha && localSha && remoteSha === localSha) {
        return { upToDate: true, shortSha: remoteSha.slice(0, 7), message: commitMsg };
    }
    return {
        upToDate: false,
        shortSha: remoteSha ? remoteSha.slice(0, 7) : 'latest',
        fullSha: remoteSha,
        ahead: null,
        message: commitMsg
    };
}

async function performGitUpdate(client, m, opts, root) {
    await sendInteractive(client, m, fmt('Fetching latest updates via git...'));
    await execAsync('git remote set-url origin https://github.com/' + REPO + '.git', opts).catch(() => {});
    await execAsync('git fetch origin main', opts);
    const { stdout: ahead } = await execAsync('git rev-list --count HEAD..origin/main', opts).catch(() => ({ stdout: '0' }));
    const count = Number(ahead.trim()) || 0;
    if (count === 0) {
        client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, fmt('Bot is already up to date!'));
    }
    const oldPkg = fs.existsSync(path.join(root, 'package.json')) ? fs.readFileSync(path.join(root, 'package.json'), 'utf8') : '';
    const { stdout: remoteHead } = await execAsync('git rev-parse origin/main', opts).catch(() => ({ stdout: '' }));
    const shortSha = remoteHead.trim().slice(0, 7);

    global._toxicUpdating = true;
    await execAsync('git reset --hard origin/main', opts);
    if (remoteHead.trim()) {
        fs.writeFileSync(path.join(root, '.toxic_version'), remoteHead.trim());
    }

    let depNote = 'deps unchanged';
    const newPkg = fs.existsSync(path.join(root, 'package.json')) ? fs.readFileSync(path.join(root, 'package.json'), 'utf8') : '';
    if (oldPkg !== newPkg) {
        try {
            await execAsync('npm install --omit=optional --no-audit --no-fund', opts);
            depNote = 'deps installed';
        } catch (e) {
            depNote = String(e.message || e).split('\n')[0];
        }
    }

    fs.writeFileSync(path.join(root, '.toxic_update_done.json'), JSON.stringify({
        chat: m.chat,
        shortSha,
        changed: count,
        depNote,
        time: Date.now()
    }));

    client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    await sendInteractive(client, m, fmt(`Updated (${count} commit(s)${shortSha ? ` • ${shortSha}` : ''})\n│ Restarting bot now...`));
    doRestart();
}

async function performIncrementalUpdate(client, m, root, opts) {
    const headers = { 'User-Agent': 'Toxic-MD' };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const apiRes = await axios.get(`https://api.github.com/repos/${REPO}/commits/main`, {
        headers,
        timeout: 15000
    });
    const remoteSha = apiRes.data?.sha || '';
    const shortSha = remoteSha ? remoteSha.slice(0, 7) : '';
    if (!remoteSha) {
        throw new Error('Could not resolve latest commit SHA from GitHub.');
    }

    const verFile = path.join(root, '.toxic_version');
    const localSha = fs.existsSync(verFile) ? fs.readFileSync(verFile, 'utf8').trim() : '';

    if (localSha === remoteSha) {
        client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, fmt(`Bot is already up to date!\n│ Commit: ${shortSha}`));
    }

    // First-time baseline sync: avoids downloading entire repo and triggering file-creation burst limits
    if (!localSha) {
        fs.writeFileSync(verFile, remoteSha);
        client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
        return sendInteractive(
            client,
            m,
            fmt(`Version baseline synced to ${shortSha}.\n│ Future .update now runs will only fetch changed files.`)
        );
    }

    await sendInteractive(client, m, fmt(`Checking changed files (${localSha.slice(0, 7)} → ${shortSha})...`));

    const cmpRes = await axios.get(`https://api.github.com/repos/${REPO}/compare/${localSha}...${remoteSha}`, {
        headers,
        timeout: 20000
    });

    const changedFiles = (cmpRes.data?.files || []).filter((f) => !isShouldSkip(f.filename));

    if (changedFiles.length === 0) {
        fs.writeFileSync(verFile, remoteSha);
        client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, fmt(`Synced to ${shortSha} (no bot files changed).`));
    }

    const oldPkg = fs.existsSync(path.join(root, 'package.json'))
        ? fs.readFileSync(path.join(root, 'package.json'), 'utf8')
        : '';

    global._toxicUpdating = true;
    let updatedCount = 0;

    try {
        for (const file of changedFiles) {
            const targetPath = path.resolve(root, file.filename);
            if (!targetPath.startsWith(root)) continue;

            if (file.status === 'removed') {
                if (fs.existsSync(targetPath)) {
                    fs.rmSync(targetPath, { force: true });
                    updatedCount++;
                }
            } else {
                const rawUrl = file.raw_url || `https://raw.githubusercontent.com/${REPO}/${remoteSha}/${file.filename}`;
                const fileRes = await axios.get(rawUrl, {
                    responseType: 'arraybuffer',
                    headers,
                    timeout: 20000
                });
                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                fs.writeFileSync(targetPath, Buffer.from(fileRes.data));
                updatedCount++;
            }

            // Throttle writes (~8 files/sec) to prevent Katabump high file-creation burst kills
            await sleep(120);
        }

        // Clean up any leftover temp zip/extract artifacts if present
        fs.rmSync(path.join(root, '.toxic_update.zip'), { force: true });
        fs.rmSync(path.join(root, '.toxic_update'), { recursive: true, force: true });

        fs.writeFileSync(verFile, remoteSha);

        let depNote = 'deps unchanged';
        const newPkg = fs.existsSync(path.join(root, 'package.json'))
            ? fs.readFileSync(path.join(root, 'package.json'), 'utf8')
            : '';
        if (oldPkg !== newPkg) {
            try {
                await execAsync('npm install --omit=optional --no-audit --no-fund', opts);
                depNote = 'deps installed';
            } catch (e) {
                depNote = String(e.message || e).split('\n')[0];
            }
        }

        fs.writeFileSync(path.join(root, '.toxic_update_done.json'), JSON.stringify({
            chat: m.chat,
            shortSha,
            changed: updatedCount,
            depNote,
            time: Date.now()
        }));

        client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
        await sendInteractive(
            client,
            m,
            fmt(`Updated ${updatedCount} changed file(s) (${shortSha})\n│ Restarting bot now...`)
        );
        doRestart();
    } catch (err) {
        global._toxicUpdating = false;
        throw err;
    }
}

export default {
    name: 'update',
    aliases: ['botupdate', 'selfupdate', 'checkupdate', 'upd', 'vupdate'],
    description: 'Check for updates or install with .update now',
    run: async (context) => {
        await ownerMiddleware(context, async () => {
            const { client, m, args } = context;
            const root = process.cwd();
            const opts = { cwd: root, timeout: 300000, maxBuffer: 1024 * 1024 * 20 };
            const sub = (args?.[0] || '').toLowerCase().trim();
            const confirmNow = ['now', 'install', 'confirm', 'yes', 'force', '-y'].includes(sub);

            client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});

            const isKatabump = !!(process.env.P_SERVER_UUID || process.env.SERVER_MEMORY);
            let isGit = false;
            if (!isKatabump) {
                try {
                    await execAsync('git rev-parse --is-inside-work-tree', opts);
                    isGit = true;
                } catch {}
            }

            try {
                if (!confirmNow) {
                    await sendInteractive(client, m, fmt('Checking for latest commit...'));
                    const status = await checkUpdates(root, isGit && !isKatabump, opts);
                    if (status.upToDate) {
                        client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
                        return sendInteractive(client, m, fmt(`Bot is already up to date!\n│ Commit: ${status.shortSha}`));
                    }
                    client.sendMessage(m.chat, { react: { text: '🆕', key: m.reactKey } }).catch(() => {});
                    const details = [
                        'Update available!',
                        `Latest: ${status.shortSha}${status.ahead ? ` (${status.ahead} commit(s) behind)` : ''}`,
                        ...(status.message ? [`Note: ${status.message}`] : []),
                        'Type .update now to install.'
                    ];
                    return sendInteractive(client, m, fmt(details.join('\n│ ')));
                }

                if (isGit && !isKatabump) {
                    return await performGitUpdate(client, m, opts, root);
                }
                return await performIncrementalUpdate(client, m, root, opts);
            } catch (err) {
                global._toxicUpdating = false;
                client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt('Update failed: ' + String(err?.message || err).split('\n')[0]));
            }
        });
    }
};
