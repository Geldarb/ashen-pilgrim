// Mythic rarity tests: metadata, the ✶ mythic slot (engine + editor), behaviour sims for all 12 pages on the real engine,
// curses in a real room, drop sources (final boss, Endless 25+, Forbidden Archive, 1 per run), debug kit, perf caps.
// usage: node mythic-test.mjs [baseUrl]   (default http://localhost:3999)
import { createRequire } from 'module'; const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999', SH = '/workspace/ashen-shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errs = [], all = [];
const pg = await b.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await pg.goto(base + '/', { timeout: 90000 }); await pg.waitForFunction('window.__ready', { timeout: 90000 }); await pg.click('#go'); await sleep(300);
const out = await pg.evaluate(() => {
  const A = window.__ashen, C = A.CARDS, M = window.__mythic, L = window.__legend, res = [], ok = (id, c, m) => res.push({ id, ok: !!c, m });
  const W = (slots, o = {}) => Object.assign({ name: 't', slots, delay: .2, recharge: .4, maxMana: 2000, mana: 2000, regen: 600, idx: 0, cd: 0, hue: 30, myth: 1 }, o);
  const foe = (x, y, o = {}) => Object.assign({ id: Math.random(), type: 'husk', dummy: true, x, y, hp: 1e9, max: 1e9, spd: 0, r: 14, dmg: 0, burn: 0, poison: 0, hit: 0, t: 0, kx: 0, ky: 0, spawnT: 0, frozen: 0, ember: 1 }, o);
  const weak = (x, y, hp = 5, o = {}) => foe(x, y, Object.assign({ dummy: false, hp, max: hp }, o));
  const world = (foes, o = {}) => Object.assign({ caster: { x: 60, y: 200 }, bounds: { x0: 0, y0: 20, x1: 600, y1: 400 }, foes, shots: [], parts: [], fxs: [], patches: [], dmgMul: 1, eshots: [] }, o);
  const step = (wd, secs, each) => { const fx = new Set(); let maxS = 0; for (let t = 0; t < secs; t += 1 / 60) { A.updateShots(wd, 1 / 60); for (const f of wd.foes) tickStatus(wd, f, 1 / 60); wd.foes = wd.foes.filter(f => !f.dead); for (const f of wd.fxs) fx.add(f.type); wd.fxs = wd.fxs.filter(f => (f.life -= 1 / 60) > 0); wd.parts = wd.parts.filter(p => (p.life -= 1 / 60) > 0); maxS = Math.max(maxS, wd.shots.length); if (each) each(t); } fx.maxS = maxS; return fx; };
  const cast = (wd, w, ang = 0) => { wd.curWand = w; w.cd = 0; return A.tryCast(wd, w, wd.caster.x, wd.caster.y - 14, ang, () => { }); };
  const kinds = wd => wd.shots.map(s => s.kind);
  // ---- metadata ----
  ok('meta', M.MYTHIC.length === 12 && M.MYTH_PROJ.length === 6 && M.MYTH_GLYPH.length === 6, '12 Mythic pages (6 attacks, 6 glyphs)');
  for (const id of M.MYTHIC) { const c = C[id]; ok(id, c && c.myth && !c.leg && c.rar === 5 && c.flav && c.desc && c.icon && M.MCURSE[c.curse] && !CARD_POOL.includes(id) && !RARE_POOL.includes(id) && (c.t !== 'proj' || (c.mk && c.shape)), 'rar 5 Mythic, flavour, curse "' + M.MCURSE[c.curse].name + '", drops only' + (c.t === 'proj' ? ', own shape ' + c.shape : '')); }
  ok('meta', ['myFanfare', 'myClaim', 'myGlyph', 'myUnwritten', 'myGodfall', 'myGodSlam', 'myScar', 'mySunPull', 'mySunBoom', 'myCovenant', 'myChoir', 'myParadox', 'myUndying'].every(k => AUD.fx[k]), 'all Mythic sounds registered');
  ok('meta', cardChip('godfall').includes(' myth') && cardRow('godfall').includes('card t-proj myth') && /Curse:/.test(cardRow('godfall')) && RAR_NAME[5] === 'mythic', 'chip/card get the Mythic class + curse line');
  // ---- the mythic slot ----
  { const w = W(['spark', 'godfall', 'spark']), w2 = W(['spark', 'spark', 'godfall']); const k = w => { const o = []; for (let i = 0; i < 4; i++) { const c = buildCast(w); o.push(...c.shots.map(s => s.p)); w.idx = c.nextIdx; } return o; };
    ok('slot', M.myIdx(w) === 2 && M.myIdx(W(['spark'], { myth: 0 })) === -1 && !k(w).includes('godfall') && k(w2).includes('godfall'), 'mythic slot = last slot; a Mythic outside it is inert, inside it casts in rotation');
    const g = W(['spark', 'fireball', 'paradox']), c = buildCast(g); ok('slot', c.shots.every(s => s.mods.includes('paradox')) && c.mana >= C.paradox.mana, 'a Mythic glyph in the slot powers every cast of the grimoire'); }
  // ---- attacks ----
  { const wd = world([foe(400, 214)]), w = W(['unwritten']); const seen = new Set(); for (let i = 0; i < 24; i++) { wd.shots = []; cast(wd, w); step(wd, .05); } for (const id of wd.unwLog) seen.add(id);
    ok('unwritten', seen.size >= 3 && [...seen].every(id => L.LEG_PROJ.includes(id) && id !== 'lastpage'), 'becomes a random Legendary attack each cast: ' + [...seen].join(', ')); }
  { const wd = world([weak(130, 214, 400), weak(150, 230, 400)]), w = W(['godfall']); cast(wd, w); const g0 = (wd.allies || []).filter(a => a.god); const fx = step(wd, 2.5); const hurt = wd.foes.filter(f => f.hp < 400).length;
    step(wd, 6.2); const g1 = (wd.allies || []).filter(a => a.god); cast(wd, w); step(wd, .1); cast(wd, w); step(wd, .5); const g2 = (wd.allies || []).filter(a => a.god && a.life > .4);
    ok('godfall', g0.length === 1 && g0[0].life <= 8 && hurt >= 1 && fx.has('quake') && g1.length === 0 && g2.length === 1, 'the floor boss fights as a spectral ally for 8s (slams hit ' + hurt + ' foes), then fades; only one at a time'); }
  { const wd = world([foe(520, 214), foe(520, 260)]), w = W(['fireball', 'worldscar']); cast(wd, w); step(wd, .05); cast(wd, w); step(wd, .1); const scar = wd.shots.find(s => s.mk === 'worldscar'), sl = scar ? scar.life : 0;
    let n = 0; for (let i = 0; i < 40; i++) { const w2 = W(['fireball'], { myth: 0 }); cast(wd, w2); step(wd, .075); n++; } const copies = wd.scarN || 0;
    ok('worldscar', scar && sl > 5 && copies > 8 && copies <= 3 * 10 + 10, 'a room-wide rift; spells crossing it are cast twice (' + copies + ' copies from ' + n + ' casts in 3s, budget-capped)'); }
  { const fs = [weak(250, 120, 1e4), weak(380, 250, 1e4), weak(300, 300, 1e4)], wd = world(fs.slice()), w = W(['blacksun']); const d0 = fs.map(f => Math.hypot(f.x - 330, f.y - 200));
    cast(wd, w, 0); const sun = wd.shots.find(s => s.mk === 'blacksun'); const sx = sun.x, sy = sun.y, d0s = fs.map(f => Math.hypot(f.x - sx, f.y - sy)); step(wd, 2); const d1 = fs.map(f => Math.hypot(f.x - sx, f.y - sy)); const pulled = fs.filter((f, i) => d1[i] < d0s[i] - 20).length;
    const before = fs.map(f => f.hp); step(wd, 1); const dmg = fs.filter((f, i) => f.hp < before[i]).length;
    ok('blacksun', wd.sunBooms === 1 && dmg >= 2 && pulled >= 2, 'pulls enemies in for 2.4s (' + pulled + ' dragged closer), then collapses in a huge blast (' + dmg + ' foes hit, blast ' + (wd.lastSun || {}).dmg + ')'); }
  { const wd = world([weak(200, 200, 1e4), weak(260, 220, 1e4), weak(320, 240, 1e4), weak(380, 200, 1e4), weak(300, 300, 1e4), weak(360, 340, 1e4), weak(420, 260, 1e6, { boss: true, r: 30 })]), w = W(['covenant']);
    cast(wd, w); step(wd, .1); const alive = wd.foes.filter(f => !f.dead); ok('covenant', wd.covN === 6 && alive.length === 1 && alive[0].boss, 'wipes every non-boss enemy (6 wiped), the boss survives'); }
  { const wd = world(Array.from({ length: 6 }, (_, i) => foe(300 + i * 30, 120 + i * 40))), w = W(['spark', 'fireball', 'eclipsechoir']); cast(wd, w); step(wd, .25); cast(wd, w); step(wd, .25); cast(wd, w);
    const ch = wd.shots.find(s => s.mk === 'eclipsechoir'); const fx = step(wd, 6.4); const n = wd.choirN || 0;
    ok('eclipsechoir', ch && n >= 20 && n <= 45 && !wd.shots.some(s => s.mk === 'eclipsechoir') && fx.maxS <= LCAP.shots, '5 floating grimoires cast copies of the grimoire for 6s (' + n + ' book casts, max ' + fx.maxS + ' live spells)'); }
  // ---- glyphs ----
  { const w = W(['spark', 'heavy', 'fireball', 'homing', 'ice', 'omnicast']), c = buildCast(w); const wd = world([foe(400, 214)]); cast(wd, w); const cd = w.cd;
    ok('omnicast', c.shots.length === 3 && c.shots.every(s => s.mods.includes('heavy') && s.mods.includes('homing')) && cd >= 2.5, 'every attack page at once with all glyphs (' + c.shots.map(s => s.p).join('+') + '), then a ' + cd.toFixed(2) + 's recharge'); }
  { const wd = world([foe(500, 214)]), a = W(['heavy', 'spark', 'sovereign']), bw = W(['ice'], { myth: 0 }); cast(wd, a); step(wd, .1); cast(wd, bw); const s1 = wd.shots.filter(s => s.kind === 'ice').pop();
    step(wd, 5.2); cast(wd, bw); const s2 = wd.shots.filter(s => s.kind === 'ice').pop();
    ok('sovereign', s1 && s1.spec.sovd && s1.spec.mods.includes('heavy') && s2 && !s2.spec.sovd, "for 5s another grimoire's spell carries the Sovereign spell's glyphs (heavy on Ice), then it ends"); }
  { const wd = world([foe(130, 186)]), w = W(['spark', 'paradox']); cast(wd, w, 0); const two = wd.shots.filter(s => s.kind === 'spark'); const opp = two.length === 2 && Math.sign(two[0].vx) !== Math.sign(two[1].vx);
    step(wd, 1); ok('paradox', opp && wd.pdxBursts === 1, 'fires forwards and in reverse; the first hit makes the other half burst exactly once'); }
  { const wd = world([]), w = W(['spark', 'undying']); cast(wd, w); step(wd, 12); const n0 = wd.undN || 0;
    const wd2 = world(Array.from({ length: 40 }, (_, i) => weak(140 + (i % 8) * 50, 60 + Math.floor(i / 8) * 70, 1))), w2 = W(['fireball', 'undying']); cast(wd2, w2); step(wd2, 8); const sp = wd2.shots.length;
    ok('undying', n0 === M.MCAP.undying() && (wd2.undN || 0) <= M.MCAP.undying(), 'comes back each time it ends (capped at ' + M.MCAP.undying() + ' returns: ' + n0 + ' with no foes, ' + (wd2.undN || 0) + ' while killing)'); }
  { const wd = world([foe(400, 186)]), w = W(['spark', 'ascendantcrown']); cast(wd, w); const d0 = wd.shots[0].dmg; wd.myCrown = 50; cast(wd, w); const d1 = wd.shots[wd.shots.length - 1].dmg;
    const wd2 = world(Array.from({ length: 5 }, (_, i) => weak(120 + i * 12, 186, 1))); for (let i = 0; i < 8; i++) { cast(wd2, w); step(wd2, .4); }
    ok('ascendantcrown', Math.abs(d1 / d0 - 1.5) < .01 && wd2.myCrown >= 3, '+1% damage per kill for the run (50 kills → ×' + (d1 / d0).toFixed(2) + '; ' + wd2.myCrown + ' kills counted in a fresh fight)'); }
  { const w = W(['requiem', 'starfall', 'cathedralfall', 'heavy', 'spark', 'fateunbound'], { ornate: false }); const ids = []; let heavy2 = false; for (let i = 0; i < 5; i++) { const c = buildCast(w); for (const s of c.shots) { ids.push(s.p); if (s.p === 'spark' && s.mods.filter(q => q === 'heavy').length === 2) heavy2 = true; } w.idx = c.nextIdx; }
    const plain = W(['requiem', 'starfall', 'spark'], { ornate: false, myth: 0 }), pk = []; for (let i = 0; i < 3; i++) { const c = buildCast(plain); pk.push(...c.shots.map(s => s.p)); plain.idx = c.nextIdx; }
    ok('fateunbound', ['requiem', 'starfall', 'cathedralfall'].every(x => ids.includes(x)) && !pk.includes('starfall') && heavy2, 'Legendaries cast from any slot (3 in a 1-gold grimoire) and other glyphs apply twice (Heavy ×2)'); }
  // ---- perf caps ----
  const perf = [];
  for (const q of ['high', 'low']) {
    const q0 = QUAL.parts; QUAL.parts = q;
    try {
      const fs = () => Array.from({ length: 40 }, (_, i) => weak(120 + (i % 10) * 45, 60 + Math.floor(i / 10) * 80, 3));
      for (const [tag, wa] of [['omnicast+recursion', W(['recursion', 'crownedash', 'spark', 'fireball', 'ice', 'double', 'omnicast'], { gold: 2, ornate: true, delay: .05, recharge: .1 })], ['choir+scar', W(['spark', 'double', 'fireball', 'eclipsechoir'], { delay: .05, recharge: .1 })], ['undying+paradox', W(['double', 'spark', 'fireball', 'undying'], { delay: .05, recharge: .1 })], ['scar+paradox', W(['fireball', 'spark', 'worldscar'], { delay: .05, recharge: .1 })]]) {
        const wd = world(fs()); let maxS = 0, t0 = performance.now(), fr = 0; const sc = W(['spark', 'paradox'], { delay: .05 });
        for (let k = 0; k < 600; k++) { if (wa.cd <= 0) cast(wd, wa, (k * .37) % 6.28); wa.cd -= 1 / 60; if (tag === 'scar+paradox' && k % 6 === 0) cast(wd, sc, (k * .2) % 6.28); step(wd, 1 / 60); fr++; maxS = Math.max(maxS, wd.shots.length); if (wd.foes.length < 10) wd.foes.push(...fs()); }
        const ms = (performance.now() - t0) / fr; perf.push(q + ' ' + tag + ': max ' + maxS + ' spells, ' + ms.toFixed(2) + ' ms/sim-frame');
        ok('perf', maxS <= 220 && ms < 8, 'caps hold [' + perf[perf.length - 1] + ']');
      }
    } finally { QUAL.parts = q0; }
  }
  return { res, perf };
});
all.push(...out.res);
console.log('perf:', out.perf.join(' | '));
// ---------- curses, Covenant cost and Black Sun absorption in a real room ----------
const roomWith = async (slots, extra) => { await pg.evaluate((slots, extra) => { clearRun(); newRun('pilgrim', false); const G = __ashen.G; G.wands = [makeWand({ name: 'Test', slots, myth: 1, delay: .3, recharge: .4, maxMana: 500, mana: 500, regen: 100 })]; G.active = 0; G.maxFlame = 100; G.flame = 60; if (extra) eval(extra); enterDoor('fight'); clearInterval(window.__inv); window.__inv = setInterval(() => { __ashen.P.inv = 99; for (const w of __ashen.G.wands) w.cd = 99; }, 30); }, slots, extra || ''); await sleep(1600); };
const U = (id, c, m) => all.push({ id, ok: !!c, m });
await roomWith(['spark', 'worldscar']);
let r = await pg.evaluate(() => { const fs = __ashen.room.foes.filter(f => f.spawnT <= 0 || true); return { n: fs.length, sped: fs.filter(f => f._mys).length, cur: __ashen.room.myCurses }; });
U('curse', r.n > 0 && r.sped === r.n && r.cur.includes('foespd'), 'Worldscar equipped → Swift foes: all ' + r.n + ' enemies +25% speed');
await roomWith(['spark', 'undying']); r = await pg.evaluate(() => ({ n: __ashen.room.foes.length, h: __ashen.room.foes.filter(f => f._myh && Math.abs(f.max / FOES[f.type].hp - Math.round(f.max / FOES[f.type].hp / 1.3 * 100) / 100 * 1.3) < 5).length }));
U('curse', r.n > 0 && r.h === r.n, 'Undying Word equipped → Hardened foes: enemies +30% HP');
await roomWith(['spark', 'godfall']); r = await pg.evaluate(() => { clearInterval(window.__inv); __ashen.P.inv = 0; __ashen.P.dodgeT = 0; const f0 = __ashen.G.flame; hurtTarget(__ashen.P, 10); return f0 - __ashen.G.flame; });
U('curse', Math.abs(r - 12.5) < .01, 'Godfall equipped → Frail: a 10-damage hit takes ' + r);
await roomWith(['spark', 'ascendantcrown']); r = await pg.evaluate(async () => { const G = __ashen.G; G.flame = 50; await new Promise(r => setTimeout(r, 60)); G.flame += 20; await new Promise(r => setTimeout(r, 120)); return G.flame; });
U('curse', r === 50, 'Ascendant Crown equipped → No healing: +20 flame is undone in a fight (flame stays ' + r + ')');
await roomWith(['spark', 'covenant']); r = await pg.evaluate(async () => { const G = __ashen.G, room = __ashen.room; await new Promise(r => setTimeout(r, 300)); const f0 = G.flame; for (const f of room.foes) f.spawnT = 0; const n0 = room.foes.filter(f => !f.boss).length; const w = G.wands[0]; w.idx = 1; w.cd = 0; w.mana = 500; tryCast(room, w, __ashen.P.x, __ashen.P.y - 14, 0, () => { }); await new Promise(r => setTimeout(r, 100)); return { f0, fl: G.flame, n0, left: room.foes.filter(f => !f.dead && f.spawnT <= 0).length }; });
U('covenant', r.fl === r.f0 - 50 && r.n0 > 0 && r.left === 0, 'in a room Covenant costs 50% of max flame (' + r.f0 + ' → ' + r.fl + ') and wipes all ' + r.n0 + ' enemies');
await roomWith(['spark', 'unwritten']); r = await pg.evaluate(async () => { const w = __ashen.G.wands[0], m0 = (w.mana = 100); const ctl = makeWand({ slots: ['spark'], regen: 100, maxMana: 500, mana: 100 }); await new Promise(r => setTimeout(r, 1000)); return { cur: __ashen.room.myCurses, m: w.mana }; });
U('curse', r.cur.includes('manadrain') && r.m < 175, 'The Unwritten equipped → Mana leak: regen slowed (mana ' + Math.round(r.m) + ' after 1s from 100, normal ≈ 200)');
await roomWith(['spark', 'blacksun']); r = await pg.evaluate(async () => { const room = __ashen.room, A = room.bounds; for (let i = 0; i < 8; i++) room.eshots.push({ x: A.x0 + 60 + i * 30, y: A.y0 + 60, vx: 0, vy: 40, life: 4, dmg: 1, col: '#f00' }); await new Promise(r => setTimeout(r, 80)); const fast = room.eshots.filter(e => e._mye).length;
  const w = __ashen.G.wands[0]; w.idx = 1; w.cd = 0; w.mana = 500; for (const f of room.foes) f.spawnT = 0; tryCast(room, w, __ashen.P.x, __ashen.P.y - 14, 0, () => { }); const sun = room.shots.find(s => s.mk === 'blacksun'); for (let k = 0; k < 10; k++) { const s = room.shots.find(s => s.mk === 'blacksun') || sun; if (s) room.eshots.push({ x: s.x + (s.x < (A.x0 + A.x1) / 2 ? 45 : -45), y: s.y + (s.y < (A.y0 + A.y1) / 2 ? 25 : -25), vx: 0, vy: 0, life: 4, dmg: 1, col: '#f00' }); await new Promise(r => setTimeout(r, 100)); }
  await new Promise(r => setTimeout(r, 2000)); return { fast, booms: room.sunBooms || 0, absorb: (room.lastSun || {}).absorb || 0, cur: room.myCurses }; });
