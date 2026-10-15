// Mobile screenshots of every Legendary effect in a real room + the editor with gold slots.
// usage: node legend-shots.mjs [baseUrl] [tag]   -> /workspace/ashen-shots/<tag>-<scene>-<WxH>.png
import { createRequire } from 'module'; const req = createRequire('/workspace/tools/'); const pp = req('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999', tag = process.argv[3] || 'lg-local', SH = '/workspace/ashen-shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await pp.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], files = [];
for (const [w, h] of [[390, 844], [844, 390], [360, 780]]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(w + 'x' + h + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(w + 'x' + h + ': ' + m.text()); });
  await p.goto(base + '/?debug=legendary'); await p.waitForFunction('window.__ready'); await p.click('#go'); await sleep(400);
  const snap = async n => { const f = `${SH}${tag}-${n}-${w}x${h}.png`; await p.screenshot({ path: f }); files.push(f); };
  // editor with the ornate grimoire (2 gold slots) + a refused drop
  await p.evaluate(() => { edWand = 0; editor(); }); await sleep(500); await snap('editor-ornate');
  await p.evaluate(() => { const i = __ashen.G.bag.indexOf('starfall'); moveCard('b:' + i, 'w:3'); }); await sleep(120); await snap('editor-deny');
  await p.evaluate(() => { edWand = 1; editor(); }); await sleep(400); await snap('editor-plain');
  await p.evaluate(() => { closeUI(); showMap(); document.querySelector('[data-door="fight"]').click(); }); await sleep(900);
  const keep = setInterval(() => p.evaluate(() => { const A = __ashen; A.P.inv = 9; if (A.room) { A.room.done = false; A.room.doneT = 0; const B = A.room.bounds; let k = 0; while (A.room.foes.filter(f => !f.dead).length < 5 && k++ < 5) spawn(['husk', 'bat', 'cultist'][k % 3], B.x0 + 40 + Math.random() * (B.x1 - B.x0 - 80), B.y0 + 40 + Math.random() * (B.y1 - B.y0) * .45, 1); } if (A.room) for (const f of A.room.foes) { if (!f.dummy) { f.max = Math.max(f.max, 4000); f.hp = Math.max(f.hp, 2000); } if (window.__still) { f.spd = 0; f.lcd = 5; f.wind = 0; f.atk = Math.max(f.atk, 3); f.kx = f.ky = 0; } } }).catch(() => { }), 150);
  const scene = async (slots, setup) => p.evaluate((slots, setup) => { const A = __ashen, w = A.G.wands[0]; A.G.active = 0; w.slots = slots.concat(Array(Math.max(0, 8 - slots.length)).fill(null)); w.idx = 0; w.cd = 0; w.mana = w.maxMana = 900; w.regen = 400; A.room.shots = []; A.room.fxs = []; A.room.walls = []; A.room.allies = []; A.input.dx = 0; A.input.dy = 0; window.__still = true; const B = A.room.bounds; A.room.foes.forEach((f, i) => { f.x = B.x0 + (B.x1 - B.x0) * (.2 + .6 * ((i * .37) % 1)); f.y = B.y0 + (B.y1 - B.y0) * (.22 + .3 * ((i * .61) % 1)); f.tx = undefined; }); A.P.x = (B.x0 + B.x1) / 2; A.P.y = B.y0 + (B.y1 - B.y0) * .78; if (setup) (0, eval)(setup)(); }, slots, setup || null);
  await sleep(1500);
  await scene(['requiem', 'spark']); await sleep(1700); await snap('requiem');
  await scene(['cathedralfall', 'spark']); await sleep(230); await snap('cathedral-fall'); await sleep(1500); await snap('cathedral-rubble');
  await scene(['abyssalmaw', 'spark']); await sleep(700); await snap('abyssal-maw');
  await scene(['saintshalo', 'spark'], `() => { const A = __ashen; A.room.foes.slice(0, 4).forEach((f, i) => { const q = -Math.PI * (.15 + .23 * i); f.x = A.P.x + Math.cos(q) * 95; f.y = A.P.y + Math.sin(q) * 70; }); }`); await sleep(900);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => { const A = __ashen; for (const f of A.room.foes.slice(0, 4)) { f.wind = .4; f.hcd = 0; } }); await sleep(70); if (await p.evaluate(() => __ashen.room.fxs.some(f => f.type === 'halobeam'))) break; }
  await snap('saints-halo');
  await scene(['eternalflame', 'spark']); await sleep(1400); await snap('eternal-flame');
  await scene(['ossuary', 'spark'], `() => { const A = __ashen; A.G.wands[0].cd = 1; const fs = A.room.foes.filter(f => !f.boss).slice(0, 3); for (const f of fs) { lgDeath(A.room, f); } A.G.wands[0].cd = 0; }`); await sleep(1300); await snap('ossuary-legion');
  await scene(['starfall', 'spark']); await sleep(2300); await snap('starfall-charge'); await p.evaluate(() => { __ashen.input.dx = 1; }); await sleep(120); await p.evaluate(() => { __ashen.input.dx = 0; }); await sleep(600); await snap('starfall-rain');
  await scene(['soulbound', 'ascension', 'fireball', 'spark']); await sleep(900); await snap('glyphs-soul-asc');
  await scene(['timefracture', 'crownedash', 'fireball', 'spark']); await sleep(700); await snap('glyphs-time-ash');
  await scene(['hereticmark', 'fatebinding', 'spark', 'spark']); await sleep(1500); await snap('glyphs-heretic-fate');
  clearInterval(keep); await p.close();
}
console.log(files.join('\n')); console.log('ERRORS', JSON.stringify(errors)); await b.close(); process.exit(errors.length ? 1 : 0);
