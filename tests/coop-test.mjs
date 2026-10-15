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
// ---- a guest burns pages between rooms (waiting): real drag onto the brazier; host mirrors the wand + hp ----
{ const drag = async (p, from) => { const c = await p.$(`[data-loc="${from}"] .chip`), z = await p.$('#burnzone'); const a = await c.boundingBox(), bz = await z.boundingBox(); const x0 = a.x + a.width / 2, y0 = a.y + a.height / 2, x1 = bz.x + bz.width / 2, y1 = bz.y + bz.height / 2; await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await p.mouse.up(); };
  await A.click('#edit'); await waitF(A, () => document.getElementById('burnzone'));
  const pre = await ev(A, () => ({ bag: __ashen.G.bag.filter(Boolean).length, fl: __ashen.G.flame, em: __ashen.G.embersRun, w: __ashen.G.wands[0].slots.filter(Boolean).length }));
  const bi = await ev(A, () => __ashen.G.bag.findIndex(x => x && !(CARDS[x].rar >= 4))); await drag(A, 'b:' + bi); await sleep(200);
  await A.screenshot({ path: SH + tag + '-guest-burn-1280x800.png' });
  const wi = await ev(A, () => __ashen.G.wands[0].slots.findIndex(x => x && !(CARDS[x].rar >= 4))); await drag(A, 'w:' + wi); await sleep(900);
  const post = await ev(A, () => ({ bag: __ashen.G.bag.filter(Boolean).length, fl: __ashen.G.flame, em: __ashen.G.embersRun, w: __ashen.G.wands[0].slots.filter(Boolean).length, slots: __ashen.G.wands[0].slots.join(',') }));
  const hq = await ev(H, () => { const q = [...__coop.NET.peers.values()].find(q => q.name === 'Bryn'); return { burns: (q.burns || []).length, hp: q.hp, slots: q.wand ? q.wand.slots.join(',') : '' }; });
  ok(post.bag === pre.bag - 1 && post.w === pre.w - 1 && post.em > pre.em && hq.burns === 2 && hq.slots === post.slots && Math.abs(hq.hp - Math.ceil(post.fl)) <= 1, `guest burns 2 pages while waiting (satchel + grimoire): host logged ${hq.burns} burns, mirrors the wand [${hq.slots}] and hp ${hq.hp} (guest ${post.fl}, embers ${pre.em}→${post.em})`);
  await A.click('#burnUndo'); await sleep(900);
  const hu = await ev(H, () => { const q = [...__coop.NET.peers.values()].find(q => q.name === 'Bryn'); return { burns: (q.burns || []).length, n: q.wand.slots.filter(Boolean).length }; });
  ok(hu.burns === 1 && hu.n === pre.w, 'guest undo of the last burn reaches the host (burn log ' + hu.burns + ', host wand back to ' + hu.n + ' pages)');
  await A.click('#done'); await waitF(A, () => __ashen.mode === 'wait'); }
