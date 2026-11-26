import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSettings } from '../../database/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getToxicImage(pict) {
  if (pict && Buffer.isBuffer(pict) && pict.length > 0) return pict;
  const candidates = [
    path.join(process.cwd(), 'toxic.jpg'),
    path.resolve(__dirname, '../../toxic.jpg'),
    path.join(process.cwd(), 'media', 'toxic.jpg'),
    path.join(process.cwd(), 'lib', 'toxic.jpg'),
    path.join(process.cwd(), 'assets', 'toxic.jpg'),
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

export default {
  name: 'settingsmenu',
  aliases: ['setmenu'],
  description: 'Displays only the Settings menu',
  run: async (context) => {
    const { client, m, pict } = context;
    client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});

    const settings = await getSettings();
    const effectivePrefix = settings.prefix || '';

    let menuText =
      `╭━━━〔 ⚡ 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮 ⚡ 〕━━━╮\n` +
      `┃ 🔮 *Category:* SETTINGS MENU\n` +
      `┃ ⚡ *Prefix:* ${effectivePrefix || 'None'}\n` +
      `💠────────────────💠\n`;

    const pluginDir = path.join(process.cwd(), 'plugins', 'Settings');
    let commandFiles = [];
    try {
      commandFiles = fs.readdirSync(pluginDir).filter(file => file.endsWith('.js'));
    } catch {}

    for (const file of commandFiles) {
      const commandName = file.replace('.js', '');
      menuText += `┃ 💎 *${toFancyFont(commandName)}*\n`;
    }

    menuText +=
      `💠────────────────💠\n` +
      `┃ ✨ _Powered by 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮_\n` +
      `╰━━━━━━━━━━━━━━━━━━╯`;

    const imgBuffer = getToxicImage(pict);
    if (imgBuffer) {
      await client.sendMessage(m.chat, { image: imgBuffer, caption: menuText });
    } else {
      await client.sendMessage(m.chat, { text: menuText });
    }
    client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
  }
};
