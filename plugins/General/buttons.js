import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';

export default {
  name: 'buttonz',
  aliases: ['btn'],
  description: 'Displays a quick-tap button menu',
  run: async (context) => {
    const { client, m, botname, prefix = '.' } = context;

    try {
      client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});
      const buttons = [
        { display_text: '📜 FullMenu', id: `${prefix}fullmenu` },
        { display_text: '⚡ Ping', id: `${prefix}ping` },
        { display_text: '👑 Owner', id: `${prefix}owner` },
        { display_text: '⚙️ Settings', id: `${prefix}settings` },
        { display_text: '🧠 AIMenu', id: `${prefix}aimenu` },
        { display_text: '👥 GroupMenu', id: `${prefix}groupmenu` }
      ];

      const msg = generateWAMessageFromContent(m.chat, proto.Message.fromObject({
        interactiveMessage: {
          body: { text: `╭─❏ 「 Mᴇɴᴜ」\n│ Tap a button below:\n╰───────────────` },
          footer: { text: botname || 'TOXIC TECH' },
          header: { hasMediaAttachment: false },
          nativeFlowMessage: {
            messageVersion: 1,
            buttons: buttons.map(b => ({
              name: 'quick_reply',
              buttonParamsJson: JSON.stringify({
                display_text: b.display_text,
                id: b.id
              })
            }))
          }
        }
      }), { userJid: client.user.id });

      await client.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    } catch (error) {
      client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      console.error(`Menu command error: ${error.stack}`);
    }
  }
};
