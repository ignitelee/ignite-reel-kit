// Free local transcription (Mac + Windows): runs scripts/transcribe.py with faster-whisper through uv,
// which fetches Python and the package by itself the first time.
// Usage: node scripts/transcribe.mjs <video-or-audio> [output.json]
//        node scripts/transcribe.mjs --prepare   (setup: downloads Python, faster-whisper and the speech model once)
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';

if (process.argv.length < 3) {
  console.error('Usage: node scripts/transcribe.mjs <video-or-audio> [output.json]   or   --prepare');
  process.exit(1);
}
// On Windows the Claude desktop app keeps a private copy of AppData, which breaks uv's Python install
// (it lives in AppData by default). Keep Python in a normal folder in the user's home instead.
const env = { ...process.env };
if (platform() === 'win32' && !env.UV_PYTHON_INSTALL_DIR) env.UV_PYTHON_INSTALL_DIR = join(homedir(), '.uv-python');

const uv = spawnSync('uv', ['--version'], { encoding: 'utf8', env });
if (uv.status !== 0) {
  console.error('uv is not installed. Run /reel-setup in Claude Code.');
  process.exit(1);
}
const base = ['run', '--quiet', '--python', '3.12.15', '--with', 'faster-whisper==1.2.1', 'python'];
const args = process.argv[2] === '--prepare'
  ? [...base, '-c', "from faster_whisper import WhisperModel; WhisperModel('large-v3-turbo', device='cpu', compute_type='int8'); print('speech model ready')"]
  : [...base, join(dirname(fileURLToPath(import.meta.url)), 'transcribe.py'), ...process.argv.slice(2)];
const r = spawnSync('uv', args, { stdio: 'inherit', env });
process.exit(r.status ?? 1);
