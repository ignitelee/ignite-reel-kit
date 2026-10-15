#!/usr/bin/env node
// Carousel images: turns a carousel job's draft.json into 1080x1350 PNG slides (+ caption.txt and a zip per
// carousel), using the same slide designs the dashboard previews (dashboard/public/carousel.mjs) in the
// headless Chrome that HyperFrames already downloaded.
//   node scripts/carousel.mjs options <job-id>              check options.json (step 1: 3 short options per topic)
//   node scripts/carousel.mjs check  <job-id>               check draft.json (errors + warnings)
//   node scripts/carousel.mjs render <job-id> [--only N] [--sheet] [--check]
//        renders into dashboard/carousels/<id>/out/, writes render.json for the dashboard;
//        --sheet also saves sheet.jpg (all slides side by side) per carousel, for checking them in one look;
//        --check (for Claude while drafting) renders into out/_check/ with sheets only: no zip, no render.json,
//        so the dashboard still waits for the user to press "Make my images".
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { slideHTML, checkDraft, checkOptions, lookFor, IGNITE_LOGO, W, H } from '../dashboard/public/carousel.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CAR = join(KIT, 'dashboard', 'carousels');
const readJSON = (p, d = null) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const writeJSON = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2));
const posix = (p) => p.split(sep).join('/');
const slug = (s) => String(s || 'carousel').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'carousel';

// ---------- zip (stored, no compression: PNGs are already compressed) ----------
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files, when = new Date()) { // files: [{name, data: Buffer}]
  const parts = [], central = []; let off = 0;
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const dosDate = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), crc = crc32(f.data), n = f.data.length;
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(dosTime, 10); loc.writeUInt16LE(dosDate, 12);
    loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(n, 18); loc.writeUInt32LE(n, 22); loc.writeUInt16LE(name.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(n, 20); cen.writeUInt32LE(n, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(off, 42);
    parts.push(loc, name, f.data); central.push(cen, name); off += 30 + name.length + n;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

// the headless Chrome HyperFrames downloads (npx hyperframes browser ensure)
function chromePath() {
  const base = join(homedir(), '.cache', 'hyperframes', 'chrome');
  const find = (d, depth = 0) => {
    if (depth > 5 || !existsSync(d)) return null;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isFile() && /^chrome-headless-shell(\.exe)?$/.test(e.name)) return p;
      if (e.isDirectory()) { const r = find(p, depth + 1); if (r) return r; }
    }
    return null;
  };
  const found = find(base); if (found) return found;
  try { const out = execSync('npx hyperframes browser path', { cwd: KIT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/).pop(); if (out && existsSync(out)) return out; } catch { /* fall through */ }
  return undefined; // Playwright's own browser, if installed
}

export async function render(id, { only = null, sheet = false, check = false } = {}) {
  const dir = join(CAR, id), job = readJSON(join(dir, 'job.json')), draft = readJSON(join(dir, 'draft.json'));
  if (!job || !draft) throw new Error(`No carousel job or draft.json in ${posix(relative(KIT, dir))}`);
  const { errors } = checkDraft(draft); if (errors.length) throw new Error(errors.join('\n'));
  const brand = readJSON(join(KIT, 'brand', 'brand.json')) || readJSON(join(KIT, 'brand', 'brand.example.json')) || {};
  if (brand.logo && !existsSync(join(KIT, 'brand', brand.logo))) brand.logo = null; // no logo uploaded yet
  // their logo IS the Ignite logo (e.g. Ignite staff): show it once, not twice
  if (brand.logo && readFileSync(join(KIT, 'brand', brand.logo)).equals(readFileSync(join(KIT, IGNITE_LOGO)))) brand.logo = null;
  if (check) sheet = true;
  const out = join(dir, 'out', ...(check ? ['_check'] : [])); mkdirSync(out, { recursive: true });
  const list = draft.carousels.map((c, i) => ({ c, i })).filter(({ i }) => only === null || i === only);
  const total = list.reduce((n, { c }) => n + c.slides.length, 0);
  const prev = readJSON(join(dir, 'render.json'), {});
  const state = { state: 'rendering', done: 0, total, startedAt: Date.now(), carousels: check || only === null ? [] : prev.carousels || [] };
  const save = () => { if (!check) writeJSON(join(dir, 'render.json'), state); }; save();

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--allow-file-access-from-files', '--font-render-hinting=none'] });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    for (const { c, i } of list) {
      const name = `${String(i + 1).padStart(2, '0')}-${slug(c.title)}`, cdir = join(out, name);
      for (const old of readdirSync(out)) if (old.startsWith(String(i + 1).padStart(2, '0') + '-')) rmSync(join(out, old), { recursive: true, force: true });
      mkdirSync(cdir, { recursive: true });
      const look = lookFor(job, draft, i, brand), files = [];
      for (let k = 0; k < c.slides.length; k++) {
        const ctx = { ...look, index: k, total: c.slides.length, url: (p) => pathToFileURL(join(KIT, p)).href };
        const html = join(cdir, '_slide.html'); writeFileSync(html, slideHTML(c.slides[k], ctx));
        await page.goto(pathToFileURL(html).href);
        await page.waitForSelector('body[data-ready]', { timeout: 20000 });
        const png = join(cdir, `slide-${String(k + 1).padStart(2, '0')}.png`);
        await page.screenshot({ path: png, clip: { x: 0, y: 0, width: W, height: H } });
        files.push(png); state.done++; save();
      }
      rmSync(join(cdir, '_slide.html'), { force: true });
      writeFileSync(join(cdir, 'caption.txt'), String(c.caption || '').trim() + '\n');
      const zipFile = join(out, `${name}.zip`);
      if (!check) writeFileSync(zipFile, zip([...files.map((f) => ({ name: `${name}/${f.split(sep).pop()}`, data: readFileSync(f) })),
        { name: `${name}/caption.txt`, data: readFileSync(join(cdir, 'caption.txt')) }]));
      if (sheet) execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(cdir, 'slide-%02d.png'),
        '-vf', `scale=360:-1,tile=${Math.min(files.length, 5)}x${Math.ceil(files.length / 5)}:padding=8:color=0x222222`, '-frames:v', '1', '-q:v', '3', join(cdir, 'sheet.jpg')]);
      const entry = { index: i, title: c.title, dir: posix(relative(KIT, cdir)), zip: posix(relative(KIT, zipFile)),
        files: files.map((f) => posix(relative(KIT, f))), at: Date.now() };
      state.carousels = [...state.carousels.filter((x) => x.index !== i), entry].sort((a, b) => a.index - b.index);
      save();
    }
  } finally { await browser.close(); }
  state.state = 'done'; state.finishedAt = Date.now(); save();
  return state;
}

