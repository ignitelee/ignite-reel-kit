import test from 'node:test';
import assert from 'node:assert/strict';
import { slideHTML, checkDraft, lookFor, rich, FILTERS, LAYOUTS, IGNITE_LOGO, IGNITE_TEAL } from '../dashboard/public/carousel.mjs';
import { zip } from '../scripts/carousel.mjs';

const ctx = { filter: 'luxury', accent: '#FF8800', logos: ['brand/user/logo.png'], risk: null, index: 0, total: 5, url: (p) => '/file?path=' + p };
const slide = { layout: 'photo', image: 'x/a.jpg', kicker: 'Step 1', title: 'Hello *world*', body: 'Body _text_', items: ['a', 'b'], stat: '$3', quote: 'q', by: 'me' };

test('every layout and filter builds a full slide page with the brand colour, fonts and fit script', () => {
  for (const L of LAYOUTS) for (const F of FILTERS) {
    const html = slideHTML({ ...slide, layout: L.id }, { ...ctx, filter: F.id });
    assert.match(html, /^<!doctype html>/);
    assert.ok(html.includes('rgb(255,136,0)'), `${L.id}/${F.id} uses the accent colour`);
    assert.ok(html.includes('Anton-Regular.ttf') && html.includes("dataset.ready='1'"));
  }
});

test('text markup is escaped, then styled', () => {
  assert.equal(rich('a <b> *key* _it_\nnext'), 'a &lt;b&gt; <em class="a">key</em> <i class="s">it</i><br>next');
});

test('cover shows a swipe cue, end slide shows the risk line only when given', () => {
  assert.match(slideHTML({ layout: 'cover', title: 'T' }, ctx), /class="swipe"/);
  assert.doesNotMatch(slideHTML({ layout: 'end' }, ctx), /class="risk"/);
  assert.match(slideHTML({ layout: 'end' }, { ...ctx, risk: 'Trading involves risk.' }), /Trading involves risk\./);
});

test('look: Ignite mode defaults to both logos, teal and the risk line; personal uses the brand', () => {
  const brand = { logo: 'user/logo.png', accent_color: '#2F80ED' };
  const ig = lookFor({ options: { mode: 'ignite' } }, null, 0, brand);
  assert.deepEqual(ig.logos, ['brand/user/logo.png', IGNITE_LOGO]);
  assert.equal(ig.accent, IGNITE_TEAL); assert.ok(ig.risk);
  const me = lookFor({ options: { mode: 'personal' } }, null, 0, brand);
  assert.deepEqual(me.logos, ['brand/user/logo.png']); assert.equal(me.accent, '#2F80ED'); assert.equal(me.risk, null);
  // a carousel's own choices win over the job's
  const own = lookFor({ options: { mode: 'ignite' } }, { carousels: [{ look: { logos: 'ignite', filter: 'mono', accent: '#FFFFFF' } }] }, 0, brand);
  assert.deepEqual([own.logos, own.filter, own.accent], [[IGNITE_LOGO], 'mono', '#FFFFFF']);
  assert.deepEqual(lookFor({ options: { mode: 'ignite' } }, null, 0, { logo: null }).logos, [IGNITE_LOGO]);
});

test('draft check catches what would break or look wrong', () => {
  assert.ok(checkDraft(null).errors.length);
  const good = { carousels: [{ title: 't', caption: 'c', slides: [{ layout: 'cover', title: 'Hi' }, { layout: 'end' }] }] };
  assert.deepEqual(checkDraft(good), { errors: [], warnings: [] });
  const bad = { carousels: [{ slides: [{ layout: 'nope' }, { layout: 'list', title: 'x' }, { layout: 'cover', title: 'x'.repeat(90) + ' — dash' }] }] };
  const r = checkDraft(bad);
  assert.ok(r.errors.some((e) => /caption/.test(e)) && r.errors.some((e) => /unknown layout/.test(e)) && r.errors.some((e) => /items/.test(e)));
  assert.ok(r.warnings.some((w) => /long/.test(w)) && r.warnings.some((w) => /dash/.test(w)) && r.warnings.some((w) => /last slide/.test(w)));
  assert.ok(checkDraft({ carousels: [{ caption: 'c', slides: Array(11).fill({ layout: 'statement', title: 'x' }) }] }).errors.some((e) => /10 slides/.test(e)));
});

test('zip has a valid structure with every file stored intact', () => {
  const files = [{ name: 'a/slide-01.png', data: Buffer.from('hello') }, { name: 'a/caption.txt', data: Buffer.from('world!') }];
  const z = zip(files);
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  const end = z.length - 22;
  assert.equal(z.readUInt32LE(end), 0x06054b50);
  assert.equal(z.readUInt16LE(end + 10), 2);
  const n = z.readUInt16LE(26);
  assert.equal(z.subarray(30, 30 + n).toString(), 'a/slide-01.png');
  assert.equal(z.subarray(30 + n, 30 + n + 5).toString(), 'hello');
  assert.equal(z.readUInt32LE(14), 0x3610a686); // crc32("hello")
});

test('options check: exactly 3 options per topic, each with an angle, a hook and 4-9 headlines', async () => {
  const { checkOptions } = await import('../dashboard/public/carousel.mjs');
  const op = { angle: 'a story', hook: 'Hook', slides: ['1', '2', '3', '4', '5'] };
  assert.deepEqual(checkOptions({ topics: [{ topic: 'Day', options: [op, op, op] }] }).errors, []);
  assert.ok(checkOptions(null).errors.length);
  assert.ok(checkOptions({ topics: [{ topic: 'Day', options: [op, op] }] }).errors.some((e) => /exactly 3/.test(e)));
  assert.ok(checkOptions({ topics: [{ options: [op, op, { hook: 'x', slides: ['1'] }] }] }).errors.length >= 3);
});
