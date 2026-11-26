import { getSettings, updateSetting } from '../../database/config.js';
import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
  await ownerMiddleware(context, async () => {
    const { client, m, args } = context;
    const newPrefix = args[0];

    const settings = await getSettings();

    if (newPrefix === 'null') {
      if (!settings.prefix) {
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return await sendInteractive(client, m, 
          `╭─❏ 「 PREFIX 」
│ Already prefixless, you clueless twit! 😈
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`
        );
      }
      await updateSetting('prefix', '');
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
      await sendInteractive(client, m, 
        `╭─❏ 「 PREFIX 」
│ Prefix obliterated! 🔥
│ I’m prefixless now, bow down! 😈
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`
      );
    } else if (newPrefix) {
      if (settings.prefix === newPrefix) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return await sendInteractive(client, m, 
          `╭─❏ 「 PREFIX 」
│ Prefix is already ${newPrefix}, moron! 😈
│ Try something new, fool! 🥶
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`
        );
      }
      await updateSetting('prefix', newPrefix);
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
      await sendInteractive(client, m, 
        `╭─❏ 「 PREFIX 」
│ New prefix set to ${newPrefix}! 🔥
│ Obey the new order, king! 😈
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`
      );
    } else {
      await sendInteractive(client, m, 
        `╭─❏ 「 PREFIX 」
│ Current Prefix: ${settings.prefix || 'No prefix, peasant! 🥶'}
│ Use "${settings.prefix || '.'}prefix null" to go prefixless or "${settings.prefix || '.'}prefix <symbol>" to set one, noob!
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`
      );
    }
  });
};
