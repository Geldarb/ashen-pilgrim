// ---------- art ----------
let bg = null;
function buildBG() {
  bg = document.createElement('canvas'); bg.width = W * DPR * Z; bg.height = H * DPR * Z;
  const g = bg.getContext('2d'); g.scale(DPR * Z, DPR * Z);
  const r = mulberry(1234), A = arena();
  g.fillStyle = '#16140f'; g.fillRect(0, 0, W, H);
  // back wall with gothic arches
  const wallH = A.y0 + 10;
  const wg = g.createLinearGradient(0, 0, 0, wallH); wg.addColorStop(0, '#0f0e0b'); wg.addColorStop(1, '#2a2a20'); g.fillStyle = wg; g.fillRect(0, 0, W, wallH);
  const archW = 70, nA = Math.max(3, Math.round(W / archW)), aw = W / nA;
  for (let i = 0; i < nA; i++) {
    const x = i * aw + aw / 2, wTop = wallH * 0.18, wBot = wallH - 8, ww = aw * 0.42;
    // pointed arch window
    g.beginPath(); g.moveTo(x - ww / 2, wBot); g.lineTo(x - ww / 2, wTop + ww * .6); g.quadraticCurveTo(x - ww / 2, wTop, x, wTop - ww * .25); g.quadraticCurveTo(x + ww / 2, wTop, x + ww / 2, wTop + ww * .6); g.lineTo(x + ww / 2, wBot); g.closePath();
    const lg = g.createLinearGradient(0, wTop, 0, wBot); lg.addColorStop(0, '#3c4a3a'); lg.addColorStop(1, '#141812'); g.fillStyle = lg; g.fill();
    g.strokeStyle = '#4a4436'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#1c1a14'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, wTop); g.lineTo(x, wBot); g.moveTo(x - ww / 2, (wTop + wBot) / 2 + 4); g.lineTo(x + ww / 2, (wTop + wBot) / 2 + 4); g.stroke();
    // buttress pillar
    g.fillStyle = '#2b281f'; g.fillRect(i * aw - 5, 0, 10, wallH);
  }
  g.fillStyle = '#3a3528'; g.fillRect(0, wallH - 6, W, 8);
  // floor flagstones
  const fg = g.createLinearGradient(0, A.y0, 0, H); fg.addColorStop(0, '#2b2c22'); fg.addColorStop(1, '#22231b'); g.fillStyle = fg; g.fillRect(0, wallH + 2, W, H - wallH);
  const ts = 44;
  for (let y = wallH + 2; y < H; y += ts) for (let x = ((y / ts) % 2) * -ts / 2; x < W; x += ts) {
    const v = r(); g.fillStyle = `rgba(${60 + v * 30},${62 + v * 26},${44 + v * 16},${0.25 + v * 0.25})`; g.fillRect(x + 1, y + 1, ts - 2, ts - 2);
    if (r() < .15) { g.strokeStyle = 'rgba(10,10,6,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + r() * ts, y); g.lineTo(x + r() * ts, y + ts * .6); g.lineTo(x + r() * ts, y + ts); g.stroke(); }
    if (r() < .12) { g.fillStyle = 'rgba(70,95,50,.35)'; g.beginPath(); g.ellipse(x + r() * ts, y + r() * ts, 6 + r() * 10, 3 + r() * 5, 0, 0, TAU); g.fill(); } // moss
  }
  g.strokeStyle = 'rgba(8,8,5,.55)'; g.lineWidth = 2;
  for (let y = wallH + 2; y < H; y += ts) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // rubble & broken pillars at edges
  const pillar = (x, y, h) => { g.fillStyle = '#3b382c'; g.fillRect(x - 11, y - h, 22, h); g.fillStyle = '#4a4636'; g.fillRect(x - 15, y - 6, 30, 8); g.fillRect(x - 14, y - h - 4, 28, 6); g.fillStyle = '#262419'; g.fillRect(x + 4, y - h, 5, h); g.beginPath(); g.moveTo(x - 14, y - h - 4); g.lineTo(x - 4, y - h - 14); g.lineTo(x + 3, y - h - 6); g.lineTo(x + 14, y - h - 10); g.lineTo(x + 14, y - h - 4); g.fillStyle = '#3b382c'; g.fill(); };
  pillar(A.x0 + 14, A.y0 + 70, 50); pillar(A.x1 - 14, A.y0 + 70, 34); pillar(A.x0 + 14, A.y1 - 30, 40); pillar(A.x1 - 14, A.y1 - 30, 56);
  for (let i = 0; i < 16; i++) { g.fillStyle = r() < .5 ? '#3a372b' : '#2c2a20'; const x = r() < .5 ? r() * 40 : W - r() * 40, y = A.y0 + r() * (H - A.y0); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + r() * 6, y - 3); g.lineTo(x + 9, y + 5); g.lineTo(x + 1, y + 6); g.fill(); }
  // vignette
  const vg = g.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .25, W / 2, H * .55, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}
