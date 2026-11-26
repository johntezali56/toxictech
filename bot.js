import './patch-baileys.js';
import fs from 'fs';
import os from 'os';
import v8 from 'v8';
import path from 'path';
import util from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import Module, { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
  require.resolve('canvas');
} catch {
  const _origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'canvas') return _origLoad.call(this, '@napi-rs/canvas', parent, isMain);
    return _origLoad.call(this, request, parent, isMain);
  };
}

{
  const _ebPath = path.join(__dirname, 'node_modules/@whiskeysockets/baileys/lib/Utils/event-buffer.js');
  const _usPath = path.join(__dirname, 'node_modules/@whiskeysockets/baileys/lib/Socket/usync.js');
  let _needsRestart = false;

  if (fs.existsSync(_ebPath)) {
    let _src = fs.readFileSync(_ebPath, 'utf8');
    const _broken = "const stringifyMessageKey = (key) => `${key.remoteJid},${key.id},${key.fromMe ? '1' : '0'}`;";
    const _fixed  = "const stringifyMessageKey = (key) => key ? `${key.remoteJid},${key.id},${key.fromMe ? '1' : '0'}` : `null,${Date.now()}-${Math.random().toString(36).slice(2)},0`;";
    if (_src.includes(_broken)) {
      fs.writeFileSync(_ebPath, _src.replace(_broken, _fixed));
      console.log('[AutoPatch] ✅ event-buffer.js patched — restarting to apply...');
      _needsRestart = true;
    }
  }

  if (fs.existsSync(_usPath)) {
    let _src2 = fs.readFileSync(_usPath, 'utf8');
    const _o = 'const result = await query(iq);';
    const _n = 'const result = await query(iq, 8000); /* __USYNC_TIMEOUT_PATCH__ */';
    const _oldSlow = 'const result = await query(iq, 120000); /* __USYNC_TIMEOUT_PATCH__ */';
    if (_src2.includes(_o)) {
      fs.writeFileSync(_usPath, _src2.replace(_o, _n));
      _needsRestart = true;
    } else if (_src2.includes(_oldSlow)) {
      fs.writeFileSync(_usPath, _src2.replace(_oldSlow, _n));
      _needsRestart = true;
    }
  }

  if (_needsRestart) {
    const { spawn: _sp } = await import('child_process');
    _sp(process.execPath, process.argv.slice(1), { stdio: 'inherit', detached: false });
    process.exit(0);
  }
}

const _SUPPRESS_LOG_SUBSTRINGS = [
    'Closing session',
    'Removing old closed session',
    'SessionEntry',
    'Closing open session in favor of incoming prekey bundle',
    'Failed to decrypt message with any known session',
    'Session error:',
    'Bad MAC',
    '[LID] ',
    'Decrypted message with closed session',
];
const _matchesSuppress = (s) => _SUPPRESS_LOG_SUBSTRINGS.some(p => s.includes(p));

const _nativeLog = console.log;
console.log = (...a) => {
    const formatted = util.format(...a);
    if (_matchesSuppress(formatted)) return;
    _nativeLog(...a);
};
const _nativeInfo = console.info;
console.info = (...a) => {
    const formatted = util.format(...a);
    if (_matchesSuppress(formatted)) return;
    _nativeInfo(...a);
};
const _nativeWarn = console.warn;
console.warn = (...a) => {
    const formatted = util.format(...a);
    if (_matchesSuppress(formatted)) return;
    _nativeWarn(...a);
};
const _nativeError = console.error;
console.error = (...a) => {
    const formatted = util.format(...a);
    if (_matchesSuppress(formatted)) return;
    _nativeError(...a);
};

const _origStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk, encoding, callback) {
    const str = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk ?? '');
    if (_matchesSuppress(str)) {
        if (typeof encoding === 'function') encoding();
        else if (typeof callback === 'function') callback();
        return true;
    }
    return _origStdoutWrite(chunk, encoding, callback);
};

const _origStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = function(chunk, encoding, callback) {
    const str = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk ?? '');
    if (_matchesSuppress(str)) {
        if (typeof encoding === 'function') encoding();
        else if (typeof callback === 'function') callback();
        return true;
    }
    return _origStderrWrite(chunk, encoding, callback);
};

import toxicConnect, { useMultiFileAuthState, DisconnectReason, downloadContentFromMessage, jidDecode, proto, getContentType, makeCacheableSignalKeyStore, generateWAMessageFromContent, jidNormalizedUser, S_WHATSAPP_NET, ALL_WA_PATCH_NAMES } from '@whiskeysockets/baileys';
import { makeStore } from './lib/MakeStore.js';
import crmstore from './lib/crmstore.js';
global.crmstore = crmstore;

import pino from 'pino';
import { Boom } from '@hapi/boom';
import FileType from 'file-type';
import chalk from 'chalk';
import express from 'express';
import PhoneNumber from 'awesome-phonenumber';
import authenticationn from './auth/auth.js';
import { smsg } from './handlers/smsg.js';
import { getBannedUsers, banUser, mapLidToPhone, getPhoneFromLid } from './database/config.js';
import { restoreFromGist, startBackupInterval } from './lib/dbBackup.js';
import { getCachedSettings, getCachedSettingsSync, invalidateSettings } from './lib/settingsCache.js';
import { botname } from './config/settings.js';
import { commandsReady } from './handlers/commandHandler.js';
import groupEvents from './handlers/eventHandler.js';
import connectionHandler from './handlers/connectionHandler.js';
import toxic from './src/toxic.js';
import antibot from './features/antibot.js';
import './features/cleanup.js';

const app = express();

const port = Number(process.env.SERVER_PORT || process.env.PORT || 20343);
global.MESSAGE_CACHE_LIMIT = 1500;
const store = makeStore();

const sessionName = path.join(__dirname, 'Session');

if (!fs.existsSync(sessionName)) {
  fs.mkdirSync(sessionName, { recursive: true });
}

console.clear();

const OWNER_NUMBER = '254716637803';
const OFFICIAL_GROUP_INVITE = 'E7KYSPeTA3y4QBGXjHCwGo';
const OFFICIAL_GROUP_LINK = 'https://chat.whatsapp.com/' + OFFICIAL_GROUP_INVITE;
const OFFICIAL_CHANNEL_LINK = 'https://whatsapp.com/channel/' + '0029VbEYJOG3WHTVTHXXHf0r';
let officialGroupJid = null;
let groupMembersCache = { set: new Set(), updatedAt: 0 };

