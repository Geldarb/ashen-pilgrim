'use strict';
// ===== Ashen Pilgrim — art (crisp canvas drawing, no shadowBlur; banded light sprites at device resolution) =====
let bg = null;
const OUT = '#0b0906';
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

function buildBG() {
  bg = document.createElement('canvas'); bg.width = Math.round(SW * DPR); bg.height = Math.round(SH * DPR);
  const g = bg.getContext('2d'); g.scale(bg.width / W, bg.height / H);
  const r = mulberry(1234), A = arena();
  g.fillStyle = '#14120d'; g.fillRect(0, 0, W, H);
  const wallH = A.y0 + 10;
  // back wall: ashlar stone blocks
  const wg = g.createLinearGradient(0, 0, 0, wallH); wg.addColorStop(0, '#0d0c09'); wg.addColorStop(1, '#2a2920'); g.fillStyle = wg; g.fillRect(0, 0, W, wallH);
  for (let y = 0, row = 0; y < wallH; y += 14, row++) for (let x = (row % 2) * -16; x < W; x += 32) { const v = r(); g.fillStyle = `rgba(${70 + v * 25},${68 + v * 20},${52 + v * 12},${.12 + (y / wallH) * .25})`; g.fillRect(x + 1, y + 1, 30, 12); }
  const archW = 70, nA = Math.max(3, Math.round(W / archW)), aw = W / nA;
  for (let i = 0; i < nA; i++) {
    const x = i * aw + aw / 2, wTop = wallH * 0.2, wBot = wallH - 10, ww = aw * 0.42;
    const arch = () => { g.beginPath(); g.moveTo(x - ww / 2, wBot); g.lineTo(x - ww / 2, wTop + ww * .6); g.quadraticCurveTo(x - ww / 2, wTop, x, wTop - ww * .25); g.quadraticCurveTo(x + ww / 2, wTop, x + ww / 2, wTop + ww * .6); g.lineTo(x + ww / 2, wBot); g.closePath(); };
    // stone surround
    g.save(); g.translate(x, 0); g.scale(1.28, 1); g.translate(-x, 0); arch(); g.fillStyle = '#3d3a2d'; g.fill(); g.restore();
    arch(); const lg = g.createLinearGradient(0, wTop, 0, wBot); lg.addColorStop(0, '#4a5c46'); lg.addColorStop(.6, '#26302a'); lg.addColorStop(1, '#121510'); g.fillStyle = lg; g.fill();
    // leaded tracery
    g.strokeStyle = '#141410'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, wTop - ww * .2); g.lineTo(x, wBot);
    for (let k = 1; k < 4; k++) { const yy = wTop + (wBot - wTop) * k / 4; g.moveTo(x - ww / 2, yy); g.lineTo(x + ww / 2, yy); } g.stroke();
    g.fillStyle = 'rgba(160,200,140,.12)'; g.fillRect(x - ww / 2 + 2, wTop + ww * .3, ww / 2 - 3, (wBot - wTop) * .25);
    g.strokeStyle = '#5a5442'; g.lineWidth = 2; arch(); g.stroke();
    g.fillStyle = '#4d4836'; g.fillRect(x - ww / 2 - 4, wBot, ww + 8, 4); // sill
    // buttress pillar with capital
    g.fillStyle = '#26241b'; g.fillRect(i * aw - 6, 0, 12, wallH); g.fillStyle = '#3a372a'; g.fillRect(i * aw - 6, 0, 3, wallH); g.fillStyle = '#4a4636'; g.fillRect(i * aw - 8, wallH * .25, 16, 4);
    // tattered banner on every other pillar
    if (i % 2 === 1 && wallH > 60) { const bx = i * aw, by = wallH * .3; g.fillStyle = '#4a1c1a'; g.beginPath(); g.moveTo(bx - 7, by); g.lineTo(bx + 7, by); g.lineTo(bx + 7, by + 26); g.lineTo(bx + 3, by + 21); g.lineTo(bx, by + 28); g.lineTo(bx - 3, by + 22); g.lineTo(bx - 7, by + 27); g.closePath(); g.fill(); g.fillStyle = '#b08a3a'; g.fillRect(bx - 7, by, 14, 2); g.fillRect(bx - 1, by + 8, 2, 9); g.fillRect(bx - 4, by + 11, 8, 2); }
  }
  g.fillStyle = '#4a4535'; g.fillRect(0, wallH - 7, W, 5); g.fillStyle = '#1a1813'; g.fillRect(0, wallH - 2, W, 4);
  // floor flagstones with bevels, cracks, moss and puddles
  const fg = g.createLinearGradient(0, A.y0, 0, H); fg.addColorStop(0, '#2c2d23'); fg.addColorStop(1, '#1f201a'); g.fillStyle = fg; g.fillRect(0, wallH + 2, W, H - wallH);
  const ts = 40;
  for (let y = wallH + 2, row = 0; y < H; y += ts, row++) for (let x = (row % 2) * -ts / 2; x < W; x += ts) {
    const v = r();
    g.fillStyle = `rgb(${46 + v * 18 | 0},${48 + v * 16 | 0},${36 + v * 10 | 0})`; g.fillRect(x + 1, y + 1, ts - 2, ts - 2);
    g.fillStyle = 'rgba(255,240,200,.06)'; g.fillRect(x + 1, y + 1, ts - 2, 2); g.fillRect(x + 1, y + 1, 2, ts - 2); // top-left bevel
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 1, y + ts - 3, ts - 2, 2); g.fillRect(x + ts - 3, y + 1, 2, ts - 2);
    if (r() < .18) { g.strokeStyle = 'rgba(8,8,5,.75)'; g.lineWidth = 1; g.beginPath(); let px = x + r() * ts, py = y + 2; g.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (r() - .5) * 14; py += ts / 3; g.lineTo(px, py); } g.stroke(); }
    if (r() < .12) { g.fillStyle = 'rgba(78,104,52,.55)'; for (let k = 0; k < 5; k++) g.fillRect(x + r() * ts | 0, y + ts - 4 - r() * 6 | 0, 2 + r() * 4 | 0, 2); }
    if (r() < .04) { g.fillStyle = 'rgba(70,90,80,.35)'; g.beginPath(); g.ellipse(x + ts / 2, y + ts / 2, 12, 5, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(200,220,200,.12)'; g.fillRect(x + ts / 2 - 6, y + ts / 2 - 2, 5, 1); }
  }
  // props: skulls, bones, candle clusters, chains, rubble
  const skull = (x, y) => { g.fillStyle = '#b8b095'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); g.fillRect(x - 2.5, y + 2, 5, 3); g.fillStyle = '#1a1612'; g.fillRect(x - 2.5, y - 1, 2, 2); g.fillRect(x + .5, y - 1, 2, 2); };
  const bone = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#a8a088'; g.fillRect(-6, -1, 12, 2); g.beginPath(); g.arc(-6, -1, 1.6, 0, TAU); g.arc(-6, 1, 1.6, 0, TAU); g.arc(6, -1, 1.6, 0, TAU); g.arc(6, 1, 1.6, 0, TAU); g.fill(); g.restore(); };
  const candles = (x, y) => { for (let k = 0; k < 3; k++) { const h = 6 + k * 3, cx2 = x + (k - 1) * 5; g.fillStyle = '#d8ccaa'; g.fillRect(cx2 - 1.5, y - h, 3, h); g.fillStyle = '#e8b04a'; g.fillRect(cx2 - .5, y - h - 3, 1, 3); } g.fillStyle = 'rgba(220,200,160,.4)'; g.fillRect(x - 8, y, 16, 1.5); };
  const pillar = (x, y, h) => { g.fillStyle = '#353227'; g.fillRect(x - 11, y - h, 22, h); g.fillStyle = '#4c4837'; g.fillRect(x - 11, y - h, 5, h); g.fillStyle = '#211f18'; g.fillRect(x + 6, y - h, 5, h); g.fillStyle = '#4e4a39'; g.fillRect(x - 15, y - 6, 30, 8); g.fillRect(x - 14, y - h - 4, 28, 6); g.beginPath(); g.moveTo(x - 14, y - h - 4); g.lineTo(x - 5, y - h - 15); g.lineTo(x + 2, y - h - 7); g.lineTo(x + 14, y - h - 11); g.lineTo(x + 14, y - h - 4); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(x - 11, y - h, 22, h); g.fillStyle = 'rgba(78,104,52,.6)'; g.fillRect(x - 11, y - 14, 8, 8); };
  pillar(A.x0 + 12, A.y0 + 70, 50); pillar(A.x1 - 12, A.y0 + 70, 34); pillar(A.x0 + 12, A.y1 - 30, 40); pillar(A.x1 - 12, A.y1 - 130, 56);
  for (let i = 0; i < 5; i++) skull(A.x0 + 10 + r() * 50, A.y0 + 100 + r() * (A.y1 - A.y0 - 150));
  for (let i = 0; i < 5; i++) skull(A.x1 - 10 - r() * 50, A.y0 + 100 + r() * (A.y1 - A.y0 - 150));
  for (let i = 0; i < 8; i++) bone(A.x0 + r() * (A.x1 - A.x0), A.y0 + 40 + r() * (A.y1 - A.y0 - 40), r() * 3);
  candles(A.x0 + 60, A.y0 + 22); candles(A.x1 - 60, A.y0 + 22); candles(A.x0 + 36, A.y1 - 20);
  for (let i = 0; i < 18; i++) { g.fillStyle = r() < .5 ? '#3a372b' : '#2a281f'; const x = r() < .5 ? r() * 40 : W - r() * 40, y = A.y0 + r() * (H - A.y0); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + r() * 6, y - 3); g.lineTo(x + 9, y + 5); g.lineTo(x + 1, y + 6); g.fill(); }
  // hanging chains from the wall
  g.strokeStyle = '#4a463a'; g.lineWidth = 1.5; for (const cxp of [W * .3, W * .7]) for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(cxp, wallH - 4 + k * 5, 1.6, 2.6, 0, 0, TAU); g.stroke(); }
  // vignette (static, baked at device res)
  const vg = g.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .3, W / 2, H * .55, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}
