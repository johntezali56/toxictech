import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import fs from 'fs';
import path from 'path';

async function authenticationn() {
    try {
        const sessionDir = path.join(__dirname, '..', 'Session');
        const credsPath = path.join(sessionDir, 'creds.json');
        const markerPath = path.join(sessionDir, '.session_hash');
        const sessionFilePath = path.join(sessionDir, '..', 'session.json');

        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        let sessionData = process.env.SESSION || '';

        if (!sessionData || sessionData === 'zokk') {
            if (fs.existsSync(sessionFilePath)) {
                const fileContent = fs.readFileSync(sessionFilePath, 'utf8').trim();
                if (fileContent && fileContent !== 'zokk') {
                    try {
                        const parsed = JSON.parse(fileContent);
                        const sid = parsed.SESSION_ID || parsed.session || parsed.SESSION || '';
                        if (sid && sid !== 'PASTE_YOUR_SESSION_ID_HERE') {
                            sessionData = sid;
                        }
                    } catch {
                        sessionData = fileContent;
                    }
                }
            }
        }

        if (!sessionData || sessionData === 'zokk') {
            if (fs.existsSync(credsPath)) {
                console.log('✅ Using existing local Session/creds.json');
                return;
            }
            console.log('⚠️ No session detected! — set SESSION env or paste your session ID in session.json');
            return;
        }

        if (sessionData === 'PASTE_YOUR_SESSION_ID_HERE') {
            console.log('❌ Wrong session! — placeholder value detected, paste a real session ID');
            return;
        }

        let decoded;
        try {
            decoded = Buffer.from(sessionData, 'base64').toString('utf8');
            JSON.parse(decoded);
        } catch {
            console.log('❌ Wrong session! — session data is corrupted or not valid base64 JSON');
            return;
        }

        // Only write creds.json if it doesn't exist yet OR if SESSION env/file actually changed
        const previousHash = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8').trim() : '';
        if (fs.existsSync(credsPath) && previousHash === sessionData.trim()) {
            console.log('✅ Active session preserved (skipping overwrite)');
            return;
        }

        // If a brand-new SESSION ID was provided, clear stale Signal keys so they don't clash
        if (previousHash && previousHash !== sessionData.trim()) {
            for (const f of fs.readdirSync(sessionDir)) {
                if (f !== '.gitkeep') {
                    try { fs.unlinkSync(path.join(sessionDir, f)); } catch {}
                }
            }
        }

        fs.writeFileSync(credsPath, decoded, 'utf8');
        fs.writeFileSync(markerPath, sessionData.trim(), 'utf8');
        console.log('✅ Session Successfully loaded');
    } catch (e) {
        console.log('❌ Wrong session — ' + e.message);
        return;
    }
}

export default authenticationn;
