import { getCachedSettings } from '../lib/settingsCache.js';
import { botname } from '../config/settings.js';
import * as commandHandler from './commandHandler.js';

let bootMessageSent = false;

export default async function connectionHandler(sock, update, store) {
    const { connection } = update;
    if (connection !== 'open') return;
    if (bootMessageSent) return;
    bootMessageSent = true;

    try {
        await new Promise((resolve) => setTimeout(resolve, 6000));

        const settings = await getCachedSettings().catch(() => ({}));
        const mode = (settings?.mode || 'public').toLowerCase();
        const prefix = settings?.prefix || '.';

        const commandsObj = commandHandler.commands || commandHandler.default || {};
        const totalCommands = typeof commandsObj.size === 'number'
            ? commandsObj.size
            : Array.isArray(commandsObj)
                ? commandsObj.length
                : Object.keys(commandsObj).length;

        const timeNow = new Date().toLocaleTimeString('en-US', {
            timeZone: 'Africa/Nairobi',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Use LID JID first for WhatsApp Multi-Device self-chat ("Message yourself")
        // so Signal decryption succeeds immediately on fresh server restarts
        const rawLid = sock.user?.lid || '';
        const rawId = sock.user?.id || '';
        if (!rawId && !rawLid) return;

        const botJid = rawLid
            ? `${rawLid.split(':')[0].split('@')[0]}@lid`
            : sock.decodeJid(rawId);

        const caption = `╭───〔 *${botname || 'Toxic-MD'}* 〕───
│
│ ❏ *Connected:* ${botname || 'Toxic-MD'} (${mode === 'private' ? 'Private' : 'Public'} Mode)
│
│ ✨ *Bot Name:* ${botname || 'Toxic-MD'}
│ ⚙️ *Mode:* ${mode}
│ ➡️ *Prefix:* ${prefix}
│ 📦 *Commands:* ${totalCommands || 387}
│ 🕒 *Time:* ${timeNow}
│
╰───────────────────
_Type *${prefix}menu* to view all commands._`;

        await sock.sendMessage(botJid, { text: caption });
    } catch (err) {
        console.error('Error sending boot message:', err.message);
    }
}
