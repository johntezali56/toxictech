import fs from 'fs';
import readline from 'readline';

if (!fs.existsSync('.env') && fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ Created .env from .env.example');
}

const envText = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const hasEnvSession = /^SESSION_ID\s*=\s*\S+/m.test(envText);
const hasCredsFile = fs.existsSync('./Session/creds.json') || fs.existsSync('./session.json');

if (!hasEnvSession && !hasCredsFile && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((res) => rl.question(q, res));

    console.log('\n╭─❏ 「 TOXIC-MD WHATSAPP LINKING 」');
    const num = (await ask('│ Enter your WhatsApp number (e.g. 254716637803): ')).replace(/[^0-9]/g, '');
    const sid = (await ask('│ Paste SESSION_ID (or press Enter to get Pairing Code): ')).trim();
    rl.close();

    if (fs.existsSync('.env')) {
        let updated = envText;
        if (num) {
            updated = /^OWNER_NUMBER=/m.test(updated)
                ? updated.replace(/^OWNER_NUMBER=.*/m, `OWNER_NUMBER=${num}`)
                : updated + `\nOWNER_NUMBER=${num}\n`;
        }
        if (sid) {
            updated = /^SESSION_ID=/m.test(updated)
                ? updated.replace(/^SESSION_ID=.*/m, `SESSION_ID=${sid}`)
                : updated + `\nSESSION_ID=${sid}\n`;
        }
        fs.writeFileSync('.env', updated);
        console.log('╰─❏ ✅ Saved to .env!\n');
    }

    if (!sid && num.length >= 9) {
        const baileys = await import('@whiskeysockets/baileys');
        const makeWASocket = baileys.default || baileys.makeWASocket;
        const { useMultiFileAuthState, Browsers } = baileys;
        const pino = (await import('pino')).default;

        fs.mkdirSync('./Session', { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState('./Session');

        if (!state.creds.registered) {
            console.log('⏳ Generating WhatsApp Pairing Code...');
            await new Promise((resolve, reject) => {
                const sock = makeWASocket({
                    auth: state,
                    logger: pino({ level: 'silent' }),
                    printQRInTerminal: false,
                    browser: Browsers.ubuntu('Chrome')
                });

                sock.ev.on('creds.update', saveCreds);

                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(num);
                        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                        console.log(`\n🔑 Your Pairing Code: ${formatted}`);
                        console.log('👉 Open WhatsApp > Linked Devices > Link with Phone Number\n');
                    } catch (err) {
                        reject(err);
                    }
                }, 3000);

                sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
                    if (connection === 'open') {
                        await saveCreds();
                        console.log('✅ WhatsApp Linked & Session Saved! Launching Toxic-MD...\n');
                        try { sock.ws?.close(); } catch {}
                        setTimeout(resolve, 1500);
                    } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode === 401) {
                        reject(new Error('Pairing failed or logged out. Restart to try again.'));
                    }
                });
            });
        }
    }
}

await import('./index.js');
