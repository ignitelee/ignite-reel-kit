// IGNITE Reel Kit carousel slides: one shared module for the dashboard preview (browser) and the PNG renderer
// (scripts/carousel.mjs, Node + headless Chrome), so what people see while editing is exactly what they download.
// slideHTML(slide, ctx) returns a whole 1080x1350 HTML page. ctx.url(path) turns a kit-relative path into a URL.
// Text markup in any field: *word* = brand colour, _word_ = serif italic, a new line = line break.

export const W = 1080, H = 1350;

export const FILTERS = [
  { id: 'luxury', name: 'Luxury', tip: 'Dark, rich and calm. Every word stays crisp.' },
  { id: 'clean', name: 'Clean', tip: 'Natural colours, bright and simple.' },
  { id: 'mono', name: 'Mono', tip: 'Black and white, with your colour on the words.' },
  { id: 'film', name: 'Warm Film', tip: 'Soft warm tones with a little grain.' },
  { id: 'tech', name: 'Cool Tech', tip: 'Cool, dark and techy, with a faint grid.' },
  { id: 'glow', name: 'Soft Glow', tip: 'Bright highlights with a gentle glow.' },
];

export const LAYOUTS = [
  { id: 'cover', name: 'Cover', fields: ['image', 'kicker', 'title', 'body'] },
  { id: 'photo', name: 'Photo + text', fields: ['image', 'kicker', 'title', 'body'] },
  { id: 'phone', name: 'Phone screen', fields: ['image', 'kicker', 'title', 'body'] },
  { id: 'screen', name: 'Wide screenshot', fields: ['image', 'kicker', 'title', 'body'] },
  { id: 'poster', name: 'Whole picture', fields: ['image', 'title', 'body'] },
  { id: 'statement', name: 'Big statement', fields: ['image', 'kicker', 'title', 'body'] },
  { id: 'list', name: 'List', fields: ['image', 'kicker', 'title', 'items'] },
  { id: 'stat', name: 'Big number', fields: ['image', 'kicker', 'stat', 'title', 'body'] },
  { id: 'quote', name: 'Quote', fields: ['image', 'quote', 'by'] },
  { id: 'end', name: 'Last slide', fields: ['image', 'title', 'body'] },
];

// rough length limits: the page shrinks text to fit, but past these it gets too small to read on a phone
export const LIMITS = { kicker: 32, title: 70, body: 220, stat: 8, quote: 170, by: 40, item: 80, items: 5 };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const rich = (s) => esc(s).replace(/\*(.+?)\*/g, '<em class="a">$1</em>').replace(/_(.+?)_/g, '<i class="s">$1</i>').replace(/\n/g, '<br>');
const plainLen = (s) => String(s ?? '').replace(/[*_]/g, '').length;