// ---------- CLI ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, id] = process.argv.slice(2), arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  if (!['check', 'render', 'options'].includes(cmd) || !id || !/^[a-z0-9-]{6,64}$/i.test(id)) {
    console.log('Usage: node scripts/carousel.mjs options|check|render <job-id> [--only N] [--sheet] [--check]'); process.exit(2);
  }
  if (cmd === 'options') {
    const o = readJSON(join(CAR, id, 'options.json')), { errors } = checkOptions(o);
    for (const e of errors) console.log('ERROR    ' + e);
    if (!errors.length) console.log(`OK: ${o.topics.length} topic(s), ${o.topics.reduce((n, t) => n + t.options.length, 0)} options.`);
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd === 'check') {
    const draft = readJSON(join(CAR, id, 'draft.json'));
    const { errors, warnings } = checkDraft(draft);
    for (const e of errors) console.log('ERROR    ' + e);
    for (const w of warnings) console.log('WARNING  ' + w);
    if (!errors.length) console.log(`OK: ${draft.carousels.length} carousel(s), ${draft.carousels.reduce((n, c) => n + c.slides.length, 0)} slides.`);
    process.exit(errors.length ? 1 : 0);
  }
  const only = arg('--only'); const t0 = Date.now();
  render(id, { only: only ? Number(only) - 1 : null, sheet: process.argv.includes('--sheet'), check: process.argv.includes('--check') })
    .then((s) => { for (const c of s.carousels) console.log(`${c.title}: ${c.files.length} slides -> ${c.dir}${process.argv.includes('--check') ? '/sheet.jpg' : ''}`); console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s`); })
    .catch((e) => {
      console.error(e.message || e);
      if (process.argv.includes('--check')) process.exit(1);
      const f = join(CAR, id, 'render.json'); const st = readJSON(f, {}); writeJSON(f, { ...st, state: 'error', error: String(e.message || e) });
      process.exit(1);
    });
}
