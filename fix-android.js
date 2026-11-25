import fs from 'fs';

if (process.platform === 'android') {
    const ff = './node_modules/@ffmpeg-installer/ffmpeg/index.js';
    if (fs.existsSync(ff)) {
        const orig = fs.readFileSync(ff, 'utf8');
        if (!orig.includes('termuxBin')) {
            const shim = 'if (process.platform === "android") { const fs = require("fs"); const termuxBin = "/data/data/com.termux/files/usr/bin/ffmpeg"; module.exports = { path: fs.existsSync(termuxBin) ? termuxBin : "ffmpeg", version: "termux" }; } else {\n';
            fs.writeFileSync(ff, shim + orig + '\n}\n');
        }
    }

    const shIdx = './node_modules/sharp/lib/index.js';
    if (fs.existsSync(shIdx)) {
        const origIdx = fs.readFileSync(shIdx, 'utf8');
        if (!origIdx.includes('androidSharpIndexShim')) {
            const stub = `/* androidSharpIndexShim */
if (process.platform === "android") {
  const fn = function() { return new Proxy(fn, { get: (_, p) => p === "toBuffer" ? async () => Buffer.alloc(0) : () => fn }); };
  fn.format = { heif: { output: { alias: [] } }, jpeg: {}, png: {}, webp: {} };
  fn.versions = { vips: "0.0.0" };
  fn.cache = () => {};
  fn.concurrency = () => {};
  module.exports = fn;
} else {\n`;
            fs.writeFileSync(shIdx, stub + origIdx + '\n}\n');
        }
    }
}
