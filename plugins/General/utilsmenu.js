import fs from 'fs';
import { getGreeting } from '../../lib/language.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getToxicImage(pict) {
    if (pict && Buffer.isBuffer(pict) && pict.length > 0) return pict;
    const candidates = [
        path.join(process.cwd(), 'toxic.jpg'),
        path.join(process.cwd(), 'media', 'toxic.jpg'),
        path.join(process.cwd(), 'lib', 'toxic.jpg'),
        path.join(process.cwd(), 'assets', 'toxic.jpg'),
        path.join(__dirname, '../../toxic.jpg'),
        path.join(__dirname, '../../media/toxic.jpg'),
        path.join(__dirname, '../../lib/toxic.jpg'),
        path.join(__dirname, '../../assets/toxic.jpg')
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) return fs.readFileSync(p);
        } catch {}
    }
    return null;
}

const getTimeGreeting = () => {
    try { return getGreeting(); } catch {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Good morning';
        if (hour >= 12 && hour < 17) return 'Good afternoon';
        if (hour >= 17 && hour < 21) return 'Good evening';
        return 'Good night';
    }
};

export default {
    name: 'utilsmenu',
    aliases: ['utilmenu', 'toolsmenu'],
    description: 'Displays the UTILS category commands',
    run: async (context) => {
        const { client, m, mode, botname, prefix, pict } = context;

        client.sendMessage(m.chat, { react: { text: '🔧', key: m.key } }).catch(() => {});

        const effectivePrefix = prefix || '.';
        const greeting = getTimeGreeting();
        const userTag = m.sender.split('@')[0].split(':')[0];
        const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const categoryDir = path.join(__dirname, '..', 'Utils');
        let commands = [];
        try {
            if (fs.existsSync(categoryDir)) {
                commands = fs.readdirSync(categoryDir)
                    .filter(f => f.endsWith('.js'))
                    .map(f => f.replace(/\.js$/i, ''))
                    .sort();
            }
        } catch {}

        const cmdLines = commands.length > 0
            ? commands.map(c => `│ ◈ ${effectivePrefix}${c}`).join('\n')
            : '│ ◈ No commands found';

        const menuText =
            `┌── ( 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮 ) ──┐\n` +
            `│ Greetings, @${userTag}\n` +
            `│ Bot: ${botname || 'Toxic-MD'}\n` +
            `│ Total Commands: ${commands.length}\n` +
            `│ Time: ${nowTime}\n` +
            `│ Prefix: ${effectivePrefix}\n` +
            `│ Mode: ${mode || 'Public'}\n` +
            `│ Library: Baileys\n` +
            `└────────────────────┘\n\n` +
            `┌──『 🔧 UTILS 』\n` +
            `${cmdLines}\n` +
            `└────────────────────`;

        const imgBuffer = getToxicImage(pict);
        if (imgBuffer) {
            await client.sendMessage(m.chat, {
                image: imgBuffer,
                caption: menuText,
                mentions: [m.sender]
            });
        } else {
            await client.sendMessage(m.chat, {
                text: menuText,
                mentions: [m.sender]
            });
        }
    }
};
