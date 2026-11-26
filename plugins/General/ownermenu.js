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

export default {
  name: 'ownermenu',
  aliases: ['ownerlist', 'ownmenu'],
  description: 'Displays Owner commands',
  run: async (context) => {
    const { client, m, totalCommands, mode, pict, botname } = context;
    await client.sendMessage(m.chat, { react: { text: '👑', key: m.key } }).catch(() => {});

    const settings = await getSettings();
    const effectivePrefix = settings.prefix || '.';

    let commandFiles = [];
    try {
      commandFiles = fs
        .readdirSync('./plugins/Owner')
        .filter((file) => file.endsWith('.js') && file !== 'links.js' && file !== 'fullpp.js');
    } catch {}

    const header = buildHeaderBox({
      sender: m.sender,
      botname: botname || 'Toxic-MD',
      totalCommands,
      prefix: effectivePrefix,
      mode
    });

    let menuText = `${header}\n\n`;
    menuText += `┌──『 👑 OWNER 』\n`;

    for (const file of commandFiles) {
      let displayName = file.replace('.js', '');
      try {
        const { pathToFileURL } = await import('url');
        const modUrl = pathToFileURL(path.join(process.cwd(), 'plugins', 'Owner', file)).href;
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
  }
};
