import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

let cachedChessBanner = null;

function getBannerBuffer() {
    const candidates = [
        path.join(process.cwd(), 'toxic.jpg'),
        './toxic.jpg',
        './media/toxic.jpg',
        './lib/toxic.jpg',
        './assets/toxic.jpg'
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    return null;
}

export default {
    name: 'chess',
    aliases: ['chessgame', 'neonchess', 'miniapp', 'games'],
    description: 'Launch the Neon Chess WhatsApp Mini-App',
    run: async (context) => {
        const { client, m, prefix } = context;
        const effectivePrefix = prefix || '.';
        const appUrl = process.env.MINIAPP_URL || 'http://51.75.118.149:20343';

        client.sendMessage(m.chat, { react: { text: '♟️', key: m.key } }).catch(() => {});

        const caption =
            `╭─❏ 「 𝐍𝐄𝐎𝐍 𝐂𝐇𝐄𝐒𝐒 𝐌𝐈𝐍𝐈-𝐀𝐏𝐏 」
` +
            `│ 
` +
            `│ Challenge the Toxic-MD AI engine
` +
            `│ in a live Neon Chess match.
` +
            `│ 
` +
            `│ • Play as White or Black
` +
            `│ • Smart AI Opponent + Undo & Flip
` +
            `╰───────────────`;

        const imgBuffer = getBannerBuffer();

        try {
            let headerObj = { hasMediaAttachment: false };
            if (imgBuffer) {
                if (!cachedChessBanner) {
                    const media = await prepareWAMessageMedia(
                        { image: imgBuffer },
                        { upload: client.waUploadToServer }
                    );
                    cachedChessBanner = media.imageMessage;
                }
                if (cachedChessBanner) {
                    headerObj = {
                        hasMediaAttachment: true,
                        imageMessage: cachedChessBanner
                    };
                }
            }

            const interactiveMsg = {
                interactiveMessage: {
                    body: { text: caption },
                    footer: { text: '©Powered By TOXIC TECH' },
                    header: headerObj,
                    contextInfo: {
                        mentionedJid: [m.sender]
                    },
                    nativeFlowMessage: {
                        messageVersion: 1,
                        buttons: [
                            {
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '♟️ Play Neon Chess',
                                    url: appUrl,
                                    merchant_url: appUrl
                                })
                            },
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '📜 Menu',
                                    id: `${effectivePrefix}menu`
                                })
                            }
                        ]
                    }
                }
            };

            const waMsg = generateWAMessageFromContent(
                m.chat,
                proto.Message.fromObject({
                    viewOnceMessage: {
                        message: interactiveMsg
                    }
                }),
                { userJid: client.user.id }
            );

            if (!waMsg?.key?.id) throw new Error('null key');
            await client.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id });
        } catch {
            const fallbackText = `${caption}

🔗 Play here: ${appUrl}
> ©Powered By TOXIC TECH`;
            if (imgBuffer) {
                await client.sendMessage(m.chat, {
                    image: imgBuffer,
                    caption: fallbackText,
                    mentions: [m.sender]
                });
            } else {
                await client.sendMessage(m.chat, {
                    text: fallbackText,
                    mentions: [m.sender]
                });
            }
        }
    }
};
