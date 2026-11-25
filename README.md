<div align="center">

# ⚡ TOXICTECH-MD — WhatsApp Bot

![Node.js](https://img.shields.io/badge/Node.js-22+-brightgreen?style=flat-square&logo=node.js)
![Platform](https://img.shields.io/badge/Platform-WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white)
![Multi-Device](https://img.shields.io/badge/Multi--Device-Supported-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-orange?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-success?style=flat-square)
![Version](https://img.shields.io/badge/Version-2.1.0-blueviolet?style=flat-square)

**A powerful, lightning-fast WhatsApp Multi-Device bot built for group control, automation, AI chat, media editing, and fun commands 👑**

<img src="https://github.com/johntezali56/toxictech/blob/main/toxic.jpg" width="100%" />

<br/>

[![Chat With Developer](https://img.shields.io/badge/CHAT%20WITH%20DEVELOPER-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/254716637803)
[![Join Official Group](https://img.shields.io/badge/JOIN%20OFFICIAL%20GROUP-128C7E?style=for-the-badge&logo=whatsapp&logoColor=white)](https://chat.whatsapp.com/E7KYSPeTA3y4QBGXjHCwGo)
[![Follow Official Channel](https://img.shields.io/badge/FOLLOW%20OFFICIAL%20CHANNEL-075E54?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029Vb68vX83wtb322L48y1o)

</div>

---

## 🚀 Quick Start Setup

### 1️⃣ Fork Your Bot Here
Click the button below to create your own copy of **ToxicTech-MD** on GitHub before deploying:

[![Fork Your Bot Here](https://img.shields.io/badge/🍴%20FORK%20YOUR%20BOT%20HERE-2EA44F?style=for-the-badge&logo=github&logoColor=white)](https://github.com/johntezali56/toxictech/fork)

---

### 2️⃣ Pair & Upload Your Session (`SESSION` or `creds.json`)
Generate your WhatsApp session first, then either paste the `SESSION` string into your host's environment variables **or** upload your `creds.json` directly into the **`Session/`** folder in your forked repository:

[![Pair WhatsApp Now](https://img.shields.io/badge/⚡%20GENERATE%20SESSION%20CODE%20%2F%20CREDS.JSON-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](http://toxictech.duckdns.org:20084/)
[![Upload creds.json to Session Folder](https://img.shields.io/badge/📂%20UPLOAD%20CREDS.JSON%20TO%20SESSION%2F%20FOLDER-0366D6?style=for-the-badge&logo=github&logoColor=white)](https://github.com/johntezali56/toxictech/upload/main/Session)

* **Option A (Environment Variable — Best for Heroku, Koyeb, Railway & Render):** Copy your Base64 session code (`eyJ...`) and set:
  ```env
  SESSION=eyJ...YOUR_SESSION_CODE_HERE
  ```
* **Option B (Direct File Upload — Best for KataBump, VPS & Termux):** Upload your downloaded `creds.json` directly inside the **`Session/`** directory (`Session/creds.json`).

---

### 3️⃣ Deploy on Your Favorite Hosting Platform
**ToxicTech-MD** can be deployed across multiple cloud platforms—choose whichever hosting site you prefer below:

<div align="center">

[![Deploy on Heroku](https://img.shields.io/badge/🚀%20DEPLOY%20ON%20HEROKU-430098?style=for-the-badge&logo=heroku&logoColor=white)](https://heroku.com/deploy?template=https://github.com/johntezali56/toxictech)
[![Deploy on Koyeb](https://img.shields.io/badge/⚡%20DEPLOY%20ON%20KOYEB-121212?style=for-the-badge&logo=koyeb&logoColor=white)](https://app.koyeb.com/deploy?type=git&repository=github.com/johntezali56/toxictech&branch=main&name=toxictech-md)
[![Deploy on Railway](https://img.shields.io/badge/🚄%20DEPLOY%20ON%20RAILWAY-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app/new/github/johntezali56/toxictech)
<br/>
[![Deploy on Render](https://img.shields.io/badge/☁️%20DEPLOY%20ON%20RENDER-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/johntezali56/toxictech)
[![Deploy on KataBump](https://img.shields.io/badge/🔥%20DEPLOY%20ON%20KATABUMP-FF6B00?style=for-the-badge&logo=linuxcontainers&logoColor=white)](https://dashboard.katabump.com)
[![Deploy on Replit](https://img.shields.io/badge/💻%20RUN%20ON%20REPLIT-F26207?style=for-the-badge&logo=replit&logoColor=white)](https://replit.com/github/johntezali56/toxictech)

</div>

| Hosting Platform | How to Deploy |
|---|---|
| **Heroku** | Click **Deploy on Heroku**, paste your `SESSION` code, and tap **Deploy App** |
| **Koyeb** | Click **Deploy on Koyeb**, link your forked repo, add `SESSION` in Environment Variables, and deploy |
| **Railway** | Click **Deploy on Railway**, select your forked `toxictech` repo, add `SESSION` under **Variables**, and deploy |
| **Render** | Click **Deploy on Render**, create a Web Service from your fork, add `SESSION` in **Environment**, and launch |
| **KataBump** | Open **KataBump**, upload your repo files + `Session/creds.json` (or set `SESSION`), and click **Start** |
| **Replit** | Import your forked repository into **Replit**, add `SESSION` under **Secrets**, and hit **Run** |

---

## 🖥️ VPS Installation (Ubuntu / Debian)

For users running a **Linux VPS**, execute these exact commands in order:

1. **Update system packages & install Node.js 22, Git, and FFmpeg:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs git ffmpeg webp imagemagick
   ```
2. **Clone your forked ToxicTech-MD repository:**
   ```bash
   git clone https://github.com/johntezali56/toxictech.git
   cd toxictech
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Add your session (`SESSION` env or `Session/creds.json`):**
   ```bash
   export SESSION="YOUR_SESSION_CODE_HERE"
   ```
5. **Start the bot 24/7 with PM2:**
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name "toxictech-md"
   pm2 save && pm2 startup
   ```

---

## 📱 Termux Installation (Android)

For users hosting **ToxicTech-MD** directly on an Android phone via **Termux**:

1. **Grant storage permission and update Termux packages:**
   ```bash
   termux-setup-storage
   pkg update && pkg upgrade -y
   ```
2. **Install Node.js, Git, FFmpeg, and ImageMagick:**
   ```bash
   pkg install -y nodejs git ffmpeg libwebp imagemagick
   ```
3. **Clone your forked repository and open the folder:**
   ```bash
   git clone https://github.com/johntezali56/toxictech.git
   cd toxictech
   ```
4. **Install all bot packages:**
   ```bash
   npm install
   ```
5. **Place your `creds.json` inside `Session/` (or export `SESSION`) and start the bot:**
   ```bash
   mkdir -p Session
   cp /sdcard/Download/creds.json Session/creds.json
   npm start
   ```

---

## ✨ Features Overview

| Category | Highlights |
|---|---|
| 🤖 **Automation** | Auto Read Messages, Auto View & Like Status, Auto AI Chat (Groq/Llama), Auto Bio, Daily Auto Reports |
| 🛡️ **Group Protection** | Anti-Link, Anti-Bad Word, Anti-Group Status, Anti-Bot, Anti-Delete, View-Once Recovery, Anti-Tag |
| ⚙️ **Media & Tools** | Image/Video/GIF Sticker Maker, YouTube/TikTok/IG/FB Downloaders, QR Generator, CDN Upload |
| 🎮 **Fun & Games** | Memes, Quotes, Facts, Interactive Mini Games, Image Filters (`brat`, `trigger`, `wanted`, `wasted`) |
| 🔧 **System Controls** | Public/Private Mode, Multi-Prefix Support, Stealth Mode, Live Speed & Uptime Monitor |

---

## 🆕 What's New in This Version (v2.1.0)

- 🔐 **Built-In Integrity & Community Verification** — Automatic verification for official group and WhatsApp channel membership so bot instances stay synced with official updates
- ⚡ **Multi-Platform Ready Out of the Box** — Pre-configured for Heroku, Koyeb, Railway, Render, KataBump, Replit, VPS, and Termux with low-memory optimization (`--max-old-space-size=220`)
- 🔄 **Smart Session Loader** — Supports Base64 `SESSION` environment variables, `session.json`, or direct `Session/creds.json` uploads seamlessly
- 🖼️ **Enhanced Group Status & View-Once Recovery** — Reliable `.gstatus` media posting (images, videos, GIFs, stickers) and instant View-Once recovery
- 🤖 **Upgraded Vision & AI Models** — Updated Groq vision and chat endpoints for faster, error-free AI responses

---

## 👨‍💻 About Me & Developer Contacts

Hi! I'm **Ali the King (`johntezali56`)**, the creator and lead developer behind **ToxicTech-MD**. I build fast, reliable WhatsApp automation tools, web pairing portals, and multi-device bots designed to run smoothly on any platform.

<div align="center">

[![WhatsApp](https://img.shields.io/badge/💬%20WHATSAPP%20ME-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/254716637803)
[![Telegram](https://img.shields.io/badge/✈️%20TELEGRAM-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/YOUR_TELEGRAM_USERNAME)
[![Instagram](https://img.shields.io/badge/📸%20INSTAGRAM%20(@ali.johntez)-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/ali.johntez)
[![Email](https://img.shields.io/badge/📧%20EMAIL%20ME-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:asac7519@gmail.com)

</div>

- **Developer:** Ali the King (`@johntezali56`)
- **WhatsApp:** `+254 716 637 803`
- **Instagram:** [@ali.johntez](https://instagram.com/ali.johntez)
- **Email:** `asac7519@gmail.com`
- **GitHub:** [github.com/johntezali56/toxictech](https://github.com/johntezali56/toxictech)

---

## 🛡️ Safety Notice & Disclaimer

> ⚠️ **Educational Purpose Only:** Using unofficial WhatsApp APIs may violate WhatsApp's Terms of Service. Always use a secondary number, enable Two-Step Verification, and avoid spamming. The developer (**Ali the King**) is not responsible for account bans or misuse.

<div align="center">

**ToxicTech-MD** • Built with 👑 by **Ali the King** © 2026

</div>
