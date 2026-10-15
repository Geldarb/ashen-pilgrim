// Burning pages: brazier drag (bag + grimoire), tap-select → brazier, press-and-hold → Burn, Legendary confirmation,
// rarity-scaled refund (embers + flame), one-step undo, undo cleared on close, ember dissolve + sound, mobile screenshots.
// usage: node burn-test.mjs [baseUrl]   (default http://localhost:3999)
import { createRequire } from 'module'; const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999', tag = process.argv[3] || 'burn', SH = '/workspace/ashen-shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errs = [], res = [], T = (id, c, m) => { res.push({ id, ok: !!c, m }); console.log((c ? '  ✓ ' : '  ✗ ') + id.padEnd(10) + m); };
async function open(w, h, url = '/') {
  const pg = await b.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pg.goto(base + url, { timeout: 90000 }); await pg.waitForFunction('window.__ready', { timeout: 90000 }); await pg.click('#go'); await sleep(300);
  await pg.evaluate(() => { window.__snd = []; const p = AUD.play; AUD.play = function (n, a, c) { __snd.push(n); return p.apply(this, arguments); }; });
  return pg;
}
const setup = (pg, slots = ['requiem', 'heavy', 'spark', null, null], bag = ['fireball', 'ice', 'stormorb', null, null, null, null, null]) => pg.evaluate((slots, bag) => {
  const G = __ashen.G; G.wands = [makeWand({ name: 'Three-Leaf Test Tome', slots, delay: .2, recharge: .4, maxMana: 200, mana: 200, regen: 50 })]; G.active = 0; G.bag = bag; G.flame = 50; G.maxFlame = 100; G.embersRun = 0; edWand = 0; edSel = null; editor(showMap);
}, slots, bag);
const st = pg => pg.evaluate(() => { const G = __ashen.G; return { slots: G.wands[0].slots.slice(), bag: G.bag.slice(), fl: G.flame, em: G.embersRun, undo: !!document.getElementById('burnUndo'), info: (document.getElementById('info') || {}).textContent, sheet: __burn.isOpen(), confirm: document.getElementById('burnsheet').classList.contains('confirm'), snd: __snd.slice() }; });
const box = async (pg, sel) => { const e = await pg.$(sel); const bb = await e.boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
async function dragTo(pg, from, toSel, mid) {
  const [x0, y0] = await box(pg, `[data-loc="${from}"] .chip`), [x1, y1] = await box(pg, toSel);
  await pg.mouse.move(x0, y0); await pg.mouse.down(); for (let i = 1; i <= 10; i++) await pg.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10);
  const hot = await pg.evaluate(() => document.getElementById('burnzone').classList.contains('hot')); if (mid) await mid();
  await pg.mouse.up(); return hot;
}
const pg = await open(390, 844);
// ---- refund table ----
let r = await pg.evaluate(() => { const B = __burn, ids = Object.keys(CARDS), by = {}; for (const id of ids) { const k = CARDS[id].rar || 1; (by[k] = by[k] || id); }
  const rows = Object.keys(by).map(k => [+k, B.burnRefund(by[k]), B.burnNeedsConfirm(by[k])]); CARDS.__mythic = { t: 'proj', name: 'Test Mythic', icon: '✷', rar: 5, mana: 1, desc: '' }; const m = B.burnRefund('__mythic'), mc = B.burnNeedsConfirm('__mythic'); delete CARDS.__mythic; return { rows, m, mc }; });
{ const v = r.rows.sort((a, b) => a[0] - b[0]); let mono = true; for (let i = 1; i < v.length; i++) if (!(v[i][1].em > v[i - 1][1].em && v[i][1].fl > v[i - 1][1].fl)) mono = false;
  T('refund', v.length === 4 && mono && v.every(x => x[2] === (x[0] >= 4)) && r.mc && r.m.em > v[3][1].em && r.m.fl > v[3][1].fl, 'refund scales with rarity: ' + v.map(x => 'r' + x[0] + ' +' + x[1].em + '✦/+' + x[1].fl + 'hp').join(', ') + ', future rarity 5 → +' + r.m.em + '✦/+' + r.m.fl + 'hp; confirmation only for rarity ≥ 4 (incl. future 5)'); }
