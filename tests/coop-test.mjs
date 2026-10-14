import { createRequire } from 'module'; const require = createRequire('/workspace/tools/');
const pp = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999', tag = process.argv[3] || 'coop-local', SH = '/workspace/ashen-shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await pp.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
async function mk(name, w, h) {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: w < 500 ? 3 : 1 });
  p.on('pageerror', e => errors.push(name + ': ' + e.message)); p.on('console', async m => { if (m.type() !== 'error') return; let t = m.text(); if (/JSHandle/.test(t)) t = (await Promise.all(m.args().map(x => x.evaluate(v => v && v.stack ? v.stack.split('\n').slice(0, 3).join(' / ') : String(v)).catch(() => '?')))).join(' '); if (!errors.includes(name + ' console: ' + t)) errors.push(name + ' console: ' + t); });
  p.nm = name; return p;
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const waitF = (p, f, ms = 20000, ...a) => p.waitForFunction(f, { timeout: ms, polling: 100 }, ...a);
const H = await mk('host', 390, 844), A = await mk('guestA', 1280, 800), B = await mk('guestB', 390, 844);
await H.goto(base + '/', { timeout: 90000 }); await waitF(H, () => window.__ready, 60000);
await H.click('#coop'); await H.$eval('#nm', e => e.value = 'Ash'); await H.click('#hostB');
await waitF(H, () => document.getElementById('rc'), 90000);
const code = await H.$eval('#rc', e => e.textContent); ok(/^[A-Z]{4}$/.test(code), 'host got room code ' + code);
const link = await H.$eval('.linkline', e => e.textContent); ok(link.endsWith('?room=' + code), 'share link ' + link);
for (const [p, n] of [[A, 'Bryn'], [B, 'Cass']]) {
  await p.goto(base + '/?room=' + code); await waitF(p, () => document.getElementById('joinB'));
  ok(await p.$eval('#code', e => e.value) === code, p.nm + ' join screen prefilled from link');
  await p.$eval('#nm', (e, n) => e.value = n, n); await p.click('#joinB'); await waitF(p, () => document.getElementById('rc'));
}
await waitF(H, () => __coop.NET.players.length === 3); ok(true, 'host lobby shows 3 mages');
await H.screenshot({ path: SH + tag + '-lobby-390x844.png' }); await A.screenshot({ path: SH + tag + '-lobby-1280x800.png' });
await H.click('#begin');
await waitF(H, () => __ashen.mode === 'map'); await waitF(A, () => __ashen.mode === 'wait'); await waitF(B, () => __ashen.mode === 'wait');
ok(true, 'run started: host on map, guests waiting');
await sleep(800); await H.screenshot({ path: SH + tag + '-hostmap-390x844.png' });
// expansion pages in co-op: each mage carries new pages + sigils
const LO = { H: ['crownglyph','galelash','halochant','hexmote','bloodletter','penance','belltoll','sanctified','gravehand','hexmote'], A: ['famsigil','aegissigil','flowsigil','hexachant','emberneedle','emberneedle','emberneedle','weighted','censer','inkserpent'], B: ['stormglyph','echoglyph','stormorb','twinrelay','stonespire','mendsigil','spiral','pagestorm','haunted','candlewraith'] };
for (const [p, k] of [[H, 'H'], [A, 'A'], [B, 'B']]) await ev(p, sl => { const w = __ashen.G.wands[0]; w.slots = sl.concat(Array(Math.max(0, 10 - sl.length)).fill(null)); w.maxMana = 400; w.mana = 400; w.regen = 120; }, LO[k]);
await H.evaluate(() => { const d = document.querySelector('[data-door="fight"]'); d.click(); });
await waitF(A, () => __ashen.mode === 'room'); await waitF(B, () => __ashen.mode === 'room');
await waitF(H, () => [...__coop.NET.peers.values()].filter(q => q.inRoom).length === 2, 10000); ok(true, 'both guests are in the host simulation');
// invulnerable for the test
const god = setInterval(() => { H.evaluate(() => { __ashen.P.inv = 9; for (const q of __coop.NET.peers.values()) q.inv = 9; }).catch(() => { }); }, 300);
await sleep(1200);
// guest A moves; host sees it
const peerX0 = await ev(H, () => [...__coop.NET.peers.values()].find(q => q.name === 'Bryn').x);
await ev(A, () => { __ashen.input.dx = -1; __ashen.input.dy = -1; }); await sleep(900); await ev(A, () => { __ashen.input.dx = 0; __ashen.input.dy = 0; }); await sleep(400);
const peerX1 = await ev(H, () => [...__coop.NET.peers.values()].find(q => q.name === 'Bryn').x);
ok(peerX1 < peerX0 - 20, `host sees guest move (${peerX0.toFixed(0)} → ${peerX1.toFixed(0)})`);
// host moves; guest B sees it
const hx0 = await ev(B, () => __coop.room.others.find(o => o.name === 'Ash').x);
await ev(H, () => { __ashen.input.dx = 1; }); await sleep(900); await ev(H, () => { __ashen.input.dx = 0; }); await sleep(500);
const hx1 = await ev(B, () => __coop.room.others.find(o => o.name === 'Ash').x);
ok(hx1 > hx0 + 15, `guest sees host move (${hx0.toFixed(0)} → ${hx1.toFixed(0)})`);
ok(await ev(B, () => __coop.room.others.length) === 2, 'guest B sees both other mages');
ok(await ev(A, () => __coop.room.shots.length + __coop.room.foes.length) > 0, 'guest receives synced foes/spells');
const seenK = new Set(), seenOv = { v: 0 };
const seenSt = { v: 0 };
for (let i = 0; i < 30; i++) { seenSt.v |= await ev(A, () => __coop.room.foes.reduce((m, f) => m | (f.stun ? 1 : 0) | (f.mark ? 2 : 0) | (f.slowT ? 8 : 0), 0)); const k = await ev(H, () => __ashen.room.shots.map(s => s.kind)); k.forEach(x => seenK.add(x)); seenOv.v = Math.max(seenOv.v, await ev(B, () => Math.max(0, ...__coop.room.shots.map(s => s.ov || 0)))); await sleep(150); }
ok(['galelash','hexmote','emberneedle','stormorb','bloodletter','belltoll','censer','pagestorm'].every(k => seenK.has(k)), 'host simulates new pages from all three mages: ' + [...seenK].join(','));
ok(seenSt.v & 3, 'guest receives new enemy statuses (stun/mark/slow bits ' + seenSt.v + ')');
ok(seenOv.v > 0, 'guest receives glyph overlays on synced spells (ov ' + seenOv.v + ')');
ok(await ev(H, () => { const q = [...__coop.NET.peers.values()].find(q => q.name === 'Bryn'); return __ashen.sigN(q.wand, 'fam') === 1 && q.shield; }), 'host runs guest sigils (familiar + aegis shield on Bryn)');
ok(await ev(A, () => __ashen.P.shield === true), 'guest sees its own aegis shield from snapshot');
ok(await ev(B, () => (__coop.room.others.find(o => o.name === 'Bryn').sigs || []).includes('fam')), 'other guests see Bryn\'s sigils');
await H.screenshot({ path: SH + tag + '-room-390x844.png' }); await A.screenshot({ path: SH + tag + '-room-1280x800.png' }); await B.screenshot({ path: SH + tag + '-room-guestB-390x844.png' });
// kill one specific enemy, both guests see it die
const fid = await ev(H, () => { const f = __ashen.room.foes.find(f => f.spawnT <= 0) || __ashen.room.foes[0]; return f.id; });
ok(await ev(A, id => __coop.NET.foeMap.has(id), fid) && await ev(B, id => __coop.NET.foeMap.has(id), fid), 'guests see enemy #' + fid + ' alive');
await ev(H, id => { const f = __ashen.room.foes.find(f => f.id === id); if (f) { f.hp = 0.01; f.spawnT = 0; } }, fid);
await waitF(H, id => !__ashen.room || !__ashen.room.foes.some(f => f.id === id), 10000, fid);
await sleep(400);
ok(!(await ev(A, id => __coop.NET.foeMap.has(id), fid)) && !(await ev(B, id => __coop.NET.foeMap.has(id), fid)), 'both guests saw enemy #' + fid + ' die');
ok(await ev(A, () => (__coop.room.corpseN || 0) > 0), 'guest renders an ember/ash death corpse');
// finish the room together
const t0 = Date.now();
while (Date.now() - t0 < 40000) { const m = await ev(H, () => { if (__ashen.room) for (const f of __ashen.room.foes) { f.hp = Math.min(f.hp, .01); f.spawnT = 0; } return __ashen.mode; }); if (m !== 'room') break; await sleep(250); }
await waitF(H, () => __ashen.mode === 'pick', 15000); await waitF(A, () => __ashen.mode === 'pick', 15000); await waitF(B, () => __ashen.mode === 'pick', 15000);
ok(true, 'room cleared: all three see their own reward screen');
clearInterval(god);
await A.screenshot({ path: SH + tag + '-reward-1280x800.png' });
// rewards are per player; host picks path once guests are ready
for (const p of [A, B]) await p.click('#rw0');
await waitF(A, () => __ashen.mode === 'wait'); await H.click('#rw0'); await waitF(H, () => __ashen.mode === 'map');
await waitF(H, () => __coop.NET.ready.size === 2, 8000).then(() => ok(true, 'host map shows both guests ready'), () => ok(false, 'guests ready'));
ok(await ev(A, () => __ashen.G.bag.filter(Boolean).length) >= 2, 'guest got its own reward page');
// host leaves -> guests get a clear message
await H.close(); await waitF(A, () => /Co-op ended/.test(document.body.innerText), 15000).then(() => ok(true, 'host leaving ends the run for guests with a message'), () => ok(false, 'host-left message'));
await A.screenshot({ path: SH + tag + '-hostleft-1280x800.png' });
// solo still works offline-style
const S = await mk('solo', 390, 844); await S.goto(base + '/'); await waitF(S, () => window.__ready);
await S.click('#go'); await waitF(S, () => __ashen.mode === 'map'); await S.click('#door0'); await waitF(S, () => __ashen.mode === 'room');
await sleep(2500); ok(await ev(S, () => __ashen.room.shots.length + __ashen.room.foes.length > 0 && !window.NET.on), 'solo room runs without co-op');
console.log('ERRORS', JSON.stringify(errors), 'FAILS', fails.length); await b.close(); process.exit(fails.length || errors.length ? 1 : 0);
