// Legendary rarity tests: per-card metadata, behaviour sims for all 18 pages (real engine), gold-slot rules (engine + editor DOM),
// drop sources, ?debug=legendary kit, fanfare/flash, sounds, and performance caps under stress.
// usage: node legend-test.mjs [baseUrl]   (default http://localhost:3999)
import { createRequire } from 'module'; const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await pg.goto(base + '/', { timeout: 90000 }); await pg.waitForFunction('window.__ready', { timeout: 90000 }); await pg.click('#go'); await new Promise(r => setTimeout(r, 300));
const out = await pg.evaluate(() => {
  const A = window.__ashen, C = A.CARDS, L = window.__legend, res = [], ok = (id, c, m) => res.push({ id, ok: !!c, m });
  const W = (slots, o = {}) => Object.assign({ name: 't', slots, delay: .2, recharge: .4, maxMana: 900, mana: 900, regen: 300, idx: 0, cd: 0, hue: 30, ornate: true }, o);
  const foe = (x, y, o = {}) => Object.assign({ id: Math.random(), type: 'husk', dummy: true, x, y, hp: 1e9, max: 1e9, spd: 0, r: 14, dmg: 0, burn: 0, poison: 0, hit: 0, t: 0, kx: 0, ky: 0, spawnT: 0, frozen: 0, ember: 1 }, o);
  const weak = (x, y, hp = 5, o = {}) => foe(x, y, Object.assign({ dummy: false, hp, max: hp }, o));
  const world = (foes, o = {}) => Object.assign({ caster: { x: 60, y: 200 }, bounds: { x0: 0, y0: 20, x1: 600, y1: 400 }, foes, shots: [], parts: [], fxs: [], patches: [], dmgMul: 1, eshots: [] }, o);
  const step = (wd, secs, each) => { const fx = new Set(); for (let t = 0; t < secs; t += 1 / 60) { A.updateShots(wd, 1 / 60); for (const f of wd.foes) tickStatus(wd, f, 1 / 60); wd.foes = wd.foes.filter(f => !f.dead); for (const f of wd.fxs) fx.add(f.type); wd.fxs = wd.fxs.filter(f => (f.life -= 1 / 60) > 0); wd.parts = wd.parts.filter(p => (p.life -= 1 / 60) > 0); if (each) each(t); } return fx; };
  const cast = (wd, w, ang = 0) => { wd.curWand = w; w.cd = 0; return A.tryCast(wd, w, wd.caster.x, wd.caster.y - 14, ang, n => { if (wd.caster.hp != null) wd.caster.hp = Math.max(1, wd.caster.hp - n); }); };
  const tk = (wd, f) => f.dmgTaken || 0;
  // ---- metadata ----
  ok('meta', L.LEGENDARY.length === 18 && L.LEG_PROJ.length === 8 && L.LEG_GLYPH.length === 10, '18 Legendary pages (8 attacks, 10 glyphs)');
  for (const id of L.LEGENDARY) {
    const c = C[id];
    ok(id, c && c.leg && c.rar === 4 && c.flav && /Drawback:/.test(c.desc) && c.icon, 'rar 4, flavour line, explicit drawback');
    ok(id, AUD.fx && Object.keys(AUD.fx).some(k => k.startsWith('lg')), 'sound set registered');
    ok(id, !CARD_POOL.includes(id) && !RARE_POOL.includes(id), 'not in the normal page pools (drops only)');
    if (c.t === 'proj') ok(id, c.lgk && c.shape, 'own vector shape ' + c.shape);
  }
  ok('meta', ['lgFanfare', 'lgClaim', 'lgDeny', 'lgToll', 'lgBurn', 'lgCrash', 'lgGulp', 'lgBeam', 'lgEternal', 'lgOssuary', 'lgStarfall', 'lgGlyph', 'lgFracture', 'lgAsh', 'lgRecur', 'lgInvert', 'lgHeretic', 'lgAscend', 'lgFate'].every(k => AUD.fx[k]), 'all Legendary sounds registered');
  ok('meta', document.createElement('div') && cardChip('requiem').includes(' leg') && cardRow('requiem').includes('flav'), 'chip/card get the Legendary class + flavour line');
  // ---- gold slots (engine) ----
  { const plain = W(['spark', 'requiem'], { ornate: false }), first = W(['requiem', 'spark'], { ornate: false }), orn = W(['spark', 'requiem', 'spark'], { ornate: true }), orn3 = W(['spark', 'spark', 'requiem'], { ornate: true });
    ok('gold', L.lgGoldN(plain) === 1 && L.lgGoldN(orn) === 2 && L.lgGold(plain, 0) && !L.lgGold(plain, 1) && L.lgGold(orn, 1) && !L.lgGold(orn, 2), 'ordinary grimoire: 1 gold slot; ornate: 2 (the first slots)');
    const k = w => { const out = []; for (let i = 0; i < 3; i++) { const c = buildCast(w); out.push(...c.shots.map(s => s.p)); w.idx = c.nextIdx; } return out; };
    ok('gold', !k(plain).includes('requiem') && k(first).includes('requiem') && k(orn).includes('requiem') && !k(orn3).includes('requiem'), 'a Legendary outside a gold slot is inert (engine safety net)'); }
  { const w = randomWand(3, true); ok('gold', w.ornate && w.slots.length >= 4 && /Gilded/.test(w.name) && L.lgGoldN(w) >= 2 && L.lgGoldN(w) <= 4 && w.slots.length >= L.lgGoldN(w) + 2 && w.hue === 352, 'ornate grimoires: gilded, ≥4 slots, 2–4 gold slots (' + w.name + ', ' + L.lgGoldN(w) + ' gold)'); }
  { const cnt = { 2: 0, 3: 0, 4: 0 }; let bad = 0; for (let i = 0; i < 3000; i++) { const w = randomWand(1 + i % 6, true), g = L.lgGoldN(w); if (cnt[g] == null || w.slots.length < g + 2) bad++; else cnt[g]++; }
    ok('gold', !bad && cnt[2] > cnt[3] && cnt[3] > cnt[4] && cnt[4] > 0 && cnt[2] / 3000 > .6 && cnt[4] / 3000 < .13, 'ornate gold-slot roll over 3000 grimoires: 2→' + cnt[2] + ', 3→' + cnt[3] + ', 4→' + cnt[4] + ' (2 common, 4 rare; slots ≥ gold+2)');
    let plainBad = 0; for (let i = 0; i < 500; i++) if (L.lgGoldN(randomWand(1 + i % 6, false)) !== 1) plainBad++; ok('gold', !plainBad, 'ordinary grimoires always have exactly 1 gold slot (500 rolled)'); }
  { const w = W(['spark', 'spark'], { ornate: false }), seq = [L.lgGoldN(w)]; let r; while ((r = L.lgBind(w))) seq.push(L.lgGoldN(w)); const o = W(['spark', 'spark', 'spark', 'spark'], { gold: 4 });
    ok('binding', seq.join() === '1,2,3,4' && w.slots.length >= 4 && L.lgBind(w) === false && L.lgBind(o) === false && L.LG_MAXGOLD === 4 && L.lgGoldN(W(['spark'], { gold: 9 })) === 4, 'Gilded Binding: 1→2→3→4 gold slots then refuses (pads slots to ' + w.slots.length + '); never above 4'); }
  { const w4 = W(['requiem', 'starfall', 'cathedralfall', 'abyssalmaw', 'spark', 'saintshalo'], { gold: 4 }), k = w => { const out = []; for (let i = 0; i < 6; i++) { const c = buildCast(w); out.push(...c.shots.map(s => s.p)); w.idx = c.nextIdx; } return out; };
    const ids = JSON.stringify(k(w4)); ok('gold', ['requiem', 'starfall', 'cathedralfall', 'abyssalmaw'].every(x => ids.includes(x)) && !ids.includes('saintshalo'), '4 gold slots: all 4 Legendaries cast; a 5th outside gold is inert');
    __ashen.G.wands = [W(['requiem', 'starfall', 'cathedralfall', null, null, null], { gold: 4 })]; edWand = 0; const bag0 = __ashen.G.bag; __ashen.G.bag = ['abyssalmaw', 'ossuary', null];
    const a = L.lgCheckMove('b:0', 'w:3'); __ashen.G.wands[0].slots[3] = 'abyssalmaw'; const b = L.lgCheckMove('b:1', 'w:4'), c2 = L.lgCheckMove('b:1', 'w:2');
    ok('gold', a === null && b === 'limit' && c2 === null, '4th Legendary into gold slot 4 allowed; a 5th refused (limit); swapping into an occupied gold slot allowed'); __ashen.G.bag = bag0; }
  // ---- attacks ----
  { const wd = world([foe(150, 214), foe(400, 300), foe(520, 120)]), w = W(['requiem']); const c1 = cast(wd, w); let blocked = 0; step(wd, 1.2); w.cd = 0; if (!cast(wd, w)) blocked = 1; step(wd, 2.4);
    const hits = wd.foes.map(f => Math.round(tk(wd, f)));
    ok('requiem', c1 && hits.every(h => Math.abs(h - 78) < 1), 'tolls 3 times, each toll hits every foe on screen (' + hits.join('/') + ' = 3×26)');
    ok('requiem', blocked && C.requiem.delay >= 2, "drawback: can't cast while it rings; 2.2s recharge"); }
  { const wd = world([foe(200, 214)]), w1 = W(['heavy', 'heavy', 'fireball'], { ornate: false }); cast(wd, w1); const best = wd.lpBest; step(wd, .1);
    const w2 = W(['lastpage', 'spark']); wd.shots = []; cast(wd, w2); const cp = wd.shots.find(s => s.kind === 'fireball');
    ok('lastpage', best && best.spec.p === 'fireball' && cp && cp.dmg >= best.dmg - .01, 'copies the strongest spell cast so far (fireball ' + (cp && cp.dmg.toFixed(1)) + ' dmg)');
    ok('lastpage', w2.slots[0] === null, 'drawback: the page burns up after one use'); }
  { const wd = world([foe(250, 214), weak(330, 240, 1e6)]), w = W(['cathedralfall']); cast(wd, w); const fx = step(wd, 1.4);
    ok('cathedralfall', tk(wd, wd.foes[0]) >= 48 && (wd.walls || []).length === 4 && fx.has('quake'), 'spire falls on the target, leaves 4 rubble walls (' + (wd.walls || []).length + ')');
    const wl = wd.walls[0]; const s = spawnShot(Object.assign(wd, { curWand: W(['spark']) }), { p: 'spark', mods: [] }, wl.x - 60, wl.y - 8, 0); step(wd, .5);
    ok('cathedralfall', s.blocked, 'drawback: rubble blocks your own spells');
    const g = weak(wl.x + 2, wl.y, 1e6, { spd: 0 }); wd.foes.push(g); step(wd, 1 / 30); ok('cathedralfall', Math.hypot(g.x - wl.x, g.y - wl.y) >= wl.r, 'rubble blocks enemies (pushed out)'); }
  { const small = weak(200, 214, 30), boss = foe(205, 214, { boss: true, r: 30 }), wd = world([small, boss]), w = W(['abyssalmaw']); cast(wd, w); step(wd, 2);
    ok('abyssalmaw', small.dead && small.swallowed, 'swallows small enemies whole'); ok('abyssalmaw', !boss.swallowed && tk(wd, boss) > 0, 'gnaws on big ones instead (' + Math.round(tk(wd, boss)) + ')');
    const me = { x: 60, y: 200, hp: 50, maxHp: 50 }, wd2 = world([foe(200, 214)], { caster: me }); cast(wd2, W(['abyssalmaw'])); ok('abyssalmaw', me.hp === 47, 'drawback: costs 3 HP (50→' + me.hp + ')'); }
  { const me = { x: 60, y: 200, hp: 50, maxHp: 50 }, atk = foe(120, 214), idle = foe(300, 214), wd = world([atk, idle], { caster: me }); cast(wd, W(['saintshalo'])); atk.wind = .4; step(wd, .6, () => { atk.wind = .4; });
    ok('saintshalo', tk(wd, atk) > 0 && tk(wd, idle) === 0, 'beams only the enemy that attacks you (' + Math.round(tk(wd, atk)) + ' vs 0)');
    const sp = spawnShot(Object.assign(wd, { curWand: W(['spark']) }), { p: 'spark', mods: [] }, 0, 0, 0); ok('saintshalo', Math.abs(lgHitMul(wd, sp, idle) - .7) < 1e-9, 'drawback: other spells deal −30% while it shines'); }
  { const wd = world([foe(560, 380)]), w = W(['eternalflame']); cast(wd, w, .7); const m0 = w.mana; step(wd, 6); const e = wd.shots.filter(s => s.kind === 'eternalflame');
    ok('eternalflame', e.length === 1 && e[0].age > 5.9 && e[0].bounce > 1e5, 'never expires, bounces around the room (age ' + e[0].age.toFixed(1) + 's)');
    ok('eternalflame', w.mana < m0 - 15, 'drawback: drains mana while it burns (' + Math.round(m0 - w.mana) + ' over 6s)');
    w.cd = 0; cast(wd, w); step(wd, 1 / 60); ok('eternalflame', wd.shots.filter(s => s.kind === 'eternalflame').length === 1, 'only one can exist (recast replaces it)'); }
  { const wd = world([weak(120, 214, 1), weak(140, 230, 1), foe(300, 214)]); wd.curWand = W(['spark']); killFoe(wd, wd.foes[0]); killFoe(wd, wd.foes[1]); wd.foes = wd.foes.filter(f => !f.dead); step(wd, .5);
    cast(wd, W(['ossuary'])); ok('ossuary', (wd.allies || []).length === 2, 'raises skeletons from enemies killed in the last 5s (' + (wd.allies || []).length + ')');
    step(wd, 4); ok('ossuary', tk(wd, wd.foes[0]) > 0, 'skeleton allies fight (' + Math.round(tk(wd, wd.foes[0])) + ' dmg)');
    const wd2 = world([foe(300, 214)]); const fx = (cast(wd2, W(['ossuary'])), new Set(wd2.fxs.map(f => f.type))); ok('ossuary', !(wd2.allies || []).length && fx.has('fizzle'), 'drawback: fizzles with no recent deaths');
    const v = weak(200, 200, 1); v.skelKill = true; killFoe(world([v]), v); ok('ossuary', v.skelKill, 'drawback: skeleton kills drop no embers (flag)'); }
  { const me = { x: 100, y: 200, hp: 50, maxHp: 50 }, wd = world([foe(300, 214), foe(400, 300)], { caster: me }), w = W(['starfall']); cast(wd, w); step(wd, 1); w.cd = 0; const blk = !cast(wd, w); step(wd, 1); me.x += 40; step(wd, 2);
    ok('starfall', blk, "drawback: can't cast while charging"); ok('starfall', wd.foes.some(f => tk(wd, f) > 0), 'moving after a 2s charge releases the meteors');
    const me3 = { x: 100, y: 200 }, wd3 = world([foe(300, 214)], { caster: me3 }); cast(wd3, W(['starfall'])); step(wd3, .2); me3.x += 50; const fx3 = step(wd3, 1);
    const full = []; { const me4 = { x: 100, y: 200 }, wd4 = world([foe(300, 214)], { caster: me4 }); cast(wd4, W(['starfall'])); let rel = null; step(wd4, 3.3, () => { const s = wd4.shots.find(q => q.kind === 'starfall'); if (s && s.meteors && !rel) rel = s.meteors; }); full.push(rel); step(wd4, 3); full.push(Math.round(tk(wd4, wd4.foes[0]))); }
    const half = []; { const me5 = { x: 100, y: 200 }, wd5 = world([foe(300, 214)], { caster: me5 }); cast(wd5, W(['starfall'])); let rel = null; step(wd5, 1.05); me5.x += 30; step(wd5, .2, () => { const s = wd5.shots.find(q => q.kind === 'starfall'); if (s && s.meteors && !rel) rel = s.meteors; }); half.push(rel); }
    ok('starfall', full[0] === 10 && half[0] >= 3 && half[0] < full[0] && full[1] > 0, 'meteors scale with charge (1s → ' + half[0] + ', 3s → ' + full[0] + ' meteors, ' + full[1] + ' dmg)');
    ok('starfall', fx3.has('fizzle'), 'drawback: moving in the first half-second breaks the rite'); }
  return { res };
});
const out2 = await pg.evaluate(() => {
  const A = window.__ashen, C = A.CARDS, L = window.__legend, res = [], ok = (id, c, m) => res.push({ id, ok: !!c, m });
  const W = (slots, o = {}) => Object.assign({ name: 't', slots, delay: .2, recharge: .4, maxMana: 900, mana: 900, regen: 300, idx: 0, cd: 0, hue: 30, ornate: true }, o);
  const foe = (x, y, o = {}) => Object.assign({ id: Math.random(), type: 'husk', dummy: true, x, y, hp: 1e9, max: 1e9, spd: 0, r: 14, dmg: 0, burn: 0, poison: 0, hit: 0, t: 0, kx: 0, ky: 0, spawnT: 0, frozen: 0, ember: 1 }, o);
  const weak = (x, y, hp = 5, o = {}) => foe(x, y, Object.assign({ dummy: false, hp, max: hp }, o));
  const world = (foes, o = {}) => Object.assign({ caster: { x: 60, y: 200 }, bounds: { x0: 0, y0: 20, x1: 600, y1: 400 }, foes, shots: [], parts: [], fxs: [], patches: [], dmgMul: 1, eshots: [] }, o);
  const seenK = new WeakSet();
  const step = (wd, secs, each, cnt) => { const fx = new Set(); for (let t = 0; t < secs; t += 1 / 60) { A.updateShots(wd, 1 / 60); if (cnt) for (const s of wd.shots) if (!seenK.has(s)) { seenK.add(s); cnt(s); } for (const f of wd.foes) tickStatus(wd, f, 1 / 60); wd.foes = wd.foes.filter(f => !f.dead); for (const f of wd.fxs) fx.add(f.type); wd.fxs = wd.fxs.filter(f => (f.life -= 1 / 60) > 0); wd.parts = wd.parts.filter(p => (p.life -= 1 / 60) > 0); if (each) each(t); } return fx; };
  const cast = (wd, w, ang = 0) => { wd.curWand = w; w.cd = 0; const r = A.tryCast(wd, w, wd.caster.x, wd.caster.y - 14, ang, n => { if (wd.caster.hp != null) wd.caster.hp = Math.max(1, wd.caster.hp - n); }); return r; };
  const tk = f => f.dmgTaken || 0;
  // glyphs attach to the next attack + carry their overlay bit
  for (const id of L.LEG_GLYPH) { const c = buildCast(W([id, 'spark'])); const s = spawnShot(world([], { curWand: W(['spark']) }), c.shots[0], 0, 0, 0); ok(id, c.shots[0].p === 'spark' && c.shots[0].mods.includes(id) && (s.lv & L.LVB[id]), 'attaches to the next attack; Legendary overlay bit ' + L.LVB[id]); }
  { const wd = world([]); let n = 0, maxD = 0; cast(wd, W(['recursion', 'fireball'])); step(wd, 6, null, s => { if (s.kind === 'fireball') { n++; maxD = Math.max(maxD, s.recur || 0); } });
    ok('recursion', n >= 3 && maxD <= L.LCAP.recur() && maxD >= 2, 'recasts itself at half strength (' + n + ' casts, depth ' + maxD + ', cap ' + L.LCAP.recur() + ')');
    ok('recursion', Math.abs(buildCast(W(['recursion', 'spark'])).delay - (C.spark.delay || 0) - .6) < 1e-6, 'drawback: +0.6s cast delay'); }
  { const c = buildCast(W(['martyrdom', 'fireball'])); ok('martyrdom', c.mana === 0 && c.flame >= Math.ceil(C.fireball.mana / 6), 'costs flame instead of mana (' + c.flame + ' HP, 0 mana)');
    const hi = { x: 0, y: 0, hp: 50, maxHp: 50 }, lo = { x: 0, y: 0, hp: 20, maxHp: 50 }; const sp = { p: 'spark', mods: ['martyrdom'], off: 0 };
    const a = spawnShot(world([], { caster: hi, curWand: W([]) }), sp, 0, 0, 0).dmg, b2 = spawnShot(world([], { caster: lo, curWand: W([]) }), sp, 0, 0, 0).dmg; ok('martyrdom', Math.abs(b2 / a - 3) < 1e-6, 'triple damage below half flame (' + a + ' → ' + b2 + ')');
    const me = { x: 60, y: 200, hp: 50, maxHp: 50 }, wd = world([foe(300, 214)], { caster: me }); cast(wd, W(['martyrdom', 'fireball'])); ok('martyrdom', me.hp < 50, 'drawback: paid from your own flame (50 → ' + me.hp + ')'); }
  { const f1 = foe(100, 200), f2 = foe(200, 200), f3 = foe(300, 200), wd = world([f1, f2, f3], { curWand: W([]) }); const s = spawnShot(wd, { p: 'spark', mods: ['fatebinding'], off: 0 }, 0, 186, 0);
    onHit(wd, s, f1); onHit(wd, s, f2); const before = tk(f1); onHit(wd, s, f3);
    ok('fatebinding', tk(f1) - before > s.dmg * .55 && tk(f2) > s.dmg, 'damage is shared between every foe the spell hit (' + (tk(f1) - before).toFixed(1) + ' echoed to the 1st foe)');
    ok('fatebinding', Math.abs(s.dmg / C.spark.dmg - .65) < 1e-6 && spawnShot(wd, { p: 'spark', mods: ['fatebinding'], off: 0 }, 0, 186, 0).pierce >= 2, 'drawback: −35% direct damage (pierces +2)'); }
  { const wd = world([foe(500, 186)]); let n = 0, orig = null; cast(wd, W(['timefracture', 'spark'])); orig = wd.shots[0]; const fx = step(wd, 4, null, s => { if (s.kind === 'spark') n++; });
    ok('timefracture', n === 4 && fx.has('tfreeze') && fx.has('tshatter') && fx.has('tfreplay'), 'freezes, then replays 3 times from that spot (' + (n - 1) + ' replays)');
    ok('timefracture', orig.hit.length === 0 && tk(wd.foes[0]) > 0, 'drawback: the frozen original deals no damage (replays hit for ' + Math.round(tk(wd.foes[0])) + ')'); }
  { const fs = Array.from({ length: 6 }, (_, i) => weak(120 + i * 12, 186, 1)); fs.push(foe(400, 186)); const me = { x: 60, y: 200 }, wd = world(fs, { caster: me }), w = W(['ascension', 'spark']); const d0 = (cast(wd, w), wd.shots[0].dmg);
    for (let i = 0; i < 40; i++) { step(wd, .1); cast(wd, w); } const v = wd.asc && wd.asc.get(me); const d1 = wd.shots.filter(s => s.kind === 'spark').pop().dmg;
    ok('ascension', v >= 5 && d1 > d0 * 1.5, 'grows +12% per kill for the room (' + v + ' kills: ' + d0.toFixed(1) + ' → ' + d1.toFixed(1) + ')');
    ok('ascension', Math.abs(d0 / C.spark.dmg - .6) < 1e-6, 'drawback: starts at −40%'); }
  { const me = { x: 60, y: 200, face: 0 }, wd = world([], { caster: me }); cast(wd, W(['soulbound', 'longglyph', 'fireball']), 0); const s = wd.shots[0]; me.face = Math.PI / 2; step(wd, .4); const ang = Math.atan2(s.vy, s.vx);
    const x0 = s.x; me.x += 20; step(wd, 1 / 60);
    ok('soulbound', Math.abs(ang - Math.PI / 2) < .2 && s.x - x0 > 10, 'steers with your aim (' + ang.toFixed(2) + ' rad) and drifts with your movement [life ' + s.life.toFixed(2) + ' dx ' + (s.x - x0).toFixed(1) + ' y ' + s.y.toFixed(0) + ']');
    me.lgHurtN = 1; const fx = step(wd, 1 / 30); ok('soulbound', s.life <= 0 && fx.has('soulbreak'), 'drawback: shatters when you are hurt'); }
  { const a = weak(100, 200, 1e6, { spd: 50 }), b2 = weak(160, 200, 1e6), bs = weak(300, 200, 1e6, { boss: true }), wd = world([a, b2, bs], { curWand: W([]) }); const s = spawnShot(wd, { p: 'spark', mods: ['hereticmark'], off: 0 }, 0, 186, 0); onHit(wd, s, a); s.hit.length = 0; s.pierce = 9; onHit(wd, s, bs);
    const r0 = room; let tgt, hurt; try { room = wd; tgt = foeTarget(a); hurtTarget(b2, 10); hurt = tk(b2); } finally { room = r0; }
    ok('hereticmark', a.heretic === 3 && bs.heretic === 1 && tgt === b2 && hurt >= 10, 'marked foes fight each other for 3s (bosses 1s); melee lands on the other foe');
    for (let t = 0; t < 3.05; t += 1 / 60) tickStatus(wd, a, 1 / 60); ok('hereticmark', a.rage > 0 && Math.abs(a.spd - 65) < 1e-6, 'drawback: they come back enraged (+30% speed)');
    for (let t = 0; t < 2.1; t += 1 / 60) tickStatus(wd, a, 1 / 60); ok('hereticmark', !(a.rage > 0) && Math.abs(a.spd - 50) < 1e-6, 'rage wears off after 2s'); }
  { const f = foe(100, 200), wd = world([f], { curWand: W([]) }), me = { x: 60, y: 200, hp: 30, maxHp: 50 }; wd.caster = me; const s = spawnShot(wd, { p: 'spark', mods: ['inversion'], off: 0 }, 0, 186, 0); onHit(wd, s, f);
    hurtTarget(me, 10); ok('inversion', me.invertT > 0 && me.hp === 40, 'damage taken heals you for 2s after a hit (30 → ' + me.hp + ')');
    step(wd, 2.1); ok('inversion', me.exposeT > 0, 'drawback: exposed afterwards (+50% damage taken for 1.5s)');
    const r0 = room, m0 = A.mode; let dd = 0; try { room = Object.assign(world([]), { drops: [], wisps: [] }); mode = 'room'; P.inv = 0; P.dodgeT = 0; P.exposeT = 1; const f0 = G.flame; hurtTarget(P, 10); dd = f0 - G.flame; G.flame = f0; } finally { P.exposeT = 0; P.inv = 0; room = r0; mode = m0; }
    ok('inversion', Math.abs(dd - 15) < 1e-6, 'exposure: a 10 hit deals ' + dd); }
  { const w = W(['grimoireecho', 'ice', 'spark']), wd = world([foe(400, 186)]); cast(wd, w); const ice = wd.shots[0]; cast(wd, w); const sp = wd.shots.find(s => s.kind === 'spark');
    ok('grimoireecho', sp && sp.freeze && sp.echoed === 'ice' && (sp.lv & L.LVB.grimoireecho), 'the next page also gets the effects (spark freezes like Ice)');
    ok('grimoireecho', Math.abs(ice.dmg / C.ice.dmg - .7) < 1e-6, 'drawback: −30% damage on the echoing spell'); }
  { const fs = []; for (let i = 0; i < 14; i++) fs.push(weak(140 + (i % 5) * 30, 150 + Math.floor(i / 5) * 40, 1)); const wd = world(fs); let n = 0, maxD = 0; cast(wd, W(['crownedash', 'spark']), Math.atan2(150 - 186, 140 - 60)); const fx = step(wd, 3, null, s => { if (s.kind === 'spark') { n++; maxD = Math.max(maxD, s.ash || 0); } });
    ok('crownedash', n > 3 && fx.has('ashburst') && maxD <= L.LCAP.ash(), 'kills explode into copies of the spell (' + n + ' sparks, chain depth ' + maxD + '/' + L.LCAP.ash() + ')');
    ok('crownedash', Math.abs(spawnShot(world([], { curWand: W([]) }), { p: 'spark', mods: ['crownedash'], off: 0 }, 0, 0, 0).dmg / C.spark.dmg - .6) < 1e-6, 'drawback: −40% damage'); }
  // ---- performance caps (phones) ----
  const perf = [];
  for (const q of ['high', 'low']) {
    const q0 = QUAL.parts; QUAL.parts = q;
    try {
      const fs = () => Array.from({ length: 40 }, (_, i) => weak(120 + (i % 10) * 45, 60 + Math.floor(i / 10) * 80, 1));
      const wd = world(fs()), w = W(['crownedash', 'recursion', 'double', 'spark', 'spark'], { delay: .05, recharge: .1 }); let maxS = 0, maxD = 0, maxR = 0, t0 = performance.now(), frames = 0;
      for (let k = 0; k < 300; k++) { if (w.cd <= 0) cast(wd, w, (k * .37) % 6.28); w.cd -= 1 / 60; step(wd, 1 / 60); frames++; maxS = Math.max(maxS, wd.shots.length); for (const s of wd.shots) { maxD = Math.max(maxD, s.ash || 0); maxR = Math.max(maxR, s.recur || 0); } if (wd.foes.length < 10) wd.foes.push(...fs()); }
      const ms = (performance.now() - t0) / frames;
      const wd2 = world([foe(300, 200)]); for (let i = 0; i < 30; i++) lgDeath(wd2, { x: 100 + i * 5, y: 200 }); for (let i = 0; i < 5; i++) { cast(wd2, W(['ossuary'])); }
      perf.push(q + ': max ' + maxS + ' live spells, ash depth ' + maxD + ', recursion ' + maxR + ', ' + (wd2.allies || []).length + ' skeletons, ' + ms.toFixed(2) + ' ms/sim-frame');
      ok('perf', maxS <= 220 && maxD <= L.LCAP.ash() && maxR <= L.LCAP.recur() && (wd2.allies || []).length <= L.LCAP.allies(), 'caps hold under stress [' + perf[perf.length - 1] + ']');
      // 4 Legendaries stacked in one 4-gold grimoire (glyph-heavy and attack-heavy), 40 foes, 10 s of sim
      for (const [tag, st] of [['4 glyphs', ['recursion', 'crownedash', 'grimoireecho', 'timefracture', 'double', 'spark', 'spark']], ['4 attacks', ['starfall', 'cathedralfall', 'requiem', 'ossuary', 'spark']]]) {
        const w4 = W(st, { gold: 4, delay: .05, recharge: .1 }), wd4 = world(fs()); let mS = 0, mD = 0, mR = 0, mF = 0, mA = 0; const t1 = performance.now(); let fr = 0;
        for (let k = 0; k < 600; k++) { if (w4.cd <= 0) cast(wd4, w4, (k * .37) % 6.28); w4.cd -= 1 / 60; step(wd4, 1 / 60); fr++; mS = Math.max(mS, wd4.shots.length); mF = Math.max(mF, wd4.fxs.length); mA = Math.max(mA, (wd4.allies || []).length); for (const s of wd4.shots) { mD = Math.max(mD, s.ash || 0); mR = Math.max(mR, s.recur || 0); } if (wd4.foes.length < 10) wd4.foes.push(...fs()); }
        const ms4 = (performance.now() - t1) / fr; perf.push(q + ' ' + tag + ': max ' + mS + ' spells, ' + mF + ' fx, ' + mA + ' allies, ash ' + mD + ', recursion ' + mR + ', ' + ms4.toFixed(2) + ' ms/sim-frame');
        ok('perf', mS <= 220 && mD <= L.LCAP.ash() && mR <= L.LCAP.recur() && mA <= L.LCAP.allies() && ms4 < 8, '4 stacked Legendaries — caps hold [' + perf[perf.length - 1] + ']');
      }
    } finally { QUAL.parts = q0; }
  }
  return { res, perf };
});
let pass = 0, fail = 0; for (const r of out.res.concat(out2.res)) { if (r.ok) pass++; else fail++; console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.id.padEnd(15) + r.m); }
console.log('perf:', out2.perf.join(' | '));
console.log(`\nENGINE: ${pass} passed, ${fail} failed; page errors: ${errs.length}`); if (errs.length) console.log(errs.slice(0, 8));