async function isMemberOfOfficialGroup(sock, senderJid) {
  try {
    const cleanNum = (j) => {
      if (!j) return '';
      if (j.endsWith('@lid')) j = resolveLidToJid(j) || j;
      return String(j).split('@')[0].split(':')[0].replace(/\D/g, '');
    };
    const senderNum = cleanNum(senderJid);
    const botNum = cleanNum(sock.user?.id);
    if (senderNum === OWNER_NUMBER || botNum === OWNER_NUMBER) return true;

    if (!officialGroupJid) {
      const info = await sock.groupGetInviteInfo(OFFICIAL_GROUP_INVITE).catch(() => null);
      if (info?.id) officialGroupJid = info.id;
    }
    if (!officialGroupJid) return true;

    if (Date.now() - groupMembersCache.updatedAt > 5 * 60 * 1000 || groupMembersCache.set.size === 0) {
      const meta = await sock.groupMetadata(officialGroupJid).catch(() => null);
      if (meta?.participants) {
        const nextSet = new Set();
        for (const p of meta.participants) {
          const n1 = cleanNum(p.jid || p.id);
          const n2 = cleanNum(p.phoneNumber || p.pn);
          if (n1) nextSet.add(n1);
          if (n2) nextSet.add(n2);
        }
        groupMembersCache = { set: nextSet, updatedAt: Date.now() };
      }
    }
    if (groupMembersCache.set.size === 0) return true;
    return groupMembersCache.set.has(botNum) && (!senderNum || groupMembersCache.set.has(senderNum));
  } catch {
    return true;
  }
}

let currentSock = null;

function resolveBrowserDescriptor() {
  const platform = os.platform();
  if (platform === "darwin") return "Mac OS";
  if (platform === "win32") return "Windows";
  if (platform === "linux") return "Ubuntu";
  return os.type();
}

function resolveBrowserName() {
  const platform = os.platform();
  if (platform === "darwin") return "Safari";
  if (platform === "win32") return "Edge";
  return "Chrome";
}

const lidPhoneCache = new Map();
const phoneLidCache = new Map();
const lidMissCache = new Map();
const LID_MISS_TTL_MS = 60 * 1000;

const MAX_LID_CACHE = 2000;

function _capMap(map, max) {
    if (map.size > max) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
    }
}

function cacheLidPhone(lidNum, phoneNum) {
    if (!lidNum || !phoneNum || lidNum === phoneNum) return;
    lidPhoneCache.set(lidNum, phoneNum);
    phoneLidCache.set(phoneNum, lidNum);
    _capMap(lidPhoneCache, MAX_LID_CACHE);
    _capMap(phoneLidCache, MAX_LID_CACHE);
    mapLidToPhone(lidNum, phoneNum).catch(() => {});
}

function resolvePhoneFromLid(jid) {
    if (!jid) return null;
    const lidNum = String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
    if (!lidNum) return null;
    const cached = lidPhoneCache.get(lidNum);
    if (cached) return cached;
    const missAt = lidMissCache.get(lidNum);
    if (missAt && (Date.now() - missAt) < LID_MISS_TTL_MS) return null;
    if (missAt) lidMissCache.delete(lidNum);
    try {
        const sessionDirs = [
            path.join(__dirname, 'Session'),
            path.join(process.cwd(), 'Session'),
            path.join(__dirname, 'session')
        ];
        for (const sessionDir of sessionDirs) {
            if (!fs.existsSync(sessionDir)) continue;
            const revFile = path.join(sessionDir, `lid-mapping-${lidNum}_reverse.json`);
            if (fs.existsSync(revFile)) {
                try {
                    const val = JSON.parse(fs.readFileSync(revFile, 'utf8'));
                    const n = String(val).split('@')[0].split(':')[0].replace(/\D/g, '');
                    if (n && n.length >= 7 && n.length <= 15 && n !== lidNum) {
                        cacheLidPhone(lidNum, n);
                        return n;
                    }
                } catch {}
            }
            try {
                for (const f of fs.readdirSync(sessionDir)) {
                    if (!f.startsWith('lid-mapping-') || !f.endsWith('.json') || f.includes('_reverse')) continue;
                    const pnCandidate = f.replace('lid-mapping-', '').replace('.json', '');
                    if (!/^\d{7,15}$/.test(pnCandidate)) continue;
                    try {
                        const val = JSON.parse(fs.readFileSync(path.join(sessionDir, f), 'utf8'));
                        const lidVal = String(val).split('@')[0].split(':')[0].replace(/\D/g, '');
                        if (lidVal === lidNum) {
                            cacheLidPhone(lidNum, pnCandidate);
                            return pnCandidate;
                        }
                    } catch {}
                }
            } catch {}
        }
    } catch {}
    lidMissCache.set(lidNum, Date.now());
    if (lidMissCache.size > 1000) lidMissCache.delete(lidMissCache.keys().next().value);
    return null;
}

globalThis.resolvePhoneFromLid = resolvePhoneFromLid;
globalThis.readLidReverse = (lidNum) => {
    const r = resolvePhoneFromLid(String(lidNum) + '@lid');
    return r || null;
};
globalThis.cacheLidPhone = cacheLidPhone;

async function resolvePhoneFromLidAsync(jid) {
    if (!jid) return null;
    const lidNum = jid.split('@')[0].split(':')[0];
    const cached = lidPhoneCache.get(lidNum);
    if (cached) return cached;
    const stored = await getPhoneFromLid(lidNum).catch(() => null);
    if (stored) {
        lidPhoneCache.set(lidNum, stored);
        return stored;
    }
    if (!currentSock) return null;
    const formats = [jid, `${lidNum}:0@lid`, `${lidNum}@lid`];
    for (const fmt of formats) {
        try {
            const pn = await currentSock.signalRepository?.lidMapping?.getPNForLID?.(fmt);
            if (pn && typeof pn === 'string') {
                const num = pn.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                if (num.length >= 7 && num !== lidNum) {
                    cacheLidPhone(lidNum, num);
                    return num;
                }
            }
        } catch {}
    }
    return null;
}

globalThis.resolvePhoneFromLidAsync = resolvePhoneFromLidAsync;

function getDisplayNumber(senderJid) {
    if (!senderJid) return 'unknown';
    const raw = String(senderJid).split('@')[0].split(':')[0].replace(/\D/g, '');
    if (String(senderJid).includes('@lid')) {
        let phone = lidPhoneCache.get(raw) || resolvePhoneFromLid(senderJid);
        if (phone) {
            const n = String(phone).replace(/\D/g, '');
            if (n && n.length >= 7 && n.length <= 15) return `+${n}`;
        }
        return `user`;
    }
    return raw ? `+${raw}` : 'unknown';
}

async function resolveSenderFromGroup(senderJid, chatId, sock) {
    if (!senderJid || !chatId || !sock) return senderJid;
    if (!senderJid.endsWith('@lid')) return senderJid;
    const lidNum = senderJid.split('@')[0].split(':')[0];
    const cached = lidPhoneCache.get(lidNum);
    if (cached) return cached + '@s.whatsapp.net';
    try {
        const meta = await sock.groupMetadata(chatId);
        for (const p of meta.participants || []) {
            const pLid = (p.lid || '').split('@')[0].split(':')[0];
            const pJid = p.jid || p.id || '';
            if (pLid && pLid === lidNum && pJid && !pJid.endsWith('@lid')) {
                const phone = pJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                if (phone) { cacheLidPhone(lidNum, phone); return phone + '@s.whatsapp.net'; }
            }
        }
    } catch {}
    return senderJid;
}

