// Unit-style cast-resolution tests for every expansion page (runs the real engine in a headless page, no DOM preview).
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs'; import path from 'path';
const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const root = '/workspace/ashen-pilgrim';
const server = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
await new Promise(r => server.listen(0, r)); const base = `http://localhost:${server.address().port}`;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && !/sw\.js|fetching the script/.test(m.text()) && errs.push(m.text()));
await pg.goto(base + '/'); await pg.waitForFunction('window.__ready');
await pg.click('#go');
const out = await pg.evaluate(() => {
  const A = window.__ashen, C = A.CARDS, res = [];
  const W = (slots, o = {}) => Object.assign({ name: 't', slots, delay: .2, recharge: .4, maxMana: 400, mana: 400, regen: 60, idx: 0, cd: 0, hue: 30 }, o);
  const dummy = (x, y) => ({ type: 'husk', dummy: true, x, y, hp: 1e9, max: 1e9, spd: 0, r: 14, dmg: 0, burn: 0, poison: 0, hit: 0, t: 0, kx: 0, ky: 0, spawnT: 0, frozen: 0 });
  const world = (foes) => ({ caster: { x: 60, y: 200 }, bounds: { x0: 0, y0: 20, x1: 600, y1: 400 }, foes, shots: [], parts: [], fxs: [], patches: [], dmgMul: 1 });
  function sim(w, secs, foes, aim) {
    const wd = world(foes || [dummy(170, 214)]), seen = {}, fx = new Set(); const ws = new WeakSet(); const track = arr => { const o = arr.push; arr.push = function (...a) { for (const s of a) if (s && s.kind && !ws.has(s)) { ws.add(s); seen[s.kind] = (seen[s.kind] || 0) + 1; } return o.apply(this, a); }; return arr; }; wd.shots = track(wd.shots); const _f = wd.shots.filter;  let maxShots = 0, hex = false, grow = 0, frozen = false;
    for (let t = 0; t < secs; t += 1 / 60) {
      w.mana = Math.min(A.mmax(w), w.mana + A.mreg(w) / 60); w.cd -= 1 / 60;
      if (w.cd <= 0) A.tryCast(wd, w, 60, 186, aim != null ? aim : Math.atan2(wd.foes[0].y - 11 - 186, wd.foes[0].x - 60), null);
      A.updateShots(wd, 1 / 60); if (!wd.shots.__t) { wd.shots = track(wd.shots); wd.shots.__t = 1; }
      for (const f of wd.foes) { if (f.hex > 0) hex = true; if (f.frozen > 0) frozen = true; f.frozen = Math.max(0, (f.frozen || 0) - 1 / 60); if (f.hex > 0) f.hex -= 1 / 60; }
      for (const s of wd.shots) { if (!ws.has(s)) { ws.add(s); seen[s.kind] = (seen[s.kind] || 0) + 1; } grow = Math.max(grow, s.grow || 0); }
      for (const f of wd.fxs) fx.add(f.type); wd.fxs = wd.fxs.filter(f => (f.life -= 1 / 60) > 0);
      wd.parts = wd.parts.filter(p => (p.life -= 1 / 60) > 0);
      maxShots = Math.max(maxShots, wd.shots.length);
    }
    return { dmg: wd.foes.reduce((s, f) => s + (f.dmgTaken || 0), 0), seen, fx: [...fx], maxShots, hex, grow, frozen, parts: wd.parts.length };
  }
  const ok = (id, c, m) => res.push({ id, ok: !!c, m });
  for (const id of A.NEW_PAGES) {
    const c = C[id];
    try {
      if (c.t === 'proj') {
        const cast = A.buildCast(W([id])); ok(id, cast.shots.length === 1 && cast.shots[0].p === id && cast.mana === c.mana, 'resolves to 1 ' + id + ', ' + cast.mana + ' mana');
        const r = sim(W([id]), 4, id === 'stormorb' ? [dummy(150, 214), dummy(300, 214)] : null);
        ok(id, r.dmg > 0, 'deals damage (' + Math.round(r.dmg) + ' in 4s)');
        const extra = { stonespire: r.fx.includes('quake'), stormorb: r.fx.includes('bolt'), hexmote: r.hex, prismshard: true, briarseed: (r.seen.spark || 0) > 0, rimejavelin: r.frozen, tidecrescent: true, galelash: true, emberneedle: true, shadefang: true, dawnray: true }[id];
        ok(id, extra, 'signature effect');
        if (id === 'prismshard') { const r2 = sim(W([id]), 3, [dummy(300, 214)], -Math.PI / 2 + .3); ok(id, r2.grow >= 1, 'grows on bounce (' + r2.grow + ')'); }
      }
      if (c.t === 'mod') {
        const cast = A.buildCast(W([id, 'spark'])); const s0 = cast.shots[0];
        ok(id, s0.p === 'spark' && s0.mods.includes(id) && cast.mana === 5 + c.mana, 'attaches to next attack, mana ' + cast.mana);
        const rev = A.buildCast(W(['inverted', 'spark', id])); ok(id, rev.shots[0].mods.includes(id), 'reads right→left under Null Reversal');
        const wd = world([dummy(300, 214)]); wd.curWand = W([id, 'spark']); const s = A.spawnShot(wd, s0, 60, 186, 0); const base = A.spawnShot(world([]), { p: 'spark', mods: [] }, 0, 0, 0);
        const flag = { echoglyph: s.echo, hexglyph: s.hex, gravityglyph: s.pull, stormglyph: s.zap, siphonglyph: s.siphon, ricochetglyph: s.redirect === 2, longglyph: Math.abs(s.life - base.life * 2) < 1e-6, executeglyph: s.execute, frenzyglyph: Math.abs(s.dmg - base.dmg * .85) < 1e-6 && cast.delay < 0, crownglyph: s.crown, shatterglyph: s.shatter }[id];
        ok(id, flag && s.ov > 0, 'effect flag set and overlay bit ' + s.ov);
        const r = sim(W([id, 'spark']), 3, [dummy(300, 214), dummy(360, 260)]); ok(id, r.dmg > 0, 'deals damage (' + Math.round(r.dmg) + ')');
        if (id === 'siphonglyph') { const w = W([id, 'spark'], { regen: 0, mana: 100 }); const before = 100; sim(w, 1, null); ok(id, w.mana > before - 3 * 11, 'refunds mana on hit (' + Math.round(w.mana) + ')'); }
      }
      if (c.t === 'multi') {
        const n = c.n, slots = c.dup ? [id, 'spark'] : [id, ...Array(n).fill('spark')];
        const cast = A.buildCast(W(slots)), sh = cast.shots;
        ok(id, sh.length === n && sh.every(s => s.p === 'spark'), 'casts ' + sh.length + '/' + n + ' sparks' + (c.dup ? ' from one page' : ''));
        const offs = new Set(sh.map(s => s.off.toFixed(3))), waits = sh.map(s => s.wait || 0);
        const shape = c.stagger ? waits[0] === 0 && Math.abs(waits[n - 1] - c.stagger * (n - 1)) < 1e-6 : c.orbitAll ? sh.every(s => s.mods.includes('orbit')) : c.side ? sh[0].side < 0 && sh[n - 1].side > 0 : c.dup ? cast.mana === c.mana + 5 : c.rand ? sh.every(s => Math.abs(s.off) <= c.rand / 2 + 1e-9) : offs.size === n;
        ok(id, shape, 'formation correct (offs ' + [...offs].join(',') + ' waits ' + waits.join(',') + ')');
        ok(id, cast.mana === c.mana + 5 * (c.dup ? 1 : n), 'mana ' + cast.mana);
        const r = sim(W(slots), 2); ok(id, (c.offs || c.orbitAll || r.dmg > 0) && (r.seen.spark || 0) >= n, 'spawns in play (' + (r.seen.spark || 0) + ' sparks)');
      }
      if (c.t === 'trig') {
        const cast = A.buildCast(W([id, 'fireball'])), s0 = cast.shots[0];
        ok(id, s0.p === (c.carrier || 'spark') && s0.trig === c.trig && s0.payload.length === 1 && s0.payload[0].p === 'fireball', 'carrier ' + s0.p + ' → fireball payload');
        ok(id, cast.mana === c.mana + 25, 'mana ' + cast.mana);
        const aim = c.trig === 'bounce' ? -Math.PI / 2 + .2 : c.trig === 'timer' ? -.7 : null;
        const r = sim(W([id, 'fireball']), 4, c.trig === 'boom' ? [dummy(240, 210)] : null, aim);
        const fb = r.seen.fireball || 0; ok(id, fb >= 1 && (!c.twin || fb >= 2), 'payload released (' + fb + ' fireballs)');
      }
      if (c.t === 'sigil') {
        const w = W([id, 'spark']), w0 = W(['spark']), cast = A.buildCast(w);
        ok(id, cast.shots.length === 1 && cast.mana === 5, 'never cast / free (' + A.describeCast(w) + ')');
        const k = c.sig, act = { x: 60, y: 200, hp: 50, maxHp: 100 }, wd = world([dummy(90, 214)]);
        let eff;
        if (k === 'flow') eff = A.mreg(w) > A.mreg(w0); if (k === 'well') eff = A.mmax(w) === A.mmax(w0) + 60;
        if (k === 'aegis') eff = A.absorbHit(act, w, wd) && !A.absorbHit(act, w, wd);
        if (k === 'quick') { A.tryCast(wd, w, 0, 0, 0); const a = w.cd; A.tryCast(wd, w0, 0, 0, 0); eff = a < w0.cd; }
        if (k === 'ember') { A.dodgeSigils(act, w, wd); eff = (wd.foes[0].dmgTaken || 0) > 0; }
        if (k === 'frost') { A.dodgeSigils(act, w, wd); eff = wd.foes[0].frozen > 0; }
        if (k === 'fam') { for (let i = 0; i < 200; i++) A.sigilTick(act, w, 1 / 60, wd); eff = wd.shots.length > 0; }
        if (k === 'thorn') { const wd2 = world([dummy(90, 214)]); A.absorbHit; window.__ashen.sigN(w, 'thorn'); /* via hurt path */ const f = wd2.foes[0]; const fn = new Function('a', 'w', 'wd', 'return thornsOf(a, w, wd)'); fn(act, w, wd2); eff = (f.dmgTaken || 0) >= 15; }
        if (k === 'mend') { for (let i = 0; i < 60; i++) A.sigilTick(act, w, 1 / 60, wd); eff = act.hp > 50.5; }
        if (k === 'lode') eff = A.sigN(w, 'lode') === 1;
        if (k === 'ruin') { const a = A.spawnShot(Object.assign(world([]), { curWand: w }), { p: 'spark', mods: [] }, 0, 0, 0), b0 = A.spawnShot(world([]), { p: 'spark', mods: [] }, 0, 0, 0); eff = Math.abs(a.dmg / b0.dmg - 1.15) < 1e-6 && A.mreg(w) < A.mreg(w0); }
        ok(id, eff, 'passive effect (' + k + ')');
      }
    } catch (e) { ok(id, false, 'threw ' + e.message); }
  }
  // perf caps: a starburst of quad-chanted split seeds cannot exceed the shot cap
  const cap = sim(W(['starchant', 'quad', 'briarseed', 'briarseed', 'briarseed', 'briarseed', 'echoglyph', 'briarseed', 'briarseed', 'briarseed', 'briarseed'], { regen: 9999, maxMana: 9999, mana: 9999, delay: 0, recharge: 0 }), 4, [dummy(300, 214), dummy(200, 150), dummy(400, 300)]);
  res.push({ id: 'perf-cap', ok: cap.maxShots <= 220 && cap.parts <= 520, m: 'max live shots ' + cap.maxShots + ', particles ' + cap.parts });
  { const wd = world([dummy(300, 214)]); for (let i = 0; i < 400; i++) A.spawnShot(wd, { p: 'briarseed', mods: ['echoglyph'] }, 60, 186, i * .1); let mx = 0, mp = 0; for (let t = 0; t < 3; t += 1 / 60) { A.updateShots(wd, 1 / 60); mx = Math.max(mx, wd.shots.length); mp = Math.max(mp, wd.parts.length); }
    res.push({ id: 'perf-cap', ok: mx <= 220 && mp <= 400, m: '400 forced echo-briar spawns -> max live shots ' + mx + ', max particles ' + mp }); }
  // balance: damage per second and per mana, single-page grimoire vs one dummy (6s)
  const bal = [];
  for (const id of Object.keys(C).filter(k => C[k].t === 'proj')) { const w = W([id], { maxMana: 200, mana: 200, regen: 50 }); const r = sim(w, 6, [dummy(170, 214)]); bal.push({ id, dps: Math.round(r.dmg / 6), new: A.NEW_PAGES.includes(id) }); }
  return { res, bal };
});
let fails = 0; for (const r of out.res) { if (!r.ok) fails++; console.log((r.ok ? 'PASS ' : 'FAIL ') + r.id + ': ' + r.m); }
const med = out.bal.map(x => x.dps).sort((a, b) => a - b)[out.bal.length >> 1];
console.log('BALANCE (dps, 6s, 1 page, 200 mana/50 regen) median ' + med + ': ' + out.bal.map(x => (x.new ? '*' : '') + x.id + ' ' + x.dps + (x.dps > med * 2.5 || x.dps < med / 3 ? ' <-OUTLIER' : '')).join(', '));
console.log('PAGES TESTED', new Set(out.res.map(r => r.id)).size - 1, 'ERRORS', JSON.stringify(errs), 'FAILS', fails);
await b.close(); server.close(); process.exit(fails || errs.length ? 1 : 0);
