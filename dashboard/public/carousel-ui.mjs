// Carousel Builder tab of the dashboard. Uses the page's helpers ($, $$, esc, icon, post, copy, toast, showTab, S)
// and the shared slide designs, so the previews here are pixel-for-pixel the images people download.
import { slideHTML, lookFor, checkDraft, FILTERS, LAYOUTS, IGNITE_TEAL } from '/static/carousel.mjs';

const root = () => $('#cbJob');
const fileUrl = (p) => '/file?path=' + encodeURIComponent(p);
const MAX_IMAGES = 20;
let curId = null, form = null, local = null, localFor = null, saveT = null, saving = null, lastSig = '';
try { curId = localStorage.getItem('cbJob'); } catch { /* private window */ }
const setCur = (id) => { curId = id; try { id ? localStorage.setItem('cbJob', id) : localStorage.removeItem('cbJob'); } catch { /* ignore */ } };

const IDEAS = {
  ignite: ['How the Ignite IB partnership works', 'What you get inside the Ignite Hub', 'My first month as an Ignite partner',
    'How Sparkie reviews my trades', '3 things I wish I knew before I started trading'],
  personal: ['A lesson I learned this week', 'My top 5 tips for beginners', 'Behind the scenes of my day',
    'A myth people believe, and the truth', 'A story about a client or a friend'],
};
const AUDIENCE = ['Beginners', 'People who already trade', 'Other IBs', 'Everyone'];
const TONES = [['calm and expert', 'Calm and expert'], ['friendly', 'Friendly'], ['bold and direct', 'Bold and direct'], ['a story', 'Tell a story']];
const COUNTS = [['1', '1 topic'], ['2', '2 topics'], ['3', '3 topics']];
const LOGOS_IGNITE = [['both', 'My logo + Ignite'], ['ignite', 'Ignite only'], ['mine', 'Mine only'], ['none', 'No logo']];
const LOGOS_PERSONAL = [['mine', 'My logo'], ['none', 'No logo']];
const ENDS = [['caption', 'Full breakdown in the caption'], ['usual', 'My usual call to action'], ['save', 'Save this for later'], ['own', 'Write my own']];

const brandForLook = () => ({ ...S.brand, logo: S.brand.logoUrl && !S.brand.logoIsIgnite ? S.brand.logo : null });
const defaultForm = (mode = 'ignite') => ({ mode, about: '', audience: '', tone: 'calm and expert', count: '1', filter: 'luxury',
  logos: mode === 'ignite' ? 'both' : 'mine', accent: '', cta: 'caption', ctaText: '', notes: '' });
const accentOf = (f) => f.accent || (f.mode === 'ignite' ? IGNITE_TEAL : S.brand.accent_color || IGNITE_TEAL);

// a scaled live preview of one slide (an iframe running the real slide page)
function preview(slide, look, index, total, k) {
  const html = slideHTML(slide, { ...look, index, total, url: (p) => fileUrl(p) });
  return `<div class="pv" style="width:${1080 * k}px;height:${1350 * k}px"><iframe tabindex="-1" style="transform:scale(${k})" srcdoc="${esc(html)}"></iframe></div>`;
}
const chipRow = (group, opts, val) => `<div class="chips" data-cb="${group}">${opts.map(([v, l]) => `<button class="chip${String(val) === v ? ' on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;

// ---------- brand gate ----------
function gate() {
  const b = S.brand || {}, noLogo = !b.logoUrl, noColour = !b.accent_chosen && (b.accent_color || '#13E6BA').toUpperCase() === '#13E6BA';
  const need = noLogo || noColour;
  $('#cbGate').classList.toggle('hidden', !need); $('#cbMain').classList.toggle('hidden', need);
  if (need) $('#cbGateText').textContent = noLogo && noColour ? 'Add your logo and pick your colour in My brand. Then come back here.'
    : noLogo ? 'Add your logo in My brand. Then come back here.' : 'Pick your colour in My brand (or save it to keep teal). Then come back here.';
  return need;
}