const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = parseInt(m ? m[1] : '13e6ba', 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// how each filter treats the photo: CSS filter on the image + overlays (vignette, tint, grain, glow)
const FX = {
  luxury: { img: 'brightness(.6) contrast(1.16) saturate(.75)', vignette: .8, grain: .05, tint: 'rgba(8,10,16,.25)', glow: .18 },
  clean: { img: 'brightness(.97) contrast(1.03) saturate(1.06)', vignette: .25, grain: 0, tint: null, glow: 0 },
  mono: { img: 'grayscale(1) contrast(1.18) brightness(.72)', vignette: .6, grain: .05, tint: null, glow: .1 },
  film: { img: 'sepia(.42) saturate(1.2) contrast(1.06) brightness(.8)', vignette: .6, grain: .1, tint: 'rgba(255,140,60,.16)', glow: 0 },
  tech: { img: 'saturate(.7) brightness(.66) contrast(1.1)', vignette: .6, grain: .03, tint: 'accent', glow: .2, grid: true },
  glow: { img: 'brightness(.86) contrast(1.02) saturate(1.1)', vignette: .4, grain: .03, tint: null, glow: .12, bloom: true },
};

function fonts(u) {
  const f = (fam, file, w = 400, st = 'normal') => `@font-face{font-family:'${fam}';src:url('${u('brand/fonts/' + file)}');font-weight:${w};font-style:${st}}`;
  return f('Anton', 'Anton-Regular.ttf') + f('Inter', 'Inter-Medium.ttf', 500) + f('Inter', 'Inter-SemiBold.ttf', 600)
    + f('Inter', 'Inter-Bold.ttf', 700) + f('Inter', 'Inter-ExtraBold.ttf', 800) + f('Playfair', 'PlayfairDisplay-Italic.ttf', 400, 'italic');
}

function css(ctx) {
  const fx = FX[ctx.filter] || FX.luxury, [r, g, b] = hexRgb(ctx.accent), A = `rgb(${r},${g},${b})`, Aa = (o) => `rgba(${r},${g},${b},${o})`;
  const light = ctx.filter === 'clean' || ctx.filter === 'glow';
  return `${fonts(ctx.url)}
*{box-sizing:border-box;margin:0;padding:0}
:root{--glow:${Aa(.22)}}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#07090f}
body{font-family:Inter,Arial,sans-serif;color:#fff;-webkit-font-smoothing:antialiased;position:relative}
.bg,.bg img,.ov{position:absolute;inset:0;width:100%;height:100%}
.bg img{object-fit:cover;filter:${fx.img}}
.bg.blur img{filter:${fx.img} blur(22px) brightness(.85);transform:scale(1.12)}
.bloom{mix-blend-mode:screen;opacity:.55;filter:blur(30px) brightness(1.1)!important}
.plain{background:radial-gradient(120% 80% at 85% 0%,${Aa(.16)},transparent 60%),radial-gradient(90% 70% at 0% 100%,${Aa(.10)},transparent 60%),linear-gradient(160deg,#0d121c,#05070b)}
.vig{background:radial-gradient(130% 95% at 50% 42%,transparent 38%,rgba(0,0,0,${fx.vignette}) 100%)}
.tint{background:${fx.tint === 'accent' ? `linear-gradient(160deg,${Aa(.22)},rgba(10,30,60,.35))` : fx.tint || 'none'};mix-blend-mode:${fx.tint === 'accent' ? 'color' : 'multiply'}}
.grain{background-image:${NOISE};opacity:${fx.grain};mix-blend-mode:overlay}
.glowc{background:radial-gradient(70% 45% at 100% 0%,${Aa(fx.glow)},transparent 70%)}
.grid{background-image:linear-gradient(${Aa(.07)} 1px,transparent 1px),linear-gradient(90deg,${Aa(.07)} 1px,transparent 1px);background-size:54px 54px;-webkit-mask-image:linear-gradient(transparent,#000 40%,#000 70%,transparent)}
.shade-b{background:linear-gradient(180deg,rgba(5,7,11,0) 30%,rgba(5,7,11,.72) 62%,rgba(5,7,11,.96) 100%)}
.shade-t{background:linear-gradient(180deg,rgba(5,7,11,.7),rgba(5,7,11,0) 22%)}
.shade-all{background:rgba(5,7,11,.42)}
.fade-photo{background:linear-gradient(180deg,rgba(5,7,11,.35) 0%,rgba(5,7,11,0) 18%,rgba(5,7,11,0) 45%,#07090f 61%)}
.c{position:absolute;left:72px;right:72px;display:flex;flex-direction:column;overflow:hidden}
.kicker{font:800 25px/1.2 Inter;letter-spacing:.24em;text-transform:uppercase;color:${A};margin-bottom:22px;display:flex;align-items:center;gap:14px}
.kicker::before{content:"";width:38px;height:3px;background:${A};border-radius:2px;flex:none}
.title{font-family:Anton,Impact,sans-serif;text-transform:uppercase;line-height:1.02;letter-spacing:.005em;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.45);overflow-wrap:break-word}
.body{font:500 35px/1.42 Inter;color:rgba(255,255,255,.86);margin-top:26px;text-shadow:0 2px 18px rgba(0,0,0,.5)}
em.a{font-style:normal;color:${A}}
.title em.a{background:linear-gradient(180deg,#fff 0%,${A} 78%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 22px ${Aa(.35)})}
i.s{font-family:Playfair,Georgia,serif;font-style:italic;text-transform:none;letter-spacing:0;font-weight:400}
.title i.s{font-size:.92em}
.top{position:absolute;top:58px;left:72px;right:72px;height:60px;display:flex;align-items:center;justify-content:space-between;z-index:5}
.pg{font:700 24px Inter;letter-spacing:.14em;color:rgba(255,255,255,.62)}
.pg b{color:#fff}
.logos{display:flex;align-items:center;gap:22px;margin-left:auto}
.logos img{height:50px;max-width:250px;object-fit:contain;filter:drop-shadow(0 2px 10px rgba(0,0,0,.5))}
.logos .sep{width:2px;height:40px;background:rgba(255,255,255,.35)}
.prog{position:absolute;left:72px;right:72px;bottom:54px;height:5px;border-radius:3px;background:rgba(255,255,255,.16);z-index:5}
.prog i{display:block;height:100%;border-radius:3px;background:${A};box-shadow:0 0 14px ${Aa(.6)}}
.swipe{position:absolute;right:72px;bottom:44px;z-index:5;display:flex;align-items:center;gap:14px;font:700 25px Inter;letter-spacing:.16em;text-transform:uppercase;color:#fff;padding:15px 26px;border-radius:999px;border:2px solid rgba(255,255,255,.5);background:rgba(5,7,11,.35);backdrop-filter:blur(6px)}
.swipe svg{width:34px;height:34px;stroke:${A};stroke-width:2.6;fill:none}
.phone{position:absolute;left:50%;transform:translateX(-50%);width:600px;border-radius:66px;padding:16px;background:linear-gradient(160deg,#2a3140,#0b0e14 40%,#1b212c);box-shadow:0 40px 90px rgba(0,0,0,.7),0 0 0 2px rgba(255,255,255,.08),0 0 80px ${Aa(.22)}}
.phone .scr{border-radius:52px;overflow:hidden;background:#000;position:relative}
.phone .scr img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.phone .isl{position:absolute;top:30px;left:50%;transform:translateX(-50%);width:120px;height:34px;border-radius:20px;background:#000;z-index:2}
.card{position:absolute;left:72px;right:72px;border-radius:36px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 2px ${Aa(.35)},0 0 70px ${Aa(.18)}}
.card img{display:block;width:100%;height:100%;object-fit:cover}
.shot{border-radius:24px;overflow:hidden;background:#0b0e14;box-shadow:0 34px 80px rgba(0,0,0,.65),0 0 0 2px ${Aa(.3)},0 0 70px ${Aa(.2)};max-width:100%;max-height:100%}
.shot img{display:block;max-width:100%;max-height:100%}
.whole{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center}
.whole img{max-width:100%;max-height:100%;object-fit:contain;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.items{list-style:none;margin-top:48px;display:flex;flex-direction:column;gap:34px}
.items li{display:flex;gap:30px;align-items:flex-start;font:600 44px/1.28 Inter;color:#fff}
.items .n{font:400 52px/1 Anton;color:${A};min-width:62px;padding-top:2px;letter-spacing:.02em}
.items .t{flex:1;padding-bottom:34px;border-bottom:1.5px solid rgba(255,255,255,.12)}
.items li:last-child .t{border-bottom:0;padding-bottom:0}
.stat{font-family:Anton,Impact,sans-serif;font-size:300px;line-height:.95;background:linear-gradient(180deg,#fff 10%,${A} 90%);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap;position:relative}
.qmark{font:italic 400 300px/0.7 Playfair,Georgia,serif;color:${A};height:150px;filter:drop-shadow(0 0 30px ${Aa(.4)})}
.quote{font:italic 400 66px/1.22 Playfair,Georgia,serif;color:#fff;margin-top:30px;text-shadow:0 3px 24px rgba(0,0,0,.5)}
.quote em.a{font-style:italic}
.by{font:800 25px Inter;letter-spacing:.22em;text-transform:uppercase;color:${A};margin-top:40px}
.endlogos{display:flex;align-items:center;justify-content:center;gap:34px;margin-bottom:64px}
.endlogos img{height:92px;max-width:420px;object-fit:contain}
.endlogos .sep{width:2px;height:70px;background:rgba(255,255,255,.35)}
.arrow{width:110px;height:110px;margin:46px auto 0;border-radius:50%;display:grid;place-items:center;border:2px solid ${Aa(.6)};background:${Aa(.12)};box-shadow:0 0 50px ${Aa(.3)}}
.arrow svg{width:52px;height:52px;stroke:${A};stroke-width:2.6;fill:none}
.risk{position:absolute;left:90px;right:90px;bottom:96px;text-align:center;font:500 23px/1.4 Inter;color:rgba(255,255,255,.55);z-index:5}
${light ? '.body{color:rgba(255,255,255,.92)}' : ''}`;
}

// background stack for a slide: photo (or plain dark) + the filter's overlays + a shade so text reads
function background(slide, ctx, shade) {
  const fx = FX[ctx.filter] || FX.luxury, src = slide.image ? esc(ctx.url(slide.image)) : null;
  const pos = esc(slide.focus || 'center');
  const photo = src ? `<div class="bg${shade === 'blur' ? ' blur' : ''}"><img src="${src}" style="object-position:${pos}"></div>`
    + (fx.bloom && shade !== 'blur' ? `<div class="bg"><img class="bloom" src="${src}" style="object-position:${pos}"></div>` : '') : '<div class="ov plain"></div>';
  return photo + (src && fx.tint ? '<div class="ov tint"></div>' : '') + (fx.grid ? '<div class="ov grid"></div>' : '')
    + '<div class="ov vig"></div>' + (fx.glow ? '<div class="ov glowc"></div>' : '')
    + (shade && shade !== 'blur' ? `<div class="ov ${shade}"></div>` : '') + (shade === 'blur' ? '<div class="ov shade-all"></div>' : '')
    + (fx.grain ? '<div class="ov grain"></div>' : '');
}

const ARROW_R = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ARROW_D = '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';

function chrome(slide, ctx, { page = true, logos = true } = {}) {
  const lg = logos && ctx.logos?.length ? `<div class="logos">${ctx.logos.map((l) => `<img src="${esc(ctx.url(l))}">`).join('<span class="sep"></span>')}</div>` : '';
  const n = ctx.index + 1, pg = page && ctx.total > 1 ? `<div class="pg"><b>${String(n).padStart(2, '0')}</b> / ${String(ctx.total).padStart(2, '0')}</div>` : '<div></div>';
  return `<div class="top">${pg}${lg}</div>`;
}
const progress = (ctx) => (ctx.total > 1 ? `<div class="prog"><i style="width:${((ctx.index + 1) / ctx.total) * 100}%"></i></div>` : '');
const kicker = (s) => (s?.kicker ? `<div class="kicker" data-fit>${rich(s.kicker)}</div>` : '');
const body = (s) => (s?.body ? `<div class="body" data-fit>${rich(s.body)}</div>` : '');

const LAYOUT = {
  cover: (s, ctx) => background(s, ctx, 'shade-b') + '<div class="ov shade-t"></div>' + chrome(s, ctx, { page: false })
    + `<div class="c" data-box style="bottom:150px;max-height:860px">${kicker(s)}<div class="title" data-fit style="font-size:132px">${rich(s.title)}</div>${body(s)}</div>`
    + (ctx.total > 1 ? `<div class="swipe">Swipe ${ARROW_R}</div>` : ''),
  photo: (s, ctx) => (s.image ? `<div style="position:absolute;inset:0 0 auto 0;height:860px">${background(s, ctx, null)}</div><div class="ov fade-photo"></div>` : background(s, ctx, null))
    + chrome(s, ctx) + `<div class="c" data-box style="top:${s.image ? 720 : 300}px;bottom:110px;justify-content:flex-end">${kicker(s)}<div class="title" data-fit style="font-size:88px">${rich(s.title)}</div>${body(s)}</div>` + progress(ctx),
  phone: (s, ctx) => background({ ...s, image: null }, ctx, null) + chrome(s, ctx)
    + `<div class="c" data-box style="top:150px;height:${s.body ? 360 : 270}px">${kicker(s)}<div class="title" data-fit style="font-size:80px">${rich(s.title)}</div>${body(s)}</div>`
    + '<div class="ov" style="background:radial-gradient(50% 40% at 50% 78%,var(--glow),transparent 70%)"></div>'
    + (s.image ? `<div class="phone" style="top:${s.body ? 540 : 450}px"><div class="scr" style="height:1200px"><span class="isl"></span><img src="${esc(ctx.url(s.image))}" style="object-position:${esc(s.focus || 'top')}"></div></div>` : '')
    + '<div class="ov" style="top:auto;height:260px;background:linear-gradient(180deg,transparent,#07090f 85%)"></div>' + progress(ctx),
  screen: (s, ctx) => background({ ...s, image: null }, ctx, null) + chrome(s, ctx)
    + `<div class="c" data-box style="top:150px;height:${s.body ? 420 : 320}px">${kicker(s)}<div class="title" data-fit style="font-size:84px">${rich(s.title)}</div>${body(s)}</div>`
    + '<div class="ov" style="background:radial-gradient(60% 35% at 50% 75%,var(--glow),transparent 70%)"></div>'
    + (s.image ? `<div class="whole" style="top:${s.body ? 590 : 480}px;bottom:100px;padding:0 36px"><div class="shot"><img src="${esc(ctx.url(s.image))}"></div></div>` : '')
    + '<div class="ov" style="top:auto;height:200px;background:linear-gradient(180deg,transparent,#07090f 90%)"></div>' + progress(ctx),
  // a ready-made poster, logo or photo shown whole (nothing cropped, no filter): optional words underneath
  poster: (s, ctx) => (s.image ? `<div class="bg blur"><img src="${esc(ctx.url(s.image))}" style="filter:blur(30px) brightness(.45) saturate(.8);transform:scale(1.15)"></div>` : '<div class="ov plain"></div>')
    + `<div class="whole" style="top:${s.title || s.body ? 110 : 70}px;bottom:${s.title || s.body ? 400 : 110}px;padding:0 70px">${s.image ? `<img src="${esc(ctx.url(s.image))}">` : ''}</div>`
    + (s.title || s.body ? `<div class="c" data-box style="bottom:110px;height:250px;justify-content:center;align-items:center;text-align:center">${s.title ? `<div class="title" data-fit style="font-size:76px">${rich(s.title)}</div>` : ''}${body(s)}</div>` : '')
    + progress(ctx),
  statement: (s, ctx) => background(s, ctx, 'blur') + chrome(s, ctx)
    + `<div class="c" data-box style="top:200px;bottom:150px;justify-content:center">${kicker(s)}<div class="title" data-fit style="font-size:112px">${rich(s.title)}</div>${body(s)}</div>` + progress(ctx),
  list: (s, ctx) => background(s, ctx, 'blur') + chrome(s, ctx)
    + `<div class="c" data-box style="top:170px;bottom:130px;justify-content:center">${kicker(s)}<div class="title" data-fit style="font-size:100px">${rich(s.title)}</div>`
    + `<ul class="items">${(s.items || []).slice(0, LIMITS.items).map((it, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t" data-fit>${rich(it)}</span></li>`).join('')}</ul></div>` + progress(ctx),
  stat: (s, ctx) => background(s, ctx, 'blur') + chrome(s, ctx)
    + `<div class="c" data-box style="top:190px;bottom:150px;justify-content:center">${kicker(s)}<div class="ov" style="background:radial-gradient(45% 30% at 25% 45%,var(--glow),transparent 70%)"></div><div class="stat" data-fit>${esc(s.stat)}</div><div class="title" data-fit style="font-size:76px;margin-top:20px">${rich(s.title)}</div>${body(s)}</div>` + progress(ctx),
  quote: (s, ctx) => background(s, ctx, 'blur') + chrome(s, ctx)
    + `<div class="c" data-box style="top:200px;bottom:150px;justify-content:center"><div class="qmark">&ldquo;</div><div class="quote" data-fit>${rich(s.quote)}</div>${s.by ? `<div class="by">${esc(s.by)}</div>` : ''}</div>` + progress(ctx),
  end: (s, ctx) => background(s, ctx, 'blur') + chrome(s, ctx, { logos: false })
    + `<div class="c" data-box style="top:150px;bottom:${ctx.risk ? 230 : 140}px;justify-content:center;align-items:center;text-align:center">`
    + (ctx.logos?.length ? `<div class="endlogos">${ctx.logos.map((l) => `<img src="${esc(ctx.url(l))}">`).join('<span class="sep"></span>')}</div>` : '')
    + `<div class="title" data-fit style="font-size:104px">${rich(s.title || 'Full breakdown in the *caption*')}</div>${body(s)}`
    + (s.arrow === false ? '' : `<div class="arrow">${ARROW_D}</div>`) + '</div>'
    + (ctx.risk ? `<div class="risk">${esc(ctx.risk)}</div>` : '') + progress(ctx),
};

// shrinks text (step by step) until each box fits; the renderer waits for body[data-ready]. Measures the boxes
// of the words themselves, not scrollHeight: a glow (drop-shadow) on a coloured word must not count as overflow.
const FIT = `<script>
(async()=>{try{await document.fonts.ready}catch(e){}
await Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));
for(const box of document.querySelectorAll('[data-box]')){const els=[...box.querySelectorAll('[data-fit]')];let n=0;
const over=()=>{const br=box.getBoundingClientRect();return [...box.children].some(k=>{const r=k.getBoundingClientRect();return r.top<br.top-2||r.bottom>br.bottom+2})||els.some(e=>e.scrollWidth>e.clientWidth+2)};
while(over()&&n++<40)for(const e of els){e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*0.95)+'px'}}
document.body.dataset.ready='1'})();
</script>`;

export function slideHTML(slide, ctx) {
  const s = slide || {}, build = LAYOUT[s.layout] || LAYOUT.photo;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(ctx)}</style></head><body>${build(s, ctx)}${FIT}</body></html>`;
}

