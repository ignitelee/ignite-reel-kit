#!/usr/bin/env node
// Free stock B-roll from Pexels (free to use in videos, no credit needed), searched and downloaded into a
// reel project. Needs the user's OWN free Pexels API key in the kit's .env file: PEXELS_API_KEY=...
// (pexels.com/api: sign up, then "Your API key").
// Usage: npm run broll -- video-projects/<name> "friends laughing in a pub" [--name pub] [--pick 2] [--list]
//   --list   show the top matches (length, size, link) without downloading
//   --pick N download match N from the list (default: the best vertical match)
// Saves video-projects/<name>/assets/broll/<name>.mp4 (vertical, ~1080 wide) and records the source in
// assets/broll/credits.json. Use it in reel.json as {"type": "clip", "pos": "card", "src": "assets/broll/<name>.mp4", ...}.
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] ?? true : undefined; };
const list = args.includes('--list'); if (list) args.splice(args.indexOf('--list'), 1);
const name = flag('--name'), pick = flag('--pick');
const [proj, query] = args;
if (!proj || !query) { console.log('Usage: npm run broll -- video-projects/<name> "what to search" [--name x] [--list] [--pick N]'); process.exit(1); }

// the user's own key, from the environment or the kit's .env (never anyone else's)
let key = process.env.PEXELS_API_KEY;
if (!key && existsSync(join(root, '.env'))) {
  const m = readFileSync(join(root, '.env'), 'utf8').match(/^\s*PEXELS_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  key = m?.[1]?.trim();
}
if (!key) {
  console.log('NO_PEXELS_KEY: stock B-roll is off. To turn it on, the user makes a free Pexels account (pexels.com/api,'
    + ' "Your API key") and pastes it into the kit\'s .env file as PEXELS_API_KEY=... Carry on without stock B-roll.');
  process.exit(2);
}

const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=15`;
const res = await fetch(url, { headers: { Authorization: key } });
if (res.status === 401 || res.status === 403) { console.log('PEXELS_KEY_REJECTED: the key in .env was not accepted. Check it was pasted correctly.'); process.exit(2); }
if (!res.ok) { console.log(`Pexels search failed (${res.status}). Carry on without this clip.`); process.exit(3); }
const data = await res.json();

// best file per video: vertical, at least 720 wide, as close to 1080 wide as possible, mp4
const best = (v) => (v.video_files || []).filter((f) => f.file_type === 'video/mp4' && f.height > f.width && f.width >= 720)
  .sort((a, b) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080))[0];
const matches = (data.videos || []).map((v) => ({ v, f: best(v) })).filter((x) => x.f && x.v.duration >= 3);
if (!matches.length) { console.log(`No vertical clips found for "${query}". Try simpler words (e.g. "pub friends", "laptop beach").`); process.exit(3); }

if (list) {
  matches.slice(0, 8).forEach((m, i) => console.log(`${i + 1}. ${m.v.duration}s ${m.f.width}x${m.f.height} by ${m.v.user?.name}  ${m.v.url}  (preview: ${m.v.image})`));
  process.exit(0);
}
const m = matches[Math.max(0, (Number(pick) || 1) - 1)] || matches[0];
const slug = (name || query).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'broll';
const dir = join(resolve(proj), 'assets', 'broll'); mkdirSync(dir, { recursive: true });
const out = join(dir, `${slug}.mp4`);
const dl = await fetch(m.f.link);
if (!dl.ok) { console.log(`Download failed (${dl.status}).`); process.exit(3); }
await pipeline(Readable.fromWeb(dl.body), createWriteStream(out));
const creditsFile = join(dir, 'credits.json');
const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, 'utf8')) : {};
credits[`${slug}.mp4`] = { query, pexels: m.v.url, by: m.v.user?.name, duration: m.v.duration, size: `${m.f.width}x${m.f.height}`, licence: 'Pexels licence (free to use, no attribution required)' };
writeFileSync(creditsFile, JSON.stringify(credits, null, 2));
console.log(`saved assets/broll/${slug}.mp4 (${m.v.duration}s, ${m.f.width}x${m.f.height}, by ${m.v.user?.name}). Look at a frame before using it: stock clips can change shot partway.`);