// ---- Legendary pages in co-op: each mage brings an ornate grimoire with 2 Legendaries in its gold slots ----
const LG = { H: ['cathedralfall', 'ossuary', 'spark', 'spark', 'spark', 'spark'], A: ['lastpage', 'hereticmark', 'spark', 'heavy', 'fireball', 'spark'], B: ['grimoireecho', 'eternalflame', 'ice', 'spark'] };
for (const [p, k] of [[H, 'H'], [A, 'A'], [B, 'B']]) await ev(p, sl => { const w = lgOrnate(makeWand({ name: 'Four-Leaf Codex', slots: sl.concat([null, null]), delay: sl[0] === 'cathedralfall' ? .45 : .15, recharge: .3, maxMana: 600, mana: 600, regen: 200 })); __ashen.G.wands[0] = w; __ashen.G.active = 0; window.__lgS = 0; const _au = au; au = (...a) => { if (/^lg/.test(a[0])) window.__lgS++; return _au(...a); }; }, LG[k]);
// Bryn's Last Page needs a best spell first: fireball (host side copy)
await ev(H, () => enterDoor('fight'));
await waitF(A, () => __ashen.mode === 'room'); await waitF(B, () => __ashen.mode === 'room');
await waitF(H, () => [...__coop.NET.peers.values()].filter(q => q.inRoom && q.wand && q.wand.ornate).length === 2, 10000).then(() => ok(true, 'host runs both guests\' ornate grimoires'), () => ok(false, 'guest ornate wands on host'));
const god2 = setInterval(() => { H.evaluate(() => { __ashen.P.inv = 9; for (const q of __coop.NET.peers.values()) q.inv = 9; if (__ashen.room) for (const f of __ashen.room.foes) if (f.hp < 25 && !f.boss) f.hp = 25; }).catch(() => { }); }, 250);
const LK = new Set(), lv = { A: 0, B: 0 }, st = { v: 0 }, wl = { H: 0, A: 0, B: 0 }, al = { A: 0, B: 0 }, orn = { A: 0, B: 0 };
for (let i = 0; i < 40; i++) {
  (await ev(H, () => __ashen.room ? __ashen.room.shots.filter(s => CARDS[s.kind].leg || s.lv).map(s => s.kind + (s.lv ? '+lv' : '')) : [])).forEach(x => LK.add(x));
  for (const [p, k] of [[A, 'A'], [B, 'B']]) { const r = await ev(p, () => __coop.room ? { lv: __coop.room.shots.reduce((m, s) => m | (s.lv || 0), 0), st: __coop.room.foes.reduce((m, f) => m | (f.heretic ? 256 : 0) | (f.bondT ? 512 : 0) | (f.rage ? 1024 : 0), 0), w: (__coop.room.walls || []).length, a: (__coop.room.allies || []).length, o: __coop.room.others.filter(o => o.orn).length } : null); if (!r) continue; lv[k] |= r.lv; st.v |= r.st; wl[k] = Math.max(wl[k], r.w); al[k] = Math.max(al[k], r.a); orn[k] = Math.max(orn[k], r.o); }
  wl.H = Math.max(wl.H, await ev(H, () => __ashen.room ? (__ashen.room.walls || []).length : 0)); st.h = (st.h || 0) + await ev(H, () => __ashen.room ? __ashen.room.foes.filter(f => f.heretic > 0).length : 0);
  if (i === 18) { await B.screenshot({ path: SH + tag + '-legend-guestB-390x844.png' }); await H.screenshot({ path: SH + tag + '-legend-host-390x844.png' }); await A.screenshot({ path: SH + tag + '-legend-guestA-1280x800.png' }); }
  await sleep(200);
}
ok(['cathedralfall', 'eternalflame'].every(k => [...LK].some(x => x.startsWith(k))) && [...LK].some(x => x.endsWith('+lv')), 'host simulates Legendary pages from all mages: ' + [...LK].join(','));
ok(lv.A & 64 && lv.B & 256, 'guests receive Legendary glyph overlays (A ' + lv.A + ', B ' + lv.B + ')');
ok(st.v & 256, 'guests see Heretic\'s Mark on enemies (status bits ' + st.v + ', host samples ' + st.h + ')');
ok(wl.H > 0 && wl.A > 0 && wl.B > 0, `rubble walls synced (host ${wl.H}, A ${wl.A}, B ${wl.B})`);
ok(orn.A === 2 && orn.B === 2, 'guests see the other mages\' ornate covers');
console.log('INFO skeleton allies seen on guests: A ' + al.A + ', B ' + al.B);
const lp = { A: await ev(A, () => ({ slots: __ashen.G.wands[0].slots.join(','), ack: __coop.NET.lpAck || 0 })), H: await ev(H, () => { const q = [...__coop.NET.peers.values()].find(q => q.name === 'Bryn'); return { burn: q.lpBurn || 0, slots: q.wand.slots.join(',') }; }) };
ok(lp.H.burn === 1 && !/lastpage/.test(lp.H.slots) && !/lastpage/.test(lp.A.slots) && lp.A.ack === 1, 'The Last Page burns once and is removed from the guest\'s own grimoire (host burns ' + lp.H.burn + ', guest ack ' + lp.A.ack + ')');
const sn = { A: await ev(A, () => window.__lgS), B: await ev(B, () => window.__lgS) }; ok(sn.A > 0 && sn.B > 0, `guests hear Legendary sounds (A ${sn.A}, B ${sn.B})`);
// guest edits its grimoire after the burn: the Last Page must not come back on the host
await ev(A, () => { __ashen.G.wands[0].slots[5] = 'spark'; }); await sleep(800);
ok(!(await ev(H, () => [...__coop.NET.peers.values()].find(q => q.name === 'Bryn').wand.slots.includes('lastpage'))), 'burned Last Page stays gone after the guest changes its grimoire');
// ---- a guest burns a page mid-room: host is authoritative for hp/embers and applies the refund ----
{ await ev(H, () => { const q = [...__coop.NET.peers.values()].find(q => q.name === 'Cass'); q.hp = q.maxHp - 30; });
  await sleep(500); const pre = await ev(B, () => ({ fl: __ashen.G.flame, em: __ashen.G.embersRun }));
  const hp0 = await ev(H, () => { const q = [...__coop.NET.peers.values()].find(q => q.name === 'Cass'); return { hp: q.hp, em: q.em || 0 }; });
  await ev(B, () => { edWand = 0; editor(() => { UI.innerHTML = ''; }); }); await waitF(B, () => document.getElementById('burnzone'));
  const i = await ev(B, () => __ashen.G.wands[0].slots.indexOf('ice')); const rf = await ev(B, () => __burn.burnRefund('ice'));
  { const c = await B.$(`[data-loc="w:${i}"] .chip`), z = await B.$('#burnzone'); const a = await c.boundingBox(), bz = await z.boundingBox(); await B.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await B.mouse.down(); for (let k = 1; k <= 10; k++) await B.mouse.move(a.x + a.width / 2 + (bz.x + bz.width / 2 - a.x - a.width / 2) * k / 10, a.y + a.height / 2 + (bz.y + bz.height / 2 - a.y - a.height / 2) * k / 10); await B.mouse.up(); }
  await sleep(1000);
  const hq = await ev(H, () => { const q = [...__coop.NET.peers.values()].find(q => q.name === 'Cass'); return { hp: q.hp, em: q.em || 0, burns: (q.burns || []).length, ice: q.wand.slots.includes('ice') }; });
  const post = await ev(B, () => ({ fl: __ashen.G.flame, em: __ashen.G.embersRun, mode: __ashen.mode }));
  await B.screenshot({ path: SH + tag + '-guest-burn-inroom-390x844.png' });
  ok(hq.burns === 1 && !hq.ice && hq.hp === Math.min(hp0.hp + rf.fl, 999) && hq.em === hp0.em + rf.em && Math.abs(post.fl - hq.hp) <= 1 && post.mode === 'room', `guest burns Ice mid-room: host applies +${rf.fl} hp (${hp0.hp}→${hq.hp}) and +${rf.em} embers (${hp0.em}→${hq.em}), drops it from the guest's wand; guest shows hp ${post.fl}, embers ${pre.em}→${post.em}`);
  await ev(B, () => { const d = document.getElementById('done'); d && d.click(); }); }