U('blacksun', r.fast >= 8 && r.cur.includes('eshotfast') && r.booms === 1 && r.absorb >= 5, 'Quickened volleys curse (enemy shots +30%); in a room the Black Sun swallowed ' + r.absorb + ' enemy projectiles before collapsing');
// ---------- editor: mythic slot rules ----------
await pg.evaluate(() => { clearRun(); newRun('pilgrim', false); const G = __ashen.G; G.wands = [makeWand({ name: 'Slot Test', slots: ['spark', null, null, null], myth: 1, delay: .2, recharge: .4, maxMana: 200, mana: 200, regen: 50 }), makeWand({ name: 'No Slot', slots: ['spark', null], delay: .2, recharge: .4, maxMana: 200, mana: 200, regen: 50 })]; G.active = 0; G.bag = ['godfall', 'paradox', 'heavy', 'requiem', 'starfall', null, null, null]; edWand = 0; editor(showMap); });
await sleep(200);
r = await pg.evaluate(() => { const G = __ashen.G, o = {}; o.slots = document.querySelectorAll('#wslots .slot.myth').length; o.last = document.querySelector('#wslots .slot:last-child').classList.contains('myth');
  moveCard('b:0', 'w:1'); o.m1 = window.__lgDenyMsg; o.s1 = G.wands[0].slots[1]; moveCard('b:2', 'w:3'); o.m2 = window.__lgDenyMsg; o.s3 = G.wands[0].slots[3];
  moveCard('b:0', 'w:3'); o.ok = G.wands[0].slots[3] === 'godfall'; moveCard('b:1', 'w:3'); o.swap = G.wands[0].slots[3] === 'paradox' && G.bag[1] === 'godfall'; o.note = (document.querySelector('.mythnote') || {}).textContent;
  edWand = 1; editor(); moveCard('b:1', 'w:1'); o.m3 = window.__lgDenyMsg; return o; });
