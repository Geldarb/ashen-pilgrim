// Grimoire editor redesign: pinned grimoire + Satchel | Preview | Codex tabs, compact Burn brazier on the tab bar,
// "?" help, landscape two-column. Exercises touch drag (satchel↔grimoire, grimoire→Burn, spring-loaded Satchel tab),
// tap-then-slot, long-press, undo, gold + mythic rules, finger-scrolling the satchel, and satchel rows visible per size.
// usage: node editor-test.mjs [baseUrl]   (default http://localhost:3999)
import { createRequire } from 'module'; const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999', SH = '/workspace/ashen-shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const res = [], errs = []; const ok = (id, c, m) => { res.push({ id, ok: !!c }); console.log(c ? 'ok  ' : 'FAIL', id.padEnd(12), m); };
async function open(w, h, q = '') {
  const pg = await b.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pg.goto(base + '/' + q, { timeout: 90000 }); await pg.waitForFunction('window.__ready', { timeout: 90000 }); await sleep(300); return pg;
}
const ctr = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
async function tdrag(pg, from, to, steps = 10, hold = 0) { await pg.evaluate(s => { const e = document.querySelector(s); const p = e && e.closest('.edpane'); if (p) { const r = e.getBoundingClientRect(), pr = p.getBoundingClientRect(); if (r.top < pr.top || r.bottom > pr.bottom) p.scrollTop += r.top - pr.top - pr.height / 2 + r.height / 2; } }, from); await sleep(50); const [x1, y1] = await ctr(pg, from), [x2, y2] = Array.isArray(to) ? to : await ctr(pg, to);
  await pg.touchscreen.touchStart(x1, y1); if (hold) await sleep(hold); for (let k = 1; k <= steps; k++) { await pg.touchscreen.touchMove(x1 + (x2 - x1) * k / steps, y1 + (y2 - y1) * k / steps); await sleep(16); } await pg.touchscreen.touchEnd(); await sleep(250); }
const tap = async (pg, sel) => { const c = await ctr(pg, sel); await pg.touchscreen.tap(c[0], c[1]); await sleep(200); };
const rows = pg => pg.evaluate(() => { const pane = document.getElementById('pane-bag'), bs = document.getElementById('bslots'), sl = bs.querySelector('.slot').getBoundingClientRect(), gap = parseFloat(getComputedStyle(bs).rowGap) || 0, pr = pane.getBoundingClientRect();
  const cs = getComputedStyle(pane); const inner = pr.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); const z = parseFloat(document.querySelector('.panel').style.zoom || 1);
  return +(((inner + gap * z) / (sl.height + gap * z))).toFixed(1); });
const S = (pg, f, ...a) => pg.evaluate(f, ...a);

// ---------- 390x844: structure, tabs, rules ----------
let pg = await open(390, 844);
await S(pg, () => { newRun('pilgrim'); G.bag = ['homing', 'ice', 'fireball', 'bolt', null, null, null, null]; edWand = 0; editor(showMap); });
await sleep(300);
let r = await S(pg, () => { const q = s => document.querySelector(s), R = s => q(s) && q(s).getBoundingClientRect(); const pane = R('#pane-bag'), done = R('#done'), tabs = [...document.querySelectorAll('.edtab')].map(t => t.dataset.tab + (t.classList.contains('on') ? '*' : ''));
  return { pinned: !!q('.edL #wslots') && !!q('.edL .edstats'), tabs, pvHidden: q('#pane-pv').hidden, cxHidden: q('#pane-cx').hidden, gap: done.top - pane.bottom, doc: document.scrollingElement.scrollHeight <= innerHeight, help: q('#edhelp').hidden && !!q('#edHelpB'), legendInHelp: !!q('#edhelp .legend'), zone: (z => ({ width: z.width, height: z.height }))(R('#burnzone')), zoneInBar: !!q('.edtabs #burnzone'), info: q('#info').textContent.length }; });
