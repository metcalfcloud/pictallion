// Cross-platform dev orchestrator: starts Vite, waits, then starts Tauri
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRONTEND_DIR = resolve(__dirname, '..', 'frontend');
const TAURI_DIR = resolve(__dirname, '..', 'src-tauri', 'src-tauri');
const DEV_URL = 'http://localhost:5173';

function log(prefix, line) {
  // keep logs short and clear
  process.stdout.write(`[${prefix}] ${line}\n`);
}

function spawnProc(cmd, args, cwd, prefix) {
  const child = spawn(cmd, args, {
    cwd,
    shell: true,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const rlOut = createInterface({ input: child.stdout });
  const rlErr = createInterface({ input: child.stderr });
  rlOut.on('line', (l) => log(prefix, l));
  rlErr.on('line', (l) => log(prefix, l));
  child.on('exit', (code) => log(prefix, `exited with code ${code}`));
  return child;
}

async function waitForViteReady(child, timeoutMs = 20000) {
  // Heuristic: detect typical Vite ready lines
  const patterns = [
    'Local:',
    'http://localhost:5173',
    'ready in',
  ];
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error('Timed out waiting for Vite to be ready'));
      }
    }, timeoutMs);

    const onData = (chunk) => {
      const s = chunk.toString();
      if (patterns.some((p) => s.includes(p))) {
        clearTimeout(timer);
        if (!done) {
          done = true;
          resolve();
        }
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
  });
}

async function main() {
  log('dev', 'starting Vite...');
  const vite = spawnProc('npm', ['run', 'dev'], FRONTEND_DIR, 'vite');

  try {
    await waitForViteReady(vite, 30000);
  } catch (e) {
    log('dev', `warning: ${e.message}; continuing to start Tauri`);
  }

  log('dev', 'starting Tauri dev...');
  const tauri = spawnProc('npx', ['--yes', '@tauri-apps/cli', 'dev', '--', '--dev-url', DEV_URL], TAURI_DIR, 'tauri');

  // Graceful shutdown
  const shutdown = () => {
    log('dev', 'shutting down processes...');
    if (!vite.killed) {
      try { vite.kill('SIGINT'); } catch {}
    }
    if (!tauri.killed) {
      try { tauri.kill('SIGINT'); } catch {}
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Wait for Tauri to exit, then stop Vite
  await once(tauri, 'exit');
  shutdown();
}

main().catch((err) => {
  console.error('[dev] error:', err);
  process.exit(1);
});

