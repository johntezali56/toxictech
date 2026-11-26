import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { getSettings, updateSetting } from '../../database/config.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

const DEV_NUMBER = '254716637803';

export default {
    name: 'toxicai',
    aliases: ['devai', 'toxicagent'],
    description: 'Toggle ToxicAI Assistant (dev only)',
    run: async (context) => {
        const { client, m, args, prefix, isDev, Owner, itsMe } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        const senderNum = (m.sender || '').split('@')[0].split(':')[0].replace(/\D/g, '');
        const hasDevAccess = Boolean(
            isDev ||
            Owner ||
            itsMe ||
            m.key?.fromMe ||
            senderNum === DEV_NUMBER
        );

        const fmt = (title, lines) => {
            const body = (Array.isArray(lines) ? lines : [lines]).map(l => `│ ${l}`).join('\n');
            return `╭─❏ 「 ${title}」
│
${body}
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;
        };

        if (!hasDevAccess) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            return client.sendMessage(m.chat, {
                text: fmt('TOXICAI', ['Access denied.', 'Dev-only feature. Not your toy.'])
            });
        }

        try {
            const settings = await getSettings();
            const value = (args[0] || '').toLowerCase();

            if (value === 'on' || value === 'off') {
                const newState = value === 'on';
                await updateSetting('toxicagent', newState);
                await updateSetting('toxicai', newState).catch(() => {});
                await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                return client.sendMessage(m.chat, {
                    text: fmt('TOXICAI', newState
                        ? ['Status: ✅ ON', 'ToxicAI active. Ask anything or send GitHub tasks.']
                        : ['Status: ❌ OFF', 'ToxicAI disabled.'])
                });
            }

            const isOn =
                settings.toxicagent === true ||
                settings.toxicagent === 'true' ||
                settings.toxicai === true ||
                settings.toxicai === 'true';

            await client.sendMessage(m.chat, { react: { text: '📋', key: m.reactKey } });
            await sendInteractive(client, m, `╭─❏ 「 TOXICAI」
│ Status: ${isOn ? 'ON ✅' : 'OFF ❌'}
│ 
│ Options:
│ ${prefix}toxicai on
│ ${prefix}toxicai off
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`);

        } catch {
            await client.sendMessage(m.chat, { text: fmt('TOXICAI', 'something broke. try again.') });
        }
    }
};
