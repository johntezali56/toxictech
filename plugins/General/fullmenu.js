import { DateTime } from 'luxon';
import fs from 'fs';
import { getSettings } from '../../lib/fastSettings.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { ButtonV2 } from '@whiskeysockets/baileys';
import { commands } from '../../handlers/commandHandler.js';

export default {
  name: 'fullmenu',
  aliases: ['allmenu', 'commandslist', 'allcommands', 'fullcmds', 'fcmds', 'fm'],
  description: 'Displays the full bot command menu by category',
  run: async (context) => {
    const { client, m, totalCommands, mode, pict } = context;
    client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});
    const botname = '𝑇𝛩𝛸𝛪𝐶-𝐌𝐃';

    const settings = await getSettings();
    const effectivePrefix = settings.prefix || '';

    const categories = [
      { name: 'General', display: 'GEᑎEᖇᗩᒪMENU', emoji: '📜' },
      { name: 'Settings', display: 'SETTINGSMENU', emoji: '🛠️' },
      { name: 'Owner', display: 'OWNERMENU', emoji: '🔱' },
      { name: 'Heroku', display: 'HEROKUMENU', emoji: '☁️' },
      { name: 'Privacy', display: 'PRIVACYMENU', emoji: '🔒' },
      { name: 'Groups', display: 'GROUPMENU', emoji: '🌜' },
      { name: 'Downloads', display: 'DOWNLOADMENU', emoji: '📲' },
      { name: 'Effects', display: 'EFFECTSMENU', emoji: '🎨' },
      { name: 'NSFW', display: '+18MENU', emoji: '🔞' },
      { name: 'Utils', display: 'UTILSMENU', emoji: '🔧' },
      { name: 'Reactions', display: 'REACTIONSMENU', emoji: '🎭' }
    ];

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

    let menuText = `╭─❏ 「 Fᴜʟʟ Mᴇɴᴜ」\n│ Greetings, @${m.sender.split('@')[0].split(':')[0]}\n│ \n│ Bot: ${botname}\n│ Total Commands: ${totalCommands}\n│ Time: ${getCurrentTimeInNairobi()}\n│ Prefix: ${effectivePrefix || 'None'}\n│ Mode: ${mode}\n│ Library: Baileys\n╰───────────────\n\n`;

    for (const category of categories) {
      let commandFiles;
      try {
        commandFiles = fs.readdirSync(`./plugins/${category.name}`).filter(file => file.endsWith('.js') && file !== 'links.js' && file !== 'autoreport.js' && file !== 'fullpp.js');
      } catch (e) { continue; }

      if (commandFiles.length === 0 && category.name !== 'NSFW') continue;

      menuText += `╭─❏ 「 ${category.display}」\n`;

      if (category.name === 'NSFW') {
        menuText += `│ *${toFancyFont('xvideo')}*\n`;
      }

      for (const file of commandFiles) {
        const displayName = file.replace('.js', '');
        menuText += `│ *${toFancyFont(displayName)}*\n`;
      }

      menuText += `╰───────────────\n\n`;
    }

    let imgBuffer = pict && pict.length > 0 ? pict : null;
    if (!imgBuffer) {
      for (const p of ['./toxic.jpg', './media/toxic.jpg', './lib/toxic.jpg', './assets/toxic.jpg']) {
        if (fs.existsSync(p)) {
          imgBuffer = fs.readFileSync(p);
          break;
        }
      }
    }

    if (imgBuffer) {
      await client.sendMessage(m.chat, {
        image: imgBuffer,
        caption: menuText.trim(),
        contextInfo: { mentionedJid: [m.sender] }
      });
    } else {
      await client.sendMessage(m.chat, {
        text: menuText.trim(),
        contextInfo: { mentionedJid: [m.sender] }
      });
    }

    const device = await getDeviceMode();
    if (device === 'ios') {
      client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
      return;
    }

    try {
      const btnV2 = new ButtonV2(client);
      btnV2.setBody(`╭─❏ 「 Quick Nav」\n│ Tap a category to jump to it\n╰───────────────`)
          .addButton('📜 General', `${effectivePrefix || '.'}generalmenu`)
          .addButton('😇 Owner', `${effectivePrefix || '.'}ownermenu`)
          .addButton('👥 Groups', `${effectivePrefix || '.'}groupmenu`);
      await btnV2.send(m.chat, { userJid: client.user?.id || '', mentions: [m.sender] });
    } catch {}
    client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
  }
};
