import { getGroupSettings, addWarn, resetWarn, getWarnLimit, getBadWords } from '../database/config.js';
import { getGroupContext } from '../lib/lidResolver.js';

const DEV_NUMBER = '254716637803';

const _num = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const isDevJid = (jid) => _num(jid) === DEV_NUMBER;

const fmt = (msg) => `╭─❏ 「 ANTIBADWORD 」\n│ ${msg}\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

const DEFAULT_BAD_WORDS = [
    'fuck', 'fucking', 'fucker', 'motherfucker', 'asshole', 'bitch', 'bastard',
    'dick', 'pussy', 'cunt', 'nigger', 'nigga', 'whore', 'slut', 'faggot', 'retard'
];

function containsBadWord(text, words) {
    const lower = (text || '').toLowerCase();
    for (const w of words) {
        if (!w) continue;
        const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(lower)) return w;
    }
    return null;
}

export default async (client, m) => {
    try {
        if (!m || !m.chat || !m.chat.endsWith('@g.us')) return;
        if (m.key?.fromMe) return;
        if (isDevJid(m.sender)) return;

        const groupSettings = await getGroupSettings(m.chat);
        const mode = (groupSettings.antibadword || 'off').toLowerCase();
        if (mode === 'off') return;

        const msg = m.message || {};
        const text = m.text || msg.conversation || msg.extendedTextMessage?.text ||
            msg.imageMessage?.caption || msg.videoMessage?.caption ||
            msg.documentMessage?.caption || '';
        if (!text) return;

        const customWords = await getBadWords(m.chat);
        const words = [...DEFAULT_BAD_WORDS, ...customWords];
        const matched = containsBadWord(text, words);
        if (!matched) return;

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
                text: fmt(`@${username} used a bad word.\nMake me admin so I can actually do something about it. 😤`),
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

        if (mode === 'delete') {
            return;
        }

        if (mode === 'kick') {
            try {
                await client.groupParticipantsUpdate(m.chat, [senderActionJid], 'remove');
                await client.sendMessage(m.chat, {
                    text: fmt(`🚨 @${username} KICKED!\n│ Reason: 🤬 Bad language\n│ Kick mode — zero tolerance. 😈`),
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
                text: fmt(`🚨 @${username} KICKED!\n│ Reason: 🤬 Bad language\n│ Warns: ${newCount}/${MAX_WARNS}\n│ That's it. Get out. 😈\n│ Warn count wiped clean.`),
                mentions
            });
            return;
        }

        await client.sendMessage(m.chat, {
            text: fmt(`⚠️ @${username}, warned!\n│ Reason: 🤬 Bad language\n│ Message deleted.\n│ Warns: ${newCount}/${MAX_WARNS}\n│ ${remaining} more and you're GONE. 😈`),
            mentions
        });
    } catch (err) {
        console.error('[ANTIBADWORD] Error:', err.message);
    }
};