// ---------- 1. the form (new carousel) ----------
function formHTML(job) {
  const f = form, imgs = job?.images || [], ig = f.mode === 'ignite';
  const sample = imgs[0] ? `dashboard/carousels/${job.id}/images/${imgs[0].file}` : ig ? 'library/hub/stills/dashboard.jpg' : null;
  const look = (filter) => ({ ...lookFor({ options: { ...f, filter, accent: accentOf(f) } }, null, 0, brandForLook()) });
  const sampleSlide = { layout: 'cover', image: sample, kicker: ig ? 'Ignite' : 'Your brand', title: 'Your words stay *crisp*' };
  return `
  <div class="card"><h2><span class="step">1</span> What's it for?</h2>
    <div class="want" style="margin-top:14px">
      <div class="wcard${ig ? ' on' : ''}" data-mode="ignite"><span class="dot"></span><span><b>Promoting Ignite</b><span class="muted">The Ignite logo is built in, with Ignite teal. Claude can add Ignite Hub screens. A small risk line goes on the last slide.</span></span></div>
      <div class="wcard${ig ? '' : ' on'}" data-mode="personal"><span class="dot"></span><span><b>My own content</b><span class="muted">Your logo and your colour. About you, your life or your business.</span></span></div>
    </div></div>

  <div class="card"><h2><span class="step">2</span> Your pictures <span class="opttag">optional</span>
    <i class="tip">i<span class="tt">Photos of you, screenshots, results, places. Up to ${MAX_IMAGES}. JPG or PNG. No pictures is fine too: Claude designs slides without photos${ig ? ' and can use Ignite Hub screens' : ''}.</span></i></h2>
    <label class="drop" for="cbFiles" id="cbDrop" style="margin-top:14px;padding:26px 20px">${icon('up').replace('class="i"', 'class="i lg"')}
      <div style="font-weight:800;font-size:17px">Drop your pictures here</div><div class="muted small">or click to choose them (up to ${MAX_IMAGES})</div>
      <input id="cbFiles" type="file" multiple accept="image/png,image/jpeg,image/webp" class="hidden"></label>
    <div id="cbUp" class="small muted" style="margin-top:8px"></div>
    <div class="cbthumbs">${imgs.map((x) => `<div class="cbt"><img src="${fileUrl(`dashboard/carousels/${job.id}/images/${x.file}`)}" alt=""><button title="Remove" data-unimg="${esc(x.file)}">&times;</button></div>`).join('')}</div>
    <div id="cbErr2" class="err hidden"></div></div>

  <div class="card"><h2><span class="step">3</span> Tell Claude about it</h2>
    <label class="small cbl" for="cbAbout">What's it about? <span class="muted">Tap an idea or write your own.</span></label>
    <div class="chips" style="margin-bottom:10px">${IDEAS[f.mode].map((t) => `<button class="chip" data-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <textarea id="cbAbout" placeholder="e.g. Why I joined Ignite and what my first month looked like. Mention the live training on Mondays.">${esc(f.about)}</textarea>
    <div class="grid2" style="margin-top:14px">
      <div class="opt"><label class="t">Who is it for?</label>${chipRow('audience', AUDIENCE.map((a) => [a.toLowerCase(), a]), f.audience)}</div>
      <div class="opt"><label class="t">How should it sound?</label>${chipRow('tone', TONES, f.tone)}</div>
      <div class="opt"><label class="t">How many topics? <i class="tip">i<span class="tt">Claude gives you 3 options for each topic and you choose ONE to make. Most people want 1 topic. Pick more only if your pictures cover different subjects.</span></i></label>${chipRow('count', COUNTS, f.count || '1')}</div>
    </div>
    <label class="small cbl" for="cbNotes" style="margin-top:14px">Anything else? <span class="opttag">optional</span></label>
    <textarea id="cbNotes" style="min-height:60px" placeholder="e.g. Use the photo of me at the desk on the cover. Keep it short.">${esc(f.notes)}</textarea></div>

  <div class="card"><h2><span class="step">4</span> The look <i class="tip">i<span class="tt">You can change all of this again for each carousel after Claude writes it, and see it straight away.</span></i></h2>
    <div class="small cbl" style="margin-top:14px">Filter for your pictures</div>
    <div class="fgrid">${FILTERS.map((x, i) => `<button class="fcard${f.filter === x.id ? ' on' : ''}" data-filter="${x.id}">${preview(sampleSlide, look(x.id), 0, 1, 0.15)}
      <b>${esc(x.name)}${i === 0 ? ' <span class="badge">Suggested</span>' : ''}</b><span class="muted small">${esc(x.tip)}</span></button>`).join('')}</div>
    <div class="grid2" style="margin-top:14px">
      <div class="opt"><label class="t">Logo</label>${chipRow('logos', (ig ? LOGOS_IGNITE : LOGOS_PERSONAL).filter(([v]) => S.brand.logoUrl || !['both', 'mine'].includes(v)), f.logos)}</div>
      <div class="opt"><label class="t">Colour</label><div class="row"><input type="color" id="cbAccent" class="swatch" value="${accentOf(f).toLowerCase()}">
        <span class="small muted">${ig ? 'Ignite teal unless you change it.' : 'Your brand colour unless you change it.'}</span>${f.accent ? '<button class="linkbtn small" id="cbAccentReset">Reset</button>' : ''}</div></div>
      <div class="opt" style="grid-column:1/-1"><label class="t">Last slide <i class="tip">i<span class="tt">"Full breakdown in the caption" sends people to your post caption, where Claude puts the detail. Good for saves and longer reads.</span></i></label>
        ${chipRow('cta', ENDS.filter(([v]) => v !== 'usual' || S.brand.cta), f.cta)}
        ${f.cta === 'usual' ? `<div class="small muted" style="margin-top:8px">"${esc(S.brand.cta)}"</div>` : ''}
        ${f.cta === 'own' ? `<input type="text" id="cbCtaText" style="margin-top:10px" placeholder="e.g. Comment JOIN and I'll send you the link" value="${esc(f.ctaText)}">` : ''}</div>
    </div></div>

  <div class="card"><h2><span class="step">5</span> Send it to Claude</h2>
    <p class="lead">Claude gives you <b>3 short options</b> to choose from. You choose one, then Claude writes it in full and adds your pictures. That way your Claude plan is only used on the one you want.</p>
    <div class="send" style="margin-left:42px"><button class="btn huge" id="cbCopy">${icon('copy')} Copy my message for Claude</button>
      <div id="cbErr5" class="err hidden"></div>
      <div id="cbAfter" class="after hidden"><b>Copied. Now, in the Claude app:</b><ul class="checklist">
        <li>${icon('check')}<span>Click <b>Code</b>, and check the folder says <span class="kbd">${esc(S.kitName)}</span></span></li>
        <li>${icon('check')}<span>Paste and press <span class="kbd">Enter</span></span></li>
        <li>${icon('shield')}<span>Click <b>Allow</b> each time Claude asks. <span class="muted">That's normal.</span></span></li>
        <li>${icon('clock')}<span>Come back here to choose your option. <span class="muted">Usually 2 to 4 minutes.</span></span></li></ul></div></div></div>`;
}

function readForm() {
  if (!form) return;
  const a = $('#cbAbout'), n = $('#cbNotes'), c = $('#cbCtaText');
  if (a) form.about = a.value; if (n) form.notes = n.value; if (c) form.ctaText = c.value;
}
async function ensureJob() {
  const j = S.carousels?.find((x) => x.id === curId);
  if (j && j.state === 'new') return j;
  const nj = await post('/api/carousels/new', form); setCur(nj.id); S.carousels = [nj, ...(S.carousels || [])]; return nj;
}
function wireForm(job) {
  const el = root(), redraw = () => { readForm(); renderForm(S.carousels?.find((x) => x.id === curId)); };
  $$('[data-mode]', el).forEach((b) => b.onclick = () => { readForm(); const m = b.dataset.mode; form = { ...defaultForm(m), about: form.about, notes: form.notes, audience: form.audience, tone: form.tone, count: form.count, filter: form.filter }; redraw(); });
  $$('[data-cb]', el).forEach((g) => $$('.chip', g).forEach((c) => c.onclick = () => { readForm(); form[g.dataset.cb] = form[g.dataset.cb] === c.dataset.v && g.dataset.cb === 'audience' ? '' : c.dataset.v; redraw(); }));
  $$('[data-idea]', el).forEach((b) => b.onclick = () => { const a = $('#cbAbout'); a.value = a.value.trim() ? a.value.trim() + '. ' + b.dataset.idea : b.dataset.idea; form.about = a.value; a.focus(); });
  $$('[data-filter]', el).forEach((b) => b.onclick = () => { readForm(); form.filter = b.dataset.filter; redraw(); });
  const acc = $('#cbAccent'); if (acc) acc.onchange = () => { readForm(); form.accent = acc.value.toUpperCase(); redraw(); };
  const rst = $('#cbAccentReset'); if (rst) rst.onclick = () => { readForm(); form.accent = ''; redraw(); };
  const files = $('#cbFiles'), drop = $('#cbDrop');
  const add = async (list) => {
    clearErr('cbErr2'); readForm();
    try {
      let j = await ensureJob(); const fl = [...list];
      for (let i = 0; i < fl.length; i++) {
        $('#cbUp').textContent = `Adding picture ${i + 1} of ${fl.length}...`;
        const r = await fetch(`/api/carousels/${j.id}/image?name=${encodeURIComponent(fl[i].name)}`, { method: 'POST', body: fl[i] });
        const out = await r.json().catch(() => ({})); if (!r.ok) throw new Error(out.error || 'That picture could not be added.');
        j = out;
      }
      S.carousels = [j, ...(S.carousels || []).filter((x) => x.id !== j.id)]; $('#cbUp').textContent = ''; redraw();
    } catch (e) { $('#cbUp').textContent = ''; showErr('cbErr2', esc(e.message)); }
  };
  files.onchange = (e) => { add(e.target.files); e.target.value = ''; };
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files.length && add(e.dataTransfer.files));
  $$('[data-unimg]', el).forEach((b) => b.onclick = async () => { const j = await post(`/api/carousels/${curId}/unimage`, { file: b.dataset.unimg }); S.carousels = [j, ...S.carousels.filter((x) => x.id !== j.id)]; redraw(); });
  $('#cbCopy').onclick = async () => {
    clearErr('cbErr5'); readForm();
    if (!form.about.trim() && !(job?.images || []).length) return showErr('cbErr5', 'Add some pictures, or tell Claude what it\'s about in step 3.');
    if (form.cta === 'own' && !form.ctaText.trim()) return showErr('cbErr5', 'Write your own last-slide words in step 4, or pick another option.');
    try {
      const j0 = await ensureJob(), j = await post(`/api/carousels/${j0.id}/prepare`, { ...form, accent: accentOf(form) });
      await copy(j.message); S.carousels = [j, ...S.carousels.filter((x) => x.id !== j.id)];
      $('#cbAfter').classList.remove('hidden'); toast('Copied. Paste it into Claude.');
      setTimeout(() => renderJob(j, true), 9000); // switch to the progress view once they've read the steps
    } catch (e) { showErr('cbErr5', esc(e.message)); }
  };
}
function renderForm(job) {
  if (!form) form = { ...defaultForm(), ...(job?.options || {}) };
  root().innerHTML = formHTML(job); wireForm(job); lastSig = 'form';
}

// ---------- 2. while Claude writes ----------
function progressHTML(j) {
  const st = j.status || {}, pct = Math.max(0, Math.min(100, st.percent ?? 0)), stalled = j.state === 'working' && j.statusAge > STALL_MS;
  return `<div class="card"><div class="jobhead"><div><h2>${j.choicesSent ? 'Claude is writing the option you chose' : 'Claude is writing your 3 options'}</h2><div class="meta">${esc(new Date(j.createdAt).toLocaleString())}</div></div>
      <span class="pill ${j.state === 'sent' ? 'wait' : 'working'}">${j.state === 'sent' ? 'Waiting for Claude' : 'Working'}</span></div>
    ${j.state === 'sent' && !st.percent ? `<div class="note warn">${icon('clock')}<div><b>Waiting for Claude.</b> Paste the message into the Claude app (Code, in the ${esc(S.kitName)} folder) and press Enter. If Claude asks to <b>Allow</b> something, click Allow.
      <div style="margin-top:8px"><button class="btn ghost sm" id="cbRecopy">Copy the message again</button></div></div></div>` : `
      <div style="margin:14px 0 6px" class="row"><b>${esc(st.step || 'Working')}</b><span class="muted small">${pct}% · last update ${agoText(j.statusAge)}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div><p class="muted small">${esc(st.detail || '')}</p>
      ${stalled ? `<div class="note warn">${icon('warn')}<div><b>No update for ${Math.floor(j.statusAge / 60000)} minutes.</b> Check the Claude app: if it's asking you to <b>Allow</b>, click Allow.</div></div>`
        : `<p class="muted small">${icon('info')} Keep the Claude app open. You'll read every slide here before any image is made.</p>`}`}
    <div class="row" style="margin-top:12px"><button class="linkbtn small" id="cbNew">Start a different carousel</button></div></div>`;
}

