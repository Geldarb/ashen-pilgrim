'use strict';
// ===== Grimoire Ascent — anime cel-shaded art: flat colours, one hard shadow tone, thick ink outlines =====
let bg = null;
const INK = '#14101a';
const lightCache = new Map();
function lightSprite(rgb, pxIn) {
  const px = Math.max(4, Math.round(pxIn / 4) * 4), key = rgb + '|' + px;
  let c = lightCache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = px * 2;
  const g = c.getContext('2d');
  for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(${rgb},${.035 + i * .012})`; g.beginPath(); g.arc(px, px, px * (1 - i * .15), 0, TAU); g.fill(); }
  lightCache.set(key, c); return c;
}
function light(x, y, r, rgb, a = 1) {
  const m = cx.getTransform(), s = lightSprite(rgb, r * m.a), px = s.width / 2;
  cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = a; cx.imageSmoothingEnabled = false;
  cx.drawImage(s, Math.round(m.a * x + m.e - px), Math.round(m.d * y + m.f - px)); cx.restore();
}
function glowDot(x, y, r, core, halo) { cx.fillStyle = halo; cx.beginPath(); cx.arc(x, y, r * 1.9, 0, TAU); cx.fill(); cx.fillStyle = core; cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill(); }
// ink helpers: fill then thick outline
function inkPath(fill, w = 2) { cx.fillStyle = fill; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = w; cx.lineJoin = 'round'; cx.stroke(); }
function poly(pts) { cx.beginPath(); cx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) cx.lineTo(pts[i], pts[i + 1]); cx.closePath(); }
function ell(x, y, rx, ry, rot = 0) { cx.beginPath(); cx.ellipse(x, y, rx, ry, rot, 0, TAU); }

function buildBG() {
  const B = biome(), C = B.pal;
  bg = document.createElement('canvas'); bg.width = Math.round(SW * DPR); bg.height = Math.round(SH * DPR);
  const g = bg.getContext('2d'); g.scale(bg.width / W, bg.height / H); g.lineJoin = 'round';
  const r = mulberry(hashStr(B.name)), A = arena(), wallH = A.y0 + 10;
  // sky / back wall: flat bands (cel style)
  g.fillStyle = C.sky; g.fillRect(0, 0, W, wallH);
  g.fillStyle = C.sky2; g.fillRect(0, wallH * .55, W, wallH * .45);
  // distant spires silhouette
  g.fillStyle = C.far; g.beginPath(); g.moveTo(0, wallH);
  for (let x = 0; x <= W; x += 26) { const h = 12 + r() * wallH * .5; g.lineTo(x, wallH - h); g.lineTo(x + 8, wallH - h - 10 - r() * 10); g.lineTo(x + 16, wallH - h); } g.lineTo(W, wallH); g.fill();
  // wall with arches and ink outlines
  const archW = 72, nA = Math.max(3, Math.round(W / archW)), aw = W / nA;
  g.fillStyle = C.wall; g.fillRect(0, wallH * .35, W, wallH * .65);
  for (let i = 0; i < nA; i++) {
    const x = i * aw + aw / 2, top = wallH * .42, bot = wallH - 6, ww = aw * .5;
    g.beginPath(); g.moveTo(x - ww / 2, bot); g.lineTo(x - ww / 2, top + ww * .5); g.quadraticCurveTo(x - ww / 2, top - ww * .1, x, top - ww * .35); g.quadraticCurveTo(x + ww / 2, top - ww * .1, x + ww / 2, top + ww * .5); g.lineTo(x + ww / 2, bot); g.closePath();
    g.fillStyle = C.window; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = C.windowHi; g.fillRect(x - ww / 2 + 3, top + ww * .4, 4, (bot - top) * .5);
    g.fillStyle = C.wallD; g.fillRect(i * aw - 5, wallH * .35, 10, wallH * .65); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(i * aw - 5, wallH * .35, 10, wallH * .65);
  }
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, wallH * .35); g.lineTo(W, wallH * .35); g.stroke();
  g.fillStyle = C.ledge; g.fillRect(0, wallH - 6, W, 8); g.strokeRect(-2, wallH - 6, W + 4, 8);
  // floor: large flat tiles with hard shadow and ink grout
  g.fillStyle = C.floor; g.fillRect(0, wallH + 2, W, H - wallH);
  const ts = 48;
  for (let y = wallH + 2, row = 0; y < H; y += ts, row++) for (let x = (row % 2) * -ts / 2; x < W; x += ts) {
    g.fillStyle = r() < .5 ? C.floor : C.floor2; g.fillRect(x, y, ts, ts);
    g.fillStyle = C.floorD; g.beginPath(); g.moveTo(x + ts, y); g.lineTo(x + ts, y + ts); g.lineTo(x, y + ts); g.lineTo(x + 6, y + ts - 6); g.lineTo(x + ts - 6, y + ts - 6); g.lineTo(x + ts - 6, y + 6); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(x, y, ts, ts);
    if (r() < .14) { g.lineWidth = 1.5; g.strokeStyle = C.crack; g.beginPath(); let px = x + 8 + r() * 30, py = y + 4; g.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (r() - .5) * 18; py += 13; g.lineTo(px, py); } g.stroke(); }
  }
  // biome props
  const prop = B.prop;
  for (let i = 0; i < 14; i++) {
    const x = r() < .5 ? A.x0 + 8 + r() * 46 : A.x1 - 8 - r() * 46, y = A.y0 + 40 + r() * (A.y1 - A.y0 - 60);
    g.save(); g.translate(x, y); g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 2;
    if (prop === 'leaf') { g.fillStyle = '#3fbf5a'; g.beginPath(); g.ellipse(0, 0, 9, 4, r() * 3, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#ff6fa8'; g.beginPath(); g.arc(6, -4, 3, 0, TAU); g.fill(); g.stroke(); }
    if (prop === 'lava') { g.fillStyle = '#ff6a1a'; g.beginPath(); g.ellipse(0, 0, 12, 5, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#ffe14a'; g.beginPath(); g.ellipse(-2, -1, 6, 2, 0, 0, TAU); g.fill(); }
    if (prop === 'ice') { g.fillStyle = '#bff2ff'; g.beginPath(); g.moveTo(0, -18); g.lineTo(6, 0); g.lineTo(-6, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -14); g.lineTo(2, -4); g.lineTo(-1, -4); g.fill(); }
    if (prop === 'void') { g.fillStyle = '#b06aff'; g.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); g.lineTo(Math.cos(a + .78) * 2.5, Math.sin(a + .78) * 2.5); } g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
  // corner pillars
  const pillar = (x, y, h) => { g.fillStyle = C.wall; g.fillRect(x - 12, y - h, 24, h); g.fillStyle = C.wallD; g.fillRect(x + 3, y - h, 9, h); g.strokeStyle = INK; g.lineWidth = 2.5; g.strokeRect(x - 12, y - h, 24, h); g.fillStyle = C.ledge; g.fillRect(x - 16, y - h - 7, 32, 8); g.strokeRect(x - 16, y - h - 7, 32, 8); g.fillRect(x - 16, y - 4, 32, 8); g.strokeRect(x - 16, y - 4, 32, 8); };
  pillar(A.x0 + 12, A.y0 + 76, 52); pillar(A.x1 - 12, A.y0 + 76, 40); pillar(A.x0 + 12, A.y1 - 26, 44); pillar(A.x1 - 12, A.y1 - 130, 56);
  // flat cel vignette: hard-edged dark corners
  g.fillStyle = 'rgba(10,6,20,.22)'; g.beginPath(); g.rect(0, 0, W, H); g.ellipse(W / 2, H * .56, W * .62, H * .55, 0, 0, TAU); g.fill('evenodd');
}
function drawBG() { cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.imageSmoothingEnabled = false; cx.drawImage(bg, 0, 0); cx.restore(); }
function braziers() { const A = arena(); return [[A.x0 + 40, A.y0 + 30], [A.x1 - 40, A.y0 + 30], [A.x0 + 40, A.y1 - 70], [A.x1 - 40, A.y1 - 230]]; }
// biome crystal lamps
function drawBrazier(x, y, t) {
  const B = biome();
  light(x, y - 16, 90 * (1 + Math.sin(t * 5 + x) * .04), B.lampRgb, .9);
  cx.lineJoin = 'round';
  poly([x - 9, y + 12, x + 9, y + 12, x + 5, y - 2, x - 5, y - 2]); inkPath('#3a3550', 2);
  poly([x - 12, y - 2, x + 12, y - 2, x + 9, y - 7, x - 9, y - 7]); inkPath('#5a5478', 2);
  const bob = Math.sin(t * 3 + x) * 2;
  poly([x, y - 30 + bob, x + 7, y - 17 + bob, x, y - 8 + bob, x - 7, y - 17 + bob]); inkPath(B.lamp, 2);
  poly([x, y - 27 + bob, x + 3, y - 18 + bob, x, y - 13 + bob]); cx.fillStyle = '#ffffff'; cx.fill();
  if (fx() < .12 && room && cx === mainCx) room.parts.push({ x: x + (fx() - .5) * 12, y: y - 20, vx: (fx() - .5) * 20, vy: -30 - fx() * 40, life: .9, c: B.lamp, s: 2, ember: true });
}
// floating grimoire with leaf crest (1–5 leaves)
function drawGrimoire(x, y, cover, leaves, t, open) {
  cx.save(); cx.translate(x, y + Math.sin(t * 3) * 2.5); cx.rotate(Math.sin(t * 2) * .08);
  cx.lineJoin = 'round';
  if (open) { light(0, 0, 26, '255,255,200', .7); poly([-11, -7, 0, -9, 11, -7, 11, 7, 0, 5, -11, 7]); inkPath('#fff8e0', 1.8); cx.strokeStyle = INK; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(0, -9); cx.lineTo(0, 5); cx.stroke(); cx.fillStyle = '#c8b890'; for (let i = 0; i < 3; i++) { cx.fillRect(-8, -4 + i * 3, 6, 1); cx.fillRect(2, -4 + i * 3, 6, 1); } }
  else {
    poly([-9, -11, 9, -11, 9, 11, -9, 11]); inkPath(cover, 2);
    cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(4, -10, 4, 20); // spine shade
    cx.fillStyle = '#f2d36a'; cx.fillRect(-9, -11, 3, 22); cx.strokeStyle = INK; cx.lineWidth = 1; cx.strokeRect(-9, -11, 3, 22);
    // leaf crest
    const n = clamp(leaves, 1, 5);
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * TAU / n; cx.save(); cx.translate(1.5, 0); cx.rotate(a); cx.beginPath(); cx.moveTo(0, 0); cx.bezierCurveTo(-4, -3, -3, -8, 0, -7); cx.bezierCurveTo(3, -8, 4, -3, 0, 0); cx.fillStyle = '#ffe680'; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = .8; cx.stroke(); cx.restore(); }
  }
  cx.restore();
}
// anime mages
function drawPilgrim(x, y, t, cls, alpha = 1) {
  const lumi = cls === 'witch', step = Math.sin(P.walk) * 3, bob = Math.abs(Math.sin(P.walk)) * -1.5;
  const sd = Math.cos(P.face) >= 0 ? 1 : -1;
  const hair = lumi ? '#d8c8ff' : '#ff4a3a', hairD = lumi ? '#9a86d8' : '#b8221e', coat = lumi ? '#2f4cb8' : '#1d1d2e', coatD = lumi ? '#1f3282' : '#0e0e18', trim = lumi ? '#ffd84a' : '#ff9a2a', eye = lumi ? '#4ad8ff' : '#ffb020';
  light(x, y - 20, 50, lumi ? '120,200,255' : '255,140,60', .5);
  cx.save(); cx.translate(x, y); cx.globalAlpha = alpha; cx.lineJoin = 'round'; cx.lineCap = 'round';
  cx.fillStyle = 'rgba(20,10,30,.35)'; ell(0, 2, 13, 4); cx.fill();
  // legs + boots
  poly([-6 + step * .5, -12, -1 + step * .5, -12, -1 + step * .6, 0, -7 + step * .6, 0]); inkPath('#2a2a3a', 1.8);
  poly([1 - step * .5, -12, 6 - step * .5, -12, 7 - step * .6, 0, 1 - step * .6, 0]); inkPath('#2a2a3a', 1.8);
  // coat (long, flared) with cel shadow
  poly([-8, -32 + bob, 8, -32 + bob, 12, -6, 6, -9, 0, -5, -6, -9, -12, -6]); inkPath(coat, 2.2);
  poly([2, -32 + bob, 8, -32 + bob, 12, -6, 6, -9, 2, -7]); cx.fillStyle = coatD; cx.fill();
  cx.strokeStyle = trim; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-1, -31 + bob); cx.lineTo(-1, -8); cx.stroke(); // front trim
  // collar/cape
  poly([-10, -32 + bob, 10, -32 + bob, 7, -26 + bob, 0, -29 + bob, -7, -26 + bob]); inkPath(lumi ? '#ffffff' : '#c8202a', 2);
  // arm toward grimoire
  poly([sd * 5, -29 + bob, sd * 14, -22 + bob, sd * 12, -19 + bob, sd * 4, -24 + bob]); inkPath(coat, 1.8);
  cx.beginPath(); cx.arc(sd * 14, -21 + bob, 2.6, 0, TAU); inkPath('#ffe0c8', 1.5);
  // head
  const hy = -40 + bob;
  cx.beginPath(); cx.arc(0, hy, 9.5, 0, TAU); inkPath('#ffe0c8', 2.2);
  cx.fillStyle = '#f2c4a8'; cx.beginPath(); cx.arc(0, hy, 9.5, Math.PI * .1, Math.PI * .6); cx.lineTo(0, hy); cx.fill(); // jaw shade
  // eyes (big anime eyes)
  for (const ex of [-3.6, 3.6]) { const X = ex + sd * 1.2; ell(X, hy + 1, 2.2, 3); cx.fillStyle = '#fff'; cx.fill(); ell(X + sd * .4, hy + 1.4, 1.6, 2.4); cx.fillStyle = eye; cx.fill(); cx.fillStyle = INK; cx.fillRect(X + sd * .4 - .7, hy + .6, 1.4, 2); cx.fillStyle = '#fff'; cx.fillRect(X - .4, hy - .6, 1, 1); cx.strokeStyle = INK; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(X - 2.4, hy - 2.2); cx.lineTo(X + 2.4, hy - 2.6); cx.stroke(); }
  cx.strokeStyle = INK; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(sd * 1 - 1.2, hy + 6); cx.lineTo(sd * 1 + 1.2, hy + 6); cx.stroke();
  // hair
  if (lumi) { // long silver hair with side ribbon
    poly([-10, hy - 2, -11, hy + 14, -6, hy + 10, -7, hy - 4, 7, hy - 4, 6, hy + 10, 11, hy + 14, 10, hy - 2, 6, hy - 10, -6, hy - 10]); inkPath(hair, 2);
    poly([-9, hy - 3, -4, hy - 10, 0, hy - 5, 4, hy - 10, 9, hy - 3, 4, hy - 6, 0, hy - 1, -4, hy - 6]); inkPath(hair, 1.6);
    cx.fillStyle = hairD; poly([4, hy - 8, 9, hy - 3, 10, hy + 12, 7, hy + 10]); cx.fill();
    poly([-12, hy - 6, -6, hy - 9, -8, hy - 3]); inkPath('#ff5aa8', 1.4);
  } else { // spiky red hair
    poly([-11, hy + 2, -14, hy - 6, -8, hy - 7, -10, hy - 15, -3, hy - 11, 0, hy - 19, 4, hy - 11, 11, hy - 15, 9, hy - 7, 14, hy - 5, 10, hy + 1, 6, hy - 4, 2, hy + 0, -2, hy - 4, -6, hy + 0]); inkPath(hair, 2);
    cx.fillStyle = hairD; poly([4, hy - 11, 11, hy - 15, 9, hy - 7, 14, hy - 5, 10, hy + 1, 6, hy - 4]); cx.fill();
    cx.fillStyle = '#ffd0a0'; poly([-3, hy - 11, 0, hy - 17, 1, hy - 11]); cx.fill(); // highlight
  }
  cx.restore();
  // floating grimoire beside the mage
  const w = G && G.wands ? wand() : null;
  drawGrimoire(x + sd * 22, y - 34, w ? `hsl(${w.hue},70%,42%)` : (lumi ? '#2f6cd8' : '#b8202a'), w ? leavesOf(w) : (lumi ? 3 : 1), t, P.castT > 0);
}
// anime monsters: three body plans, skinned per biome
function drawFoe(f, t) {
  const B = biome(), S = B.skin;
  if ((f.elite || f.boss) && f.spawnT <= 0) light(f.x, f.y - f.r, f.r * 2.4, f.boss ? B.lampRgb : '255,60,90', .6);
  cx.save(); cx.translate(f.x, f.y); cx.lineJoin = 'round'; cx.lineCap = 'round';
  if (f.spawnT > 0) cx.globalAlpha = Math.max(0, 1 - f.spawnT * 1.6);
  const flash = f.hit > 0, s = f.r / FOES[f.type].r, F = c => flash ? '#ffffff' : c;
  cx.fillStyle = 'rgba(20,10,30,.35)'; ell(0, 2, f.r, f.r * .33); cx.fill();
  cx.scale(s, s); const lw = 2 / Math.max(1, s * .7);
  const sw = Math.sin(f.t * 6) * 2;
  const eyes = (x1, x2, y, col) => { for (const ex of [x1, x2]) { poly([ex - 2.5, y - 1.5, ex + 2.5, y - .5, ex + 2, y + 1.5, ex - 2, y + 1]); cx.fillStyle = col; cx.fill(); cx.strokeStyle = INK; cx.lineWidth = 1; cx.stroke(); } };
  if (f.type === 'husk') { // brute
    poly([-7, -10, -2, -10, -2 + sw * .4, 0, -8 + sw * .4, 0]); inkPath(F(S.d), lw); poly([2, -10, 7, -10, 8 - sw * .4, 0, 2 - sw * .4, 0]); inkPath(F(S.d), lw);
    poly([-12, -28, 12, -28, 10, -9, -10, -9]); inkPath(F(S.a), lw + .3);
    cx.fillStyle = F(S.d); poly([3, -28, 12, -28, 10, -9, 3, -9]); cx.fill();
    poly([-12, -26, -17, -12 + sw, -12, -11 + sw, -9, -20]); inkPath(F(S.a), lw); poly([12, -26, 17, -12 - sw, 12, -11 - sw, 9, -20]); inkPath(F(S.a), lw);
    cx.beginPath(); cx.arc(0, -32, 7.5, 0, TAU); inkPath(F(S.a), lw);
    poly([-6, -37, -10, -45, -3, -39]); inkPath(F(S.horn), lw * .8); poly([6, -37, 10, -45, 3, -39]); inkPath(F(S.horn), lw * .8);
    eyes(-3, 3, -32, S.eye);
    cx.strokeStyle = INK; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(-3, -27.5); cx.lineTo(3, -27.5); cx.stroke();
  } else if (f.type === 'bat') { // imp flyer
    const fl = Math.sin(f.t * 16) * 7; cx.translate(0, -24);
    for (const d of [-1, 1]) { poly([d * 3, -2, d * 20, -9 - fl, d * 17, 0 - fl * .3, d * 12, -2, d * 9, 4]); inkPath(F(S.wing), lw); }
    cx.beginPath(); cx.arc(0, 0, 7, 0, TAU); inkPath(F(S.a), lw);
    poly([-4, -5, -6, -12, -1, -6]); inkPath(F(S.horn), 1.2); poly([4, -5, 6, -12, 1, -6]); inkPath(F(S.horn), 1.2);
    eyes(-2.6, 2.6, -.5, S.eye);
    poly([-1, 4, 0, 7, 1, 4]); cx.fillStyle = '#fff'; cx.fill();
  } else if (f.type === 'cultist') { // masked caster
    poly([-11, 0, -7, -28, 7, -28, 11, 0]); inkPath(F(S.robe), lw + .2);
    cx.fillStyle = F(S.robeD); poly([2, -28, 7, -28, 11, 0, 3, 0]); cx.fill();
    poly([-8, -26, 0, -44, 8, -26]); inkPath(F(S.robe), lw);
    ell(0, -30, 5, 6); inkPath(F('#f4f0ff'), 1.5); // mask
    cx.fillStyle = INK; cx.fillRect(-3, -31, 2, 2.5); cx.fillRect(1, -31, 2, 2.5); cx.fillStyle = S.eye; cx.fillRect(-2.5, -30.5, 1, 1); cx.fillRect(1.5, -30.5, 1, 1);
    // staff with orb
    cx.strokeStyle = INK; cx.lineWidth = 3.5; cx.beginPath(); cx.moveTo(12, 0); cx.lineTo(12, -30); cx.stroke(); cx.strokeStyle = '#a07040'; cx.lineWidth = 1.8; cx.stroke();
    cx.beginPath(); cx.arc(12, -32, 3.5 + Math.sin(f.t * 6) * .5, 0, TAU); inkPath(S.eye, 1.4);
  } else if (f.type === 'warden') { // biome boss
    const K = B.bossSkin;
    // magic circle behind
    cx.save(); cx.translate(0, -36); cx.rotate(f.t * .6); cx.strokeStyle = K.glow; cx.lineWidth = 2; cx.globalAlpha *= .8; cx.beginPath(); cx.arc(0, 0, 44, 0, TAU); cx.stroke(); cx.beginPath(); for (let i = 0; i <= 7; i++) { const a = i * TAU * 3 / 7; cx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); } cx.stroke(); cx.restore();
    poly([-14, -16, -3, -16, -4, 0, -15, 0]); inkPath(F(K.d), lw); poly([3, -16, 14, -16, 15, 0, 4, 0]); inkPath(F(K.d), lw);
    poly([-24, -54, 24, -54, 18, -16, -18, -16]); inkPath(F(K.a), lw + .5);
    cx.fillStyle = F(K.d); poly([4, -54, 24, -54, 18, -16, 4, -16]); cx.fill();
    poly([-6, -48, 6, -48, 0, -28]); inkPath(F(K.gem), 1.5); // chest gem
    for (const d of [-1, 1]) { cx.beginPath(); cx.arc(d * 25, -50, 9, 0, TAU); inkPath(F(K.trim), lw); poly([d * 24, -58, d * 34, -70, d * 30, -55]); inkPath(F(K.trim), lw); }
    poly([-10, -54, -10, -70, 0, -78, 10, -70, 10, -54]); inkPath(F(K.a), lw);
    poly([-12, -70, -18, -86, -6, -74]); inkPath(F(K.trim), lw); poly([12, -70, 18, -86, 6, -74]); inkPath(F(K.trim), lw); // horns/crown
    cx.fillStyle = f.phase ? '#ff2a4a' : K.glow; poly([-7, -66, -2, -64, -2, -62, -7, -63]); cx.fill(); poly([7, -66, 2, -64, 2, -62, 7, -63]); cx.fill();
    cx.strokeStyle = INK; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(30, -40); cx.lineTo(36, 6); cx.stroke(); cx.strokeStyle = K.trim; cx.lineWidth = 2; cx.stroke();
    poly([30, -40, 42, -50, 36, -34]); inkPath(F(K.gem), 1.5);
  }
  cx.restore();
  if ((f.elite || f.boss) && f.spawnT <= 0) { const w = f.boss ? Math.min(W - 60, 260) : 40, x = Math.round(f.boss ? W / 2 - w / 2 : f.x - w / 2), y = Math.round(f.boss ? arena().y0 - 18 : f.y - f.r * 2.6 - 8); cx.fillStyle = INK; cx.fillRect(x - 2, y - 2, w + 4, 8); cx.fillStyle = '#ff2a5a'; cx.fillRect(x, y, w * Math.max(0, f.hp / f.max), 4); cx.fillStyle = '#ffffff'; cx.fillRect(x, y, w * Math.max(0, f.hp / f.max), 1); if (f.boss) { cx.font = 'bold 11px Impact, "Arial Black", sans-serif'; cx.textAlign = 'center'; cx.lineWidth = 3; cx.strokeStyle = INK; cx.strokeText(biome().boss.toUpperCase(), W / 2, y - 6); cx.fillStyle = '#fff'; cx.fillText(biome().boss.toUpperCase(), W / 2, y - 6); cx.textAlign = 'left'; } }
  if (f.burn > 0) { const k = Math.sin(t * 20) * 1.5; for (let i = -1; i <= 1; i++) { poly([f.x + i * 5 - 3, f.y - f.r * .8, f.x + i * 5, f.y - f.r * 1.6 - k - (i ? 0 : 4), f.x + i * 5 + 3, f.y - f.r * .8]); inkPath('#ff7a1a', 1); } }
  if (f.poison > 0) { for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; cx.beginPath(); cx.arc(f.x + Math.cos(a) * f.r * .8, f.y - f.r * 1.2 + Math.sin(a * 1.3) * 5, 1.8, 0, TAU); inkPath('#9aff3a', 1); } }
  if (f.frozen > 0) { cx.globalAlpha = .55; poly([f.x - f.r, f.y - f.r * .2, f.x - f.r * .6, f.y - f.r * 2, f.x + f.r * .5, f.y - f.r * 2.1, f.x + f.r, f.y - f.r * .3]); inkPath('#bff2ff', 1.5); cx.globalAlpha = 1; }
}
// manga spell circle (cast flourish)
function drawSpellCircle(x, y, r, col, rot, a) {
  cx.save(); cx.translate(x, y); cx.globalAlpha = a; cx.scale(1, .45); cx.rotate(rot);
  cx.strokeStyle = col; cx.lineWidth = 2.2; cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke(); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(0, 0, r * .78, 0, TAU); cx.stroke();
  cx.beginPath(); for (let i = 0; i <= 6; i++) { const q = i * TAU * 2 / 6 + (i > 2 ? Math.PI / 3 : 0); cx.lineTo(Math.cos(i * TAU / 3) * r * .78, Math.sin(i * TAU / 3) * r * .78); } cx.stroke();
  cx.beginPath(); for (let i = 0; i <= 3; i++) cx.lineTo(Math.cos(i * TAU / 3 + Math.PI) * r * .78, Math.sin(i * TAU / 3 + Math.PI) * r * .78); cx.stroke();
  for (let i = 0; i < 12; i++) { const q = i * TAU / 12; cx.fillStyle = col; cx.fillRect(Math.cos(q) * r * .89 - 1.5, Math.sin(q) * r * .89 - 1.5, 3, 3); }
  cx.restore();
}
