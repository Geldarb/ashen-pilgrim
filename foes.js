'use strict';
// Grimoire Ascent — enemy & boss art: idle / walk / wind-up tell / hit recoil / ember-and-ash death, squash & stretch,
// secondary motion (shrouds, robes, wings, chains, capes) and boss phase effects. Pure canvas paths, no blur.
const _mixC = new Map();
function mixHex(a, b, k) {
  if (k <= 0) return a; const key = a + b + (k * 20 | 0); let v = _mixC.get(key); if (v) return v;
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], A = p(a), B = p(b), q = Math.round(k * 20) / 20;
  v = '#' + A.map((x, i) => Math.round(x + (B[i] - x) * q).toString(16).padStart(2, '0')).join(''); if (_mixC.size > 4000) _mixC.clear(); _mixC.set(key, v); return v;
}
// derive motion from drawn positions so the same animation runs on the host, guests and the preview
function foeMotion(f, t) {
  const dt = f.lt != null ? clamp(t - f.lt, 0, .1) : 0; f.lt = t;
  const dx = f.lx != null ? f.x - f.lx : 0, dy = f.ly != null ? f.y - f.ly : 0; f.lx = f.x; f.ly = f.y;
  const mv = Math.hypot(dx, dy);
  if (dt > 0) { f.vxs = (f.vxs || 0) * .85 + (dx / dt) * .15; f.vs = (f.vs || 0) * .85 + (mv / dt) * .15; }
  if (!(f.frozen > 0) && !(f.stun > 0)) f.wp = (f.wp || 0) + mv * .17;
  if (Math.abs(f.vxs || 0) > 12 && f.face == null) f.face = f.vxs > 0 ? 1 : -1;
}
function tellOf(f) {
  if (f.tell != null) return f.tell; // guests: synced from the host
  if (f.wind > 0) return clamp(1 - f.wind / (f.type === 'bat' ? .32 : .42), 0, 1);
  if (FOES[f.type] && FOES[f.type].ranged && f.atk < .5 && !(f.silence > 0) && !(f.stun > 0)) return clamp(1 - f.atk / .5, 0, 1);
  if (f.boss && f.atk < .6 && !(f.phaseT > 0)) return clamp(1 - f.atk / .6, 0, 1);
  return 0;
}
function drawFoe(f, t) {
  const bi = (G ? G.floor || 0 : 0) % 4, S = FSKIN[bi], K = BSKIN[bi];
  foeMotion(f, t);
  const tell = tellOf(f), s = f.r / FOES[f.type].r, face = f.face || 1;
  if ((f.elite || f.boss) && f.spawnT <= 0) light(f.x, f.y - f.r, f.r * 2.4, f.boss ? (f.phase ? '255,60,40' : K.circ) : '200,40,30', .6);
  if (f.boss && f.spawnT <= 0) drawSpellCircle(f.x, f.y, 56 + tell * 14, f.phase ? '#ff4a2a' : K.glow, f.t * (f.phase ? 1.2 : .5), .55 + tell * .35);
  if (tell > 0 && !f.boss) { // readable wind-up tell: a tightening crimson ring under the foe
    cx.strokeStyle = `rgba(255,${FOES[f.type].ranged ? 200 : 60},60,${.35 + tell * .5})`; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(f.x, f.y + 1, f.r * (1.9 - tell * .7), f.r * (1.9 - tell * .7) * .35, 0, 0, TAU); cx.stroke();
  }
  cx.save(); cx.translate(f.x, f.y);
  // shadow
  cx.fillStyle = 'rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(0, 2, f.r * (f.type === 'bat' ? .7 : 1), f.r * .3, 0, 0, TAU); cx.fill();
  let rise = 0;
  if (f.spawnT > 0) { rise = clamp(f.spawnT / .5, 0, 1); cx.strokeStyle = `rgba(${K.circ},${rise})`; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(0, 1, f.r * 1.4, f.r * .45, 0, 0, TAU); cx.stroke(); cx.beginPath(); cx.rect(-f.r * 4, -f.r * 6, f.r * 8, f.r * 6 + 3); cx.clip(); cx.translate(0, rise * f.r * 2.6); }
  const hit = f.hit > 0 ? f.hit / .12 : 0, flash = f.hit > 0;
  // squash & stretch
  const walk = Math.min(1, (f.vs || 0) / 40), br = Math.sin(t * 2.6 + (f.id || 0)) * .025;
  let sx = 1 - br * .5, sy = 1 + br + Math.sin((f.wp || 0) * 2) * .045 * walk;
  if (tell > 0 && !FOES[f.type].ranged) { sy *= 1 - tell * .18; sx *= 1 + tell * .14; }
  if (f.lunge > 0) { sx *= 1.16; sy *= .9; }
  if (hit) { sx *= 1 + hit * .12; sy *= 1 - hit * .1; cx.translate(-face * hit * 3, 0); }
  if (f.stun > 0) cx.rotate(Math.sin(t * 12) * .08);
  if (f.boss && f.phaseT > 0) cx.translate((fx() - .5) * 4, 0);
  if (tell > .6 && !f.boss) cx.translate((fx() - .5) * 1.4, 0);
  cx.scale(s * sx * face, s * sy);
  cx.strokeStyle = OUT; cx.lineWidth = (1.2 / s + .3); cx.lineJoin = 'round'; cx.lineCap = 'round';
  const F = c => flash ? '#fff4e0' : c;
  const st = { t, wp: f.wp || 0, walk, tell, lean: clamp(-(f.vxs || 0) * face / 140, -.6, .6), F, S, K, f, frozen: f.frozen > 0 };
  BODY[f.type](st);
  cx.restore();
  if ((f.elite || f.boss) && f.spawnT <= 0) { const w = f.boss ? Math.min(W - 60, 260) : 40, x = Math.round(f.boss ? W / 2 - w / 2 : f.x - w / 2), y = Math.round(f.boss ? arena().y0 - 18 + SAFE.t : f.y - f.r * 2.6 - 8); cx.fillStyle = '#000c'; cx.fillRect(x - 1, y - 1, w + 2, 6); cx.fillStyle = '#a8321e'; cx.fillRect(x, y, w * Math.max(0, f.hp / f.max), 4); cx.fillStyle = '#ff7a4a'; cx.fillRect(x, y, w * Math.max(0, f.hp / f.max), 1); if (f.boss) { cx.font = '11px Georgia'; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.fillStyle = '#e8c890'; cx.fillText(biome().boss + (f.phase ? ' — enraged' : ''), W / 2, y - 4); cx.textAlign = 'left'; } }
  if (f.burn > 0) { const k = Math.sin(t * 20) * 1.5; cx.fillStyle = '#ff6a1a'; for (let i = -1; i <= 1; i++) { cx.beginPath(); cx.moveTo(f.x + i * 5 - 3, f.y - f.r * .8); cx.lineTo(f.x + i * 5, f.y - f.r * 1.6 - k - (i ? 0 : 4)); cx.lineTo(f.x + i * 5 + 3, f.y - f.r * .8); cx.fill(); } }
  if (f.poison > 0) { cx.fillStyle = '#8aff4a'; for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; cx.fillRect(Math.round(f.x + Math.cos(a) * f.r * .8), Math.round(f.y - f.r * 1.2 + Math.sin(a * 1.3) * 5), 2, 2); } }
  if (f.frozen > 0) { cx.strokeStyle = '#cfefff'; cx.lineWidth = 1.5; cx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; cx.moveTo(f.x, f.y - f.r); cx.lineTo(f.x + Math.cos(a) * f.r, f.y - f.r + Math.sin(a) * f.r); } cx.stroke(); cx.fillStyle = 'rgba(170,225,255,.25)'; cx.beginPath(); cx.arc(f.x, f.y - f.r, f.r * 1.05, 0, TAU); cx.fill(); }
  if (f.hex > 0) { cx.strokeStyle = '#b06aff'; cx.lineWidth = 1; cx.beginPath(); for (let i = 0; i <= 3; i++) { const q = t * 2 + i * TAU / 3; cx.lineTo(f.x + Math.cos(q) * (f.r + 4), f.y - f.r + Math.sin(q) * (f.r + 4) * .5); } cx.stroke(); }
  drawFoeStatus2(f, t);
}
const BODY = {
  // Husk: a hunched grave-risen corpse in a burial shroud; jaw hangs open, arms reach
  husk(st) {
    const { t, wp, walk, tell, lean, F, S, f } = st, L = Math.sin(wp) * 4 * walk, jaw = 1 + Math.abs(Math.sin(wp * 1.3)) * 1.5 * walk + tell * 3;
    // shroud tail strips (secondary motion, trail behind)
    for (let i = 0; i < 3; i++) { const sw = Math.sin(t * 5 + i * 1.7) * 2 + lean * 10; cx.fillStyle = F(i % 2 ? '#3a3226' : '#4a4030'); cx.beginPath(); cx.moveTo(-6 + i * 2, -18); cx.quadraticCurveTo(-12 + i * 2 + sw * .5, -10, -14 + i * 3 + sw, -2 - i); cx.lineTo(-9 + i * 3 + sw, -3); cx.closePath(); cx.fill(); cx.stroke(); }
    // legs: bone + wraps
    for (const [lx, ph] of [[-4, L], [3, -L]]) { cx.fillStyle = F(S.bone); cx.beginPath(); cx.moveTo(lx - 1.6, -10); cx.lineTo(lx + ph * .4 - 1.4, 0); cx.lineTo(lx + ph * .4 + 1.6, 0); cx.lineTo(lx + 1.8, -10); cx.closePath(); cx.fill(); cx.stroke(); cx.fillStyle = F('#5a4a34'); cx.fillRect(lx + ph * .2 - 2.2, -6, 4.4, 2); cx.fillStyle = F(S.d); cx.beginPath(); cx.ellipse(lx + ph * .4 + 1, 0, 3, 1.4, 0, 0, TAU); cx.fill(); cx.stroke(); }
    cx.save(); cx.translate(0, -10); cx.rotate(.18 + tell * .2 + (f.lunge > 0 ? .25 : 0)); // hunch
    // back arm
    const reach = f.lunge > 0 ? 1 : tell > 0 ? -1 : Math.sin(wp * .9) * .3;
    cx.fillStyle = F(S.d); cx.beginPath(); cx.moveTo(-3, -14); cx.lineTo(4 + reach * 6, -4 + Math.abs(reach) * -4); cx.lineTo(6 + reach * 7, -2 + Math.abs(reach) * -4); cx.lineTo(-1, -11); cx.closePath(); cx.fill(); cx.stroke();
    // torso: shroud + ribs
    cx.fillStyle = F(S.a); cx.beginPath(); cx.moveTo(-8, 0); cx.quadraticCurveTo(-10, -12, -6, -20); cx.quadraticCurveTo(0, -24, 7, -19); cx.quadraticCurveTo(10, -10, 7, 0); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = F('#2a241a'); cx.beginPath(); cx.moveTo(-2, -18); cx.lineTo(6, -16); cx.lineTo(6, -6); cx.lineTo(-1, -5); cx.closePath(); cx.fill();
    cx.strokeStyle = F(S.bone); cx.lineWidth = 1.1; for (let i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(0, -15 + i * 3.4); cx.quadraticCurveTo(3.5, -16 + i * 3.4, 6, -14 + i * 3.4); cx.stroke(); } cx.strokeStyle = OUT; cx.lineWidth = 1.5;
    cx.fillStyle = F('#4a4030'); cx.beginPath(); cx.moveTo(-9, -3); cx.lineTo(-5, -9); cx.lineTo(-3, -2); cx.lineTo(0, -7); cx.lineTo(3, -1); cx.lineTo(-8, 1); cx.closePath(); cx.fill(); // torn hem
    // head
    cx.save(); cx.translate(6, -23); cx.rotate(Math.sin(t * 1.7 + (f.id || 0)) * .08 - tell * .2);
    cx.fillStyle = F(S.bone); cx.beginPath(); cx.arc(0, 0, 6.2, 0, TAU); cx.fill(); cx.stroke();
    cx.fillStyle = F('#3a3226'); cx.beginPath(); cx.arc(-1, -2, 6.6, Math.PI * .95, Math.PI * 1.9); cx.lineTo(-1, -1); cx.closePath(); cx.fill(); // hood scrap
    cx.fillStyle = F(S.bone); cx.beginPath(); cx.moveTo(-2, 3); cx.lineTo(6, 3); cx.lineTo(5, 3 + jaw + 2); cx.lineTo(-1, 3 + jaw + 1); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = '#0c0806'; cx.fillRect(0, -2, 2.6, 2.6); cx.fillRect(3.6, -2, 2.6, 2.6); cx.fillRect(1, 3.2, 4, jaw * .8);
    cx.fillStyle = tell > 0 ? '#ff4a2a' : S.eye; const e = 1 + tell; cx.fillRect(.8, -1.4, e, e); cx.fillRect(4.4, -1.4, e, e);
    cx.restore();
    // front arm, clawed
    cx.fillStyle = F(S.bone); cx.save(); cx.translate(2, -15); cx.rotate(-.5 - reach * .6); cx.beginPath(); cx.rect(-1.6, 0, 3.2, 10); cx.fill(); cx.stroke(); cx.translate(0, 10); cx.rotate(-.5); cx.beginPath(); cx.rect(-1.4, 0, 2.8, 7); cx.fill(); cx.stroke(); for (let i = -1; i <= 1; i++) { cx.beginPath(); cx.moveTo(i * 1.4, 7); cx.lineTo(i * 2, 10); cx.stroke(); } cx.restore();
    cx.restore();
    if (f.undead && !st.flash) { cx.fillStyle = 'rgba(232,224,190,.18)'; cx.fillRect(-1, -42, 2, 6); cx.fillRect(-3, -40, 6, 2); }
  },
  // Bat: gothic night-flyer; membranes on finger bones, ear twitch, wings lag the body
  bat(st) {
    const { t, tell, F, S, f } = st, flap = tell > 0 ? -1 + Math.sin(t * 40) * .05 : Math.sin(t * 16 + (f.id || 0));
    const hov = tell > 0 ? -6 * tell : Math.sin(t * 7) * 1.5;
    cx.translate(0, -22 + hov); cx.rotate(f.lunge > 0 ? .35 : tell * -.3);
    for (const d of [-1, 1]) {
      const up = flap * 9, tipX = d * 21, tipY = -6 - up;
      cx.fillStyle = F(S.wing); cx.beginPath(); cx.moveTo(d * 3, -1);
      cx.lineTo(d * 9, -5 - up * .5); cx.lineTo(tipX, tipY); cx.quadraticCurveTo(d * 17, 1 - up * .3, d * 15, 3 - up * .2); cx.quadraticCurveTo(d * 12, 1, d * 10, 5 - up * .1); cx.quadraticCurveTo(d * 7, 3, d * 4, 5); cx.closePath(); cx.fill(); cx.stroke();
      cx.strokeStyle = F('#6a5e50'); cx.lineWidth = .9; cx.beginPath(); cx.moveTo(d * 9, -5 - up * .5); cx.lineTo(d * 15, 3 - up * .2); cx.moveTo(d * 9, -5 - up * .5); cx.lineTo(d * 10, 5 - up * .1); cx.stroke(); cx.strokeStyle = OUT; cx.lineWidth = 1.5;
      cx.fillStyle = F(S.bone); cx.fillRect(tipX - .8, tipY - 1.5, 1.6, 2);
    }
    cx.fillStyle = F(S.a); cx.beginPath(); cx.ellipse(0, 1, 5.5, 7.5, 0, 0, TAU); cx.fill(); cx.stroke();
    cx.fillStyle = F(S.d); cx.beginPath(); cx.ellipse(0, 3.5, 3.5, 4, 0, 0, TAU); cx.fill(); // belly fur
    const tw = Math.sin(t * 3 + (f.id || 0)) > .92 ? 2 : 0;
    cx.fillStyle = F(S.a); cx.beginPath(); cx.moveTo(-4.5, -4); cx.lineTo(-5 - tw * .5, -12); cx.lineTo(-1.5, -6); cx.moveTo(4.5, -4); cx.lineTo(5, -12); cx.lineTo(1.5, -6); cx.fill(); cx.stroke();
    cx.fillStyle = tell > 0 ? '#ff3a2a' : S.eye; cx.fillRect(-3.2, -3, 2.2, 2); cx.fillRect(1, -3, 2.2, 2);
    cx.fillStyle = '#fff'; cx.fillRect(-1.6, 1.5, 1, 2.4); cx.fillRect(.6, 1.5, 1, 2.4);
    cx.fillStyle = F(S.d); cx.fillRect(-3, 8, 1.4, 2.4); cx.fillRect(1.6, 8, 1.4, 2.4); // feet
  },
  // Cultist: masked, hooded caster; robe hem ripples, belt cord swings, candle staff raised as the tell
  cultist(st) {
    const { t, wp, walk, tell, lean, F, S, f } = st, hem = i => Math.sin(t * 6 + i * 1.3 + wp) * 1.4 + lean * 4;
    cx.fillStyle = F(S.robeD); cx.beginPath(); cx.moveTo(-10, 0); cx.lineTo(-6, -24); cx.lineTo(6, -24); cx.lineTo(11, 0); cx.closePath(); cx.fill();
    cx.fillStyle = F(S.robe); cx.beginPath(); cx.moveTo(-6, -26); cx.lineTo(6, -26);
    const pts = 6; for (let i = 0; i <= pts; i++) { const x = 11 - i * 22 / pts + hem(i); cx.lineTo(x + (i === 0 ? 0 : 0), i % 2 ? -1 : 1.5); }
    cx.closePath(); cx.fill(); cx.stroke();
    cx.strokeStyle = F(S.robeD); cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-2, -24); cx.lineTo(-4 + hem(2) * .5, 0); cx.moveTo(3, -24); cx.lineTo(5 + hem(4) * .5, 0); cx.stroke(); cx.strokeStyle = OUT; cx.lineWidth = 1.5;
    cx.fillStyle = F('#c8a050'); cx.fillRect(-7, -13, 14, 2); // cord belt
    const sw = Math.sin(t * 4) * .3 + lean; cx.strokeStyle = F('#c8a050'); cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(-3, -12); cx.lineTo(-3 + Math.sin(sw) * 6, -12 + Math.cos(sw) * 6); cx.stroke(); cx.fillStyle = F('#c8a050'); cx.fillRect(-4 + Math.sin(sw) * 6, -12 + Math.cos(sw) * 6, 2, 3); cx.strokeStyle = OUT; cx.lineWidth = 1.5;
    // hood + mask
    cx.fillStyle = F(S.robe); cx.beginPath(); cx.moveTo(-8, -23); cx.quadraticCurveTo(-8, -38, 0, -43); cx.quadraticCurveTo(8, -38, 8, -23); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = '#080404'; cx.beginPath(); cx.ellipse(0, -30, 4.6, 5.6, 0, 0, TAU); cx.fill();
    cx.fillStyle = F('#d8d0c0'); cx.beginPath(); cx.moveTo(-3.6, -33); cx.quadraticCurveTo(0, -35.5, 3.6, -33); cx.lineTo(3, -27); cx.quadraticCurveTo(0, -24.5, -3, -27); cx.closePath(); cx.fill();
    cx.fillStyle = tell > 0 ? '#ffe08a' : S.eye; cx.fillRect(-2.6, -31, 2, 1.2); cx.fillRect(.6, -31, 2, 1.2); cx.fillStyle = '#5a2020'; cx.fillRect(-.5, -29, 1, 2.4);
    // arm + staff: raised overhead during the tell
    const raise = tell, ax = 9 - raise * 2, ay = -20 - raise * 12;
    cx.fillStyle = F(S.robe); cx.beginPath(); cx.moveTo(4, -22); cx.lineTo(ax + 2, ay + 2); cx.lineTo(ax - 1, ay + 4); cx.lineTo(3, -16); cx.closePath(); cx.fill(); cx.stroke();
    cx.strokeStyle = F('#4a3420'); cx.lineWidth = 2; cx.beginPath(); cx.moveTo(ax, ay + 12); cx.lineTo(ax, ay - 10); cx.stroke(); cx.strokeStyle = OUT; cx.lineWidth = 1.5;
    cx.fillStyle = F('#d8c8a0'); cx.fillRect(ax - 1.8, ay - 15, 3.6, 5); cx.strokeRect(ax - 1.8, ay - 15, 3.6, 5);
    const fh = 3.5 + raise * 3 + Math.sin(t * 18) * .6; cx.fillStyle = S.flame; cx.beginPath(); cx.moveTo(ax - 2 - raise, ay - 15); cx.quadraticCurveTo(ax, ay - 15 - fh * 2, ax + 2 + raise, ay - 15); cx.fill(); cx.fillStyle = '#fff0b0'; cx.fillRect(ax - .6, ay - 17, 1.2, 2);
    if (raise > 0) { cx.save(); cx.translate(ax, ay - 20); cx.scale(1 / (st.f.face || 1), 1); drawSpellCircle(0, 0, 6 + raise * 6, S.flame, t * 4, raise); cx.restore(); }
  },
  // Warden (boss): bell-helmed knight; cape and shoulder chains swing; crown varies by biome; enraged phase cracks with fire
  warden(st) {
    const { t, wp, walk, tell, lean, F, K, f } = st, ph = f.phase, stomp = Math.sin(wp * .7), bob = Math.abs(stomp) * 1.5 * walk;
    const bi = (G ? G.floor || 0 : 0) % 4, glow = ph ? '#ff4a2a' : K.glow;
    // cape (secondary motion)
    cx.fillStyle = F(ph ? '#3a0e0a' : K.d); cx.beginPath(); cx.moveTo(-20, -54); cx.lineTo(18, -54);
    for (let i = 0; i <= 6; i++) { const x = 22 - i * 7.5 + Math.sin(t * 3 + i) * 2 + lean * 10, y = 2 + (i % 2 ? -4 : 0) + Math.sin(t * 4 + i * 2) * 1.5; cx.lineTo(x - 4, y); }
    cx.closePath(); cx.fill(); cx.stroke();
    // legs (heavy stomp)
    for (const [lx, k] of [[-8, stomp], [8, -stomp]]) { const lift = Math.max(0, k) * 3 * walk; cx.fillStyle = F(K.d); cx.beginPath(); cx.rect(lx - 5, -16 - lift, 10, 16); cx.fill(); cx.stroke(); cx.fillStyle = F(K.a); cx.beginPath(); cx.moveTo(lx - 7, -lift); cx.lineTo(lx + 7, -lift); cx.lineTo(lx + 6, -5 - lift); cx.lineTo(lx - 6, -5 - lift); cx.closePath(); cx.fill(); cx.stroke(); cx.fillStyle = F(K.trim); cx.fillRect(lx - 4, -12 - lift, 8, 2); }
    cx.translate(0, -bob);
    // torso armour
    cx.fillStyle = F(K.a); cx.beginPath(); cx.moveTo(-20, -16); cx.lineTo(-25, -46); cx.quadraticCurveTo(0, -56, 25, -46); cx.lineTo(20, -16); cx.closePath(); cx.fill(); cx.stroke();
    cx.strokeStyle = F('#14120e'); cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(0, -50); cx.lineTo(0, -16); cx.moveTo(-21, -31); cx.lineTo(21, -31); cx.stroke(); cx.strokeStyle = OUT; cx.lineWidth = 1.5;
    cx.fillStyle = F(K.trim); cx.fillRect(-21, -20, 42, 3); for (const [a, b] of [[-15, -42], [15, -42], [-15, -24], [15, -24]]) cx.fillRect(a - 1, b - 1, 2.4, 2.4);
    leafCrest(cx, 0, -34, 6, 4, flash(f) ? '#fff' : glow);
    if (ph) { cx.strokeStyle = '#ff6a2a'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(-12, -44); cx.lineTo(-7, -36); cx.lineTo(-10, -28); cx.moveTo(10, -40); cx.lineTo(6, -30); cx.lineTo(11, -22); cx.stroke(); cx.strokeStyle = OUT; cx.lineWidth = 1.5; if (room && fx() < .3 && room.parts.length < PCAP()) room.parts.push({ x: f.x + (fx() - .5) * 30, y: f.y - 40, vx: (fx() - .5) * 20, vy: -50, life: .6, c: '#ff7a2a', s: 2, ember: true }); }
    // shoulder chains (pendulums lagging the motion)
    for (const d of [-1, 1]) {
      const a0 = Math.sin(t * 2.4 + d) * .25 + lean * .8;
      cx.strokeStyle = F('#7a7468'); cx.lineWidth = 1.4; cx.beginPath(); let px = d * 27, py = -44; cx.moveTo(px, py);
      for (let i = 1; i <= 5; i++) { const q = a0 * (i / 5) * 1.6; px += Math.sin(q) * 4.5; py += Math.cos(q) * 4.5; cx.lineTo(px, py); } cx.stroke();
      cx.fillStyle = F('#4a463e'); cx.beginPath(); cx.arc(px, py + 2, 2.6, 0, TAU); cx.fill(); cx.stroke(); cx.strokeStyle = OUT; cx.lineWidth = 1.5;
      cx.fillStyle = F(K.a); cx.beginPath(); cx.arc(d * 25, -44, 9, 0, TAU); cx.fill(); cx.stroke(); cx.fillStyle = F(K.trim); cx.beginPath(); cx.moveTo(d * 18, -50); cx.lineTo(d * 31, -56); cx.lineTo(d * 30, -46); cx.closePath(); cx.fill(); cx.stroke();
    }
    // bell helm
    const lift = tell * 3; cx.fillStyle = F(K.d); cx.beginPath(); cx.moveTo(-11, -46 - lift); cx.quadraticCurveTo(-12, -68 - lift, 0, -72 - lift); cx.quadraticCurveTo(12, -68 - lift, 11, -46 - lift); cx.lineTo(14, -43 - lift); cx.lineTo(-14, -43 - lift); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = F(K.trim); cx.fillRect(-14, -46 - lift, 28, 3); cx.fillRect(-1.5, -76 - lift, 3, 5);
    cx.fillStyle = '#060404'; cx.fillRect(-8, -59 - lift, 16, 4); cx.fillRect(-1.5, -59 - lift, 3, 9);
    cx.fillStyle = glow; cx.fillRect(-7, -58 - lift, 5, 2); cx.fillRect(2, -58 - lift, 5, 2);
    // biome crown
    cx.fillStyle = F(K.trim); cx.strokeStyle = OUT;
    if (bi === 0) { cx.lineWidth = 1.6; cx.strokeStyle = F('#6a5a30'); cx.beginPath(); for (const d of [-1, 1]) { cx.moveTo(d * 8, -66 - lift); cx.lineTo(d * 16, -80 - lift); cx.lineTo(d * 22, -84 - lift); cx.moveTo(d * 13, -75 - lift); cx.lineTo(d * 10, -84 - lift); } cx.stroke(); }
    else if (bi === 1) { for (const d of [-1, 1]) { cx.beginPath(); cx.moveTo(d * 8, -64 - lift); cx.quadraticCurveTo(d * 22, -70 - lift, d * 18, -86 - lift); cx.quadraticCurveTo(d * 16, -74 - lift, d * 5, -68 - lift); cx.closePath(); cx.fill(); cx.stroke(); } }
    else if (bi === 2) { for (let i = -2; i <= 2; i++) { cx.beginPath(); cx.moveTo(i * 4 - 2, -69 - lift); cx.lineTo(i * 4.6, -80 - lift - (2 - Math.abs(i)) * 4); cx.lineTo(i * 4 + 2, -69 - lift); cx.closePath(); cx.fill(); cx.stroke(); } }
    else { cx.strokeStyle = glow; cx.lineWidth = 1.4; cx.beginPath(); cx.ellipse(0, -82 - lift, 13, 4, 0, 0, TAU); cx.stroke(); for (let i = 0; i < 6; i++) { const q = i * TAU / 6 + t; cx.fillStyle = glow; cx.fillRect(Math.cos(q) * 13 - 1, -82 - lift + Math.sin(q) * 4 - 3, 2, 3); } }
    cx.strokeStyle = OUT; cx.lineWidth = 1.5;
    // bell-hammer arm: raised during the tell, slammed on release
    const raise = tell, ang = -1.1 * raise + .25 + Math.sin(t * 2) * .05;
    cx.save(); cx.translate(26, -40); cx.rotate(ang);
    cx.strokeStyle = F(K.trim); cx.lineWidth = 4; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(6, 38); cx.stroke(); cx.strokeStyle = OUT; cx.lineWidth = 1.5;
    cx.fillStyle = F(K.d); cx.beginPath(); cx.moveTo(-4, 34); cx.quadraticCurveTo(6, 26, 16, 34); cx.lineTo(19, 48); cx.lineTo(-7, 48); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = F(K.trim); cx.fillRect(-7, 45, 26, 3); cx.fillStyle = glow; cx.fillRect(5, 48, 3, 3);
    cx.restore();
    if (raise > .7) { cx.fillStyle = glow; for (let i = 0; i < 3; i++) { const q = t * 9 + i * 2; cx.fillRect(32 + Math.cos(q) * 10, -70 + Math.sin(q) * 6, 2, 2); } }
  },
};
function flash(f) { return f.hit > 0; }
// death: the body chars and erodes from the top down into embers and ash
function drawCorpse(c, t) {
  const age = (performance.now() - c.t0) / 1000, k = clamp(age / c.dur, 0, 1); if (k >= 1) { c.gone = true; return; }
  const bi = (G ? G.floor || 0 : 0) % 4, S = FSKIN[bi], K = BSKIN[bi], s = c.r / FOES[c.type].r, H = c.type === 'warden' ? 90 : c.type === 'cultist' ? 46 : 40;
  const cut = -H * s * (1 - k) - (c.type === 'bat' ? 0 : 0);
  if (c.boss) { light(c.x, c.y - 40, 90 * (1 - k * .5), '255,120,50', .7 * (1 - k)); if (k < .5 && fx() < .3) shake = Math.max(shake, 3); }
  cx.save(); cx.translate(c.x, c.y);
  cx.fillStyle = `rgba(30,24,18,${.55 * (1 - k * .4)})`; cx.beginPath(); cx.ellipse(0, 2, c.r * (1 + k * .4), c.r * .33, 0, 0, TAU); cx.fill(); // ash pile
  cx.beginPath(); cx.rect(-c.r * 5, cut, c.r * 10, -cut + 6); cx.clip();
  const sink = c.type === 'bat' ? k * 18 : 0; cx.translate(0, sink);
  cx.scale(s * (c.face || 1) * (1 + k * .08), s * (1 - k * .12));
  cx.strokeStyle = OUT; cx.lineWidth = 1.2 / s + .3; cx.lineJoin = 'round'; cx.lineCap = 'round';
  const F = col => mixHex(col.length === 7 ? col : '#3a3a3a', '#1e1812', .35 + k * .6);
  const fake = { type: c.type, id: c.id, phase: c.phase, hit: 0, lunge: 0, face: c.face, undead: false, frozen: 0 };
  try { BODY[c.type]({ t, wp: 0, walk: 0, tell: 0, lean: 0, F, S, K, f: fake, flash: true }); } catch (e) { }
  cx.restore();
  // ember line at the erosion edge + falling ash
  const pc = PCAP(); if (room && room.parts.length < pc) {
    const n = c.boss ? 4 : 2, y = c.y + cut;
    for (let i = 0; i < n; i++) room.parts.push({ x: c.x + (fx() - .5) * c.r * 1.6, y, vx: (fx() - .5) * 30, vy: -30 - fx() * 50, life: .5 + fx() * .4, c: fx() < .6 ? '#ff8a2a' : '#ffd070', s: 1.6 + fx(), ember: true });
    if (fx() < .5) room.parts.push({ x: c.x + (fx() - .5) * c.r * 1.4, y, vx: (fx() - .5) * 10, vy: 22, life: .5, c: '#5a5248', s: 2 });
  }
  cx.strokeStyle = `rgba(255,140,50,${.8 * (1 - k)})`; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(c.x - c.r * .9, c.y + cut); cx.lineTo(c.x + c.r * .9, c.y + cut); cx.stroke();
}