ok('layout', r.pinned && r.tabs.join() === 'bag*,pv,cx' && r.pvHidden && r.cxHidden, 'grimoire pinned on top; tabs ' + r.tabs.join(' | ') + ' — Satchel is the default, other panes hidden');
ok('fill', r.gap >= 0 && r.gap < 24 && r.doc, `the active pane fills the remaining height (gap to Done ${Math.round(r.gap)}px), no page scroll`);
ok('help', r.help && r.legendInHelp && r.info < 80, 'help text + colour key live behind the "?" button (inline hint ' + r.info + ' chars)');
ok('burn bar', r.zoneInBar && r.zone.width >= 48 && r.zone.height >= 48, `Burn brazier is compact on the tab bar: ${Math.round(r.zone.width)}×${Math.round(r.zone.height)}px drop target`);
await pg.screenshot({ path: SH + 'editor-390x844-satchel.png' });
// touch drag satchel → grimoire
await tdrag(pg, '[data-loc="b:0"] .chip', '[data-loc="w:1"]');
r = await S(pg, () => [G.wands[0].slots.join(), G.bag[0]]);
ok('drag', r[0] === 'spark,homing' && r[1] == null, 'touch drag satchel → grimoire slot: ' + r[0]);
// tap-then-slot
await tap(pg, '[data-loc="b:1"] .chip'); const sel = await S(pg, () => !!document.querySelector('[data-loc="b:1"].sel')); await tap(pg, '[data-loc="w:1"]');
r = await S(pg, () => [G.wands[0].slots.join(), G.bag[1]]);
ok('tap-slot', sel && r[0] === 'spark,ice' && r[1] === 'homing', 'tap a page, then a slot: swaps (' + r[0] + ', satchel gets ' + r[1] + ')');
// drag grimoire → Burn
let em0 = await S(pg, () => G.flame + '/' + (G.embersRun || 0));
await tdrag(pg, '[data-loc="w:1"] .chip', '#burnzone', 12); await sleep(900);
r = await S(pg, () => ({ s: G.wands[0].slots.join(), undo: !!document.getElementById('burnUndo'), u: (document.getElementById('burnUndo') || {}).getBoundingClientRect && document.getElementById('burnUndo').getBoundingClientRect().height, n: __burn.BURN.n }));
ok('burn drag', r.s === 'spark,' && r.undo && r.u >= 48, 'touch drag from the grimoire onto the brazier burns the page; ↶ undo appears on the tab bar (' + Math.round(r.u) + 'px)');
await pg.screenshot({ path: SH + 'editor-390x844-after-burn.png' });
await tap(pg, '#burnUndo');
r = await S(pg, () => G.wands[0].slots.join());
ok('undo', r === 'spark,ice', 'undo puts the burned page back in its grimoire slot: ' + r);
// long-press → burn sheet
{ const [x, y] = await ctr(pg, '[data-loc="b:2"] .chip'); await pg.touchscreen.touchStart(x, y); await sleep(650); r = await S(pg, () => __burn.isOpen() && !!document.getElementById('bsBurn')); await pg.touchscreen.touchEnd(); await sleep(150);
  ok('long-press', r, 'press-and-hold a satchel page opens the info + Burn sheet'); await S(pg, () => __burn.closeBurnSheet()); }
// help popover
await tap(pg, '#edHelpB'); r = await S(pg, () => ({ open: !document.getElementById('edhelp').hidden, myth: !!document.querySelector('#edhelp .t-myth'), txt: document.getElementById('edhelp').textContent.slice(0, 40) }));
await pg.screenshot({ path: SH + 'editor-390x844-help.png' });
await tap(pg, '#edHelpX'); const closed = await S(pg, () => document.getElementById('edhelp').hidden);
ok('help', r.open && r.myth && closed, '"?" opens help + colour key (incl. Mythic), "Got it" closes it');
// Preview tab
await tap(pg, '.edtab[data-tab="pv"]'); await sleep(700);
r = await S(pg, () => { const c = document.getElementById('pv').getBoundingClientRect(); return { w: c.width, h: c.height, cast: document.getElementById('castDesc').textContent, shots: __ashen.preview && __ashen.preview.world.shots.length + __ashen.preview.world.fxs.length, bag: document.getElementById('pane-bag').hidden }; });
ok('preview', r.w > 250 && r.h > 100 && /mana/.test(r.cast) && r.bag, `Preview tab: training dummy ${Math.round(r.w)}×${Math.round(r.h)} + cast line "${r.cast}"`);
await pg.screenshot({ path: SH + 'editor-390x844-preview.png' });
// spring-loaded Satchel tab: drag a grimoire page over "Satchel", it opens, drop in the satchel
{ const [x1, y1] = await ctr(pg, '[data-loc="w:1"] .chip'), [x2, y2] = await ctr(pg, '.edtab[data-tab="bag"]');
  await pg.touchscreen.touchStart(x1, y1); for (let k = 1; k <= 8; k++) { await pg.touchscreen.touchMove(x1 + (x2 - x1) * k / 8, y1 + (y2 - y1) * k / 8); await sleep(16); }
  await sleep(100); const [x3, y3] = await ctr(pg, '[data-loc="b:7"]'); for (let k = 1; k <= 8; k++) { await pg.touchscreen.touchMove(x2 + (x3 - x2) * k / 8, y2 + (y3 - y2) * k / 8); await sleep(16); } await pg.touchscreen.touchEnd(); await sleep(250);
  r = await S(pg, () => [edTab, G.bag[7], G.wands[0].slots.join()]); ok('spring tab', r[0] === 'bag' && r[1] === 'ice', 'dragging a page over the Satchel tab opens it; dropped into the satchel (' + r.join(' · ') + ')'); }