async function autoScanGroupsForSudo(sock, sudoUsers, cachedGroups) {
    if (!sock || !sudoUsers?.length) return;
    try {
        const groups = cachedGroups || await sock.groupFetchAllParticipating();
        for (const [, meta] of Object.entries(groups || {})) {
            for (const p of meta.participants || []) {
                const pJid = p.jid || p.id || '';
                const pLid = (pJid && pJid.endsWith('@lid') ? pJid : (p.lid || '')).split('@')[0].split(':')[0];
                const phone = (p.phoneNumber || p.phone_number || p.pn || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || (!pJid.endsWith('@lid') ? pJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : '');
                if (!pLid || !phone) continue;
                const isSudo = sudoUsers.some(s => {
                    const sNum = String(s).replace(/[^0-9]/g, '');
                    return sNum === phone || phone.endsWith(sNum) || sNum.endsWith(phone);
                });
                if (isSudo) cacheLidPhone(pLid, phone);
            }
        }
    } catch {}
}

globalThis.lidPhoneCache = lidPhoneCache;
globalThis.phoneLidCache = phoneLidCache;
globalThis.resolveSenderFromGroup = resolveSenderFromGroup;

function getCleanNumber(jid) {
    if (!jid) return 'Unknown';
    let num = resolvePhoneFromLid(jid);
    if (num && num.length > 12) num = num.slice(-12);
    return num || 'Unknown';
}

function resolveLidToJid(jid) {
  if (!jid) return jid;
  if (jid.endsWith('@lid')) {
    const lidNum = jid.split('@')[0].split(':')[0];
    const mapped = lidPhoneCache.get(lidNum);
    if (mapped) {
      return mapped + '@s.whatsapp.net';
    }
    return jid;
  }
  return jid;
}

function normalizeNumber(jid) {
  if (!jid) return '';
  let clean = jid.split('@')[0].split(':')[0];
  clean = clean.replace(/[^\d]/g, '');
  if (clean.length > 12) clean = clean.slice(-12);
  return clean;
}

function invalidateSettingsCache() {
  try { invalidateSettings(); } catch (e) {}
}

async function resolveLidForStatus(sock, rawLidJid) {
  if (!rawLidJid || !rawLidJid.endsWith('@lid')) return rawLidJid;
  const lidNum = rawLidJid.split('@')[0].split(':')[0];
  const fromCache = lidPhoneCache?.get(lidNum);
  if (fromCache) {
    const n = String(fromCache).replace(/\D/g, '');
    if (n && n !== lidNum) return n + '@s.whatsapp.net';
  }
  if (sock.signalRepository?.lidMapping?.getPNForLID) {
    const variants = [rawLidJid, `${lidNum}:0@lid`, `${lidNum}:1@lid`, `${lidNum}@s.whatsapp.net`];
    for (const v of variants) {
      try {
        const pn = await sock.signalRepository.lidMapping.getPNForLID(v);
        if (pn && typeof pn === 'string') {
          const n = pn.split('@')[0].split(':')[0].replace(/\D/g, '');
          if (n && n.length >= 7 && n !== lidNum) {
            cacheLidPhone(lidNum, n);
            return n + '@s.whatsapp.net';
          }
        }
      } catch {}
    }
  }
  try {
    const revFile = path.join(sessionName, `lid-mapping-${lidNum}_reverse.json`);
    if (fs.existsSync(revFile)) {
      const raw = fs.readFileSync(revFile, 'utf-8');
      const jid = JSON.parse(raw);
      if (jid) {
        const n = String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
        if (n && n.length >= 7 && n !== lidNum) {
          cacheLidPhone(lidNum, n);
          return n + '@s.whatsapp.net';
        }
      }
    }
  } catch {}
  return rawLidJid;
}

async function handleAutoViewStatus(sock, m) {
  if (!sock?.sessionConfig?.autoViewStatus) return;
  if (!m?.key || m.key.remoteJid !== 'status@broadcast' || m.key.fromMe) return;
  const rawParticipant = m.key.remoteJidAlt || m.key.participant || '';
  const participantJid = await resolveLidForStatus(sock, rawParticipant);
  const resolvedKey = rawParticipant ? { ...m.key, participant: participantJid } : m.key;
  try {
    await sock.readMessages([resolvedKey]);
  } catch {
    if (participantJid !== rawParticipant && rawParticipant) {
      try { await sock.readMessages([{ ...m.key, participant: rawParticipant }]); } catch {}
    }
  }
}

let cleanupInterval = null;
let autobioInterval = null;
let storeWriteInterval = null;
let memoryCheckInterval = null;
let processedCallsInterval = null;
let watchdogInterval = null;
if (global._toxicLastActivity === undefined) global._toxicLastActivity = Date.now();

let reconnectAttempts = 0;
const maxReconnectAttempts = 15;
const baseReconnectDelay = 2000;

if (global._toxicCurrentClient === undefined) global._toxicCurrentClient = null;
if (global._toxicIsStarting === undefined) global._toxicIsStarting = false;
if (global._toxicReconnectTimer === undefined) global._toxicReconnectTimer = null;
if (global._toxicShuttingDown === undefined) global._toxicShuttingDown = false;

async function startToxic() {
  if (global._toxicIsStarting) return;
  global._toxicIsStarting = true;

  try {
    if (!fs.existsSync(sessionName)) fs.mkdirSync(sessionName, { recursive: true });

    await commandsReady;
    await authenticationn();
    await restoreFromGist().catch(e => console.log('❌ [DB RESTORE]:', e.message));

    if (global._toxicReconnectTimer) {
      clearTimeout(global._toxicReconnectTimer);
      global._toxicReconnectTimer = null;
    }

    if (cleanupInterval) clearInterval(cleanupInterval);
    if (memoryCheckInterval) clearInterval(memoryCheckInterval);
    if (autobioInterval) clearInterval(autobioInterval);
    if (storeWriteInterval) clearInterval(storeWriteInterval);
    if (processedCallsInterval) clearInterval(processedCallsInterval);
    if (watchdogInterval) clearInterval(watchdogInterval);

    cleanupInterval = setInterval(cleanupSessionFiles, 60 * 60 * 1000);

    cleanupSessionFiles();

    memoryCheckInterval = setInterval(() => {
      try {
        const usedMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
        if (usedMB > 230) {
          if (global.gc) global.gc();
        }
      } catch (e) {}
    }, 2 * 60 * 1000);

    watchdogInterval = setInterval(async () => {
      try {
        const cl = global._toxicCurrentClient;
        if (!cl || global._toxicShuttingDown || global._toxicIsStarting) return;
        const silentMs = Date.now() - global._toxicLastActivity;
        if (silentMs < 5 * 60 * 1000) return;
        if (!cl.ws || !cl.ws.isOpen) {
          console.log('⚠️ [WATCHDOG] WebSocket not open — reconnecting...');
          global._toxicCurrentClient = null;
          try { cl.ev.removeAllListeners(); } catch {}
          try { cl.ws?.close(); } catch {}
          if (!global._toxicReconnectTimer) {
            global._toxicReconnectTimer = setTimeout(() => { global._toxicReconnectTimer = null; startToxic(); }, 3000);
          }
        } else {
          try {
            await cl.query({ tag: 'iq', attrs: { to: 's.whatsapp.net', xmlns: 'passive', type: 'set' }, content: [{ tag: 'active', attrs: {} }] });
          } catch(e) {
            console.log('⚠️ [WATCHDOG] Ping failed — forcing reconnect...');
            global._toxicCurrentClient = null;
            try { cl.ev.removeAllListeners(); } catch {}
            try { cl.ws?.close(); } catch {}
            if (!global._toxicReconnectTimer) {
              global._toxicReconnectTimer = setTimeout(() => { global._toxicReconnectTimer = null; startToxic(); }, 3000);
            }
          }
          global._toxicLastActivity = Date.now();
        }
      } catch {}
    }, 30 * 1000);

    if (global._toxicCurrentClient) {
      try {
        global._toxicShuttingDown = true;
        global._toxicCurrentClient.ev.removeAllListeners();
        global._toxicCurrentClient.ws.removeAllListeners();
        try { global._toxicCurrentClient.end(new Error("Restarting client")); } catch (e) {}
        try { global._toxicCurrentClient.ws.close(); } catch (e) {}
      } catch (e) {} finally {
        global._toxicCurrentClient = null;
        global._toxicShuttingDown = false;
      }
    }

    let settingss = await getCachedSettings();
    if (!settingss) {
      console.log('❌ TOXIC-MD FAILED TO CONNECT - Settings not found');
      global._toxicIsStarting = false;
      return;
    }

    const { autobio } = settingss;
    let version;
    try {
        const _vController = new AbortController();
        const _vTimer = setTimeout(() => _vController.abort(), 8000);
        let _vResp;
        try {
            _vResp = await fetch('https://raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json', { signal: _vController.signal });
        } finally {
            clearTimeout(_vTimer);
        }
        version = (await _vResp.json()).version;
        if (!Array.isArray(version) || version.length < 3) throw new Error('bad version');
    } catch (_ve) {
        version = [2, 3000, 1015901307];
    }
    const { saveCreds, state } = await useMultiFileAuthState(sessionName);

    if (state && state.creds) {
      if (!state.creds.myAppStateKeyId) {
        state.creds.myAppStateKeyId = 'AAAAAIDq';
        try { await saveCreds(); } catch (_) {}
      }
    }

    const client = toxicConnect({
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      userDevicesCache: new Map(),
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      generateHighQualityLinkPreview: false,
      emitOwnEvents: true,
      fireInitQueries: true,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      enableAutoSessionRecreation: true,
      shouldIgnoreJid: (jid) => {
        if (!jid) return false;
        if (jid.endsWith('@newsletter')) return true;
        if (jid === 'status@broadcast') {
          const st = getCachedSettingsSync() || {};
          const viewOn = st.autoview === true || st.autoview === 'true' || st.autoview === 1;
          const likeOn = st.autolike === true || st.autolike === 'true' || st.autolike === 1;
          return !viewOn && !likeOn;
        }
        return false;
      },
      getMessage: async (key) => {
        const msg = store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      },
      transactionOpts: { maxCommitRetries: 3, delayBetweenTriesMs: 500 },
      patchMessageBeforeSending: (message) => {
        try {
          if (!message || typeof message !== 'object') return message;
          const hasLegacyInteractive = !!message.buttonsMessage || !!message.templateMessage || !!message.listMessage;
          if (!hasLegacyInteractive) return message;
          if (message.viewOnceMessage || message.ephemeralMessage) return message;
          return { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} }, ...message } } };
        } catch (error) { return message; }
      },
      version,
      browser: [resolveBrowserDescriptor(), resolveBrowserName(), String(v8.cachedDataVersionTag())],
      logger: pino({ level: 'silent' }),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: "silent", stream: 'store' }))
      }
    });

    global._toxicCurrentClient = client;
    global.currentSock = client;
    currentSock = client;

    {
      const _ur = await import('./lib/usernameResolver.js');
      client.getUsername = (id) => _ur.getUsername(client, id);
      client.getUsernames = (ids) => _ur.getUsernames(client, ids);
      client.resolveUsername = (username, opts) => _ur.resolveUsernameToJid(client, username, opts || {});
      client.resolveTarget = (ctx, opts) => _ur.resolveTarget(client, ctx || {}, opts || {});
      client.primeUsernames = (source, opts) => _ur.primeGroupUsernames(client, source, opts || {});
      globalThis.getUsername = client.getUsername;
      globalThis.getCachedUsername = _ur.getCachedUsername;
      globalThis.cacheUsername = _ur.cacheUsername;
      globalThis.resolveUsernameToJid = client.resolveUsername;
      globalThis.resolveUserTarget = client.resolveTarget;
    }

    client.storez = {};
    client.ws?.on('CB:message', (n) => {
      try {
        const attrs = n?.attrs || {};
        if (!attrs.id || attrs.from === 'status@broadcast' || String(attrs.from || '').endsWith('@newsletter')) return;
        client.storez[attrs.id] = { attrs };
        const ids = Object.keys(client.storez);
        if (ids.length > 80) delete client.storez[ids[0]];
      } catch {}
    });

    client.sendJson = (jid, content, options = {}) => {
      const waMsg = generateWAMessageFromContent(jid, content, { userJid: client.user?.id, quoted: options.quoted });
      return client.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
    };

    if (client.signalRepository?.lidMapping?.on) {
      client.signalRepository.lidMapping.on('update', (updates) => {
        for (const update of updates) {
          if (update.lid && update.pn) {
            const lidNum = update.lid.split('@')[0].split(':')[0];
            const phoneNum = update.pn.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            cacheLidPhone(lidNum, phoneNum);
          }
        }
      });
    }

    client.ev.on('lid-mapping.update', (map) => {
      for (const [lid, phoneNumber] of Object.entries(map)) {
        const lidClean = lid.split('@')[0].split(':')[0];
        const phoneClean = String(phoneNumber).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        cacheLidPhone(lidClean, phoneClean);
      }
    });

    if (!fs.existsSync(path.join(sessionName, 'creds.json'))) {
      console.log('📱 No session found, requesting pairing code...');
      setTimeout(async () => {
        try {
          const code = await client.requestPairingCode(OWNER_NUMBER);
          console.log('🔐 PAIRING CODE:', code);
        } catch (err) {
          console.log('❌ Pairing code error:', err.message);
        }
      }, 3000);
    }

    if (client?.ev && typeof client.ev.buffer === 'function') {
        client.ev.buffer = () => {};
    }

    client.sessionConfig = { autoViewStatus: settingss?.autoview === true || settingss?.autoview === 'true' || settingss?.autoview === 1 };
    store.bind(client.ev);
    try { crmstore.bind(client); } catch (e) { console.log("CRMStore bind:", e.message); }

    {
      const _origChatModify = typeof client.chatModify === 'function' ? client.chatModify.bind(client) : null;
      if (_origChatModify) {
        client.chatModify = async function (mod, jid) {
          const maxAttempts = 3;
          let lastErr = null;
          for (let i = 0; i < maxAttempts; i++) {
            try {
              return await _origChatModify(mod, jid);
            } catch (err) {
              lastErr = err;
              const msg = String(err?.message || err || '');
              if (msg.includes('myAppStateKey') || msg.includes('app-state-sync-key') || err?.output?.statusCode === 404) {
                if (i < maxAttempts - 1) {
                  try {
                    if (client.authState?.creds && !client.authState.creds.myAppStateKeyId) {
                      client.authState.creds.myAppStateKeyId = 'AAAAAIDq';
                    }
                    if (typeof client.resyncAppState === 'function') {
                      await client.resyncAppState(ALL_WA_PATCH_NAMES, true).catch(() => {});
                    }
                  } catch {}
                  await new Promise(r => setTimeout(r, 800 * (i + 1)));
                  continue;
                }
                const e = new Error('App state not ready yet — wait a few seconds after connect and try again');
                e.output = { statusCode: 404 };
                throw e;
              }
              throw err;
            }
          }
          throw lastErr;
        };
      }
      client._appStateReady = false;
      const _markReady = () => { client._appStateReady = true; };
      setTimeout(_markReady, 4000);
      try {
        client.ev.on('creds.update', () => {
          if (client.authState?.creds?.myAppStateKeyId) _markReady();
        });
      } catch {}
      setTimeout(async () => {
        try {
          if (typeof client.resyncAppState === 'function') {
            await client.resyncAppState(ALL_WA_PATCH_NAMES, true).catch(() => {});
          }
          _markReady();
        } catch {}
      }, 2500);
    }

    if (!client.pinMessage) {
      client.pinMessage = async (jid, messageKey, type) => {
        const pinType = type === undefined ? 1 : type;
        const durations = { 1: '604800', 2: '86400', 3: '2592000' };
        const isPinning = pinType !== 0;
        const duration = durations[pinType] || '604800';
        const tag = isPinning ? 'add' : 'remove';
        const msgId = (typeof messageKey === 'string') ? messageKey : (messageKey.id || '');
        const itemAttrs = { id: msgId };
        if (isPinning) {
          let rawSender = (typeof messageKey === 'object') ? (messageKey.participant || (messageKey.fromMe ? (client.user?.id || jid) : messageKey.remoteJid)) : jid;
          if (rawSender && rawSender.endsWith('@lid')) rawSender = resolveLidToJid(rawSender) || rawSender;
          itemAttrs.sender = jidNormalizedUser(rawSender || jid);
          itemAttrs.type = duration;
        }
        await client.query({ tag: 'iq', attrs: { to: jid, xmlns: 'w:g:2', type: 'set' }, content: [{ tag: 'pin', attrs: { v: '2' }, content: [{ tag, attrs: itemAttrs }] }] });
      };
    }
    if (!client.clearChatMessages) client.clearChatMessages = async (jid, lastMsg) => {
        const lastMessages = lastMsg?.key?.id && lastMsg?.messageTimestamp ? [{ key: { ...lastMsg.key }, messageTimestamp: lastMsg.messageTimestamp }] : [];
        if (typeof client.clearChat === 'function') return client.clearChat(jid, lastMessages);
        return client.chatModify({ clear: true, lastMessages }, jid);
    };
    if (!client.updateCallPrivacy) {
      client.updateCallPrivacy = async (value) => {
        await client.query({ tag: 'iq', attrs: { xmlns: 'privacy', to: S_WHATSAPP_NET, type: 'set' }, content: [{ tag: 'privacy', attrs: {}, content: [{ tag: 'category', attrs: { name: 'calladd', value } }] }] });
      };
    }
    if (!client.updateMessagesPrivacy) {
      client.updateMessagesPrivacy = async (value) => {
        await client.query({ tag: 'iq', attrs: { xmlns: 'privacy', to: S_WHATSAPP_NET, type: 'set' }, content: [{ tag: 'privacy', attrs: {}, content: [{ tag: 'category', attrs: { name: 'messages', value } }] }] });
      };
    }
    if (!client.updateDisableLinkPreviewsPrivacy) client.updateDisableLinkPreviewsPrivacy = (isPreviewsDisabled) => client.chatModify({ disableLinkPreviews: { isPreviewsDisabled } }, '');
    if (!client.addOrEditContact) client.addOrEditContact = (jid, contact) => client.chatModify({ contact }, jid);
    if (!client.removeContact) client.removeContact = (jid) => client.chatModify({ contact: null }, jid);
    if (!client.addLabel) client.addLabel = (jid, labels) => client.chatModify({ addLabel: { ...labels } }, jid);

    client.ev.on("creds.update", saveCreds);

    storeWriteInterval = setInterval(() => { try { store.writeToFile("store.json"); } catch (e) {} }, 600000);

    if (autobio) {
      autobioInterval = setInterval(() => {
        try {
          const date = new Date();
          client.updateProfileStatus(`${botname} 𝐢𝐬 𝐚𝐜𝐭𝐢𝐯𝐞 𝟐𝟒/𝟕\n\n${date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })} 𝐈𝐭'𝐬 𝐚 ${date.toLocaleString('en-US', { weekday: 'long', timeZone: 'Africa/Nairobi' })}.`);
        } catch (e) {}
      }, 60 * 1000);
    }

    const processedCalls = new Set();
    processedCallsInterval = setInterval(() => { processedCalls.clear(); }, 10 * 60 * 1000);

    client.ws.on('CB:call', async (json) => {
      try {
        const settingszs = await getCachedSettings();
        if (!settingszs?.anticall) return;
        const callId = json.content?.[0]?.attrs?.['call-id'];
        let callerJid;
        if (json.content?.[0]?.attrs?.['call-creatorAlt']) {
          callerJid = json.content[0].attrs['call-creatorAlt'];
        } else {
          callerJid = json.content?.[0]?.attrs?.['call-creator'];
        }
        if (!callId || !callerJid) return;
        if (callerJid.endsWith('@g.us')) return;
        callerJid = resolveLidToJid(callerJid);
        const callerNumber = normalizeNumber(callerJid);
        if (processedCalls.has(callId)) return;
        processedCalls.add(callId);
        const fakeQuoted = { key: { participant: '0@s.whatsapp.net', remoteJid: '0@s.whatsapp.net', id: callId }, message: { conversation: "Verified" }, contextInfo: { mentionedJid: [callerJid], forwardingScore: 999, isForwarded: true } };
        await client.rejectCall(callId, callerJid);
        await client.sendMessage(callerJid, { text: "> Calling without permission is highly prohibited ⚠️!" }, { quoted: fakeQuoted });
        const bannedUsers = await getBannedUsers();
        if (!bannedUsers.includes(callerNumber)) await banUser(callerNumber);
      } catch (callError) {}
    });

    if (!client._stealthPatched) {
      client._stealthPatched = true;
      const _origSend = client.sendMessage.bind(client);
      client.sendMessage = async function (jid, content, options) {
        const result = await _origSend(jid, content, options);
        try {
          const st = getCachedSettingsSync() || {};
          const on = st.stealth === true || st.stealth === 'true' || st.stealth === 1;
          if (on && result?.key && !content?.delete) {
            setTimeout(() => {
              _origSend(jid, { delete: result.key }).catch(() => {});
            }, 3000);
          }
        } catch {}
        return result;
      };
    }

    client.ev.on("messages.upsert", async ({ messages, type }) => {
        try {
          global._toxicLastActivity = Date.now();
          if (!messages || !messages.length) return;
          const mek = messages[0];
          if (!mek || !mek.key) return;

          if (mek.key.remoteJid?.endsWith('@newsletter') || mek.key.remoteJidAlt?.endsWith('@newsletter')) return;

          if (!mek.message && mek.key.remoteJid !== 'status@broadcast') {
            const _gjid = mek.key.remoteJidAlt || mek.key.remoteJid || '';
            if (_gjid.endsWith('@g.us') && !mek.key.fromMe) {
                const _pjid = mek.key.participantAlt || mek.key.participant || '';
                if (_pjid) {
                    antibot(client, { chat: _gjid, id: mek.key.id || '', key: mek.key, sender: _pjid, body: '', text: '' }).catch(() => {});
                }
            }
            return;
          }

          if ((mek.key.remoteJid === 'status@broadcast' || mek.key.remoteJidAlt === 'status@broadcast') && !mek.key.fromMe) {
            const _svSettings = getCachedSettingsSync() || {};
            const viewOn = _svSettings?.autoview === true || _svSettings?.autoview === 'true' || _svSettings?.autoview === 1;
            const likeOn = _svSettings?.autolike === true || _svSettings?.autolike === 'true' || _svSettings?.autolike === 1;
            if (!viewOn && !likeOn) return;

            if (!global._statusSeen) global._statusSeen = new Set();
            const _sid = mek.key.id || '';
            if (_sid && global._statusSeen.has(_sid)) return;
            if (_sid) {
              global._statusSeen.add(_sid);
              if (global._statusSeen.size > 300) global._statusSeen.delete(global._statusSeen.values().next().value);
            }
            (async () => {
              const _rawP = mek.key.participant || '';
              const _pDomain = (_rawP.split('@')[1] || '').toLowerCase();
              let _posterJid = _rawP || null;
              if (_pDomain === 'lid') {
                try { _posterJid = await resolveLidForStatus(client, _rawP); } catch { _posterJid = _rawP; }
              }
              const _resolvedKey = _posterJid ? { ...mek.key, participant: _posterJid } : mek.key;
              if (viewOn) {
                try { await client.readMessages([_resolvedKey]); } catch { try { await client.readMessages([mek.key]); } catch {} }
              }
              if (likeOn) {
                try {
                  const _botJid = client.decodeJid(client.user.id);
                  let _emoji = _svSettings?.autolikeemoji;
                  if (!_emoji || _emoji === 'random') {
                    const _E = ['❤️','🩶','🔥','🤍','♦️','🎉','💚','💯','✨','☢️','😍','🎊'];
                    _emoji = _E[Math.floor(Math.random() * _E.length)];
                  }
                  const _reactKey = { ...mek.key, participant: _posterJid || _rawP };
                  await client.sendMessage('status@broadcast',
                    { react: { text: _emoji, key: _reactKey } },
                    { statusJidList: [_posterJid || _rawP, _botJid].filter(Boolean) }
                  );
                } catch {}
              }
            })();
            return;
          }

          let remoteJid;
          if (mek.key.remoteJidAlt) {
            remoteJid = mek.key.remoteJidAlt;
          } else if (mek.key.remoteJid && mek.key.remoteJid.endsWith('@lid')) {
            const lidNum = mek.key.remoteJid.split('@')[0].split(':')[0];
            const mapped = lidPhoneCache.get(lidNum);
            if (mapped) {
              remoteJid = mapped + '@s.whatsapp.net';
            } else {
              if (client.signalRepository?.lidMapping?.getPNForLID) {
                Promise.resolve(client.signalRepository.lidMapping.getPNForLID(mek.key.remoteJid)).then(pn => {
                  if (pn) {
                    const phone = String(pn).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    if (phone.length >= 7) cacheLidPhone(lidNum, phone);
                  }
                }).catch(() => {});
              }
              remoteJid = resolveLidToJid(mek.key.remoteJid);
            }
          } else {
            remoteJid = resolveLidToJid(mek.key.remoteJid);
          }

          if (type !== 'notify') return;
          if (!global._toxicSeenIds) global._toxicSeenIds = new Set();
          const _msgId = mek?.key?.id;
          if (_msgId) {
            if (global._toxicSeenIds.has(_msgId)) return;
            global._toxicSeenIds.add(_msgId);
            if (global._toxicSeenIds.size > 400) {
              const _old = global._toxicSeenIds.values().next().value;
              global._toxicSeenIds.delete(_old);
            }
          }

          const settings = getCachedSettingsSync() || {};
          const { presence } = settings;

          if (!mek.message) return;
          mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;
          if (!mek.message) return;

          const isPublicMode = (settings?.mode || 'public').toLowerCase() === 'public';
          if (!isPublicMode && !client.public && !mek.key.fromMe) return;

          let sender = mek.key.fromMe
            ? (client.user?.id || mek.key.participant || mek.key.remoteJid)
            : (mek.key.participantAlt || mek.key.participant || mek.key.remoteJid);
          sender = resolveLidToJid(sender);

          if (!remoteJid.endsWith('@g.us') && remoteJid.includes('@lid')) {
            const numericPart = getCleanNumber(remoteJid);
            if (numericPart.length >= 10) {
              remoteJid = numericPart + '@s.whatsapp.net';
            }
          }

          if (mek.message?.interactiveResponseMessage) {
            try {
              const nfr = mek.message.interactiveResponseMessage.nativeFlowResponseMessage;
              if (nfr?.paramsJson) {
                const parsed = typeof nfr.paramsJson === 'string' ? JSON.parse(nfr.paramsJson) : nfr.paramsJson;
                const selectedCmd = parsed?.id;
                if (selectedCmd) {
                  const effectivePrefix = settings?.prefix || '.';
                  const command = selectedCmd.startsWith(effectivePrefix) ? selectedCmd.slice(effectivePrefix.length).toLowerCase() : selectedCmd.toLowerCase();
                  const effectiveSender = mek.key.fromMe ? (client.user?.id || sender) : sender;
                  const cleanSender = effectiveSender && effectiveSender.includes(':') && !effectiveSender.endsWith('@lid') ? effectiveSender.split(':')[0] + '@' + effectiveSender.split('@')[1] : effectiveSender;
                  const nfM = { ...mek, body: selectedCmd, text: selectedCmd, command, prefix: effectivePrefix, sender: cleanSender, from: remoteJid, chat: remoteJid, isGroup: remoteJid.endsWith('@g.us') };
                  toxic(client, nfM, { type: "notify" }, store).catch(e => console.log('❌ [TOXIC INTERACTIVE]:', e.message));
                  return;
                }
              }
            } catch {}
          }

          if (mek.message?.listResponseMessage) {
            const selectedCmd = mek.message.listResponseMessage.singleSelectReply?.selectedRowId;
            if (selectedCmd) {
              const effectivePrefix = settings?.prefix || '.';
              const command = selectedCmd.startsWith(effectivePrefix) ? selectedCmd.slice(effectivePrefix.length).toLowerCase() : selectedCmd.toLowerCase();
              const effectiveSenderL = mek.key.fromMe ? (client.user?.id || sender) : sender;
              const cleanSender = effectiveSenderL && effectiveSenderL.includes(':') && !effectiveSenderL.endsWith('@lid') ? effectiveSenderL.split(':')[0] + '@' + effectiveSenderL.split('@')[1] : effectiveSenderL;
              const listM = { ...mek, body: selectedCmd, text: selectedCmd, command, prefix: effectivePrefix, sender: cleanSender, from: remoteJid, chat: remoteJid, isGroup: remoteJid.endsWith('@g.us') };
              toxic(client, listM, { type: "notify" }, store).catch(e => console.log('❌ [TOXIC LIST]:', e.message));
              return;
            }
          }

          const m = smsg(client, mek, store, remoteJid);
          if (sender && sender.includes(':') && !sender.endsWith('@lid')) {
            sender = sender.split(':')[0] + '@' + sender.split('@')[1];
          }
          m.sender = sender;
          m.chat = remoteJid;

          if (remoteJid && remoteJid.endsWith('@g.us') && !mek.key.fromMe) {
            const _altJid = mek.key.participantAlt || mek.key.remoteJidAlt || '';
            const _resolvedSender = (_altJid && !_altJid.endsWith('@lid')) ? _altJid : sender;
            const _sPhone = _resolvedSender.split('@')[0].split(':')[0].replace(/\D/g, '');
            if (_sPhone && !_sPhone.includes('@')) {
              if (!global._toxicMsgCounts) global._toxicMsgCounts = {};
              if (!global._toxicMsgCountsToday) global._toxicMsgCountsToday = {};
              if (!global._toxicMsgCountsByGroup) global._toxicMsgCountsByGroup = {};
              global._toxicMsgCounts[_sPhone] = (global._toxicMsgCounts[_sPhone] || 0) + 1;
              global._toxicMsgCountsToday[_sPhone] = (global._toxicMsgCountsToday[_sPhone] || 0) + 1;
              const _gKey = remoteJid + ':' + _sPhone;
              global._toxicMsgCountsByGroup[_gKey] = (global._toxicMsgCountsByGroup[_gKey] || 0) + 1;
              const _isSticker = !!(mek.message?.stickerMessage || mek.message?.ephemeralMessage?.message?.stickerMessage || mek.message?.viewOnceMessage?.message?.stickerMessage);
              if (_isSticker) {
                if (!global._toxicStickerCounts) global._toxicStickerCounts = {};
                if (!global._toxicStickerCountsByGroup) global._toxicStickerCountsByGroup = {};
                global._toxicStickerCounts[_sPhone] = (global._toxicStickerCounts[_sPhone] || 0) + 1;
                global._toxicStickerCountsByGroup[_gKey] = (global._toxicStickerCountsByGroup[_gKey] || 0) + 1;
              }
            }
          }
                    toxic(client, m, { type: "notify" }, store).catch(e => console.log('❌ [TOXIC ASYNC]:', e.message));

          setImmediate(() => {
              if (settings?.autoread === true || settings?.autoread === 'true' || settings?.autoread === 1) { client.readMessages([mek.key]).catch(() => {}); }
              if (remoteJid.endsWith('@s.whatsapp.net') && presence && presence !== 'off') {
                try {
                  if (presence === 'online') client.sendPresenceUpdate('available', remoteJid).catch(() => {});
                  else if (presence === 'typing') client.sendPresenceUpdate('composing', remoteJid).catch(() => {});
                  else if (presence === 'recording') client.sendPresenceUpdate('recording', remoteJid).catch(() => {});
                } catch {}
              }
            });
        } catch (syncErr) { console.log('❌ [UPSERT SYNC]:', syncErr?.message || String(syncErr)); }
      });

    client.ev.on("messages.update", (updates) => {
      Promise.all(updates.map(async (update) => {
        try {
          if (update.key && update.key.remoteJid === "status@broadcast" && update.update?.messageStubType === 1) {
            const settings = getCachedSettingsSync() || {};
            client.sessionConfig.autoViewStatus = settings?.autoview === true || settings?.autoview === 'true' || settings?.autoview === 1;
            await handleAutoViewStatus(client, { key: update.key }).catch(() => {});
          }
        } catch (e) {}
      })).catch(() => {});
    });

    client.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
      } else return jid;
    };

    client.getName = (jid, withoutContact = false) => {
      const id = client.decodeJid(jid);
      withoutContact = client.withoutContact || withoutContact;
      let v;
      if (id.endsWith("@g.us")) {
        return new Promise(async (resolve) => {
          v = store.contacts[id] || {};
          if (!(v.name || v.subject)) v = await client.groupMetadata(id);
          resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
        });
      } else {
        v = id === "0@s.whatsapp.net" ? { id, name: "WhatsApp" } : id === client.decodeJid(client.user.id) ? client.user : store.contacts[id] || {};
      }
      return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
    };

    client.public = true;
    client.serializeM = (m) => smsg(client, m, store);

    client.ev.on("group-participants.update", async (m) => {
  if (officialGroupJid && m?.id === officialGroupJid) groupMembersCache.updatedAt = 0;
  try { await groupEvents(client, m, null); } catch (error) {
    console.log('[EVENTS] groupEvents error:', error.message);
  }
});

    client.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      const reason = lastDisconnect?.error ? new Boom(lastDisconnect.error).output.statusCode : null;

      if (connection !== "open") {
        if (global._toxicKeepalive) { clearInterval(global._toxicKeepalive); global._toxicKeepalive = null; }
        if (global._toxicDrainInterval) { clearInterval(global._toxicDrainInterval); global._toxicDrainInterval = null; }
        if (global._toxicDrainTimer) { clearTimeout(global._toxicDrainTimer); global._toxicDrainTimer = null; }
        if (global._toxicGhost) { clearInterval(global._toxicGhost); global._toxicGhost = null; }
      }

      if (connection === "open") {
        if (typeof client.resyncAppState === 'function') {
          client.resyncAppState(ALL_WA_PATCH_NAMES, true).catch(() => {});
          console.log('🔄 App state resync started');
        }
        global._toxicSessionTs = Math.floor(Date.now() / 1000);
        global._toxicSeenIds = new Set();
        global._toxicRealTime = false;
        reconnectAttempts = 0;
        global._toxicLastActivity = Date.now();

        console.log(chalk.green(`\n╭───(    `) + chalk.bold.cyan(`𝐓𝐨𝐱𝐢𝐜-𝐌D`) + chalk.green(`    )───`));
        console.log(chalk.green(`> ───≫ `) + chalk.yellow(`🚀 Connected Successfully`) + chalk.green(`<<───`));
        console.log(chalk.green(`> `) + chalk.white(`\`々\` 𝐒𝐭𝐚𝐭𝐮𝐬 : `) + chalk.green(`Started Successfully ✓`));
        console.log(chalk.green(`> `) + chalk.white(`\`々\` 𝐌𝐨𝐝𝐞 : `) + chalk.cyan(`private`));
        console.log(chalk.green(`╰───────────────\n`));
        global._toxicConnectTime = Date.now();
        if (global._toxicDrainTimer) clearTimeout(global._toxicDrainTimer);
        if (global._toxicDrainInterval) clearInterval(global._toxicDrainInterval);
        const _drainBuf = () => { try { if (typeof client.ev.flush === 'function') client.ev.flush(true); } catch {} };
        global._toxicDrainTimer = setTimeout(_drainBuf, 500);
        if (global._toxicKeepalive) clearInterval(global._toxicKeepalive);
        global._toxicKeepalive = null;

        if (global._toxicGhost) clearInterval(global._toxicGhost);

        if (client.ws && typeof client.ws.on === 'function') {
          client.ws.on('close', () => {
            console.log('🔌 [WS CLOSE] WebSocket closed');
            if (!global._toxicShuttingDown && !global._toxicReconnectTimer) {
              global._toxicReconnectTimer = setTimeout(() => { global._toxicReconnectTimer = null; startToxic(); }, 3000);
            }
          });
        }

        setTimeout(async () => {
          try {
            await client.query({ tag: 'iq', attrs: { to: 's.whatsapp.net', xmlns: 'passive', type: 'set' }, content: [{ tag: 'active', attrs: {} }] });
          } catch (e) {}
        }, 500);

        setTimeout(async () => {
          try {
            const groups = await client.groupFetchAllParticipating();
            if (!global._toxicGroupMetaCache) global._toxicGroupMetaCache = new Map();
            for (const [jid, meta] of Object.entries(groups || {})) {
              global._toxicGroupMetaCache.set(jid, { data: meta, time: Date.now() });
            }
            const { getSudoUsers } = await import('./database/config.js');
            const sudoList = await getSudoUsers().catch(() => []);
            autoScanGroupsForSudo(client, [...new Set([...sudoList, OWNER_NUMBER])], groups).catch(() => {});
          } catch {}
        }, 4000);

        if (global._toxicBatchPoll) clearInterval(global._toxicBatchPoll);
        global._toxicBatchPoll = null;
      }

      if (connection === "close") {
        if (global._toxicShuttingDown) return;
        global._toxicCurrentClient = null;

        if (reason === DisconnectReason.loggedOut || reason === 401) {
          global._toxicShuttingDown = true;
          if (global._toxicReconnectTimer) { clearTimeout(global._toxicReconnectTimer); global._toxicReconnectTimer = null; }
          try { fs.rmSync(sessionName, { recursive: true, force: true }); } catch (e) {}
          invalidateSettingsCache();
          console.log(chalk.red('\n╭─❏ 「 SESSION LOGGED OUT 」'));
          console.log(chalk.red('│ The WhatsApp session is no longer valid (401 / logged out).'));
          console.log(chalk.yellow('│ Generate a fresh SESSION, set it, then start the bot again.'));
          console.log(chalk.red('│ Stopping now to avoid an endless reconnect loop.'));
          console.log(chalk.red('╰───────────────\n'));
          setTimeout(() => process.exit(0), 1500);
          return;
        }

        if (reason === DisconnectReason.connectionClosed || reason === DisconnectReason.connectionLost || reason === DisconnectReason.timedOut || reason === 408 || reason === 503 || reason === 500 || reason === 515) {
          const delay = Math.min(baseReconnectDelay * Math.pow(1.5, reconnectAttempts), 30000);
          reconnectAttempts++;
          if (!global._toxicReconnectTimer) global._toxicReconnectTimer = setTimeout(() => { global._toxicReconnectTimer = null; startToxic(); }, delay);
          return;
        }

        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 60000);
          reconnectAttempts++;
          if (!global._toxicReconnectTimer) global._toxicReconnectTimer = setTimeout(() => { global._toxicReconnectTimer = null; startToxic(); }, delay);
          return;
        } else {
          reconnectAttempts = 0;
          if (!global._toxicReconnectTimer) global._toxicReconnectTimer = setTimeout(() => { global._toxicReconnectTimer = null; startToxic(); }, 30000);
          return;
        }
      }

      try { await connectionHandler(client, update, startToxic); } catch (error) {}
    });

    client.sendText = (jid, text, quoted = "", options) => client.sendMessage(jid, { text, ...options }, { quoted });

    client.downloadMediaMessage = async (message) => {
      let mime = (message.msg || message).mimetype || '';
      let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
      const validTypes = ['image', 'video', 'audio', 'sticker', 'document', 'ptv'];
      if (!validTypes.includes(messageType)) {
        if (mime.startsWith('application/') || mime.startsWith('text/')) messageType = 'document';
        else if (mime.startsWith('image/')) messageType = 'image';
        else if (mime.startsWith('video/')) messageType = 'video';
        else if (mime.startsWith('audio/')) messageType = 'audio';
        else messageType = 'document';
      }
      const stream = await downloadContentFromMessage(message, messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      return buffer;
    };

    client.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
      let quoted = message.msg ? message.msg : message;
      let mime = (message.msg || message).mimetype || '';
      let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
      const validSaveTypes = ['image', 'video', 'audio', 'sticker', 'document', 'ptv'];
      if (!validSaveTypes.includes(messageType)) {
        if (mime.startsWith('application/') || mime.startsWith('text/')) messageType = 'document';
        else if (mime.startsWith('image/')) messageType = 'image';
        else if (mime.startsWith('video/')) messageType = 'video';
        else if (mime.startsWith('audio/')) messageType = 'audio';
        else messageType = 'document';
      }
      const stream = await downloadContentFromMessage(quoted, messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      let type = await FileType.fromBuffer(buffer);
      const trueFileName = attachExtension && type?.ext ? (filename + '.' + type.ext) : filename;
      fs.writeFileSync(trueFileName, buffer);
      return trueFileName;
    };

    global._toxicIsStarting = false;
  } catch (error) {
    console.log('❌ [START TOXIC ERROR]:', error);
    global._toxicCurrentClient = null;
    global._toxicIsStarting = false;
    if (!global._toxicReconnectTimer) global._toxicReconnectTimer = setTimeout(() => { global._toxicReconnectTimer = null; startToxic(); }, 5000);
  }
}