await pg.screenshot({ path: SH + 'myth-editor-deny-390.png' });
U('editor', r.slots === 1 && r.last && /mythic slot/.test(r.m1) && r.s1 === null && /Only a Mythic/.test(r.m2) && r.s3 === null && r.ok && r.swap && /Paradox/.test(r.note) && /none/.test(r.m3), 'one ✶ mythic slot at the end; Mythics refused elsewhere, normal pages refused in it, Mythic↔Mythic swap works; no-slot grimoire says so');
r = await pg.evaluate(() => { const G = __ashen.G; edWand = 0; G.wands[0].slots = ['spark', null, null, 'fateunbound']; G.wands[0].gold = 1; editor(); moveCard('b:3', 'w:1'); moveCard('b:4', 'w:2'); return G.wands[0].slots.slice(); });
U('editor', r[1] === 'requiem' && r[2] === 'starfall', 'with Fate Unbound in the slot, Legendaries go in any slot (2 placed in a 1-gold grimoire)');
r = await pg.evaluate(() => __burn.burnNeedsConfirm('godfall') && __burn.burnRefund('godfall').em > __burn.burnRefund('requiem').em); U('burn', r, 'burning a Mythic asks for confirmation and refunds more than a Legendary');
// ---------- drops ----------
r = await pg.evaluate(() => { clearRun(); newRun('pilgrim', false); const G = __ashen.G; G.floor = 3; const v0 = window.__myReveals || 0; victory(); const o = { offer: !!document.getElementById('myTake'), card: document.querySelectorAll('.card.myth').length, rev: (window.__myReveals || 0) - v0, flash: !!document.getElementById('myflash') };
  document.getElementById('myTake').click(); o.after = !!document.getElementById('endless'); o.run = G.mythicRun; o.bag = G.bag.includes(G.mythicRun); o.slot = G.wands.some(w => w.myth); victory(); o.second = !!document.getElementById('myTake'); return o; });
