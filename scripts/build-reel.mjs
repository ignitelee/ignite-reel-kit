#!/usr/bin/env node
// IGNITE reel builder: video-projects/<name>/reel.json + word transcript -> index.html (HyperFrames).
// Usage: node scripts/build-reel.mjs video-projects/<name> [--variant <name>]
// Layouts (brand/DESIGN.md): "A" = studio band (16:9 video in the middle), "B" = full frame.
// Everything timed to words: captions (spoken word teal), hook, graphics, SFX, punch-ins, camera glides.
// Graphics in a "side" zone glide the camera so the speaker sits on the other side (like a pro edit),
// so they never sit on the face or on the captions. Full cards wipe in over the video.
// Trial-reel variants: reel.json "variants": [{"name": "v2", "hook": {...}, "headline": "...", ...}]
// override the base settings (hook/header/captions objects are merged, everything else replaced).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join, relative } from 'node:path';

const proj = resolve(process.argv[2] || '.');
const cfgPath = join(proj, 'reel.json');
if (!existsSync(cfgPath)) throw new Error(`No reel.json in ${proj}`);
const base = JSON.parse(readFileSync(cfgPath, 'utf8'));
const vName = process.argv.includes('--variant') ? process.argv[process.argv.indexOf('--variant') + 1] : null;
let cfg = base;
if (vName) {
  const v = (base.variants || []).find((x) => x.name === vName);
  if (!v) throw new Error(`No variant "${vName}" in reel.json (have: ${(base.variants || []).map((x) => x.name).join(', ')})`);
  cfg = { ...base, ...v };
  for (const k of ['hook', 'header', 'captions']) if (v[k] && base[k]) cfg[k] = { ...base[k], ...v[k] };
}
// the IB's brand (brand/brand.json, copied into each project by new-reel): logo, accent colour, website
const brandFile = join(proj, 'assets/brand/brand.json');
const BRAND = existsSync(brandFile) ? JSON.parse(readFileSync(brandFile, 'utf8')) : {};
const W = 1080, H = 1920, TEAL = (BRAND.accent_color || '#13e6ba').toLowerCase();
const layout = (cfg.layout || 'B').toUpperCase();
const P = (p) => join(proj, p);

// ---------- media ----------
const probe = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
  'format=duration:stream=codec_type,width,height', '-of', 'json', f], { encoding: 'utf8' }));
const vinfo = probe(P(cfg.video));
const vs = vinfo.streams.find((s) => s.codec_type === 'video');
const VDUR = +(+vinfo.format.duration).toFixed(3);
const DUR = +(cfg.duration ?? (VDUR + (cfg.tail ?? 0))).toFixed(3); // tail = extra seconds for an end card
const srcW = vs.width, srcH = vs.height;

// ---------- words ----------
const tj = JSON.parse(readFileSync(P(cfg.transcript), 'utf8'));
const fix = cfg.captions?.fix || {};
const norm = (s) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'$%.]/g, '').replace(/\.$/, '');
const words = (tj.words || []).filter((w) => (w.type ?? 'word') === 'word' && w.text?.trim())
  .map((w) => {
    let text = w.text.trim();
    const n = norm(text);
    if (fix[n] !== undefined) text = text.replace(new RegExp(n.replace(/[$.]/g, '\\$&'), 'i'), fix[n]);
    return { text, n: norm(text), raw: n, start: +w.start, end: +w.end };
  })
  .filter((w) => w.start < DUR);
for (const [phrase, into] of Object.entries(cfg.captions?.merge || {})) {
  const toks = phrase.split(/\s+/).map(norm);
  for (let i = 0; i + toks.length <= words.length; i++) {
    if (toks.every((t, k) => words[i + k].raw === t || words[i + k].n === t)) {
      const last = words[i + toks.length - 1], punct = (last.text.match(/[.,!?]+$/) || [''])[0];
      words.splice(i, toks.length, { text: into + punct, n: norm(into), raw: norm(into), start: words[i].start, end: last.end });
    }
  }
}