// ---- drag from the satchel ----
await setup(pg); await sleep(200);
r = await pg.evaluate(() => ({ zone: !!document.getElementById('burnzone'), undo: !!document.getElementById('burnUndo'), rf: __burn.burnRefund('fireball') }));
T('ui', r.zone && !r.undo, 'editor shows the brazier drop zone; no undo yet');
await pg.screenshot({ path: SH + tag + '-editor-390x844.png' });
let hot = await dragTo(pg, 'b:0', '#burnzone', async () => { await pg.screenshot({ path: SH + tag + '-drag-hot-390x844.png' }); });
await sleep(120);
const fx = await pg.evaluate(() => ({ clone: document.querySelectorAll('.chip.burning').length, embers: document.querySelectorAll('.ember').length, line: document.querySelectorAll('.burnline').length }));
await pg.screenshot({ path: SH + tag + '-basic-dissolve-390x844.png' });
let s = await st(pg);
T('drag', hot && s.bag[0] === null && s.em === r.rf.em && s.fl === 50 + r.rf.fl && s.undo && /Burned/.test(s.info), 'drag a satchel page onto the brazier (zone glows while hovered) → burned, +' + r.rf.em + '✦ +' + r.rf.fl + ' flame, undo offered; info: "' + s.info + '"');
T('fx', fx.clone === 1 && fx.embers >= 7 && fx.line === 1 && s.snd.includes('burnPage'), 'ember dissolve: burning clone + ' + fx.embers + ' embers + burn line; sound "burnPage" played');
await sleep(1500); r = await pg.evaluate(() => ({ c: document.querySelectorAll('.chip.burning,.ember').length })); T('fx', r.c === 0, 'dissolve elements clean themselves up');
// ---- undo ----
await pg.click('#burnUndo'); await sleep(100); s = await st(pg);
T('undo', s.bag[0] === 'fireball' && s.em === 0 && s.fl === 50 && !s.undo && s.snd.includes('burnUndo') && /Restored/.test(s.info), 'undo restores the page to its slot and takes the refund back exactly; undo button gone (one step)');
// ---- drag from the grimoire ----
const rfH = await pg.evaluate(() => __burn.burnRefund('heavy'));
await dragTo(pg, 'w:1', '#burnzone'); await sleep(100); s = await st(pg);
T('drag', s.slots[1] === null && s.em === rfH.em && s.fl === 50 + rfH.fl, 'drag a page out of the grimoire onto the brazier → burned (+' + rfH.em + '✦, +' + rfH.fl + ' flame)');
// ---- one step only: burn 2, undo restores only the last ----
await pg.evaluate(() => { edSel = null; }); const [cx, cy] = await box(pg, '[data-loc="b:1"] .chip'); await pg.mouse.click(cx, cy); await sleep(60); await pg.click('#burnzone'); await sleep(100); s = await st(pg);
T('tap', s.bag[1] === null && s.undo, 'tap a page, then tap the brazier → burned');
await pg.click('#burnUndo'); await sleep(80); s = await st(pg);
T('undo', s.bag[1] === 'ice' && s.slots[1] === null && !s.undo, 'undo is one step: only the last burn (Ice) comes back; the earlier burn stays burned');
// undo when the original slot was refilled → goes to the satchel
await dragTo(pg, 'w:2', '#burnzone'); await sleep(80); await pg.evaluate(() => { moveCard('b:2', 'w:2'); }); await sleep(60); await pg.click('#burnUndo'); await sleep(80); s = await st(pg);
T('undo', s.slots[2] === 'stormorb' && s.bag.includes('spark'), 'undo after the slot was refilled → the page returns to the satchel');
// ---- press-and-hold → sheet → Burn ----
{ const [x, y] = await box(pg, '[data-loc="b:0"] .chip'); await pg.mouse.move(x, y); await pg.mouse.down(); await sleep(650); await pg.mouse.up(); await sleep(150); }
s = await st(pg); r = await pg.evaluate(() => ({ btn: !!document.getElementById('bsBurn'), txt: document.getElementById('burnsheet').textContent, tip: !document.getElementById('tip').classList.contains('hidden'), nm: CARDS.fireball.name }));
await pg.screenshot({ path: SH + tag + '-hold-sheet-390x844.png' });
T('hold', s.sheet && r.btn && r.txt.includes(r.nm) && !r.tip && s.bag[0] === 'fireball', 'press-and-hold a page opens the info sheet with a 🔥 Burn button (sheet stays after release)');
await pg.click('#bsBurn'); await sleep(100); s = await st(pg);
T('hold', s.bag[0] === null && !s.sheet && s.undo, 'tapping Burn on the sheet burns the page');
{ const [x, y] = await box(pg, '[data-loc="w:0"] .chip'); await pg.mouse.move(x, y); await pg.mouse.down(); await sleep(650); await pg.mouse.up(); await sleep(120); }
await pg.mouse.click(5, 5); await sleep(80); s = await st(pg); T('hold', !s.sheet && s.slots[0] === 'requiem', 'tapping outside the sheet closes it without burning');
// ---- Legendary confirmation ----
const rfL = await pg.evaluate(() => __burn.burnRefund('requiem')); const em0 = (await st(pg)).em, fl0 = (await st(pg)).fl;
await dragTo(pg, 'w:0', '#burnzone'); await sleep(150); s = await st(pg);
await pg.screenshot({ path: SH + tag + '-basic-confirm-390x844.png' });
T('legend', s.sheet && s.confirm && s.slots[0] === 'requiem' && s.em === em0, 'dragging a Legendary onto the brazier asks for confirmation first (nothing burned yet)');
await pg.click('#bsKeep'); await sleep(80); s = await st(pg); T('legend', !s.sheet && s.slots[0] === 'requiem', '"Keep it" cancels');
{ const [x, y] = await box(pg, '[data-loc="w:0"] .chip'); await pg.mouse.move(x, y); await pg.mouse.down(); await sleep(650); await pg.mouse.up(); await sleep(100); }
await pg.click('#bsBurn'); await sleep(100); s = await st(pg); T('legend', s.sheet && s.confirm && s.slots[0] === 'requiem', 'press-and-hold → Burn on a Legendary also goes through the confirmation');
await pg.click('#bsYes'); await sleep(100); s = await st(pg);
T('legend', s.slots[0] === null && s.em === em0 + rfL.em && s.fl === Math.min(100, fl0 + rfL.fl), 'confirming burns it: +' + rfL.em + '✦ +' + (s.fl - fl0) + ' flame');
await pg.click('#burnUndo'); await sleep(80); s = await st(pg); T('legend', s.slots[0] === 'requiem' && s.em === em0 && s.fl === fl0, 'a burned Legendary can be undone back into its gold slot');
// ---- flame cap: refund never overheals; undo only removes what was gained ----
await pg.evaluate(() => { __ashen.G.flame = 99; }); await dragTo(pg, 'b:1', '#burnzone'); await sleep(80); s = await st(pg); const capped = s.fl;
await pg.click('#burnUndo'); await sleep(60); const s2 = await st(pg); T('refund', capped === 100 && s2.fl === 99, 'refund flame is capped at max flame (99→' + capped + '), undo returns to 99');
// ---- undo cleared when the editor closes ----
await dragTo(pg, 'b:1', '#burnzone'); await sleep(80); await pg.click('#done'); await sleep(120); await pg.evaluate(() => editor(showMap)); await sleep(120); s = await st(pg);
T('undo', !s.undo && s.bag[1] === null, 'closing the editor (Done) clears the undo; reopening shows no undo');
// ---- save persists the burn ----
r = await pg.evaluate(() => { saveRun(); const raw = Object.keys(localStorage).map(k => localStorage.getItem(k)).join(''); return !/"ice"/.test(JSON.stringify(__ashen.G.bag)); }); T('save', r, 'burned page is gone from the saved run');
await pg.close();
// ---- mobile screenshots: 3 viewports (debug kit → 4 gold slots) ----
for (const [w, h] of [[390, 844], [844, 390], [360, 780]]) {
  const p = await open(w, h, '/?debug=legendary'); const sz = w + 'x' + h;
  await p.evaluate(() => { edWand = 0; editor(showMap); }); await sleep(300);
  r = await p.evaluate(() => { const z = document.getElementById('burnzone').getBoundingClientRect(), u = document.getElementById('ui'); return { gold: document.querySelectorAll('#wslots .slot.gold').length, zw: z.width, zh: z.height, over: u.scrollWidth > u.clientWidth + 1 }; });
  T('shots', r.gold === 4 && r.zh >= 44 && r.zw >= 150 && !r.over, sz + ': 4-gold-slot editor + brazier (' + Math.round(r.zw) + '×' + Math.round(r.zh) + ' px touch target), no horizontal overflow');
  await p.screenshot({ path: SH + tag + '-gold4-editor-' + sz + '.png' });
  await p.evaluate(() => document.getElementById('burnzone').scrollIntoView({ block: 'center' })); await sleep(100);
  { const [x, y] = await box(p, '[data-loc="b:0"] .chip'); await p.mouse.move(x, y); await p.mouse.down(); await sleep(650); await p.mouse.up(); await sleep(250); }
  r = await p.evaluate(() => { const s = document.getElementById('burnsheet').getBoundingClientRect(); return { open: __burn.isOpen(), inView: s.top >= 0 && s.bottom <= innerHeight && s.left >= 0 && s.right <= innerWidth }; });
  await p.screenshot({ path: SH + tag + '-hold-' + sz + '.png' });
  await p.click('#bsBurn'); await sleep(150); const c = await p.evaluate(() => ({ open: __burn.isOpen(), confirm: document.getElementById('burnsheet').classList.contains('confirm') }));
  await p.screenshot({ path: SH + tag + '-confirm-' + sz + '.png' });
  T('shots', r.open && r.inView && c.open && c.confirm, sz + ': hold sheet fully on-screen, Legendary confirmation shown');
  await p.click('#bsYes'); await sleep(250); await p.screenshot({ path: SH + tag + '-dissolve-' + sz + '.png' }); await sleep(1300);
  await p.screenshot({ path: SH + tag + '-after-' + sz + '.png' }); await p.close();
}
const fail = res.filter(x => !x.ok).length;
console.log(`\nBURN: ${res.length - fail} passed, ${fail} failed; page errors: ${errs.length}`); if (errs.length) console.log(errs.slice(0, 8));
await b.close(); process.exit(fail || errs.length ? 1 : 0);