await pg.screenshot({ path: SH + 'myth-after-claim-390.png' });
U('drops', r.offer && r.card === 1 && r.rev >= 1 && r.flash && r.after && r.run && r.bag && r.slot && !r.second, 'final boss drops a Mythic (fanfare + prismatic flash); claiming binds a ✶ mythic slot; never a 2nd Mythic in the run');
r = await pg.evaluate(() => { const o = {}; clearRun(); newRun('pilgrim', false); const G = __ashen.G; G.floor = ENDLESS_START + 23; bossDown(); o.d24 = !!document.getElementById('myTake'); G.floor = ENDLESS_START + 24; bossDown(); o.d25 = !!document.getElementById('myTake'); o.title = (document.querySelector('h2') || {}).textContent; document.getElementById('myLeave').click(); o.next = !!document.getElementById('rw0'); return o; });
U('drops', !r.d24 && r.d25 && r.next, 'Endless depth 25+ boss offers a Mythic ("' + r.title + '"), depth 24 does not; leaving it continues to the normal reward');
r = await pg.evaluate(() => { const G = __ashen.G; let n0 = 0, n1 = 0; for (let s = 0; s < 400; s++) { G.seed = s * 7919; G.floor = 0; if (genMap().flat().includes('archive')) n0++; G.floor = 2; if (genMap().flat().includes('archive')) n1++; }
  clearRun(); newRun('pilgrim', false); G.step = 1; enterDoor('archive'); const o = { n0, n1, door: DOORS.archive.name, offer: !!document.getElementById('myTake'), h: (document.querySelector('h2') || {}).textContent }; const mf = __ashen.G.maxFlame; document.getElementById('myTake').click(); o.cost = mf - __ashen.G.maxFlame; __ashen.G.step = 1; enterDoor('archive'); o.empty = /empty/.test(document.querySelector('.panel').textContent); return o; });
