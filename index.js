import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_ENTRY = path.join(__dirname, 'bot.js');

let child = null;
let shuttingDown = false;
let lastStart = 0;

function launchBot() {
  if (shuttingDown) return;
  lastStart = Date.now();

  child = spawn(
    process.execPath,
    ['--max-old-space-size=200', BOT_ENTRY],
    {
      stdio: 'inherit',
      env: { ...process.env, TOXIC_SUPERVISED: '1' }
    }
  );

  child.on('exit', (code, signal) => {
    child = null;
    if (shuttingDown) return;

    const uptimeMs = Date.now() - lastStart;
    const delayMs = uptimeMs < 10000 ? 5000 : 2000;

    console.log(
      `[Supervisor] bot.js exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}). Restarting in ${delayMs / 1000}s...`
    );
    setTimeout(launchBot, delayMs);
  });

  child.on('error', (err) => {
    console.error('[Supervisor] Failed to spawn bot.js:', err.message);
    setTimeout(launchBot, 5000);
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    shuttingDown = true;
    if (child) child.kill(sig);
    setTimeout(() => process.exit(0), 1000);
  });
}

launchBot();
