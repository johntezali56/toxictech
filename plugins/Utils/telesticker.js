import fetch from 'node-fetch';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { promises as fs } from 'fs';
import path from 'path';
import { sendInteractive } from '../../lib/sendInteractive.js';

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '9040286150:AAE0TPHv8WDds5EPY1QngGTt_GxGRZAg_4M';
const DEFAULT_BATCH_LIMIT = 15;

export default async (context) => {
    const { client, m, text, prefix, packname, author } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    try {
        if (!text) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 Tᴇʟᴇɢʀᴀᴍ Sᴛɪᴄᴋᴇʀ」
│ Give me a Telegram sticker pack name or link!
│
│ Examples:
│ • ${prefix}ts HotCherry
│ • ${prefix}ts https://t.me/addstickers/HotCherry
│ • ${prefix}ts HotCherry 1-20
│ • ${prefix}ts HotCherry all
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
        }

        const parts = text.trim().split(/\s+/);
        let rawTarget = parts[0];
        const rangeArg = (parts[1] || '').toLowerCase();

        // Catch private channel/group links early with a helpful message
        if (rawTarget.includes('t.me/c/') || rawTarget.includes('t.me/+')) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 Tᴇʟᴇɢʀᴀᴍ Sᴛɪᴄᴋᴇʀ」
│ That is a private channel/invite link, not a sticker pack!
│
│ Use a sticker pack link like:
│ ${prefix}ts https://t.me/addstickers/HotCherry
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
        }

        let packName = rawTarget;
        if (packName.includes('t.me/addstickers/')) {
            const match = packName.match(/t\.me\/addstickers\/([a-zA-Z0-9_]+)/);
            if (match) packName = match[1];
        } else if (packName.includes('telegram.me/addstickers/')) {
            const match = packName.match(/telegram\.me\/addstickers\/([a-zA-Z0-9_]+)/);
            if (match) packName = match[1];
        }

        packName = packName.replace(/[^a-zA-Z0-9_]/g, '');
        if (!packName) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 Tᴇʟᴇɢʀᴀᴍ Sᴛɪᴄᴋᴇʀ」
│ Invalid sticker pack name!
│ Example: ${prefix}ts HotCherry
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
        }

        // Fetch sticker set directly from Telegram Official Bot API
        const setRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getStickerSet?name=${encodeURIComponent(packName)}`);
        const setData = await setRes.json();

        if (!setData?.ok || !setData?.result?.stickers?.length) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            const tgReason = setData?.description ? `\n│ Reason: ${setData.description}` : '';
            return sendInteractive(client, m, `╭─❏ 「 Tᴇʟᴇɢʀᴀᴍ Sᴛɪᴄᴋᴇʀ」
│ Sticker pack not found or unavailable.${tgReason}
│
│ Pack: ${packName}
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
        }

        const allStickers = setData.result.stickers;
        const packTitle = setData.result.title || packName;
        const stickerPack = packname || 'Telegram Sticker';
        const stickerAuthor = author || '𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧';

        // Determine slice range to protect Katabump 220 MiB RAM cap
        let startIdx = 0;
        let endIdx = Math.min(allStickers.length, DEFAULT_BATCH_LIMIT);

        if (rangeArg === 'all') {
            startIdx = 0;
            endIdx = allStickers.length;
        } else if (/^\d+-\d+$/.test(rangeArg)) {
            const [s, e] = rangeArg.split('-').map(Number);
            startIdx = Math.max(0, s - 1);
            endIdx = Math.min(allStickers.length, e);
        } else if (/^\d+$/.test(rangeArg)) {
            startIdx = 0;
            endIdx = Math.min(allStickers.length, Number(rangeArg));
        }

        if (startIdx >= endIdx) {
            startIdx = 0;
            endIdx = Math.min(allStickers.length, DEFAULT_BATCH_LIMIT);
        }

        const stickers = allStickers.slice(startIdx, endIdx);
        const rangeNotice = endIdx < allStickers.length
            ? `\n│ Batch: ${startIdx + 1}-${endIdx} of ${allStickers.length} (use "${prefix}ts ${packName} all" for all)`
            : `\n│ Total: ${allStickers.length} stickers`;

        await client.sendMessage(m.chat, { react: { text: '🔃', key: m.reactKey } });
        await sendInteractive(client, m, `╭─❏ 「 Tᴇʟᴇɢʀᴀᴍ Sᴛɪᴄᴋᴇʀ」
│ Pack: ${packTitle}${rangeNotice}
│ Converting to WhatsApp stickers...
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);

        let sentCount = 0;
        let failedCount = 0;
        let tgsSkipped = 0;

        for (let i = 0; i < stickers.length; i++) {
            let tempFile = null;
            try {
                const sticker = stickers[i];

                // Skip Lottie .tgs vector animations (unsupported by wa-sticker-formatter)
                if (sticker.is_animated) {
                    tgsSkipped++;
                    continue;
                }

                // Resolve direct file_path from Telegram Bot API
                const fileRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(sticker.file_id)}`);
                const fileData = await fileRes.json();
                if (!fileData?.ok || !fileData?.result?.file_path) {
                    throw new Error('Failed to get file_path');
                }

                const filePath = fileData.result.file_path;
                const stickerUrl = `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${filePath}`;
                const isVideo = Boolean(sticker.is_video || filePath.endsWith('.webm'));
                const ext = isVideo ? 'webm' : 'webp';

                tempFile = path.join('/tmp', `ts-${Date.now()}-${i}.${ext}`);

                const stickerResponse = await fetch(stickerUrl);
                if (!stickerResponse.ok) throw new Error(`Download failed: ${stickerResponse.status}`);

                const stickerBuffer = Buffer.from(await stickerResponse.arrayBuffer());
                await fs.writeFile(tempFile, stickerBuffer);

                const waSticker = new Sticker(tempFile, {
                    pack: stickerPack,
                    author: stickerAuthor,
                    type: isVideo ? StickerTypes.CROPPED : StickerTypes.FULL,
                    categories: sticker.emoji ? [sticker.emoji] : ['🤔'],
                    quality: 45
                });

                let stickerBufferFinal = await waSticker.toBuffer();
                await client.sendMessage(m.chat, { sticker: stickerBufferFinal });
                stickerBufferFinal = null;
                sentCount++;

                // Pace sends & let Node garbage-collect buffers on 220 MiB RAM cap
                if ((i + 1) % 3 === 0) {
                    await new Promise(r => setTimeout(r, 900));
                }
            } catch {
                failedCount++;
            } finally {
                if (tempFile) await fs.unlink(tempFile).catch(() => {});
            }
        }

        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });

        const extraNote = tgsSkipped > 0 ? `\n│ Skipped ${tgsSkipped} .tgs (Lottie, unsupported)` : '';
        await sendInteractive(client, m, `╭─❏ 「 Tᴇʟᴇɢʀᴀᴍ Sᴛɪᴄᴋᴇʀ」
│ Success: ${sentCount} stickers
│ Failed: ${failedCount} stickers${extraNote}
│ Pack: ${packTitle}
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);

    } catch (error) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        await sendInteractive(client, m, `╭─❏ 「 Eʀʀᴏʀ」
│ Something broke while fetching from Telegram!
│ Details: ${error?.message || 'Unknown error'}
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
    }
};
