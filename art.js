'use strict';
// ===== Grimoire Ascent — art: dark gothic, ember-lit, crisp (no shadowBlur; banded light sprites at device resolution) =====
let bg = null;
const OUT = '#0b0906', INK = '#0b0906';
function poly(pts) { cx.beginPath(); cx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) cx.lineTo(pts[i], pts[i + 1]); cx.closePath(); }
function ell(x, y, rx, ry, rot = 0) { cx.beginPath(); cx.ellipse(x, y, rx, ry, rot, 0, TAU); }
function inkPath(fill, w = 1.2) { cx.fillStyle = fill; cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = w; cx.lineJoin = 'round'; cx.stroke(); }
// ---- crisp banded light sprites, cached per colour/radius at device pixel size ----
const lightCache = new Map();
function lightSprite(rgb, pxIn) {
  const px = Math.max(4, Math.round(pxIn / 4) * 4), key = rgb + '|' + px;
  let c = lightCache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = px * 2;
  const g = c.getContext('2d');
  // hard-edged concentric bands: crisp at any DPR, reads as warm lamplight
  const bands = []; for (let i = 0; i < 9; i++) bands.push([1 - i * .1, .028 + i * .006]);
  for (const [k, a] of bands) { g.fillStyle = `rgba(${rgb},${a})`; g.beginPath(); g.arc(px, px, px * k, 0, TAU); g.fill(); }
  lightCache.set(key, c); return c;
}
function light(x, y, r, rgb, a = 1) {
  const m = cx.getTransform(), s = lightSprite(rgb, r * m.a), px = s.width / 2;
  const sx = Math.round(m.a * x + m.e - px), sy = Math.round(m.d * y + m.f - px);
  cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = a; cx.imageSmoothingEnabled = false;
  cx.drawImage(s, sx, sy); cx.restore();
}
// crisp glowing dot: bright core + one hard halo (replaces shadowBlur)
function glowDot(x, y, r, core, halo) { cx.fillStyle = halo; cx.beginPath(); cx.arc(x, y, r * 1.9, 0, TAU); cx.fill(); cx.fillStyle = core; cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill(); }

