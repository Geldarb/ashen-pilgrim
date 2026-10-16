'use strict';
// Grimoire Ascent — "no scrolling anywhere": every screen fits the viewport (100dvh, body locked).
// Panels are flex columns; long lists (.fitlist: satchel, codex grid, reward lists) shrink and scroll inside
// themselves; if a panel still does not fit, it is scaled down (CSS zoom) just enough to fit. Re-fits on every
// render (MutationObserver on #ui) and on resize / orientation change / visualViewport changes.
const FIT = { minZoom: .55, last: 1, runs: 0 };
function fitPanel() {
  const p = UI.querySelector(':scope > .panel'); if (!p) return;
  FIT.runs++;
  p.style.zoom = ''; p.style.removeProperty('--fz'); p.style.maxHeight = ''; p.style.height = ''; p.classList.remove('cols');
  const cs = getComputedStyle(UI), availH = UI.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), availW = UI.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  p.style.maxHeight = availH + 'px';
  let z = 1;
  // short landscape screens: if the panel does not fit at ~85%, flow it into two columns first
  if (availW > availH * 1.4 && p.scrollHeight > p.clientHeight / .85 && !p.classList.contains('nocols')) {
    p.classList.add('cols'); p.style.height = availH + 'px';
    if (p.scrollWidth <= p.clientWidth + 1 && p.scrollHeight <= p.clientHeight + 1) { FIT.last = 1; p.dataset.zoom = 1; return; }
  }
  const cols = p.classList.contains('cols');
  const fits = z => { p.style.zoom = z; p.style.setProperty('--fz', z); p.style.maxHeight = (availH / z) + 'px'; if (cols) p.style.height = (availH / z) + 'px'; return p.scrollHeight <= p.clientHeight + 1 && p.scrollWidth <= p.clientWidth + 1; };
  if (!fits(1)) { // largest zoom that fits (binary search, 7 layouts max)
    let lo = FIT.minZoom, hi = 1;
    for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    z = Math.floor(lo * 100) / 100; fits(z);
  }
  FIT.last = z; p.dataset.zoom = z;
}
let _fitQ = 0;
const fitSoon = () => { if (_fitQ) return; _fitQ = requestAnimationFrame(() => { _fitQ = 0; fitPanel(); }); };
new MutationObserver(fitSoon).observe(UI, { childList: true, subtree: true });
addEventListener('resize', fitSoon); addEventListener('orientationchange', () => setTimeout(fitPanel, 200));
if (window.visualViewport) visualViewport.addEventListener('resize', fitSoon);
document.addEventListener('scroll', () => { if (document.scrollingElement && document.scrollingElement.scrollTop) document.scrollingElement.scrollTop = 0; }, true);
// tag the lists that may scroll inside a panel
{
  const _p = panel; panel = function (html, cls) { _p(html, cls); const P_ = UI.querySelector('.panel'); if (!P_) return; P_.querySelectorAll('#bslots, .cards').forEach(el => el.classList.add('fitlist')); fitPanel(); };
}
window.__fit = { fitPanel, FIT };