function braziers() { const A = arena(); return [[A.x0 + 40, A.y0 + 30], [A.x1 - 40, A.y0 + 30], [A.x0 + 40, A.y1 - 70], [A.x1 - 40, A.y1 - 230]]; }
function drawBrazier(x, y, t) {
  const gl = cx.createRadialGradient(x, y - 14, 2, x, y - 14, 110); gl.addColorStop(0, 'rgba(255,140,40,.32)'); gl.addColorStop(1, 'rgba(255,100,20,0)'); cx.fillStyle = gl; cx.fillRect(x - 110, y - 124, 220, 220);
  cx.fillStyle = '#2a241a'; cx.fillRect(x - 2, y - 4, 4, 16); cx.fillRect(x - 9, y + 10, 18, 4);
  cx.fillStyle = '#4a3a24'; cx.beginPath(); cx.moveTo(x - 12, y - 8); cx.lineTo(x + 12, y - 8); cx.lineTo(x + 7, y); cx.lineTo(x - 7, y); cx.fill();
  for (let i = 0; i < 3; i++) { const h = 14 + Math.sin(t * 9 + i * 2) * 4; cx.fillStyle = ['#ff6a1a', '#ffa030', '#ffe08a'][i]; cx.beginPath(); cx.moveTo(x - 9 + i * 3, y - 8); cx.quadraticCurveTo(x, y - 8 - h * (1 - i * .25) * 1.4, x + 9 - i * 3, y - 8); cx.fill(); }
  if (fx() < .15 && room && cx === mainCx) room.parts.push({ x: x + (fx() - .5) * 10, y: y - 18, vx: (fx() - .5) * 20, vy: -40 - fx() * 40, life: .9, c: '#ffb347', s: 1.5 });
}
function drawPilgrim(x, y, t, cls, alpha = 1) {
  cx.save(); cx.translate(x, y); cx.globalAlpha = alpha;
  const bob = Math.sin(P.walk) * 1.5, witch = cls === 'witch';
  cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0, 2, 13, 5, 0, 0, TAU); cx.fill();
  // cloak (robe)
  cx.fillStyle = witch ? '#2c2440' : '#4a3f2e';
  cx.beginPath(); cx.moveTo(-12, 0); cx.quadraticCurveTo(-11, -16, -6, -26 + bob); cx.lineTo(6, -26 + bob); cx.quadraticCurveTo(11, -16, 12, 0); cx.closePath(); cx.fill();
  cx.fillStyle = witch ? '#1c1730' : '#352c20'; cx.fillRect(-2, -24 + bob, 4, 24); // fold
  // hood
  cx.fillStyle = witch ? '#3a2f55' : '#5c4e38';
  cx.beginPath(); cx.moveTo(-8, -24 + bob); cx.quadraticCurveTo(-9, -38 + bob, 0, (witch ? -46 : -40) + bob); cx.quadraticCurveTo(9, -38 + bob, 8, -24 + bob); cx.closePath(); cx.fill();
  cx.fillStyle = '#0a0806'; cx.beginPath(); cx.ellipse(0, -30 + bob, 4.5, 5.5, 0, 0, TAU); cx.fill(); // face shadow
  cx.fillStyle = '#ffb347'; cx.fillRect(-2.5, -31 + bob, 1.5, 1.5); cx.fillRect(1, -31 + bob, 1.5, 1.5); // eyes
  // staff + flame vessel on facing side
  const sd = Math.cos(P.face) >= 0 ? 1 : -1;
  cx.strokeStyle = '#6b4e2e'; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(sd * 13, 2); cx.lineTo(sd * 13, -34 + bob); cx.stroke();
  const fy = -38 + bob, fl = clamp(G ? G.flame / G.maxFlame : 1, .2, 1);
  const gl = cx.createRadialGradient(sd * 13, fy, 1, sd * 13, fy, 60 * fl + 20); gl.addColorStop(0, witch ? 'rgba(150,230,255,.45)' : 'rgba(255,170,60,.5)'); gl.addColorStop(1, 'rgba(255,120,20,0)'); cx.fillStyle = gl; cx.beginPath(); cx.arc(sd * 13, fy, 60 * fl + 20, 0, TAU); cx.fill();
  if (witch) { cx.fillStyle = '#3a3020'; cx.fillRect(sd * 13 - 5, fy - 5, 10, 11); cx.fillStyle = '#9fe6ff'; cx.fillRect(sd * 13 - 3, fy - 3, 6, 7); cx.fillStyle = '#3a3020'; cx.fillRect(sd * 13 - 6, fy - 7, 12, 2); }
  else { cx.fillStyle = '#ff7a1a'; cx.beginPath(); cx.moveTo(sd * 13 - 4, fy + 3); cx.quadraticCurveTo(sd * 13, fy - 10 * fl - 4 + Math.sin(t * 12) * 2, sd * 13 + 4, fy + 3); cx.fill(); cx.fillStyle = '#ffe08a'; cx.beginPath(); cx.ellipse(sd * 13, fy, 2, 3, 0, 0, TAU); cx.fill(); }
  cx.restore();
}
function drawFoe(f, t) {
  cx.save(); cx.translate(f.x, f.y);
  if (f.spawnT > 0) { cx.globalAlpha = 1 - f.spawnT * 1.6; }
  const flash = f.hit > 0, s = f.r / FOES[f.type].r;
  cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0, 2, f.r, f.r * .35, 0, 0, TAU); cx.fill();
  if (f.elite || f.boss) { const g = cx.createRadialGradient(0, -f.r, 2, 0, -f.r, f.r * 2.2); g.addColorStop(0, 'rgba(170,40,30,.35)'); g.addColorStop(1, 'rgba(170,40,30,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(0, -f.r, f.r * 2.2, 0, TAU); cx.fill(); }
  cx.scale(s, s);
  const sw = Math.sin(f.t * 6) * 2;
  if (f.type === 'husk') { // shambling hollow: hunched body, long arms, skull head
    const c = flash ? '#fff' : '#6d7556';
    cx.fillStyle = flash ? '#fff' : '#3d4232'; cx.fillRect(-6, -8, 4, 9 + sw * .5); cx.fillRect(2, -8, 4, 9 - sw * .5); // legs
    cx.fillStyle = c; cx.beginPath(); cx.ellipse(0, -16, 10, 11, .15, 0, TAU); cx.fill(); // torso
    cx.strokeStyle = flash ? '#fff' : '#58604a'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(-8, -20); cx.lineTo(-13, -6 + sw); cx.moveTo(8, -20); cx.lineTo(13, -6 - sw); cx.stroke();
    cx.strokeStyle = '#2a2e22'; cx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(-6, -20 + i * 4); cx.lineTo(6, -20 + i * 4); cx.stroke(); } // ribs
    cx.fillStyle = flash ? '#fff' : '#c9c2a4'; cx.beginPath(); cx.arc(3, -30, 6.5, 0, TAU); cx.fill(); // skull
    cx.fillStyle = '#ff5a1a'; cx.fillRect(1, -31, 2, 2); cx.fillRect(5, -31, 2, 2);
    cx.fillStyle = '#2a2418'; cx.fillRect(1, -27, 5, 1.5);
  } else if (f.type === 'bat') { // gargoyle bat: wings
    const fl = Math.sin(f.t * 18) * 8;
    cx.fillStyle = flash ? '#fff' : '#45403a'; cx.translate(0, -22);
    for (const d of [-1, 1]) { cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(d * 18, -6 - fl); cx.lineTo(d * 14, 2 - fl * .3); cx.lineTo(d * 10, -1); cx.lineTo(d * 7, 5); cx.closePath(); cx.fill(); }
    cx.fillStyle = flash ? '#fff' : '#5c564c'; cx.beginPath(); cx.ellipse(0, 0, 5, 7, 0, 0, TAU); cx.fill();
    cx.beginPath(); cx.moveTo(-4, -5); cx.lineTo(-3, -10); cx.lineTo(-1, -6); cx.moveTo(4, -5); cx.lineTo(3, -10); cx.lineTo(1, -6); cx.fill(); // ears
    cx.fillStyle = '#ffcf4a'; cx.fillRect(-3, -3, 2, 2); cx.fillRect(1, -3, 2, 2);
  } else if (f.type === 'cultist') { // robed cultist with red candle
    cx.fillStyle = flash ? '#fff' : '#4a2224'; cx.beginPath(); cx.moveTo(-11, 0); cx.lineTo(-6, -26); cx.lineTo(6, -26); cx.lineTo(11, 0); cx.fill();
    cx.fillStyle = flash ? '#fff' : '#5e2a2c'; cx.beginPath(); cx.moveTo(-7, -24); cx.lineTo(0, -40); cx.lineTo(7, -24); cx.fill(); // pointed hood
    cx.fillStyle = '#0a0606'; cx.beginPath(); cx.ellipse(0, -27, 3.5, 4, 0, 0, TAU); cx.fill();
    cx.fillStyle = '#ff3a2a'; cx.fillRect(-2, -28, 1.5, 1.5); cx.fillRect(1, -28, 1.5, 1.5);
    cx.fillStyle = '#d8c8a0'; cx.fillRect(9, -22, 3, 8); cx.fillStyle = '#ff5a2a'; cx.beginPath(); cx.ellipse(10.5, -24 + sw * .3, 2, 3.5, 0, 0, TAU); cx.fill();
  } else if (f.type === 'warden') { // Bell-Warden: armored giant with a great bell on its back
    cx.translate(0, 0);
    cx.fillStyle = flash ? '#fff' : '#2e2a22'; cx.fillRect(-12, -14, 9, 14); cx.fillRect(3, -14, 9, 14);
    cx.fillStyle = flash ? '#fff' : '#6b5a3a'; cx.beginPath(); cx.moveTo(-24, -58); cx.quadraticCurveTo(0, -78, 24, -58); cx.lineTo(28, -40); cx.lineTo(-28, -40); cx.closePath(); cx.fill(); // bell
    cx.fillStyle = '#8a7448'; cx.fillRect(-28, -42, 56, 4);
    cx.fillStyle = flash ? '#fff' : '#45473a'; cx.beginPath(); cx.moveTo(-18, -14); cx.lineTo(-22, -42); cx.lineTo(22, -42); cx.lineTo(18, -14); cx.closePath(); cx.fill(); // armored torso
    cx.strokeStyle = '#2a2b22'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(0, -42); cx.lineTo(0, -14); cx.moveTo(-18, -28); cx.lineTo(18, -28); cx.stroke();
    cx.fillStyle = flash ? '#fff' : '#58594a'; cx.beginPath(); cx.arc(-24, -38, 8, 0, TAU); cx.arc(24, -38, 8, 0, TAU); cx.fill(); // pauldrons
    cx.fillStyle = flash ? '#fff' : '#3c3d32'; cx.fillRect(-9, -56, 18, 16); cx.beginPath(); cx.moveTo(-9, -56); cx.lineTo(0, -64); cx.lineTo(9, -56); cx.fill(); // helm
    cx.fillStyle = f.phase ? '#ff3a1a' : '#ffb347'; cx.fillRect(-6, -50, 12, 2.5); // visor glow
    cx.strokeStyle = '#7a6a4a'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(28, -34); cx.lineTo(34, 4); cx.stroke(); // hammer handle
    cx.fillStyle = '#4a4a40'; cx.fillRect(26, 0, 16, 10);
  }
  cx.restore();
  if ((f.elite || f.boss) && f.spawnT <= 0) { const w = f.boss ? Math.min(W - 60, 260) : 40, x = f.boss ? W / 2 - w / 2 : f.x - w / 2, y = f.boss ? arena().y0 - 18 : f.y - f.r * 2.6 - 8; cx.fillStyle = '#000a'; cx.fillRect(x - 1, y - 1, w + 2, 6); cx.fillStyle = '#a8321e'; cx.fillRect(x, y, w * Math.max(0, f.hp / f.max), 4); }
  if (f.burn > 0) { cx.fillStyle = 'rgba(255,110,30,.5)'; cx.beginPath(); cx.arc(f.x, f.y - f.r, f.r * .7 + Math.sin(t * 20) * 2, 0, TAU); cx.fill(); }
}