// original leaf/clover crest (n leaves around a small boss) — never any existing logo
function leafCrest(g, x, y, s, n, col) {
  g.save(); g.translate(x, y); g.fillStyle = col;
  for (let i = 0; i < n; i++) { g.save(); g.rotate(-Math.PI / 2 + i * TAU / n); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-s * .6, -s * .35, -s * .55, -s, 0, -s * 1.05); g.bezierCurveTo(s * .55, -s, s * .6, -s * .35, 0, 0); g.fill(); g.restore(); }
  g.beginPath(); g.arc(0, 0, s * .22, 0, TAU); g.fill(); g.restore();
}
function buildBG() {
  bg = document.createElement('canvas'); bg.width = Math.round(SW * DPR); bg.height = Math.round(SH * DPR);
  const g = bg.getContext('2d'); g.scale(bg.width / W, bg.height / H);
  const B = biome(), C = B.pal, r = mulberry(hashStr(B.name)), A = arena(), [br, bgc, bb] = C.block, [tr, tg, tb] = C.tile;
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  const wallH = A.y0 + 10;
  // back wall: ashlar stone blocks
  const wg = g.createLinearGradient(0, 0, 0, wallH); wg.addColorStop(0, C.wallTop); wg.addColorStop(1, C.wallBot); g.fillStyle = wg; g.fillRect(0, 0, W, wallH);
  for (let y = 0, row = 0; y < wallH; y += 14, row++) for (let x = (row % 2) * -16; x < W; x += 32) { const v = r(); g.fillStyle = `rgba(${br + v * 25 | 0},${bgc + v * 20 | 0},${bb + v * 14 | 0},${.12 + (y / wallH) * .25})`; g.fillRect(x + 1, y + 1, 30, 12); }
  const archW = 70, nA = Math.max(3, Math.round(W / archW)), aw = W / nA;
  for (let i = 0; i < nA; i++) {
    const x = i * aw + aw / 2, wTop = wallH * 0.2, wBot = wallH - 10, ww = aw * 0.42;
    const arch = () => { g.beginPath(); g.moveTo(x - ww / 2, wBot); g.lineTo(x - ww / 2, wTop + ww * .6); g.quadraticCurveTo(x - ww / 2, wTop, x, wTop - ww * .25); g.quadraticCurveTo(x + ww / 2, wTop, x + ww / 2, wTop + ww * .6); g.lineTo(x + ww / 2, wBot); g.closePath(); };
    // stone surround
    g.save(); g.translate(x, 0); g.scale(1.28, 1); g.translate(-x, 0); arch(); g.fillStyle = C.surround; g.fill(); g.restore();
    arch(); const lg = g.createLinearGradient(0, wTop, 0, wBot); lg.addColorStop(0, C.win[0]); lg.addColorStop(.6, C.win[1]); lg.addColorStop(1, C.win[2]); g.fillStyle = lg; g.fill();
    // leaded tracery
    g.strokeStyle = '#141410'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, wTop - ww * .2); g.lineTo(x, wBot);
    for (let k = 1; k < 4; k++) { const yy = wTop + (wBot - wTop) * k / 4; g.moveTo(x - ww / 2, yy); g.lineTo(x + ww / 2, yy); } g.stroke();
    g.fillStyle = C.winHi; g.fillRect(x - ww / 2 + 2, wTop + ww * .3, ww / 2 - 3, (wBot - wTop) * .25);
    g.strokeStyle = '#5a5442'; g.lineWidth = 2; arch(); g.stroke();
    g.fillStyle = C.ledge; g.fillRect(x - ww / 2 - 4, wBot, ww + 8, 4); // sill
    // buttress pillar with capital
    g.fillStyle = C.pillar; g.fillRect(i * aw - 6, 0, 12, wallH); g.fillStyle = C.pillarL; g.fillRect(i * aw - 6, 0, 3, wallH); g.fillStyle = C.ledge; g.fillRect(i * aw - 8, wallH * .25, 16, 4);
    // tattered banner on every other pillar
    if (i % 2 === 1 && wallH > 60) { const bx = i * aw, by = wallH * .3; g.fillStyle = C.banner; g.beginPath(); g.moveTo(bx - 7, by); g.lineTo(bx + 7, by); g.lineTo(bx + 7, by + 26); g.lineTo(bx + 3, by + 21); g.lineTo(bx, by + 28); g.lineTo(bx - 3, by + 22); g.lineTo(bx - 7, by + 27); g.closePath(); g.fill(); g.fillStyle = C.trim; g.fillRect(bx - 7, by, 14, 2); leafCrest(g, bx, by + 13, 4.2, 3 + (i % 3), C.trim); }
  }
  g.fillStyle = C.ledge; g.fillRect(0, wallH - 7, W, 5); g.fillStyle = '#1a1813'; g.fillRect(0, wallH - 2, W, 4);
  // floor flagstones with bevels, cracks, moss and puddles
  const fg = g.createLinearGradient(0, A.y0, 0, H); fg.addColorStop(0, C.floorTop); fg.addColorStop(1, C.floorBot); g.fillStyle = fg; g.fillRect(0, wallH + 2, W, H - wallH);
  const ts = 40;
  for (let y = wallH + 2, row = 0; y < H; y += ts, row++) for (let x = (row % 2) * -ts / 2; x < W; x += ts) {
    const v = r();
    g.fillStyle = `rgb(${tr + v * 18 | 0},${tg + v * 16 | 0},${tb + v * 12 | 0})`; g.fillRect(x + 1, y + 1, ts - 2, ts - 2);
    g.fillStyle = 'rgba(255,240,200,.06)'; g.fillRect(x + 1, y + 1, ts - 2, 2); g.fillRect(x + 1, y + 1, 2, ts - 2); // top-left bevel
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 1, y + ts - 3, ts - 2, 2); g.fillRect(x + ts - 3, y + 1, 2, ts - 2);
    if (r() < .18) { g.strokeStyle = 'rgba(8,8,5,.75)'; g.lineWidth = 1; g.beginPath(); let px = x + r() * ts, py = y + 2; g.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (r() - .5) * 14; py += ts / 3; g.lineTo(px, py); } g.stroke(); }
    if (r() < .12) { g.fillStyle = C.moss; for (let k = 0; k < 5; k++) g.fillRect(x + r() * ts | 0, y + ts - 4 - r() * 6 | 0, 2 + r() * 4 | 0, 2); }
    if (r() < .04) { g.fillStyle = 'rgba(70,90,80,.35)'; g.beginPath(); g.ellipse(x + ts / 2, y + ts / 2, 12, 5, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(200,220,200,.12)'; g.fillRect(x + ts / 2 - 6, y + ts / 2 - 2, 5, 1); }
  }
  // props: skulls, bones, candle clusters, chains, rubble
  const skull = (x, y) => { g.fillStyle = '#b8b095'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); g.fillRect(x - 2.5, y + 2, 5, 3); g.fillStyle = '#1a1612'; g.fillRect(x - 2.5, y - 1, 2, 2); g.fillRect(x + .5, y - 1, 2, 2); };
  const bone = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#a8a088'; g.fillRect(-6, -1, 12, 2); g.beginPath(); g.arc(-6, -1, 1.6, 0, TAU); g.arc(-6, 1, 1.6, 0, TAU); g.arc(6, -1, 1.6, 0, TAU); g.arc(6, 1, 1.6, 0, TAU); g.fill(); g.restore(); };
  const candles = (x, y) => { for (let k = 0; k < 3; k++) { const h = 6 + k * 3, cx2 = x + (k - 1) * 5; g.fillStyle = '#d8ccaa'; g.fillRect(cx2 - 1.5, y - h, 3, h); g.fillStyle = '#e8b04a'; g.fillRect(cx2 - .5, y - h - 3, 1, 3); } g.fillStyle = 'rgba(220,200,160,.4)'; g.fillRect(x - 8, y, 16, 1.5); };
  const pillar = (x, y, h) => { g.fillStyle = C.pillar; g.fillRect(x - 11, y - h, 22, h); g.fillStyle = C.pillarL; g.fillRect(x - 11, y - h, 5, h); g.fillStyle = '#211f18'; g.fillRect(x + 6, y - h, 5, h); g.fillStyle = C.ledge; g.fillRect(x - 15, y - 6, 30, 8); g.fillRect(x - 14, y - h - 4, 28, 6); g.beginPath(); g.moveTo(x - 14, y - h - 4); g.lineTo(x - 5, y - h - 15); g.lineTo(x + 2, y - h - 7); g.lineTo(x + 14, y - h - 11); g.lineTo(x + 14, y - h - 4); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(x - 11, y - h, 22, h); g.fillStyle = C.moss; g.fillRect(x - 11, y - 14, 8, 8); };
  pillar(A.x0 + 12, A.y0 + 70, 50); pillar(A.x1 - 12, A.y0 + 70, 34); pillar(A.x0 + 12, A.y1 - 30, 40); pillar(A.x1 - 12, A.y1 - 130, 56);
  for (let i = 0; i < 5; i++) skull(A.x0 + 10 + r() * 50, A.y0 + 100 + r() * (A.y1 - A.y0 - 150));
  for (let i = 0; i < 5; i++) skull(A.x1 - 10 - r() * 50, A.y0 + 100 + r() * (A.y1 - A.y0 - 150));
  for (let i = 0; i < 8; i++) bone(A.x0 + r() * (A.x1 - A.x0), A.y0 + 40 + r() * (A.y1 - A.y0 - 40), r() * 3);
  candles(A.x0 + 60, A.y0 + 22); candles(A.x1 - 60, A.y0 + 22); candles(A.x0 + 36, A.y1 - 20);
  for (let i = 0; i < 18; i++) { g.fillStyle = r() < .5 ? '#3a372b' : '#2a281f'; const x = r() < .5 ? r() * 40 : W - r() * 40, y = A.y0 + r() * (H - A.y0); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + r() * 6, y - 3); g.lineTo(x + 9, y + 5); g.lineTo(x + 1, y + 6); g.fill(); }
  // hanging chains from the wall
  g.strokeStyle = '#4a463a'; g.lineWidth = 1.5; for (const cxp of [W * .3, W * .7]) for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(cxp, wallH - 4 + k * 5, 1.6, 2.6, 0, 0, TAU); g.stroke(); }
  // biome props
  for (let i = 0; i < 12; i++) {
    const x = r() < .5 ? A.x0 + 8 + r() * 50 : A.x1 - 8 - r() * 50, y = A.y0 + 50 + r() * (A.y1 - A.y0 - 70);
    g.save(); g.translate(x, y);
    if (B.prop === 'leaf') { g.strokeStyle = '#2a3a1e'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, 4); g.quadraticCurveTo(-4, -6, 6, 2); g.quadraticCurveTo(12, 6, 16, -2); g.stroke(); g.fillStyle = '#3a5a2a'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(-8 + k * 9, -1 - k % 2 * 3, 3.5, 1.6, .6, 0, TAU); g.fill(); } }
    if (B.prop === 'lava') { g.strokeStyle = 'rgba(255,90,20,.75)'; g.lineWidth = 1.5; g.beginPath(); let px = -12, py = 0; g.moveTo(px, py); for (let k = 0; k < 4; k++) { px += 6; py += (r() - .5) * 8; g.lineTo(px, py); } g.stroke(); g.strokeStyle = 'rgba(255,200,90,.6)'; g.lineWidth = .6; g.stroke(); }
    if (B.prop === 'ice') { g.fillStyle = '#5a7090'; g.beginPath(); g.moveTo(0, -12 - r() * 6); g.lineTo(4, 0); g.lineTo(-4, 0); g.closePath(); g.fill(); g.fillStyle = 'rgba(200,230,255,.35)'; g.fillRect(-1, -9, 1, 8); g.fillStyle = '#3e5068'; g.beginPath(); g.moveTo(6, -7); g.lineTo(9, 0); g.lineTo(3, 0); g.fill(); }
    if (B.prop === 'void') { g.strokeStyle = 'rgba(170,90,240,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.stroke(); g.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .4; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); } g.stroke(); }
    g.restore();
  }
  // faint carved magic circle in the arena floor
  g.save(); g.translate((A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2 + 20); g.scale(1, .5); g.strokeStyle = 'rgba(255,230,180,.05)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 120, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 96, 0, TAU); g.stroke();
  g.beginPath(); for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * TAU * 2 / 5; g.lineTo(Math.cos(a) * 96, Math.sin(a) * 96); } g.stroke(); g.restore();
  // vignette (static, baked at device res)
  const vg = g.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .3, W / 2, H * .55, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.78)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}
