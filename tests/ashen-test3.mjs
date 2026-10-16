import { createRequire } from 'module'; import http from 'http'; import fs from 'fs'; import path from 'path';
const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const root = '/workspace/ashen-pilgrim', OUT='/workspace/ashen-shots';
let base = process.argv[2], tag = process.argv[3] || 'local3', server;
if (!base) { server = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': {'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(f)] }); r.end(fs.readFileSync(f)); }); await new Promise(r => server.listen(0, r)); base = `http://localhost:${server.address().port}`; }
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const errs = []; const sleep = ms => new Promise(r => setTimeout(r, ms)); let fail = 0;
const check = (w, c, m) => { console.log(w, c ? 'PASS' : 'FAIL', m); if (!c) fail++; };
const CASES = [
  ['blackhole', ['blackhole'], 'kinds', ['blackhole']],
  ['quad', ['quad','missile','bubble','saw','lance'], 'kinds', ['missile','bubble','saw','lance']],
  ['circle', ['circle','spark','spark','spark','spark'], 'spreadAngles', 4],
  ['behind', ['behind','spark','spark'], 'spreadAngles', 2],
  ['expiry-nova', ['expiry','nova'], 'kinds', ['spark','nova']],
  ['meteor', ['meteor','addmana'], 'kinds', ['meteor']],
  ['death-split-acid', ['deathtrig','split','acid'], 'kinds', ['spark','acid']],
  ['orbit-wisp', ['orbit','sickle','wisp'], 'kinds', ['sickle','wisp']],
  ['mine-bolt', ['mine','bolt','poison','wave','spark'], 'kinds', ['mine','bolt','spark']],
  ['copy', ['copy','fireball','ice'], 'kinds', ['fireball','ice']],
  ['inverted', ['inverted','spark','larger','fireball'], 'desc', 'Blaze Orb ·'],
  ['n-quint-fang', ['quintchant','shadefang','shadefang','shadefang','shadefang','shadefang'], 'desc', 'Shade Fang + Shade Fang + Shade Fang + Shade Fang + Shade Fang'],
  ['n-hexa-needle', ['hexachant','emberneedle','emberneedle','emberneedle','emberneedle','emberneedle','emberneedle'], 'spreadAngles', 5],
  ['n-stormorb-gravity', ['gravityglyph','stormorb'], 'kinds', ['stormorb']],
  ['n-twin-spire', ['twinrelay','stonespire'], 'desc', 'Twin Relay → (Stone Spire)'],
  ['n-prism-crown', ['crownglyph','ricochetglyph','prismshard'], 'kinds', ['prismshard']],
  ['n-tide-echo', ['echoglyph','tidecrescent'], 'kinds', ['tidecrescent']],
  ['n-canon-ray', ['canonchant','dawnray','rimejavelin'], 'kinds', ['dawnray','rimejavelin']],
  ['n-seeker-briar', ['seekerrelay','hexglyph','briarseed'], 'desc', 'Seeker Relay → (Briar Seed [Hexing Glyph])'],
  ['n-mine-relay-gale', ['minerelay','galelash'], 'kinds', ['mine']],
  ['n-halo-hex', ['halochant','hexmote','hexmote','hexmote'], 'kinds', ['hexmote']],
  ['n-flank-frost-shatter', ['flankchant','frostrelay','shatterglyph','spark','rimejavelin'], 'kinds', ['ice','rimejavelin']],
  ['n-sigils-familiar', ['famsigil','flowsigil','aegissigil','volleychant','emberneedle','emberneedle','emberneedle'], 'kinds', ['emberneedle','spark']],
  ['accel-pingpong-crit', ['accel','pingpong','critburn','knock','lifesteal','chainmod','smallfast','spark'], 'kinds', ['spark']],
];
for (const [w,h,m] of [[390,844,true],[1280,800,false]]) {
  const pg = await b.newPage(); await pg.setViewport({ width: w, height: h, isMobile: m, hasTouch: m, deviceScaleFactor: m?3:1 });
  pg.on('console', x => x.type()==='error' && errs.push(w+': '+x.text())); pg.on('pageerror', e => errs.push(w+': '+e.message));
  await pg.goto(base + '/'); await pg.waitForFunction('window.__ready'); await sleep(300);
  await pg.click('#go'); await sleep(200);
  for (const [name, slots, kind, exp] of CASES) {
    await pg.evaluate((slots) => { const A=window.__ashen; const wd=A.G.wands[0]; wd.slots=[...slots, ...Array(Math.max(0,8-slots.length)).fill(null)]; wd.maxMana=400; wd.mana=400; wd.regen=200; wd.idx=0; A.editor(A.showMap); }, slots);
    const res = await pg.evaluate(async (N) => { const A=window.__ashen; const seen=new Set(), offs=new Set(); let maxShots=0; for(let i=0;i<N;i++){ const sh=A.preview.world.shots; maxShots=Math.max(maxShots,sh.length); for(const s of sh){ seen.add(s.kind); if(s.age<.05) offs.add(Math.round(Math.atan2(s.vy,s.vx)*10)); } await new Promise(r=>setTimeout(r,40)); } return { kinds:[...seen], offs:offs.size, desc: document.getElementById('castDesc').textContent, dmg: Math.round(A.preview.dummy.dmgTaken||0), maxShots }; }, name.startsWith('death') ? 150 : 50);
    let ok;
    if (kind==='kinds') ok = exp.every(k => res.kinds.includes(k)); else if (kind==='spreadAngles') ok = res.offs >= exp; else ok = res.desc.startsWith(exp);
    check(w, ok && !res.desc.startsWith('No'), `${name}: ${res.desc} | kinds ${res.kinds} | dmg to dummy ${res.dmg}`);
    if (['quad','blackhole','meteor','expiry-nova','orbit-wisp','mine-bolt','n-stormorb-gravity','n-hexa-needle','n-tide-echo','n-canon-ray','n-sigils-familiar','n-twin-spire'].includes(name)) { await pg.evaluate(() => window.edSetTab && edSetTab('pv')); const el = await pg.$('#pv'); await el.screenshot({ path: `${OUT}/${tag}-pv-${name}-${w}.png` }); }
  }
  await pg.screenshot({ path: `${OUT}/${tag}-editor-${w}x${h}.png` });
  // room fps with mixed spells (mobile: 4x CPU throttle)
  await pg.evaluate(() => { const A=window.__ashen; A.G.wands[0].slots=['quad','fireball','missile','saw','acid',null,null,null]; A.G.flame=9999; A.G.maxFlame=9999; document.getElementById('done').click(); });
  await pg.evaluate(() => { const A=window.__ashen; const st=A.G; [...document.querySelectorAll('[data-door]')].find(e=>['fight','elite'].includes(e.dataset.door)).click(); });
  const cdp = await pg.target().createCDPSession(); if (m) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await sleep(1500);
  await sleep(4500); const fps = await pg.evaluate(() => new Promise(r => { let n=0; const t0=performance.now(); const f=()=>{ n++; if (performance.now()-t0<2000) requestAnimationFrame(f); else r(n/2); }; requestAnimationFrame(f); }));
  await pg.screenshot({ path: `${OUT}/${tag}-room-${w}x${h}.png` });
  console.log(w, "room fps", fps, m ? "(4x CPU throttle), render DPR now " + await pg.evaluate(() => Math.round(document.getElementById("c").width / innerWidth * 10) / 10) : "");
  if (m) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await pg.close();
}
console.log('ERRORS', errs, 'FAILS', fail);
await b.close(); server && server.close();
