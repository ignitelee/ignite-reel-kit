#!/usr/bin/env node
// IGNITE: assemble the reel's edit from source-time segments (any order, so a cold-open hook can be
// moved to the front). Renders the cut video, a re-timed word transcript and an EDL for punch-ins.
// Usage: node scripts/assemble.mjs video-projects/<name>/assets/segments.json
// segments.json: {"source": "raw.mp4", "transcript": "raw.json",
//                 "segments": [{"start": 31.2, "end": 33.0, "note": "cold open"}, ...]}
//   or "from_edl": "raw.silence-edl.json" (uses its keep ranges, then "drop": [[s,e],...] removes mistakes)
// Paths are relative to segments.json. Outputs (next to it): <output> (default edited.mp4) + <stem>.json words + <stem>-edl.json.
// A trial-reel variant with a different cold open: its own segments file with "output": "edited-v2.mp4".
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const specPath = resolve(process.argv[2]);
const dir = dirname(specPath);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const src = join(dir, spec.source || 'raw.mp4');
const words = JSON.parse(readFileSync(join(dir, spec.transcript || 'raw.json'), 'utf8')).words;

let segs = spec.segments;
if (!segs && spec.from_edl) {
  const edl = JSON.parse(readFileSync(join(dir, spec.from_edl), 'utf8'));
  segs = (edl.keep_ranges || edl.keepRanges || edl.keep || []).map((r) => ({ start: r.start, end: r.end }));
  for (const [ds, de] of spec.drop || []) {
    segs = segs.flatMap((s) => (de <= s.start || ds >= s.end) ? [s]
      : [s.start < ds ? { start: s.start, end: ds } : null, de < s.end ? { start: de, end: s.end } : null].filter(Boolean));
  }
}
// cold open: "prepend": [{"start","end","note"}] goes first (drop the same span from the body with "drop")
if (spec.prepend) segs = [...spec.prepend, ...(segs || [])];
if (!segs?.length) throw new Error('No segments.');
segs = segs.filter((s) => s.end - s.start > 0.05);

// video + audio: trim/atrim + short audio fades at every join (no clicks), concat
// keep the source's own frame rate (studio cam 29.97, phones usually 30)
const rate = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src], { encoding: 'utf8' }).trim();
const fps = rate.split('/').reduce((a, b) => +a / +b);
const F = (t) => (Math.round(t * fps) / fps).toFixed(4); // frame-aligned
const parts = segs.map((s, i) => {
  const d = (+F(s.end) - +F(s.start)).toFixed(4);
  return `[0:v]trim=start=${F(s.start)}:end=${F(s.end)},setpts=PTS-STARTPTS[v${i}];` +
    `[0:a]atrim=start=${F(s.start)}:end=${F(s.end)},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, d - 0.015).toFixed(4)}:d=0.015[a${i}];`;
});
let graph = parts.join('') + segs.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${segs.length}:v=1:a=1[v][a]`;
// "bleep": [[s,e],...] in source seconds: mute the voice there and lay a 1 kHz tone over it
if (spec.bleep?.length) {
  const on = spec.bleep.map(([a, b]) => `between(t,${a},${b})`).join('+');
  const pre = `[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=0:enable='${on}'[am];` +
    `sine=frequency=1000:sample_rate=48000,aformat=channel_layouts=stereo,volume=0.5,volume=0:enable='not(${on})'[bp];` +
    `[am][bp]amix=inputs=2:duration=first:normalize=0,asplit=${segs.length}${segs.map((_, i) => `[as${i}]`).join('')};`;
  graph = pre + graph.replace(/\[0:a\]atrim/g, (() => { let i = 0; return () => `[as${i++}]atrim`; })());
}
const filterFile = join(dir, 'edited-filter.txt');
writeFileSync(filterFile, graph);
const out = join(dir, spec.output || 'edited.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-/filter_complex', filterFile, '-map', '[v]', '-map', '[a]',
  '-r', rate, '-c:v', 'libx264', '-crf', '15', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out], { stdio: 'inherit' });

// "loudness": -16 -> two-pass loudnorm of the voice (linear, so the performance isn't squashed)
if (spec.loudness !== undefined && spec.loudness !== false) {
  const target = spec.loudness;
  const m = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', out, '-vn', '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
  const tmp = out.replace(/\.mp4$/i, '.levelled.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-c:v', 'copy', '-af',
    `loudnorm=I=${target}:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000`,
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
  renameSync(tmp, out);
  console.log(`voice levelled: ${j.input_i} -> ${target} LUFS`);
}

// words: keep words whose middle falls inside a segment, shifted onto the new timeline
let t = 0;
const outWords = [], keep = [];
for (const s of segs) {
  const a = +F(s.start), b = +F(s.end);
  for (const w of words) {
    const mid = (w.start + w.end) / 2;
    if (mid >= a && mid < b) outWords.push({ text: w.text, start: +(Math.max(w.start, a) - a + t).toFixed(3), end: +(Math.min(w.end, b) - a + t).toFixed(3), src: w.start });
  }
  keep.push({ start: +t.toFixed(3), end: +(t + b - a).toFixed(3), src_start: a, src_end: b, note: s.note || '' });
  t += b - a;
}
const stem = out.replace(/\.mp4$/i, '');
writeFileSync(stem + '.json', JSON.stringify({ text: outWords.map((w) => w.text).join(' '), audio_duration_secs: +t.toFixed(3), words: outWords }, null, 1));
writeFileSync(stem + '-edl.json', JSON.stringify({ source: spec.source || 'raw.mp4', duration: +t.toFixed(3), keep }, null, 1));
console.log(`assembled ${segs.length} segments -> ${out} (${t.toFixed(2)} s), ${stem}.json (${outWords.length} words), ${stem}-edl.json`);