function drawBG() { cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.imageSmoothingEnabled = false; cx.drawImage(bg, 0, 0); cx.restore(); }
function braziers() { const A = arena(); return [[A.x0 + 40, A.y0 + 30], [A.x1 - 40, A.y0 + 30], [A.x0 + 40, A.y1 - 70], [A.x1 - 40, A.y1 - 230]]; }
function drawBrazier(x, y, t) {
  const fl = 1 + Math.sin(t * 7 + x) * .04;
  light(x, y - 14, 100 * fl, biome().lampRgb, .7);
  cx.fillStyle = '#1c1812'; cx.fillRect(x - 2, y - 2, 4, 14); cx.fillRect(x - 9, y + 10, 18, 3); cx.fillRect(x - 7, y + 4, 2, 7); cx.fillRect(x + 5, y + 4, 2, 7);
  cx.fillStyle = '#5a4428'; cx.beginPath(); cx.moveTo(x - 13, y - 9); cx.lineTo(x + 13, y - 9); cx.lineTo(x + 8, y); cx.lineTo(x - 8, y); cx.closePath(); cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1; cx.stroke();
  cx.fillStyle = '#8a6a3a'; cx.fillRect(x - 13, y - 10, 26, 2);
  cx.fillStyle = '#3a1a0a'; cx.fillRect(x - 9, y - 11, 18, 2); // coals
  const cols = BRAZ[(G ? G.floor || 0 : 0) % 4];
  for (let i = 0; i < 4; i++) { const h = (16 - i * 3.5) * (1 + Math.sin(t * 11 + i * 1.7) * .15), w = 10 - i * 2.2; cx.fillStyle = cols[i]; cx.beginPath(); cx.moveTo(x - w, y - 10); cx.quadraticCurveTo(x - w * .6, y - 10 - h * .6, x + Math.sin(t * 9 + i) * 2, y - 10 - h); cx.quadraticCurveTo(x + w * .6, y - 10 - h * .6, x + w, y - 10); cx.fill(); }
  if (fx() < .2 && room && cx === mainCx) room.parts.push({ x: x + (fx() - .5) * 10, y: y - 20, vx: (fx() - .5) * 20, vy: -40 - fx() * 50, life: 1, c: cols[2], s: 1.5, ember: true });
}
const BRAZ = [['#a8401a', '#ff8a2a', '#ffc860', '#fff0b0'], ['#c8401a', '#ff7a1a', '#ffb347', '#fff0b0'], ['#2a4ac8', '#5a8aff', '#a8d0ff', '#f0f8ff'], ['#5a1a9a', '#a04aff', '#d8a0ff', '#fff0ff']];
// floating grimoire: dark tooled leather, metal corners, clasp, embossed leaf crest
function drawGrimoire(x, y, cover, leaves, t, open, ornate) {
  const bob = Math.sin(t * 2.6) * 2;
  cx.save(); cx.translate(x, y + bob); cx.rotate(Math.sin(t * 1.7) * .06);
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(0, 24 - bob, 8, 2.5, 0, 0, TAU); cx.fill();
  if (open) {
    cx.restore(); light(x, y + bob, 30, '255,225,170', .6); cx.save(); cx.translate(x, y + bob);
    poly([-13, -6, -1, -8, -1, 7, -13, 9]); inkPath('#e8dcc0', 1); poly([1, -8, 13, -6, 13, 9, 1, 7]); inkPath('#d8ccb0', 1);
    poly([-14, -5, 0, -7, 14, -5, 14, 10, 0, 8, -14, 10]); cx.strokeStyle = cover; cx.lineWidth = 1.5; cx.stroke();
    cx.fillStyle = 'rgba(60,40,20,.55)'; for (let i = 0; i < 4; i++) { cx.fillRect(-11, -4 + i * 3, 8, .8); cx.fillRect(3, -4 + i * 3, 8, .8); }
    cx.strokeStyle = 'rgba(255,220,150,.9)'; cx.lineWidth = .8; cx.beginPath(); cx.arc(0, -12, 4 + Math.sin(t * 20), 0, TAU); cx.stroke();
  } else {
    poly([-8, -11, 9, -11, 9, 11, -8, 11]); inkPath('#d8cfb8', 1); // page block
    poly([-10, -12, 8, -12, 8, 12, -10, 12]); inkPath(cover, 1.2);
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(-10, -12, 3, 24); // spine
    cx.fillStyle = 'rgba(255,255,255,.08)'; cx.fillRect(-7, -12, 15, 2);
    cx.strokeStyle = 'rgba(0,0,0,.45)'; cx.lineWidth = .8; cx.strokeRect(-5.5, -8.5, 11, 17); // tooled border
    cx.fillStyle = '#b8954a'; for (const [a, b] of [[-10, -12], [5, -12], [-10, 9], [5, 9]]) { cx.fillRect(a, b, 3, 3); }
    cx.fillRect(8, -2, 2.5, 4); // clasp
    leafCrest(cx, .5, 0, 4.6, clamp(leaves, 1, 5), '#d8b45a');
    if (ornate) { // gilded reliquary cover: gold filigree, corner caps, crimson gem
      cx.strokeStyle = '#e8c060'; cx.lineWidth = 1; cx.strokeRect(-8.5, -10.5, 15.5, 21); cx.beginPath(); cx.moveTo(-.5, -10.5); cx.lineTo(-.5, -7); cx.moveTo(-.5, 10.5); cx.lineTo(-.5, 7); cx.stroke();
      cx.fillStyle = '#e8c060'; for (const [a, b] of [[-11, -13], [6, -13], [-11, 9], [6, 9]]) { cx.beginPath(); cx.moveTo(a, b); cx.lineTo(a + 4, b); cx.lineTo(a + (a < 0 ? 0 : 4), b + 4); cx.closePath(); cx.fill(); }
      cx.fillStyle = '#b0102a'; cx.beginPath(); cx.moveTo(-.5, 5.5); cx.lineTo(2, 8); cx.lineTo(-.5, 10.5); cx.lineTo(-3, 8); cx.closePath(); cx.fill(); cx.fillStyle = '#ffd0d8'; cx.fillRect(-1, 7, 1, 1);
    }
    cx.fillStyle = 'rgba(255,240,190,.35)'; cx.fillRect(-.5, -.5, 2, 2);
  }
  cx.restore();
}
// mature mages (not chibi): tall proportions, long coats, small heads
let MAGE_OV = null; // co-op: draw another player's mage (walk, face, castT, fl, hue, leaves)
function drawPilgrim(x, y, t, cls, alpha = 1) {
  const Q = MAGE_OV || P, lumi = cls === 'witch', step = Math.sin(Q.walk) * 3, bob = Math.abs(Math.sin(Q.walk)) * -1.2;
  const sd = Math.cos(Q.face) >= 0 ? 1 : -1, fl = MAGE_OV ? MAGE_OV.fl : clamp(G ? G.flame / G.maxFlame : 1, .2, 1);
  light(x + sd * 24, y - 44, 50 + 40 * fl, lumi ? '140,200,255' : '255,150,60', .75);
  cx.save(); cx.translate(x, y); cx.globalAlpha = alpha; cx.lineJoin = 'round'; cx.lineCap = 'round';
  cx.fillStyle = 'rgba(0,0,0,.5)'; ell(0, 2, 12, 4); cx.fill();
  const coat = lumi ? '#1c2238' : '#1a1512', coatD = lumi ? '#10142a' : '#0e0b09', coatL = lumi ? '#2e3858' : '#2e2620', trim = lumi ? '#9ab0d8' : '#b8542a';
  const skin = '#d8b8a0', skinD = '#a88a74', hair = lumi ? '#c8ccd8' : '#4a1410', hairL = lumi ? '#eef0f8' : '#8a2a1a';
  // legs + boots
  cx.fillStyle = '#121010'; cx.fillRect(-5 + step * .5, -18, 4, 17); cx.fillRect(1 - step * .5, -18, 4, 17);
  cx.fillStyle = '#2a1e16'; cx.fillRect(-6 + step * .5, -5, 6, 5); cx.fillRect(0 - step * .5, -5, 6, 5);
  // long coat with split tails
  poly([-7, -40 + bob, 7, -40 + bob, 10, -16, 12, -4, 6, -8, 2, -18, -2, -18, -6, -8, -12, -4, -10, -16]); inkPath(coat, 1.2);
  cx.fillStyle = coatD; poly([2, -40 + bob, 7, -40 + bob, 10, -16, 12, -4, 6, -8, 2, -18]); cx.fill();
  cx.fillStyle = coatL; cx.fillRect(-6, -36 + bob, 2, 18);
  cx.strokeStyle = trim; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-10, -16); cx.lineTo(-12, -4); cx.moveTo(10, -16); cx.lineTo(12, -4); cx.moveTo(0, -38 + bob); cx.lineTo(0, -19); cx.stroke();
  // belt + buckle
  cx.fillStyle = '#2a1c12'; cx.fillRect(-7, -25 + bob, 14, 2.5); cx.fillStyle = '#b8954a'; cx.fillRect(-1.5, -25.5 + bob, 3, 3.5);
  // shoulder mantle / scarf
  if (lumi) { poly([-9, -40 + bob, 9, -40 + bob, 7, -34 + bob, -7, -34 + bob]); inkPath('#2a3456', 1); cx.fillStyle = trim; cx.fillRect(-8, -35.5 + bob, 16, 1); }
  else { poly([-8, -41 + bob, 8, -41 + bob, 6, -36 + bob, -6, -36 + bob]); inkPath('#6a1a14', 1); poly([-sd * 4, -38 + bob, -sd * 13 - Math.sin(t * 6) * 2, -32 + bob, -sd * 11, -29 + bob, -sd * 2, -35 + bob]); inkPath('#6a1a14', 1); }
  // casting arm toward the grimoire
  poly([sd * 5, -38 + bob, sd * 14, -31 + bob, sd * 13, -28 + bob, sd * 4, -33 + bob]); inkPath(coat, 1);
  cx.fillStyle = skin; cx.fillRect(sd * 14 - 1.5, -32 + bob, 3, 3);
  // neck + head (small, angular)
  cx.fillStyle = skinD; cx.fillRect(-1.5, -44 + bob, 3, 4);
  const hy = -49 + bob;
  poly([-4.5, hy - 4, 4.5, hy - 4, 4.5, hy + 2, sd * 1.5, hy + 6, -sd * 1.5 * 0 - 1, hy + 6, -4.5, hy + 2]); inkPath(skin, 1);
  cx.fillStyle = skinD; poly([-sd * 4.5, hy - 2, -sd * 4.5, hy + 2, -sd * 1, hy + 6, -sd * 2.5, hy + 2]); cx.fill();
  // sharp eyes
  cx.fillStyle = '#0b0906'; cx.fillRect(sd * 1, hy - .5, sd * 2.6, 1); cx.fillRect(-sd * 2.6 + (sd < 0 ? 2.6 : 0) - (sd < 0 ? 0 : 0), hy - .5, 1.8 * sd, 1);
  cx.fillStyle = lumi ? '#7ad0ff' : '#ffb040'; cx.fillRect(sd > 0 ? 2 : -3, hy, 1, 1);
  // hair
  if (lumi) { // long straight silver hair, side-swept fringe
    poly([-5.5, hy - 2, -6.5, hy + 16, -3.5, hy + 12, -4, hy - 1, 4, hy - 1, 3.5, hy + 12, 6.5, hy + 16, 5.5, hy - 2, 3, hy - 7, -3, hy - 7]); inkPath(hair, 1);
    poly([-5, hy - 3, 1, hy - 6, 5, hy - 3, 2, hy - 1, -1, hy, -sd * 5, hy + 2]); inkPath(hairL, .8);
    cx.fillStyle = '#5a6ab0'; cx.fillRect(-6, hy - 4, 2, 2);
  } else { // swept-back dark crimson hair, a few sharp spikes
    poly([-5.5, hy + 1, -7, hy - 3, -4, hy - 6, -6, hy - 9, -1, hy - 7, 1, hy - 11, 3, hy - 7, 8, hy - 8, 5.5, hy - 3, 6, hy + 1, 4, hy - 2, 0, hy - 3, -3, hy - 1]); inkPath(hair, 1);
    cx.fillStyle = hairL; poly([-1, hy - 7, 1, hy - 11, 3, hy - 7]); cx.fill();
  }
  cx.restore();
  // floating grimoire
  const w = MAGE_OV ? MAGE_OV : G && G.wands ? wand() : null;
  drawGrimoire(x + sd * 24, y - 44, w ? `hsl(${w.hue},45%,${lumi ? 24 : 22}%)` : (lumi ? '#1e2a4a' : '#4a1612'), w ? (MAGE_OV ? MAGE_OV.leaves : leavesOf(w)) : (lumi ? 3 : 1), t, Q.castT > 0, !!(w && (MAGE_OV ? MAGE_OV.orn : w.ornate)));
}
const FSKIN = [ // grounded, desaturated per-biome skins
  { a: '#4a5a3a', d: '#2e3a24', bone: '#b8b095', eye: '#c8ff5a', wing: '#2e3a28', robe: '#2a3a24', robeD: '#18241a', flame: '#9aff5a' },
  { a: '#5a3a30', d: '#3a2018', bone: '#c8a890', eye: '#ffb030', wing: '#3a1e18', robe: '#4a1c1a', robeD: '#2e1010', flame: '#ff6a1a' },
  { a: '#4a5668', d: '#2e3646', bone: '#c8d4e0', eye: '#8ad8ff', wing: '#2a3448', robe: '#22304a', robeD: '#141e30', flame: '#9ad8ff' },
  { a: '#3e3450', d: '#241e32', bone: '#b8a8c8', eye: '#e07aff', wing: '#241a32', robe: '#2a1838', robeD: '#180e22', flame: '#c07aff' },
];
const BSKIN = [ // bosses: armour / trim / glow per biome
  { a: '#3e4632', d: '#262c1e', trim: '#8a7a40', glow: '#a8ff5a', circ: '170,255,90' },
  { a: '#4a2e24', d: '#2a1610', trim: '#c88a3a', glow: '#ff7a1a', circ: '255,130,40' },
  { a: '#3e4a5e', d: '#242c3a', trim: '#a8bcd8', glow: '#8ad8ff', circ: '140,210,255' },
  { a: '#2e2440', d: '#1a1426', trim: '#a88ac8', glow: '#d07aff', circ: '200,120,255' },
];
// drawFoe lives in foes.js (animated enemy art)
// glowing magic circle (cast flourish, boss aura): crisp double ring, pentagram, rune ticks
function drawSpellCircle(x, y, r, col, rot, a) {
  cx.save(); cx.translate(x, y); cx.globalAlpha = a; cx.scale(1, .45); cx.rotate(rot);
  cx.strokeStyle = 'rgba(0,0,0,.5)'; cx.lineWidth = 3; cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke();
  cx.strokeStyle = col; cx.lineWidth = 1.4; cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke(); cx.lineWidth = .9; cx.beginPath(); cx.arc(0, 0, r * .8, 0, TAU); cx.stroke();
  cx.beginPath(); for (let i = 0; i <= 5; i++) { const q = -Math.PI / 2 + i * TAU * 2 / 5; cx.lineTo(Math.cos(q) * r * .8, Math.sin(q) * r * .8); } cx.stroke();
  cx.fillStyle = col; for (let i = 0; i < 16; i++) { const q = i * TAU / 16; cx.fillRect(Math.cos(q) * r * .9 - 1, Math.sin(q) * r * .9 - (i % 2 ? 1 : 2), 2, i % 2 ? 2 : 4); }
  cx.restore();
}