// ---------- 2b. choose ONE option (per topic): only that one is written in full ----------
const LET = ['A', 'B', 'C'];
let picks = {}, picksFor = null;
function optionsHTML(job) {
  const set = job.optionSet || {}, topics = set.topics || [], many = topics.length > 1;
  return `<div class="cbbanner">${icon('spark')}<div><b>Claude has given you 3 options${many ? ' for each topic' : ''}. Choose ONE${many ? ' from each topic' : ''} to make.</b>
      You don't need all of them: only the option you choose gets written in full and made into images. Your pictures are added after you choose, to save your Claude plan.</div></div>
    ${set.message ? `<p class="small muted" style="margin:0 0 6px">From Claude: ${esc(set.message)}</p>` : ''}
    ${topics.map((t, ti) => `<div class="card otopic" data-ti="${ti}">
      <h2>${many ? `Topic ${ti + 1}: ` : ''}${esc(t.topic || 'Your carousel')}</h2>
      <div class="ogrid">${(t.options || []).map((op, oi) => `<div class="ocard" data-oi="${oi}">
        <div class="olabel">Option ${LET[oi] || oi + 1}</div>
        <div class="oangle">${esc(op.angle || '')}</div>
        <div class="ohook">${esc(String(op.hook || '').replace(/[*_]/g, ''))}</div>
        <ol class="oslides">${(op.slides || []).map((s) => `<li>${esc(String(s).replace(/[*_]/g, ''))}</li>`).join('')}</ol>
        <button class="btn sm ochoose" data-choose="${ti}:${oi}">Choose this one</button>
        <div class="onot small muted">Not making this one</div></div>`).join('')}</div></div>`).join('')}
    <div class="card cbmake"><h2>Make the one you chose</h2>
      <p class="small" id="cbPickedText" style="margin:8px 0 14px">Choose an option above first.</p>
      <div class="send"><button class="btn huge" id="cbSendPick" disabled>${icon('copy')} Copy my message for Claude</button>
        <div id="cbErrPick" class="err hidden"></div>
        <div id="cbAfterPick" class="after hidden"><b>Copied. Now:</b><ul class="checklist">
          <li>${icon('check')}<span>Paste it into the <b>same Claude chat</b> and press <span class="kbd">Enter</span></span></li>
          <li>${icon('shield')}<span>Click <b>Allow</b> when Claude asks.</span></li>
          <li>${icon('clock')}<span>Come back here to read your slides. <span class="muted">Usually 3 to 6 minutes.</span></span></li></ul></div></div></div>
    <details class="card" style="padding:16px 20px"><summary>None of these? Ask for 3 new options</summary>
      <textarea id="cbNewOpts" placeholder="e.g. More personal, and start with my morning routine."></textarea>
      <button class="btn ghost sm" style="margin-top:8px" id="cbNewOptsBtn">Copy a message for new options</button>
      <div class="small muted" style="margin-top:6px">Then paste it into the <b>same Claude chat</b>.</div></details>
    <div class="row" style="margin-top:12px"><button class="linkbtn small" id="cbNew">Start a different carousel</button></div>`;
}
function showPicks(job) {
  const topics = job.optionSet?.topics || [];
  $$('.otopic', root()).forEach((card) => {
    const ti = card.dataset.ti, has = picks[ti] !== undefined;
    $$('.ocard', card).forEach((oc) => {
      const on = has && String(picks[ti]) === oc.dataset.oi;
      oc.classList.toggle('on', on); oc.classList.toggle('off', has && !on);
      $('.ochoose', oc).textContent = on ? 'Chosen' : 'Choose this one';
    });
  });
  const n = Object.keys(picks).length;
  $('#cbSendPick').disabled = !n;
  $('#cbPickedText').innerHTML = !n ? 'Choose an option above first.'
    : `You chose ${Object.entries(picks).map(([ti, oi]) => `<b>Option ${LET[oi]}</b>${topics.length > 1 ? ` for "${esc(topics[ti]?.topic || '')}"` : ''}`).join(', ')}.`
      + (topics.length > 1 && n < topics.length ? ' Topics you don\'t choose from are skipped.' : '') + ' Only this gets written in full.';
}
function wireOptions(job) {
  const el = root();
  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.choose) { const [ti, oi] = b.dataset.choose.split(':'); if (String(picks[ti]) === oi) delete picks[ti]; else picks[ti] = +oi; showPicks(job); }
    else if (b.id === 'cbSendPick') {
      clearErr('cbErrPick');
      try { const j = await post(`/api/carousels/${job.id}/choose`, { choices: picks }); await copy(j.message); $('#cbAfterPick').classList.remove('hidden'); toast('Copied. Paste it into the same Claude chat.');
        setTimeout(() => { S.carousels = [j, ...S.carousels.filter((x) => x.id !== j.id)]; renderJob(j, true); }, 9000); }
      catch (err) { showErr('cbErrPick', esc(err.message)); }
    } else if (b.id === 'cbNewOptsBtn') {
      try { const j = await post(`/api/carousels/${job.id}/change`, { note: $('#cbNewOpts').value, kind: 'options' }); await copy(j.message); toast('Copied. Paste it into the same Claude chat.'); picks = {}; }
      catch (err) { toast(err.message); }
    } else if (b.id === 'cbNew') newCarousel();
  };
  el.oninput = null; el.onchange = null;
  showPicks(job);
}

