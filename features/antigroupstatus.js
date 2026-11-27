import { getGroupSettings, addWarn, resetWarn, getWarnLimit } from '../database/config.js';
import { getGroupContext } from '../lib/lidResolver.js';

const DEV_NUMBER = '254716637803';

const _num = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const isDevJid = (jid) => _num(jid) === DEV_NUMBER;

const fmt = (msg) => `╭─❏ 「 ANTIGROUPSTATUS 」\n│ ${msg}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

function isGroupStatusMessage(msg) {
    if (!msg) return false;
    const candidates = [
        msg.extendedTextMessage, msg.imageMessage, msg.videoMessage,
        msg.documentMessage, msg.audioMessage, msg.stickerMessage
    ];
    for (const c of candidates) {
        if (c?.contextInfo?.isGroupStatus === true) return true;
    }
    return msg.contextInfo?.isGroupStatus === true;
}

export default async (client, m) => {
    try {
        if (!m || !m.chat || !m.chat.endsWith('@g.us')) return;
        if (m.key?.fromMe) return;
        if (isDevJid(m.sender)) return;

        const groupSettings = await getGroupSettings(m.chat);
        const mode = (groupSettings.antigroupstatus || 'off').toLowerCase();
        if (mode === 'off') return;

        if (!isGroupStatusMessage(m.message)) return;

        const groupMetadata = await client.groupMetadata(m.chat);
        const {
            isBotAdmin,
            isSenderAdmin,
            senderActionJid,
            senderDisplayJid
        } = getGroupContext(client, m.chat, m.sender, groupMetadata.participants);

        if (!senderActionJid) return;
        if (isSenderAdmin) return;

        const username = _num(senderDisplayJid) || senderActionJid.split('@')[0];
        const mentions = [...new Set([senderActionJid, senderDisplayJid])];

        if (!isBotAdmin) {
            await client.sendMessage(m.chat, {
                text: fmt(`@${username} posted a group status.\nMake me admin so I can actually do something about it. 😤`),
                mentions
            });
            return;
        }

        try {
            await client.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    fromMe: false,
                    id: m.key.id,
                    participant: m.key.participant || senderActionJid
                }
            });
        } catch {}

        if (mode === 'delete' || mode === 'on') {
            await client.sendMessage(m.chat, {
                text: fmt(`🚫 @${username}, group status posts are not allowed here.\n│ Message deleted.`),
                mentions
            });
            return;
        }

        if (mode === 'kick') {
            try {
                await client.groupParticipantsUpdate(m.chat, [senderActionJid], 'remove');
                await client.sendMessage(m.chat, {
                    text: fmt(`🚨 @${username} KICKED!\n│ Reason: group status posts are not allowed here\n│ Kick mode — admins only. 😈`),
                    mentions
                });
            } catch {}
            return;
        }

        const MAX_WARNS = await getWarnLimit(m.chat);
        const newCount = await addWarn(m.chat, username);
        const remaining = MAX_WARNS - newCount;

        if (newCount >= MAX_WARNS) {
            await resetWarn(m.chat, username);
            try { await client.groupParticipantsUpdate(m.chat, [senderActionJid], 'remove'); } catch {}
            await client.sendMessage(m.chat, {
                text: fmt(`🚨 @${username} KICKED!\n│ Reason: group status posts are not allowed here\n│ Warns: ${newCount}/${MAX_WARNS}\n│ That's it. Get out. 😈\n│ Warn count wiped clean.`),
                mentions
            });
            return;
        }

        await client.sendMessage(m.chat, {
            text: fmt(`⚠️ @${username}, warned!\n│ Reason: group status posts are not allowed here\n│ Message deleted.\n│ Warns: ${newCount}/${MAX_WARNS}\n│ ${remaining} more and you're GONE. 😈`),
            mentions
        });
    } catch (err) {
        console.error('[ANTIGROUPSTATUS] Error:', err.message);
    }
};