// Codex tab
await tap(pg, '.edtab[data-tab="cx"]'); await sleep(200);
r = await S(pg, () => ({ grid: document.querySelectorAll('#pane-cx .cxe').length, gh: document.getElementById('cxgrid').clientHeight, wsl: !!document.querySelector('.edL #wslots') }));
await pg.type('#cxq', 'frost'); await sleep(150); const nq = await S(pg, () => document.querySelectorAll('#pane-cx .cxe').length);
ok('codex tab', r.grid > 100 && r.gh > 100 && r.wsl && nq >= 1 && nq < 10, `Codex tab embeds the codex (${r.grid} pages, grid ${r.gh}px), search "frost" → ${nq}; grimoire stays pinned`);
await S(pg, () => { const q = document.getElementById('cxq'); q.value = ''; q.dispatchEvent(new Event('input')); __codex.CODEX_ST.q = ''; });
await pg.screenshot({ path: SH + 'editor-390x844-codex.png' });
await tap(pg, '.edtab[data-tab="bag"]');
r = await S(pg, () => [edTab, !document.getElementById('pane-bag').hidden]); ok('tab back', r[0] === 'bag' && r[1], 'back to the Satchel tab');
await S(pg, () => { edTab = 'pv'; editor(showMap); }); r = await S(pg, () => edTab); ok('default', r === 'bag', 'reopening the editor starts on the Satchel tab');
await pg.close();