// ---------- 3. check the words, then make the images ----------
const FIELD = {
  kicker: ['Small label', 'input'], title: ['Title', 'textarea'], body: ['Text', 'textarea'], stat: ['Big number', 'input'],
  quote: ['Quote', 'textarea'], by: ['Who said it', 'input'], items: ['List (one per line)', 'textarea'],
};
function imageOptions(job, cur) {
  const own = (job.images || []).map((x) => [`dashboard/carousels/${job.id}/images/${x.file}`, x.name]);
  const hub = (job.hub || []).map((h) => [h, (h.includes('/hub/') ? 'Ignite Hub: ' : 'Ignite: ') + h.split('/').pop().replace(/\.\w+$/, '').replace(/-/g, ' ')]);
  const all = [['', 'No picture'], ...own, ...hub]; if (cur && !all.some(([v]) => v === cur)) all.push([cur, cur.split('/').pop()]);
  return all.map(([v, l]) => `<option value="${esc(v)}"${v === (cur || '') ? ' selected' : ''}>${esc(l)}</option>`).join('');
}
function slideCard(job, ci, si) {
  const c = local.carousels[ci], s = c.slides[si], L = LAYOUTS.find((x) => x.id === s.layout) || LAYOUTS[1];
  const look = lookFor(job, local, ci, brandForLook());
  const fields = L.fields.filter((k) => k !== 'image').map((k) => {
    const [label, kind] = FIELD[k], v = k === 'items' ? (s.items || []).join('\n') : s[k] || '';
    const ph = k === 'title' && s.layout === 'end' ? 'Full breakdown in the *caption*' : '';
    return `<label class="fl"><span>${label}</span>${kind === 'input' ? `<input type="text" data-f="${k}" value="${esc(v)}" placeholder="${esc(ph)}">`
      : `<textarea data-f="${k}" rows="${k === 'body' || k === 'items' ? 3 : 2}" placeholder="${esc(ph)}">${esc(v)}</textarea>`}</label>`;
  }).join('');
  return `<div class="sl" data-ci="${ci}" data-si="${si}">
    <div class="slpv">${preview(s, look, si, c.slides.length, 0.26)}</div>
    <div class="row slbar"><b class="small">${si + 1}</b>
      <select data-f="layout" title="Slide type">${LAYOUTS.map((x) => `<option value="${x.id}"${x.id === s.layout ? ' selected' : ''}>${x.name}</option>`).join('')}</select>
      <button class="btn ghost sm" data-mv="-1" title="Move left"${si ? '' : ' disabled'}>&larr;</button><button class="btn ghost sm" data-mv="1" title="Move right"${si < c.slides.length - 1 ? '' : ' disabled'}>&rarr;</button>
      <button class="btn ghost sm" data-del title="Remove this slide">&times;</button></div>
    <label class="fl"><span>Picture</span><select data-f="image">${imageOptions(job, s.image)}</select></label>${fields}</div>`;
}
function carouselCard(job, ci) {
  const c = local.carousels[ci], o = { ...(job.options || {}), ...(local.look || {}), ...(c.look || {}) }, ig = o.mode === 'ignite';
  const accent = (c.look?.accent || o.accent || (ig ? IGNITE_TEAL : S.brand.accent_color || IGNITE_TEAL)).toLowerCase();
  const cap = String(c.caption || '');
  return `<div class="card cbc" data-ci="${ci}">
    <div class="jobhead"><div style="flex:1;min-width:220px"><input type="text" class="cbtitle" data-ct="title" value="${esc(c.title || 'Carousel ' + (ci + 1))}"></div>
      <span class="pill">${c.slides.length} slides</span></div>
    ${c.slides.length > 3 ? `<div class="small muted" style="margin-top:6px">Scroll sideways to see all ${c.slides.length} slides &rarr;</div>` : ''}
    <div class="row cblook">
      <label class="small">Filter <select data-look="filter">${FILTERS.map((x) => `<option value="${x.id}"${x.id === (o.filter || 'luxury') ? ' selected' : ''}>${x.name}</option>`).join('')}</select></label>
      <label class="small">Logo <select data-look="logos">${(ig ? LOGOS_IGNITE : LOGOS_PERSONAL).filter(([v]) => S.brand.logoUrl || !['both', 'mine'].includes(v)).map(([v, l]) => `<option value="${v}"${v === (o.logos || (ig ? 'both' : 'mine')) ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="small row" style="gap:6px">Colour <input type="color" class="swatch" style="width:34px;height:34px" data-look="accent" value="${accent}"></label>
    </div>
    <div class="slides">${c.slides.map((_, si) => slideCard(job, ci, si)).join('')}
      ${c.slides.length < 10 ? `<button class="sladd" data-add="${ci}">+ Add a slide</button>` : ''}</div>
    <div class="capbox" style="margin-top:14px"><div class="hd"><b>Post caption <i class="tip">i<span class="tt">Paste this as the caption when you post. If your last slide says "Full breakdown in the caption", the detail is here.</span></i></b>
      <span class="row" style="gap:8px"><span class="small muted" data-capn>${cap.length} / 2200</span><button class="btn ghost sm" data-capcopy>${icon('copy')} Copy</button></span></div>
      <textarea data-ct="caption" rows="7">${esc(cap)}</textarea></div>
    ${local.carousels.length > 1 ? `<button class="btn danger sm" style="margin-top:10px" data-delc="${ci}">Remove this carousel</button>` : ''}</div>`;
}
function resultsHTML(job) {
  const r = job.render || {};
  if (r.state === 'rendering') { const p = r.total ? Math.round(100 * r.done / r.total) : 5;
    return `<div class="card"><div class="row"><b>Making your images</b><span class="muted small">${r.done || 0} of ${r.total || '?'}</span></div><div class="bar" style="margin-top:8px"><i style="width:${p}%"></i></div></div>`; }
  if (r.state === 'error') return `<div class="err">${icon('warn')}<div><b>The images couldn't be made.</b> ${esc(r.error || '')}<br>Try again. If it keeps happening, tell Claude: "the carousel images won't make" and paste this message.</div></div>`;
  if (r.state !== 'done' || !r.carousels?.length) return '';
  return `<div class="card"><h2>${icon('check')} Your images are ready</h2>
    ${r.stale ? `<div class="note warn">${icon('warn')}<div><b>You changed something after making them.</b> Press <b>Make my images</b> again to update them.</div></div>` : ''}
    ${r.carousels.map((c) => `<div style="margin-top:16px"><div class="row" style="justify-content:space-between"><b>${esc(c.title || 'Carousel')}</b>
      <span class="row" style="gap:8px"><a class="btn sm" href="${fileUrl(c.zip)}&dl=1">Download all (zip)</a><button class="btn ghost sm" data-openout>Show in folder</button></span></div>
      <div class="cbout">${c.files.map((f, i) => `<a href="${fileUrl(f)}&dl=1" title="Download slide ${i + 1}"><img src="${fileUrl(f)}&v=${c.at}" alt="Slide ${i + 1}"></a>`).join('')}</div></div>`).join('')}
    <div class="note">${icon('info')}<div>To post: download the zip, unzip it on your phone or computer, choose the slides in order (01, 02...), and paste the caption. The caption is also inside the zip.</div></div></div>`;
}
function editorHTML(job) {
  const { errors } = checkDraft(local);
  return `<div class="note">${icon('spark')}<div><b>Read every slide.</b> Change any words in the boxes: the slide updates as you type. Put <b>*stars*</b> around words for your colour, and <b>_underscores_</b> for the fancy italic. Then press <b>Make my images</b>.
      ${local.message ? `<div class="small muted" style="margin-top:6px">From Claude: ${esc(local.message)}</div>` : ''}</div></div>
    ${local.carousels.map((_, ci) => carouselCard(job, ci)).join('')}
    <div class="card cbmake"><div class="row" style="justify-content:space-between">
      <div><b>Happy with the words?</b><div class="small muted">Making the images takes a few seconds and doesn't use your Claude plan. You can change words and make them again as often as you like.</div></div>
      <button class="btn huge" id="cbMake"${errors.length ? ' disabled' : ''}>Make my images</button></div>
      ${errors.length ? `<div class="err">${icon('warn')}<div>${errors.map(esc).join('<br>')}</div></div>` : ''}</div>
    <div id="cbResults">${resultsHTML(job)}</div>
    <details class="card" style="padding:16px 20px"><summary>Ask Claude to rewrite the words</summary>
      <p class="small muted">For bigger changes (a different angle, shorter, another carousel). Small word changes are quicker in the boxes above.</p>
      <textarea id="cbChange" placeholder="e.g. Make carousel 1 friendlier and add a slide about the Monday training."></textarea>
      <button class="btn ghost sm" style="margin-top:8px" id="cbChangeBtn">Copy a change message</button>
      <div class="small muted" style="margin-top:6px">Then paste it into the <b>same Claude chat</b>.</div></details>
    <div class="row" style="margin-top:12px"><button class="linkbtn small" id="cbNew">Start a new carousel</button></div>`;
}

function save(job) {
  clearTimeout(saveT);
  saveT = setTimeout(() => { saving = post(`/api/carousels/${job.id}/draft`, { draft: strip(local) }).catch((e) => toast(e.message)).finally(() => { saving = null; }); }, 500);
}
async function flush(job) { if (saveT) { clearTimeout(saveT); saveT = null; await post(`/api/carousels/${job.id}/draft`, { draft: strip(local) }); } if (saving) await saving; }
function refreshSlide(job, ci, si) {
  const card = $(`.sl[data-ci="${ci}"][data-si="${si}"] .slpv`, root()); if (!card) return;
  const c = local.carousels[ci]; card.innerHTML = preview(c.slides[si], lookFor(job, local, ci, brandForLook()), si, c.slides.length, 0.26);
}
function rerenderEditor(job) {
  const y = scrollY; root().innerHTML = editorHTML(job); wireEditor(job); scrollTo(0, y);
}
function wireEditor(job) {
  const el = root(); let pvT = null;
  const touched = () => { const r = job.render; if (r?.state === 'done') { r.stale = true; $('#cbResults').innerHTML = resultsHTML(job); wireResults(job); } };
  el.oninput = (e) => {
    const t = e.target, sl = t.closest('.sl'), cc = t.closest('.cbc');
    if (sl && t.dataset.f && t.dataset.f !== 'layout' && t.dataset.f !== 'image') {
      const ci = +sl.dataset.ci, si = +sl.dataset.si, s = local.carousels[ci].slides[si], k = t.dataset.f;
      if (k === 'items') s.items = t.value.split('\n').map((x) => x.trim()).filter(Boolean); else if (t.value.trim()) s[k] = t.value; else delete s[k];
      clearTimeout(pvT); pvT = setTimeout(() => refreshSlide(job, ci, si), 250); save(job); touched();
    } else if (cc && t.dataset.ct) {
      local.carousels[+cc.dataset.ci][t.dataset.ct] = t.value; save(job);
      if (t.dataset.ct === 'caption') $('[data-capn]', cc).textContent = `${t.value.length} / 2200`;
    }
  };
  el.onchange = (e) => {
    const t = e.target, sl = t.closest('.sl'), cc = t.closest('.cbc');
    if (sl && (t.dataset.f === 'layout' || t.dataset.f === 'image')) {
      const ci = +sl.dataset.ci, si = +sl.dataset.si, s = local.carousels[ci].slides[si];
      if (t.value) s[t.dataset.f] = t.value; else delete s[t.dataset.f];
      save(job); touched(); if (t.dataset.f === 'layout') rerenderEditor(job); else refreshSlide(job, ci, si);
    } else if (cc && t.dataset.look) {
      const c = local.carousels[+cc.dataset.ci]; c.look = { ...(c.look || {}), [t.dataset.look]: t.dataset.look === 'accent' ? t.value.toUpperCase() : t.value };
      save(job); touched(); rerenderEditor(job);
    }
  };
  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const sl = b.closest('.sl'), cc = b.closest('.cbc');
    if (sl && (b.dataset.mv || 'del' in b.dataset)) {
      const ci = +sl.dataset.ci, si = +sl.dataset.si, arr = local.carousels[ci].slides;
      if ('del' in b.dataset) { if (arr.length <= 2) return toast('A carousel needs at least 2 slides.'); if (!confirm('Remove this slide?')) return; arr.splice(si, 1); }
      else { const to = si + +b.dataset.mv; [arr[si], arr[to]] = [arr[to], arr[si]]; }
      save(job); touched(); rerenderEditor(job);
    } else if ('add' in b.dataset) {
      const arr = local.carousels[+b.dataset.add].slides, at = arr.length && arr[arr.length - 1].layout === 'end' ? arr.length - 1 : arr.length;
      arr.splice(at, 0, { layout: 'statement', title: 'Your *words* here' }); save(job); touched(); rerenderEditor(job);
    } else if ('delc' in b.dataset) {
      if (!confirm('Remove this whole carousel?')) return; local.carousels.splice(+b.dataset.delc, 1); save(job); touched(); rerenderEditor(job);
    } else if ('capcopy' in b.dataset && cc) { await copy(local.carousels[+cc.dataset.ci].caption || ''); toast('Caption copied.'); }
    else if (b.id === 'cbMake') {
      b.disabled = true; try { await flush(job); const j = await post(`/api/carousels/${job.id}/render`, {}); job.render = j.render; $('#cbResults').innerHTML = resultsHTML(job); }
      catch (err) { toast(err.message); } finally { b.disabled = false; }
    } else if (b.id === 'cbChangeBtn') {
      try { await flush(job); const j = await post(`/api/carousels/${job.id}/change`, { note: $('#cbChange').value }); await copy(j.message); toast('Copied. Paste it into the same Claude chat.'); }
      catch (err) { toast(err.message); }
    } else if (b.id === 'cbNew') newCarousel();
  };
  wireResults(job);
}
function wireResults(job) { $$('[data-openout]', root()).forEach((b) => b.onclick = () => post(`/api/carousels/${job.id}/open`, {})); }