// anchor "phrase" or "phrase#2" (2nd occurrence) or a number of seconds -> {start, end}
// Inside a graphic, anchors search forwards from that graphic's start (anchorFrom), so "until": "work."
// finds the NEXT "work", not an earlier one. An explicit "#n" always counts from the start.
let anchorFrom = 0;
function anchor(a, label) {
  if (typeof a === 'number') return { start: a, end: a };
  const m = String(a).match(/^(.*?)(?:#(\d+))?$/);
  const toks = m[1].split(/\s+/).map(norm).filter(Boolean);
  let occ = +(m[2] || 1);
  const from = m[2] ? -1 : anchorFrom;
  for (let i = 0; i + toks.length <= words.length; i++) {
    if (words[i].start < from) continue;
    if (toks.every((t, k) => words[i + k].n === t || words[i + k].raw === t) && --occ === 0)
      return { start: words[i].start, end: words[i + toks.length - 1].end };
  }
  throw new Error(`Anchor not found for ${label}: "${a}". Use the exact spoken words (after fixes).`);
}

// ---------- helpers ----------
const cpFile = P('assets/brand/fonts/MaterialIconsRound-Regular.codepoints');
const CP = existsSync(cpFile) ? Object.fromEntries(readFileSync(cpFile, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split(' '))) : {};
const icon = (name) => { if (!CP[name]) throw new Error(`Unknown icon "${name}" (see brand/fonts/MaterialIconsRound-Regular.codepoints)`); return `&#x${CP[name]};`; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// "text with *teal* words and _underlined_ ones" -> html
const rich = (s) => esc(s).replace(/\*(.+?)\*/g, '<span class="t">$1</span>').replace(/_(.+?)_/g, '<span class="u">$1</span>');
const r3 = (x) => Math.round(x * 1000) / 1000;
const J = JSON.stringify;
const html = [], js = [], audio = [];
let track = 30;
const sfxTracks = [20, 21, 22, 23, 24, 25].map((t) => ({ t, free: 0 }));
const SFX = { whoosh: 'whoosh_soft.wav', pop: 'pop.wav', tick: 'tick.wav', hit: 'logo_hit.wav' };
const sfxVol = cfg.sfx_volume ?? 0.35;
let sfxN = 0;
function sfx(name, t) {
  if (!name || cfg.sfx === false) return;
  const file = SFX[name] || name;
  const d = 1.2, st = Math.max(0, r3(t));
  const tr = sfxTracks.find((x) => x.free <= st) || sfxTracks[0];
  tr.free = st + d;
  audio.push(`<audio id="sfx${++sfxN}" data-start="${st}" data-duration="${Math.min(d, DUR - st).toFixed(3)}" data-track-index="${tr.t}" src="assets/brand/sfx/${file}" data-volume="${sfxVol}"></audio>`);
}
const tw = (sel, from, to, t) => js.push(`tl.fromTo(${J(sel)},${J(from)},${J(to)},${r3(t)});`);
// exits (opacity -> 0) get a hard tl.set at their end so scrubbing never leaves stale visibility
const to = (sel, v, t) => {
  js.push(`tl.to(${J(sel)},${J(v)},${r3(t)});`);
  if (v.opacity === 0) js.push(`tl.set(${J(sel)},{opacity:0},${r3(t + (v.duration ?? 0.5))});`);
};
// entrance: rise + un-blur
const enter = (sel, t, o = {}) => tw(sel, { opacity: 0, y: o.y ?? 34, filter: 'blur(8px)', scale: o.s ?? 1 },
  { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, duration: o.d ?? 0.5, ease: o.ease ?? 'power3.out' }, t);
const fadeOut = (sel, t, d = 0.3) => to(sel, { opacity: 0, y: -12, duration: d, ease: 'power2.in' }, t);

// ---------- layout geometry ----------
// header bar only when a reel explicitly asks for one (lines / accent text); none by default
const HAS_HEADER = !!(cfg.header && (cfg.header.lines?.length || cfg.header.accent));
const HEADER_H = HAS_HEADER ? cfg.header.height ?? 236 : 0;
const BAND = { x: 0, y: cfg.band_y ?? 650, w: 1080, h: 608 };
const CAP_Y = cfg.captions?.y ?? (layout === 'A' ? BAND.y + BAND.h - 28 : 1150);
// while a big card is up the captions slide down to here (centre line), out of the graphic's way
const CARD_CAP_Y = cfg.captions?.card_y ?? 1560;
// zones: card = covers the video (wipe); side = graphic beside the speaker while the camera glides them across
// cards: clean full-screen background (dark + moving grid) that cuts away from the video; cy/ch = the
// part of the card the graphic may use (the captions stay visible on top, below that area)
const POS = layout === 'A' ? {
  card: { x: 0, y: BAND.y, w: W, h: H - BAND.y, card: true, dir: 'column', k: 1.3, cy: BAND.y + 40, ch: CARD_CAP_Y - 110 - BAND.y - 40 },
  band: { ...BAND, card: true, dir: 'row', cy: BAND.y + 26, ch: BAND.h - 26 - 128 }, // small card over the band only
  'band-left': { x: 26, y: BAND.y + 22, w: 520, h: BAND.h - 172, side: 'left', k: 0.78 },
  'band-right': { x: 534, y: BAND.y + 22, w: 520, h: BAND.h - 172, side: 'right', k: 0.78 },
  gap: { x: 90, y: HEADER_H + 20, w: 900, h: BAND.y - 150 - HEADER_H - 20, k: 0.8 },
} : {
  'side-left': { x: 40, y: HEADER_H + 60, w: 540, h: CAP_Y - 92 - HEADER_H - 60, side: 'left' },
  'side-right': { x: 500, y: HEADER_H + 60, w: 540, h: CAP_Y - 92 - HEADER_H - 60, side: 'right' },
  top: { x: 90, y: HEADER_H + 40, w: 900, h: 420 },
  low: { x: 70, y: CAP_Y + 120, w: 940, h: 1640 - CAP_Y - 120, panel: true },
  'low-clear': { x: 90, y: CAP_Y + 120, w: 900, h: 1640 - CAP_Y - 120 },
  card: { x: 0, y: HEADER_H, w: W, h: H - HEADER_H, card: true, dir: 'column', k: 1.45, cy: HEADER_H + (HEADER_H ? 70 : 170), ch: CARD_CAP_Y - 110 - HEADER_H - (HEADER_H ? 70 : 170) },
};
if (layout === 'B') { POS.left = POS['side-left']; POS.right = POS['side-right']; }

// ---------- camera ----------
const face = cfg.face || { x: srcW / 2, y: srcH * 0.3 }; // face position in SOURCE pixels
let cam;
if (layout === 'A') {
  const s = BAND.w / srcW, h = srcH * s;
  cam = { css: `left:0;top:${BAND.y}px;width:${BAND.w}px;height:${BAND.h}px`, cw: BAND.w, ch: BAND.h, L: 0, T: (BAND.h - h) / 2, VW: BAND.w, VH: h, s };
} else {
  const s = Math.max(W / srcW, H / srcH), w = srcW * s, h = srcH * s;
  const left = Math.min(0, Math.max(W - w, W / 2 - face.x * s)) + (cfg.frame_shift_x || 0);
  const top = Math.min(0, Math.max(H - h, (cfg.frame_top ?? 0)));
  cam = { css: `left:0;top:0;width:${W}px;height:${H}px`, cw: W, ch: H, L: left, T: top, VW: w, VH: h, s };
}
cam.ox = face.x * cam.s + cam.L; cam.oy = face.y * cam.s + cam.T;
// camera glide for a side graphic: move the speaker's face to the other side, zooming only as much as needed to keep the frame covered
function reframeFor(side) {
  const frac = cfg.reframe_to ?? (layout === 'A' ? 0.7 : 0.72);
  const target = cam.cw * (side === 'left' ? frac : 1 - frac);
  const dx = target - cam.ox;
  for (let s = cfg.reframe_min_scale ?? 1; s < 3; s += 0.01) {
    const L = cam.ox + (cam.L - cam.ox) * s + dx, R = cam.ox + (cam.L + cam.VW - cam.ox) * s + dx;
    const T = cam.oy + (cam.T - cam.oy) * s, B = cam.oy + (cam.T + cam.VH - cam.oy) * s;
    if (L <= 0.5 && R >= cam.cw - 0.5 && T <= 0.5 && B >= cam.ch - 0.5) return { dx: r3(dx), s: r3(s) };
  }
  return { dx: 0, s: 1 };
}

// ---------- graphics: timing pre-pass ----------
const pops = (cfg.popups || []).map((p, i) => {
  const pos = typeof p.pos === 'object' ? p.pos : POS[p.pos] || Object.values(POS)[0];
  if (!pos) throw new Error(`popup ${i + 1}: unknown pos "${p.pos}" (have: ${Object.keys(POS).join(', ')})`);
  anchorFrom = 0;
  const a = anchor(p.at, `popup ${i + 1}`);
  const lead = p.lead ?? (pos.side ? 0.4 : pos.card ? 0.15 : 0.12);
  const t0 = Math.max(0, a.start - lead);
  anchorFrom = a.start - 0.01; // "until" = the next time those words are said
  let end = p.until !== undefined ? anchor(p.until, `popup ${i + 1} until`).end + (p.hold ?? 0.45) : t0 + (p.dur ?? 2.6);
  anchorFrom = 0;
  end = Math.min(end, DUR);
  if (end - t0 < 0.5) throw new Error(`popup ${i + 1} ("${p.at}") would last ${(end - t0).toFixed(2)} s: check its "until" words`);
  return { p, i, id: `pop${i + 1}`, pos, t0, end, a: a.start, sz: (p.size ?? 1) * (pos.k ?? 1) };
});

// camera glides: merge side graphics on the same side that follow each other
const glides = [];
for (const g of pops.filter((x) => x.pos.side).sort((a, b) => a.t0 - b.t0)) {
  const s = Math.max(0, g.t0 - 0.2), e = Math.min(DUR, g.end + 0.05), last = glides[glides.length - 1];
  if (last && last.side === g.pos.side && s - last.e < 1.2) last.e = Math.max(last.e, e);
  else glides.push({ side: g.pos.side, s, e });
}
js.push(`gsap.set('#reframe',{transformOrigin:'${r3(cam.ox)}px ${r3(cam.oy)}px',x:0,scale:1});`);
glides.forEach((g, k) => {
  const rf = reframeFor(g.side), next = glides[k + 1];
  if (glides[k - 1] && g.s - glides[k - 1].e < 1.4) g.s = Math.max(g.s, glides[k - 1].e); // straight across from the last side
  to('#reframe', { x: rf.dx, scale: rf.s, duration: 0.7, ease: 'power3.inOut' }, g.s);
  // back to centre, unless another side graphic follows within 1.4 s (then glide straight across)
  if (g.e < DUR - 0.3 && !(next && next.s - g.e < 1.4)) to('#reframe', { x: 0, scale: 1, duration: 0.7, ease: 'power3.inOut' }, g.e);
});
const moveTimes = glides.flatMap((g) => [g.s, g.e]);

// punch-ins on cuts: [{at, scale}] or {"auto": true, "edl": "...", "scales": [1, 1.12], "min_hold": 4, "style": "mix"}
const punches = [];
if (Array.isArray(cfg.punch)) for (const p of cfg.punch) punches.push({ t: anchor(p.at, 'punch').start, s: p.scale });
else if (cfg.punch?.auto) {
  const edl = JSON.parse(readFileSync(P(cfg.punch.edl), 'utf8'));
  const keeps = edl.keep || edl.keeps || edl.keepRanges || edl.keep_ranges || [];
  const scales = cfg.punch.scales || [1, 1.12], minHold = cfg.punch.min_hold ?? 4;
  let t = 0, last = 0, k = 0;
  for (const r of keeps) {
    const len = (r.end ?? r[1]) - (r.start ?? r[0]);
    if (t > 0 && t - last >= minHold && DUR - t >= 1.5 && !moveTimes.some((m) => Math.abs(m - t) < 0.9)) {
      k++; punches.push({ t, s: scales[k % scales.length] }); last = t;
    }
    t += len;
  }
}
// zoom_origin_dx: zoom about a point beside the face, so zooming in pushes the face AWAY from the graphics side
const zox = r3(cam.ox + (cfg.zoom_origin_dx ?? 0));
js.push(`gsap.set('#zoom',{transformOrigin:'${zox}px ${r3(cam.oy)}px',scale:1});`);
for (const z of (cfg.zooms || []).map((z) => ({ ...z, t: anchor(z.at, 'zoom').start + (z.offset ?? 0) })).sort((a, b) => a.t - b.t)) {
  const d = z.dur ?? 0.6;
  to('#zoom', { scale: z.to, duration: d, ease: z.ease ?? (d < 0.5 ? 'expo.out' : 'power2.inOut') }, z.t);
  if (z.blur) { to('#zoom', { filter: 'blur(6px)', duration: d * 0.35, ease: 'power1.in' }, z.t); to('#zoom', { filter: 'blur(0px)', duration: d * 0.65, ease: 'power2.out' }, z.t + d * 0.35); }
}
const camScale0 = cfg.camera_scale ?? 1;
const pStyle = cfg.punch?.style ?? 'mix';
js.push(`gsap.set('#camwrap',{transformOrigin:'${zox}px ${r3(cam.oy)}px',scale:${camScale0}});`);
punches.forEach((p, k) => {
  const s = r3(p.s * camScale0);
  // "zoom" = quick zoom-blur transition into the new framing; "snap" = hard punch
  if (pStyle === 'zoom' || (pStyle === 'mix' && k % 2 === 1))
    // immediateRender:false: otherwise the blurred start state shows on every frame BEFORE the cut
    tw('#camwrap', { scale: r3(s * 1.07), filter: 'blur(4px)' }, { scale: s, filter: 'blur(0px)', duration: 0.3, ease: 'power2.out', immediateRender: false }, p.t);
  else js.push(`tl.set('#camwrap',{scale:${s}},${r3(p.t)});`);
});

html.push(`<div id="camclip" style="position:absolute;overflow:hidden;${cam.css}"><div id="reframe" style="position:absolute;inset:0"><div id="zoom" style="position:absolute;inset:0"><div id="camwrap" style="position:absolute;inset:0">
  <video id="cam" style="position:absolute;${cfg.mirror ? 'transform:scaleX(-1);' : ''}left:${r3(cam.L)}px;top:${r3(cam.T)}px;width:${r3(cam.VW)}px;height:${r3(cam.VH)}px" data-start="0" data-duration="${VDUR}" data-track-index="0" src="${cfg.video}" muted playsinline></video></div></div></div></div>`);
audio.push(`<audio id="voice" data-start="0" data-duration="${VDUR}" data-track-index="1" src="${cfg.video}" data-volume="${cfg.voice_volume ?? 1}"></audio>`);

// ---------- music bed (pre-mixed with ffmpeg, level relative to the voice) ----------
if (cfg.music) {
  // integrated loudness (LUFS) via ffmpeg's ebur128 summary (printed on stderr)
  const measure = (f) => {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-vn', '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
    const m = (r.stderr || '').match(/Integrated loudness:\s*\r?\n\s*I:\s+(-?[\d.]+)/);
    if (!m) throw new Error(`Could not measure loudness of ${f}`);
    return +m[1];
  };
  const mfile = P(cfg.music.file);
  const v = measure(P(cfg.video)), m = measure(mfile);
  const gain = (v - (cfg.music.under_db ?? 16)) - m;
  const bed = 'assets/music_bed.wav';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(cfg.music.start ?? 0), '-i', mfile, '-t', String(DUR), '-af',
    `volume=${gain.toFixed(2)}dB,afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, DUR - 2.5).toFixed(2)}:d=2.5`, '-ar', '48000', P(bed)]);
  console.log(`music: voice ${v} LUFS, track ${m} LUFS -> gain ${gain.toFixed(1)} dB (${cfg.music.under_db ?? 16} dB under)`);
  audio.push(`<audio id="music" data-start="0" data-duration="${DUR}" data-track-index="2" src="${bed}" data-volume="1"></audio>`);
}

// ---------- persistent branding ----------
const hd = cfg.header || {};
const logoSrc = hd.logo || BRAND.logo;
if (HAS_HEADER) html.push(`<div id="header" class="clip" data-start="0" data-duration="${DUR}" data-track-index="3">
  <div class="hd-text">${(hd.lines || []).map((l) => `<div>${rich(l)}</div>`).join('')}${hd.accent ? `<div class="hd-accent">${rich(hd.accent)}</div>` : ''}</div>
  ${logoSrc ? `<img class="hd-logo" src="assets/brand/${esc(logoSrc)}" alt="logo">` : ''}</div>`);
// no header bar (the default): the user's logo as a small badge in the top-right corner
else if (logoSrc && cfg.logo !== false)
  html.push(`<img id="logobadge" class="clip" data-start="0" data-duration="${DUR}" data-track-index="3" src="assets/brand/${esc(logoSrc)}" alt="logo" style="position:absolute;top:${cfg.logo_y ?? 96}px;right:${cfg.logo_x ?? 150}px;width:${cfg.logo_w ?? 200}px;height:auto;max-height:110px;object-fit:contain;object-position:right top;z-index:19;filter:drop-shadow(0 2px 10px rgba(0,0,0,.55))">`);
if (layout === 'A') {
  if (cfg.headline) html.push(`<div id="headline" class="clip" data-start="0" data-duration="${DUR}" data-track-index="4"><div>${rich(cfg.headline)}</div></div>`);
  if (cfg.description) html.push(`<div id="desc" class="clip" data-start="0" data-duration="${DUR}" data-track-index="5">${rich(cfg.description)}</div>`);
  if (cfg.url !== false) html.push(`<div id="url" class="clip" data-start="0" data-duration="${DUR}" data-track-index="6">${esc(cfg.url || BRAND.website || '')}</div>`);
}

// ---------- hook (first seconds) ----------
if (cfg.hook) {
  const hk = cfg.hook, until = hk.until !== undefined ? anchor(hk.until, 'hook.until').end + 0.3 : 3.2;
  const y = hk.y ?? (layout === 'A' ? BAND.y + 40 : CAP_Y + 140);
  html.push(`<div id="hook" class="clip" data-start="0" data-duration="${r3(until)}" data-track-index="7" style="top:${y}px">
    ${hk.label ? `<div class="hk-label"><span class="ig-icon hk-ic">${icon(hk.icon || 'campaign')}</span>${esc(hk.label)}</div>` : ''}
    <div class="hk-title">${rich(hk.title)}</div></div>`);
  enter('#hook .hk-label', 0.05, { d: 0.35, y: 20 });
  enter('#hook .hk-title', 0.25, { d: 0.4, y: 20 });
  sfx('pop', 0.05);
  fadeOut('#hook', until - 0.3, 0.25);
}

// ---------- graphics ----------
const labelHtml = (p, sz) => `${p.label ? `<div class="plabel" style="font-size:${28 * sz}px">${p.icon ? `<span class="ig-icon">${icon(p.icon)}</span>` : ''}<span>${esc(p.label)}</span></div>` : ''}` +
  `${p.title ? `<div class="ptitle" style="font-size:${52 * sz}px">${rich(p.title)}</div>` : ''}`;
const MARK = { tick: () => icon('check'), cross: () => icon('close'), num: (k) => String(k + 1), chev: () => '&raquo;', dot: () => '' };
const tAt = (x, label, dflt) => (x !== undefined ? anchor(x, label).start - 0.08 : dflt);

for (const g of pops) {
  const { p, i, id, pos, t0, end, sz } = g;
  anchorFrom = g.a - 0.01; // items, crosses, stamps, counters: search from this graphic's own words onwards
  const L = `popup ${i + 1}`;
  const usePanel = (pos.side || pos.panel) && !['stack', 'title', 'chip', 'phone', 'clip', 'glass', 'network', 'beforeafter'].includes(p.type) && p.panel !== false;
  const box = `left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;height:${pos.h}px;text-align:${p.align || (pos.side ? 'left' : 'center')}`;
  const cls = `pop${pos.card ? ' card' : ''}${pos.side ? ' side' : ''}`;
  let inner = '';
  const after = []; // extra timed elements (phone video, stamp)
  const labelT = t0 + (pos.side ? 0.3 : 0.1);
  const first = (k, ti) => (k === 0 && !p.title ? Math.min(ti, labelT + 0.25) : ti);
  const labelAnim = () => { if (p.label) enter(`#${id} .plabel`, labelT, { y: 16, d: 0.4 }); if (p.title) enter(`#${id} .ptitle`, labelT + 0.1, { y: 20, d: 0.45 }); };

  if (p.type === 'stack') {
    inner = `${p.small ? `<div class="ig-small" style="font-size:${48 * sz}px">${rich(p.small)}</div>` : ''}<div class="ig-big" style="font-size:${150 * sz}px">${esc(p.big)}</div>${p.italic ? `<div class="ig-italic" style="font-size:${96 * sz}px">${esc(p.italic)}</div>` : ''}`;
    if (p.small) enter(`#${id} .ig-small`, t0); enter(`#${id} .ig-big`, t0 + 0.25); if (p.italic) enter(`#${id} .ig-italic`, t0 + 0.5);
  } else if (p.type === 'stat') {
    const m = String(p.value).match(/^(\D*)([\d,.]+)(.*)$/);
    inner = `${labelHtml(p, sz)}${p.small ? `<div class="ig-small" style="font-size:${44 * sz}px">${rich(p.small)}</div>` : ''}<div class="stat" style="font-size:${170 * sz}px"><span class="num">${esc(p.value)}</span></div>${p.sub ? `<div class="stat-label" style="font-size:${40 * sz}px">${rich(p.sub)}</div>` : ''}`;
    labelAnim(); if (p.small) enter(`#${id} .ig-small`, t0 + 0.1); enter(`#${id} .stat`, t0 + 0.2); if (p.sub) enter(`#${id} .stat-label`, t0 + 0.5);
    if (m && p.count !== false) {
      const n = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length;
      js.push(`(function(){const el=document.querySelector('#${id} .num'),o={v:0};tl.to(o,{v:${n},duration:0.9,ease:'power2.out',onUpdate(){el.textContent=${J(m[1])}+o.v.toFixed(${dec})+${J(m[3])};}},${r3(t0 + 0.2)});tl.set(o,{v:0},0);})();`);
    }
  } else if (p.type === 'chip') {
    inner = `<div class="chip" style="font-size:${46 * sz}px">${p.icon ? `<span class="ig-icon">${icon(p.icon)}</span>` : ''}<span>${rich(p.text)}</span></div>`;
    tw(`#${id} .chip`, { opacity: 0, scale: 0.6, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.8)' }, t0);
  } else if (p.type === 'list') {
    // marks: tick (yes / you get), cross (no / you don't), num (steps), chev, dot. Per item: {"mark": "cross"}
    inner = `${labelHtml(p, sz)}<div class="lis">${p.items.map((it, k) => {
      const mk = (typeof it === 'object' && it.mark) || p.mark || 'chev';
      return `<div class="li li${k}" style="font-size:${44 * sz}px"><span class="mk mk-${mk}">${MARK[mk](k)}</span><span class="lt">${rich(it.text ?? it)}${mk === 'cross' ? '<i class="strike"></i>' : ''}</span></div>`;
    }).join('')}</div>`;
    labelAnim();
    p.items.forEach((it, k) => {
      const mk = (typeof it === 'object' && it.mark) || p.mark || 'chev';
      const ti = first(k, Math.max(tAt(it.at, `${L} item ${k + 1}`, labelT + 0.35 + k * 0.45), labelT + 0.15));
      tw(`#${id} .li${k}`, { opacity: 0, x: -28 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }, ti);
      tw(`#${id} .li${k} .mk`, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.42, ease: 'back.out(2.4)' }, ti + 0.05);
      if (mk === 'cross') {
        tw(`#${id} .li${k} .strike`, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power2.inOut' }, ti + 0.4);
        to(`#${id} .li${k} .lt`, { color: 'rgba(255,255,255,0.55)', duration: 0.3 }, ti + 0.45);
      }
      sfx('tick', ti);
    });
  } else if (p.type === 'split') {
    // tiles: [{icon, title, sub, at, highlight}] side by side (cards) or stacked (side zones)
    const dir = p.dir || pos.dir || (pos.side ? 'column' : 'row');
    inner = `${labelHtml(p, sz)}<div class="tiles ${dir}">${p.tiles.map((t, k) => `<div class="tile tile${k}"><span class="tic ig-icon" style="font-size:${50 * sz}px;width:${84 * sz}px;height:${84 * sz}px">${icon(t.icon)}</span><div class="ttx"><div class="tt" style="font-size:${42 * sz}px">${rich(t.title)}</div>${t.sub ? `<div class="ts" style="font-size:${30 * sz}px">${rich(t.sub)}</div>` : ''}</div></div>`).join('')}</div>`;
    labelAnim();
    p.tiles.forEach((t, k) => {
      const ti = first(k, Math.max(tAt(t.at, `${L} tile ${k + 1}`, labelT + 0.3 + k * 0.5), labelT + 0.15));
      tw(`#${id} .tile${k}`, { opacity: 0, y: 34, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' }, ti);
      tw(`#${id} .tile${k} .tic`, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(2)' }, ti + 0.1);
      sfx('pop', ti);
      if (t.highlight) {
        const th = t.highlight_at !== undefined ? anchor(t.highlight_at, `${L} highlight`).start : ti + 0.5;
        to(`#${id} .tile${k}`, { borderColor: 'rgba(19,230,186,0.95)', backgroundColor: 'rgba(19,230,186,0.10)', boxShadow: '0 0 0 1px rgba(19,230,186,0.6), 0 18px 60px rgba(19,230,186,0.28)', duration: 0.4 }, th);
        to(`#${id} .tile${k} .tic`, { backgroundColor: TEAL, color: '#04110e', duration: 0.3 }, th);
      }
    });
  } else if (p.type === 'flow') {
    // nodes: [{icon, text, sub, at}] joined by drawn arrows; pay: {at, text} sends a coin back to node 0
    const n = p.nodes.length, dir = p.dir || pos.dir || (pos.side ? 'column' : 'row');
    const pad = pos.side ? 76 : 0, labelH = (p.label ? 48 : 0) + (p.title ? 70 : 0);
    const avail = pos.ch ?? pos.h;
    const cw = pos.side ? pos.w - pad : dir === 'column' ? Math.min(680, pos.w - 140) : Math.min(pos.w - 140, 940);
    const ch = pos.side ? Math.min(pos.h - 90 - labelH, 210 * n) : Math.min(avail - 30 - labelH, dir === 'column' ? 190 * n * sz : 400);
    const D = (dir === 'column' ? 92 : 112) * sz;
    const nodes = [], svg = [];
    let rail = '';
    if (dir === 'column') {
      const step = Math.min(200 * sz, (ch - D - 8) / Math.max(1, n - 1)), cx = D / 2 + 4, xr = cw - 22;
      p.nodes.forEach((nd, k) => nodes.push({ cx, cy: D / 2 + 4 + k * step, tx: D + 28, ty: D / 2 + 4 + k * step - 50, tw: xr - 64 - (D + 28), th: 100, align: 'left' }));
      for (let k = 0; k < n - 1; k++) { const y1 = nodes[k].cy + D / 2 + 10, y2 = nodes[k + 1].cy - D / 2 - 12; svg.push(`<path class="ln ln${k}" d="M${cx} ${y1} L${cx} ${y2}" pathLength="1"/><path class="ah ah${k}" d="M${cx - 10} ${y2 - 10} L${cx} ${y2} L${cx + 10} ${y2 - 10}"/>`); }
      if (p.pay) { const yl = nodes[n - 1].cy, yf = nodes[0].cy, xs = xr - 52; rail = { d: `M${xs} ${yl} L${xr - 16} ${yl} Q${xr} ${yl} ${xr} ${yl - 16} L${xr} ${yf + 16} Q${xr} ${yf} ${xr - 16} ${yf} L${xs} ${yf}`, ah: `M${xs + 11} ${yf - 11} L${xs} ${yf} L${xs + 11} ${yf + 11}`, from: [xr, yl], to: [xr, yf], chip: null }; }
    } else {
      const step = cw / n, cy = D / 2 + 10; // each node owns an equal column, so labels never leave the card
      p.nodes.forEach((nd, k) => nodes.push({ cx: step / 2 + k * step, cy, tx: D / 2 + k * step - step / 2 + 6, ty: cy + D / 2 + 16, tw: step - 12, th: 110, align: 'center' }));
      for (let k = 0; k < n - 1; k++) { const x1 = nodes[k].cx + D / 2 + 12, x2 = nodes[k + 1].cx - D / 2 - 14; svg.push(`<path class="ln ln${k}" d="M${x1} ${cy} L${x2} ${cy}" pathLength="1"/><path class="ah ah${k}" d="M${x2 - 10} ${cy - 10} L${x2} ${cy} L${x2 - 10} ${cy + 10}"/>`); }
      if (p.pay) { const yr = ch - 30, ys = cy + D / 2 + 136, xl = nodes[n - 1].cx, xf = nodes[0].cx; rail = { d: `M${xl} ${ys} L${xl} ${yr - 16} Q${xl} ${yr} ${xl - 16} ${yr} L${xf + 16} ${yr} Q${xf} ${yr} ${xf} ${yr - 16} L${xf} ${ys}`, ah: `M${xf - 11} ${ys + 11} L${xf} ${ys} L${xf + 11} ${ys + 11}`, from: [xl, yr], to: [xf, yr], chip: [(xl + xf) / 2, yr] }; }
    }
    if (rail) svg.push(`<path class="rail" d="${rail.d}" pathLength="1"/><path class="rah" d="${rail.ah}"/>`);
    inner = `${labelHtml(p, sz)}<div class="flow ${dir}" style="width:${r3(cw)}px;height:${r3(ch)}px;margin:0 auto"><svg width="${r3(cw)}" height="${r3(ch)}" viewBox="0 0 ${r3(cw)} ${r3(ch)}">${svg.join('')}</svg>` +
      p.nodes.map((nd, k) => `<div class="nd nd${k}" style="left:${r3(nodes[k].cx - D / 2)}px;top:${r3(nodes[k].cy - D / 2)}px"><div class="nc ig-icon" style="width:${r3(D)}px;height:${r3(D)}px;font-size:${r3(D * 0.52)}px">${icon(nd.icon)}</div></div>` +
        `<div class="nt nt${k}" style="left:${r3(nodes[k].tx)}px;top:${r3(nodes[k].ty)}px;width:${r3(nodes[k].tw)}px;height:${nodes[k].th}px;text-align:${nodes[k].align};align-items:${nodes[k].align === 'center' ? 'center' : 'flex-start'};justify-content:${dir === 'column' ? 'center' : 'flex-start'}"><div class="nn" style="font-size:${40 * sz}px">${rich(nd.text)}</div>` +
        `<div class="subs" style="font-size:${28 * sz}px">${nd.sub ? `<div class="ns ns0">${rich(nd.sub)}</div>` : ''}${k === 0 && p.pay ? `<div class="ns pay">${rich(p.pay.text)}</div>` : ''}</div></div>`).join('') +
      (rail ? `<div class="coin" style="left:${r3(rail.from[0] - 29)}px;top:${r3(rail.from[1] - 29)}px">${icon(p.pay.icon || 'paid')}</div>` : '') +
      (rail?.chip ? `<div class="paychip" style="left:${r3(rail.chip[0])}px;top:${r3(rail.chip[1])}px;font-size:${32 * sz}px">${rich(p.pay.chip || p.pay.text)}</div>` : '') + `</div>`;
    labelAnim();
    js.push(`gsap.set('#${id} .ln, #${id} .rail',{strokeDasharray:1,strokeDashoffset:1});gsap.set('#${id} .ah, #${id} .rah',{opacity:0});`);
    p.nodes.forEach((nd, k) => {
      const ti = first(k, Math.max(tAt(nd.at, `${L} node ${k + 1}`, labelT + 0.3 + k * 0.6), labelT + 0.15 + (k ? 0.3 : 0)));
      if (k > 0) { tw(`#${id} .ln${k - 1}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.3, ease: 'power1.inOut' }, ti - 0.28); tw(`#${id} .ah${k - 1}`, { opacity: 0 }, { opacity: 1, duration: 0.12 }, ti - 0.02); }
      tw(`#${id} .nd${k}`, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, ti);
      tw(`#${id} .nt${k}`, { opacity: 0, x: dir === 'column' ? -18 : 0, y: dir === 'column' ? 0 : 14 }, { opacity: 1, x: 0, y: 0, duration: 0.4, ease: 'power3.out' }, ti + 0.1);
      sfx('tick', ti);
    });
    if (rail) {
      const tp = anchor(p.pay.at, `${L} pay`).start - 0.1;
      tw(`#${id} .rail`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, tp);
      tw(`#${id} .rah`, { opacity: 0 }, { opacity: 1, duration: 0.15 }, tp + 0.65);
      tw(`#${id} .coin`, { opacity: 0, scale: 0.4, x: 0, y: 0 }, { opacity: 1, scale: 1, duration: 0.2 }, tp);
      to(`#${id} .coin`, { x: r3(rail.to[0] - rail.from[0]), y: r3(rail.to[1] - rail.from[1]), duration: 0.75, ease: 'power2.inOut' }, tp + 0.1);
      to(`#${id} .coin`, { opacity: 0, scale: 0.3, duration: 0.2 }, tp + 0.85);
      to(`#${id} .nd0 .nc`, { backgroundColor: TEAL, color: '#04110e', boxShadow: '0 0 50px rgba(19,230,186,0.9)', duration: 0.25 }, tp + 0.8);
      if (p.nodes[0].sub) to(`#${id} .nt0 .ns0`, { opacity: 0, y: -10, duration: 0.2 }, tp + 0.8);
      tw(`#${id} .nt0 .pay`, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }, tp + 0.85);
      if (rail.chip) tw(`#${id} .paychip`, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, tp + 0.45);
      sfx('pop', tp + 0.85);
    }
  } else if (p.type === 'phone') {
    // screen recording in a phone (video in assets/), optional label above, caption below, stamp badge
    const pv = probe(P(p.src)).streams.find((s) => s.codec_type === 'video');
    const labelH = p.label ? 64 * sz : 0, capH = p.caption ? 70 * sz : 0, bez = 14;
    const cy = pos.cy ?? pos.y, chh = pos.ch ?? pos.h;
    const PH = Math.min(chh - labelH - capH - 10, p.height ?? 900), SH = PH - 2 * bez, SW = SH * pv.width / pv.height, PW = SW + 2 * bez;
    const px = pos.x + (pos.w - PW) / 2, py = cy + labelH + (chh - labelH - capH - PH) / 2;
    inner = `${p.label ? `<div class="plabel" style="font-size:${28 * sz}px;justify-content:center;position:absolute;left:0;right:0;top:${r3(py - pos.y - labelH + 6)}px">${p.icon ? `<span class="ig-icon">${icon(p.icon)}</span>` : ''}<span>${esc(p.label)}</span></div>` : ''}` +
      `<div class="phone" style="left:${r3(px - pos.x)}px;top:${r3(py - pos.y)}px;width:${r3(PW)}px;height:${r3(PH)}px"></div>` +
      `${p.caption ? `<div class="phcap" style="position:absolute;left:0;right:0;top:${r3(py - pos.y + PH + 18)}px;font-size:${34 * sz}px">${rich(p.caption)}</div>` : ''}`;
    after.push(`<div id="${id}-vw" class="phonev" style="left:${r3(px + bez)}px;top:${r3(py + bez)}px;width:${r3(SW)}px;height:${r3(SH)}px"><video id="${id}-v" data-start="${r3(t0)}" data-duration="${r3(end - t0)}" data-track-index="${track++}" data-media-start="${p.media_start ?? 0}" src="${esc(p.src)}" muted playsinline></video></div>`);
    tw([`#${id} .phone`, `#${id}-vw`].join(','), { opacity: 0, y: 90, rotation: pos.side === 'right' ? -4 : 4 }, { opacity: 1, y: 0, rotation: 0, duration: 0.65, ease: 'power3.out' }, t0 + 0.15);
    if (p.label) enter(`#${id} .plabel`, t0 + 0.3, { y: 14, d: 0.4 });
    if (p.caption) enter(`#${id} .phcap`, t0 + 0.6, { y: 14, d: 0.4 });
    to(`#${id}-vw`, { opacity: 0, y: 40, duration: 0.35, ease: 'power2.in' }, end - 0.35);
    if (p.stamp) {
      const ts = anchor(p.stamp.at, `${L} stamp`).start;
      after.push(`<div id="${id}-st" class="clip stamp" data-start="${r3(ts)}" data-duration="${r3(Math.max(0.3, end - ts))}" data-track-index="${track++}" style="left:${r3(px + PW - 120)}px;top:${r3(py + 30)}px">${esc(p.stamp.text)}</div>`);
      tw(`#${id}-st`, { scale: 2.6, opacity: 0, rotation: -40 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.38, ease: 'back.out(1.7)' }, ts);
      to(`#${id}-st`, { opacity: 0, duration: 0.3 }, end - 0.35);
      sfx('hit', ts);
    }
  } else if (p.type === 'clip') {
    // B-roll / screen recording filling a card zone, wiped in and out
    after.push(`<div id="${id}-vw" class="clipv" style="left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;height:${pos.h}px"><video id="${id}-v" data-start="${r3(t0)}" data-duration="${r3(end - t0)}" data-track-index="${track++}" data-media-start="${p.media_start ?? 0}" src="${esc(p.src)}" muted playsinline></video></div>`);
    tw(`#${id}-vw`, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'power3.inOut' }, t0);
    to(`#${id}-vw`, { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.45, ease: 'power3.inOut' }, end - 0.45);
    if (p.text) { inner = `<div class="cliptext" style="font-size:${56 * sz}px">${rich(p.text)}</div>`; enter(`#${id} .cliptext`, t0 + 0.4); }
    sfx('whoosh', t0);
  } else if (p.type === 'glass') {
    // frosted (smoked) glass cards over the video: real logos, a number, roles that get crossed out
    const al = p.align || (pos.x + pos.w / 2 > W / 2 ? 'right' : 'left');
    const logoHtml = (it) => {
      if (!it.logo) return `<span class="glogo ig-icon" style="font-size:${r3(40 * sz)}px;color:${it.color || TEAL};background:${it.bg || 'rgba(255,255,255,.10)'}">${icon(it.icon || 'bolt')}</span>`;
      if (it.logo.endsWith('.svg')) {
        const svg = readFileSync(P(it.logo), 'utf8').replace(/<title>[^<]*<\/title>/, '').replace('<svg ', `<svg fill="${it.color || '#ffffff'}" width="${r3(44 * sz)}" height="${r3(44 * sz)}" `);
        return `<span class="glogo" style="background:${it.bg || 'rgba(255,255,255,.12)'}">${svg}</span>`;
      }
      return `<span class="glogo" style="background:${it.bg || '#fff'}"><img src="${esc(it.logo)}" style="width:${r3(44 * sz)}px;height:${r3(44 * sz)}px;object-fit:contain"></span>`;
    };
    const crossOf = (it) => it.cross_at ?? p.cross_at;
    inner = `<div class="gstack ${al}">${p.label ? `<div class="glabel" style="font-size:${r3(26 * sz)}px">${esc(p.label)}</div>` : ''}` +
      p.items.map((it, k) => `<div class="gcard gc${k}" style="font-size:${r3(38 * sz)}px">${logoHtml(it)}<div class="gtx"><div class="gt">${rich(it.title)}${crossOf(it) !== undefined ? '<i class="strike"></i>' : ''}</div>${it.sub ? `<div class="gs" style="font-size:${r3(24 * sz)}px">${rich(it.sub)}</div>` : ''}</div>${crossOf(it) !== undefined ? `<span class="gx ig-icon">${icon('close')}</span>` : ''}</div>`).join('') + `</div>`;
    if (p.label) enter(`#${id} .glabel`, t0, { y: 12, d: 0.35 });
    p.items.forEach((it, k) => {
      const ti = Math.max(tAt(it.at, `${L} item ${k + 1}`, t0 + 0.1 + k * 0.4), t0);
      tw(`#${id} .gc${k}`, { opacity: 0, x: al === 'right' ? 70 : -70, scale: 0.9, filter: 'blur(8px)' }, { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', duration: 0.55, ease: 'power3.out' }, ti);
      sfx('pop', ti);
      if (crossOf(it) !== undefined) {
        const tc = anchor(crossOf(it), `${L} cross`).start + (it.cross_at === undefined ? k * 0.18 : 0);
        tw(`#${id} .gc${k} .strike`, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power2.inOut' }, tc);
        tw(`#${id} .gc${k} .gx`, { scale: 0, opacity: 0, rotation: -60 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.4, ease: 'back.out(2.4)' }, tc + 0.1);
        to(`#${id} .gc${k} .gtx`, { color: 'rgba(255,255,255,0.62)', duration: 0.3 }, tc + 0.1);
        sfx('tick', tc);
      }
    });
  } else if (p.type === 'network') {
    // e.g. AI agents checking each other's work: satellites round a centre node, check marks, a counter
    const cw = Math.min(pos.w - 120, 900);
    const ch = (pos.ch ?? pos.h) - (p.label ? 60 : 0) - (p.title ? 80 : 0) - (p.counter ? 240 * sz : 0);
    const n = p.agents.length, cxC = cw / 2, cyC = ch / 2, R = Math.min(cw * 0.36, ch * 0.36), D = 116 * sz, DC = 170 * sz;
    const sats = p.agents.map((a, k) => { const ang = -Math.PI / 2 + (2 * Math.PI * k) / n; return { x: cxC + R * Math.cos(ang), y: cyC + R * Math.sin(ang) }; });
    inner = `${labelHtml(p, sz)}<div class="net" style="width:${r3(cw)}px;height:${r3(ch)}px"><svg width="${r3(cw)}" height="${r3(ch)}">` +
      sats.map((q, k) => `<line class="nl nl${k}" x1="${r3(q.x)}" y1="${r3(q.y)}" x2="${r3(cxC)}" y2="${r3(cyC)}"/>`).join('') + `</svg>` +
      `<div class="ncen" style="left:${r3(cxC - DC / 2)}px;top:${r3(cyC - DC / 2)}px;width:${r3(DC)}px;height:${r3(DC)}px"><span class="ig-icon" style="font-size:${r3(DC * 0.45)}px">${icon(p.center.icon || 'description')}</span><span class="ncl" style="font-size:${r3(24 * sz)}px">${esc(p.center.text)}</span></div>` +
      sats.map((q, k) => `<div class="nsat ns${k}" style="left:${r3(q.x - D / 2)}px;top:${r3(q.y - D / 2)}px;width:${r3(D)}px;height:${r3(D)}px"><span class="ig-icon" style="font-size:${r3(D * 0.46)}px">${icon(p.agents[k].icon || 'smart_toy')}</span><span class="nck ig-icon">${icon('check')}</span><span class="nsl" style="font-size:${r3(22 * sz)}px">${esc(p.agents[k].text)}</span></div>`).join('') + `</div>` +
      (p.counter ? `<div class="ncount"><div class="stat" style="font-size:${r3(110 * sz)}px"><span class="num">0</span></div><div class="stat-label" style="font-size:${r3(34 * sz)}px">${rich(p.counter.label)}</div></div>` : '');
    labelAnim();
    js.push(`gsap.set('#${id} .nl',{strokeDasharray:'10 12'});`);
    tw(`#${id} .ncen`, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, t0 + 0.2);
    const ts = p.agents_at !== undefined ? anchor(p.agents_at, `${L} agents`).start : t0 + 0.5;
    sats.forEach((q, k) => {
      const tk = ts + k * 0.22;
      tw(`#${id} .ns${k}`, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, tk);
      tw(`#${id} .nl${k}`, { opacity: 0 }, { opacity: 1, duration: 0.3 }, tk + 0.1);
      sfx('tick', tk);
    });
    tw(`#${id} .nl`, { strokeDashoffset: 0 }, { strokeDashoffset: -220, duration: r3(end - t0), ease: 'none' }, t0); // marching dashes
    const tcheck = p.check_at !== undefined ? anchor(p.check_at, `${L} checks`).start : ts + n * 0.22 + 0.4;
    sats.forEach((q, k) => {
      tw(`#${id} .ns${k} .nck`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.5)' }, tcheck + k * 0.25);
      to(`#${id} .ns${k}`, { borderColor: 'rgba(19,230,186,0.95)', boxShadow: '0 0 40px rgba(19,230,186,0.45)', duration: 0.3 }, tcheck + k * 0.25);
    });
    if (p.counter) {
      const tcn = p.counter.at !== undefined ? anchor(p.counter.at, `${L} counter`).start : tcheck;
      const dcn = Math.max(1, (p.counter.until !== undefined ? anchor(p.counter.until, `${L} counter until`).start : end - 0.6) - tcn);
      enter(`#${id} .ncount`, tcn - 0.2, { y: 20 });
      js.push(`(function(){const el=document.querySelector('#${id} .num'),o={v:0};tl.to(o,{v:${p.counter.value},duration:${r3(dcn)},ease:'power2.in',onUpdate(){el.textContent=Math.round(o.v).toLocaleString('en-GB')+${J(p.counter.suffix || '')};}},${r3(tcn)});tl.set(o,{v:0},0);})();`);
    }
  } else if (p.type === 'beforeafter') {
    // a "before" tile (e.g. a static PDF) -> arrow -> "now": a phone with a real screen recording
    const cy = pos.cy ?? pos.y, chh = pos.ch ?? pos.h, top0 = cy - pos.y;
    const labelH = p.label ? 70 : 0, tileW = 680, tileH = 210;
    const tY = top0 + labelH, aY = tY + tileH + 16, aH = 90, phY = aY + aH + 12;
    const pv = probe(P(p.after.src)).streams.find((x) => x.codec_type === 'video');
    const capH = p.after.caption ? 70 : 0, bez = 14;
    const PH = Math.min(top0 + chh - phY - capH, 900), SH = PH - 2 * bez, SW = SH * pv.width / pv.height, PW = SW + 2 * bez;
    const pxL = (pos.w - PW) / 2;
    inner = `${p.label ? `<div class="plabel" style="position:absolute;left:0;right:0;top:${r3(top0)}px;justify-content:center;font-size:${r3(28 * sz)}px">${p.icon ? `<span class="ig-icon">${icon(p.icon)}</span>` : ''}<span>${esc(p.label)}</span></div>` : ''}` +
      `<div class="batile" style="left:${r3((pos.w - tileW) / 2)}px;top:${r3(tY)}px;width:${tileW}px;height:${tileH}px"><span class="batic ig-icon" style="font-size:96px">${icon(p.before.icon || 'picture_as_pdf')}</span><div><div class="batag">${esc(p.before.tag || 'Before')}</div><div class="bat" style="font-size:50px">${rich(p.before.text)}</div>${p.before.sub ? `<div class="bas" style="font-size:30px">${rich(p.before.sub)}</div>` : ''}</div></div>` +
      `<svg class="baarrow" style="left:${r3(pos.w / 2 - 30)}px;top:${r3(aY)}px" width="60" height="${aH}"><path d="M30 4 L30 ${aH - 8} M14 ${aH - 24} L30 ${aH - 6} L46 ${aH - 24}" pathLength="1"/></svg>` +
      `<div class="phone" style="left:${r3(pxL)}px;top:${r3(phY)}px;width:${r3(PW)}px;height:${r3(PH)}px"></div>` +
      (p.after.caption ? `<div class="batag2" style="left:0;right:0;top:${r3(phY + PH + 16)}px;font-size:${r3(36 * sz)}px">${rich(p.after.caption)}</div>` : '');
    after.push(`<div id="${id}-vw" class="phonev" style="left:${r3(pos.x + pxL + bez)}px;top:${r3(pos.y + phY + bez)}px;width:${r3(SW)}px;height:${r3(SH)}px"><video id="${id}-v" data-start="${r3(t0)}" data-duration="${r3(end - t0)}" data-track-index="${track++}" data-media-start="${p.after.media_start ?? 0}" src="${esc(p.after.src)}" muted playsinline></video></div>`);
    if (p.label) enter(`#${id} .plabel`, t0 + 0.2, { y: 14, d: 0.4 });
    const tb = p.before.at !== undefined ? anchor(p.before.at, `${L} before`).start : t0 + 0.3;
    const ta = p.after.at !== undefined ? anchor(p.after.at, `${L} after`).start : tb + 1.5;
    enter(`#${id} .batile`, tb, { y: 30 });
    sfx('pop', tb);
    js.push(`gsap.set('#${id} .baarrow path',{strokeDasharray:1,strokeDashoffset:1});`);
    tw(`#${id} .baarrow path`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.inOut' }, ta - 0.5);
    to(`#${id} .batile`, { opacity: 0.45, scale: 0.94, duration: 0.4 }, ta);
    tw([`#${id} .phone`, `#${id}-vw`].join(','), { opacity: 0, y: 90 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, ta - 0.1);
    if (p.after.caption) enter(`#${id} .batag2`, ta + 0.4, { y: 14, d: 0.4 });
    to(`#${id}-vw`, { opacity: 0, duration: 0.3 }, end - 0.4);
    sfx('whoosh', ta);
  } else if (p.type === 'title') {
    inner = `<div class="ig-title" style="font-size:${130 * sz}px">${esc(p.text)}</div>${p.sub ? `<div class="ig-small" style="font-size:${44 * sz}px;margin-top:18px">${rich(p.sub)}</div>` : ''}`;
    enter(`#${id} .ig-title`, t0 + 0.2, { s: 0.9 }); if (p.sub) enter(`#${id} .ig-small`, t0 + 0.5);
  } else if (p.type === 'hl') {
    inner = `<div class="hlline" style="font-size:${60 * sz}px">${esc(p.text).replace(esc(p.key), `<span class="ig-hl" id="${id}hl" style="--hl:0">${esc(p.key)}</span>`)}</div>`;
    enter(`#${id} .hlline`, t0);
    const kt = p.key_at !== undefined ? anchor(p.key_at, `${L} key`).start : t0 + 0.45;
    js.push(`tl.fromTo('#${id}hl',{'--hl':0},{'--hl':1,duration:0.3,ease:'power2.out'},${r3(kt)});tl.set('#${id}hl',{className:'ig-hl on'},${r3(kt + 0.15)});`);
  } else if (p.type === 'image') {
    inner = `${labelHtml(p, sz)}<img class="pimg" src="${esc(p.src)}" style="max-width:${p.w || 90}%;max-height:${p.h || 80}%">${p.caption ? `<div class="ig-small" style="font-size:${40 * sz}px;margin-top:16px">${rich(p.caption)}</div>` : ''}`;
    labelAnim(); enter(`#${id} .pimg`, t0 + 0.2); if (p.caption) enter(`#${id} .ig-small`, t0 + 0.5);
  } else throw new Error(`${L}: unknown type "${p.type}"`);

  const core = usePanel ? `<div class="panel">${inner}</div>` : ['phone', 'glass', 'beforeafter'].includes(p.type) ? inner : `<div class="pin">${inner}</div>`;
  const body = pos.card ? `<div class="cgrid"></div><div class="cglow"></div>${core}` : core;
  const cardPad = pos.card && pos.cy !== undefined ? `;padding:${pos.cy - pos.y}px 70px ${pos.y + pos.h - pos.cy - pos.ch}px;justify-content:center` : '';
  if (p.type !== 'clip' || p.text) html.push(`<div id="${id}" class="clip ${cls}" data-start="${r3(t0)}" data-duration="${r3(end - t0)}" data-track-index="${track++}" style="${box}${cardPad}">${body}</div>`);
  html.push(...after);
  // container transitions
  if (pos.card && p.type !== 'clip') {
    tw(`#${id} .cgrid`, { x: 0, y: 0 }, { x: -64, y: -32, duration: r3(end - t0), ease: 'none' }, t0); // slow drift
    tw(`#${id}`, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'power3.inOut' }, t0);
    to(`#${id}`, { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.45, ease: 'power3.inOut' }, end - 0.45);
    sfx(p.sfx ?? 'whoosh', t0);
  } else if (usePanel) {
    const dx = pos.side === 'right' ? 50 : -50;
    tw(`#${id} .panel`, { opacity: 0, x: dx, filter: 'blur(10px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.55, ease: 'power3.out' }, t0 + 0.12);
    to(`#${id} .panel`, { opacity: 0, x: dx * 0.6, filter: 'blur(8px)', duration: 0.35, ease: 'power2.in' }, end - 0.35);
    sfx(p.sfx ?? 'whoosh', t0 + 0.1);
  } else if (p.type !== 'clip') {
    if (p.sfx !== false && !['phone', 'glass'].includes(p.type)) sfx(p.sfx ?? 'pop', t0);
    if (p.type === 'phone') sfx(p.sfx ?? 'whoosh', t0 + 0.1);
    fadeOut(`#${id}`, end - 0.3);
  }
}

anchorFrom = 0;
// ---------- captions: pages of <=2 lines, words appear as spoken, current word teal ----------
const capHtml = [];
{ // slide the captions down while a big card (one that reaches the captions) is on screen
  const capDy = layout === 'A' ? (CARD_CAP_Y + 60) - CAP_Y : CARD_CAP_Y - CAP_Y;
  const runs = [];
  for (const g of pops.filter((x) => x.pos.card && x.pos.y + x.pos.h > CAP_Y).sort((a, b) => a.t0 - b.t0)) {
    const last = runs[runs.length - 1];
    if (last && g.t0 - last.e < 1.0) last.e = Math.max(last.e, g.end); else runs.push({ s: g.t0, e: g.end });
  }
  for (const r of runs) {
    to('#caps', { y: capDy, duration: 0.45, ease: 'power3.inOut' }, r.s);
    if (r.e < DUR - 0.3) to('#caps', { y: 0, duration: 0.45, ease: 'power3.inOut' }, r.e - 0.35);
  }
}
const cap = cfg.captions || {};
if (cap.on !== false) {
  const size = cap.size ?? (layout === 'A' ? 46 : 58);
  const maxChars = cap.max_chars ?? Math.floor((layout === 'A' ? 960 : 880) / (size * 0.56));
  const lines = cap.lines ?? 2;
  const capWords = cap.from !== undefined ? words.filter((w) => w.start >= anchor(cap.from, 'captions.from').start) : words;
  const pages = []; let page = [[]], len = 0;
  const flush = () => { if (page[0].length) pages.push(page); page = [[]]; len = 0; };
  capWords.forEach((w, k) => {
    const prev = capWords[k - 1];
    if (prev && (w.start - prev.end > (cap.pause ?? 0.45) || /[.!?]$/.test(prev.text))) flush();
    const line = page[page.length - 1];
    if (len + w.text.length + (line.length ? 1 : 0) > maxChars && line.length) {
      if (page.length >= lines) flush(); else { page.push([]); len = 0; }
    }
    page[page.length - 1].push(w); len += w.text.length + (page[page.length - 1].length > 1 ? 1 : 0);
  });
  flush();
  // a page of one word looks broken: join it onto the page before when it follows closely and fits
  for (let k = pages.length - 1; k > 0; k--) {
    const pg = pages[k], prev = pages[k - 1], all = pg.flat(), pall = prev.flat();
    if (all.length !== 1 || all[0].start - pall[pall.length - 1].end > 1.0) continue;
    const lastLine = prev[prev.length - 1], lineLen = lastLine.map((w) => w.text).join(' ').length;
    if (lineLen + 1 + all[0].text.length <= maxChars) lastLine.push(all[0]);
    else if (prev.length < lines) prev.push([all[0]]);
    else continue;
    pages.splice(k, 1);
  }
  // a cold open can start mid-sentence: always capitalise the very first caption word
  // capital at the start of the reel, after a sentence end, or after a real pause (new thought) - not mid-sentence
  pages.forEach((pg, k) => {
    const w0 = pg[0][0], prev = k ? pages[k - 1].flat().at(-1) : null;
    if (!prev || /[.!?]$/.test(prev.text) || w0.start - prev.end > 0.8)
      pg[0][0] = { ...w0, text: w0.text.charAt(0).toUpperCase() + w0.text.slice(1) };
  });
  pages.forEach((pg, k) => {
    const all = pg.flat(), st = Math.max(0, all[0].start - 0.04);
    const nextSt = pages[k + 1] ? pages[k + 1].flat()[0].start - 0.04 : DUR;
    const en = Math.min(nextSt, all[all.length - 1].end + (cap.hold ?? 0.7), DUR);
    const id = `cap${k}`;
    capHtml.push(`<div id="${id}" class="clip cap" data-start="${r3(st)}" data-duration="${r3(en - st)}" data-track-index="${10 + (k % 2)}" style="${layout === 'A' ? `bottom:${H - CAP_Y}px` : `top:${CAP_Y}px;transform:translateY(-50%)`};font-size:${size}px">${pg.map((ln) => `<div>${ln.map((w) => `<span class="w">${esc(w.text)}</span>`).join(' ')}</div>`).join('')}</div>`);
    js.push(`(function(){const ws=document.querySelectorAll('#${id} .w');const T=${J(all.map((w) => r3(w.start)))};
ws.forEach((el,j)=>{tl.fromTo(el,{opacity:0,y:6,color:'${TEAL}'},{opacity:1,y:0,duration:0.1,ease:'power1.out'},T[j]);if(j>0)tl.set(ws[j-1],{color:'#ffffff'},T[j]);});})();`);
  });
}

html.push(`<div id="caps">${capHtml.join('\n')}</div>`);

// ---------- write ----------
const css = `*{box-sizing:border-box}html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
#reel{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#000;font-family:var(--ig-body);color:#fff}
.t{color:var(--ig-teal)}.u{text-decoration:underline;text-decoration-thickness:4px;text-underline-offset:10px;text-decoration-color:currentColor}
#header{position:absolute;left:0;top:0;width:${W}px;height:${HEADER_H}px;background:#000;display:flex;align-items:center;justify-content:space-between;padding:${hd.pad_top ?? 64}px 40px 18px 40px;z-index:20}
.hd-text{font-weight:500;font-size:${hd.size ?? 37}px;line-height:1.22;max-width:${hd.text_w ?? 650}px}.hd-accent{color:var(--ig-teal);margin-top:6px;font-size:0.92em}
.hd-logo{width:${hd.logo_w ?? 300}px;height:auto}
#headline{position:absolute;left:60px;right:60px;top:${BAND.y - 160}px;height:130px;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:${cfg.headline_size ?? 70}px;line-height:1.08;letter-spacing:-0.5px}
#desc{position:absolute;left:50px;right:50px;top:${BAND.y + BAND.h + 70}px;text-align:center;font-weight:600;font-size:${cfg.description_size ?? 48}px;line-height:1.24}
#url{position:absolute;left:0;right:0;top:${BAND.y + BAND.h + 300}px;text-align:center;font-weight:500;font-size:38px;opacity:.92}
#hook{position:absolute;left:40px;z-index:15;display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.hk-label{background:#0b0b0b;color:#fff;font-weight:700;font-size:36px;padding:12px 22px 12px 16px;border-radius:12px;display:flex;align-items:center;gap:12px;letter-spacing:.5px;text-transform:uppercase}
.hk-ic{color:#ff3b3b;font-size:40px}.hk-title{background:#fff;color:#050505;font-weight:800;font-size:${cfg.hook?.size ?? 50}px;padding:12px 24px;border-radius:12px;text-transform:uppercase;max-width:960px;line-height:1.1}
.hk-title .t{color:#079e80}
.pop{position:absolute;z-index:12;display:flex;align-items:center;justify-content:center}.pop .pin{width:100%;position:relative}
.pop.card{z-index:16;flex-direction:column;overflow:hidden;background:#040a09;padding:40px 70px}
.cgrid{position:absolute;left:-64px;top:-64px;right:-64px;bottom:-64px;background-image:linear-gradient(rgba(19,230,186,.075) 1.5px,rgba(0,0,0,0) 1.5px),linear-gradient(90deg,rgba(19,230,186,.075) 1.5px,rgba(0,0,0,0) 1.5px);background-size:64px 64px}
.cglow{position:absolute;inset:0;background:radial-gradient(ellipse 70% 55% at 50% 40%,rgba(19,230,186,.16),rgba(19,230,186,0) 70%),radial-gradient(ellipse 120% 90% at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,.75) 100%)}
.pop.card .pin,.pop.card .panel{position:relative}
.pop.card .pin{display:flex;flex-direction:column;align-items:center}
.lis{display:flex;flex-direction:column;align-items:flex-start}.pop.card .lis{display:inline-flex}
.panel{position:relative;width:100%;text-align:left;background:linear-gradient(165deg,rgba(26,52,48,.88),rgba(6,14,13,.92) 62%);border:1px solid rgba(255,255,255,.10);border-radius:34px;padding:36px 38px 38px;box-shadow:0 30px 80px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(16px)}
.panel::before{content:"";position:absolute;left:38px;top:-1px;width:86px;height:5px;border-radius:0 0 5px 5px;background:var(--ig-teal);box-shadow:0 0 20px rgba(19,230,186,.75)}
.plabel{display:flex;align-items:center;gap:10px;color:var(--ig-teal);font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-bottom:14px}
.plabel .ig-icon{font-size:1.25em;letter-spacing:0}
.ptitle{font-weight:800;line-height:1.08;margin-bottom:24px;letter-spacing:-.5px}
.pop.card .plabel{justify-content:center}.pop.card .ptitle{text-align:center}
.pop .ig-small,.pop .ig-big,.pop .ig-italic{text-shadow:0 4px 24px rgba(0,0,0,.55)}.pop .ig-big{line-height:.98}
.stat{font-weight:800;color:var(--ig-teal);line-height:1;letter-spacing:-2px;font-variant-numeric:tabular-nums;text-shadow:0 0 40px rgba(19,230,186,.35)}
.stat-label{font-weight:600;margin-top:12px;line-height:1.2}
.chip{display:inline-flex;align-items:center;gap:16px;background:linear-gradient(165deg,rgba(26,52,48,.92),rgba(6,14,13,.94));border:1.5px solid rgba(19,230,186,.55);border-radius:999px;padding:16px 34px;font-weight:700;box-shadow:0 18px 50px rgba(0,0,0,.5)}
.chip .ig-icon{color:var(--ig-teal);font-size:1.2em}
.li{display:flex;align-items:center;gap:20px;font-weight:600;line-height:1.15;margin:18px 0 0}
.mk{flex:none;width:1.32em;height:1.32em;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-family:var(--ig-icons);font-size:1em;line-height:1;font-weight:normal}
.mk-tick{background:rgba(19,230,186,.16);color:var(--ig-teal);border:2px solid rgba(19,230,186,.7)}
.mk-cross{background:rgba(255,99,112,.15);color:#ff6370;border:2px solid rgba(255,99,112,.65)}
.mk-num{background:var(--ig-teal);color:var(--ig-dark-text);font-family:var(--ig-body);font-weight:800;font-size:.78em;width:1.7em;height:1.7em}
.mk-chev{color:var(--ig-teal);font-family:var(--ig-body);font-weight:800;width:auto;height:auto}
.mk-dot{width:.42em;height:.42em;background:var(--ig-teal)}
.lt{position:relative}.strike{position:absolute;left:-8px;right:-8px;top:54%;height:5px;margin-top:-2px;border-radius:3px;background:#ff6370;transform:scaleX(0);transform-origin:left center;box-shadow:0 0 12px rgba(255,99,112,.5)}
.tiles{display:flex;gap:22px;width:100%}.tiles.column{flex-direction:column}.tiles.row{flex-direction:row}
.tile{display:flex;align-items:center;gap:22px;background:rgba(255,255,255,.045);border:2px solid rgba(255,255,255,.10);border-radius:26px;padding:22px 24px;text-align:left}
.tiles.row .tile{flex:1;flex-direction:column;text-align:center;padding:36px 24px}
.tic{flex:none;border-radius:24px;background:rgba(19,230,186,.13);color:var(--ig-teal);display:flex;align-items:center;justify-content:center}
.tt{font-weight:800;line-height:1.1}.ts{font-weight:500;color:var(--ig-text-dim);margin-top:6px;line-height:1.2}
.flow{position:relative}.flow svg{position:absolute;left:0;top:0;overflow:visible}
.flow .ln,.flow .rail{fill:none;stroke-linecap:round}.flow .ln{stroke:rgba(255,255,255,.55);stroke-width:4}.flow .ah{fill:none;stroke:rgba(255,255,255,.55);stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
.flow .rail{stroke:var(--ig-teal);stroke-width:5;filter:drop-shadow(0 0 8px rgba(19,230,186,.7))}.flow .rah{fill:none;stroke:var(--ig-teal);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.nd{position:absolute}.nc{border-radius:50%;background:#0f2421;border:2px solid rgba(19,230,186,.6);color:var(--ig-teal);display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(19,230,186,.18)}
.nt{position:absolute;display:flex;flex-direction:column}.nn{font-weight:800;line-height:1.08}
.subs{position:relative;margin-top:6px;height:1.3em;width:100%}.ns{position:absolute;left:0;right:0;top:0;white-space:nowrap;font-weight:500;color:var(--ig-text-dim)}.ns.pay{color:var(--ig-teal);font-weight:800;opacity:0}
.coin{position:absolute;width:58px;height:58px;border-radius:50%;background:var(--ig-teal);color:var(--ig-dark-text);display:flex;align-items:center;justify-content:center;font-family:var(--ig-icons);font-size:38px;box-shadow:0 0 34px rgba(19,230,186,.9);opacity:0}
.paychip{position:absolute;transform:translate(-50%,-50%);background:#06100f;border:2px solid var(--ig-teal);color:var(--ig-teal);font-weight:800;border-radius:999px;padding:10px 28px;white-space:nowrap;opacity:0}
.phone{position:absolute;border-radius:58px;background:linear-gradient(145deg,#39433f,#0b0f0e 38%,#1c2422);box-shadow:0 40px 90px rgba(0,0,0,.65),0 0 0 2px rgba(255,255,255,.08),0 0 70px rgba(19,230,186,.18)}
.phonev{position:absolute;z-index:16;overflow:hidden;border-radius:44px;background:#000;opacity:0}
.phonev video,.clipv video{width:100%;height:100%;object-fit:cover}
.phcap{font-weight:700;text-align:center;text-shadow:0 2px 14px rgba(0,0,0,.7)}
.stamp{position:absolute;z-index:18;width:190px;height:190px;border-radius:50%;background:var(--ig-teal);color:var(--ig-dark-text);display:flex;align-items:center;justify-content:center;text-align:center;font-family:var(--ig-title);font-size:56px;line-height:.95;box-shadow:0 12px 40px rgba(0,0,0,.5),0 0 60px rgba(19,230,186,.6);border:6px solid #fff;text-transform:uppercase}
.clipv{position:absolute;z-index:16;overflow:hidden;clip-path:inset(0% 100% 0% 0%)}
.cliptext{font-weight:800;text-shadow:0 4px 30px rgba(0,0,0,.8)}
.hlline{font-weight:700;line-height:1.2}.pimg{border-radius:28px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.gstack{display:flex;flex-direction:column;gap:18px;width:100%}.gstack.right{align-items:flex-end}.gstack.left{align-items:flex-start}.gstack.center{align-items:center}
.glabel{font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6);padding:0 6px}
.gcard{position:relative;display:flex;align-items:center;gap:18px;max-width:100%;padding:16px 28px 16px 16px;border-radius:26px;background:linear-gradient(135deg,rgba(255,255,255,.22),rgba(255,255,255,.05)),rgba(14,18,20,.42);border:1.5px solid rgba(255,255,255,.34);box-shadow:0 22px 50px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.4);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);color:#fff}
.glogo{flex:none;width:1.9em;height:1.9em;border-radius:.5em;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.gt{position:relative;font-weight:800;line-height:1.08}.gs{font-weight:500;opacity:.82;margin-top:4px}.gtx{min-width:0}
.gx{position:absolute;right:-14px;top:-14px;width:46px;height:46px;border-radius:50%;background:#ff4d5e;color:#fff;font-size:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(255,77,94,.5);opacity:0}
.net{position:relative;margin:0 auto}.net svg{position:absolute;left:0;top:0;overflow:visible}.nl{stroke:rgba(19,230,186,.55);stroke-width:3;opacity:0}
.ncen,.nsat{position:absolute;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ig-teal);background:#0f2421;border:2px solid rgba(19,230,186,.55);box-shadow:0 0 30px rgba(19,230,186,.18)}
.ncen{background:radial-gradient(circle at 50% 35%,#1d4a42,#0b1d1a);color:#fff;border-color:rgba(255,255,255,.4)}
.ncl,.nsl{position:absolute;top:100%;margin-top:10px;white-space:nowrap;font-weight:700;color:#fff}
.nck{position:absolute;right:-8px;top:-8px;width:40px;height:40px;border-radius:50%;background:var(--ig-teal);color:var(--ig-dark-text);font-size:28px;display:flex;align-items:center;justify-content:center;opacity:0}
.ncount{text-align:center;margin-top:40px}
.batile{position:absolute;display:flex;align-items:center;gap:28px;padding:24px 34px;border-radius:30px;background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.14)}
.batic{color:#ff6370}.batag{color:var(--ig-text-dim);font-weight:800;letter-spacing:3px;text-transform:uppercase;font-size:22px}.bat{font-weight:800;line-height:1.1}.bas{color:var(--ig-text-dim);font-weight:500;margin-top:4px}
.baarrow{position:absolute;overflow:visible}.baarrow path{fill:none;stroke:var(--ig-teal);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.batag2{position:absolute;text-align:center;font-weight:800;color:var(--ig-teal)}
#caps{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:17}
.cap{position:absolute;left:40px;right:40px;text-align:center;font-weight:600;line-height:1.22;z-index:17;text-shadow:0 2px 3px rgba(0,0,0,.65),0 0 18px rgba(0,0,0,.55)}
.cap .w{display:inline-block;opacity:0}`;

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(cfg.title || 'IGNITE reel')}</title>
<script src="assets/gsap.min.js"></script>
<link rel="stylesheet" href="assets/brand/brand-tokens.css">
<style>:root{--ig-teal:${TEAL}}</style>
<style>
${css}
</style></head><body>
<div id="reel" data-composition-id="reel" data-start="0" data-duration="${DUR}" data-width="${W}" data-height="${H}">
${html.join('\n')}
${audio.join('\n')}
</div>
<script>
const tl=gsap.timeline({paused:true});
${js.join('\n')}
window.__timelines=window.__timelines||{};window.__timelines['reel']=tl;
</script></body></html>
`;
// swap the IGNITE teal glows for the IB's accent colour (no-op for IGNITE branding)
const accRgb = [1, 3, 5].map((i) => parseInt(TEAL.slice(i, i + 2), 16)).join(',');
writeFileSync(join(proj, 'index.html'), page.replace(/rgba\(19,230,186,/g, `rgba(${accRgb},`).replace(/#13e6ba/gi, TEAL));
const meta = JSON.parse(readFileSync(join(proj, 'meta.json'), 'utf8'));
writeFileSync(join(proj, 'meta.json'), JSON.stringify({ ...meta, width: W, height: H, layout }, null, 2) + '\n');
console.log(`built ${relative(process.cwd(), join(proj, 'index.html'))}${vName ? ` (variant ${vName})` : ''}: layout ${layout}, ${DUR}s, ${words.length} words, ` +
  `${pops.length} graphics, ${glides.length} camera glides, ${punches.length} punch-ins, ${sfxN} SFX`);
