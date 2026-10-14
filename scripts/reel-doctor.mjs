#!/usr/bin/env node
// IGNITE Reel Kit health check (Mac + Windows). Prints one line per requirement and a JSON summary.
// Usage: node scripts/reel-doctor.mjs [--json]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform, cpus, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = platform() === 'win32';
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: isWin && ['npm', 'npx'].includes(cmd) });
  return r.status === 0 ? (r.stdout || r.stderr || '').trim().split(/\r?\n/)[0] : null;
};
const major = (v) => +(String(v).match(/(\d+)/) || [0, 0])[1];

const node = process.version;
const checks = [
  { id: 'node', label: 'Node.js 22 or newer', ok: major(node) >= 22, found: node },
  { id: 'git', label: 'Git', found: run('git', ['--version']) },
  { id: 'ffmpeg', label: 'FFmpeg', found: run('ffmpeg', ['-version']) },
  { id: 'ffprobe', label: 'FFprobe', found: run('ffprobe', ['-version']) },
  { id: 'uv', label: 'uv (runs the free transcription)', found: run('uv', ['--version']) },
  { id: 'packages', label: 'Kit packages (npm ci)', ok: existsSync(join(root, 'node_modules', 'hyperframes')), found: existsSync(join(root, 'node_modules', 'hyperframes')) ? 'installed' : null },
  { id: 'chrome', label: 'Video renderer (Chrome headless)', ok: existsSync(join(homedir(), '.cache', 'hyperframes', 'chrome')), found: existsSync(join(homedir(), '.cache', 'hyperframes', 'chrome')) ? 'installed' : null },
  { id: 'whisper', label: 'Speech model (downloaded once, ~1.6 GB)', ok: existsSync(join(homedir(), '.cache', 'huggingface', 'hub', 'models--mobiuslabsgmbh--faster-whisper-large-v3-turbo')), found: null },
  { id: 'brand', label: 'Your brand settings (brand/brand.json)', ok: existsSync(join(root, 'brand', 'brand.json')), found: null },
];
for (const c of checks) if (c.ok === undefined) c.ok = !!c.found;
const machine = { os: isWin ? 'Windows' : platform() === 'darwin' ? 'Mac' : platform(), cpus: cpus().length, ram_gb: Math.round(totalmem() / 2 ** 30) };

if (process.argv.includes('--json')) console.log(JSON.stringify({ machine, checks, ready: checks.every((c) => c.ok) }, null, 1));
else {
  console.log(`${machine.os}, ${machine.cpus} CPU threads, ${machine.ram_gb} GB RAM`);
  for (const c of checks) console.log(`${c.ok ? 'OK     ' : 'MISSING'}  ${c.label}${c.found && c.found !== true ? `  (${c.found})` : ''}`);
  console.log(checks.every((c) => c.ok) ? '\nAll set: you can make reels.' : '\nRun /reel-setup in Claude Code to fix the missing items.');
}