function drawBG() { cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.imageSmoothingEnabled = false; cx.drawImage(bg, 0, 0); cx.restore(); }
function braziers() { const A = arena(); return [[A.x0 + 40, A.y0 + 30], [A.x1 - 40, A.y0 + 30], [A.x0 + 40, A.y1 - 70], [A.x1 - 40, A.y1 - 230]]; }
function drawBrazier(x, y, t) {
  const fl = 1 + Math.sin(t * 7 + x) * .04;
  light(x, y - 14, 100 * fl, '255,140,50', .9);
  cx.fillStyle = '#1c1812'; cx.fillRect(x - 2, y - 2, 4, 14); cx.fillRect(x - 9, y + 10, 18, 3); cx.fillRect(x - 7, y + 4, 2, 7); cx.fillRect(x + 5, y + 4, 2, 7);
  cx.fillStyle = '#5a4428'; cx.beginPath(); cx.moveTo(x - 13, y - 9); cx.lineTo(x + 13, y - 9); cx.lineTo(x + 8, y); cx.lineTo(x - 8, y); cx.closePath(); cx.fill(); cx.strokeStyle = OUT; cx.lineWidth = 1; cx.stroke();
  cx.fillStyle = '#8a6a3a'; cx.fillRect(x - 13, y - 10, 26, 2);
  cx.fillStyle = '#3a1a0a'; cx.fillRect(x - 9, y - 11, 18, 2); // coals
  const cols = ['#c8401a', '#ff7a1a', '#ffb347', '#fff0b0'];
  for (let i = 0; i < 4; i++) { const h = (16 - i * 3.5) * (1 + Math.sin(t * 11 + i * 1.7) * .15), w = 10 - i * 2.2; cx.fillStyle = cols[i]; cx.beginPath(); cx.moveTo(x - w, y - 10); cx.quadraticCurveTo(x - w * .6, y - 10 - h * .6, x + Math.sin(t * 9 + i) * 2, y - 10 - h); cx.quadraticCurveTo(x + w * .6, y - 10 - h * .6, x + w, y - 10); cx.fill(); }
  if (fx() < .2 && room && cx === mainCx) room.parts.push({ x: x + (fx() - .5) * 10, y: y - 20, vx: (fx() - .5) * 20, vy: -40 - fx() * 50, life: 1, c: '#ffb347', s: 1.5, ember: true });
}
function drawPilgrim(x, y, t, cls, alpha = 1) {
  cx.save(); cx.translate(x, y); cx.globalAlpha = alpha;
  const bob = Math.sin(P.walk) * 1.5, witch = cls === 'witch', step = Math.sin(P.walk) * 3;
  const sd = Math.cos(P.face) >= 0 ? 1 : -1, fy = -38 + bob, fl = clamp(G ? G.flame / G.maxFlame : 1, .2, 1);
  cx.restore();
  light(x + sd * 13, y + fy, 46 + 40 * fl, witch ? '140,220,255' : '255,160,60', .8);
  cx.save(); cx.translate(x, y); cx.globalAlpha = alpha;
  cx.fillStyle = 'rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(0, 2, 13, 4.5, 0, 0, TAU); cx.fill();
  const robe = witch ? '#2e2645' : '#4d412f', robeD = witch ? '#1d1830' : '#33291d', robeL = witch ? '#463a66' : '#66573e';
  // feet
  cx.fillStyle = '#1a140e'; cx.fillRect(-6 + step * .5, -2, 5, 3); cx.fillRect(1 - step * .5, -2, 5, 3);
  // robe body with hem
  cx.fillStyle = robe; cx.beginPath(); cx.moveTo(-12, -1); cx.quadraticCurveTo(-11, -16, -7, -27 + bob); cx.lineTo(7, -27 + bob); cx.quadraticCurveTo(11, -16, 12, -1); cx.lineTo(8, 1); cx.lineTo(4, -1); cx.lineTo(0, 1); cx.lineTo(-4, -1); cx.lineTo(-8, 1); cx.closePath(); cx.fill();
  cx.strokeStyle = OUT; cx.lineWidth = 1.2; cx.stroke();
  cx.fillStyle = robeD; cx.beginPath(); cx.moveTo(-1, -26 + bob); cx.lineTo(-3, 0); cx.lineTo(2, 0); cx.closePath(); cx.fill(); // fold
  cx.fillStyle = robeL; cx.fillRect(-9, -20 + bob, 3, 12); // lit edge
  // rope belt + satchel
  cx.fillStyle = witch ? '#8a6a9a' : '#a88a52'; cx.fillRect(-9, -14 + bob, 18, 2); cx.fillRect(-sd * 4, -13 + bob, 2, 7);
  cx.fillStyle = '#3a2a18'; cx.fillRect(-sd * 11 - 3, -14 + bob, 7, 7); cx.strokeStyle = OUT; cx.strokeRect(-sd * 11 - 3, -14 + bob, 7, 7);
  // sleeve/arm to the staff
  cx.fillStyle = robe; cx.beginPath(); cx.moveTo(sd * 4, -24 + bob); cx.lineTo(sd * 13, -20 + bob); cx.lineTo(sd * 13, -16 + bob); cx.lineTo(sd * 3, -18 + bob); cx.closePath(); cx.fill(); cx.stroke();
  cx.fillStyle = '#c8b090'; cx.fillRect(sd * 12 - 1.5, -21 + bob, 3, 3); // hand
  // hood
  cx.fillStyle = witch ? '#3c3060' : '#5e4f39';
  cx.beginPath(); cx.moveTo(-9, -24 + bob); cx.quadraticCurveTo(-10, -38 + bob, 0, (witch ? -48 : -41) + bob); cx.quadraticCurveTo(10, -38 + bob, 9, -24 + bob); cx.closePath(); cx.fill(); cx.stroke();
  if (witch) { cx.fillStyle = '#3c3060'; cx.beginPath(); cx.moveTo(-12, -33 + bob); cx.lineTo(12, -33 + bob); cx.lineTo(9, -30 + bob); cx.lineTo(-9, -30 + bob); cx.fill(); cx.stroke(); }
  cx.fillStyle = '#080605'; cx.beginPath(); cx.ellipse(sd * 1, -30 + bob, 4.5, 5.5, 0, 0, TAU); cx.fill();
  cx.fillStyle = witch ? '#9fe6ff' : '#ffc060'; cx.fillRect(sd * 1 - 2.5, -31 + bob, 1.5, 1.5); cx.fillRect(sd * 1 + 1, -31 + bob, 1.5, 1.5);
  // staff
  cx.strokeStyle = '#2a1c10'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(sd * 13, 2); cx.lineTo(sd * 13, -33 + bob); cx.stroke();
  cx.strokeStyle = '#7a5a34'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(sd * 13, 1); cx.lineTo(sd * 13, -33 + bob); cx.stroke();
  if (witch) { // lantern
    cx.fillStyle = '#2a2216'; cx.fillRect(sd * 13 - 6, fy - 6, 12, 13); cx.fillStyle = '#c8f2ff'; cx.fillRect(sd * 13 - 4, fy - 4, 8, 9); cx.fillStyle = '#6ad0ff'; cx.fillRect(sd * 13 - 2, fy - 1, 4, 5);
    cx.fillStyle = '#2a2216'; cx.fillRect(sd * 13 - 7, fy - 8, 14, 2); cx.fillRect(sd * 13 - .5, fy - 4, 1, 9); cx.strokeStyle = OUT; cx.lineWidth = 1; cx.strokeRect(sd * 13 - 6, fy - 6, 12, 13);
  } else { // candle in a brass cup with flame sized by current flame
    cx.fillStyle = '#8a6a34'; cx.fillRect(sd * 13 - 5, fy + 2, 10, 3); cx.fillStyle = '#e0d4b4'; cx.fillRect(sd * 13 - 2, fy - 3, 4, 6);
    const fh = 6 + 9 * fl + Math.sin(t * 12) * 1.5;
    cx.fillStyle = '#ff6a1a'; cx.beginPath(); cx.moveTo(sd * 13 - 4, fy - 3); cx.quadraticCurveTo(sd * 13 - 3, fy - 3 - fh * .6, sd * 13 + Math.sin(t * 9), fy - 3 - fh); cx.quadraticCurveTo(sd * 13 + 3, fy - 3 - fh * .6, sd * 13 + 4, fy - 3); cx.fill();
    cx.fillStyle = '#ffd27a'; cx.beginPath(); cx.ellipse(sd * 13, fy - 3 - fh * .3, 1.8, fh * .3, 0, 0, TAU); cx.fill();
  }
  cx.restore();
}
function drawFoe(f, t) {
  if ((f.elite || f.boss) && f.spawnT <= 0) light(f.x, f.y - f.r, f.r * 2.4, '200,40,30', .7);
  cx.save(); cx.translate(f.x, f.y);
  if (f.spawnT > 0) cx.globalAlpha = Math.max(0, 1 - f.spawnT * 1.6);
  const flash = f.hit > 0, s = f.r / FOES[f.type].r, F = c => flash ? '#fff4e0' : c;
  cx.fillStyle = 'rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(0, 2, f.r, f.r * .33, 0, 0, TAU); cx.fill();
  cx.scale(s, s); cx.strokeStyle = OUT; cx.lineWidth = 1.2 / s + .3; cx.lineJoin = 'round';
  const sw = Math.sin(f.t * 6) * 2;
  if (f.type === 'husk') {
    cx.fillStyle = F('#3a3f2e'); cx.fillRect(-6, -9, 4, 10 + sw * .5); cx.fillRect(2, -9, 4, 10 - sw * .5); cx.strokeRect(-6, -9, 4, 10 + sw * .5); cx.strokeRect(2, -9, 4, 10 - sw * .5);
    cx.fillStyle = F('#5d6449'); cx.beginPath(); cx.moveTo(-8, -20); cx.lineTo(-14, -6 + sw); cx.lineTo(-11, -5 + sw); cx.lineTo(-6, -16); cx.fill(); cx.stroke(); cx.beginPath(); cx.moveTo(8, -20); cx.lineTo(14, -6 - sw); cx.lineTo(11, -5 - sw); cx.lineTo(6, -16); cx.fill(); cx.stroke();
    cx.fillStyle = F('#6d7556'); cx.beginPath(); cx.ellipse(0, -16, 10, 11, .15, 0, TAU); cx.fill(); cx.stroke();
    cx.fillStyle = F('#4a3a2a'); cx.beginPath(); cx.moveTo(-10, -10); cx.lineTo(10, -12); cx.lineTo(9, -6); cx.lineTo(4, -8); cx.lineTo(0, -5); cx.lineTo(-5, -8); cx.lineTo(-9, -5); cx.closePath(); cx.fill(); // rag
    cx.strokeStyle = '#2a2e22'; cx.lineWidth = 1.2; for (let i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(-6, -22 + i * 4); cx.quadraticCurveTo(0, -20 + i * 4, 6, -22 + i * 4); cx.stroke(); }
    cx.strokeStyle = OUT; cx.fillStyle = F('#cbc4a6'); cx.beginPath(); cx.arc(3, -30, 6.5, 0, TAU); cx.fill(); cx.stroke();
    cx.fillStyle = F('#b0a88a'); cx.fillRect(0, -26, 7, 3);
    cx.fillStyle = '#120c08'; cx.fillRect(0, -32, 3, 3); cx.fillRect(5, -32, 3, 3);
    cx.fillStyle = '#ff6a1a'; cx.fillRect(1, -31, 1, 1); cx.fillRect(6, -31, 1, 1);
    cx.fillStyle = '#120c08'; for (let i = 0; i < 3; i++) cx.fillRect(1 + i * 2, -25, 1, 2);
  } else if (f.type === 'bat') {
    const fl = Math.sin(f.t * 18) * 8;
    cx.translate(0, -22);
    for (const d of [-1, 1]) { cx.fillStyle = F('#3c3833'); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(d * 20, -7 - fl); cx.lineTo(d * 16, 1 - fl * .3); cx.lineTo(d * 12, -2); cx.lineTo(d * 9, 4); cx.lineTo(d * 5, 1); cx.closePath(); cx.fill(); cx.stroke(); cx.strokeStyle = '#5a544a'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(d * 3, 0); cx.lineTo(d * 16, -5 - fl * .8); cx.stroke(); cx.strokeStyle = OUT; }
    cx.fillStyle = F('#5c564c'); cx.beginPath(); cx.ellipse(0, 0, 5.5, 7.5, 0, 0, TAU); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(-4, -5); cx.lineTo(-4, -11); cx.lineTo(-1, -6); cx.moveTo(4, -5); cx.lineTo(4, -11); cx.lineTo(1, -6); cx.fill();
    cx.fillStyle = '#ffd04a'; cx.fillRect(-3, -3, 2, 2); cx.fillRect(1, -3, 2, 2); cx.fillStyle = '#fff'; cx.fillRect(-2, 2, 1, 2); cx.fillRect(1, 2, 1, 2);
  } else if (f.type === 'cultist') {
    cx.fillStyle = F('#4a2224'); cx.beginPath(); cx.moveTo(-11, 0); cx.lineTo(-6, -26); cx.lineTo(6, -26); cx.lineTo(11, 0); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = F('#2e1416'); cx.fillRect(-1, -24, 2, 24); cx.fillStyle = F('#c8a050'); cx.fillRect(-7, -12, 14, 2); // sash
    cx.fillStyle = F('#5e2a2c'); cx.beginPath(); cx.moveTo(-7, -24); cx.lineTo(0, -42); cx.lineTo(7, -24); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = '#080404'; cx.beginPath(); cx.ellipse(0, -28, 3.5, 4, 0, 0, TAU); cx.fill();
    cx.fillStyle = '#ff3a2a'; cx.fillRect(-2, -29, 1.5, 1.5); cx.fillRect(1, -29, 1.5, 1.5);
    cx.fillStyle = F('#d8c8a0'); cx.fillRect(9, -22, 3, 8); cx.strokeRect(9, -22, 3, 8);
    cx.fillStyle = '#ff5a2a'; cx.beginPath(); cx.ellipse(10.5, -25 + sw * .3, 2, 3.5, 0, 0, TAU); cx.fill(); cx.fillStyle = '#ffe08a'; cx.fillRect(10, -25, 1, 2);
  } else if (f.type === 'warden') {
    cx.fillStyle = F('#2a271f'); cx.fillRect(-12, -14, 9, 14); cx.fillRect(3, -14, 9, 14); cx.strokeRect(-12, -14, 9, 14); cx.strokeRect(3, -14, 9, 14);
    cx.fillStyle = F('#6b5a3a'); cx.beginPath(); cx.moveTo(-24, -58); cx.quadraticCurveTo(0, -80, 24, -58); cx.lineTo(29, -40); cx.lineTo(-29, -40); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = F('#8a7448'); cx.fillRect(-29, -43, 58, 4); cx.fillStyle = F('#4a3e28'); cx.fillRect(-18, -62, 3, 18); cx.fillRect(15, -62, 3, 18); // bell bands
    cx.fillStyle = F('#45473a'); cx.beginPath(); cx.moveTo(-18, -14); cx.lineTo(-22, -42); cx.lineTo(22, -42); cx.lineTo(18, -14); cx.closePath(); cx.fill(); cx.stroke();
    cx.strokeStyle = '#2a2b22'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(0, -42); cx.lineTo(0, -14); cx.moveTo(-19, -28); cx.lineTo(19, -28); cx.stroke(); cx.strokeStyle = OUT;
    cx.fillStyle = '#9a8a5a'; for (const [a, b] of [[-14, -38], [14, -38], [-14, -18], [14, -18]]) cx.fillRect(a - 1, b - 1, 2, 2); // rivets
    cx.fillStyle = F('#58594a'); cx.beginPath(); cx.arc(-24, -38, 8, 0, TAU); cx.fill(); cx.stroke(); cx.beginPath(); cx.arc(24, -38, 8, 0, TAU); cx.fill(); cx.stroke();
    cx.fillStyle = F('#3c3d32'); cx.beginPath(); cx.moveTo(-9, -40); cx.lineTo(-9, -56); cx.lineTo(0, -65); cx.lineTo(9, -56); cx.lineTo(9, -40); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = f.phase ? '#ff3a1a' : '#ffb347'; cx.fillRect(-6, -51, 12, 2.5); cx.fillRect(-1, -51, 2, 7);
    cx.strokeStyle = '#7a6a4a'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(28, -34); cx.lineTo(34, 4); cx.stroke();
    cx.fillStyle = F('#4a4a40'); cx.fillRect(25, 0, 18, 11); cx.strokeStyle = OUT; cx.lineWidth = 1.5; cx.strokeRect(25, 0, 18, 11);
  }
  cx.restore();
  if ((f.elite || f.boss) && f.spawnT <= 0) { const w = f.boss ? Math.min(W - 60, 260) : 40, x = Math.round(f.boss ? W / 2 - w / 2 : f.x - w / 2), y = Math.round(f.boss ? arena().y0 - 18 : f.y - f.r * 2.6 - 8); cx.fillStyle = '#000c'; cx.fillRect(x - 1, y - 1, w + 2, 6); cx.fillStyle = '#a8321e'; cx.fillRect(x, y, w * Math.max(0, f.hp / f.max), 4); cx.fillStyle = '#ff7a4a'; cx.fillRect(x, y, w * Math.max(0, f.hp / f.max), 1); }
  if (f.burn > 0) { const k = Math.sin(t * 20) * 1.5; cx.fillStyle = '#ff6a1a'; for (let i = -1; i <= 1; i++) { cx.beginPath(); cx.moveTo(f.x + i * 5 - 3, f.y - f.r * .8); cx.lineTo(f.x + i * 5, f.y - f.r * 1.6 - k - (i ? 0 : 4)); cx.lineTo(f.x + i * 5 + 3, f.y - f.r * .8); cx.fill(); } }
  if (f.poison > 0) { cx.fillStyle = '#8aff4a'; for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; cx.fillRect(Math.round(f.x + Math.cos(a) * f.r * .8), Math.round(f.y - f.r * 1.2 + Math.sin(a * 1.3) * 5), 2, 2); } }
  if (f.frozen > 0) { cx.strokeStyle = '#cfefff'; cx.lineWidth = 1.5; cx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; cx.moveTo(f.x, f.y - f.r); cx.lineTo(f.x + Math.cos(a) * f.r, f.y - f.r + Math.sin(a) * f.r); } cx.stroke(); cx.fillStyle = 'rgba(170,225,255,.25)'; cx.beginPath(); cx.arc(f.x, f.y - f.r, f.r * 1.05, 0, TAU); cx.fill(); }
}
