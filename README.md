<div align="center">

# ⚡ ToxicTech MD — WhatsApp Bot

![Node.js](https://img.shields.io/badge/Node.js-22+-brightgreen?style=flat-square&logo=node.js)
![Platform](https://img.shields.io/badge/Platform-WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white)
![Multi-Device](https://img.shields.io/badge/Multi--Device-Supported-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-orange?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-success?style=flat-square)
![Version](https://img.shields.io/badge/Version-2.1.0-blue?style=flat-square)

**A powerful, lightning-fast WhatsApp Multi-Device bot built for group control, automation, AI chat, media editing, and fun commands.**

<img src="https://github.com/johntezali56/toxictech/blob/main/toxic.jpg" width="100%" />

<br/>

[![Chat With Developer](https://img.shields.io/badge/CHAT%20WITH%20DEVELOPER-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/254716637803)
[![Join Official Group](https://img.shields.io/badge/JOIN%20OFFICIAL%20GROUP-128C7E?style=for-the-badge&logo=whatsapp&logoColor=white)](https://chat.whatsapp.com/E7KYSPeTA3y4QBGXjHCwGo)
[![Follow Official Channel](https://img.shields.io/badge/FOLLOW%20OFFICIAL%20CHANNEL-075E54?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029Vb68vX83wtb322L48y1o)

</div>

---

## 🚀 Quick Setup (3 Easy Steps)

### 1️⃣ Fork Your Bot Here
Click the button below to create your own copy of **ToxicTech MD** on GitHub before deploying:

[![Fork Your Bot Here](https://img.shields.io/badge/1.%20FORK%20YOUR%20BOT%20HERE-2EA44F?style=for-the-badge&logo=github&logoColor=white)](https://github.com/johntezali56/toxictech/fork)

---

### 2️⃣ Pair & Upload Your Session (`creds.json` or `SESSION` ID)
1. Generate your pairing code or QR code on the official pairing portal:

[![Get Session / Pair WhatsApp](https://img.shields.io/badge/GET%20SESSION%20CODE%20%2F%20CREDS.JSON-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](http://toxictech.duckdns.org:20084/)

2. Upload your downloaded **`creds.json`** directly into the **`Session/`** folder of your forked repository (or paste your `eyJ...` Session ID into your host's `SESSION` environment variable):

[![Upload creds.json to Session Folder](https://img.shields.io/badge/2.%20UPLOAD%20CREDS.JSON%20TO%20SESSION%2F%20FOLDER-0969DA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/johntezali56/toxictech/upload/main/Session)

> 💡 **Tip:** Make sure you remain in the **Official WhatsApp Group** and **Official Channel** after linking, otherwise bot commands will automatically pause.

---

### 3️⃣ Deploy on Your Favorite Hosting Platform
**ToxicTech MD** supports all major cloud hosting platforms. Choose whichever host you prefer below:

<div align="center">

[![Deploy on Heroku](https://img.shields.io/badge/DEPLOY%20ON%20HEROKU-430098?style=for-the-badge&logo=heroku&logoColor=white)](https://heroku.com/deploy?template=https://github.com/johntezali56/toxictech)
[![Deploy on Koyeb](https://img.shields.io/badge/DEPLOY%20ON%20KOYEB-121212?style=for-the-badge&logo=koyeb&logoColor=white)](https://app.koyeb.com/deploy?type=git&repository=github.com/johntezali56/toxictech&branch=main&name=toxictech-md)
[![Deploy on Railway](https://img.shields.io/badge/DEPLOY%20ON%20RAILWAY-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app/new/template?template=https://github.com/johntezali56/toxictech)

[![Deploy on Render](https://img.shields.io/badge/DEPLOY%20ON%20RENDER-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/johntezali56/toxictech)
[![Deploy on KataBump](https://img.shields.io/badge/DEPLOY%20ON%20KATABUMP-FF6B00?style=for-the-badge&logo=linuxcontainers&logoColor=white)](https://dashboard.katabump.com)
[![Deploy on Replit](https://img.shields.io/badge/DEPLOY%20ON%20REPLIT-F26207?style=for-the-badge&logo=replit&logoColor=white)](https://replit.com/github/johntezali56/toxictech)

</div>

| Hosting Platform | Quick Instructions |
|---|---|
| **Heroku** | Click **Deploy on Heroku**, paste your `SESSION` string, and click **Deploy App**. |
| **Koyeb** | Click **Deploy on Koyeb**, select your forked repo, add `SESSION` in Environment Variables, and deploy. |
| **Railway** | Click **Deploy on Railway**, link your fork, set `SESSION` in Variables, and deploy. |
| **Render** | Click **Deploy on Render**, create a Web Service from your fork, add `SESSION`, and deploy. |
| **KataBump** | Create a Node.js server, upload your bot files + `Session/creds.json`, and click **Start**. |
| **Replit** | Click **Deploy on Replit**, add `SESSION` in Secrets, and click **Run**. |

---

## 💻 VPS Deployment (Ubuntu / Debian)

Run these commands step by step on your Linux VPS:

1. **Update system packages and install Node.js 22, Git, and FFmpeg:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs git ffmpeg imagemagick webp
   ```
2. **Clone your forked repository:**
   ```bash
   git clone https://github.com/johntezali56/toxictech.git
   cd toxictech
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Add your Session ID (or place `creds.json` inside `Session/`):**
   ```bash
   echo 'SESSION="PASTE_YOUR_SESSION_ID_HERE"' > .env
   ```
5. **Start the bot 24/7 with PM2:**
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name "toxictech-md" --node-args="--max-old-space-size=250"
   pm2 save
   ```

---

## 📱 Termux Deployment (Android)

Follow these exact steps to run **ToxicTech MD** on your Android phone using Termux:

1. **Update Termux and grant storage access:**
   ```bash
   pkg update && pkg upgrade -y
   termux-setup-storage
   ```
2. **Install required packages (Node.js, Git, FFmpeg, ImageMagick):**
   ```bash
   pkg install -y nodejs git ffmpeg imagemagick libwebp
   ```
3. **Clone the repository and enter the folder:**
   ```bash
   git clone https://github.com/johntezali56/toxictech.git
   cd toxictech
   ```
4. **Install bot dependencies:**
   ```bash
   npm install --no-bin-links
   ```
5. **Set your Session ID and start the bot:**
   ```bash
   export SESSION="PASTE_YOUR_SESSION_ID_HERE"
   npm start
   ```

---

## 📖 Features Overview

| Category | Capabilities |
|---|---|
| **🤖 Automation** | Auto Read Messages, Auto View Status, Auto Like Status, Custom Auto Replies, Auto AI Chat (Groq/Llama), Auto Bio, Daily Group Stats Report |
| **🛡️ Group Protection** | Anti-Link, Anti-Bad Word, Anti-Group Status, Anti-Bot, Anti-Delete, View-Once Media Recovery, Anti-Status Mention, Anti-Foreign, Anti-Demote/Promote, Welcome & Goodbye Cards |
| **⚙️ Useful Tools** | Sticker Maker (Image/Video/GIF), QR Generator, Media Downloader (YouTube, TikTok, IG, FB), CDN Upload, 17 Languages Supported |
| **🎮 Fun & Media** | Random Memes, Quotes, Mini Games, Image Effects (`brat`, `trigger`, `wanted`, `wasted`) |

---

## 🆕 Changes to Expect in This New Version (v2.1.0)

- 🔐 **Upgraded Pairing & Session Sync** — Seamless support for both `SESSION` Base64 codes (`eyJ...`) and direct `Session/creds.json` uploads with automatic app-state sync on connect.
- 🛡️ **Community & Anti-Tamper Protection** — Built-in verification for the official ToxicTech group and WhatsApp channel, plus runtime integrity protection.
- ⚡ **Low-Memory Container Optimization** — Tuned V8 garbage collection (`--max-old-space-size=220`) and session cleanup so the bot runs smoothly on 256MB–512MB free hosts without crashing.
- 🖼️ **Group Status & Media Fixes** — `.gstatus` now reliably posts images, videos, GIFs, voice notes, and stickers inside groups.
- 🤖 **Updated AI & Vision Models** — `.vision`, `.gpt`, and `.groq` now use active, high-speed Groq/Llama vision and chat models.

---

## 👨‍💻 About Me & Developer Contact

Hi, I'm **Ali the King** (`johntezali56`), the creator and lead developer of **ToxicTech MD**. I build fast, reliable, and easy-to-deploy WhatsApp automation tools designed to run smoothly on any cloud host, VPS, or mobile device.

### 📬 Connect & Support (Tap Any Icon Below)

<div align="center">

[![WhatsApp +254716637803](https://img.shields.io/badge/WhatsApp-%2B254716637803-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/254716637803)

[![Instagram @ali.johntez](https://img.shields.io/badge/Instagram-%40ali.johntez-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/ali.johntez)

[![Telegram](https://img.shields.io/badge/Telegram-Chat%20Now-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)]
(https://t.me/toxictech2)

[![Email asac7519@gmail.com](https://img.shields.io/badge/Email-asac7519%40gmail.com-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:asac7519@gmail.com)

</div>

---

## 🛡️ Safety & Disclaimer

> ⚠️ **Educational Purpose Only:** Using unofficial WhatsApp libraries may violate WhatsApp's Terms of Service. Use a secondary number, enable Two-Step Verification, and avoid spamming. The developer is not responsible for account restrictions or misuse.

<div align="center">

**Built with ❤️ by Ali the King • ToxicTech MD © 2026**

</div>
