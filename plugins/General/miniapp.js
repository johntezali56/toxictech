import fs from 'fs';
import path from 'path';
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';

const BASE_URL = (process.env.APP_URL || process.env.PUBLIC_URL || 'http://51.75.118.149:20343').replace(/\/+$/, '');

export default {
    name: 'miniapp',
    aliases: ['miniapps', 'apps', 'games', 'chess', 'neonchess'],
    category: 'General',
    desc: 'Open the Toxic-MD interactive mini-app hub',
    async execute(client, m, args) {
        const prefix = m.prefix || '.';
        const sub = (args?.[0] || '').toLowerCase().trim();

        const apps = {
            chess: { label: 'Neon Chess', url: `${BASE_URL}/miniapp.html?app=chess`, emoji: '♟️' },
            neonchess: { label: 'Neon Chess', url: `${BASE_URL}/miniapp.html?app=chess`, emoji: '♟️' },
            ttt: { label: 'Tic-Tac-Toe', url: `${BASE_URL}/miniapp.html?app=tictactoe`, emoji: '⭕' },
            tictactoe: { label: 'Tic-Tac-Toe', url: `${BASE_URL}/miniapp.html?app=tictactoe`, emoji: '⭕' },
            rps: { label: 'Rock Paper Scissors', url: `${BASE_URL}/miniapp.html?app=rps`, emoji: '✂️' }
        };

        const chosen = apps[sub];
        const targetUrl = chosen ? chosen.url : `${BASE_URL}/miniapp.html`;
        const titleText = chosen ? `${chosen.emoji} ${chosen.label}` : '🎮 TOXIC-MD MINI-APP HUB';

        const caption = chosen
            ? `╭─❏ 「 *${titleText}* 」\n│\n│ ❏ Tap the button or link below to play:\n│ 🔗 ${targetUrl}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`
            : `╭─❏ 「 *${titleText}* 」\n│\n│ ❏ Pick a mini-app from the menu below:\n│\n│ 1️⃣ *Neon Chess* — \`${prefix}miniapp chess\`\n│ 2️⃣ *Tic-Tac-Toe* — \`${prefix}miniapp ttt\`\n│ 3️⃣ *Rock Paper Scissors* — \`${prefix}miniapp rps\`\n│\n│ 🌐 *All-in-One Hub:*\n│ ${targetUrl}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

        const imgCandidates = [
            path.join(process.cwd(), 'toxic.jpg'),
            path.resolve('./toxic.jpg')
        ];
        const imgPath = imgCandidates.find(p => fs.existsSync(p));
        const imgBuffer = imgPath ? fs.readFileSync(imgPath) : null;

        try {
            if (imgBuffer) {
                const media = await prepareWAMessageMedia(
                    { image: imgBuffer },
                    { upload: client.waUploadToServer }
                );

                const buttons = chosen
                    ? [
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: `Launch ${chosen.label}`,
                                url: targetUrl,
                                merchant_url: targetUrl
                            })
                        }
                    ]
                    : [
                        {
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: 'Choose a Mini-App',
                                sections: [
                                    {
                                        title: 'Available Mini-Apps',
                                        rows: [
                                            {
                                                header: 'Strategy Game',
                                                title: 'Neon Chess',
                                                description: 'Play against the machine (White or Black)',
                                                id: `${prefix}miniapp chess`
                                            },
                                            {
                                                header: 'Classic Board',
                                                title: 'Tic-Tac-Toe',
                                                description: 'Play vs AI or 2-Player pass & play',
                                                id: `${prefix}miniapp ttt`
                                            },
                                            {
                                                header: 'Quick Match',
                                                title: 'Rock Paper Scissors',
                                                description: 'Test your luck with live score tracking',
                                                id: `${prefix}miniapp rps`
                                            }
                                        ]
                                    }
                                ]
                            })
                        },
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'Open Mini-App Hub',
                                url: targetUrl,
                                merchant_url: targetUrl
                            })
                        }
                    ];

                const msg = generateWAMessageFromContent(
                    m.chat,
                    {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2
                                },
                                interactiveMessage: proto.Message.InteractiveMessage.create({
                                    body: proto.Message.InteractiveMessage.Body.create({
                                        text: caption
                                    }),
                                    footer: proto.Message.InteractiveMessage.Footer.create({
                                        text: '𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮'
                                    }),
                                    header: proto.Message.InteractiveMessage.Header.create({
                                        title: titleText,
                                        subtitle: '',
                                        hasMediaAttachment: true,
                                        imageMessage: media.imageMessage
                                    }),
                                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                        buttons
                                    })
                                })
                            }
                        }
                    },
                    { userJid: client.user?.id, quoted: m }
                );

                await client.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
                return;
            }
        } catch (err) {}

        if (imgBuffer) {
            await client.sendMessage(m.chat, { image: imgBuffer, caption }, { quoted: m });
        } else {
            await client.sendMessage(m.chat, { text: caption }, { quoted: m });
        }
    }
};