// ---------- list + routing ----------
function newCarousel() { setCur(null); form = defaultForm(); local = null; localFor = null; renderJob(null, true); scrollTo(0, 0); }
function renderList() {
  const done = (S.carousels || []).filter((j) => j.state !== 'new' && j.id !== curId);
  $('#cbList').innerHTML = done.length ? `<h2 style="margin:30px 0 4px">Your other carousels</h2>${done.map((j) => {
    const first = j.render?.carousels?.[0]?.files?.[0], t = j.draft?.carousels?.map((c) => c.title).join(', ') || j.options?.about || 'Carousel';
    return `<div class="card row" style="gap:14px;padding:14px 18px">${first ? `<img src="${fileUrl(first)}" style="width:54px;border-radius:6px">` : ''}
      <div style="flex:1;min-width:180px"><b>${esc(t.slice(0, 80))}</b><div class="small muted">${esc(new Date(j.createdAt).toLocaleString())}</div></div>
      <button class="btn ghost sm" data-openc="${j.id}">Open</button><button class="btn danger sm" data-delj="${j.id}">Remove</button></div>`;
  }).join('')}` : '';
  $$('[data-openc]', $('#cbList')).forEach((b) => b.onclick = () => { setCur(b.dataset.openc); local = null; localFor = null; renderJob(S.carousels.find((x) => x.id === curId), true); scrollTo(0, 0); });
  $$('[data-delj]', $('#cbList')).forEach((b) => b.onclick = async () => {
    if (!confirm('Remove this carousel and its images from your computer?')) return;
    await post(`/api/carousels/${b.dataset.delj}/delete`, {}); S.carousels = S.carousels.filter((x) => x.id !== b.dataset.delj); renderList();
  });
}
function renderJob(job, force) {
  const editing = root().contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (!job || job.state === 'new') { if (force || lastSig !== 'form') { form = form || { ...defaultForm(), ...(job?.options || {}) }; renderForm(job); } return; }
  if (job.state === 'options') {
    if (picksFor !== job.id) { picks = {}; picksFor = job.id; }
    const sig = 'o' + job.id + JSON.stringify(job.optionSet);
    if (!force && sig === lastSig) return; lastSig = sig; root().innerHTML = optionsHTML(job); wireOptions(job); return;
  }
  if (job.state === 'sent' || job.state === 'working') {
    const sig = 'p' + JSON.stringify([job.id, job.state, job.status, ageKey(job)]);
    if (!force && sig === lastSig) return; lastSig = sig; root().innerHTML = progressHTML(job);
    const rc = $('#cbRecopy'); if (rc) rc.onclick = async () => { await copy(job.message); toast('Copied.'); };
    $('#cbNew').onclick = newCarousel; return;
  }
  // draft / rendering / done: the editor. Load Claude's draft unless we're holding newer local edits.
  const fresh = localFor !== job.id || (job.draftAt > (local?._at || 0) && !saveT && !saving && JSON.stringify(job.draft) !== JSON.stringify(strip(local)));
  if (fresh && !(editing && localFor === job.id)) { local = { ...structuredClone(job.draft), _at: job.draftAt }; localFor = job.id; lastSig = ''; }
  const sig = 'e' + job.id + (localFor === job.id ? local._at : '');
  if (force || sig !== lastSig) { lastSig = sig; rerenderEditor(job); return; }
  const r = $('#cbResults'), rs = JSON.stringify(job.render || {});
  if (r && r._rs !== rs) { r._rs = rs; r.innerHTML = resultsHTML(job); wireResults(job); }
}
const strip = (d) => { const { _at, ...rest } = d || {}; return rest; };

window.carouselRefresh = () => {
  if (!S || $('#tab-carousel').classList.contains('hidden')) return;
  if (gate()) return;
  const job = S.carousels?.find((x) => x.id === curId) || null;
  if (curId && !job) setCur(null);
  renderJob(job); renderList();
};
