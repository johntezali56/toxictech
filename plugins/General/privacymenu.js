import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSettings } from '../../lib/fastSettings.js';

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

export default {
  name: 'privacymenu',
  aliases: ['privacycommands', 'privacycmds'],
  description: 'Displays all Privacy commands',
  run: async (context) => {
    const { client, m, totalCommands, mode, pict } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey || m.key } }).catch(() => {});

    const settings = await getSettings();
    const effectivePrefix = settings?.prefix || '.';
    const senderNum = m.sender.split('@')[0].split(':')[0];

    let commandFiles = [];
    try {
      commandFiles = fs.readdirSync('./plugins/Privacy').filter(file => file.endsWith('.js') && file !== 'links.js');
    } catch {}

    let commandsList = [];
    for (const file of commandFiles) {
      let displayName = file.replace('.js', '');
      try {
        const { pathToFileURL } = await import('url');
        const modUrl = pathToFileURL(path.join(process.cwd(), 'plugins', 'Privacy', file)).href;
        const modRaw = await import(modUrl);
        const mod = modRaw.default !== undefined ? modRaw.default : modRaw;
        if (Array.isArray(mod)) {
          for (const cmd of mod) {
            if (cmd && cmd.name) commandsList.push(cmd.name);
          }
          continue;
        }
        if (mod && typeof mod === 'object' && mod.name && typeof mod.name === 'string') {
          displayName = mod.name;
        }
      } catch {}
      commandsList.push(displayName);
    }

    if (commandsList.length === 0 && 'Privacy' === 'NSFW') {
      commandsList = ['xvideo'];
    }

    let menuText =
      `┌── ( 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮 ) ──┐\n` +
      `│ ${getGreeting()}, @${senderNum}\n` +
      `│ Bot: Toxic-MD\n` +
      `│ Total Commands: ${totalCommands || commandsList.length}\n` +
      `│ Time: ${getCurrentTimeInNairobi()}\n` +
      `│ Prefix: ${effectivePrefix}\n` +
      `│ Mode: ${mode || 'Private'}\n` +
      `│ Library: Baileys\n` +
      `└────────────────────\n\n` +
      `┌──『 🔒 PRIVACY 🔏 』\n`;

    for (const cmd of commandsList) {
      menuText += `│ ◈ ${effectivePrefix}${cmd}\n`;
    }

    menuText += `└────────────────────\n` +
      `> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;

    const imgBuffer = getToxicImage(pict);
    if (imgBuffer) {
      await client.sendMessage(m.chat, {
        image: imgBuffer,
        caption: menuText,
        mentions: [m.sender]
      }, { quoted: m });
    } else {
      await client.sendMessage(m.chat, {
        text: menuText,
        mentions: [m.sender]
      }, { quoted: m });
    }

    await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey || m.key } }).catch(() => {});
  }
};
