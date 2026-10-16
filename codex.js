'use strict';
// Grimoire Ascent — the Codex: browse every page by category and rarity. Pages you have never owned show as silhouettes;
// discovery is saved in localStorage. Any ?debug=… flag reveals everything. Opened from the Mage Hall and the pause menu.
const CODEX_KEY = 'grimoire-codex';
const CODEX_IDS = [...new Set(CARD_POOL.concat(RARE_POOL, ['bloodwax'], LEGENDARY, typeof MYTHIC !== 'undefined' ? MYTHIC : []))].filter(id => CARDS[id] && !CARDS[id].hidden);
const CODEX_CAT = [['all', 'All pages'], ['proj', 'Attack'], ['mod', 'Glyph'], ['multi', 'Chant'], ['trig', 'Trigger'], ['sigil', 'Sigil'], ['rare', 'Rare'], ['curse', 'Forbidden']];
const CODEX_RAR = [['all', 'Any rarity'], ['1', 'Common'], ['2', 'Uncommon'], ['3', 'Rare'], ['4', 'Legendary'], ['5', 'Mythic']];
let CODEX = new Set(); try { CODEX = new Set(JSON.parse(localStorage.getItem(CODEX_KEY) || '[]')); } catch (e) { }
const codexRevealAll = () => !!DEBUG;
const codexKnown = id => codexRevealAll() || CODEX.has(id);
function codexSave() { try { localStorage.setItem(CODEX_KEY, JSON.stringify([...CODEX])); } catch (e) { } }
function codexDiscover(ids) { let n = 0; for (const id of ids) if (id && CARDS[id] && CODEX_IDS.includes(id) && !CODEX.has(id)) { CODEX.add(id); n++; } if (n) codexSave(); return n; }
function codexScan() { if (!G) return 0; return codexDiscover((G.bag || []).concat(...(G.wands || []).map(w => w.slots || []))); } // a page counts as found once you own it
function codexPct() { const n = CODEX_IDS.filter(codexKnown).length; return { n, of: CODEX_IDS.length, pct: Math.floor(100 * n / CODEX_IDS.length) }; }
const cxCap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
const codexRar = c => c.myth ? 5 : c.leg ? 4 : c.rar || 1;
const CODEX_ST = { cat: 'all', rar: 'all', q: '', sel: null };
function codexSplit(c) { // description / drawback / curse
  let desc = c.desc || '', drawback = ''; const m = desc.match(/\s*Drawback:\s*(.*)$/); if (m) { drawback = m[1]; desc = desc.slice(0, m.index); }
  if (c.t === 'curse' && !drawback) { const k = desc.match(/^(?:CURSED|FORBIDDEN):\s*(.*)$/); if (k) { drawback = k[1]; desc = 'A forbidden page.'; } }
  const curse = c.curse && window.__mythic ? __mythic.myCurseOf(c.id || '') : null;
  return { desc, drawback, curse };
}
function codexList() {
  const q = CODEX_ST.q.trim().toLowerCase();
  return CODEX_IDS.filter(id => {
    const c = CARDS[id]; if (CODEX_ST.cat !== 'all' && c.t !== CODEX_ST.cat) return false; if (CODEX_ST.rar !== 'all' && String(codexRar(c)) !== CODEX_ST.rar) return false;
    if (!q) return true; if (!codexKnown(id)) return false; return (c.name + ' ' + (c.desc || '') + ' ' + (TYPE_NAME[c.t] || '') + ' ' + (RAR_NAME[codexRar(c)] || '') + ' ' + (c.el || '')).toLowerCase().includes(q);
  }).sort((a, b) => CODEX_CAT.findIndex(x => x[0] === CARDS[a].t) - CODEX_CAT.findIndex(x => x[0] === CARDS[b].t) || codexRar(CARDS[a]) - codexRar(CARDS[b]) || CARDS[a].name.localeCompare(CARDS[b].name));
}
function codexDetail(id) {
  const c = CARDS[id], k = codexKnown(id), r = codexRar(c), cls = c.myth ? ' myth' : c.leg ? ' leg' : '';
  if (!k) return `<div class="cxdet unk"><div class="cxbig sil">${c.icon}</div><div><b>Undiscovered page</b><em>${cxCap(RAR_NAME[r])} ${TYPE_NAME[c.t] || ''}</em><p>Find it on your climb to read it.</p></div></div>`;
  const s = codexSplit(c), cost = [c.mana ? c.mana + ' mana' : '0 mana', c.flame ? c.flame + ' HP' : '', c.delay ? '+' + c.delay + 's delay' : ''].filter(Boolean).join(' · ');
  return `<div class="cxdet${cls}"><div class="cxbig t-${c.t}">${c.icon}</div><div><b>${c.name}</b><em class="t-${c.t}">${r >= 4 ? '<span class="cxr r' + r + '">' + cxCap(RAR_NAME[r]) + '</span> ' : cxCap(RAR_NAME[r]) + ' · '}${TYPE_NAME[c.t] || ''}${c.el ? ' · ' + c.el : ''}</em><p class="cxcost">Cost: ${cost}</p><p>${s.desc}</p>${s.drawback ? `<p class="cxdraw">Drawback: ${s.drawback}</p>` : ''}${s.curse ? `<p class="cxcurse">Curse: ${s.curse.icon} ${s.curse.name} — ${s.curse.desc}</p>` : ''}${c.flav ? `<p class="flav">“${c.flav}”</p>` : ''}</div></div>`;
}
function codexGrid() {
  const L = codexList();
  return L.length ? L.map(id => { const c = CARDS[id], k = codexKnown(id), r = codexRar(c); return `<button class="cxe t-${c.t}${k ? '' : ' unk'}${r === 5 ? ' myth' : r === 4 ? ' leg' : ''}${CODEX_ST.sel === id ? ' on' : ''}" data-cx="${id}" title="${k ? c.name : 'Undiscovered'}"><i>${c.icon}</i><u>${k ? (SHORT[id] || c.name) : '???'}</u></button>`; }).join('') : '<p class="small cxnone">No pages match.</p>';
}
function showCodex(back) {
  codexScan(); const P_ = codexPct(); const prevMode = mode;
  if (prevMode !== 'room') mode = 'codex';
  panel(`<div class="cxhead"><h2>📜 Codex</h2><span class="cxpct" id="cxpct">${P_.pct}% · ${P_.n}/${P_.of}${codexRevealAll() ? ' · debug: all revealed' : ''}</span></div>
  <div class="cxbar"><i style="width:${P_.pct}%"></i></div>
  <div class="cxfilters"><input class="inp" id="cxq" type="search" placeholder="Search found pages…" value="${CODEX_ST.q.replace(/"/g, '&quot;')}" autocomplete="off" enterkeyhint="search">
  <select id="cxcat" aria-label="Category">${CODEX_CAT.map(([v, n]) => `<option value="${v}"${CODEX_ST.cat === v ? ' selected' : ''}>${n}</option>`).join('')}</select>
  <select id="cxrar" aria-label="Rarity">${CODEX_RAR.map(([v, n]) => `<option value="${v}"${CODEX_ST.rar === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
  <div id="cxdet">${CODEX_ST.sel ? codexDetail(CODEX_ST.sel) : '<div class="cxdet hint"><p>Tap a page to read it. Silhouettes are pages you have not found yet.</p></div>'}</div>
  <div class="cxgrid fitlist" id="cxgrid">${codexGrid()}</div>
  <button class="btn sub" id="cxback">Back</button>`, 'wide codex');
  const grid = UI.querySelector('#cxgrid'), det = UI.querySelector('#cxdet');
  const regrid = () => { grid.innerHTML = codexGrid(); };
  grid.addEventListener('click', e => { const b = e.target.closest('[data-cx]'); if (!b) return; CODEX_ST.sel = b.dataset.cx; det.innerHTML = codexDetail(CODEX_ST.sel); grid.querySelectorAll('.cxe.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); au('click'); });
  UI.querySelector('#cxq').addEventListener('input', e => { CODEX_ST.q = e.target.value; regrid(); });
  UI.querySelector('#cxcat').addEventListener('change', e => { CODEX_ST.cat = e.target.value; regrid(); });
  UI.querySelector('#cxrar').addEventListener('change', e => { CODEX_ST.rar = e.target.value; regrid(); });
  on('cxback', () => { if (prevMode !== 'room') mode = prevMode; (back || showCamp)(); });
}
// entry points: Mage Hall + pause menu; discovery hooks
{
  const _sc = showCamp; showCamp = function () { _sc(); const h = [...UI.querySelectorAll('.panel h2')].find(x => /Mage Hall/.test(x.textContent)); const P_ = codexPct(); const html = `<button class="btn sub" id="codexB">📜 Codex — ${P_.pct}% discovered</button>`; if (h) h.insertAdjacentHTML('afterend', html); else UI.querySelector('.panel').insertAdjacentHTML('beforeend', html); on('codexB', () => showCodex(showCamp)); };
  const _tp = togglePause; togglePause = function () { _tp(); if (!paused || !UI.querySelector('#res')) return; UI.querySelector('#res').insertAdjacentHTML('afterend', '<button class="btn sub" id="codexP">📜 Codex</button>'); on('codexP', () => showCodex(() => { paused = false; togglePause(); })); };
  const _sr = saveRun; saveRun = function () { _sr(); try { codexScan(); } catch (e) { } };
  const _bg = bagAdd; bagAdd = function (id) { const r = _bg(id); codexDiscover([id]); return r; };
}
window.__codex = { CODEX_IDS, codexPct, codexKnown, codexDiscover, codexScan, showCodex, CODEX_ST, codexList, reset() { CODEX = new Set(); codexSave(); } };
