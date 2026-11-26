import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

const fmt = (msg) => `╭─❏ 「 CLEAR CHAT 」\n│ ${msg}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

export default {
    name: 'clear',
    aliases: ['clearchat', 'wipechat', 'clearmsg'],
    description: 'Clear all messages in the current chat',
    run: async (context) => {
        await ownerMiddleware(context, async () => {
            const { client, m } = context;
            const chatJid = m.chat || m.key?.remoteJid;

            if (!chatJid) return;

            client.sendMessage(chatJid, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});

            try {
                const msgTimestamp = Number(m.messageTimestamp || Math.floor(Date.now() / 1000));
                const lastMessages = m.key?.id
                    ? [{ key: { remoteJid: chatJid, fromMe: Boolean(m.key.fromMe), id: m.key.id, ...(m.key.participant ? { participant: m.key.participant } : {}) }, messageTimestamp: msgTimestamp }]
                    : [];

                if (typeof client.clearChat === 'function') {
                    await client.clearChat(chatJid, { key: m.key, messageTimestamp: msgTimestamp });
                } else {
                    await client.chatModify({ clear: true, lastMessages }, chatJid);
                }

                client.sendMessage(chatJid, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
            } catch (e) {
                client.sendMessage(chatJid, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt('Failed to clear chat: ' + String(e?.message || e).split('\n')[0]));
            }
        });
    }
};
