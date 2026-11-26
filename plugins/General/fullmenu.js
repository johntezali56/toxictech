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
import { getSettings } from '../../lib/fastSettings.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { ButtonV2 } from '@whiskeysockets/baileys';

export default {
  name: 'fullmenu',
  aliases: ['allmenu', 'commandslist', 'allcommands', 'fullcmds', 'fcmds', 'fm'],
  description: 'Displays the full bot command menu by category',
  run: async (context) => {
    const { client, m, totalCommands, mode, pict, botname } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.key } }).catch(() => {});

    const settings = await getSettings();
    const effectivePrefix = settings.prefix || '.';

    const categories = [
      { name: 'General', display: 'GENERAL', emoji: '📜', btn: '📜 General', cmd: 'generalmenu' },
      { name: 'Settings', display: 'SETTINGS', emoji: '🛠️', btn: '🛠️ Settings', cmd: 'settingsmenu' },
      { name: 'Owner', display: 'OWNER', emoji: '👑', btn: '👑 Owner', cmd: 'ownermenu' },
      { name: 'Heroku', display: 'HEROKU', emoji: '☁️', btn: '☁️ Heroku', cmd: 'herokumenu' },
      { name: 'Privacy', display: 'PRIVACY', emoji: '🔒', btn: '🔒 Privacy', cmd: 'privacymenu' },
      { name: 'Groups', display: 'GROUPS', emoji: '👥', btn: '👥 Groups', cmd: 'groupmenu' },
      { name: 'AI', display: 'AI', emoji: '🧠', btn: '🧠 AI', cmd: 'aimenu' },
      { name: 'Downloads', display: 'DOWNLOADS', emoji: '🎬', btn: '🎬 Downloads', cmd: 'downloadmenu' },
      { name: 'Editing', display: 'EDITING', emoji: '✂️', btn: '✂️ Editing', cmd: 'editingmenu' },
      { name: 'Effects', display: 'EFFECTS', emoji: '🎨', btn: '🎨 Effects', cmd: 'effectsmenu' },
      { name: 'Anime', display: 'ANIME', emoji: '🎌', btn: '🎌 Anime', cmd: 'animemenu' },
      { name: 'NSFW', display: '+18', emoji: '🔞', btn: '🔞 +18', cmd: '18menu' },
      { name: 'Utils', display: 'UTILS', emoji: '🔧', btn: '🔧 Utils', cmd: 'utilsmenu' },
      { name: 'Reactions', display: 'REACTIONS', emoji: '🎭', btn: '🎭 Reactions', cmd: 'reactionsmenu' }
    ];

    const header = buildHeaderBox({
      sender: m.sender,
      botname: botname || 'Toxic-MD',
      totalCommands,
      prefix: effectivePrefix,
      mode
    });

    let menuText = `${header}\n\n`;

    for (const category of categories) {
      let commandFiles = [];
      try {
        commandFiles = fs
          .readdirSync(`./plugins/${category.name}`)
          .filter((file) => file.endsWith('.js') && file !== 'links.js');
      } catch {}

      if (commandFiles.length === 0 && category.name !== 'NSFW') continue;

      menuText += `┌──『 ${category.emoji} ${category.display} 』\n`;

      if (category.name === 'NSFW') {
        menuText += `│ ◈ xvideo\n`;
      }

      for (const file of commandFiles) {
        let displayName = file.replace('.js', '');
        try {
          const { pathToFileURL } = await import('url');
          const modUrl = pathToFileURL(path.join(process.cwd(), 'plugins', category.name, file)).href;
          const modRaw = await import(modUrl);
          const mod = modRaw.default !== undefined ? modRaw.default : modRaw;
          if (Array.isArray(mod)) {
            for (const cmd of mod) {
              if (cmd && cmd.name) menuText += `│ ◈ ${cmd.name}\n`;
            }
            continue;
          }
          if (mod && typeof mod === 'object' && mod.name && typeof mod.name === 'string') {
            displayName = mod.name;
          }
        } catch {}
        menuText += `│ ◈ ${displayName}\n`;
      }

      menuText += `└────────────────────\n\n`;
    }

    menuText += `> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`;

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

    const device = await getDeviceMode();
    if (device === 'ios') {
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
      return;
    }

    try {
      for (let i = 0; i < categories.length; i += 3) {
        const chunk = categories.slice(i, i + 3);
        const btnV2 = new ButtonV2(client);
        btnV2
          .setBody(
            i === 0
              ? `┌──『 📂 CATEGORY NAVIGATION 』\n│ ◈ Tap any category button below\n└────────────────────`
              : `┌──『 📂 MORE CATEGORIES 』\n│ ◈ Select a category below\n└────────────────────`
          )
          .setFooter('> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧');

        for (const cat of chunk) {
          btnV2.addButton(cat.btn, `${effectivePrefix}${cat.cmd}`);
        }
        await btnV2.send(m.chat, { userJid: client.user?.id || '', mentions: [m.sender] });
      }
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch {
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    }
  }
};
