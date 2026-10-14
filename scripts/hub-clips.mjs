#!/usr/bin/env node
// IGNITE Hub B-roll: stitch page captures (library/hub/_captures/<topic>/ + manifest.json) into one tall
// image and render a smooth phone-screen scroll clip -> library/hub/<topic>.mp4 (800x1600, 30 fps, silent).
// The Hub's top bar stays fixed while the page scrolls, like the real app.
// Usage: node scripts/hub-clips.mjs [topic ...]   (no topic = all captured topics)
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const capDir = join(root, 'library/hub/_captures');
const outDir = join(root, 'library/hub');
const tmp = join(capDir, '_tmp'); mkdirSync(tmp, { recursive: true });
const SW = 800, SH = 1600, FPS = 30, HOLD = 1.2;
const topics = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(capDir).filter((d) => existsSync(join(capDir, d, 'manifest.json')));

for (const topic of topics) {
  const dir = join(capDir, topic);
  const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const k = SW / m.css_w;                       // capture pixels per CSS pixel
  const head = Math.round(m.header_css * k);    // fixed top bar height in pixels
  const tallH = Math.max(SH, Math.round(m.doc_h * k));
  // 1) stitch: first shot whole, later shots without their (repeated) top bar
  const inputs = m.shots.flatMap((s) => ['-i', join(dir, s.f)]);
  let graph = `color=c=0x05060d:s=${SW}x${tallH}:d=1[c0];`;
  m.shots.forEach((s, i) => {
    const y = Math.round(s.y * k);
    graph += i === 0 ? `[c${i}][${i}:v]overlay=0:0[c${i + 1}];`
      : `[${i}:v]crop=${SW}:ih-${head}:0:${head}[s${i}];[c${i}][s${i}]overlay=0:${y + head}[c${i + 1}];`;
  });
  graph += `[c${m.shots.length}]null[out]`;
  const tall = join(tmp, `${topic}_tall.png`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', tall]);
  // 2) clip: hold, ease down the page, hold; top bar overlaid fixed; short pages get a slow push-in instead
  const travel = tallH - SH;
  const dur = m.duration ?? (travel > 0 ? Math.min(10, Math.max(6, 2 * HOLD + travel / 450)) : 6);
  // "ease": "linear" (long pages) = steady reading speed with short ramps; default = smoothstep
  const R = 0.06, u = `st(0,clip((t-${HOLD})/${(dur - 2 * HOLD).toFixed(3)},0,1))`;
  const ease = m.ease === 'linear'
    ? `${u};if(lt(ld(0),${R}),ld(0)*ld(0)/${2 * R * (1 - R)},if(gt(ld(0),${1 - R}),1-(1-ld(0))*(1-ld(0))/${2 * R * (1 - R)},(ld(0)-${R / 2})/${1 - R}))`
    : `${u};ld(0)*ld(0)*(3-2*ld(0))`;
  // "zoom": gentle fixed punch-in (top-anchored) so small text reads better inside a phone mockup
  const z = m.zoom ?? 1, zw = 2 * Math.round(SW / z / 2), zh = 2 * Math.round(SH / z / 2);
  const zoomF = z > 1 ? `,crop=${zw}:${zh}:${(SW - zw) / 2}:0,scale=${SW}:${SH}` : '';
  // "intro": still frames shown before the page (e.g. a question being asked), [{f, hold}], crossfaded
  const intro = m.intro ?? [], XF = 0.3;
  const inputs2 = intro.flatMap((s) => ['-loop', '1', '-framerate', String(FPS), '-t', String(s.hold + XF), '-i', join(dir, s.f)]);
  const n = intro.length;
  let vf = intro.map((s, i) => `[${i}:v]pad=${SW}:${SH}:0:0:color=0x05060d${zoomF},fps=${FPS},format=yuv420p,setsar=1[i${i}];`).join('');
  vf += travel > 0
    ? `[${n}:v]crop=${SW}:${SH}:0:'${travel}*(${ease})'[pg];[${n}:v]crop=${SW}:${head}:0:0[hd];[pg][hd]overlay=0:0${zoomF},fps=${FPS},format=yuv420p,setsar=1[m]`
    : `[${n}:v]crop=${SW}:${SH}:0:0,scale=w='${SW}*(1+0.05*t/${dur})':h=-1:eval=frame,crop=${SW}:${SH}:(iw-${SW})/2:0${zoomF},fps=${FPS},format=yuv420p,setsar=1[m]`;
  let last = n ? 'i0' : 'm', off = 0;
  for (let i = 1; i <= n; i++) {
    off += intro[i - 1].hold;
    const next = i < n ? `i${i}` : 'm';
    vf += `;[${last}][${next}]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(2)}[x${i}]`;
    last = `x${i}`;
  }
  vf += `;[${last}]null[v]`;
  const out = join(outDir, `${topic}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs2, '-loop', '1', '-framerate', String(FPS), '-t', dur.toFixed(2), '-i', tall,
    '-filter_complex', vf, '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', out]);
  const total = dur + intro.reduce((a, s) => a + s.hold, 0);
  console.log(`${topic}: ${m.shots.length} captures, page ${tallH}px, ${total.toFixed(1)} s -> library/hub/${topic}.mp4`);
}
