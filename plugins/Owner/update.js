import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { herokuAppName, getHerokuApiKey } from '../../config/settings.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const fmt = (msg) => `╭─❏ 「 UPDATE」\n│ ${msg}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;
const REPO = (process.env.GITHUB_REPO || 'johntezali56/toxictech').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
const SKIP = new Set(['.git', 'node_modules', '.env', 'config.env', 'session.json', 'creds.json', 'auth', 'Session', 'session', 'whatsasena.json', 'store.json', 'keys.js']);

const doRestart = () => {
    setTimeout(async () => {
        const isCloudPaaS = !!(process.env.RENDER || process.env.KOYEB_APP_ID || process.env.RAILWAY_ENVIRONMENT);
        if (isCloudPaaS) {
            process.exit(0);
            return;
        }
        const { spawn } = await import('child_process');
        const child = spawn(process.execPath, process.argv.slice(1), {
            stdio: 'inherit',
            detached: true
        });
        child.unref();
        process.exit(0);
    }, 1500);
};

async function performGitUpdate(client, m, opts, root) {
    await sendInteractive(client, m, fmt('Git repo — pulling latest code...'));
    let branch = 'main';
    try {
        const r = await execAsync('git rev-parse --abbrev-ref HEAD', opts);
        if (r.stdout?.trim() && r.stdout.trim() !== 'HEAD') branch = r.stdout.trim();
    } catch {}
    await execAsync('git remote set-url origin https://github.com/' + REPO + '.git', opts).catch(() => {});
    const oldPkg = fs.existsSync(path.join(root, 'package.json')) ? fs.readFileSync(path.join(root, 'package.json'), 'utf8') : '';
    await execAsync('git fetch --depth 1 origin ' + branch, opts);
    await execAsync('git reset --hard origin/' + branch, opts);
    const { stdout: head } = await execAsync('git rev-parse --short HEAD', opts);
    let depNote = 'deps unchanged';
    const newPkg = fs.existsSync(path.join(root, 'package.json')) ? fs.readFileSync(path.join(root, 'package.json'), 'utf8') : '';
    if (oldPkg !== newPkg) {
        try {
            await execAsync('npm install --omit=optional --no-audit --no-fund', opts);
            depNote = 'deps installed';
        } catch (e) { depNote = String(e.message || e).split('\n')[0]; }
    }
    client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    await sendInteractive(client, m, fmt('Updated to ' + head.trim() + '\n│ ' + depNote + '\n│ Restarting...'));
    doRestart();
}

async function performHerokuUpdate(client, m, apiKey, appName) {
    await sendInteractive(client, m, fmt('Heroku — triggering rebuild on ' + appName + '...'));
    await axios.post('https://api.heroku.com/apps/' + appName + '/builds',
        { source_blob: { url: 'https://github.com/' + REPO + '/tarball/main' } },
        { headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/vnd.heroku+json; version=3', 'Content-Type': 'application/json' }, timeout: 60000 });
    client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, fmt('Rebuild triggered for ' + appName + '.\n│ Bot restarts after build completes.'));
}

async function performZipUpdate(client, m, opts, root) {
    let AdmZip;
    try { AdmZip = (await import('adm-zip')).default; } catch { return sendInteractive(client, m, fmt('adm-zip missing. Run npm install.')); }
    await sendInteractive(client, m, fmt('Downloading latest from GitHub...'));
    const zipPath = path.join(root, '.toxic_update.zip');
    const exRoot  = path.join(root, '.toxic_update');
    const res = await axios.get('https://github.com/' + REPO + '/archive/refs/heads/main.zip', {
        responseType: 'arraybuffer', timeout: 120000, maxContentLength: Infinity, maxBodyLength: Infinity,
        headers: { 'User-Agent': 'Toxic-MD' }
    });
    fs.writeFileSync(zipPath, Buffer.from(res.data));
    fs.rmSync(exRoot, { recursive: true, force: true });
    new AdmZip(zipPath).extractAllTo(exRoot, true);
    const repoName = REPO.split('/').pop();
    let srcDir = path.join(exRoot, repoName + '-main');
    if (!fs.existsSync(srcDir)) {
        const dirs = fs.readdirSync(exRoot).map(d => path.join(exRoot, d)).filter(p => fs.statSync(p).isDirectory());
        if (dirs.length) srcDir = dirs[0];
    }
    const oldPkg = fs.existsSync(path.join(root, 'package.json')) ? fs.readFileSync(path.join(root, 'package.json'), 'utf8') : '';
    fs.cpSync(srcDir, root, {
        recursive: true, force: true,
        filter: (src) => {
            const rel = path.relative(srcDir, src);
            if (!rel) return true;
            const top = rel.split(path.sep)[0];
            if (SKIP.has(top)) return false;
            if (rel.endsWith('.session')) return false;
            if (top === 'database' && rel.endsWith('.db')) return false;
            return true;
        }
    });
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(exRoot, { recursive: true, force: true });
    let depNote = 'deps unchanged';
    const newPkg = fs.existsSync(path.join(root, 'package.json')) ? fs.readFileSync(path.join(root, 'package.json'), 'utf8') : '';
    if (oldPkg !== newPkg) {
        try {
            await execAsync('npm install --omit=optional --no-audit --no-fund', opts);
            depNote = 'deps installed';
        } catch (e) { depNote = String(e.message || e).split('\n')[0]; }
    }
    client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    await sendInteractive(client, m, fmt('Updated from zip.\n│ ' + depNote + '\n│ Restarting...'));
    doRestart();
}

export default {
    name: 'update',
    aliases: ['botupdate', 'selfupdate', 'checkupdate', 'upd', 'vupdate'],
    description: 'Update bot — auto-detects Heroku / KataBump / git / zip method',
    run: async (context) => {
        await ownerMiddleware(context, async () => {
            const { client, m } = context;
            const root = process.cwd();
            const opts = { cwd: root, timeout: 300000, maxBuffer: 1024 * 1024 * 20 };
            client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});
            const isHeroku = !!(process.env.DYNO || process.env.HEROKU);
            const isKatabump = !!(process.env.P_SERVER_UUID || process.env.SERVER_MEMORY);
            let isGit = false;
            if (!isKatabump) {
                try { await execAsync('git rev-parse --is-inside-work-tree', opts); isGit = true; } catch {}
            }
            try {
                if (isHeroku) {
                    const apiKey = getHerokuApiKey();
                    const appName = herokuAppName;
                    if (!apiKey || !appName) {
                        client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                        return sendInteractive(client, m, fmt('Set HEROKU_API_KEY and HEROKU_APP_NAME first.'));
                    }
                    return await performHerokuUpdate(client, m, apiKey, appName);
                }
                if (isGit && !isKatabump) return await performGitUpdate(client, m, opts, root);
                return await performZipUpdate(client, m, opts, root);
            } catch (e) {
                client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt('Update failed: ' + String(e?.response?.data?.message || e?.message || e).split('\n')[0]));
            }
        });
    }
};
