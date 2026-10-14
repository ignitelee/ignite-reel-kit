#!/usr/bin/env node
// IGNITE: build + render a reel, and optionally all its trial-reel variants, one after another.
// Usage: node scripts/render-reel.mjs video-projects/<name> [--variants | --variant v2] [--draft]
//   no flag     -> renders/<name>.mp4 (the main version)
//   --variants  -> the main version + renders/<name> - <variant>.mp4 for every variant in reel.json
// Ends with index.html rebuilt as the main version.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const proj = resolve(process.argv[2]);
const name = basename(proj);
const args = process.argv.slice(3);
const draft = args.includes('--draft');
const cfg = JSON.parse(readFileSync(join(proj, 'reel.json'), 'utf8'));
const variants = args.includes('--variants') ? [null, ...(cfg.variants || []).map((v) => v.name)]
  : args.includes('--variant') ? [args[args.indexOf('--variant') + 1]] : [null];

const run = (cmd, a, cwd) => {
  const r = spawnSync(cmd, a, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')} failed`);
};
for (const v of variants) {
  run('node', [join(root, 'scripts/build-reel.mjs'), proj, ...(v ? ['--variant', v] : [])], root);
  const out = `renders/${name}${v ? ` - ${v}` : ''}${draft ? ' (draft)' : ''}.mp4`;
  console.log(`\nrendering ${out} ...`);
  run('npx', ['hyperframes', 'render', '--quality', draft ? 'draft' : 'high', '--output', process.platform === 'win32' ? `"${out}"` : out], proj);
}
if (variants.some(Boolean)) run('node', [join(root, 'scripts/build-reel.mjs'), proj], root);
console.log('\ndone');
