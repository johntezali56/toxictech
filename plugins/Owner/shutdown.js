import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});
        await sendInteractive(client, m, `╭─❏ 「 SHUTDOWN」
│ 💀 Toxic-MD going offline...
│ Don't cry.
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`);
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
        setTimeout(() => process.exit(0), 2000);
    });
};