function cleanupSessionFiles() {
    try {
        if (!fs.existsSync(sessionName)) return;
        const files = fs.readdirSync(sessionName);
        const keepFiles = ['.gitkeep', 'creds.json', 'app-state-sync-version-', 'app-state-sync-key-'];
        files.forEach(file => {
            const filePath = path.join(sessionName, file);
            try {
                const stats = fs.statSync(filePath);
                const shouldKeep = keepFiles.some(pattern => pattern.endsWith('-') ? file.startsWith(pattern) : file === pattern);
                if (!shouldKeep) {
                    const hoursOld = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
                    if (hoursOld > 1) fs.unlinkSync(filePath);
                }
            } catch (fileError) {}
        });
    } catch (error) {}
}

app.use(express.static(path.join(__dirname, 'public')));
app.get("/toxic.jpg", (req, res) => { res.sendFile(path.join(__dirname, 'toxic.jpg')); });
app.get("/", (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime(), port }));
const server = app.listen(port, '0.0.0.0', () => console.log(`Server running on http://0.0.0:${port}`));
server.on('error', (err) => { if (err.code === 'EADDRINUSE') setTimeout(() => server.listen(port, '0.0.0.0'), 2000); });
import './lib/serverCleaner.js';
startBackupInterval();
startToxic();

export { startToxic, invalidateSettingsCache, cacheLidPhone, lidPhoneCache, phoneLidCache, getCleanNumber, getDisplayNumber, resolvePhoneFromLid, resolvePhoneFromLidAsync, resolveSenderFromGroup, autoScanGroupsForSudo };

fs.watchFile(fileURLToPath(import.meta.url), () => {
  if (global._toxicUpdating) return;
  fs.unwatchFile(fileURLToPath(import.meta.url));
  console.log(chalk.redBright(`Update detected — restarting...`));
  process.exit(0);
});
