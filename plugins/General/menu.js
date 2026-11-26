import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getToxicImage(pict) {
  if (pict && Buffer.isBuffer(pict) && pict.length > 0) return pict;
  const candidates = [
    path.join(process.cwd(), 'toxic.jpg'),
    path.join(process.cwd(), 'media', 'toxic.jpg'),
    path.join(process.cwd(), 'lib', 'toxic.jpg'),
    path.join(process.cwd(), 'assets', 'toxic.jpg'),
    path.join(__dirname, '../../toxic.jpg'),
    path.join(__dirname, '../../media/toxic.jpg'),
    path.join(__dirname, '../../lib/toxic.jpg'),
    path.join(__dirname, '../../assets/toxic.jpg')
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    } catch {}
  }
  return null;
}

function getNairobiTime() {
  try {
    return DateTime.now().setZone('Africa/Nairobi').toLocaleString(DateTime.TIME_SIMPLE);
  } catch {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function buildHeaderBox({ sender, botname, totalCommands, prefix, mode }) {
  const userTag = `@${sender.split('@')[0].split(':')[0]}`;
  return (
    `┌── ( 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮 ) ──┐\n` +
    `│ Greetings, ${userTag}\n` +
    `│ Bot: ${botname || 'Toxic-MD'}\n` +
    `│ Total Commands: ${totalCommands || 185}\n` +
    `│ Time: ${getNairobiTime()}\n` +
    `│ Prefix: ${prefix || '.'}\n` +
    `│ Mode: ${mode || 'Public'}\n` +
    `│ Library: Baileys\n` +
    `└────────────────────`
  );
}

export default {
  name: 'menu',
  aliases: ['commands', 'list', 'cmds', 'm', 'cmd', 'commandlist', 'allcmds'],
  description: 'Displays the Toxic-MD command menu',
  run: async (context) => {
    const { client, m, mode, botname, prefix, pict, totalCommands } = context;
    client.sendMessage(m.chat, { react: { text: '🤖', key: m.key } }).catch(() => {});

    const effectivePrefix = prefix || '.';
    const bodyText = m.body || m.text || '';
    const cleanText = bodyText.trimStart().slice(effectivePrefix.length).trimStart();
    const firstWord = cleanText.split(' ')[0].toLowerCase();

    if (cleanText !== '' && !['menu', 'commands', 'list', 'cmds', 'm', 'help', 'cmd', 'commandlist', 'allcmds'].includes(firstWord)) {
      const commandName = cleanText.split(' ')[0];
      return client.sendMessage(m.chat, {
        text: `┌──『 ⚠️ ERROR 』\n│ ◈ Invalid option after "${commandName}"\n│ ◈ Type *${effectivePrefix}menu* to open the menu\n└────────────────────`
      });
    }

    const header = buildHeaderBox({
      sender: m.sender,
      botname: botname || '𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮',
      totalCommands,
      prefix: effectivePrefix,
      mode
    });

    const quickList = [
      `${effectivePrefix}fullmenu`,
      `${effectivePrefix}owner`,
      `${effectivePrefix}ping`,
      `${effectivePrefix}settings`,
      `${effectivePrefix}uptime`
    ];

    const categoryCmds = [
      `${effectivePrefix}generalmenu`,
      `${effectivePrefix}settingsmenu`,
      `${effectivePrefix}ownermenu`,
      `${effectivePrefix}herokumenu`,
      `${effectivePrefix}privacymenu`,
      `${effectivePrefix}groupmenu`,
      `${effectivePrefix}aimenu`,
      `${effectivePrefix}downloadmenu`,
      `${effectivePrefix}editingmenu`,
      `${effectivePrefix}effectsmenu`,
      `${effectivePrefix}animemenu`,
      `${effectivePrefix}18menu`,
      `${effectivePrefix}utilsmenu`,
      `${effectivePrefix}reactionsmenu`
    ];

    let menuText = `${header}\n\n`;
    menuText += `┌──『 ⚡ QUICK COMMANDS 』\n`;
    for (const item of quickList) {
      menuText += `│ ◈ ${item}\n`;
    }
    menuText += `└────────────────────\n\n`;

    menuText += `┌──『 📂 CATEGORIES 』\n`;
    for (const item of categoryCmds) {
      menuText += `│ ◈ ${item}\n`;
    }
    menuText += `└────────────────────\n\n`;
    menuText += `> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

    const imgBuffer = getToxicImage(pict);
    if (imgBuffer) {
      await client.sendMessage(m.chat, {
        image: imgBuffer,
        caption: menuText,
        mentions: [m.sender]
      });
    } else {
      await client.sendMessage(m.chat, {
        text: menuText,
        mentions: [m.sender]
      });
    }
  }
};