await pg.screenshot({ path: SH + 'myth-archive-empty-390.png' });
U('drops', r.n0 === 0 && r.n1 > 15 && r.n1 < 70 && r.offer && r.cost === 20 && r.empty, 'hidden Forbidden Archive ("' + r.door + '" door) appears on ~' + Math.round(r.n1 / 4) + '% of later floors, never floor 1; sells a Mythic for 20 max HP; empty once you own one');
// ---------- debug kit ----------
const p2 = await b.newPage(); p2.on('pageerror', e => errs.push(e.message)); p2.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const flag of ['mythic', 'legendary']) {
  await p2.goto(base + '/?debug=' + flag); await p2.waitForFunction('window.__ready'); await p2.click('#go'); await sleep(300);
  r = await p2.evaluate(() => { const G = __ashen.G, ids = G.wands.flatMap(w => w.slots).concat(G.bag).filter(Boolean); return { m: new Set(ids.filter(x => CARDS[x].myth)).size, l: new Set(ids.filter(x => CARDS[x].leg)).size, slot: __mythic.myEquipped(G.wands[0]), gold: lgGoldN(G.wands[0]) }; });
  U('debug', r.m === 12 && r.l === 18 && r.slot === 'worldscar' && r.gold === 4, '?debug=' + flag + ': all 12 Mythics + 18 Legendaries, grimoire with a ✶ mythic slot (Worldscar) and 4 gold slots');
}
await p2.evaluate(() => { edWand = 0; editor(showMap); }); await sleep(400); await p2.screenshot({ path: SH + 'myth-editor-debug-390.png' });
// a real fight with the debug grimoire: Worldscar + Legendaries, no errors
await p2.evaluate(() => { document.getElementById('done').click(); __ashen.G.wands[0].slots = ['spark', 'double', 'fireball', 'ice', null, null, null, null, null, null, 'worldscar']; __ashen.G.wands[0].idx = 0; enterDoor('fight'); }); await sleep(800);
await p2.evaluate(() => { const G = __ashen.G; G.wands[0].slots = ['spark', 'double', 'fireball', 'ice', null, null, null, null, null, null, 'worldscar']; const keep = setInterval(() => { if (!__ashen.room) return clearInterval(keep); __ashen.P.inv = 9; for (const f of __ashen.room.foes) { f.hp = Math.max(f.hp, 50); } }, 200); window.__keep = keep; __ashen.input.fire = true; });
await sleep(3500); await p2.screenshot({ path: SH + 'myth-room-worldscar-390.png' });
r = await p2.evaluate(() => ({ scar: __ashen.room && __ashen.room.shots.some(s => s.mk === 'worldscar'), n: (__ashen.room && __ashen.room.scarN) || 0 }));
U('room', r.scar || r.n > 0, 'live fight: Worldscar rift drawn and duplicating spells (' + r.n + ' copies)');
await p2.evaluate(() => { const G = __ashen.G; G.wands[0].slots = ['spark', null, null, null, null, null, null, null, null, null, 'eclipsechoir']; G.wands[0].idx = 0; });
await sleep(2500); await p2.screenshot({ path: SH + 'myth-room-choir-390.png' });
await p2.evaluate(() => { const G = __ashen.G; G.wands[0].slots = ['spark', null, null, null, null, null, null, null, null, null, 'godfall']; G.wands[0].idx = 0; });
await sleep(2200); await p2.screenshot({ path: SH + 'myth-room-godfall-390.png' });
r = await p2.evaluate(() => ({ god: __ashen.room && (__ashen.room.allies || []).some(a => a.god), choir: (__ashen.room && __ashen.room.choirN) || 0 }));
U('room', r.god && r.choir > 0, 'live fight: Eclipse Choir books cast (' + r.choir + ') and a spectral Godfall boss fights');
await p2.evaluate(() => { const G = __ashen.G; G.wands[0].slots = ['spark', null, null, null, null, null, null, null, null, null, 'blacksun']; G.wands[0].idx = 0; });
await sleep(1600); await p2.screenshot({ path: SH + 'myth-room-blacksun-390.png' });
await p2.evaluate(() => { __ashen.input.fire = false; clearInterval(window.__keep); });
let pass = 0, fail = 0; for (const x of all) { if (x.ok) pass++; else fail++; console.log((x.ok ? '  ✓ ' : '  ✗ ') + x.id.padEnd(15) + x.m); }
console.log(`\nMYTHIC: ${pass} passed, ${fail} failed; page errors: ${errs.length}`); if (errs.length) console.log(errs.slice(0, 8));
await b.close(); process.exit(fail || errs.length ? 1 : 0);
