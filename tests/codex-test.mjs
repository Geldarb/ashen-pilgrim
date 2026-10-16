// Codex tests: Mage Hall + pause entry points, silhouettes for undiscovered pages, discovery % saved in localStorage,
// details (icon, name, rarity, cost, description, drawback, curse, flavour), filters, search, debug reveal, mobile fit.
// usage: node codex-test.mjs [baseUrl]   (default http://localhost:3999)
import { createRequire } from 'module'; const req = createRequire('/workspace/tools/'); const puppeteer = req('puppeteer-core');
const base = process.argv[2] || 'http://localhost:3999', SH = '/workspace/ashen-shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const res = [], errs = []; const ok = (id, c, m) => { res.push({ id, ok: !!c, m }); console.log(c ? 'ok  ' : 'FAIL', id, m); };
const pg = await b.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const load = async (q = '') => { await pg.goto(base + '/' + q, { timeout: 90000 }); await pg.waitForFunction('window.__ready', { timeout: 90000 }); await sleep(300); };
await load(); await pg.evaluate(() => { localStorage.clear(); }); await load(); await pg.evaluate(() => showCamp());
const E = f => pg.evaluate(f);
// fresh profile
let r = await E(() => { const X = __codex; return { n: X.CODEX_IDS.length, pct: X.codexPct(), btn: (document.getElementById('codexB') || {}).textContent, myth: X.CODEX_IDS.filter(id => __ashen.CARDS[id].myth).length, leg: X.CODEX_IDS.filter(id => __ashen.CARDS[id].leg).length }; });
ok('entries', r.n > 120 && r.myth === 12 && r.leg >= 18, `codex lists every page: ${r.n} (incl. ${r.leg} Legendary, ${r.myth} Mythic)`);
ok('mage hall', /Codex — 0% discovered/.test(r.btn || ''), 'Mage Hall has a Codex button with discovery %: ' + r.btn);
await pg.tap('#codexB'); await sleep(250);
r = await E(() => ({ unk: document.querySelectorAll('#cxgrid .cxe.unk').length, all: document.querySelectorAll('#cxgrid .cxe').length, names: [...document.querySelectorAll('#cxgrid .cxe.unk u')].map(x => x.textContent).slice(0, 3), pct: document.getElementById('cxpct').textContent }));
ok('silhouettes', r.unk === r.all && r.all > 120 && r.names.every(n => !/[a-z]{3}/i.test(n)), `all ${r.all} pages are silhouettes on a fresh profile (labels: ${r.names.join(' ')}) · ${r.pct}`);
await pg.screenshot({ path: SH + 'codex-390-silhouettes.png' });
await pg.tap('#cxgrid .cxe.unk'); await sleep(150);
r = await E(() => document.getElementById('cxdet').textContent);
ok('unknown detail', /Undiscovered page/.test(r) && !/Cost:/.test(r), 'tapping a silhouette reveals only rarity + type: ' + r.trim().slice(0, 60));
// discovery through a run
r = await E(() => { newRun('pilgrim'); saveRun(); const p = __codex.codexPct(); return { p, ls: JSON.parse(localStorage.getItem('grimoire-codex') || '[]') }; });
ok('discover start', r.p.n >= 2 && r.ls.length === r.p.n, `starting pages discovered on owning them: ${r.p.n} (${r.p.pct}%), saved in localStorage`);
r = await E(() => { bagAdd('requiem'); bagAdd('covenant'); bagAdd('bloodwax'); G.mythicRun = 'covenant'; return { a: __codex.codexKnown('requiem'), b: __codex.codexKnown('covenant'), c: __codex.codexKnown('godfall') }; });
ok('discover bag', r.a && r.b && !r.c, 'a page added to the satchel is discovered (Requiem, Covenant), others stay hidden (Godfall)');
await load();
r = await E(() => ({ a: __codex.codexKnown('requiem'), b: __codex.codexKnown('covenant'), p: __codex.codexPct() }));
ok('persist', r.a && r.b && r.p.n >= 4, `discovery survives a reload (${r.p.n}/${r.p.of} · ${r.p.pct}%)`);
await E(() => { showCamp(); document.getElementById('codexB').click(); });
await sleep(200);
// details
const det = async id => { await pg.tap(`#cxgrid [data-cx="${id}"]`); await sleep(120); return E(() => ({ t: document.getElementById('cxdet').textContent, h: document.getElementById('cxdet').innerHTML })); };
r = await det('requiem');
ok('detail legendary', /Requiem/.test(r.t) && /Legendary/i.test(r.t) && /Cost: \d+ mana/.test(r.t) && /Drawback:/.test(r.t) && /“.+”/.test(r.t) && /cxbig/.test(r.h), 'Legendary detail: icon, name, rarity, cost, description, drawback, flavour');
await pg.screenshot({ path: SH + 'codex-390-detail-legendary.png' });
r = await det('covenant'); const covCost = (r.t.match(/Cost: [^·A-Z]*/) || [''])[0];
ok('detail mythic', /Covenant of Ruin/.test(r.t) && /50% of max flame/.test(covCost) && /Mythic/.test(r.t) && /Curse:/.test(r.t) && /cxdet myth/.test(r.h), 'Mythic detail shows its cost (' + covCost.trim() + '), curse and the prismatic class: ' + (r.t.match(/Curse:[^“]*/) || [''])[0].slice(0, 70));
await pg.screenshot({ path: SH + 'codex-390-detail-mythic.png' });
r = await det('bloodwax');
ok('detail forbidden', /Drawback: .*HP/.test(r.t) && /Cost: 3 HP \(no mana\)/.test(r.t), 'Forbidden page detail shows its drawback: ' + r.t.trim().slice(0, 80));
// filters + search
const setSel = (id, v) => E(`(() => { const s = document.getElementById('${id}'); s.value = '${v}'; s.dispatchEvent(new Event('change')); return [...document.querySelectorAll('#cxgrid .cxe')].map(e => e.className); })()`);
let cls = await setSel('cxcat', 'mod'); ok('filter category', cls.length > 10 && cls.every(c => c.includes('t-mod')), `category filter Glyph → ${cls.length} glyph pages`);
cls = await setSel('cxrar', '5'); ok('filter rarity', cls.length === 6 && cls.every(c => c.includes('myth')), `Glyph + Mythic → ${cls.length} Mythic glyphs`);
await setSel('cxcat', 'all'); cls = await setSel('cxrar', '4'); ok('filter legendary', cls.length >= 18 && cls.every(c => c.includes(' leg')), `Legendary filter → ${cls.length}`);
await setSel('cxrar', 'all');
await pg.tap('#cxq'); await pg.type('#cxq', 'requ'); await sleep(150);
r = await E(() => [...document.querySelectorAll('#cxgrid .cxe')].map(e => e.dataset.cx));
ok('search', r.length === 1 && r[0] === 'requiem', 'search "requ" → ' + r.join(','));
await pg.screenshot({ path: SH + 'codex-390-search.png' });
r = await E(() => { const s = document.getElementById('cxq'); s.value = 'godfall'; s.dispatchEvent(new Event('input')); return document.querySelectorAll('#cxgrid .cxe').length; });
ok('search hidden', r === 0, 'search never reveals undiscovered pages (godfall → ' + r + ' results)');
r = await E(() => { const s = document.getElementById('cxq'); s.value = ''; s.dispatchEvent(new Event('input')); const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); s.dispatchEvent(k); return { n: document.querySelectorAll('#cxgrid .cxe').length, open: !!document.getElementById('cxgrid') }; });
ok('typing safe', r.open && r.n > 120, 'typing in the search box does not trigger game hotkeys');
await pg.tap('#cxback'); await sleep(200);
ok('back', await E(() => !!document.getElementById('codexB') && __ashen.mode === 'camp'), 'Back returns to the Mage Hall');
// pause menu
await E(() => { newRun('pilgrim'); enterDoor('fight'); }); await sleep(700);
await E(() => togglePause()); await sleep(150);
ok('pause button', await E(() => !!document.getElementById('codexP')), 'pause menu has a Codex button');
await pg.tap('#codexP'); await sleep(250);
r = await E(() => ({ cx: !!document.getElementById('cxgrid'), mode: __ashen.mode, paused }));
ok('pause codex', r.cx && r.mode === 'room' && r.paused, 'Codex opens from pause; the run stays paused');
await pg.screenshot({ path: SH + 'codex-390-pause.png' });
await pg.tap('#cxback'); await sleep(200);
ok('pause back', await E(() => !!document.getElementById('res') && paused), 'Back returns to the pause menu');
// debug reveal
await load('?debug=legendary');
r = await E(() => { showCamp(); document.getElementById('codexB').click(); return { p: __codex.codexPct(), unk: document.querySelectorAll('#cxgrid .cxe.unk').length, t: document.getElementById('cxpct').textContent }; });
ok('debug', r.p.pct === 100 && r.unk === 0 && /debug/.test(r.t), 'debug mode reveals everything: ' + r.t);
await pg.screenshot({ path: SH + 'codex-390-debug.png' });
r = await E(() => { const s = document.getElementById('cxrar'); s.value = '5'; s.dispatchEvent(new Event('change')); return document.querySelectorAll('#cxgrid .cxe.myth:not(.unk)').length; });
ok('debug mythic', r === 12, 'debug: all 12 Mythics visible under the Mythic filter');
await pg.tap('#cxgrid [data-cx="eclipsechoir"]'); await sleep(150); await pg.screenshot({ path: SH + 'codex-390-debug-mythic.png' });
// small phone + landscape fit
for (const [w, h] of [[360, 640], [844, 390]]) {
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(400);
  r = await E(() => { const p = document.querySelector('#ui>.panel'), g = document.getElementById('cxgrid'), rc = p.getBoundingClientRect(); return { doc: document.scrollingElement.scrollHeight <= innerHeight, fit: p.scrollHeight <= p.clientHeight + 1 && rc.bottom <= innerHeight + 1, gh: g.clientHeight, gs: g.scrollHeight }; });
  ok('fit ' + w + 'x' + h, r.doc && r.fit && r.gh >= 50, `codex fits ${w}x${h} without page scroll; the grid scrolls inside (${r.gh}px of ${r.gs}px)`);
  await pg.screenshot({ path: SH + `codex-${w}x${h}.png` });
}
await b.close();
const fail = res.filter(x => !x.ok); console.log('errors:', errs.length ? errs : 'none');
console.log(`${res.length - fail.length}/${res.length} checks passed` + (fail.length ? '' : ' — ALL OK')); process.exit(fail.length || errs.length ? 1 : 0);
