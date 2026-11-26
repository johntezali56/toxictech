import fs from 'fs';
import path from 'path';
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
        // 1. Wait 4 seconds for Signal keys & LID sessions to finish syncing
        await new Promise((resolve) => setTimeout(resolve, 4000));

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

        // 2. Clean the JID (strip device suffix like :14)
        const rawId = sock.user?.id || '';
        if (!rawId) return;
        const botJid = rawId.includes(':')
            ? `${rawId.split(':')[0]}@s.whatsapp.net`
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

        const imgPaths = [
            path.join(process.cwd(), 'toxic.jpg'),
            path.join('toxic.jpg')
        ];
        const validImgPath = imgPaths.find((p) => fs.existsSync(p));
        const imgBuffer = validImgPath ? fs.readFileSync(validImgPath) : null;

        // 3. Send standard image/text instead of interactive nativeFlowMessage
        // (nativeFlowMessage fails decryption in WhatsApp self-chats)
        if (imgBuffer) {
            await sock.sendMessage(botJid, {
                image: imgBuffer,
                caption
            });
        } else {
            await sock.sendMessage(botJid, { text: caption });
        }
    } catch (err) {
        console.error('Error sending boot message:', err.message);
    }
}
