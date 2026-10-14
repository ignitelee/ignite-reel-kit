// Free local transcription (Mac + Windows): runs scripts/transcribe.py with faster-whisper through uv,
// which fetches Python and the package by itself the first time.
// Usage: node scripts/transcribe.mjs <video-or-audio> [output.json]
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.length < 3) {
  console.error('Usage: node scripts/transcribe.mjs <video-or-audio> [output.json]');
  process.exit(1);
}
const uv = spawnSync('uv', ['--version'], { encoding: 'utf8' });
if (uv.status !== 0) {
  console.error('uv is not installed. Run /reel-setup in Claude Code (or see docs/IGNITE-SETUP.md).');
  process.exit(1);
}
const script = join(dirname(fileURLToPath(import.meta.url)), 'transcribe.py');
const args = ['run', '--quiet', '--python', '3.12.15', '--with', 'faster-whisper==1.2.1', 'python', script, ...process.argv.slice(2)];
const r = spawnSync('uv', args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
