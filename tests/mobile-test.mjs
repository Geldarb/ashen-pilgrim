// Mobile + audio + enemy-art test: node mobile-test.mjs [base] [tag]
import { createRequire } from 'module'; const require = createRequire('/workspace/tools/'); const pp = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999', tag = process.argv[3] || 'mob-local', SH = '/workspace/ashen-shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms)); const fails = [], errors = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const b = await pp.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const SIZES = [['360x780', 360, 780, true], ['390x844', 390, 844, true], ['844x390', 844, 390, true], ['tablet768x1024', 768, 1024, true]];
const fps = p => p.evaluate(() => new Promise(r => { const n0 = window.__frames || 0, t0 = performance.now(); setTimeout(() => r(((window.__frames || 0) - n0) / ((performance.now() - t0) / 1000)), 2000); }));
const shots = [];
const snap = async (p, name, clip) => { const f = SH + tag + '-' + name + '.png'; await p.screenshot(clip ? { path: f, clip } : { path: f }); shots.push(f); };
for (const [nm, w, h] of SIZES) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', e => errors.push(nm + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(nm + ' console: ' + m.text()); });
  await p.goto(base + '/', { timeout: 90000 }); await p.waitForFunction(() => window.__ready, { timeout: 60000 }); await sleep(500);
  await p.evaluate(() => localStorage.removeItem('ga-settings')); await p.reload(); await p.waitForFunction(() => window.__ready, { timeout: 60000 }); await sleep(300);
  await snap(p, nm + '-camp');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1), nm + ': no page overflow/scroll');
  const small = await p.evaluate(() => [...document.querySelectorAll('button')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.textContent.trim().slice(0, 14), Math.round(r.width), Math.round(r.height)]; }).filter(([, a, c]) => a < 44 || c < 44));
  ok(small.length === 0, nm + ': camp buttons ≥44px ' + JSON.stringify(small));
  ok(await p.evaluate(() => !!document.getElementById('settings')), nm + ': camp has Settings button');
  // audio unlock on first tap
  ok(await p.evaluate(() => AUD.state().ctx) !== 'running', nm + ': audio not started before a gesture (' + await p.evaluate(() => AUD.state().ctx) + ')');
  await p.touchscreen.tap(w / 2, 20); await sleep(400);
  const as = await p.evaluate(() => AUD.state()); ok(as.ctx === 'running', nm + ': AudioContext running after first tap (' + as.ctx + ', track ' + as.track + ')');
  // PWA
  if (nm === '390x844') {
    const mf = await p.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); const j = await r.json(); const ic = await Promise.all(j.icons.map(i => fetch(i.src).then(r => r.status))); return { s: r.status, d: j.display, ic }; });
    ok(mf.s === 200 && mf.ic.every(x => x === 200), 'manifest 200, icons ' + mf.ic + ', display ' + mf.d);
    const sw = await p.evaluate(async () => { for (let i = 0; i < 40; i++) { const r = await navigator.serviceWorker.getRegistration(); if (r && r.active) return r.active.scriptURL; await new Promise(q => setTimeout(q, 250)); } return null; });
    ok(!!sw, 'service worker active: ' + sw);
    const v = await p.evaluate(async () => { const v = await (await fetch('/version')).json(); const c = await caches.keys(); return { v, c }; });
    ok(v.c.includes('ga-' + v.v.build), 'SW cache keyed by build: ' + JSON.stringify(v));
  }
  // settings panel
  await p.click('#settings'); await sleep(300); await snap(p, nm + '-settings');
  await p.click('#t_saver'); await sleep(200);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ga-settings')).fps === 30 && QUAL.fps === 30), nm + ': battery saver saved to localStorage');
  await p.$eval('#s_music', e => { e.value = 30; e.dispatchEvent(new Event('input')); });
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ga-settings')).music === .3), nm + ': music slider persisted');
  await p.click('#sdone'); await sleep(200);
  // run + editor + long press
  await p.click('#go'); await sleep(500);
  await p.evaluate(() => { const w = __ashen.G.wands[0]; w.slots = ['bloodletter', 'belltoll', 'sanctified', 'gravehand', 'candlewraith', 'spiral', 'pagestorm', 'hollowmoon'].concat(Array(2).fill(null)); w.maxMana = 500; w.mana = 500; w.regen = 200; __ashen.editor && __ashen.editor(); }); await sleep(400);
  await snap(p, nm + '-editor');
  const chip = await p.evaluate(() => { const c = document.querySelector('.chip:not(.ghost)'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, Math.round(r.width), Math.round(r.height)]; });
  ok(chip && chip[2] >= 44 && chip[3] >= 44, nm + ': page chips ≥44px ' + JSON.stringify(chip));
  if (chip) { await p.touchscreen.touchStart(chip[0], chip[1]); await sleep(650); const tip = await p.evaluate(() => { const t = document.getElementById('tip'); return t && !t.classList.contains('hidden') ? t.innerText : ''; }); await snap(p, nm + '-longpress'); await p.touchscreen.touchEnd(); ok(tip.length > 20, nm + ': press-and-hold tip: ' + tip.replace(/\n/g, ' | ').slice(0, 90)); }
  // fight room
  await p.evaluate(() => { document.getElementById('ui').classList.add('hidden'); __ashen.startRoom('fight'); }); await sleep(1500);
  await p.evaluate(() => { __ashen.P.inv = 99; });
  const btns = await p.evaluate(() => ['dodgeBtn', 'skillBtn', 'swapBtn', 'menuBtn'].map(id => { const e = document.getElementById(id); if (!e || !e.offsetParent) return [id, 0, 0, 0, 0]; const r = e.getBoundingClientRect(); return [id, Math.round(r.width), Math.round(r.height), Math.round(r.right), Math.round(r.bottom)]; }));
  ok(btns.filter(x => x[1]).every(x => x[1] >= 44 && x[2] >= 44), nm + ': room buttons ≥44px ' + JSON.stringify(btns));
  const dg = btns.find(x => x[0] === 'dodgeBtn'); ok(dg && dg[3] > w * .7 && dg[4] > h * .6, nm + ': Dodge in right-thumb zone');
  // joystick: drag from lower-left
  const P0 = await p.evaluate(() => [__ashen.P.x, __ashen.P.y]);
  await p.touchscreen.touchStart(w * .2, h * .75); await p.touchscreen.touchMove(w * .2 + 40, h * .75); await sleep(500); await p.touchscreen.touchEnd();
  const P1 = await p.evaluate(() => [__ashen.P.x, __ashen.P.y]); ok(P1[0] > P0[0] + 10, nm + ': floating joystick moves the mage (' + P0[0].toFixed(0) + '→' + P1[0].toFixed(0) + ')');
  for (let i = 0; i < 8; i++) { await p.evaluate(() => { __ashen.input.fire = true; __ashen.P.inv = 99; }); await sleep(150); }
  await snap(p, nm + '-room');
  const f30 = await fps(p); ok(f30 > 20 && f30 < 45, nm + ': battery saver ~30fps (' + f30.toFixed(0) + ')');
  await p.evaluate(() => { QUAL.fps = 60; QUAL.parts = 'high'; }); const f60 = await fps(p); ok(f60 > 30, nm + ': 60fps mode (' + f60.toFixed(0) + ' in headless/swiftshader)');
  const st = await p.evaluate(() => AUD.state()); ok(st.played > 3 && st.peakVoices <= st.maxVoices, nm + ': SFX played ' + st.played + ', peak voices ' + st.peakVoices + '/' + st.maxVoices + ', dropped ' + st.dropped + ', track ' + st.track);
  // enemy gallery (only on 390 and tablet to keep runtime down)
  if (nm === '390x844' || nm === 'tablet768x1024' || nm === '844x390') {
    await p.evaluate(() => { if (!__ashen.room) __ashen.startRoom('fight'); }); await sleep(300);
    await p.evaluate(() => { const A = __ashen, R = A.room; R.foes.length = 0; R.waves = []; R.shots && (R.shots.length = 0); R.eshots && (R.eshots.length = 0); A.input.fire = false; A.P.x = A.W * .5; A.P.y = A.H * .88;
      const types = ['husk', 'bat', 'cultist']; const ys = [.3, .5, .7];
      types.forEach((t, i) => [.2, .45, .7].forEach((x, j) => { A.spawn(t, A.W * x, A.H * ys[i], 1); const f = R.foes[R.foes.length - 1]; f.spawnT = 0; f.spd = j === 1 ? f.spd : 0.001; f.atk = 99; f.lcd = 99; f.gallery = j; if (j === 2) { f.wind = .15; f.atk = .2; } }));
      window.__galT = setInterval(() => { for (const f of R.foes) { if (f.gallery === 0) { f.hit = .08; } if (f.gallery === 2) { f.wind = Math.max(f.wind, .12); f.atk = Math.max(.15, f.atk); f.lcd = 99; } if (f.gallery === 1) f.atk = 99; A.P.inv = 99; } }, 50); });
    await sleep(700); await snap(p, nm + '-enemies');
    const rect = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x, y: c.y + c.height * .18, width: c.width, height: c.height * .64 }; });
    await snap(p, nm + '-enemies-zoom', rect);
    await p.evaluate(() => { const A = __ashen; for (const f of A.room.foes.filter(f => f.gallery === 1)) A.killFoe(A.room, f); });
    await sleep(320); await snap(p, nm + '-enemies-death');
    ok(await p.evaluate(() => __ashen.room.corpseN >= 3), nm + ': deaths leave ember/ash corpses');
    await p.evaluate(() => clearInterval(window.__galT));
    // boss
    await p.evaluate(() => { __ashen.startRoom('boss'); }); await sleep(2200);
    const bt = await p.evaluate(() => AUD.state().track); ok(/boss/.test(bt), nm + ': boss theme playing (' + bt + ')');
    await p.evaluate(() => { __ashen.P.inv = 99; }); await snap(p, nm + '-boss');
    await p.evaluate(() => { const f = __ashen.room.foes.find(f => f.boss); f.hp = f.max * .45; __ashen.P.inv = 99; }); await sleep(450);
    const ph = await p.evaluate(() => { const f = __ashen.room.foes.find(f => f.boss); return [f.phase, f.phaseT]; }); await snap(p, nm + '-boss-phase');
    ok(ph[0] >= 1 && ph[1] > 0, nm + ': boss phase transition (' + ph + ')');
    await p.evaluate(() => { const f = __ashen.room.foes.find(f => f.boss); f.hp = f.max * .2; __ashen.P.inv = 99; }); await sleep(900); await snap(p, nm + '-boss-enraged');
    await p.evaluate(() => { const A = __ashen, f = A.room.foes.find(f => f.boss); A.killFoe(A.room, f); }); await sleep(700); await snap(p, nm + '-boss-death');
  }
  // background → pause + audio suspended
  await p.evaluate(() => { __ashen.startRoom('fight'); }); await sleep(900); const pre = await p.evaluate(() => [__ashen.mode, __ashen.paused]);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(300);
  const bg = await p.evaluate(() => [__ashen.paused, AUD.state().ctx]); ok(bg[0] === true && bg[1] !== 'running', nm + ': backgrounding pauses the run and suspends audio (' + bg + '; before ' + pre + ')');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(300);
  await snap(p, nm + '-paused');
  await p.close();
}
console.log('SHOTS', shots.length); console.log('ERRORS', JSON.stringify(errors), 'FAILS', fails.length); await b.close(); process.exit(fails.length || errors.length ? 1 : 0);
