#!/usr/bin/env node
// Find real brand logos in the bundled Simple Icons library (CC0, 3,400+ brands, works offline).
// Usage: npm run logo -- netflix "apple music" chatgpt
// Use the result in reel.json as "logo": "si:<slug>" (e.g. in a glass item). Not found -> use an "icon" instead.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'node_modules/simple-icons/data/simple-icons.json'), 'utf8'));
const icons = Array.isArray(data) ? data : data.icons;
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const slugOf = (i) => i.slug || norm(i.title);

const queries = process.argv.slice(2);
if (!queries.length) { console.log('Usage: npm run logo -- <brand> [brand...]'); process.exit(1); }
for (const q of queries) {
  const n = norm(q);
  const exact = icons.filter((i) => norm(i.title) === n || slugOf(i) === n || Object.values(i.aliases || {}).flat().some((a) => typeof a === 'string' && norm(a) === n));
  const near = exact.length ? exact : icons.filter((i) => norm(i.title).includes(n)).slice(0, 5);
  if (!near.length) { console.log(`${q}: not found (use a Material icon instead)`); continue; }
  console.log(`${q}: ${near.map((i) => `si:${slugOf(i)} (${i.title}, #${i.hex})`).join(' | ')}${exact.length ? '' : '   [closest matches]'}`);
}