// ---- Mythic pages in co-op: guests bring a grimoire with a ✶ mythic slot; the host simulates them, guests see them ----
{ await ev(A, () => { const w = __ashen.G.wands[0]; w.slots = ['spark', 'spark', 'godfall']; w.myth = 1; w.idx = 0; w.mana = w.maxMana; });
  await ev(B, () => { const w = __ashen.G.wands[0]; w.slots = ['spark', 'fireball', 'paradox']; w.myth = 1; w.idx = 0; });
  const tough = setInterval(() => { H.evaluate(() => { if (__ashen.room) for (const f of __ashen.room.foes) if (!f.boss) f.hp = Math.max(f.hp, 400); }).catch(() => { }); }, 120);
  let god = { h: 0, a: 0, b: 0 }, mv = { b: 0, a: 0 }, hm = 0;
  for (let i = 0; i < 25; i++) {
    const h = await ev(H, () => { const qa = [...__coop.NET.peers.values()].find(q => q.name === 'Bryn'), qb = [...__coop.NET.peers.values()].find(q => q.name === 'Cass'); return { god: (__ashen.room && (__ashen.room.allies || []).some(a => a.god && a.owner === qa)) ? 1 : 0, myth: (qa.wand && qa.wand.myth ? 1 : 0) + (qb.wand && qb.wand.myth ? 1 : 0), pdx: __ashen.room ? __ashen.room.shots.filter(s => s.mv && s.owner === qb).length : 0 }; });
    god.h |= h.god; hm = Math.max(hm, h.myth); mv.h = Math.max(mv.h || 0, h.pdx);
    const ga = await ev(A, () => __coop.room ? { g: (__coop.room.allies || []).some(a => a.god) ? 1 : 0, mv: __coop.room.shots.reduce((m, s) => m | (s.mv || 0), 0) } : { g: 0, mv: 0 }); god.a |= ga.g; mv.a |= ga.mv;
    const gb = await ev(B, () => __coop.room ? { g: (__coop.room.allies || []).some(a => a.god) ? 1 : 0, mv: __coop.room.shots.reduce((m, s) => m | (s.mv || 0), 0) } : { g: 0, mv: 0 }); god.b |= gb.g; mv.b |= gb.mv;
    if (god.a && god.b && mv.b && i === 12) { await A.screenshot({ path: SH + tag + '-mythic-guestA-1280x800.png' }); await B.screenshot({ path: SH + tag + '-mythic-guestB-390x844.png' }); }
    await sleep(200);
  }
  const P_ = await ev(H, () => __mythic.MVB.paradox);
  ok(hm === 2, 'host rebuilds both guests\' grimoires with their ✶ mythic slot');
  ok(god.h && god.a && god.b, `a guest's Godfall summons a spectral boss ally on the host, seen by both guests (host ${god.h}, A ${god.a}, B ${god.b})`);
  ok(mv.h > 0 && (mv.a & P_) && (mv.b & P_), `a guest's Paradox spells carry the Mythic overlay to every client (host live ${mv.h}, A bits ${mv.a}, B bits ${mv.b})`);
  await ev(A, () => { const w = __ashen.G.wands[0]; w.slots = ['spark', 'heavy', 'fireball', 'spark', null, null]; w.myth = 0; }); await ev(B, () => { __ashen.G.wands[0].myth = 0; }); await sleep(500); await ev(H, () => { for (const a of (__ashen.room && __ashen.room.allies) || []) if (a.god) a.life = 0; }); clearInterval(tough); console.log('INFO host mode after mythic phase: ' + await ev(H, () => __ashen.mode + ' foes ' + (__ashen.room ? __ashen.room.foes.length : -1))); }
