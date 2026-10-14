'use strict';
// Grimoire Ascent — Expansion II pages: mechanics hooks (called from the engine in game.js) and crisp drawing.
// Runs identically in solo, the editor preview and the co-op host simulation; guests only draw.
const CC_BOSS = { stun: .4, silence: 1.2 };
function applyCC(f, k, d) {
  if (f.dummy && k !== 'mark') { f[k] = Math.max(f[k] || 0, d); return; }
  if (f.boss && (k === 'stun' || k === 'silence')) { if ((f.ccImm || 0) > 0) return; f.ccImm = 3; d = CC_BOSS[k]; }
  f[k] = Math.max(f[k] || 0, d);
}
function ownerHurt(o, n) { if (!o) return; if (o === P) { if (G && !(room && room.guest)) G.flame = Math.max(1, G.flame - n); } else if (o.hp != null && o.maxHp != null) o.hp = Math.max(1, o.hp - n); }
// called by spawnShot after the shot is built (s is not yet pushed)
function pg2Spawn(world, s, spec, b, m, ang) {
  s.owner = world.caster || null;
  if (m('penance')) s.dmg *= 1.9;
  if (b.growDist) { s.r0 = s.r; s.d0 = s.dmg; }
  if (b.ringSpd) s.ringSpd = b.ringSpd;
  if (b.grave) {
    const t = nearestFoe(world, s.x, s.y);
    const tx = t ? t.x : s.x + Math.cos(ang) * 120, ty = t ? t.y : s.y + Math.sin(ang) * 120 + 14;
    s.x = tx; s.y = ty - (t ? t.r * .8 : 10); s.gy = ty; s.vx = s.vy = 0; s.armT = .28;
  }
  if (b.censer && !s.orbit) { const c = world.caster || { x: s.x, y: s.y + 12 }; s.orbit = { c, a: ang, a0: ang, rad: 58, swing: true }; }
  if (b.mirror && spec.nomirror) s.nomirror = true;
  if (m('delayedfate') && !s.orbit && s.novaR === undefined && b.spd > 0 && !b.grave && !b.meteor) { s.fateT = .45; s.fv = [s.vx * 2, s.vy * 2]; s.vx = s.vy = 0; s.life += .45; }
  if (m('tethered')) { s.tether = true; s.tt = .1; }
  if (m('spiral')) s.spiral = true;
  if (m('leechmana')) s.leech = true;
  if (m('contagion')) s.contagion = true;
  if (m('silence')) s.silence = true;
  if (m('gilded')) s.gilded = true;
  if (m('lastrites')) s.rites = true;
  if (m('haunted') && !spec.ghost) s.haunted = true;
  if (m('sanctified')) s.sanct = true;
  if (m('penance')) s.penance = true;
  if (m('weighted') && b.spd > 0 && !s.orbit && s.novaR === undefined && !b.grave && !b.meteor) {
    const t = nearestFoe(world, s.x, s.y), D = t ? clamp(Math.hypot(t.x - s.x, t.y - t.r * .5 - s.y), 60, 260) : 180;
    const sp = Math.max(Math.hypot(s.vx, s.vy), Math.hypot(...(s.fv || [0, 0])) / 2, 1), T = clamp(D / sp, .35, 1.1), v = D / T, q = Math.atan2(s.vy || (s.fv ? s.fv[1] : 0), s.vx || (s.fv ? s.fv[0] : 1));
    if (s.fv) s.fv = [Math.cos(q) * v * 2, Math.sin(q) * v * 2]; else { s.vx = Math.cos(q) * v; s.vy = Math.sin(q) * v; }
    s.wz = 0.01; s.wvz = 450 * T; s.weighted = true; s.life = Math.max(s.life, T + .6 + (s.fateT || 0));
  }
  // extra shots: a page storm swarms; a mirrored glyph adds a copy from the far side of the room
  if (b.swarm && !spec.swarmed) { const n = b.swarm - 1; for (let i = 0; i < n; i++) spawnShot(world, Object.assign({}, spec, { swarmed: true }), s.x, s.y, ang + (fx() - .5) * 1.3); }
  if (m('mirrored') && !spec.mirrorCopy && world.bounds) {
    const A = world.bounds, mx = A.x0 + A.x1 - s.x;
    world.fxs.push({ type: 'mirrorflash', x: mx, y: s.y, r: 12, life: .35, c: '#dce8f4' });
    spawnShot(world, Object.assign({}, spec, { mirrorCopy: true, swarmed: true }), mx, s.y, Math.PI - ang);
  }
}
// called every frame for each shot before the engine moves it; return true to skip the engine's movement + collisions this frame
function pg2Tick(world, s, dt) {
  const C = CARDS[s.kind];
  if (s.ringSpd && s.novaR !== undefined && s.novaR < s.novaMax) s.novaR = Math.max(4, s.novaR - dt * (320 - s.ringSpd)); // the engine grows novas at 320/s; bell rings roll slower
  if (s.armT !== undefined && s.age < s.armT) return true;
  if (s.fateT > 0) { s.fateT -= dt; if (s.fateT <= 0) { s.vx = s.fv[0]; s.vy = s.fv[1]; world.fxs.push({ type: 'ring', x: s.x, y: s.y + 10, r: 3, R: 14, life: .2, c: '#e8d8a8' }); } else { s.vx = s.vy = 0; if (!s.weighted) return true; } }
  if (s.weighted) {
    s.wz += s.wvz * dt; s.wvz -= 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    const A = world.bounds; s.x = clamp(s.x, A.x0, A.x1); s.y = clamp(s.y, A.y0, A.y1);
    if (s.wz <= 0 && s.age > .05) { s.wz = 0; s.weighted = false; s.life = 0; explode(world, s.x, s.y, 44, s.dmg * 1.4); world.fxs.push({ type: 'quake', x: s.x, y: s.y, r: 40, life: .35, c: '#7a5a34' }); if (world === room) shake = Math.max(shake, 4); }
    return s.life > 0;
  }
  if (C.serpent) { const a = Math.cos(s.age * 7) * 5 * dt, c = Math.cos(a), si = Math.sin(a); [s.vx, s.vy] = [s.vx * c - s.vy * si, s.vx * si + s.vy * c]; if ((s.it = (s.it || 0) - dt) <= 0 && world.patches.length < 200) { s.it = .09; world.patches.push({ x: s.x, y: s.y + 8, life: 1.6, kind: 'ink' }); } }
  if (s.spiral) { const R = 4 + s.age * 26, q = s.age * 11, ox = Math.cos(q) * R, oy = Math.sin(q) * R; s.x += ox - (s.sox || 0); s.y += oy - (s.soy || 0); s.sox = ox; s.soy = oy; }
  if (C.growDist) { const k = 1 + Math.min(2.2, s.age * 1.7); s.r = s.r0 * k; s.dmg = s.d0 * k; }
  if (C.rosary && (s.beads || 0) < 6 && (s.bt = (s.bt == null ? .1 : s.bt) - dt) <= 0) {
    s.bt = .13; s.beads = (s.beads || 0) + 1; const w = .32 + s.beads * .04;
    (world.pending || (world.pending = [])).push({ t: w, s: { p: 'rosethorn', mods: [] }, x: s.x, y: s.y, ang: s.beads * .4, burst: 4, wand: s.wand, caster: world.caster });
    world.fxs.push({ type: 'bead', x: s.x, y: s.y, r: 2.6, life: w, c: s.col });
  }
  if (C.eclipse && world.eshots) for (const e of world.eshots) if (e.life > 0 && Math.hypot(e.x - s.x, e.y - s.y) < s.r + 9) { e.life = 0; world.fxs.push({ type: 'ring', x: e.x, y: e.y + 10, r: 2, R: 12, life: .2, c: '#ffb050' }); }
  if (s.host) {
    const h = s.host;
    if (h.dead) { const n = nearestFoe(world, s.x, s.y); if (n && Math.hypot(n.x - s.x, n.y - s.y) < 220) { s.host = n; s.hit.length = 0; } else { s.host = null; s.life = Math.min(s.life, .15); } }
    if (s.host) { s.x = s.host.x + Math.cos(s.age * 3) * s.host.r * .7; s.y = s.host.y - s.host.r * 1.3 + Math.sin(s.age * 5) * 3; s.vx = s.vy = 0; }
  }
  if (s.tether && (s.tt -= dt) <= 0 && s.owner) {
    s.tt = .2; const ax = s.owner.x, ay = s.owner.y - 14, bx = s.x, by = s.y, L = Math.hypot(bx - ax, by - ay) || 1;
    for (const f of world.foes) { if (f.dead || f.spawnT > 0) continue; const px = f.x, py = f.y - f.r * .8, u = clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (L * L), 0, 1), d = Math.hypot(ax + (bx - ax) * u - px, ay + (by - ay) * u - py); if (d < f.r + 5) hurtFoe(world, f, s.dmg * .25); }
  }
  if (s.gilded && fx() < .25 && world.parts.length < 300) world.parts.push({ x: s.x, y: s.y, vx: (fx() - .5) * 20, vy: -20, life: .4, c: '#ffd860', s: 1.6, ember: true });
  return false;
}
function pg2HitMul(world, s, f) {
  let k = 1;
  if (s.contagion) f.contag = 4; // flagged before the blow lands so a killing hit still spreads
  if (s.gilded) f.gild = 4;
  if (s.sanct && (f.undead || f.boss)) { k *= 1.6; world.fxs.push({ type: 'rites', x: f.x, y: f.y - f.r, r: 8, life: .2, c: '#ffe8a0' }); }
  return k;
}
// after the engine has dealt the hit (before pierce/expiry handling)
function pg2AfterHit(world, s, f, killed, dmg) {
  const C = CARDS[s.kind];
  if (C.stun && !killed) applyCC(f, 'stun', C.stun);
  if (C.mark) f.mark = 4;
  if (s.silence && !killed) applyCC(f, 'silence', 3);
  if (s.penance) ownerHurt(s.owner, .6);
  if (s.leech && s.wand) s.wand.mana = Math.min(mmax(s.wand), s.wand.mana + 2 + dmg * .2);
  if (s.rites && !killed && !f.dead && !f.riteDone && f.hp > 0 && f.hp / f.max < .2) {
    f.riteDone = true; world.fxs.push({ type: 'rites', x: f.x, y: f.y - f.r, r: f.r + 16, life: .45, c: '#ff5a3a' });
    hurtFoe(world, f, f.boss ? s.dmg * 3 : Math.max(s.dmg * 3, f.max * .08));
  }
  if (s.haunted && killed && !f.dummy) {
    const n = nearestFoe(world, f.x, f.y, [f]), a = n ? Math.atan2(n.y - n.r * .8 - (f.y - f.r), n.x - f.x) : Math.atan2(s.vy, s.vx);
    world.fxs.push({ type: 'ghost', x: f.x, y: f.y - f.r, r: 10, life: .5, c: '#cfeaff' });
    (world.pending || (world.pending = [])).push({ t: .45, s: Object.assign({}, s.spec, { mods: s.spec.mods.filter(q => q !== 'haunted'), ghost: true, trig: null, payload: null }), x: f.x, y: f.y - f.r, ang: a, wand: s.wand, caster: { x: f.x, y: f.y } });
  }
  if (C.mirror && !s.nomirror) {
    const used = [f]; const a0 = Math.atan2(s.vy, s.vx);
    for (let i = 0; i < 3; i++) {
      const n = nearestFoe(world, s.x, s.y, used); let a;
      if (n && Math.hypot(n.x - s.x, n.y - s.y) < 260) { used.push(n); a = Math.atan2(n.y - n.r * .8 - s.y, n.x - s.x); } else a = a0 + Math.PI + (i - 1) * .6;
      const c = spawnShot(world, Object.assign({}, s.spec, { p: 'mirrorshard', nomirror: true, mods: [] }), s.x, s.y, a); c.dmg = s.dmg * .6; c.hit.push(f);
    }
    world.fxs.push({ type: 'mirrorflash', x: s.x, y: s.y + 10, r: 10, life: .3, c: '#ffffff' });
  }
  if (C.haunt && !s.host && !killed) { s.host = f; s.life = C.haunt; s.pierce = 999; s.rehit = s.rht = .5; s.homing = false; }
}
// when a shot ends
function pg2End(world, s) {
  const C = CARDS[s.kind];
  if (C.anchor) {
    world.fxs.push({ type: 'quake', x: s.x, y: s.y + 6, r: 30, life: .3, c: '#6a6e76' }); world.fxs.push({ type: 'ring', x: s.x, y: s.y + 10, r: 8, R: C.anchor, life: .3, c: '#9a9ea6' });
    for (const f of world.foes) { if (f.dead || f.spawnT > 0) continue; const dx = s.x - f.x, dy = s.y - f.y, d = Math.hypot(dx, dy); if (d < C.anchor + f.r) { if (!f.boss && !f.dummy) { f.kx += dx * 7.5; f.ky += dy * 7.5; } hurtFoe(world, f, s.dmg * .6); } }
  }
}
// status effects ticking on foes
function pg2Status(f, dt) {
  for (const k of ['stun', 'mark', 'silence', 'contag', 'gild', 'slowT', 'ccImm']) if (f[k] > 0) f[k] -= dt;
}
// contagion: statuses jump to foes nearby when a struck foe dies
function pg2Death(world, f) {
  if (!(f.contag > 0)) return;
  world.fxs.push({ type: 'ring', x: f.x, y: f.y, r: 6, R: 110, life: .4, c: '#8aff6a' });
  for (const o of world.foes) {
    if (o === f || o.dead || Math.hypot(o.x - f.x, o.y - f.y) > 110 + o.r) continue;
    if (f.burn > 0) o.burn = Math.max(o.burn, f.burn); if (f.poison > 0) o.poison = Math.max(o.poison || 0, f.poison);
    if (f.frozen > 0) o.frozen = Math.max(o.frozen || 0, f.frozen); if (f.hex > 0) o.hex = Math.max(o.hex || 0, f.hex); if (f.mark > 0) o.mark = Math.max(o.mark || 0, f.mark);
    o.contag = 2; world.fxs.push({ type: 'bolt2', x: f.x, y: f.y - f.r, x2: o.x, y2: o.y - o.r, life: .25, c: '#8aff6a' });
  }
}
// overcharge: returns a multiplier to spawn this cast with, or 0 to store it
function pg2Overcharge(world, wand, c, x, y) {
  if (!c.shots.some(s => s.mods.includes('overcharge'))) return 1;
  wand.oc = (wand.oc || 0) + 1;
  if (wand.oc < 3) { world.fxs.push({ type: 'charge', x, y: y + 14, r: 10, n: wand.oc, life: .45, c: '#c08aff' }); return 0; }
  wand.oc = 0; world.fxs.push({ type: 'ring', x, y: y + 14, r: 6, R: 46, life: .35, c: '#d8a8ff' }); world.fxs.push({ type: 'charge', x, y: y + 14, r: 14, n: 3, life: .5, c: '#f0d8ff' });
  return 3;
}
// anchor point for chains / tethers (host: live objects; guests: synced ax/ay)
function anchorOf(b) {
  if (b.ax != null && b.ax >= 0) return { x: b.ax, y: b.ay };
  const C = CARDS[b.kind] || {};
  if (C.censer && b.orbit) return { x: b.orbit.c.x, y: b.orbit.c.y - 14 };
  if ((C.anchor || b.tether) && b.owner) return { x: b.owner.x, y: b.owner.y - 14 };
  return null;
}
function drawTethers(wd) {
  cx.save(); cx.lineCap = 'round';
  for (const b of wd.shots) {
    const A = anchorOf(b); if (!A) continue; const C = CARDS[b.kind] || {}, y = b.y - (b.wz || 0);
    if (C.censer || C.anchor) { // iron chain: dark line + link ticks
      const L = Math.hypot(b.x - A.x, y - A.y), n = Math.max(2, Math.floor(L / 7));
      cx.strokeStyle = '#1a1612'; cx.lineWidth = 2.6; cx.beginPath(); cx.moveTo(A.x, A.y); cx.lineTo(b.x, y); cx.stroke();
      cx.strokeStyle = '#8a8478'; cx.lineWidth = 1.2; cx.beginPath();
      for (let i = 0; i < n; i++) { const k = (i + .5) / n, px = A.x + (b.x - A.x) * k, py = A.y + (y - A.y) * k, q = Math.atan2(y - A.y, b.x - A.x) + (i % 2 ? Math.PI / 2 : 0); cx.moveTo(px - Math.cos(q) * 2, py - Math.sin(q) * 2); cx.lineTo(px + Math.cos(q) * 2, py + Math.sin(q) * 2); }
      cx.stroke();
    }
    if (b.ov & OVB.tethered) { // violet soul-beam
      const w = 1 + Math.sin(b.age * 30) * .4;
      cx.strokeStyle = 'rgba(150,90,255,.35)'; cx.lineWidth = 5 * w; cx.beginPath(); cx.moveTo(A.x, A.y); cx.lineTo(b.x, y); cx.stroke();
      cx.strokeStyle = '#e8d8ff'; cx.lineWidth = 1; cx.stroke();
    }
  }
  cx.restore();
}
// projectile shapes (called inside translate(x,y))
function drawShape2(b, C, r, a) {
  switch (C.shape) {
    case 'bell': {
      const R = Math.max(2, Math.abs(b.novaR || 4)), al = Math.min(1, (b.life || .5) * 2.5);
      cx.globalAlpha *= al; cx.strokeStyle = 'rgba(40,24,8,.8)'; cx.lineWidth = 4; cx.beginPath(); cx.ellipse(0, 0, R, R * .55, 0, 0, TAU); cx.stroke();
      cx.strokeStyle = '#e8c890'; cx.lineWidth = 2; cx.stroke(); cx.strokeStyle = 'rgba(255,240,200,.6)'; cx.lineWidth = .8; cx.beginPath(); cx.ellipse(0, 0, R * .82, R * .45, 0, 0, TAU); cx.stroke();
      cx.fillStyle = '#ffe8b0'; for (let i = 0; i < 8; i++) { const q = i * TAU / 8 + b.age; cx.fillRect(Math.cos(q) * R - 1, Math.sin(q) * R * .55 - 1, 2, 2); }
      if (b.age < .35) { const k = 1 - b.age / .35; cx.globalAlpha = al * k; cx.fillStyle = '#6a4a1a'; cx.beginPath(); cx.moveTo(-6, 2); cx.quadraticCurveTo(-6, -9, 0, -10); cx.quadraticCurveTo(6, -9, 6, 2); cx.lineTo(8, 4); cx.lineTo(-8, 4); cx.closePath(); cx.fill(); cx.fillStyle = '#e8c890'; cx.fillRect(-1, 4, 2, 2); }
      break;
    }
    case 'serpent': {
      cx.rotate(a);
      for (let i = 6; i >= 0; i--) { const px = -i * 4.2, py = Math.sin(b.age * 14 - i * .9) * 3.2, rr = r * (1 - i * .1); cx.fillStyle = i % 2 ? '#1a1428' : '#2a2040'; cx.beginPath(); cx.arc(px, py, rr, 0, TAU); cx.fill(); cx.strokeStyle = '#7a6ab8'; cx.lineWidth = .7; cx.beginPath(); cx.arc(px, py, rr, -1.6, -.4); cx.stroke(); }
      const hy = Math.sin(b.age * 14) * 3.2; cx.fillStyle = '#100c1a'; cx.beginPath(); cx.moveTo(r * 1.9, hy); cx.lineTo(0, hy - r * 1.05); cx.lineTo(-r * .4, hy); cx.lineTo(0, hy + r * 1.05); cx.closePath(); cx.fill(); cx.strokeStyle = '#9a8ad8'; cx.lineWidth = .8; cx.stroke();
      cx.fillStyle = '#e8d8ff'; cx.fillRect(r * .5, hy - 2, 1.4, 1.4); cx.fillRect(r * .5, hy + .8, 1.4, 1.4); break;
    }
    case 'hand': {
      const k = clamp(b.age / (b.armT || .28), 0, 1), gy = (b.gy != null ? b.gy - b.y : r * .9), grab = b.age > (b.armT || .28) ? 1 : 0;
      cx.fillStyle = 'rgba(20,14,8,.85)'; cx.beginPath(); cx.ellipse(0, gy, 16, 5, 0, 0, TAU); cx.fill();
      cx.strokeStyle = '#4a3a24'; cx.lineWidth = 1.2; cx.beginPath(); for (let i = 0; i < 6; i++) { const q = i * TAU / 6 + .3; cx.moveTo(Math.cos(q) * 6, gy + Math.sin(q) * 2); cx.lineTo(Math.cos(q) * 17, gy + Math.sin(q) * 6); } cx.stroke();
      cx.save(); cx.beginPath(); cx.rect(-30, -60, 60, gy + 60); cx.clip(); cx.translate(0, gy + (1 - k) * 34);
      cx.strokeStyle = INK; cx.lineWidth = 1.1; cx.fillStyle = '#c8c0a0';
      cx.beginPath(); cx.rect(-3, -14, 6, 16); cx.fill(); cx.stroke(); // wrist bones
      cx.beginPath(); cx.ellipse(0, -18, 7, 6, 0, 0, TAU); cx.fill(); cx.stroke();
      for (let i = 0; i < 4; i++) { const fxp = -5.5 + i * 3.6, curl = grab ? .9 : 0; cx.save(); cx.translate(fxp, -22); cx.rotate((i - 1.5) * .18); cx.fillRect(-1.2, -9, 2.4, 9); cx.strokeRect(-1.2, -9, 2.4, 9); cx.translate(0, -9); cx.rotate(curl * (i < 2 ? .9 : -.9)); cx.fillRect(-1.1, -7, 2.2, 7); cx.strokeRect(-1.1, -7, 2.2, 7); cx.restore(); }
      cx.save(); cx.translate(7, -16); cx.rotate(-.7 + grab * .8); cx.fillRect(-1.2, -8, 2.4, 8); cx.strokeRect(-1.2, -8, 2.4, 8); cx.restore();
      cx.fillStyle = '#9aff7a'; cx.fillRect(-1, -19, 2, 2);
      cx.restore(); break;
    }
    case 'mirror': {
      cx.rotate(a + b.spin * .2); cx.fillStyle = '#5a6a7a'; cx.beginPath(); cx.moveTo(r * 2, 0); cx.lineTo(0, -r * 1.1); cx.lineTo(-r * 1.4, 0); cx.lineTo(0, r * 1.1); cx.closePath(); cx.fill();
      cx.fillStyle = '#f4faff'; cx.beginPath(); cx.moveTo(r * 1.8, 0); cx.lineTo(0, -r * .9); cx.lineTo(-r * .2, 0); cx.closePath(); cx.fill();
      cx.strokeStyle = '#ffffff'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(-r * 1.2, 0); cx.lineTo(r * 1.9, 0); cx.stroke(); break;
    }
    case 'censer': {
      cx.fillStyle = '#5a3a14'; cx.strokeStyle = INK; cx.lineWidth = 1; cx.beginPath(); cx.arc(0, 1, r, 0, Math.PI); cx.lineTo(-r, -1); cx.quadraticCurveTo(0, -r * 1.6, r, -1); cx.closePath(); cx.fill(); cx.stroke();
      cx.fillStyle = '#c8902a'; cx.fillRect(-r, -1, r * 2, 2); cx.fillRect(-1, -r * 1.4, 2, 3);
      const fl = .6 + Math.sin(b.age * 30) * .4; cx.fillStyle = `rgba(255,${150 + fl * 80},60,1)`; for (let i = -1; i <= 1; i++) cx.fillRect(i * 3 - .8, 2, 1.6, 1.6);
      if (fx() < .35 && room && room.parts.length < 300) room.parts.push({ x: b.x + (fx() - .5) * 4, y: b.y - 6, vx: (fx() - .5) * 8, vy: -26, life: .7, c: 'rgba(120,110,100,.5)', s: 3 });
      break;
    }
    case 'page': {
      cx.rotate(b.spin * .5); const w = r * 2.2 * Math.abs(Math.cos(b.age * 9)) + 1, h = r * 2.8;
      cx.fillStyle = '#e8dcc0'; cx.strokeStyle = INK; cx.lineWidth = .8; cx.beginPath(); cx.rect(-w / 2, -h / 2, w, h); cx.fill(); cx.stroke();
      cx.strokeStyle = '#6a4a2a'; cx.lineWidth = .5; cx.beginPath(); for (let i = 1; i < 4; i++) { cx.moveTo(-w / 2 + 1, -h / 2 + i * h / 4); cx.lineTo(w / 2 - 1, -h / 2 + i * h / 4); } cx.stroke();
      cx.strokeStyle = '#ffffff'; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(w / 2, -h / 2); cx.lineTo(w / 2, h / 2); cx.stroke(); break;
    }
    case 'moon': {
      cx.rotate(a); const R = r * 1.5; cx.fillStyle = '#3a3a6a'; cx.beginPath(); cx.arc(0, 0, R, -1.5, 1.5); cx.arc(-R * .55, 0, R * 1.05, 1.2, -1.2, true); cx.closePath(); cx.fill();
      cx.fillStyle = '#e8ecff'; cx.beginPath(); cx.arc(0, 0, R * .92, -1.4, 1.4); cx.arc(-R * .4, 0, R * .98, 1.15, -1.15, true); cx.closePath(); cx.fill();
      cx.strokeStyle = 'rgba(200,210,255,.5)'; cx.lineWidth = .8; cx.beginPath(); cx.arc(-R * .2, 0, R * 1.25, -1, 1); cx.stroke(); break;
    }
    case 'anchor': {
      cx.rotate(a + Math.PI / 2 + Math.sin(b.age * 18) * .15); cx.strokeStyle = INK; cx.lineWidth = 4; cx.lineCap = 'round';
      const path = () => { cx.beginPath(); cx.moveTo(0, -r * 1.4); cx.lineTo(0, r * 1.2); cx.moveTo(-r, -r * .7); cx.lineTo(r, -r * .7); cx.moveTo(-r * 1.3, r * .3); cx.quadraticCurveTo(-r, r * 1.5, 0, r * 1.3); cx.quadraticCurveTo(r, r * 1.5, r * 1.3, r * .3); };
      path(); cx.stroke(); cx.strokeStyle = '#9a9ea6'; cx.lineWidth = 2; path(); cx.stroke(); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(0, -r * 1.7, 2.2, 0, TAU); cx.stroke(); cx.lineCap = 'butt'; break;
    }
    case 'wraith': {
      const fl = Math.sin(b.age * 22) * 1.5; cx.fillStyle = 'rgba(80,200,150,.35)'; cx.beginPath(); cx.moveTo(-r, 2); cx.quadraticCurveTo(-r * 1.1, -r * 1.2, 0, -r * 2.6 - fl); cx.quadraticCurveTo(r * 1.1, -r * 1.2, r, 2); cx.quadraticCurveTo(0, r * 1.4, -r, 2); cx.fill();
      cx.fillStyle = '#c8ffe8'; cx.beginPath(); cx.moveTo(-r * .6, 1); cx.quadraticCurveTo(-r * .6, -r, 0, -r * 1.8 - fl); cx.quadraticCurveTo(r * .6, -r, r * .6, 1); cx.quadraticCurveTo(0, r, -r * .6, 1); cx.fill();
      cx.fillStyle = '#0a1a14'; cx.fillRect(-2.4, -2, 1.6, 2.2); cx.fillRect(.8, -2, 1.6, 2.2); cx.fillRect(-1, 1.5, 2, 1); break;
    }
    case 'rosary': {
      cx.rotate(a); cx.strokeStyle = '#3a2a1a'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(-r * 4, 0); cx.lineTo(0, 0); cx.stroke();
      for (let i = 1; i <= 3; i++) { cx.fillStyle = '#5a0e1a'; cx.beginPath(); cx.arc(-i * r * 1.3, Math.sin(b.age * 10 + i) * 1.2, r * .55, 0, TAU); cx.fill(); }
      cx.fillStyle = '#c8304a'; cx.beginPath(); cx.arc(0, 0, r * .9, 0, TAU); cx.fill(); cx.fillStyle = '#ffb0b8'; cx.fillRect(-1, -2, 1.5, 1.5);
      cx.fillStyle = '#c8a050'; cx.fillRect(r * .9, -.6, 4, 1.2); cx.fillRect(r * .9 + 2, -2, 1.2, 4); break;
    }
    case 'eclipse': {
      const R = r; cx.strokeStyle = 'rgba(255,170,70,.55)'; cx.lineWidth = 3; cx.beginPath(); cx.arc(0, 0, R + 2, 0, TAU); cx.stroke();
      cx.strokeStyle = '#ffd890'; cx.lineWidth = 1; for (let i = 0; i < 10; i++) { const q = i * TAU / 10 + b.spin * .3, L = 3 + ((i * 7 + Math.floor(b.age * 8)) % 4); cx.beginPath(); cx.moveTo(Math.cos(q) * (R + 2), Math.sin(q) * (R + 2)); cx.lineTo(Math.cos(q) * (R + 2 + L), Math.sin(q) * (R + 2 + L)); cx.stroke(); }
      cx.fillStyle = '#050307'; cx.beginPath(); cx.arc(0, 0, R, 0, TAU); cx.fill(); cx.strokeStyle = '#fff0c8'; cx.lineWidth = .8; cx.beginPath(); cx.arc(0, 0, R, b.spin, b.spin + 1.2); cx.stroke(); break;
    }
    case 'blood': {
      cx.rotate(a); cx.fillStyle = '#5a0410'; cx.beginPath(); cx.moveTo(r * 2.4, 0); cx.quadraticCurveTo(0, -r * 1.3, -r * 1.2, 0); cx.quadraticCurveTo(0, r * 1.3, r * 2.4, 0); cx.fill();
      cx.fillStyle = '#e0283e'; cx.beginPath(); cx.moveTo(r * 2, 0); cx.quadraticCurveTo(0, -r * .9, -r * .7, 0); cx.quadraticCurveTo(0, r * .9, r * 2, 0); cx.fill(); cx.fillStyle = '#ffc0c8'; cx.fillRect(r * .4, -r * .4, 1.5, 1.2); break;
    }
    case 'thorn': { cx.rotate(a); cx.fillStyle = '#2a3a12'; cx.beginPath(); cx.moveTo(r * 2.4, 0); cx.lineTo(-r, -r * .8); cx.lineTo(-r * .5, 0); cx.lineTo(-r, r * .8); cx.closePath(); cx.fill(); cx.fillStyle = '#9ac85a'; cx.beginPath(); cx.moveTo(r * 2.2, 0); cx.lineTo(-r * .4, -r * .4); cx.lineTo(0, 0); cx.closePath(); cx.fill(); break; }
    default: return false;
  }
  return true;
}
// glyph overlays for the new glyphs
function drawOverlays2(b, r, a) {
  const o = b.ov || 0, sp = b.spin; if (o < 2048) return;
  if (o & OVB.penance) { cx.strokeStyle = '#b01a2a'; cx.lineWidth = 1; for (let i = 0; i < 6; i++) { const q = sp * .5 + i * TAU / 6; cx.beginPath(); cx.moveTo(Math.cos(q) * (r + 3), Math.sin(q) * (r + 3)); cx.lineTo(Math.cos(q + .25) * (r + 6), Math.sin(q + .25) * (r + 6)); cx.stroke(); } }
  if (o & OVB.sanctified) { cx.fillStyle = '#ffe8a0'; cx.fillRect(-.8, -r - 9, 1.6, 7); cx.fillRect(-2.8, -r - 7, 5.6, 1.6); }
  if (o & OVB.haunted) { cx.fillStyle = 'rgba(200,230,255,.45)'; cx.beginPath(); cx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r); cx.quadraticCurveTo(-Math.cos(a) * 10 + Math.sin(b.age * 12) * 3, -Math.sin(a) * 10 - 4, -Math.cos(a) * 16, -Math.sin(a) * 16); cx.lineTo(-Math.cos(a) * r - 2, -Math.sin(a) * r + 2); cx.fill(); }
  if (o & OVB.mirrored) { cx.strokeStyle = '#dce8f4'; cx.lineWidth = .9; cx.beginPath(); cx.moveTo(-r - 4, -r); cx.lineTo(-r - 6, 0); cx.lineTo(-r - 4, r); cx.moveTo(r + 4, -r); cx.lineTo(r + 6, 0); cx.lineTo(r + 4, r); cx.stroke(); }
  if ((o & OVB.delayedfate) && b.fateT > 0) { cx.fillStyle = '#e8d8a8'; cx.beginPath(); cx.moveTo(-3.5, -r - 11); cx.lineTo(3.5, -r - 11); cx.lineTo(0, -r - 7); cx.lineTo(3.5, -r - 3); cx.lineTo(-3.5, -r - 3); cx.lineTo(0, -r - 7); cx.closePath(); cx.fill(); }
  if (o & OVB.spiral) { cx.strokeStyle = 'rgba(255,240,200,.6)'; cx.lineWidth = .8; cx.beginPath(); for (let i = 0; i < 14; i++) { const q = -sp + i * .5, rr = 2 + i * .7; cx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); } cx.stroke(); }
  if (o & OVB.leechmana) { cx.fillStyle = '#5a9aff'; for (let i = 0; i < 3; i++) { const q = sp * 1.2 + i * TAU / 3; cx.beginPath(); cx.arc(Math.cos(q) * (r + 5), Math.sin(q) * (r + 5), 1.2, 0, TAU); cx.fill(); } }
  if (o & OVB.weighted) { cx.strokeStyle = 'rgba(30,20,10,.9)'; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(0, 0, r + 2, .3, Math.PI - .3); cx.stroke(); }
  if (o & OVB.contagion) { cx.fillStyle = '#8aff6a'; for (let i = 0; i < 4; i++) { const q = -sp * .8 + i * TAU / 4; cx.fillRect(Math.cos(q) * (r + 4) - .8, Math.sin(q) * (r + 4) - .8, 1.6, 1.6); } }
  if (o & OVB.overcharge) { cx.strokeStyle = '#d8a8ff'; cx.lineWidth = 1; cx.beginPath(); for (let i = 0; i <= 8; i++) { const q = i * TAU / 8, rr = r + 4 + (i % 2 ? 2 : 0) + (fx() < .3 ? 1 : 0); cx.lineTo(Math.cos(q + sp) * rr, Math.sin(q + sp) * rr); } cx.stroke(); }
  if (o & OVB.silence) { cx.strokeStyle = '#a8b8d8'; cx.lineWidth = 1; cx.beginPath(); cx.arc(r + 5, -r - 5, 3, 0, TAU); cx.moveTo(r + 3, -r - 7); cx.lineTo(r + 7, -r - 3); cx.stroke(); }
  if (o & OVB.gilded) { cx.strokeStyle = '#ffd860'; cx.lineWidth = .9; cx.beginPath(); cx.arc(0, 0, r + 2.5, 0, TAU); cx.stroke(); }
  if (o & OVB.lastrites) { cx.fillStyle = '#1a0a0a'; cx.fillRect(-r - 7, -3, 3, 6); cx.fillStyle = '#ff7a3a'; cx.beginPath(); cx.moveTo(-r - 7, -3); cx.lineTo(-r - 5.5, -7 - Math.sin(b.age * 20)); cx.lineTo(-r - 4, -3); cx.fill(); }
}
// new fx types
function drawFx2(f) {
  switch (f.type) {
    case 'bead': { const k = f.life; cx.fillStyle = '#3a0810'; cx.beginPath(); cx.arc(f.x, f.y, 3.2, 0, TAU); cx.fill(); cx.fillStyle = k < .12 ? '#ffd0d8' : f.c; cx.beginPath(); cx.arc(f.x, f.y, 2.2 + (k < .12 ? 1 : 0), 0, TAU); cx.fill(); return true; }
    case 'ghost': { const k = 1 - f.life / .5, y = f.y - k * 24; cx.fillStyle = 'rgba(210,235,255,.75)'; cx.beginPath(); cx.arc(f.x, y, 6, Math.PI, 0); cx.lineTo(f.x + 6, y + 9); cx.lineTo(f.x + 3, y + 6); cx.lineTo(f.x, y + 9); cx.lineTo(f.x - 3, y + 6); cx.lineTo(f.x - 6, y + 9); cx.closePath(); cx.fill(); cx.fillStyle = '#0a0a14'; cx.fillRect(f.x - 3, y - 1, 2, 2.5); cx.fillRect(f.x + 1, y - 1, 2, 2.5); return true; }
    case 'charge': { cx.fillStyle = f.c; for (let i = 0; i < f.n; i++) { const q = i * TAU / 3 + f.life * 8; cx.beginPath(); cx.arc(f.x + Math.cos(q) * 14, f.y - 30 + Math.sin(q) * 6, 2.6, 0, TAU); cx.fill(); } cx.strokeStyle = f.c; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(f.x, f.y - 30, 16, 7, 0, 0, TAU); cx.stroke(); return true; }
    case 'rites': { const R = f.r * (1.3 - f.life); cx.strokeStyle = f.c; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(f.x, f.y - R); cx.lineTo(f.x, f.y + R * .6); cx.moveTo(f.x - R * .5, f.y - R * .4); cx.lineTo(f.x + R * .5, f.y - R * .4); cx.stroke(); cx.lineWidth = 1; cx.beginPath(); cx.arc(f.x, f.y, R, 0, TAU); cx.stroke(); return true; }
    case 'mirrorflash': { cx.strokeStyle = f.c; cx.lineWidth = 1.2; cx.beginPath(); for (let i = 0; i < 6; i++) { const q = i * TAU / 6, R = f.r * (1.4 - f.life); cx.moveTo(f.x + Math.cos(q) * R * .3, f.y - 10 + Math.sin(q) * R * .3); cx.lineTo(f.x + Math.cos(q) * R, f.y - 10 + Math.sin(q) * R); } cx.stroke(); return true; }
    case 'bolt2': { cx.strokeStyle = f.c; cx.lineWidth = 1.2; cx.setLineDash([3, 3]); cx.beginPath(); cx.moveTo(f.x, f.y); cx.lineTo(f.x2, f.y2); cx.stroke(); cx.setLineDash([]); return true; }
    case 'phase': { const R = f.r + (1.2 - f.life) * 220; cx.strokeStyle = f.c; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(f.x, f.y, R, R * .5, 0, 0, TAU); cx.stroke(); cx.lineWidth = 1; cx.beginPath(); cx.ellipse(f.x, f.y, R * .7, R * .35, 0, 0, TAU); cx.stroke(); return true; }
  }
  return false;
}
// status marks on foes (stun stars, blood mark, silence, slow ink, gild)
function drawFoeStatus2(f, t) {
  const top = f.y - f.r * 2.3 - 6;
  if (f.stun > 0) { cx.fillStyle = '#ffe8a0'; for (let i = 0; i < 3; i++) { const q = t * 5 + i * TAU / 3, x = f.x + Math.cos(q) * 10, y = top + Math.sin(q) * 3; cx.beginPath(); for (let j = 0; j < 8; j++) { const rr = j % 2 ? 1 : 2.6, qq = j * Math.PI / 4; cx.lineTo(x + Math.cos(qq) * rr, y + Math.sin(qq) * rr); } cx.fill(); } }
  if (f.mark > 0) { cx.strokeStyle = '#e0283e'; cx.lineWidth = 1.3; const y = f.y - f.r; cx.beginPath(); cx.moveTo(f.x, y - 7); cx.lineTo(f.x + 5, y); cx.lineTo(f.x, y + 7); cx.lineTo(f.x - 5, y); cx.closePath(); cx.stroke(); cx.fillStyle = 'rgba(224,40,62,.35)'; cx.fill(); }
  if (f.silence > 0) { cx.strokeStyle = '#a8b8d8'; cx.lineWidth = 1.3; cx.beginPath(); cx.arc(f.x + 12, top + 2, 4, 0, TAU); cx.moveTo(f.x + 9, top - 1); cx.lineTo(f.x + 15, top + 5); cx.stroke(); }
  if (f.slowT > 0) { cx.fillStyle = '#2a2040'; for (let i = -1; i <= 1; i++) cx.fillRect(f.x + i * 5 - .8, f.y - 2, 1.6, 3 + ((t * 6 + i) % 3)); }
  if (f.gild > 0 && Math.sin(t * 8 + f.x) > .6) { cx.fillStyle = '#ffd860'; cx.fillRect(f.x - f.r * .6, f.y - f.r * 1.4, 1.5, 1.5); }
}
