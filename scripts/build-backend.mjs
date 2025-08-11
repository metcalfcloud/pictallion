#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';

function have(cmd) {
  const which = process.platform === 'win32' ? 'where' : 'command -v';
  const res = spawnSync(process.platform === 'win32' ? 'where' : 'sh', process.platform === 'win32' ? [cmd] : ['-lc', `${which} ${cmd} >/dev/null 2>&1`]);
  return res.status === 0;
}

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
    return true;
  } catch (e) {
    return false;
  }
}

// Try Tauri CLI via npx
if (have('npx')) {
  if (run('npx --yes @tauri-apps/cli build')) process.exit(0);
}

// Try cargo tauri then plain cargo
if (have('cargo')) {
  if (run('cargo tauri build')) process.exit(0);
  if (run('cargo build --release')) process.exit(0);
}

console.error('\nSkipping backend build: required toolchain missing or build failed.');
if (process.platform === 'win32') {
  console.error('- Ensure Visual Studio Build Tools (C++), Windows 10/11 SDK installed');
  console.error('- Use MSVC toolchain: `rustup default stable-x86_64-pc-windows-msvc`');
  console.error('- Install WebView2 runtime');
}
process.exit(1);

