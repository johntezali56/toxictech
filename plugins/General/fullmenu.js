import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSettings } from '../../lib/fastSettings.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { ButtonV2 } from '@whiskeysockets/baileys';

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

export default {
  name: 'fullmenu',
  aliases: ['allmenu', 'commandslist', 'allcommands', 'fullcmds', 'fcmds', 'fm'],
  description: 'Displays the full bot command menu by category',
  run: async (context) => {
    const { client, m, totalCommands, mode, pict } = context;
    await client.sendMessage(m.chat, { react: { text: '⚡', key: m.reactKey } }).catch(() => {});
    const botname = '𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮';

    const settings = await getSettings();
    const effectivePrefix = settings.prefix || '.';

    const categories = [
      { name: 'General', display: 'GEᑎEᖇᗩᒪ MENU', emoji: '📜', cmd: 'generalmenu' },
      { name: 'Settings', display: 'SETTINGS MENU', emoji: '🛠️', cmd: 'settingsmenu' },
      { name: 'Owner', display: 'OWNER MENU', emoji: '👑', cmd: 'ownermenu' },
      { name: 'Heroku', display: 'HEROKU MENU', emoji: '☁️', cmd: 'herokumenu' },
      { name: 'Privacy', display: 'PRIVACY MENU', emoji: '🔒', cmd: 'privacymenu' },
      { name: 'Groups', display: 'GROUP MENU', emoji: '👥', cmd: 'groupmenu' },
      { name: 'AI', display: 'AI MENU', emoji: '🧠', cmd: 'aimenu' },
      { name: 'Downloads', display: 'DOWNLOAD MENU', emoji: '🎬', cmd: 'downloadmenu' },
      { name: 'Editing', display: 'EDITING MENU', emoji: '✂️', cmd: 'editingmenu' },
      { name: 'Effects', display: 'EFFECTS MENU', emoji: '🎨', cmd: 'effectsmenu' },
      { name: 'Anime', display: 'ANIME MENU', emoji: '🎌', cmd: 'animemenu' },
      { name: 'NSFW', display: '+18 MENU', emoji: '🔞', cmd: 'nsfwmenu' },
      { name: 'Utils', display: 'UTILS MENU', emoji: '🔧', cmd: 'utilsmenu' },
      { name: 'Reactions', display: 'REACTIONS MENU', emoji: '🎭', cmd: 'reactionsmenu' }
    ];

    const getGreeting = () => {
      const currentHour = DateTime.now().setZone('Africa/Nairobi').hour;
      if (currentHour >= 5 && currentHour < 12) return 'Good Morning';
      if (currentHour >= 12 && currentHour < 18) return 'Good Afternoon';
      if (currentHour >= 18 && currentHour < 22) return 'Good Evening';
      return 'Good Night';
    };

    const getCurrentTimeInNairobi = () => {
      return DateTime.now().setZone('Africa/Nairobi').toLocaleString(DateTime.TIME_SIMPLE);
    };

    const toFancyFont = (text, isUpperCase = false) => {
      const fonts = {
        'A': '𝘼', 'B': '𝘽', 'C': '𝘾', 'D': '𝙿', 'E': '𝙀', 'F': '𝙁', 'G': '𝙂', 'H': '𝙃', 'I': '𝙄', 'J': '𝙅', 'K': '𝙆', 'L': '𝙇', 'M': '𝙈',
        'N': '𝙉', 'O': '𝙊', 'P': '𝙋', 'Q': '𝙌', 'R': '𝙍', 'S': '𝙎', 'T': '𝙏', 'U': '𝙐', 'V': '𝙑', 'W': '𝙒', 'X': '𝙓', 'Y': '𝙔', 'Z': '𝙕',
        'a': '𝙖', 'b': '𝙗', 'c': '𝙘', 'd': '𝙙', 'e': '𝙚', 'f': '𝙛', 'g': '𝙜', 'h': '𝙝', 'i': '𝙞', 'j': '𝙟', 'k': '𝙠', 'l': '𝙡', 'm': '𝙢',
        'n': '𝙣', 'o': '𝙤', 'p': '𝙥', 'q': '𝙦', 'r': '𝙧', 's': '𝙨', 't': '𝙩', 'u': '𝙪', 'v': '𝙫', 'w': '𝙬', 'x': '𝙭', 'y': '𝙮', 'z': '𝙯'
      };
      return (isUpperCase ? text.toUpperCase() : text.toLowerCase())
        .split('')
        .map(char => fonts[char] || char)
        .join('');
    };

    let menuText =
      `╭━━━〔 ⚡ 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮 ⚡ 〕━━━╮\n` +
      `┃ 🔮 ${getGreeting()}, @${m.sender.split('@')[0].split(':')[0]}\n` +
      `┃ 💠────────────────💠\n` +
      `┃ 💎 *Bot:* ${botname}\n` +
      `┃ 💎 *Commands:* ${totalCommands}\n` +
      `┃ 💎 *Time:* ${getCurrentTimeInNairobi()}\n` +
      `┃ 💎 *Prefix:* ${effectivePrefix || 'None'}\n` +
      `┃ 💎 *Mode:* ${mode}\n` +
      `┃ 💎 *Library:* Baileys\n` +
      `╰━━━━━━━━━━━━━━━━━━╯\n\n`;

    for (const category of categories) {
      let commandFiles;
      try {
        commandFiles = fs.readdirSync(`./plugins/${category.name}`).filter(file => file.endsWith('.js') && file !== 'links.js');
      } catch (e) { continue; }

      if (commandFiles.length === 0 && category.name !== 'NSFW') continue;

      menuText += `╭━━〔 ${category.emoji} ${category.display} 〕━━╮\n`;

      if (category.name === 'NSFW') {
        const plus18Commands = ['xvideo'];
        for (const cmd of plus18Commands) {
          menuText += `┃ ✨ *${toFancyFont(cmd)}*\n`;
        }
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
              if (cmd && cmd.name) menuText += `┃ ✨ *${toFancyFont(cmd.name)}*\n`;
            }
            continue;
          }
          if (mod && typeof mod === 'object' && mod.name && typeof mod.name === 'string') {
            displayName = mod.name;
          }
        } catch (e) {}
        menuText += `┃ ✨ *${toFancyFont(displayName)}*\n`;
      }

      menuText += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
    }

    menuText += `💠────────────────💠\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

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
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
      return;
    }

    try {
      for (let i = 0; i < categories.length; i += 3) {
        const chunk = categories.slice(i, i + 3);
        const btnV2 = new ButtonV2(client);
        btnV2
          .setBody(
            i === 0
              ? `╭━━━〔 ⚡ 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮 ⚡ 〕━━━╮\n┃ 🔮 Tap any category below\n╰━━━━━━━━━━━━━━━━━━╯`
              : `💠 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮 • Categories (${Math.floor(i / 3) + 1}/${Math.ceil(categories.length / 3)})`
          )
          .setFooter('> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮');

        for (const cat of chunk) {
          btnV2.addButton(`${cat.emoji} ${cat.name}`, `${effectivePrefix}${cat.cmd}`);
        }

        await btnV2.send(m.chat, { userJid: client.user?.id || '', mentions: [m.sender] });
      }
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    } catch {
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    }
  }
};
