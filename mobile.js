'use strict';
// Grimoire Ascent — mobile layer: settings (volume, haptics, battery saver), PWA, safe areas, press-and-hold page info,
// no accidental zoom/scroll/selection, pause in the background, fullscreen.
QUAL.fps = SET.fps === 30 ? 30 : 60; QUAL.parts = SET.parts === 'low' ? 'low' : 'high';
// ---- haptics ----
const _hapT = {};
window.HAP = (ms, key) => {
  if (!SET.haptics || !navigator.vibrate) return; const now = performance.now(), gap = { cast: 160, hit: 120 }[key] || 60;
  if (key && now - (_hapT[key] || 0) < gap) return; _hapT[key] = now; try { navigator.vibrate(ms); } catch (e) { }
};
// ---- safe-area insets (notches) for the canvas HUD ----
const _probe = document.createElement('div'); _probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(_probe);
function readSafe() { const c = getComputedStyle(_probe), n = v => parseFloat(v) || 0; SAFE = { t: n(c.paddingTop), r: n(c.paddingRight), b: n(c.paddingBottom), l: n(c.paddingLeft) }; }
readSafe(); addEventListener('resize', readSafe); addEventListener('orientationchange', () => setTimeout(readSafe, 300));
// ---- no zoom / scroll / selection ----
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || !e.target.closest || !e.target.closest('.panel')) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (!e.target.closest || !e.target.closest('input')) e.preventDefault(); });
let _lastTouchEnd = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - _lastTouchEnd < 300 && !(e.target.closest && e.target.closest('input,button,.slot'))) e.preventDefault(); _lastTouchEnd = n; }, { passive: false });
// ---- pause when the app goes to the background ----
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    AUD.suspend();
    if (mode === 'room' && !paused && !(window.NET && NET.on)) togglePause(); // co-op never pauses the shared world
    try { saveRun(); } catch (e) { }
  } else AUD.resume();
});
// ---- press-and-hold a page chip for its full name + description ----
const TIP = document.createElement('div'); TIP.id = 'tip'; TIP.className = 'hidden'; document.body.appendChild(TIP);
let _lp = null; window.LP_ACTIVE = false;
function tipHtml(id) { const c = CARDS[id]; return `<div class="tiphead t-${c.t}"><i>${c.icon}</i><b>${c.name}</b></div><div class="tipmeta"><em class="t-${c.t}">${TYPE_NAME[c.t] || ''}</em>${c.leg ? ' · <b class="t-leg">legendary</b>' : c.myth ? ' · <b class="t-myth">mythic</b>' : (c.rar || 1) > 1 ? ' · ' + RAR_NAME[c.rar] : ' · common'}${c.mana ? ' · ' + c.mana + ' mana' : ''}${c.el ? ' · ' + c.el : ''}</div><p>${c.desc}</p>${c.curse && window.__mythic ? '<p class="cursetxt">' + __mythic.myCurseTxt(id) + '</p>' : ''}${c.flav ? '<p class="flav">“' + c.flav + '”</p>' : ''}`; }
function showTip(chip, x, y) { TIP.innerHTML = tipHtml(chip.dataset.card); TIP.classList.remove('hidden'); const w = Math.min(300, innerWidth - 20); TIP.style.width = w + 'px'; TIP.style.left = clamp(x - w / 2, 10, innerWidth - w - 10) + 'px'; TIP.style.top = Math.max(10 + SAFE.t, y - 150) + 'px'; HAP(10); }
function hideTip() { TIP.classList.add('hidden'); }
document.addEventListener('pointerdown', e => {
  hideTip(); const chip = e.target.closest && e.target.closest('.chip:not(.ghost)'); if (!chip) return;
  const x = e.clientX, y = e.clientY; clearTimeout(_lp && _lp.t);
  _lp = { x, y, id: e.pointerId, t: setTimeout(() => { LP_ACTIVE = true; const sl = chip.closest('.slot[data-loc]'); if (sl && window.__burn && document.getElementById('burnzone')) __burn.burnSheet(sl.dataset.loc, false); else showTip(chip, x, y); }, 430) };
}, true);
document.addEventListener('pointermove', e => { if (_lp && e.pointerId === _lp.id && Math.hypot(e.clientX - _lp.x, e.clientY - _lp.y) > 8) { clearTimeout(_lp.t); _lp = null; } }, true);
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { if (_lp) clearTimeout(_lp.t); _lp = null; if (LP_ACTIVE) setTimeout(hideTip, 900); }, true);
// ---- settings ----
function fsAvail() { return !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && !matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches; }
function toggleFS() { const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else { const el = d.documentElement; const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => { }); } }
function showSettings(back) {
  const sl = (k, label) => `<label class="srow"><span>${label}</span><input type="range" min="0" max="100" step="5" id="s_${k}" value="${Math.round(SET[k] * 100)}"><b id="v_${k}">${Math.round(SET[k] * 100)}</b></label>`;
  const tg = (k, label, on) => `<button class="btn sub tog ${on ? 'on' : ''}" id="t_${k}">${label}: <b>${on ? 'On' : 'Off'}</b></button>`;
  panel(`<h2>⚙ Settings</h2>${sl('master', 'Master')}${sl('music', 'Music')}${sl('sfx', 'Effects')}
  ${tg('mute', '🔇 Mute all', SET.mute)}${tg('haptics', '📳 Vibration on hits & casts', SET.haptics)}
  ${tg('saver', '🔋 Battery saver (30 fps, fewer particles)', SET.fps === 30)}${tg('parts', '✨ Particle detail high', SET.parts !== 'low')}
  ${fsAvail() ? '<button class="btn sub" id="fs">⛶ Full screen</button>' : ''}
  <p class="small">Tip: add Grimoire Ascent to your home screen to play it full screen and offline (co-op needs a connection). Press and hold any page for its full description.</p>
  <button class="btn hot" id="sdone">Done</button>`, 'settings');
  for (const k of ['master', 'music', 'sfx']) { const i = document.getElementById('s_' + k); i.oninput = () => { SET[k] = i.value / 100; document.getElementById('v_' + k).textContent = i.value; AUD.apply(); saveSet(); }; i.onchange = () => AUD.play(k === 'music' ? 'click' : 'pickup'); }
  on('t_mute', () => { SET.mute = !SET.mute; AUD.apply(); saveSet(); showSettings(back); });
  on('t_haptics', () => { SET.haptics = !SET.haptics; saveSet(); if (SET.haptics) HAP(20); showSettings(back); });
  on('t_saver', () => { const s = SET.fps !== 30; SET.fps = s ? 30 : 60; SET.parts = s ? 'low' : 'high'; QUAL.fps = SET.fps; QUAL.parts = SET.parts; saveSet(); showSettings(back); });
  on('t_parts', () => { SET.parts = SET.parts === 'low' ? 'high' : 'low'; QUAL.parts = SET.parts; saveSet(); showSettings(back); });
  on('fs', toggleFS);
  on('sdone', back);
}
window.showSettings = showSettings;
function addCampButtons() {
  const d = document.getElementById('daily'); if (!d || document.getElementById('settings')) return;
  const anchor = document.getElementById('coop') || d;
  anchor.insertAdjacentHTML('afterend', `<div class="row2"><button class="btn sub" id="settings">⚙ Settings</button>${fsAvail() ? '<button class="btn sub" id="fsB">⛶ Full screen</button>' : ''}</div>`);
  on('settings', () => showSettings(showCamp)); on('fsB', toggleFS);
}
const _campM = showCamp; showCamp = () => { _campM(); addCampButtons(); }; addCampButtons();
const _pauseM = togglePause;
togglePause = () => {
  _pauseM(); const r = document.getElementById('res'); if (!r || document.getElementById('setB')) return;
  r.insertAdjacentHTML('afterend', '<button class="btn sub" id="setB">⚙ Settings</button>');
  on('setB', () => showSettings(() => { if (window.NET && NET.on) { closeUI(); togglePause(); } else { paused = false; togglePause(); } }));
};
// ---- PWA: service worker caches by build version, network-first (never serves a stale build while online) ----
if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(e => console.warn('sw', e.message)));
window.__mobile = { SET, showSettings, readSafe, get safe() { return SAFE; }, hideTip };
