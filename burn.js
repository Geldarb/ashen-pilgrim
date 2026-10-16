'use strict';
// Grimoire Ascent — burning (discarding) pages in the grimoire editor.
// Drag a page onto the brazier, tap-select then tap the brazier, or press-and-hold a page → Burn.
// Burning refunds ✦ embers + flame (HP) by rarity; Legendary+ pages ask first; one-step undo while the editor stays open.
// Co-op guests: the refund is mirrored to the host (authoritative in a room) via {k:'burn'} / {k:'unburn'}.
const BURN = { last: null, n: 0, undos: 0 };
function burnRefund(id) {
  const r = (CARDS[id] && CARDS[id].rar) || 1;
  return r <= 4 ? { em: [0, 1, 2, 4, 10][r], fl: [0, 2, 3, 5, 10][r] } : { em: 10 * Math.pow(2, r - 4), fl: 10 + 5 * (r - 4) }; // future higher rarities scale on
}
const burnNeedsConfirm = id => ((CARDS[id] && CARDS[id].rar) || 1) >= 4;
const burnGuest = () => !!(window.NET && NET.on && !NET.host);
const BRAZIER_SVG = `<svg class="brazier" viewBox="0 0 64 64" aria-hidden="true">
<g class="flames"><path class="fl1" d="M32 6c5 9 13 14 11 25-1 6-6 9-11 9s-10-3-11-9c-1-8 5-11 6-17 3 4 2 8 5 9 1-6-2-11 0-17z"/>
<path class="fl2" d="M32 18c3 5 7 8 6 14-1 4-3 6-6 6s-6-2-6-6c0-4 3-6 3-9 2 2 2 4 3 5 1-3-1-6 0-10z"/></g>
<path class="bowl" d="M10 38h44c-1 9-9 14-22 14S11 47 10 38z"/><path class="rim" d="M8 36h48v4H8z"/>
<path class="leg" d="M22 51l-5 9h4l5-8zM42 51l5 9h-4l-5-8zM30 53h4v7h-4z"/></svg>`;
function burnZoneHtml() { // compact: lives on the editor's tab bar; still a >=48px drop target
  const L = BURN.last;
  return `${L ? `<button class="undo mini" id="burnUndo" title="Undo burning ${CARDS[L.id].name}" aria-label="Undo burn: ${CARDS[L.id].name}">↶<span>${CARDS[L.id].icon}</span></button>` : ''}<div class="burnzone mini" id="burnzone" role="button" tabindex="0" aria-label="Burn a page (drag a page here, or hold a page)" title="Burn: drag a page here, or hold a page">${BRAZIER_SVG}<b>Burn</b></div>`;
}
function burnInfo(html) { const p = UI.querySelector('#info'); if (p) { p.innerHTML = html; p.classList.remove('deny'); void p.offsetWidth; p.classList.add('pulse'); } }
// ---- the dissolve: a clone of the chip burns away from the top while embers fly ----
function burnFx(el, rar) {
  if (!el) return; const r = el.getBoundingClientRect(); if (!r.width) return;
  const c = el.cloneNode(true); c.className = el.className.replace(/\b(drag|ghost)\b/g, '') + ' burning'; c.removeAttribute('id');
  Object.assign(c.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0, zIndex: 140, pointerEvents: 'none', opacity: 1 });
  const line = document.createElement('div'); line.className = 'burnline'; c.appendChild(line); document.body.appendChild(c);
  const n = rar >= 4 ? 26 : 14, low = document.body.classList.contains('lowq'); // embers
  for (let i = 0; i < (low ? n >> 1 : n); i++) {
    const e = document.createElement('div'); e.className = 'ember' + (rar >= 4 ? ' gold' : '');
    const x = r.left + Math.random() * r.width, y = r.top + r.height * (.2 + Math.random() * .8);
    Object.assign(e.style, { left: x + 'px', top: y + 'px', animationDelay: (Math.random() * .35).toFixed(2) + 's' });
    e.style.setProperty('--dx', ((Math.random() - .5) * 70).toFixed(0) + 'px'); e.style.setProperty('--dy', (-40 - Math.random() * 90).toFixed(0) + 'px');
    document.body.appendChild(e); setTimeout(() => e.remove(), 1400);
  }
  setTimeout(() => c.remove(), 950);
  const z = document.getElementById('burnzone'); if (z) { z.classList.remove('flare'); void z.offsetWidth; z.classList.add('flare'); }
}
// ---- burn / undo ----
function burnPage(loc) {
  const id = getLoc(loc); if (!id) return false;
  const w = G.wands[edWand], rf = burnRefund(id), rar = (CARDS[id].rar || 1);
  burnFx(UI.querySelector(`[data-loc="${loc}"] .chip`), rar);
  setLoc(loc, null); if (edSel === loc) edSel = null;
  const fl = Math.max(0, Math.min(rf.fl, G.maxFlame - G.flame)); // record what was actually gained so undo is exact
  G.flame += fl; G.embersRun += rf.em;
  BURN.last = { id, loc, w, em: rf.em, fl }; BURN.n++;
  if (burnGuest()) toHost({ k: 'burn', id });
  au('burnPage', null, rar); buzz(rar >= 4 ? 60 : 25);
  try { saveRun(); } catch (e) { }
  editor();
  burnInfo(`🔥 Burned <b class="t-${CARDS[id].t}">${CARDS[id].icon} ${CARDS[id].name}</b> — +${rf.em} ✦ embers${fl ? `, +${fl} flame` : rf.fl ? ' (flame already full)' : ''}.`);
  return true;
}
function burnUndo() {
  const L = BURN.last; if (!L) return false;
  const wi = G.wands.indexOf(L.w);
  let to = null;
  if (L.loc[0] === 'w' && wi >= 0 && !L.w.slots[+L.loc.split(':')[1]]) { if (edWand !== wi) edWand = wi; to = L.loc; }
  else if (L.loc[0] === 'b' && !G.bag[+L.loc.split(':')[1]]) to = L.loc;
  else { const j = G.bag.indexOf(null); if (j >= 0) to = 'b:' + j; }
  if (!to) { burnInfo('Your satchel is full — make room to restore the page.'); au('lgDeny'); return false; }
  if (to[0] === 'w') { L.w.slots[+to.split(':')[1]] = L.id; L.w.idx = 0; } else G.bag[+to.split(':')[1]] = L.id;
  G.embersRun = Math.max(0, G.embersRun - L.em); G.flame = Math.max(1, G.flame - L.fl);
  BURN.last = null; BURN.undos++;
  if (burnGuest()) toHost({ k: 'unburn', id: L.id });
  au('burnUndo'); buzz(15);
  try { saveRun(); } catch (e) { }
  editor();
  burnInfo(`↶ Restored <b class="t-${CARDS[L.id].t}">${CARDS[L.id].icon} ${CARDS[L.id].name}</b>${to === L.loc ? '' : ' to your satchel'}.`);
  const s = UI.querySelector(`[data-loc="${to}"]`); if (s) s.classList.add('restored');
  return true;
}
// ---- sheet: press-and-hold → info + Burn; Legendary+ → confirmation ----
let burnSheetOpen = false;
const SHEET = document.createElement('div'); SHEET.id = 'burnsheet'; SHEET.className = 'hidden'; document.body.appendChild(SHEET);
function closeBurnSheet() { SHEET.classList.add('hidden'); SHEET.classList.remove('confirm'); burnSheetOpen = false; }
function burnSheet(loc, confirm) {
  const id = getLoc(loc); if (!id) return;
  const c = CARDS[id], rf = burnRefund(id), leg = burnNeedsConfirm(id);
  if (typeof hideTip === 'function') hideTip();
  SHEET.innerHTML = confirm
    ? `<div class="bshead">🔥 Burn a ${RAR_NAME[c.rar] || 'Legendary'} page?</div><div class="tiphead t-${c.t}"><i>${c.icon}</i><b>${c.name}</b></div><p class="bswarn">${c.name} will turn to ash. Legendary pages are rare finds — you can undo this only until you close the grimoire.</p>
       <div class="bsrow"><button class="btn sub" id="bsKeep">Keep it</button><button class="btn burnbtn" id="bsYes">🔥 Burn it <span>+${rf.em} ✦ · +${rf.fl} flame</span></button></div>`
    : `${tipHtml(id)}<div class="bsrow"><button class="btn sub" id="bsKeep">Cancel</button><button class="btn burnbtn" id="bsBurn">🔥 Burn <span>+${rf.em} ✦ · +${rf.fl} flame</span></button></div>`;
  SHEET.classList.remove('hidden'); SHEET.classList.toggle('confirm', !!confirm); SHEET.classList.toggle('leg', leg); burnSheetOpen = true; SHEET.dataset.loc = loc;
  const b = (sel, f) => { const e = SHEET.querySelector(sel); if (e) e.onclick = ev => { ev.stopPropagation(); f(); }; };
  b('#bsKeep', () => { closeBurnSheet(); au('click'); });
  b('#bsBurn', () => { closeBurnSheet(); burnAsk(loc); });
  b('#bsYes', () => { closeBurnSheet(); burnPage(loc); });
  if (confirm) au('lgDeny');
}
function burnAsk(loc) {
  const id = getLoc(loc); if (!id) return; closeBurnSheet();
  if (burnNeedsConfirm(id)) return burnSheet(loc, true);
  burnPage(loc);
}
document.addEventListener('pointerdown', e => { if (burnSheetOpen && !(e.target.closest && e.target.closest('#burnsheet'))) closeBurnSheet(); }, true);
document.addEventListener('keydown', e => { if (burnSheetOpen && e.key === 'Escape') closeBurnSheet(); });
// highlight the brazier while a dragged page hovers it
document.addEventListener('pointermove', e => {
  const z = document.getElementById('burnzone'); if (!z) return;
  const el = drag && drag.ghost ? document.elementFromPoint(e.clientX, e.clientY) : null;
  z.classList.toggle('hot', !!(el && el.closest('#burnzone')));
});
// ---- hook the editor: brazier + undo row, cleared when the editor is freshly opened ----
{
  const _editor = editor;
  editor = function (back) {
    if (back) BURN.last = null; closeBurnSheet();
    _editor(back);
    const bs = UI.querySelector('#bslots'); if (!bs) return;
    const slot = UI.querySelector('#burnslot'); if (slot) slot.innerHTML = burnZoneHtml(); else bs.insertAdjacentHTML('beforebegin', '<div class="burnrow">' + burnZoneHtml() + '</div>');
    const z = UI.querySelector('#burnzone');
    const tap = () => { if (edSel) burnAsk(edSel); else { burnInfo('Drag a page onto the brazier to burn it — or tap a page, then the brazier. On touch, press and hold a page.'); au('click'); } };
    z.addEventListener('click', tap); z.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
    const u = UI.querySelector('#burnUndo'); if (u) u.addEventListener('click', burnUndo);
    const d = UI.querySelector('#done'); if (d) d.addEventListener('click', () => { BURN.last = null; closeBurnSheet(); }, true);
  };
}
// ---- sounds ----
if (window.AUD && AUD.reg) AUD.reg(({ tone, noise, bell }) => ({
  burnPage: (p, rar = 1) => {
    noise(.55, .2, { f0: 600, f1: 3200, q: .9, a: .02 }); noise(.4, .12, { ft: 'lowpass', f0: 1800, f1: 300, at: .05 });
    [0, .07, .15, .22, .31].forEach(a => noise(.025, .1, { f0: 2500 + Math.random() * 2500, q: 3, at: a + Math.random() * .03 })); // crackle
    tone('sawtooth', 160, 70, .45, .05, { lp: 700 });
    if (rar >= 4) { bell(196, 1.2, .06, { at: .1 }); tone('sine', 98, 49, .9, .15, { at: .05 }); }
  },
  burnUndo: () => { noise(.3, .12, { f0: 3000, f1: 700, q: 1 }); tone('sine', 330, 660, .25, .08); bell(660, .4, .05, { at: .15 }); },
}), { burnPage: .08, burnUndo: .1 });
window.__burn = { BURN, burnRefund, burnNeedsConfirm, burnPage, burnUndo, burnAsk, burnSheet, closeBurnSheet, isOpen: () => burnSheetOpen };
