#!/usr/bin/env node
// Puts an "IGNITE Reels" icon on the desktop that opens the reel dashboard (Windows: .cmd, Mac: .command).
// Usage: npm run shortcut
import { writeFileSync, chmodSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let desktop = join(homedir(), 'Desktop');
if (platform() === 'win32') {
  // the real Desktop (it is often inside OneDrive)
  try { desktop = execFileSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"], { encoding: 'utf8' }).trim() || desktop; } catch { /* default */ }
  const file = join(desktop, 'IGNITE Reels.cmd');
  writeFileSync(file, [
    '@echo off',
    'title IGNITE Reels - keep this window open while you use the dashboard',
    `cd /d "${KIT}"`,
    'call npm run dashboard',
    'pause',
    '',
  ].join('\r\n'));
  console.log(`Shortcut made: ${file}`);
} else {
  const file = join(desktop, 'IGNITE Reels.command');
  writeFileSync(file, [
    '#!/bin/bash',
    '# IGNITE Reels: keep this window open while you use the dashboard',
    'export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"',
    `cd "${KIT}"`,
    'npm run dashboard',
    '',
  ].join('\n'));
  chmodSync(file, 0o755);
  console.log(`Shortcut made: ${file}`);
}
if (!existsSync(desktop)) console.log('(Desktop folder not found: the shortcut was saved anyway.)');