// checks a draft written by Claude (or edited on the dashboard); returns {errors, warnings} as plain sentences
export function checkDraft(draft) {
  const errors = [], warnings = [];
  if (!draft || !Array.isArray(draft.carousels) || !draft.carousels.length) return { errors: ['draft.json needs a "carousels" list with at least one carousel.'], warnings };
  draft.carousels.forEach((c, ci) => {
    const where = `Carousel ${ci + 1}`;
    if (!Array.isArray(c.slides) || c.slides.length < 2) errors.push(`${where}: needs at least 2 slides.`);
    if (c.slides?.length > 10) errors.push(`${where}: Instagram allows 10 slides at most (${c.slides.length}).`);
    if (!c.caption || !String(c.caption).trim()) errors.push(`${where}: "caption" (the post caption) is missing.`);
    (c.slides || []).forEach((s, si) => {
      const at = `${where}, slide ${si + 1}`;
      if (!LAYOUT[s.layout]) errors.push(`${at}: unknown layout "${s.layout}" (use ${Object.keys(LAYOUT).join(', ')}).`);
      if (['cover', 'photo', 'statement', 'list', 'stat'].includes(s.layout) && !s.title) errors.push(`${at}: needs a title.`);
      if (['phone', 'screen', 'poster'].includes(s.layout) && !s.image) errors.push(`${at}: the ${s.layout} layout needs an image.`);
      if (s.layout === 'quote' && !s.quote) errors.push(`${at}: needs the quote text.`);
      if (s.layout === 'stat' && !s.stat) errors.push(`${at}: needs the big number ("stat").`);
      if (s.layout === 'list' && !(s.items || []).length) errors.push(`${at}: needs "items".`);
      for (const k of ['kicker', 'title', 'body', 'stat', 'quote', 'by']) if (plainLen(s[k]) > LIMITS[k]) warnings.push(`${at}: ${k} is long (${plainLen(s[k])} letters, aim for ${LIMITS[k]} or fewer).`);
      if ((s.items || []).length > LIMITS.items) warnings.push(`${at}: only the first ${LIMITS.items} list items show.`);
      (s.items || []).forEach((it, k) => { if (plainLen(it) > LIMITS.item) warnings.push(`${at}: item ${k + 1} is long (${plainLen(it)} letters).`); });
      if (/[—–]/.test(JSON.stringify(s))) warnings.push(`${at}: has a long dash; human-speak avoids them.`);
    });
    if (c.slides?.length && c.slides[c.slides.length - 1].layout !== 'end') warnings.push(`${where}: the last slide is usually the "end" layout.`);
  });
  return { errors, warnings };
}

// the look of carousel i: job settings from the dashboard, then the draft's, then that carousel's own changes
export const IGNITE_LOGO = 'brand/ignite/ignite-logo.png', IGNITE_TEAL = '#13E6BA';
export const DEFAULT_RISK = 'Trading involves risk. Only trade with money you can afford to lose.';
export function lookFor(job, draft, i, brand) {
  const o = { ...(job?.options || {}), ...(draft?.look || {}), ...(draft?.carousels?.[i]?.look || {}) };
  const ignite = o.mode === 'ignite', mine = brand?.logo ? 'brand/' + brand.logo : null;
  const set = o.logos || (ignite ? 'both' : 'mine');
  const logos = { ignite: [IGNITE_LOGO], mine: mine ? [mine] : [], both: mine ? [mine, IGNITE_LOGO] : [IGNITE_LOGO], none: [] }[set] || [];
  return { mode: ignite ? 'ignite' : 'personal', filter: o.filter || 'luxury', logos,
    accent: o.accent || (ignite ? IGNITE_TEAL : brand?.accent_color || IGNITE_TEAL),
    risk: ignite || o.risk ? (brand?.risk_line || DEFAULT_RISK) : null };
}
