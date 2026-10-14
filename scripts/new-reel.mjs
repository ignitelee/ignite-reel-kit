#!/usr/bin/env node
// IGNITE: new reel project = the kit's starter + IGNITE brand (logo, fonts, SFX, music, DESIGN.md), set to 9:16.
// Usage: npm run new-reel -- <lowercase-name> [path\to\video.mp4]
import { spawnSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [slug, video] = process.argv.slice(2);
if (!slug) {
  console.log('Usage: npm run new-reel -- <lowercase-name> [path\\to\\video.mp4]');
  process.exit(1);
}
if (video && !existsSync(video)) throw new Error(`Video not found: ${video}`);
const r = spawnSync(process.execPath, [join(root, 'scripts/new-video.mjs'), slug], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

const dest = join(root, 'video-projects', slug);
cpSync(join(root, 'brand'), join(dest, 'assets/brand'), { recursive: true });
copyFileSync(join(root, 'brand/DESIGN.md'), join(dest, 'DESIGN.md'));
const meta = JSON.parse(readFileSync(join(dest, 'meta.json'), 'utf8'));
Object.assign(meta, { width: 1080, height: 1920, brand: 'IGNITE' });
writeFileSync(join(dest, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
if (video) {
  copyFileSync(video, join(dest, 'assets/raw.mp4'));
  console.log(`Copied your video to video-projects/${slug}/assets/raw.mp4 (original untouched).`);
}
console.log(`Your brand added (assets/brand, DESIGN.md). Reel size set to 1080x1920.`);
