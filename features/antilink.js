import { getGroupSettings, addWarn, resetWarn, getWarnLimit, getTrustedLinks } from '../database/config.js';
import { resolveTargetJid } from '../lib/lidResolver.js';

const _num = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const _participantIds = (p) => {
    return [
        _num(p.id),
        _num(p.jid),
        _num(p.lid),
        _num(p.phoneNumber),
        _num(p.phone_number)
    ].filter(Boolean);
};

const _matchesAny = (p, targetDigits) => {
    const ids = _participantIds(p);
    return targetDigits.some((d) => d && ids.includes(d));
};

const fmt = (msg) => `╭─❏ 「 ANTILINK 」\n│ ${msg}\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

function extractDomains(text) {
    const domains = [];
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9.-]+\.[a-z]{2,6}(\/[^\s]*)?)/gi;
    const matches = text.match(urlRegex) || [];
    for (const m of matches) {
        try {
            const u = m.startsWith('http') ? new URL(m) : new URL('https://' + m);
            domains.push(u.hostname.replace(/^www\./, '').toLowerCase());
        } catch {
            domains.push(m.toLowerCase().replace(/^www\./, '').split('/')[0]);
        }
    }
    return domains;
}

export default async (client, m) => {
    try {
        if (!m || !m.chat || !m.chat.endsWith('@g.us')) return;
        if (m.key?.fromMe) return;

        const groupSettings = await getGroupSettings(m.chat);
        const antilinkMode = (groupSettings.antilink || 'off').toLowerCase();
        if (antilinkMode === 'off') return;

        const msg = m.message || {};
        const innerMsg = msg.extendedTextMessage || msg.imageMessage || msg.videoMessage ||
            msg.documentMessage || msg.audioMessage || msg.stickerMessage || null;
        const contextInfo = (typeof innerMsg === 'object' && innerMsg?.contextInfo) || msg.contextInfo || null;
        const isForwarded = contextInfo?.isForwarded === true;
        const forwardingScore = contextInfo?.forwardingScore || 0;
        const originJid = contextInfo?.remoteJid || '';
        const isChannelForward = isForwarded && (forwardingScore >= 1 || originJid.endsWith('@newsletter'));

        const text = (m.text || msg.conversation || msg.extendedTextMessage?.text ||
            msg.imageMessage?.caption || msg.videoMessage?.caption ||
            msg.documentMessage?.caption || '').toLowerCase();
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9.-]+\.[a-z]{2,6}(\/[^\s]*)?)/gi;
        const hasPreview = msg.extendedTextMessage?.matchedText || msg.extendedTextMessage?.canonicalUrl;
        const hasLink = urlRegex.test(text) || !!hasPreview;

        if (!isChannelForward && !hasLink) return;

        if (hasLink && !isChannelForward) {
            try {
                const ownCode = await client.groupInviteCode(m.chat);
                const ownLink = `https://chat.whatsapp.com/${ownCode}`;
                const rawText = m.text || msg.conversation || msg.extendedTextMessage?.text || '';
                if (rawText.includes(ownLink) || rawText.includes(ownCode)) return;
            } catch {}
        }

        if (hasLink && !isChannelForward) {
            try {
                const trustedDomains = await getTrustedLinks(m.chat);
                if (trustedDomains && trustedDomains.length > 0) {
                    const msgDomains = extractDomains(text);
                    const previewDomain = hasPreview
                        ? (() => {
                            try { return new URL(hasPreview).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
                        })()
                        : '';
                    const allDomains = msgDomains.concat(previewDomain ? [previewDomain] : []);
                    if (allDomains.length > 0 && allDomains.every(d => trustedDomains.some(t => d === t || d.endsWith('.' + t)))) {
                        return;
                    }
                }
            } catch {}
        }

        const groupMetadata = await client.groupMetadata(m.chat);
        const participants = groupMetadata?.participants || [];
        const rawSender = m.sender || m.key?.participant || '';
        const sender = resolveTargetJid(rawSender, participants) || rawSender;

        if (!sender) return;

        const senderDigits = [_num(sender), _num(rawSender)].filter(Boolean);
        const botRaw = client.decodeJid ? client.decodeJid(client.user?.id || '') : (client.user?.id || '');
        const botDigits = [_num(botRaw), _num(client.user?.id), _num(client.user?.lid)].filter(Boolean);

        const senderMember = participants.find(p => _matchesAny(p, senderDigits));
        const botMember = participants.find(p => _matchesAny(p, botDigits));

        const isAdmin = Boolean(senderMember?.admin === 'admin' || senderMember?.admin === 'superadmin');
        const isBotAdmin = Boolean(botMember?.admin === 'admin' || botMember?.admin === 'superadmin');

        const displayNum = (senderMember?.phoneNumber ? _num(senderMember.phoneNumber) : '') || _num(sender) || sender.split('@')[0];

        if (isAdmin) return;

        if (!isBotAdmin) {
            await client.sendMessage(m.chat, {
                text: fmt(`@${displayNum} sent a link.\nMake me admin so I can actually do something about it. 😤`),
                mentions: [sender]
            });
            return;
        }

        try {
            await client.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    fromMe: false,
                    id: m.key.id,
                    participant: m.key.participant || m.sender
                }
            });
        } catch (e) {}

        if (antilinkMode === 'delete' || antilinkMode === 'on') {
            await client.sendMessage(m.chat, {
                text: fmt(`🚫 @${displayNum}, links are not allowed here.\n│ Message deleted.`),
                mentions: [sender]
            });
            return;
        }

        if (antilinkMode === 'kick') {
            try {
                await client.groupParticipantsUpdate(m.chat, [sender], 'remove');
                await client.sendMessage(m.chat, {
                    text: fmt(`🚨 @${displayNum} KICKED!\n│ Reason: links are not allowed here.\n│ Kick mode — zero tolerance. 😈`),
                    mentions: [sender]
                });
            } catch (e) {}
            return;
        }

        const MAX_WARNS = await getWarnLimit(m.chat);
        const newCount = await addWarn(m.chat, displayNum);
        const remaining = MAX_WARNS - newCount;

        if (newCount >= MAX_WARNS) {
            await resetWarn(m.chat, displayNum);
            try { await client.groupParticipantsUpdate(m.chat, [sender], 'remove'); } catch {}
            await client.sendMessage(m.chat, {
                text: fmt(`🚨 @${displayNum} KICKED!\n│ Reason: links are not allowed here\n│ Warns: ${newCount}/${MAX_WARNS}\n│ That's it. Get out. 😈\n│ Warn count wiped clean.`),
                mentions: [sender]
            });
            return;
        }

        await client.sendMessage(m.chat, {
            text: fmt(`⚠️ @${displayNum}, warned!\n│ Reason: links are not allowed here\n│ Message deleted.\n│ Warns: ${newCount}/${MAX_WARNS}\n│ ${remaining} more and you're GONE. 😈`),
            mentions: [sender]
        });
    } catch (err) {
        console.error('[ANTILINK] Error:', err.message);
    }
};