// ---------- debug kit: gold + mythic rules, satchel finger-scroll, rows visible ----------
for (const [w, h, minRows] of [[390, 844, 3.5], [360, 640, 3], [844, 390, 3]]) {
  pg = await open(w, h, '?debug=mythic'); const sz = w + 'x' + h;
  await S(pg, () => { newRun('pilgrim'); edWand = 0; editor(showMap); }); await sleep(350);
  const nr = await rows(pg); const fit = await S(pg, () => { const p = document.querySelector('.panel'); return document.scrollingElement.scrollHeight <= innerHeight && p.scrollHeight <= p.clientHeight + 1; });
  ok('rows ' + sz, nr >= minRows && fit, `${sz}: satchel shows ${nr} rows of pages at once (need ≥${minRows}), no page scroll`);
  if (w === 844) { r = await S(pg, () => { const L = document.querySelector('.edL').getBoundingClientRect(), R = document.querySelector('.edR').getBoundingClientRect(), D = document.getElementById('done').getBoundingClientRect(); return { lr: L.right <= R.left + 1, done: D.right <= R.left + 1, top: Math.abs(L.top - R.top) < 12 }; });
    ok('landscape', r.lr && r.done && r.top, '844x390: grimoire (+ Done) on the left, tabbed panel on the right'); }
  await pg.screenshot({ path: SH + `editor-${sz}-debug.png` });
  if (w === 390) {
    // gold: 4 Legendaries already in the 4 gold slots → a 5th into a plain slot is refused
    r = await S(pg, () => { const wd = G.wands[0], plain = wd.slots.findIndex((id, i) => !lgGold(wd, i) && __mythic.myIdx(wd) !== i && !(id && CARDS[id].leg)); const bi = G.bag.findIndex(id => id && CARDS[id].leg); return { plain, bi, legs: wd.slots.filter(id => id && CARDS[id].leg).length }; });
    await tdrag(pg, `[data-loc="b:${r.bi}"] .chip`, `[data-loc="w:${r.plain}"]`, 10, 260);
    let d = await S(pg, (p) => ({ s: G.wands[0].slots[p], leg: !!(G.wands[0].slots[p] && CARDS[G.wands[0].slots[p]].leg), info: document.getElementById('info').textContent }), r.plain);
    ok('gold rule', r.legs === 4 && !d.leg && /✖/.test(d.info), 'a 5th Legendary into a plain slot is refused: ' + d.info.slice(0, 70));
    r = await S(pg, () => { const wd = G.wands[0]; return { mi: __mythic.myIdx(wd), bi: G.bag.findIndex(id => id && CARDS[id].myth), plain: wd.slots.findIndex((id, i) => !lgGold(wd, i) && __mythic.myIdx(wd) !== i) }; });
    await tdrag(pg, `[data-loc="b:${r.bi}"] .chip`, `[data-loc="w:${r.plain}"]`, 10, 260);
    d = await S(pg, (p) => ({ myth: !!(G.wands[0].slots[p] && CARDS[G.wands[0].slots[p]].myth), info: document.getElementById('info').textContent }), r.plain);
    ok('mythic rule', !d.myth && /✖/.test(d.info), 'a Mythic outside the ✶ slot is refused: ' + d.info.slice(0, 70));
    // finger-scroll the satchel (vertical swipe on pages), pages stay put
    const bag0 = await S(pg, () => G.bag.join());
    await S(pg, () => { document.getElementById('pane-bag').scrollTop = 0; }); const [x, y] = await ctr(pg, '[data-loc="b:7"] .chip'); await pg.touchscreen.touchStart(x, y); for (let k = 1; k <= 10; k++) { await pg.touchscreen.touchMove(x + 2, y - 16 * k); await sleep(16); } await pg.touchscreen.touchEnd(); await sleep(200);
    r = await S(pg, () => ({ st: document.getElementById('pane-bag').scrollTop, same: G.bag.join() }));
    ok('scroll', r.st > 50 && r.same === bag0, `a vertical swipe on the pages scrolls the satchel (${Math.round(r.st)}px) without moving pages`);
    await pg.screenshot({ path: SH + 'editor-390x844-debug-scrolled.png' });
    // drag from a scrolled satchel to the grimoire still works
    r = await S(pg, () => { const wd = G.wands[0]; const e = wd.slots.findIndex((id, i) => !id && !lgGold(wd, i) && __mythic.myIdx(wd) !== i); const bi = G.bag.findIndex((id, i) => i > 12 && id && !CARDS[id].leg && !CARDS[id].myth); return { e, bi, id: G.bag[bi] }; });
    if (r.e >= 0 && r.bi >= 0) { await S(pg, i => document.querySelector(`[data-loc="b:${i}"]`).scrollIntoView({ block: 'center' }), r.bi); await tdrag(pg, `[data-loc="b:${r.bi}"] .chip`, `[data-loc="w:${r.e}"]`, 10, 260); const s = await S(pg, e => G.wands[0].slots[e], r.e); ok('drag deep', s === r.id, 'touch-and-pause, then drag from deep in a scrolled satchel into the grimoire: ' + s); }
    // a Legendary burn from the grimoire still asks first
    await tdrag(pg, '[data-loc="w:0"] .chip', '#burnzone', 12); r = await S(pg, () => !!document.getElementById('bsYes')); ok('confirm', r, 'dragging a Legendary from the grimoire onto Burn asks for confirmation'); await S(pg, () => __burn.closeBurnSheet());
  }
  await pg.close();
}
await b.close();
const fail = res.filter(x => !x.ok); console.log('errors:', errs.length ? errs : 'none');
console.log(`EDITOR: ${res.length - fail.length}/${res.length} passed` + (fail.length ? '' : ' — ALL OK')); process.exit(fail.length || errs.length ? 1 : 0);
