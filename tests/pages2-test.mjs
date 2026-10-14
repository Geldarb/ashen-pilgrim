// Unit-style cast-resolution + behaviour tests for the 26 Expansion II pages (real engine, headless page, no DOM preview).
// usage: node pages2-test.mjs [baseUrl]   (default http://localhost:3999 — run `PORT=3999 node server.js` first)
import { createRequire } from 'module'; const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
await pg.goto(base + '/', { timeout: 90000 }); await pg.waitForFunction('window.__ready', { timeout: 90000 }); await pg.click('#go');
const out = await pg.evaluate(() => {
  const A = window.__ashen, C = A.CARDS, res = [], ok = (id, c, m) => res.push({ id, ok: !!c, m });
  const W = (slots, o = {}) => Object.assign({ name: 't', slots, delay: .2, recharge: .4, maxMana: 400, mana: 400, regen: 60, idx: 0, cd: 0, hue: 30 }, o);
  const foe = (x, y, o = {}) => Object.assign({ id: Math.random(), type: 'husk', dummy: true, x, y, hp: 1e9, max: 1e9, spd: 0, r: 14, dmg: 0, burn: 0, poison: 0, hit: 0, t: 0, kx: 0, ky: 0, spawnT: 0, frozen: 0 }, o);
  const world = (foes, o = {}) => Object.assign({ caster: { x: 60, y: 200 }, bounds: { x0: 0, y0: 20, x1: 600, y1: 400 }, foes, shots: [], parts: [], fxs: [], patches: [], dmgMul: 1, eshots: [] }, o);
  // step the world; optionally auto-cast; records spawns per kind and observations
  function sim(w, secs, wd, o = {}) {
    wd = wd || world([foe(170, 214)]); const seen = {}, ws = new WeakSet(), fxs = new Set(), obs = { maxR: {}, host: false, maxWz: 0, ys: [], stun: 0, slow: 0, mark: 0, kx: 0 };
    const track = () => { for (const s of wd.shots) if (!ws.has(s)) { ws.add(s); seen[s.kind] = (seen[s.kind] || 0) + 1; } };
    let casts = 0;
    for (let t = 0; t < secs; t += 1 / 60) {
      if (w) { w.mana = Math.min(A.mmax(w), w.mana + A.mreg(w) / 60); w.cd -= 1 / 60; if (w.cd <= 0 && (!o.maxCasts || casts < o.maxCasts)) { const f0 = wd.foes[0]; if (A.tryCast(wd, w, 60, 186, o.aim != null ? o.aim : Math.atan2(f0.y - 11 - 186, f0.x - 60), null)) casts++; track(); } }
      A.updateShots(wd, 1 / 60); track();
      for (const s of wd.shots) { obs.maxR[s.kind] = Math.max(obs.maxR[s.kind] || 0, s.r); if (s.host) obs.host = true; obs.maxWz = Math.max(obs.maxWz, s.wz || 0); if (o.trackY && s.kind === o.trackY) obs.ys.push(s.y); }
      for (const f of wd.foes) { if (f.stun > 0) obs.stun++; if (f.slowT > 0) obs.slow++; if (f.mark > 0) obs.mark++; obs.kx = Math.max(obs.kx, Math.abs(f.kx)); for (const k of ['stun', 'slowT', 'mark', 'silence', 'contag', 'gild', 'frozen', 'hex']) if (f[k] > 0) f[k] -= 1 / 60; f.kx *= .86; f.ky *= .86; }
      for (const f of wd.fxs) fxs.add(f.type); wd.fxs = wd.fxs.filter(f => (f.life -= 1 / 60) > 0); wd.parts = wd.parts.filter(p => (p.life -= 1 / 60) > 0);
      wd.eshots = (wd.eshots || []).filter(e => e.life > 0);
    }
    return { dmg: wd.foes.reduce((s, f) => s + (f.dmgTaken || 0), 0), seen, fx: [...fxs], obs, wd, casts };
  }
  const P2 = A.NEW_PAGES2;
  for (const id of P2) {
    const c = C[id];
    try {
      if (c.t === 'proj') {
        const cast = A.buildCast(W([id])); ok(id, cast.shots.length === 1 && cast.shots[0].p === id && cast.mana === c.mana, 'resolves to 1 ' + c.name + ', ' + cast.mana + ' mana, ' + ['', 'common', 'uncommon', 'rare'][c.rar]);
        const rev = A.buildCast(W(['inverted', id, 'sanctified'])); ok(id, rev.shots[0].p === id && rev.shots[0].mods.includes('sanctified'), 'reads right→left under Null Reversal');
        let r, sig, why;
        if (id === 'belltoll') { r = sim(W([id]), 3, world([foe(150, 214)])); sig = r.obs.stun > 0; why = 'stuns foes at the ring edge'; }
        else if (id === 'inkserpent') { r = sim(W([id]), 3); sig = r.obs.slow > 0 && r.wd.patches.some(p => p.kind === 'ink') || r.obs.slow > 0; why = 'ink trail slows (' + r.obs.slow + ' slowed frames)'; }
        else if (id === 'gravehand') { const wd = world([foe(320, 260)]); wd.curWand = W([id]); const s = A.spawnShot(wd, { p: id, mods: [] }, 60, 186, 0); ok(id, Math.abs(s.x - 320) < 1 && s.vx === 0, 'bursts from the ground under the target (x ' + Math.round(s.x) + ')'); r = sim(W([id]), 3); sig = r.obs.stun > 0; why = 'grabs (stuns) the target'; }
        else if (id === 'mirrorshard') { r = sim(W([id]), 3, world([foe(170, 214), foe(250, 120), foe(260, 320), foe(140, 330)])); sig = (r.seen.mirrorshard || 0) >= r.casts * 3; why = 'shatters into reflected copies (' + r.seen.mirrorshard + ' shards from ' + r.casts + ' casts)'; }
        else if (id === 'censer') { r = sim(W([id]), 3, world([foe(112, 214)])); sig = r.dmg > 0; why = 'swings on its chain around the caster'; }
        else if (id === 'pagestorm') { r = sim(W([id]), 3); sig = (r.seen.pagestorm || 0) >= 5 * r.casts; why = 'swarm of 5 pages per cast (' + r.seen.pagestorm + '/' + r.casts + ')'; }
        else if (id === 'hollowmoon') { r = sim(W([id]), 3, world([foe(400, 214)])); sig = r.obs.maxR.hollowmoon > c.r * 2; why = 'grows with distance (r ' + c.r + '→' + r.obs.maxR.hollowmoon.toFixed(1) + ')'; }
        else if (id === 'chainanchor') { r = sim(W([id]), 2, world([foe(330, 214), foe(250, 150, { dummy: false })])); sig = r.obs.kx > 100; why = 'drags foes to where it lands (kx ' + Math.round(r.obs.kx) + ')'; }
        else if (id === 'candlewraith') { r = sim(W([id]), 3); sig = r.obs.host; why = 'attaches to and haunts a foe'; }
        else if (id === 'thornrosary') { r = sim(W([id]), 2); sig = (r.seen.rosethorn || 0) >= 8; why = 'beads burst into thorns in sequence (' + (r.seen.rosethorn || 0) + ' thorns)'; }
        else if (id === 'eclipseorb') { const wd = world([foe(300, 214)]); wd.eshots = Array.from({ length: 6 }, (_, i) => ({ x: 130 + i * 14, y: 186, vx: -20, vy: 0, life: 9, dmg: 5 })); r = sim(W([id]), 3, wd); sig = r.wd.eshots.length < 6; r.dmg = sim(W([id]), 3, world([foe(200, 214)])).dmg; why = 'swallows enemy projectiles (' + (6 - r.wd.eshots.length) + '/6 blocked)'; }
        else if (id === 'bloodletter') { r = sim(W([id]), 2); const f = foe(0, 0); f.mark = 4; A.hurtFoe(world([f]), f, 10); sig = r.obs.mark > 0 && Math.abs(f.dmgTaken - 13.5) < 1e-6; why = 'marks; marked foes take +35% (' + f.dmgTaken + ' from 10)'; }
        ok(id, r.dmg > 0, 'deals damage (' + Math.round(r.dmg) + ')'); ok(id, sig, why);
      }
      if (c.t === 'mod') {
        const cast = A.buildCast(W([id, 'spark'])), s0 = cast.shots[0];
        ok(id, s0.p === 'spark' && s0.mods.includes(id) && cast.mana === 5 + c.mana, 'attaches to the next attack, ' + cast.mana + ' mana, ' + ['', 'common', 'uncommon', 'rare'][c.rar]);
        ok(id, A.buildCast(W(['inverted', 'spark', id])).shots[0].mods.includes(id), 'reads right→left under Null Reversal');
        const wd0 = world([foe(170, 214)]); wd0.curWand = W([id, 'spark']); const s = A.spawnShot(wd0, s0, 60, 186, 0); ok(id, s.ov > 0, 'glyph overlay bit ' + s.ov);
        let sig, why, r;
        if (id === 'penance') { const me = { x: 60, y: 200, hp: 50, maxHp: 50 }; r = sim(W([id, 'spark']), 2, world([foe(170, 214)], { caster: me })); const b0 = A.spawnShot(world([]), { p: 'spark', mods: [] }, 0, 0, 0); sig = Math.abs(s.dmg / b0.dmg - 1.9) < 1e-6 && me.hp < 50 && me.hp >= 1; why = 'x1.9 damage, costs HP per hit (50→' + me.hp.toFixed(1) + ')'; }
        else if (id === 'sanctified') { const u = sim(W([id, 'spark']), 1, world([foe(170, 214, { undead: true })])), n = sim(W([id, 'spark']), 1, world([foe(170, 214)])); r = u; sig = Math.abs(u.dmg / n.dmg - 1.6) < .05; why = 'x1.6 vs undead (' + Math.round(u.dmg) + ' vs ' + Math.round(n.dmg) + ')'; }
        else if (id === 'haunted') { const wd = world([foe(150, 200, { dummy: false, hp: 3, max: 3 }), foe(330, 214)]); r = sim(W([id, 'spark']), 2, wd, { maxCasts: 1 }); sig = (r.seen.spark || 0) >= 2 && r.fx.includes('ghost'); why = 'kill leaves a ghost that recasts (' + (r.seen.spark || 0) + ' sparks from 1 cast)'; }
        else if (id === 'mirrored') { const wd = world([foe(170, 214)]); A.tryCast(wd, W([id, 'spark']), 60, 186, 0, null); sig = wd.shots.length === 2 && Math.abs(wd.shots[0].x - 540) < 1 && wd.shots[0].vx < 0; r = sim(W([id, 'spark']), 2); why = 'copy fires from the far side (x ' + wd.shots.map(q => Math.round(q.x)).join(',') + ')'; }
        else if (id === 'delayedfate') { const wd = world([]); A.tryCast(wd, W([id, 'spark']), 60, 186, 0, null); const q = wd.shots[0]; for (let i = 0; i < 18; i++) A.updateShots(wd, 1 / 60); const still = Math.abs(q.x - 60) < .5; for (let i = 0; i < 18; i++) A.updateShots(wd, 1 / 60); sig = still && q.x > 100 && Math.abs(Math.hypot(q.vx, q.vy) - 760) < 1; r = sim(W([id, 'spark']), 2); why = 'hangs 0.45s then flies at 2x speed (' + Math.round(Math.hypot(q.vx, q.vy)) + ' px/s)'; }
        else if (id === 'tethered') { const wd = world([foe(400, 300), foe(150, 200)]); r = sim(W([id, 'skull']), 2.5, wd, { maxCasts: 1, aim: 0 }); const cross = wd.foes[1].dmgTaken || 0; sig = cross > 26 * 1.5; why = 'beam damages a foe crossing it (' + Math.round(cross) + ' vs skull 26)'; }
        else if (id === 'spiral') { r = sim(W([id, 'spark']), 1.2, world([foe(500, 300)]), { maxCasts: 1, aim: 0, trackY: 'spark' }); const ys = r.obs.ys; sig = ys.length && Math.max(...ys) - Math.min(...ys) > 25; r.dmg = sim(W([id, 'spark']), 2).dmg; why = 'widening corkscrew (y span ' + Math.round(Math.max(...ys) - Math.min(...ys)) + 'px)'; }
        else if (id === 'leechmana') { const w = W([id, 'spark'], { regen: 0 }); r = sim(w, .6, null, { maxCasts: 1 }); sig = w.mana > 400 - (5 + c.mana) + 1; why = 'refunds mana on hit (' + w.mana.toFixed(1) + ' after a ' + (5 + c.mana) + '-mana cast)'; }
        else if (id === 'weighted') { const wd = world([foe(250, 214)]); r = sim(W([id, 'spark']), 1.6, wd, { maxCasts: 1 }); sig = r.obs.maxWz > 15 && r.fx.includes('quake') && (wd.foes[0].dmgTaken || 0) > 0; why = 'lobbed (peak ' + Math.round(r.obs.maxWz) + 'px) and lands with a blast'; }
        else if (id === 'contagion') { const wd = world([foe(150, 200, { dummy: false, hp: 3, max: 3, burn: 3, hex: 3 }), foe(200, 230)]); r = sim(W([id, 'spark']), .8, wd, { maxCasts: 1 }); sig = wd.foes[1].burn > 0 || (wd.foes[1].dmgTaken || 0) > 0 && r.fx.includes('bolt2'); why = 'statuses spread on death (neighbour burn ' + (wd.foes[1].burn || 0).toFixed(1) + ')'; }
        else if (id === 'overcharge') { const wd = world([foe(170, 214)]), w = W([id, 'spark']); const n = []; for (let i = 0; i < 3; i++) { A.tryCast(wd, w, 60, 186, 0, null); n.push(wd.shots.length); } const b0 = A.spawnShot(world([]), { p: 'spark', mods: [] }, 0, 0, 0); sig = n[0] === 0 && n[1] === 0 && n[2] === 3 && Math.abs(wd.shots[0].dmg / b0.dmg - 1.5) < 1e-6; r = sim(W([id, 'spark']), 3); why = 'stores 2 casts, releases 3 empowered (shots ' + n.join('→') + ')'; }
        else if (id === 'silence') { const wd = world([foe(170, 214, { type: 'cultist' })]); r = sim(W([id, 'spark']), .6, wd, { maxCasts: 1 }); sig = wd.foes[0].silence > 0; why = 'struck caster is silenced'; }
        else if (id === 'gilded') { const wd = world([foe(170, 214)]); r = sim(W([id, 'spark']), .6, wd, { maxCasts: 1 }); sig = wd.foes[0].gild > 0; why = 'struck foe is gilded (drops +3 shards on death)'; }
        else if (id === 'lastrites') { const wd = world([foe(170, 214, { dummy: false, hp: 150, max: 1000 })]); r = sim(W([id, 'spark']), .6, wd, { maxCasts: 1 }); sig = wd.foes[0].riteDone && wd.foes[0].dmgTaken > 9 * 3; why = 'funeral-fire burst under 20% HP (' + Math.round(wd.foes[0].dmgTaken) + ' dmg from one spark)'; }
        ok(id, r.dmg > 0, 'deals damage (' + Math.round(r.dmg) + ')'); ok(id, sig, why);
      }
    } catch (e) { ok(id, false, 'threw ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  }
  // balance: single-page DPS against one dummy (6s, 200 mana / 50 regen) for every attack page
  const bal = []; for (const id of Object.keys(C).filter(k => C[k].t === 'proj' && !C[k].hidden)) { const r = sim(W([id], { maxMana: 200, mana: 200, regen: 50 }), 6, world([foe(id === 'censer' ? 112 : 170, 214)])); bal.push({ id, dps: Math.round(r.dmg / 6), mana: C[id].mana, n: P2.includes(id) }); }
  // perf: every new attack at once with a 16-page chant from a zero-delay grimoire, 6s
  const big = W(['starchant', 'pagestorm', 'thornrosary', 'mirrorshard', 'inkserpent', 'pagestorm', 'thornrosary', 'mirrorshard', 'pagestorm', 'censer', 'mirrored', 'pagestorm'], { delay: 0, recharge: 0, maxMana: 1e5, mana: 1e5, regen: 1e5 });
  const wdp = world(Array.from({ length: 8 }, (_, i) => foe(120 + i * 50, 120 + (i % 3) * 90))); let mx = 0, mp = 0, mpd = 0; const t0 = performance.now();
  for (let t = 0; t < 6; t += 1 / 60) { for (let k = 0; k < 5; k++) { big.cd = 0; A.tryCast(wdp, big, 60, 186, k * .3, null); } A.updateShots(wdp, 1 / 60); mx = Math.max(mx, wdp.shots.length); mp = Math.max(mp, wdp.parts.length); mpd = Math.max(mpd, (wdp.pending || []).length); wdp.parts = wdp.parts.filter(p => (p.life -= 1 / 60) > 0); wdp.fxs = wdp.fxs.filter(f => (f.life -= 1 / 60) > 0); }
  res.push({ id: 'perf-cap', ok: mx <= 220 && mp <= 520 && mpd <= 80, m: `stress (5 casts per frame: starburst of swarms/rosaries/mirrors, 6s): max live shots ${mx} (cap 220), particles ${mp}, pending ${mpd} (cap 80), sim ${Math.round(performance.now() - t0)}ms` });
  return { res, bal };
});
let fails = 0; for (const r of out.res) { if (!r.ok) fails++; console.log((r.ok ? 'PASS ' : 'FAIL ') + r.id + ': ' + r.m); }
const ds = out.bal.map(x => x.dps).sort((a, c) => a - c), med = ds[ds.length >> 1];
console.log('BALANCE dps (median ' + med + '): ' + out.bal.filter(x => x.n).map(x => x.id + ' ' + x.dps + ' (' + x.mana + 'm)' + (x.dps > med * 2.5 || x.dps < med / 3 ? ' <-OUTLIER' : '')).join(', '));
console.log('PAGES', new Set(out.res.map(r => r.id)).size - 1, 'ERRORS', JSON.stringify(errs), 'FAILS', fails);
await b.close(); process.exit(fails || errs.length ? 1 : 0);
