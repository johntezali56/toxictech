import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { botname } from '../../config/settings.js';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { getGreeting } from '../../lib/language.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const getTimeGreeting = () => {
    try { return getGreeting(); } catch {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Good morning';
        if (hour >= 12 && hour < 17) return 'Good afternoon';
        if (hour >= 17 && hour < 21) return 'Good evening';
        return 'Good night';
    }
};

export default {
  name: 'alive',
  aliases: ['bot', 'test', 'isalive', 'status'],
  description: 'Checks if the bot is alive and running',
  run: async (context) => {
    const { client, m, prefix, pict } = context;
    client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});

    const greeting = getTimeGreeting();

    try {
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const mins = Math.floor((uptime % 3600) / 60);
      const secs = Math.floor(uptime % 60);
      const uptimeStr = `${days}d ${hours}h ${mins}m ${secs}s`;

      let displayJid = m.sender;
      if (displayJid && String(displayJid).endsWith('@lid')) {
        try {
          if (globalThis.resolvePhoneFromLid) {
            const p = globalThis.resolvePhoneFromLid(displayJid);
            if (p && !String(p).endsWith('@lid')) {
              const n = String(p).replace(/\D/g, '');
              if (n && n.length >= 7 && n.length <= 15) displayJid = n + '@s.whatsapp.net';
            }
          }
          if (String(displayJid).endsWith('@lid') && client?.signalRepository?.lidMapping?.getPNForLID) {
            const pn = await client.signalRepository.lidMapping.getPNForLID(displayJid).catch(() => null);
            if (pn && typeof pn === 'string' && String(pn).includes('@s.whatsapp.net')) {
              const n = pn.split('@')[0].replace(/\D/g, '');
              if (n && n.length >= 7 && n.length <= 15) displayJid = n + '@s.whatsapp.net';
            }
          }
          if (String(displayJid).endsWith('@lid') && m.key) {
            const alt = m.key.participantAlt || m.key.remoteJidAlt;
            if (alt && String(alt).endsWith('@s.whatsapp.net')) displayJid = alt;
          }
        } catch {}
      }
      const stillLid = String(displayJid).endsWith('@lid');
      const name = m.pushName || m.name || 'there';
      const tag = stillLid ? null : (String(displayJid).split('@')[0].split(':')[0].replace(/\D/g, '') || null);
      const who = stillLid ? name : ('@' + tag);
      const caption = `╭─❏ 「 I'ᴍ Aʟɪᴠᴇ」\n│ ${greeting}, ${who}!\n│ I'm up and running.\n│ Been alive for ${uptimeStr}.\n│ Type *${prefix}menu* if you need\n│ help, which you probably do.\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`;
      const mentionList = stillLid ? [] : [displayJid];

      const imgBuffer = getToxicImage(pict);
      if (imgBuffer) {
        await client.sendMessage(m.chat, { image: imgBuffer, caption: caption, mentions: mentionList });
      } else {
        await client.sendMessage(m.chat, { text: caption, mentions: mentionList });
      }

      const possibleAudioPaths = [
        path.join(__dirname, '../../media/alive.mp3'),
        path.join(__dirname, '../../lib/alive.mp3'),
        path.join(__dirname, '../../assets/alive.mp3'),
        path.join(process.cwd(), 'media', 'alive.mp3'),
        path.join(process.cwd(), 'toxic-alive.mp3')
      ];

      for (const audioPath of possibleAudioPaths) {
        try {
          if (fs.existsSync(audioPath)) {
            await client.sendMessage(m.chat, {
              audio: { url: audioPath },
              ptt: true,
              mimetype: 'audio/mpeg',
              fileName: 'toxic-alive.mp3'
            });
            break;
          }
        } catch (err) {}
      }

      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    } catch (error) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      await sendInteractive(client, m, `╭─❏ 「 Cʀᴀsʜᴇᴅ」\n│ Something broke.\n│ Error: ${error.message}\n│ Try again when I feel like it.\n╰───────────────`);
    }
  }
};
