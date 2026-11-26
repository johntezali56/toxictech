import { sendInteractive } from '../../lib/sendInteractive.js';
export default async (context) => {
  const { client, m } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

  const message = `╭─❏ 「 Sᴜᴘᴘᴏʀᴛ Lɪɴᴋs」
│ *Owner*
│ https://github.com/johntezali56/toxictech
│ 
│ *Channel Link*
│ https:
│ 
│ *Group*
│ https://chat.whatsapp.com/J0V4ueVo1YE0BdGGW7J6Bx
╰───────────────
> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

  try {
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
    await client.sendMessage(
      m.chat,
      { text: message }
    );
  } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    console.error("Support command error:", error);
    await sendInteractive(client, m, `╭─❏ 「 Eʀʀᴏʀ」
│ Failed to send support links.\n│ Try again, you impatient fool.\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`);
  }
};