// guest standing ritual: Starfall charged by a guest on the host
await ev(B, () => { __ashen.G.wands[0].slots = ['starfall', 'spark', null, null, null, null]; }); await sleep(3800);
ok(await ev(H, () => { const q = [...__coop.NET.peers.values()].find(q => q.name === 'Cass'); return __ashen.room && __ashen.room.shots.some(s => (s.kind === 'starfall' && s.owner === q) || (s.kind === 'meteor')); }), 'a guest\'s Starfall Rite charges and rains on the host');
clearInterval(god2);
{ const t1 = Date.now(); while (Date.now() - t1 < 40000) { const m = await ev(H, () => { if (__ashen.room) for (const f of __ashen.room.foes) { f.hp = Math.min(f.hp, .01); f.spawnT = 0; } return __ashen.mode; }); if (m !== 'room') break; await sleep(250); } }
await waitF(A, () => __ashen.mode === 'pick', 15000).then(() => ok(true, 'Legendary room cleared for all'), () => ok(false, 'legendary room clear'));
// host leaves -> guests get a clear message
await H.close(); await waitF(A, () => /Co-op ended/.test(document.body.innerText), 15000).then(() => ok(true, 'host leaving ends the run for guests with a message'), () => ok(false, 'host-left message'));
await A.screenshot({ path: SH + tag + '-hostleft-1280x800.png' });
// solo still works offline-style
const S = await mk('solo', 390, 844); await S.goto(base + '/'); await waitF(S, () => window.__ready);
await S.click('#go'); await waitF(S, () => __ashen.mode === 'map'); await S.click('#door0'); await waitF(S, () => __ashen.mode === 'room');
await sleep(2500); ok(await ev(S, () => __ashen.room.shots.length + __ashen.room.foes.length > 0 && !window.NET.on), 'solo room runs without co-op');
console.log('ERRORS', JSON.stringify(errors), 'FAILS', fails.length); await b.close(); process.exit(fails.length || errors.length ? 1 : 0);
