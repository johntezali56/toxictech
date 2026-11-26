import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const botScript = path.join(__dirname, 'index.js');

let child = null;
let isShuttingDown = false;
let lastStartTime = 0;

function startBot() {
    if (isShuttingDown) return;

    lastStartTime = Date.now();
    console.log('[Supervisor] Starting Toxic-MD...');

    child = spawn(
        process.execPath,
        ['--max-old-space-size=200', botScript, ...process.argv.slice(2)],
        {
            stdio: 'inherit',
            env: { ...process.env, TOXIC_SUPERVISED: '1' }
        }
    );

    child.on('exit', (code, signal) => {
        child = null;
        if (isShuttingDown) return;

        const uptime = Date.now() - lastStartTime;
        const delay = uptime < 10000 ? 5000 : 2000;

        console.log(
            `[Supervisor] Bot exited (code: ${code ?? 'null'}, signal: ${signal ?? 'none'}). Restarting in ${delay / 1000}s...`
        );
        setTimeout(startBot, delay);
    });

    child.on('error', (err) => {
        console.error('[Supervisor] Failed to spawn bot process:', err);
        setTimeout(startBot, 5000);
    });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
        isShuttingDown = true;
        if (child) {
            child.kill(sig);
        }
        setTimeout(() => process.exit(0), 500);
    });
}

startBot();
