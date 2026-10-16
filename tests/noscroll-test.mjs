// "No scrolling anywhere": every screen must fit the viewport at 360x640, 360x780, 390x844, 844x390 and desktop.
// Checks per screen: document scrollHeight <= innerHeight (and width), window cannot scroll, the panel lies inside the
// viewport and does not overflow/clip (scrollHeight <= clientHeight), and only .fitlist lists may scroll inside a panel.
// usage: node noscroll-test.mjs [baseUrl]   (default http://localhost:3999)   screenshots: /workspace/ashen-shots/noscroll/
import { createRequire } from 'module'; const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999', SH = '/workspace/ashen-shots/noscroll/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [[360, 640, 1], [360, 780, 1], [390, 844, 1], [844, 390, 1], [1280, 800, 0]];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const res = [], errs = [], zooms = {};
const ok = (id, c, m) => { res.push({ id, ok: !!c, m }); if (!c) console.log('FAIL', id, m); };
const measure = pg => pg.evaluate(() => {
  const se = document.scrollingElement, H = innerHeight, W = innerWidth; scrollTo(0, 99999); const sy = scrollY; scrollTo(0, 0);
  const o = { sh: se.scrollHeight, bh: document.body.scrollHeight, sw: se.scrollWidth, H, W, sy };
  const p = document.querySelector('#ui > .panel');
  if (p) { const r = p.getBoundingClientRect(); const z = parseFloat(p.style.zoom || 1);
    o.p = { top: r.top, bot: r.bottom, left: r.left, right: r.right, sh: p.scrollHeight, ch: p.clientHeight, sw: p.scrollWidth, cw: p.clientWidth, z };
    o.bad = [...p.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1 && !e.closest('.fitlist'); }).map(e => e.id || e.className).slice(0, 3);
    o.lists = [...p.querySelectorAll('.fitlist')].map(e => ({ id: e.id || e.className, ch: e.clientHeight, sh: e.scrollHeight }));
  }
  o.tag = document.querySelector('#ui > .panel') ? (document.querySelector('#ui > .panel h2') || {}).textContent || '' : 'mode:' + window.__ashen.mode;
  return o;
});
for (const [w, h, mob] of SIZES) {
  const tag = w + 'x' + h;
  for (const dbg of ['', '?debug=mythic']) {
    const pg = await b.newPage(); pg.on('pageerror', e => errs.push(tag + ' ' + e.message)); pg.on('console', m => m.type() === 'error' && !/WebSocket|ERR_/.test(m.text()) && errs.push(tag + ' ' + m.text()));
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: !!mob, hasTouch: !!mob });
    await pg.goto(base + '/' + dbg, { timeout: 90000 }); await pg.waitForFunction('window.__ready', { timeout: 90000 }); await sleep(300);
    const screens = dbg ? [
      ['debug-camp', 'showCamp()'], ['debug-codex', 'showCamp(); document.getElementById("codexB").click()'],
      ['debug-editor', 'newRun("pilgrim"); editor(showMap)'], ['debug-editor-w2', 'edWand = Math.min(1, G.wands.length - 1); editor(showMap)'],
      ['debug-burnsheet', 'editor(showMap); const c = document.querySelector("#bslots .chip[data-card]") || document.querySelector(".slot .chip[data-card]"); __burn.burnSheet && c && __burn.burnSheet(c.dataset.card, c)'],
      ['mythic-offer', 'G.mythicRun = null; __mythic.myOffer("The final page", "A Mythic page lies here.", 0, showMap)'],
      ['archive', '__mythic.myArchive()'],
    ] : [
      ['camp', 'showCamp()'], ['codex', 'showCamp(); document.getElementById("codexB").click()'], ['codex-legendary-filter', 'const s = document.getElementById("cxrar"); s.value = "4"; s.dispatchEvent(new Event("change"))'],
      ['settings', 'showSettings(showCamp)'], ['coop-menu', 'coopMenu()'], ['lobby', 'coopMenu(); document.getElementById("hostB").click()', '#rc'],
      ['camp-again', 'leaveCoop(); showCamp()'], ['map', 'newRun("pilgrim")'], ['editor', 'editor(showMap)'], ['reward', 'stepRng("t"); reward("Spoils of battle", .5)'],
      ['reward-boss', 'stepRng("b"); reward("Boss defeated! Claim a reward", .6, { leg: 1, orn: 1 })'], ['shrine', 'stepRng("s"); shrine()'], ['merchant', 'stepRng("m"); merchant()'], ['treasure', 'stepRng("tr"); treasure()'],
      ['room', 'showMap(); enterDoor("fight")', null, 900], ['pause', 'togglePause()'], ['pause-codex', 'document.getElementById("codexP").click()'],
      ['pause-settings', 'closeUI(); paused = false; togglePause(); document.getElementById("setB") && document.getElementById("setB").click()'],
      ['death', 'paused = false; closeUI(); die(true)'], ['victory', 'newRun("pilgrim"); G.floor = 3; victory()'],
    ];
    for (const [name, js, wait, ms] of screens) {
      try { await pg.evaluate(js); } catch (e) { ok(tag + ' ' + name, false, 'script error ' + e.message); continue; }
      if (wait) { try { await pg.waitForSelector(wait, { timeout: 15000 }); } catch (e) { ok(tag + ' ' + name, false, 'did not appear: ' + wait); continue; } }
      await sleep(ms || 250);
      const m = await measure(pg); const id = tag + ' ' + name;
      ok(id, m.sh <= m.H && m.bh <= m.H && m.sw <= m.W && m.sy === 0, `document fits: scrollHeight ${m.sh} <= ${m.H}, width ${m.sw} <= ${m.W}, scrollY ${m.sy}`);
      if (m.p) {
        ok(id, m.p.top >= -1 && m.p.bot <= m.H + 1 && m.p.left >= -1 && m.p.right <= m.W + 1, `panel inside viewport (${Math.round(m.p.top)}..${Math.round(m.p.bot)} of ${m.H})`);
        ok(id, m.p.sh <= m.p.ch + 1 && m.p.sw <= m.p.cw + 1, `panel itself does not scroll/clip (${m.p.sh} <= ${m.p.ch}) zoom ${m.p.z}`);
        ok(id, !m.bad.length, 'no scrolling outside .fitlist lists ' + m.bad.join(','));
        zooms[id] = m.p.z;
      }
      await pg.screenshot({ path: SH + tag + '-' + name + '.png' });
    }
    await pg.close();
  }
}
await b.close();
const fail = res.filter(r => !r.ok);
const zs = Object.entries(zooms).filter(([, z]) => z < 1).map(([k, z]) => k + '=' + z);
console.log('scaled screens:', zs.length ? zs.join(' | ') : 'none');
console.log('errors:', errs.length ? errs : 'none');
console.log(`${res.length - fail.length}/${res.length} checks passed` + (fail.length ? '' : ' — ALL OK'));
process.exit(fail.length || errs.length ? 1 : 0);