// ---------- UI: gold slots in the editor, drops, fanfare/flash, debug kit ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ui = [], U = (id, c, m) => ui.push({ id, ok: !!c, m });
await pg.evaluate(() => { const A = __ashen; A.G.wands = [makeWand({ name: 'Two-Leaf Plain Tome', slots: ['spark', null, null, null, null], delay: .2, recharge: .4, maxMana: 200, mana: 200, regen: 50 })]; A.G.active = 0; A.G.bag = ['requiem', 'starfall', 'heavy', null, null, null, null, null]; edWand = 0; editor(); });
await sleep(200);
let r = await pg.evaluate(() => ({ gold: document.querySelectorAll('#wslots .slot.gold').length, note: (document.querySelector('.goldnote') || {}).textContent, chip: !!document.querySelector('.chip.leg') }));
U('editor', r.gold === 1 && /holds 1/.test(r.note) && r.chip, 'ordinary grimoire shows 1 ♛ gold slot + note; Legendary chips have the animated border');
// real pointer drag: Requiem from the bag onto a non-gold slot
const box = async sel => { const e = await pg.$(sel); const bb = await e.boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
{ const [x0, y0] = await box('[data-loc="b:0"] .chip'), [x1, y1] = await box('[data-loc="w:2"]');
  await pg.mouse.move(x0, y0); await pg.mouse.down(); for (let i = 1; i <= 8; i++) await pg.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await pg.mouse.up(); await sleep(60);
  r = await pg.evaluate(() => ({ n: window.__lgDenied || 0, msg: window.__lgDenyMsg, shake: !!document.querySelector('[data-loc="w:2"].shake.deny'), pulse: document.querySelectorAll('.slot.gold.pulse').length, info: (document.getElementById('info') || {}).textContent, toast: document.getElementById('toast') ? document.getElementById('toast').textContent : '', slot: __ashen.G.wands[0].slots[2] }));
  U('editor', r.n === 1 && /gold slots/.test(r.msg) && r.shake && r.pulse === 1 && r.slot === null, 'drag onto a normal slot is refused: shake + red outline, gold slot pulses, message "' + r.msg + '"'); }
await pg.screenshot({ path: '/workspace/ashen-shots/lg-editor-deny-390.png' });
r = await pg.evaluate(() => { moveCard('b:0', 'w:0'); const ok1 = __ashen.G.wands[0].slots[0] === 'requiem'; moveCard('b:1', 'w:3'); return { ok1, n: window.__lgDenied, msg: window.__lgDenyMsg, s3: __ashen.G.wands[0].slots[3] }; });
U('editor', r.ok1 && r.n === 2 && /only 1 Legendary/.test(r.msg) && r.s3 === null, 'gold slot accepts it; a 2nd Legendary is refused: "' + r.msg + '"');
await pg.evaluate(() => { const w = lgOrnate(makeWand({ name: 'Four-Leaf Codex', slots: ['requiem', null, 'spark', null, null, null], delay: .2, recharge: .4, maxMana: 200, mana: 200, regen: 50 }), 2); __ashen.G.wands = [w]; __ashen.G.bag = ['starfall', 'timefracture', 'abyssalmaw', 'heavy', null, null, null, null]; editor(); });
await sleep(150);
r = await pg.evaluate(() => { const gold = document.querySelectorAll('#wslots .slot.gold').length, orn = !!document.querySelector('#wslots.ornate'), note = document.querySelector('.goldnote').textContent; moveCard('b:1', 'w:1'); const ok2 = __ashen.G.wands[0].slots[1] === 'timefracture'; moveCard('b:2', 'w:3'); return { gold, orn, note, ok2, msg: window.__lgDenyMsg, s3: __ashen.G.wands[0].slots[3] }; });
U('editor', r.gold === 2 && r.orn && /holds 2/.test(r.note) && r.ok2 && /only 2/.test(r.msg) && r.s3 === null, 'ornate grimoire: 2 gold slots hold 2 Legendaries; a 3rd is refused ("' + r.msg + '")');
await sleep(700); await pg.screenshot({ path: '/workspace/ashen-shots/lg-editor-ornate-390.png' });
r = await pg.evaluate(() => { const c = buildCast(Object.assign({}, __ashen.G.wands[0], { idx: 0 })); return c.shots.map(s => s.p + '[' + s.mods.join(',') + ']').join(' '); });
U('editor', /requiem\[\]/.test(r) || /requiem/.test(r), 'cast from the ornate grimoire uses its gold-slot Legendaries (' + r + ')');
// drops
r = await pg.evaluate(() => { const a0 = AUD.state().played, r0 = window.__lgReveals || 0; reward('Test drop', 1, { leg: 1, orn: 1 }); return { leg: document.querySelectorAll('.card.leg').length, orn: document.querySelectorAll('.card.ornate').length, rev: (window.__lgReveals || 0) - r0, flash: !!document.querySelector('#lgflash.on'), aud: AUD.state(), a0 }; });
U('drops', r.leg >= 1 && r.orn === 1, 'reward with a Legendary + ornate grimoire renders gold/crimson cards');
U('drops', r.rev >= 1 && r.flash, 'drop fanfare + screen flash fire (audio ctx ' + r.aud.ctx + ', ' + (r.aud.played - r.a0) + ' sounds played)');
await sleep(120); await pg.screenshot({ path: '/workspace/ashen-shots/lg-reward-flash-390.png' }); await sleep(900); await pg.screenshot({ path: '/workspace/ashen-shots/lg-reward-390.png' });
r = await pg.evaluate(() => { const r0 = window.__lgReveals; const c = document.querySelector('.card.leg'); const id = [...document.querySelectorAll('.cards .card')].indexOf(c); c.click(); return { rev: window.__lgReveals - r0, bag: __ashen.G.bag.filter(x => x && CARDS[x].leg).length + __ashen.G.wands.flatMap(w => w.slots).filter(x => x && CARDS[x].leg).length }; });
U('drops', r.rev === 1 && r.bag >= 4, 'claiming it plays the claim fanfare and adds the page');
r = await pg.evaluate(() => { const G = __ashen.G; G.floor = 4 + 4; G.step = 0; bossDown(); const t = document.querySelector('.panel h2, .panel h1'); return { title: t && t.textContent, leg: document.querySelectorAll('.card.leg').length }; });
U('drops', /Depth 5 milestone/.test(r.title) && r.leg >= 1, 'Endless depth 5 boss: guaranteed Legendary ("' + r.title + '")');
r = await pg.evaluate(() => { const G = __ashen.G; G.floor = 1; const tries = { a: 0, m: 0, e: 0 }; let a = '', al = 0, m = 0, e = 0, eo = 0;
  for (; tries.a < 500 && !/Gilded/.test(a); tries.a++) { shrine(); a = document.querySelector('.panel h2').textContent; al = document.querySelectorAll('.card.leg').length; }
  for (; tries.m < 800 && !m; tries.m++) { merchant(); m = document.querySelectorAll('.card.ornate').length; }
  for (; tries.e < 1500 && !(e && eo); tries.e++) { roomCleared('elite'); e = e || document.querySelectorAll('.card.leg').length; eo = eo || document.querySelectorAll('.card.ornate').length; }
  return { a, al, m, e, eo, tries }; });
U('drops', /Gilded Reliquary/.test(r.a) && r.al === 1, 'rare altar offers a Legendary for max HP (appeared after ' + r.tries.a + ' altars)');
U('drops', r.m === 1, 'merchants very rarely sell an ornate grimoire (after ' + r.tries.m + ' merchants)');
U('drops', r.e >= 1 && r.eo === 1, 'elites can drop Legendaries and ornate grimoires (both seen within ' + r.tries.e + ' elite rewards)');
r = await pg.evaluate(() => { const n = 4000, r0 = rng; let leg = 0; try { rng = Math.random; for (let i = 0; i < n; i++) { if (Math.random() < .05) leg++; } } finally { rng = r0; } return CARD_POOL.some(id => CARDS[id].leg) ? -1 : leg; });
U('drops', r >= 0, 'Legendaries never appear in ordinary rewards (absent from the page pools)');
// Gilded Binding at the altar and the merchant
r = await pg.evaluate(() => { const G = __ashen.G; G.wands = [makeWand({ name: 'Plain', slots: ['spark', null, null], delay: .2, recharge: .4, maxMana: 200, mana: 200, regen: 50 })]; G.active = 0; G.maxFlame = 100; G.flame = 90; G.step = 2; let t = 0; for (; t < 400 && !document.getElementById('bind'); t++) shrine();
  const found = !!document.getElementById('bind'), txt = found && document.getElementById('bind').textContent; const mf = G.maxFlame; if (found) document.getElementById('bind').click(); return { t, found, txt, gold: lgGoldN(G.wands[0]), dmf: mf - G.maxFlame, mode }; });
U('binding', r.found && r.gold === 2 && r.dmf === 8, 'altars sometimes offer a Gilded Binding (seen after ' + r.t + ' altars): "' + r.txt + '" → 2 gold slots, −8 max HP');
r = await pg.evaluate(() => { const G = __ashen.G; G.wands = [makeWand({ name: 'Tome A', slots: ['spark', null, null], delay: .2, recharge: .4, maxMana: 200, mana: 200, regen: 50 }), Object.assign(makeWand({ name: 'Codex B', slots: ['spark', null, null, null, null, null], delay: .2, recharge: .4, maxMana: 200, mana: 200, regen: 50 }), { ornate: true, gold: 4 })]; G.flame = 95; G.maxFlame = 100; let t = 0;
  for (; t < 400 && !document.getElementById('buyB'); t++) merchant(); const found = !!document.getElementById('buyB'), dis = found && document.getElementById('buyB').disabled; if (found) document.getElementById('buyB').click();
  const pick = !!document.getElementById('bw0'), b1dis = !!(document.getElementById('bw1') || {}).disabled; if (pick) document.getElementById('bw0').click();
  return { t, found, dis, pick, b1dis, gold: lgGoldN(G.wands[0]), hp: G.flame, back: !!document.getElementById('buyW') || !!document.getElementById('leave'), gone: !document.getElementById('buyB') }; });
U('binding', r.found && !r.dis && r.pick && r.b1dis && r.gold === 2 && r.hp === 65 && r.gone, 'merchants sometimes sell a Gilded Binding (after ' + r.t + '): grimoire picker (4-gold one disabled) → +1 gold slot, −30 HP, item sold');
await pg.screenshot({ path: '/workspace/ashen-shots/lg-merchant-after-binding-390.png' });
// ?debug=legendary
const p2 = await b.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message)); p2.on('console', m => m.type() === 'error' && e2.push(m.text()));
await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p2.goto(base + '/?debug=legendary'); await p2.waitForFunction('window.__ready'); await p2.click('#go'); await sleep(300);
r = await p2.evaluate(() => { const G = __ashen.G, all = G.wands.flatMap(w => w.slots).concat(G.bag).filter(x => x && CARDS[x].leg); return { n: new Set(all).size, orn: G.wands[0].ornate, gold: lgGoldN(G.wands[0]), four: G.wands[0].slots.slice(0, 4).filter(x => x && CARDS[x].leg).length }; });
U('debug', r.n === 18 && r.orn && r.gold === 4 && r.four === 4, '?debug=legendary gives all 18 Legendaries + a 4-gold-slot ornate grimoire with 4 Legendaries stacked');
await p2.evaluate(() => { edWand = 0; editor(showMap); }); await sleep(300);
r = await p2.evaluate(() => ({ gold: document.querySelectorAll('#wslots .slot.gold').length, legIn: document.querySelectorAll('#wslots .slot.gold .chip.leg').length, note: document.querySelector('.goldnote').textContent, burn: !!document.getElementById('burnzone'), over: (() => { const d = document.getElementById('ui'); return d.scrollWidth > d.clientWidth + 1; })() }));
U('debug', r.gold === 4 && r.legIn === 4 && /holds 4/.test(r.note) && /maximum/.test(r.note) && r.burn && !r.over, 'debug editor: 4 ♛ gold slots filled with Legendaries, note "' + r.note + '", brazier shown, no horizontal overflow');
await p2.screenshot({ path: '/workspace/ashen-shots/lg-editor-gold4-390.png' });
r = await p2.evaluate(() => { moveCard('b:0', 'w:4'); return window.__lgDenyMsg; });
U('debug', /only 4 Legendary/.test(r) && /4 is the most/.test(r), 'a 5th Legendary in a 4-gold grimoire is refused: "' + r + '"');
await p2.close();
let up = 0, uf = 0; for (const x of ui) { if (x.ok) up++; else uf++; console.log((x.ok ? '  ✓ ' : '  ✗ ') + x.id.padEnd(15) + x.m); }
console.log(`UI: ${up} passed, ${uf} failed; page errors: ${errs.length + e2.length}`); if (errs.length + e2.length) console.log(errs.concat(e2).slice(0, 8));
console.log(`\nTOTAL: ${pass + up} passed, ${fail + uf} failed`);
await b.close();
process.exit(fail + uf || errs.length + e2.length ? 1 : 0);
