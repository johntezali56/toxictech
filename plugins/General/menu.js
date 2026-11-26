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
    name: 'menu',
    aliases: ['commands', 'list', 'cmds', 'm', 'cmd', 'commandlist', 'allcmds'],
    description: 'Displays the Toxic-MD command menu',
    run: async (context) => {
        const { client, m, mode, botname, prefix, pict } = context;

        client.sendMessage(m.chat, { react: { text: '🤖', key: m.key } }).catch(() => {});

        const effectivePrefix = prefix || '.';
        const bodyText = m.body || m.text || '';
        const cleanText = bodyText.trimStart().slice(effectivePrefix.length).trimStart();
        const firstWord = cleanText.split(' ')[0].toLowerCase();

        if (cleanText !== '' && !['menu', 'commands', 'list', 'cmds', 'm', 'help', 'cmd', 'commandlist', 'allcmds'].includes(firstWord)) {
            const commandName = cleanText.split(' ')[0];
            return client.sendMessage(m.chat, {
                text:
                    `╭━━━〔 ⚡ *𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮* ⚡ 〕━━━╮\n` +
                    `┃ 🔮 Invalid option after "${commandName}".\n` +
                    `┃ ✨ Type *${effectivePrefix}menu* to open the menu.\n` +
                    `╰━━━━━━━━━━━━━━━━━━╯`
            });
        }

        const greeting = getTimeGreeting();
        const repoUrl = 'https://github.com/johntezali56/toxictech';
        const menuText =
            `╭━━━〔 ⚡ *𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮* ⚡ 〕━━━╮\n` +
            `┃ 🔮 ${greeting}, @${m.sender.split('@')[0].split(':')[0]}\n` +
            `┃ 💎 *Bot:* ${botname || '𝑇𝛩𝛸𝛪𝐶-𝚳D'}\n` +
            `┃ 🛠️ *Prefix:* ${effectivePrefix} | *Mode:* ${mode || 'private'}\n` +
            `💠────────────────💠\n` +
            `┃ ✨ *QUICK COMMANDS*\n` +
            `┃ ▸ ${effectivePrefix}fullmenu — All commands\n` +
            `┃ ▸ ${effectivePrefix}owner — Owner contact\n` +
            `┃ ▸ ${effectivePrefix}ping — Bot speed\n` +
            `┃ ▸ ${effectivePrefix}settings — Configuration\n` +
            `┃ ▸ ${effectivePrefix}uptime — System uptime\n` +
            `💠────────────────💠\n` +
            `┃ 🔮 *CATEGORIES*\n` +
            `┃ ▸ ${effectivePrefix}generalmenu  ▸ ${effectivePrefix}settingsmenu\n` +
            `┃ ▸ ${effectivePrefix}ownermenu    ▸ ${effectivePrefix}groupmenu\n` +
            `┃ ▸ ${effectivePrefix}aimenu       ▸ ${effectivePrefix}downloadmenu\n` +
            `┃ ▸ ${effectivePrefix}editingmenu  ▸ ${effectivePrefix}effectsmenu\n` +
            `┃ ▸ ${effectivePrefix}utilsmenu    ▸ ${effectivePrefix}privacymenu\n` +
            `┃ ▸ ${effectivePrefix}animemenu    ▸ ${effectivePrefix}reactionsmenu\n` +
            `┃ ▸ ${effectivePrefix}nsfwmenu\n` +
            `╰━━━━━━━━━━━━━━━━━━╯\n` +
            `> © *𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮*\n` +
            `🔗 ${repoUrl}`;

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
