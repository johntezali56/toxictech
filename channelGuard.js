const REQUIRED_CHANNEL_JID = '120363401477293681@newsletter';
const REQUIRED_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb68vX83wtb322L48y1o';

const followCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function enforceChannelFollow(client, m) {
  try {
    const botId = (client.user?.id || '').split(':')[0];
    if (!botId) return true;

    const cached = followCache.get(botId);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      if (!cached.following) {
        await sendChannelPrompt(client, m);
        return false;
      }
      return true;
    }

    let isFollowing = false;

    if (typeof client.newsletterMetadata === 'function') {
      try {
        const meta = await client.newsletterMetadata('invite', '0029Vb68vX83wtb322L48y1o');
        if (meta && (meta.viewer_metadata?.role || meta.id === REQUIRED_CHANNEL_JID)) {
          if (meta.viewer_metadata && meta.viewer_metadata.role !== 'GUEST') {
            isFollowing = true;
          }
        }
      } catch {}
    }

    if (!isFollowing && typeof client.newsletterSubscribed === 'function') {
      try {
        const subs = await client.newsletterSubscribed();
        if (Array.isArray(subs)) {
          isFollowing = subs.some(
            (ch) => ch.id === REQUIRED_CHANNEL_JID || String(ch.id || '').includes('120363401477293681')
          );
        }
      } catch {}
    }

    if (isFollowing) {
      followCache.set(botId, { following: true, time: Date.now() });
      return true;
    }

    if (typeof client.newsletterFollow === 'function') {
      try {
        await client.newsletterFollow(REQUIRED_CHANNEL_JID);
        followCache.set(botId, { following: true, time: Date.now() });
        return true;
      } catch {}
    }

    followCache.set(botId, { following: false, time: Date.now() });
    await sendChannelPrompt(client, m);
    return false;
  } catch {
    return true;
  }
}

async function sendChannelPrompt(client, m) {
  try {
    const chat = m.chat || m.key?.remoteJid;
    if (!chat) return;
    await client.sendMessage(chat, {
      text: `⚠️ *Channel Follow Required!*\n\nYou unfollowed or left the official *ToxicTech* WhatsApp Channel.\nFollow the channel below to unlock the bot again:\n\n👉 ${REQUIRED_CHANNEL_URL}`
    }, { quoted: m });
  } catch {}
}
