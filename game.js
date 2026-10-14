'use strict';
// ===== Ashen Pilgrim — dark-fantasy roguelike with Noita-style wands (vanilla JS + canvas) =====
const cv = document.getElementById('c'), mainCx = cv.getContext('2d');
let cx = mainCx;
const UI = document.getElementById('ui'), HUD = document.getElementById('hud'), TOAST = document.getElementById('toast');
let W = 0, H = 0, SW = 0, SH = 0, DPR = 1, Z = 1; // W,H = logical world size; SW,SH = screen css px
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------- RNG ----------
function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const todayKey = () => new Date().toISOString().slice(0, 10);
let rng = Math.random;
const rnd = (a = 1, b) => b === undefined ? rng() * a : a + rng() * (b - a);
const pick = arr => arr[Math.floor(rng() * arr.length)];
const fx = Math.random;

// ---------- camp ----------
const CAMP_KEY = 'ashen-camp', RUN_KEY = 'ashen-run2';
let camp = { embers: 0, total: 0, witch: false, wick: 0, runs: 0, best: 0, dailyBest: {} };
try { Object.assign(camp, JSON.parse(localStorage.getItem(CAMP_KEY) || '{}')); } catch (e) { }
const saveCamp = () => { try { localStorage.setItem(CAMP_KEY, JSON.stringify(camp)); } catch (e) { } };
const WITCH_COST = 60;

// ---------- cards ----------
// t: proj (orange) | mod (blue) | multi (purple) | trig (green) | curse (red, acts as modifier)
const CARDS = {
  spark: { t: 'proj', name: 'Spark Bolt', icon: '✦', mana: 5, delay: 0.05, desc: 'A quick, weak bolt.', spd: 380, dmg: 9, r: 3, life: 1.1, col: '#ffcf6a' },
  fireball: { t: 'proj', name: 'Fireball', icon: '☄', mana: 25, delay: 0.25, desc: 'Slow; explodes and burns.', spd: 220, dmg: 14, r: 6, life: 1.6, col: '#ff7a1a', boom: 46, burn: true },
  ice: { t: 'proj', name: 'Ice Shard', icon: '❄', mana: 10, delay: 0.1, desc: 'Freezes foes it hits.', spd: 330, dmg: 10, r: 4, life: 1.2, col: '#bfe8ff', freeze: true },
  chain: { t: 'proj', name: 'Chain Lightning', icon: '⚡', mana: 22, delay: 0.15, desc: 'Leaps between 3 foes.', spd: 620, dmg: 9, r: 3, life: .8, col: '#cfe0ff', chain: 3 },
  burst: { t: 'proj', name: 'Bouncing Burst', icon: '◎', mana: 8, delay: 0.08, desc: 'Ricochets off walls.', spd: 300, dmg: 7, r: 4, life: 2.6, col: '#d4ff8a', bounce: 4 },
  skull: { t: 'proj', name: 'Grave Skull', icon: '☠', mana: 30, delay: 0.35, desc: 'Heavy skull that pierces.', spd: 160, dmg: 26, r: 7, life: 2.4, col: '#e9e2c8', pierce: 3 },
  homing: { t: 'mod', name: 'Homing', icon: '➰', mana: 8, desc: 'Next spell seeks foes.' },
  pierce: { t: 'mod', name: 'Pierce', icon: '➶', mana: 10, desc: 'Next spell passes through 2 more foes.' },
  bounce: { t: 'mod', name: 'Bounce', icon: '↯', mana: 4, desc: 'Next spell bounces off walls 3 times.' },
  speed: { t: 'mod', name: 'Speed Up', icon: '»', mana: 3, desc: 'Next spell flies 80% faster.' },
  heavy: { t: 'mod', name: 'Heavy', icon: '⚓', mana: 10, delay: 0.1, desc: '+80% damage, 30% slower.' },
  trail: { t: 'mod', name: 'Fire Trail', icon: '🔥', mana: 10, desc: 'Next spell leaves burning ground.' },
  freeze: { t: 'mod', name: 'Freeze on Hit', icon: '✻', mana: 10, desc: 'Next spell freezes foes.' },
  explode: { t: 'mod', name: 'Explode on Hit', icon: '✸', mana: 15, desc: 'Next spell explodes on impact.' },
  double: { t: 'multi', name: 'Double Spell', icon: '⑵', mana: 0, n: 2, spread: 0.12, desc: 'Casts the next 2 spells at once.' },
  triple: { t: 'multi', name: 'Triple Spell', icon: '⑶', mana: 2, n: 3, spread: 0.12, desc: 'Casts the next 3 spells at once.' },
  spreadc: { t: 'multi', name: 'Spread', icon: '⋔', mana: 0, n: 2, spread: 0.6, desc: 'Next 2 spells in a wide fan.' },
  trigger: { t: 'trig', name: 'Spark Bolt with Trigger', icon: '✦⇢', mana: 10, delay: 0.05, desc: 'Casts the next spell where it hits.' },
  timer: { t: 'trig', name: 'Timer Bolt', icon: '⏱', mana: 10, delay: 0.05, desc: 'Casts the next spell after 0.5s.' },
  bloodwax: { t: 'curse', name: 'Bloodwax', icon: '🩸', mana: 0, desc: 'CURSED: costs 3 flame, not mana. Next spell deals double damage.' },
};
const CARD_POOL = ['spark', 'fireball', 'ice', 'chain', 'burst', 'skull', 'homing', 'pierce', 'bounce', 'speed', 'heavy', 'trail', 'freeze', 'explode', 'double', 'triple', 'spreadc', 'trigger', 'timer'];
const TYPE_NAME = { proj: 'Projectile', mod: 'Modifier', multi: 'Multicast', trig: 'Trigger', curse: 'Cursed' };

function makeWand(o) { return Object.assign({ name: 'Wand', slots: [], delay: .25, recharge: .5, maxMana: 100, mana: 100, regen: 30, idx: 0, cd: 0, hue: 30 }, o); }
const WAND_NAMES = ['Ashwood Rod', 'Bone Sceptre', 'Censer Staff', 'Reliquary Wand', 'Thorn Crook', 'Pyre Branch', 'Saint\'s Finger', 'Gallows Twig'];
function randomWand(tier) {
  const n = clamp(Math.round(2 + rnd(2, 4) + tier * 0.5), 2, 8);
  const w = makeWand({ name: pick(WAND_NAMES), slots: Array(n).fill(null), delay: +rnd(.08, .35).toFixed(2), recharge: +rnd(.2, .9).toFixed(2), maxMana: Math.round(rnd(80, 220)), regen: Math.round(rnd(25, 70)), hue: Math.round(rnd(360)) });
  w.mana = w.maxMana;
  w.slots[0] = pick(['spark', 'burst', 'ice', 'spark']); if (rng() < .5) w.slots[1] = pick(['double', 'speed', 'homing', 'spark']);
  return w;
}
function starter(cls) {
  if (cls === 'witch') return { wands: [makeWand({ name: 'Lantern Rod', slots: ['ice', 'spark', null], delay: .17, recharge: .35, maxMana: 120, mana: 120, regen: 40, hue: 195 })], bag: ['double', 'speed', null, null, null, null, null, null] };
  return { wands: [makeWand({ name: 'Pilgrim\'s Taper', slots: ['spark', null], delay: .22, recharge: .4, maxMana: 80, mana: 80, regen: 30, hue: 30 })], bag: ['homing', null, null, null, null, null, null, null] };
}

// ---------- cast engine (Noita-style: read slots left→right, mods apply to next projectile, multicasts draw N) ----------
function buildCast(wand) {
  const deck = wand.slots.filter(Boolean);
  if (!deck.some(id => CARDS[id].t === 'proj' || CARDS[id].t === 'trig')) return null;
  let p = wand.idx >= deck.length ? 0 : wand.idx, drawn = 0, wrapped = false, mana = 0, delay = 0, flame = 0;
  const next = () => { if (drawn >= deck.length) return null; if (p >= deck.length) { p = 0; wrapped = true; } const id = deck[p++]; drawn++; const c = CARDS[id]; mana += c.mana || 0; delay += c.delay || 0; if (id === 'bloodwax') flame += 3; return id; };
  function one(mods) {
    for (; ;) {
      const id = next(); if (!id) return [];
      const c = CARDS[id];
      if (c.t === 'mod' || c.t === 'curse') { mods.push(id); continue; }
      if (c.t === 'proj') return [{ p: id, mods, off: 0 }];
      if (c.t === 'trig') return [{ p: 'spark', mods, off: 0, trig: id === 'timer' ? 'timer' : 'hit', payload: one([]) }];
      if (c.t === 'multi') { const g = []; for (let i = 0; i < c.n; i++) g.push(...one(mods.slice())); g.forEach((s, i) => s.off += (i - (g.length - 1) / 2) * c.spread); return g; }
    }
  }
  const shots = one([]);
  if (p >= deck.length) { p = 0; wrapped = true; }
  return { shots, mana, delay, flame, wrapped, nextIdx: p };
}
function describeCast(wand) { const c = buildCast(Object.assign({}, wand, { idx: 0 })); if (!c) return 'No projectile — this wand casts nothing.'; const d = s => CARDS[s.p].name + (s.mods.length ? ' [' + s.mods.map(m => CARDS[m].name).join(', ') + ']' : '') + (s.trig ? ' → ' + (s.payload.map(d).join(' + ') || 'nothing') : ''); return c.shots.map(d).join(' + '); }
function tryCast(world, wand, x, y, ang, payFlame) {
  const c = buildCast(wand); if (!c || !c.shots.length) return false;
  if (c.mana > wand.mana) { wand.cd = 0.15; return false; }
  wand.mana -= c.mana; wand.idx = c.nextIdx;
  if (c.flame && payFlame) payFlame(c.flame);
  wand.cd = Math.max(0.06, wand.delay + c.delay) + (c.wrapped ? wand.recharge : 0);
  for (const s of c.shots) spawnShot(world, s, x, y, ang + s.off);
  return true;
}
function spawnShot(world, spec, x, y, ang) {
  const b = CARDS[spec.p], m = id => spec.mods.includes(id);
  const cnt = id => spec.mods.filter(q => q === id).length;
  let spd = b.spd * Math.pow(1.8, cnt('speed')) * Math.pow(0.7, cnt('heavy')), dmg = b.dmg * Math.pow(1.8, cnt('heavy')) * Math.pow(2, cnt('bloodwax')) * (world.dmgMul || 1);
  world.shots.push({ kind: spec.p, x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, spd, dmg, r: b.r, col: m('bloodwax') ? '#ff4a5a' : b.col, life: b.life * (m('speed') ? 0.8 : 1) + (m('bounce') ? 1 : 0),
    homing: m('homing'), pierce: (b.pierce || 0) + 2 * cnt('pierce'), bounce: (b.bounce || 0) + 3 * cnt('bounce'), trail: m('trail'), trailT: 0, freeze: b.freeze || m('freeze'),
    boom: b.boom || (m('explode') ? 40 : 0), burn: b.burn || m('trail'), chain: b.chain || 0, trig: spec.trig, payload: spec.payload, age: 0, hit: [] });
}
function releasePayload(world, s, avoid) {
  if (!s.payload || !s.payload.length || s.released) return; s.released = true;
  const t = nearestFoe(world, s.x, s.y, avoid ? [avoid] : null);
  const a = t ? Math.atan2(t.y - s.y, t.x - s.x) : Math.atan2(s.vy, s.vx);
  for (const p of s.payload) spawnShot(world, p, s.x, s.y, a + p.off);
  world.fxs.push({ type: 'ring', x: s.x, y: s.y + 10, r: 2, R: 16, life: .2, c: '#9fff9a' });
}
function nearestFoe(world, x, y, skip) { let b = null, bd = 1e9; for (const f of world.foes) { if (f.dead || f.spawnT > 0 || (skip && skip.includes(f))) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; b = f; } } return b; }
function explode(world, x, y, R, dmg) { world.fxs.push({ type: 'ring', x, y: y + 10, r: 4, R, life: .3, c: '#ff9a3a' }); for (let i = 0; i < 14; i++) { const a = fx() * TAU; world.parts.push({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: .35, c: i % 2 ? '#ffb347' : '#ff5a1a', s: 3 }); } for (const f of world.foes) if (!f.dead && Math.hypot(f.x - x, f.y - y) < R + f.r) hurtFoe(world, f, dmg); }
function updateShots(world, dt) {
  const A = world.bounds;
  for (const s of world.shots) {
    s.age += dt; s.life -= dt;
    if (s.homing) { const t = nearestFoe(world, s.x, s.y, s.hit); if (t) { const want = Math.atan2(t.y - s.y, t.x - s.x), cur = Math.atan2(s.vy, s.vx); let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; const na = cur + clamp(d, -6 * dt, 6 * dt); s.vx = Math.cos(na) * s.spd; s.vy = Math.sin(na) * s.spd; } }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x < A.x0 || s.x > A.x1) { if (s.bounce > 0) { s.bounce--; s.vx *= -1; s.x = clamp(s.x, A.x0, A.x1); } else s.life = 0; }
    if (s.y < A.y0 - 20 || s.y > A.y1) { if (s.bounce > 0) { s.bounce--; s.vy *= -1; s.y = clamp(s.y, A.y0 - 20, A.y1); } else s.life = 0; }
    if (s.trail && (s.trailT -= dt) <= 0) { s.trailT = 0.05; world.patches.push({ x: s.x, y: s.y + 8, life: 1.3 }); }
    if (fx() < .5) world.parts.push({ x: s.x, y: s.y, vx: (fx() - .5) * 30, vy: (fx() - .5) * 30, life: .22, c: s.col, s: 2 });
    if (s.trig === 'timer' && s.age > .5) { releasePayload(world, s); s.life = 0; }
    for (const f of world.foes) {
      if (f.dead || f.spawnT > 0 || s.hit.includes(f) || s.life <= 0) continue;
      if (Math.hypot(f.x - s.x, f.y - s.y + f.r * .8) > f.r + s.r + 4) continue;
      s.hit.push(f); hurtFoe(world, f, s.dmg, s.vx * .12, s.vy * .12);
      if (s.freeze) f.frozen = 1.6; if (s.burn) f.burn = Math.max(f.burn, 2.2);
      if (s.boom) explode(world, s.x, s.y, s.boom, s.dmg * .7);
      if (s.chain) { let from = f, hitL = [f]; for (let k = 0; k < s.chain; k++) { const n = nearestFoe(world, from.x, from.y, hitL); if (!n || Math.hypot(n.x - from.x, n.y - from.y) > 170) break; world.fxs.push({ type: 'bolt', x: from.x, y: from.y, x2: n.x, y2: n.y, life: .18 }); hurtFoe(world, n, s.dmg * .8); hitL.push(n); from = n; } }
      if (s.trig === 'hit') releasePayload(world, s, f);
      if (s.pierce > 0) s.pierce--; else s.life = 0;
    }
    if (s.life <= 0 && s.trig === 'hit') releasePayload(world, s);
  }
  world.shots = world.shots.filter(s => s.life > 0);
  for (const p of world.patches) { p.life -= dt; for (const f of world.foes) if (!f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 14 + f.r * .5) { f.burn = Math.max(f.burn, 1); } }
  world.patches = world.patches.filter(p => p.life > 0); if (world.patches.length > 200) world.patches.splice(0, world.patches.length - 200);
}
function hurtFoe(world, f, dmg, kx = 0, ky = 0) {
  if (f.dead) return;
  f.hp -= dmg; f.hit = 0.12; f.dmgTaken = (f.dmgTaken || 0) + dmg; if (!f.boss && !f.dummy) { f.kx += kx; f.ky += ky; }
  for (let i = 0; i < 3; i++) world.parts.push({ x: f.x, y: f.y - f.r, vx: (fx() - .5) * 160, vy: (fx() - .5) * 160, life: .35, c: '#7a6a4a', s: 2 });
  if (world.onDmg) world.onDmg(f, dmg);
  if (f.hp <= 0) { if (f.dummy) { f.hp = f.max; } else killFoe(world, f); }
}

// ---------- state ----------
let G = null, mode = 'camp', paused = false, room = null;
const P = { x: 0, y: 0, vx: 0, vy: 0, r: 13, face: 0, dodgeT: 0, dodgeCd: 0, skillCd: 0, inv: 0, hurt: 0, walk: 0 };
const CLASSES = {
  pilgrim: { name: 'The Pilgrim', flame: 100, speed: 150 },
  witch: { name: 'Lantern Witch', flame: 80, speed: 162 },
};
const CURSES = [
  { id: 'wrath', name: 'Curse of Wrath', icon: '☠', desc: 'Foes deal +35% damage.' },
  { id: 'legion', name: 'Curse of the Legion', icon: '👥', desc: 'More foes in every room.' },
  { id: 'iron', name: 'Curse of Iron Flesh', icon: '⛨', desc: 'Foes have +40% health.' },
];
const DOORS = {
  fight: { icon: '⚔', name: 'Fight', desc: 'Hollow dead. A card or wand awaits.' },
  elite: { icon: '💀', name: 'Elite', desc: 'A hulking foe. Likely a wand.' },
  shrine: { icon: '⛪', name: 'Shrine', desc: 'Rest, pray, and tinker with your wands.' },
  merchant: { icon: '⚖', name: 'Merchant', desc: 'Trade flame for spells.' },
  treasure: { icon: '⚰', name: 'Cursed Treasure', desc: 'Take a curse for riches.' },
  boss: { icon: '🔔', name: 'The Bell-Warden', desc: 'The keeper of the first floor.' },
};
const curse = id => G.curses.includes(id);
const wand = () => G.wands[G.active] || G.wands[0];

function newRun(cls, daily) {
  const seed = daily ? hashStr('ashen-' + todayKey()) : (Math.random() * 2 ** 32) >>> 0;
  const st = starter(cls), fl = CLASSES[cls].flame + camp.wick * 10;
  G = { cls, daily, seed, step: 0, maxFlame: fl, flame: fl, wands: st.wands, active: 0, bag: st.bag, curses: [], embersRun: 0, kills: 0, path: [] };
  G.map = genMap(); camp.runs++; saveCamp();
  showMap();
}
function stepRng(tag) { rng = mulberry(hashStr(G.seed + ':' + G.step + ':' + tag)); }
function genMap() {
  const r = mulberry(G.seed), steps = [], pool = ['fight', 'fight', 'elite', 'shrine', 'merchant', 'treasure'];
  for (let i = 0; i < 6; i++) {
    const n = i === 0 ? 2 : 2 + (r() < 0.5 ? 1 : 0), opts = [];
    if (i === 0) opts.push('fight', r() < .5 ? 'fight' : 'treasure');
    else while (opts.length < n) { const d = pool[Math.floor(r() * pool.length)]; if (!opts.includes(d) || d === 'fight') opts.push(d); }
    if (!opts.includes('fight') && !opts.includes('elite')) opts[0] = 'fight';
    steps.push(opts);
  }
  steps.push(['boss']); return steps;
}

// ---------- persistence ----------
function saveRun() { if (!G || ['dead', 'win', 'camp', 'dying'].includes(mode)) return; try { localStorage.setItem(RUN_KEY, JSON.stringify({ G })); } catch (e) { } }
function loadRun() { try { return JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) { return null; } }
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveRun(); if (mode === 'room' && !paused) togglePause(); } });
addEventListener('pagehide', saveRun);

// ---------- UI helpers ----------
function toast(t, ms = 1600) { TOAST.textContent = t; TOAST.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => TOAST.classList.remove('on'), ms); }
function panel(html, cls = '') { stopPreview(); UI.innerHTML = '<div class="panel ' + cls + '">' + html + '</div>'; }
function closeUI() { stopPreview(); UI.innerHTML = ''; }
function on(id, f) { const e = document.getElementById(id); if (e) e.onclick = f; }
const cardChip = (id, extra = '') => id ? `<div class="chip t-${CARDS[id].t}" data-card="${id}" ${extra}><i>${CARDS[id].icon}</i><u>${CARDS[id].name}</u></div>` : '';
function cardRow(id, attrs = '', label) { const c = CARDS[id]; return `<button class="card t-${c.t}" ${attrs}><span class="ic">${c.icon}</span><div><b>${label || c.name}</b><span><em>${TYPE_NAME[c.t]}</em> · ${c.mana ? c.mana + ' mana · ' : ''}${c.desc}</span></div></button>`; }
function wandRow(w, attrs = '', label) { return `<button class="card t-wand" ${attrs}><span class="ic">🪄</span><div><b>${label || w.name}</b><span>${w.slots.length} slots · delay ${w.delay}s · recharge ${w.recharge}s · mana ${w.maxMana} (+${w.regen}/s)${w.slots.some(Boolean) ? ' · holds ' + w.slots.filter(Boolean).map(i => CARDS[i].name).join(', ') : ''}</span></div></button>`; }

function showCamp() {
  mode = 'camp'; HUD.classList.add('hidden'); G = null;
  const saved = loadRun(), db = camp.dailyBest[todayKey()];
  panel(`<h1>ASHEN PILGRIM</h1><p class="small">Your flame is your life and your coin. Your wand is your voice.</p>
  <p>🔥 <b style="color:#ffcf85">${camp.embers}</b> embers at camp</p>
  ${saved ? '<button class="btn" id="cont">Continue run (room ' + (saved.G.step + 1) + ')</button>' : ''}
  <button class="btn" id="go">Descend as The Pilgrim 🕯</button>
  <button class="btn" id="goW" ${camp.witch ? '' : 'disabled'}>Descend as the Lantern Witch 🏮${camp.witch ? '' : ' (locked)'}</button>
  <button class="btn sub" id="daily">☀ Daily seeded run — ${todayKey()}${db ? ' · best ' + db : ''}</button>
  <h2 style="margin-top:12px">The Camp</h2>
  <button class="btn sub" id="unW" ${camp.witch || camp.embers < WITCH_COST ? 'disabled' : ''}>${camp.witch ? '🏮 Lantern Witch unlocked (Lantern Rod: 3 slots, Ice Shard + Spark Bolt)' : '🏮 Unlock Lantern Witch — ' + WITCH_COST + ' embers'}</button>
  <button class="btn sub" id="wick" ${camp.embers < 25 + camp.wick * 15 || camp.wick >= 5 ? 'disabled' : ''}>🕯 Thicker Wick (+10 starting flame) — ${25 + camp.wick * 15} embers · lv ${camp.wick}/5</button>
  <p class="small">Move: drag / joystick · WASD. Your wand casts by itself at the nearest foe. Dodge: button / Space. Skill: button / E. Swap wand: ⇄ / Q.</p>`);
  on('cont', () => { const s = loadRun(); G = s.G; showMap(); });
  on('go', () => { clearRun(); newRun('pilgrim', false); });
  on('goW', () => { clearRun(); newRun('witch', false); });
  on('daily', () => { clearRun(); if (!camp.witch) return newRun('pilgrim', true); panel(`<h2>Daily run</h2><button class="btn" id="a">The Pilgrim 🕯</button><button class="btn" id="b">Lantern Witch 🏮</button>`); on('a', () => newRun('pilgrim', true)); on('b', () => newRun('witch', true)); });
  on('unW', () => { camp.embers -= WITCH_COST; camp.witch = true; saveCamp(); toast('The Lantern Witch joins the camp'); showCamp(); });
  on('wick', () => { camp.embers -= 25 + camp.wick * 15; camp.wick++; saveCamp(); showCamp(); });
}
function showMap() {
  mode = 'map'; room = null; HUD.classList.add('hidden'); saveRun();
  const opts = G.map[G.step];
  const crumbs = G.map.map((s, i) => i < G.step ? (DOORS[G.path[i]] || {}).icon || '·' : i === G.step ? '◉' : '·').join(' ');
  panel(`<h2>Floor I — the Drowned Nave</h2><p class="small">${crumbs}</p>
  <p>Flame ${Math.ceil(G.flame)}/${G.maxFlame}${G.curses.length ? ' · ' + G.curses.map(c => CURSES.find(x => x.id === c).icon).join('') : ''}</p>
  <button class="btn" id="edit">🪄 Edit wands</button>
  <p class="small">Choose a door</p><div class="cards">${opts.map((d, i) => `<button class="card" id="door${i}" data-door="${d}"><span class="ic">${DOORS[d].icon}</span><div><b>${DOORS[d].name}</b><span>${DOORS[d].desc}</span></div></button>`).join('')}</div>
  <button class="btn sub" id="quit">Abandon run</button>`);
  opts.forEach((d, i) => on('door' + i, () => enterDoor(d)));
  on('edit', () => editor(showMap)); on('quit', () => die(true));
}
function enterDoor(d) {
  G.path[G.step] = d; stepRng(d);
  if (d === 'fight' || d === 'elite' || d === 'boss') return startRoom(d);
  if (d === 'shrine') return shrine();
  if (d === 'merchant') return merchant();
  if (d === 'treasure') return treasure();
}
function advance() { G.step++; showMap(); }

function cardChoices(n, cursed) { const out = []; while (out.length < n) { const id = cursed && rng() < .25 ? 'bloodwax' : pick(CARD_POOL); if (!out.includes(id)) out.push(id); } return out; }
function bagAdd(id) { const i = G.bag.indexOf(null); if (i >= 0) { G.bag[i] = id; return true; } return false; }
function reward(title, wandChance) {
  mode = 'pick'; HUD.classList.add('hidden');
  const opts = cardChoices(3, G.curses.length > 0).map(id => ({ card: id }));
  if (rng() < wandChance) opts[2] = { wand: randomWand(G.step + G.curses.length) };
  const full = !G.bag.includes(null);
  panel(`<h2>${title}</h2><p class="small">Choose one${full ? ' · bag full: a card will replace bag slot 8' : ''}</p><div class="cards">${opts.map((o, i) => o.card ? cardRow(o.card, `id="rw${i}" data-reward="card"`) : wandRow(o.wand, `id="rw${i}" data-reward="wand"`, 'New wand: ' + o.wand.name)).join('')}</div><button class="btn sub" id="skip">Skip</button>`);
  opts.forEach((o, i) => on('rw' + i, () => {
    if (o.card) { if (!bagAdd(o.card)) G.bag[7] = o.card; toast(CARDS[o.card].icon + ' ' + CARDS[o.card].name + ' added to your bag'); advance(); }
    else takeWand(o.wand, advance);
  }));
  on('skip', advance);
}
function takeWand(w, then) {
  if (G.wands.length < 2) { G.wands.push(w); toast('🪄 ' + w.name + ' — swap with ⇄ / Q'); return then(); }
  panel(`<h2>Your hands are full</h2><p>Replace which wand? Its cards go to your bag if there is room.</p>${G.wands.map((x, i) => wandRow(x, `id="rep${i}"`, 'Replace ' + x.name)).join('')}<button class="btn sub" id="keep">Keep both, leave the new wand</button>`);
  G.wands.forEach((x, i) => on('rep' + i, () => { x.slots.filter(Boolean).forEach(bagAdd); G.wands[i] = w; then(); }));
  on('keep', then);
}
function shrine() {
  mode = 'pick'; const heal = Math.round(G.maxFlame * 0.35);
  panel(`<h2>⛪ Forgotten Shrine</h2><p>Candles gutter before a faceless saint. You may also rework your wands here.</p>
  <button class="btn sub" id="edit">🪄 Edit wands</button>
  <button class="btn" id="rest">Rest — restore ${heal} flame</button>
  <button class="btn" id="pray">Pray — a random card, lose 10 max flame</button>`);
  on('edit', () => editor(shrine));
  on('rest', () => { G.flame = Math.min(G.maxFlame, G.flame + heal); advance(); });
  on('pray', () => { const id = pick(CARD_POOL); bagAdd(id); toast(CARDS[id].icon + ' ' + CARDS[id].name); G.maxFlame -= 10; G.flame = Math.min(G.flame, G.maxFlame); advance(); });
}
function merchant() {
  mode = 'pick';
  const ch = cardChoices(4, true), prices = ch.map(id => Math.round((CARDS[id].t === 'proj' ? 16 : 12) + rnd(0, 10)));
  let wnd = randomWand(G.step + 1); const wp = 35;
  const draw = () => {
    panel(`<h2>⚖ The Ash Merchant</h2><p>"Your flame for my spells, pilgrim. Burn bright… or burn out."</p><p>Flame: <b style="color:#ffcf85">${Math.ceil(G.flame)}</b>/${G.maxFlame} · Bag ${G.bag.filter(Boolean).length}/8</p><div class="cards">${ch.map((id, i) => id ? cardRow(id, `id="buy${i}" ${G.flame <= prices[i] || !G.bag.includes(null) ? 'disabled' : ''}`, CARDS[id].name + ' — ' + prices[i] + ' 🔥') : '').join('')}
    ${wnd ? wandRow(wnd, `id="buyW" ${G.flame <= wp ? 'disabled' : ''}`, wnd.name + ' — ' + wp + ' 🔥') : ''}</div><button class="btn sub" id="edit">🪄 Edit wands</button><button class="btn" id="leave">Leave</button>`);
    ch.forEach((id, i) => id && on('buy' + i, () => { G.flame -= prices[i]; bagAdd(id); ch[i] = null; draw(); }));
    on('buyW', () => { G.flame -= wp; const w = wnd; wnd = null; takeWand(w, draw); });
    on('edit', () => editor(draw));
    on('leave', advance);
  };
  draw();
}
function treasure() {
  mode = 'pick';
  const avail = CURSES.filter(c => !curse(c.id)), cs = avail.length ? pick(avail) : null;
  panel(`<h2>⚰ Cursed Reliquary</h2><p>A coffin chained shut. Something inside hums with power.</p>
  ${cs ? `<div class="card curse"><span class="ic">${cs.icon}</span><div><b>${cs.name}</b><span>${cs.desc} Embers +50%, and rewards may hold cursed cards and better wands.</span></div></div><button class="btn" id="take">Accept the curse — open it</button>` : ''}
  <button class="btn sub" id="leave">Leave it sealed</button>`);
  on('take', () => { G.curses.push(cs.id); toast(cs.icon + ' ' + cs.name); reward('The reliquary opens', 0.5); });
  on('leave', advance);
}
function die(abandon) {
  mode = 'dead'; room = null; HUD.classList.add('hidden'); clearRun();
  const gained = Math.floor(G.embersRun);
  camp.embers += gained; camp.total += gained; camp.best = Math.max(camp.best, G.step);
  if (G.daily) { const k = todayKey(); camp.dailyBest[k] = Math.max(camp.dailyBest[k] || 0, G.step); }
  saveCamp();
  panel(`<h1>${abandon ? 'ABANDONED' : 'THE FLAME DIES'}</h1><p>You reached room ${G.step + 1} of ${G.map.length} and slew ${G.kills}.</p>
  <p>🔥 ${gained} embers carried back to camp.</p>${!camp.witch && camp.embers >= WITCH_COST ? '<p style="color:#ffb347">You can now unlock the Lantern Witch!</p>' : ''}<button class="btn" id="camp">Return to camp</button>`);
  on('camp', showCamp);
}
function win() {
  mode = 'win'; HUD.classList.add('hidden'); clearRun();
  const gained = Math.floor(G.embersRun + 40 * (1 + .5 * G.curses.length));
  camp.embers += gained; camp.total += gained; camp.best = Math.max(camp.best, G.map.length);
  if (G.daily) { const k = todayKey(); camp.dailyBest[k] = Math.max(camp.dailyBest[k] || 0, G.map.length); }
  saveCamp();
  panel(`<h1>FLOOR CLEARED</h1><p>The Bell-Warden falls silent. Deeper floors await (coming soon).</p><p>🔥 ${gained} embers carried back to camp.</p><button class="btn" id="camp">Return to camp</button>`);
  on('camp', showCamp);
}

// ---------- wand editor (drag & drop, touch + mouse) ----------
let edWand = 0, edSel = null, preview = null, edBack = null;
function editor(back) {
  if (back) edBack = back;
  mode = mode === 'room' ? mode : 'edit';
  edWand = Math.min(edWand, G.wands.length - 1);
  const w = G.wands[edWand];
  panel(`<h2>🪄 Wand Editor</h2>
  ${G.wands.length > 1 ? `<div class="tabs">${G.wands.map((x, i) => `<button class="tab ${i === edWand ? 'on' : ''}" id="wt${i}">${x.name}</button>`).join('')}</div>` : `<p class="small">${w.name}</p>`}
  <p class="small">delay ${w.delay}s · recharge ${w.recharge}s · mana ${w.maxMana} (+${w.regen}/s) · ${w.slots.length} slots</p>
  <div class="slots wand" id="wslots">${w.slots.map((id, i) => `<div class="slot" data-loc="w:${i}">${cardChip(id)}</div>`).join('')}</div>
  <canvas id="pv" width="300" height="120"></canvas>
  <p class="cast" id="castDesc">${describeCast(w)}</p>
  <p class="small">Bag</p>
  <div class="slots bag" id="bslots">${G.bag.map((id, i) => `<div class="slot" data-loc="b:${i}">${cardChip(id)}</div>`).join('')}</div>
  <p class="info" id="info">Drag cards between the bag and the wand (or tap one, then tap a slot). Read left→right: modifiers apply to the next projectile; multicasts fire the next N together.</p>
  <div class="legend"><span class="t-proj">Projectile</span><span class="t-mod">Modifier</span><span class="t-multi">Multicast</span><span class="t-trig">Trigger</span><span class="t-curse">Cursed</span></div>
  <button class="btn" id="done">Done</button>`, 'wide');
  G.wands.forEach((x, i) => on('wt' + i, () => { edWand = i; edSel = null; editor(); }));
  on('done', () => { saveRun(); const b = edBack; edBack = null; edSel = null; b(); });
  if (edSel) { const s = UI.querySelector(`[data-loc="${edSel}"]`); s && s.classList.add('sel'); }
  setupDrag(); startPreview(w);
}
function getLoc(loc) { const [k, i] = loc.split(':'); return k === 'w' ? G.wands[edWand].slots[+i] : G.bag[+i]; }
function setLoc(loc, v) { const [k, i] = loc.split(':'); if (k === 'w') { G.wands[edWand].slots[+i] = v; G.wands[edWand].idx = 0; } else G.bag[+i] = v; }
function moveCard(from, to) { if (from === to) return; const a = getLoc(from), b = getLoc(to); setLoc(to, a); setLoc(from, b); editor(); }
let drag = null;
function setupDrag() {
  UI.querySelectorAll('.slot').forEach(sl => {
    sl.addEventListener('pointerdown', e => {
      const chip = sl.querySelector('.chip'); const loc = sl.dataset.loc;
      if (chip) { const c = CARDS[chip.dataset.card]; document.getElementById('info').innerHTML = `<b class="t-${c.t}">${c.name}</b> — ${TYPE_NAME[c.t]}${c.mana ? ', ' + c.mana + ' mana' : ''}. ${c.desc}`; }
      drag = { loc, x: e.clientX, y: e.clientY, chip, ghost: null, id: e.pointerId };
      e.preventDefault();
    });
  });
}
addEventListener('pointermove', e => {
  if (!drag || !drag.chip || e.pointerId !== drag.id) return;
  if (!drag.ghost && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) { drag.ghost = drag.chip.cloneNode(true); drag.ghost.classList.add('ghost'); document.body.appendChild(drag.ghost); drag.chip.style.opacity = .3; }
  if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }
});
addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (d.ghost) { d.ghost.remove(); const el = document.elementFromPoint(e.clientX, e.clientY); const sl = el && el.closest('.slot'); if (sl) moveCard(d.loc, sl.dataset.loc); else editor(); return; }
  if (edSel && edSel !== d.loc) { const f = edSel; edSel = null; moveCard(f, d.loc); }
  else if (edSel === d.loc) { edSel = null; editor(); }
  else if (d.chip) { edSel = d.loc; UI.querySelectorAll('.slot.sel').forEach(x => x.classList.remove('sel')); const s = UI.querySelector(`[data-loc="${d.loc}"]`); s && s.classList.add('sel'); }
});
addEventListener('pointercancel', () => { if (drag && drag.ghost) drag.ghost.remove(); drag = null; });
function startPreview(w) {
  const c = document.getElementById('pv'); if (!c) return;
  const pd = Math.min(2, devicePixelRatio || 1); c.width = 300 * pd; c.height = 120 * pd;
  const dummy = { type: 'husk', dummy: true, x: 250, y: 85, hp: 1e6, max: 1e6, spd: 0, r: 14, dmg: 0, burn: 0, hit: 0, t: 0, kx: 0, ky: 0, spawnT: 0, frozen: 0 };
  preview = { canvas: c, ctx: c.getContext('2d'), pd, wand: JSON.parse(JSON.stringify(w)), world: { bounds: { x0: 0, y0: 20, x1: 300, y1: 120 }, foes: [dummy], shots: [], parts: [], fxs: [], patches: [], dmgMul: 1, onDmg: (f, d) => preview.dps.push({ t: preview.t, d }) }, dummy, t: 0, dps: [] };
  preview.wand.idx = 0; preview.wand.cd = 0.3; preview.wand.mana = preview.wand.maxMana;
}
function stopPreview() { preview = null; }
function tickPreview(dt, t) {
  const pv = preview; if (!pv || !document.body.contains(pv.canvas)) { preview = null; return; }
  pv.t += dt; const wd = pv.world, d = pv.dummy, wn = pv.wand;
  d.t += dt; d.y = 75 + Math.sin(pv.t * 1.3) * 28; d.hit = Math.max(0, d.hit - dt); if (d.burn > 0) { d.burn -= dt; hurtFoe(wd, d, 6 * dt); } d.frozen = Math.max(0, (d.frozen || 0) - dt);
  wn.mana = Math.min(wn.maxMana, wn.mana + wn.regen * dt); wn.cd -= dt;
  if (wn.cd <= 0) { const a = Math.atan2(d.y - d.r - 70, d.x - 34); tryCast(wd, wn, 34, 70, a + 0.5, null); } // offset aim so homing visibly curves
  updateShots(wd, dt);
  for (const p of wd.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; } wd.parts = wd.parts.filter(p => p.life > 0);
  for (const f of wd.fxs) { f.life -= dt; if (f.type === 'ring') f.r += (f.R - f.r) * Math.min(1, dt * 12); } wd.fxs = wd.fxs.filter(f => f.life > 0);
  pv.dps = pv.dps.filter(e => pv.t - e.t < 3);
  // draw
  const g = pv.ctx; cx = g; g.setTransform(pv.pd, 0, 0, pv.pd, 0, 0);
  g.fillStyle = '#1a1813'; g.fillRect(0, 0, 300, 120); g.strokeStyle = 'rgba(0,0,0,.4)'; for (let x = 0; x < 300; x += 30) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 120); g.stroke(); }
  drawPatches(wd); drawFoe(d, t); if (d.frozen > 0) { g.fillStyle = 'rgba(160,220,255,.35)'; g.beginPath(); g.arc(d.x, d.y - d.r, d.r * 1.1, 0, TAU); g.fill(); }
  g.fillStyle = '#ffb347'; g.shadowColor = '#ff7a1a'; g.shadowBlur = 12; g.beginPath(); g.arc(34, 70, 6, 0, TAU); g.fill(); g.shadowBlur = 0;
  drawShots(wd); drawFx(wd);
  g.fillStyle = '#d6b98c'; g.font = '11px Georgia'; g.textBaseline = 'top';
  g.fillText('Preview · DPS ≈ ' + Math.round(pv.dps.reduce((s, e) => s + e.d, 0) / 3) + ' · mana ' + Math.floor(wn.mana) + '/' + wn.maxMana, 6, 4);
  cx = mainCx;
}

// ---------- combat ----------
function arena() { const m = 18, top = Math.max(70, H * 0.12); return { x0: m, y0: top, x1: W - m, y1: H - m }; }
const FOES = {
  husk: { hp: 30, spd: 48, r: 14, dmg: 10, ember: 3 },
  bat: { hp: 16, spd: 105, r: 11, dmg: 6, ember: 2 },
  cultist: { hp: 24, spd: 38, r: 13, dmg: 8, ember: 4, ranged: true },
  warden: { hp: 650, spd: 34, r: 34, dmg: 18, ember: 30, boss: true },
};
function startRoom(kind) {
  mode = 'room'; paused = false; closeUI(); HUD.classList.remove('hidden');
  const A = arena();
  room = { kind, t: 0, bounds: A, foes: [], shots: [], eshots: [], parts: [], drops: [], fxs: [], patches: [], wisps: [], waves: [], done: false, doneT: 0 };
  for (const w of G.wands) { w.mana = w.maxMana; w.idx = 0; w.cd = 0.4; }
  P.x = (A.x0 + A.x1) / 2; P.y = A.y1 - 60; P.vx = P.vy = 0; P.inv = 1; P.dodgeT = 0; P.skillCd = 0; P.dodgeCd = 0;
  const leg = curse('legion') ? 1.4 : 1, tier = 1 + G.step * 0.12;
  if (kind === 'boss') spawn('warden', (A.x0 + A.x1) / 2, A.y0 + 90, tier);
  else {
    const n = Math.round((5 + G.step * 1.3) * leg);
    room.waves = [Math.ceil(n * 0.55), Math.floor(n * 0.45)];
    room.kindsPool = G.step < 1 ? ['husk', 'husk', 'bat'] : ['husk', 'husk', 'bat', 'cultist'];
    room.elite = kind === 'elite'; nextWave();
  }
  toast(kind === 'boss' ? '🔔 THE BELL-WARDEN' : kind === 'elite' ? '💀 An elite stirs' : '⚔ The hollow rise', 1400);
}
function nextWave() {
  const A = arena(), tier = 1 + G.step * 0.12, n = room.waves.shift();
  for (let i = 0; i < n; i++) { const side = Math.floor(rnd(3)); spawn(pick(room.kindsPool), side === 0 ? rnd(A.x0 + 20, A.x1 - 20) : side === 1 ? A.x0 + 20 : A.x1 - 20, side === 0 ? A.y0 + 20 : rnd(A.y0 + 20, (A.y0 + A.y1) / 2), tier); }
  if (room.elite && room.waves.length === 0) spawn('husk', (A.x0 + A.x1) / 2, A.y0 + 40, tier, true);
}
function spawn(type, x, y, tier, elite) {
  const f = FOES[type], hpm = (curse('iron') ? 1.4 : 1) * tier * (elite ? 7 : 1);
  room.foes.push({ type, x, y, hp: f.hp * hpm, max: f.hp * hpm, spd: f.spd * (elite ? 0.85 : 1), r: f.r * (elite ? 1.8 : 1), dmg: f.dmg * (curse('wrath') ? 1.35 : 1) * (elite ? 1.6 : 1), elite: !!elite, boss: !!f.boss, ember: f.ember * (elite ? 6 : 1), burn: 0, hit: 0, t: fx() * 9, atk: rnd(1, 2.5), kx: 0, ky: 0, spawnT: 0.5, phase: 0, frozen: 0 });
}
function killFoe(world, f) {
  f.dead = true; if (world !== room) return; G.kills++;
  const n = Math.max(1, Math.round(f.ember * (1 + .5 * G.curses.length) / 2));
  for (let i = 0; i < n; i++) room.drops.push({ x: f.x + (fx() - .5) * 20, y: f.y + (fx() - .5) * 20, vx: (fx() - .5) * 120, vy: (fx() - .5) * 120, t: 0 });
  for (let i = 0; i < 14; i++) room.parts.push({ x: f.x, y: f.y, vx: (fx() - .5) * 220, vy: (fx() - .5) * 220, life: .6, c: i % 2 ? '#ff8a2a' : '#3a3428', s: 3 });
}
function hurtPlayer(d) {
  if (P.inv > 0 || P.dodgeT > 0 || mode !== 'room') return;
  G.flame -= d; P.inv = 0.7; P.hurt = 0.25; shake = 6;
  if (G.flame <= 0) { G.flame = 0; mode = 'dying'; setTimeout(() => die(false), 600); }
}
function payFlame(n) { G.flame -= n; if (G.flame <= 1) G.flame = 1; } // bloodwax can't kill you outright
function dodge() {
  if (mode !== 'room' || P.dodgeCd > 0 || paused) return;
  let dx = input.dx, dy = input.dy; if (!dx && !dy) { dx = Math.cos(P.face); dy = Math.sin(P.face); }
  const l = Math.hypot(dx, dy) || 1; P.vx = dx / l * 520; P.vy = dy / l * 520; P.dodgeT = 0.22; P.dodgeCd = 1.3;
}
function skill() {
  if (mode !== 'room' || P.skillCd > 0 || paused) return;
  P.skillCd = G.cls === 'witch' ? 9 : 7;
  if (G.cls === 'witch') { room.wisps = [0, 1, 2].map(i => ({ a: i * TAU / 3, life: 6 })); toast('Wisps'); }
  else {
    room.fxs.push({ type: 'ring', x: P.x, y: P.y, r: 10, R: 140, life: .5, c: '#ff9a3a' }); shake = 8;
    for (const f of room.foes) { const d = Math.hypot(f.x - P.x, f.y - P.y) || 1; if (d < 140) hurtFoe(room, f, 30, (f.x - P.x) / d * 260, (f.y - P.y) / d * 260); }
  }
}
function swapWand() {
  if (!G || G.wands.length < 2 || (mode !== 'room' && mode !== 'map')) return;
  G.active = (G.active + 1) % G.wands.length; wand().cd = Math.max(wand().cd, .25); toast('🪄 ' + wand().name, 900);
}
let shake = 0;
function update(dt) {
  if (mode !== 'room' && mode !== 'dying') return;
  if (paused) return;
  const A = arena(); room.bounds = A; room.t += dt;
  P.inv = Math.max(0, P.inv - dt); P.hurt = Math.max(0, P.hurt - dt); P.dodgeCd = Math.max(0, P.dodgeCd - dt); P.skillCd = Math.max(0, P.skillCd - dt);
  const spd = CLASSES[G.cls].speed;
  if (P.dodgeT > 0) { P.dodgeT -= dt; room.parts.push({ x: P.x, y: P.y - 8, vx: 0, vy: 0, life: .25, c: '#ff8a2a55', s: 9 }); }
  else if (mode === 'room') { let dx = input.dx, dy = input.dy; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } P.vx = dx * spd; P.vy = dy * spd; if (l > .1) P.walk += dt * 10; }
  else P.vx = P.vy = 0;
  P.x = clamp(P.x + P.vx * dt, A.x0 + P.r, A.x1 - P.r); P.y = clamp(P.y + P.vy * dt, A.y0 + P.r + 10, A.y1 - P.r);
  // wands: all regen mana, active one casts automatically at nearest foe
  for (const w of G.wands) { w.mana = Math.min(w.maxMana, w.mana + w.regen * dt); w.cd -= dt; }
  const w = wand(), t = nearestFoe(room, P.x, P.y);
  if (t) P.face = Math.atan2(t.y - P.y, t.x - P.x); else if (Math.hypot(P.vx, P.vy) > 1) P.face = Math.atan2(P.vy, P.vx);
  if (t && w.cd <= 0 && mode === 'room') tryCast(room, w, P.x + Math.cos(P.face) * 14, P.y - 14, Math.atan2(t.y - t.r * .8 - (P.y - 14), t.x - P.x), payFlame);
  for (const ws of room.wisps) { ws.life -= dt; ws.a += dt * 3.2; ws.x = P.x + Math.cos(ws.a) * 46; ws.y = P.y - 8 + Math.sin(ws.a) * 46; for (const f of room.foes) if (Math.hypot(f.x - ws.x, f.y - ws.y) < f.r + 8 && (f.wt || 0) <= 0) { hurtFoe(room, f, 10); f.burn = 2; f.wt = 0.3; } }
  room.wisps = room.wisps.filter(x => x.life > 0);
  updateShots(room, dt);
  for (const f of room.foes) {
    f.t += dt; f.hit = Math.max(0, f.hit - dt); f.wt = (f.wt || 0) - dt; f.frozen = Math.max(0, f.frozen - dt);
    if (f.spawnT > 0) { f.spawnT -= dt; continue; }
    if (f.burn > 0) { f.burn -= dt; f.hp -= 6 * dt; if (fx() < .3) room.parts.push({ x: f.x + (fx() - .5) * f.r, y: f.y - f.r * .5, vx: 0, vy: -40, life: .4, c: '#ff7a1a', s: 2 }); if (f.hp <= 0 && !f.dead) killFoe(room, f); }
    const dx = P.x - f.x, dy = P.y - f.y, d = Math.hypot(dx, dy) || 1;
    let sp = f.spd * (f.frozen > 0 ? 0.3 : 1);
    if (FOES[f.type].ranged) { if (d < 160) sp = -sp; else if (d < 240) sp = 0; f.atk -= dt * (f.frozen > 0 ? .3 : 1); if (f.atk <= 0 && d < 380) { f.atk = rnd(1.8, 2.8); const a = Math.atan2(dy, dx); room.eshots.push({ x: f.x, y: f.y - 10, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 3, dmg: f.dmg }); } }
    if (f.type === 'bat') sp *= 1 + .3 * Math.sin(f.t * 4);
    if (f.boss) bossAI(f, dt);
    f.x += (dx / d * sp + f.kx) * dt; f.y += (dy / d * sp + f.ky) * dt + (f.type === 'bat' ? Math.sin(f.t * 7) * 30 * dt : 0);
    f.kx *= .86; f.ky *= .86;
    f.x = clamp(f.x, A.x0 + f.r, A.x1 - f.r); f.y = clamp(f.y, A.y0 + f.r, A.y1 - f.r);
    if (d < f.r + P.r) hurtPlayer(f.dmg);
  }
  for (let i = 0; i < room.foes.length; i++) for (let j = i + 1; j < room.foes.length; j++) { const a = room.foes[i], b = room.foes[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r; if (d < m && d > 0) { const p = (m - d) / 2 / d; if (!a.boss) { a.x -= dx * p; a.y -= dy * p; } if (!b.boss) { b.x += dx * p; b.y += dy * p; } } }
  room.foes = room.foes.filter(f => !f.dead);
  for (const b of room.eshots) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (Math.hypot(b.x - P.x, b.y - (P.y - 8)) < P.r + 5) { hurtPlayer(b.dmg); b.life = 0; } }
  room.eshots = room.eshots.filter(b => b.life > 0 && b.x > A.x0 && b.x < A.x1 && b.y > A.y0 && b.y < A.y1);
  for (const e of room.drops) {
    e.t += dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= .9; e.vy *= .9;
    const d = Math.hypot(P.x - e.x, P.y - e.y) || 1;
    if (e.t > .4 && (d < 90 || room.done)) { e.x += (P.x - e.x) / d * 420 * dt; e.y += (P.y - e.y) / d * 420 * dt; }
    if (d < 16) { e.got = true; G.embersRun += 1; G.flame = Math.min(G.maxFlame, G.flame + 1.2); }
  }
  room.drops = room.drops.filter(e => !e.got);
  for (const p of room.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; p.life -= dt; }
  room.parts = room.parts.filter(p => p.life > 0); if (room.parts.length > 500) room.parts.splice(0, room.parts.length - 500);
  for (const f of room.fxs) { f.life -= dt; if (f.type === 'ring') f.r += (f.R - f.r) * Math.min(1, dt * 12); }
  room.fxs = room.fxs.filter(f => f.life > 0);
  if (!room.done && room.foes.length === 0 && mode === 'room') {
    if (room.waves.length) nextWave(); else { room.done = true; room.doneT = 0; toast(room.kind === 'boss' ? 'The bell is silenced' : 'Room cleared'); }
  }
  if (room.done) { room.doneT += dt; if (room.doneT > 1.2 && room.drops.length === 0) { const k = room.kind; room = null; HUD.classList.add('hidden'); if (k === 'boss') win(); else reward(k === 'elite' ? 'Elite slain — claim a reward' : 'Claim a reward', k === 'elite' ? .6 : .25); } }
}
function bossAI(f, dt) {
  if (f.hp / f.max < .5 && f.phase === 0) { f.phase = 1; toast('The Warden tolls in fury'); shake = 10; }
  f.atk -= dt;
  if (f.atk <= 0) {
    const n = f.phase ? 16 : 10; f.atk = f.phase ? 2.2 : 3;
    for (let i = 0; i < n; i++) { const a = i / n * TAU + f.t; room.eshots.push({ x: f.x, y: f.y - 20, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 4, dmg: 9 * (curse('wrath') ? 1.35 : 1) }); }
    room.fxs.push({ type: 'ring', x: f.x, y: f.y - 20, r: 10, R: 70, life: .4, c: '#c8b27a' });
    if (room.foes.length < 5) { const A = arena(); spawn(f.phase ? 'bat' : 'husk', rnd(A.x0 + 30, A.x1 - 30), A.y0 + 30, 1 + G.step * .12); }
  }
}

// ---------- input ----------
const input = { dx: 0, dy: 0, keys: {}, stick: null };
addEventListener('keydown', e => { input.keys[e.code] = true; if (e.code === 'Space') { dodge(); e.preventDefault(); } if (e.code === 'KeyE') skill(); if (e.code === 'KeyQ') swapWand(); if (e.code === 'Escape' && mode === 'room') togglePause(); keyDir(); });
addEventListener('keyup', e => { input.keys[e.code] = false; keyDir(); });
function keyDir() { const k = input.keys; if (input.stick) return; input.dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0); input.dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0); }
cv.addEventListener('pointerdown', e => { if (mode !== 'room' || paused) return; input.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { const s = input.stick; if (!s || s.id !== e.pointerId) return; let dx = e.clientX - s.ox, dy = e.clientY - s.oy; const l = Math.hypot(dx, dy), M = 50; if (l > M) { s.ox += dx * (1 - M / l); s.oy += dy * (1 - M / l); dx = e.clientX - s.ox; dy = e.clientY - s.oy; } input.dx = dx / M; input.dy = dy / M; });
const endStick = e => { if (input.stick && input.stick.id === e.pointerId) { input.stick = null; input.dx = input.dy = 0; keyDir(); } };
cv.addEventListener('pointerup', endStick); cv.addEventListener('pointercancel', endStick);
const bindBtn = (id, f) => document.getElementById(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); f(); });
bindBtn('dodgeBtn', dodge); bindBtn('skillBtn', skill); bindBtn('swapBtn', swapWand); bindBtn('menuBtn', togglePause);
function togglePause() {
  if (mode !== 'room') return;
  paused = !paused;
  if (!paused) return closeUI();
  panel(`<h2>Paused</h2><button class="btn" id="res">Resume</button><button class="btn sub" id="ab">Abandon run</button><p class="small">Wands can be edited between rooms and at shrines.</p>`);
  on('res', togglePause); on('ab', () => { paused = false; closeUI(); die(true); });
}

// ---------- rendering ----------
function drawPatches(wd) { for (const p of wd.patches) { cx.globalAlpha = Math.min(1, p.life) * .7; cx.fillStyle = '#ff6a1a'; cx.beginPath(); cx.ellipse(p.x, p.y, 7, 3.5, 0, 0, TAU); cx.fill(); } cx.globalAlpha = 1; }
function drawShots(wd) { for (const b of wd.shots) { cx.fillStyle = b.col; cx.shadowColor = b.col; cx.shadowBlur = 12; cx.beginPath(); if (b.kind === 'skull') { cx.arc(b.x, b.y, b.r, 0, TAU); cx.fill(); cx.fillStyle = '#2a1a10'; cx.fillRect(b.x - 3, b.y - 2, 2, 2); cx.fillRect(b.x + 1, b.y - 2, 2, 2); } else if (b.kind === 'ice') { const a = Math.atan2(b.vy, b.vx); cx.moveTo(b.x + Math.cos(a) * 8, b.y + Math.sin(a) * 8); cx.lineTo(b.x + Math.cos(a + 2.5) * 4, b.y + Math.sin(a + 2.5) * 4); cx.lineTo(b.x + Math.cos(a - 2.5) * 4, b.y + Math.sin(a - 2.5) * 4); cx.fill(); } else { cx.arc(b.x, b.y, b.r, 0, TAU); cx.fill(); } if (b.trig) { cx.strokeStyle = '#7dff7a'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(b.x, b.y, b.r + 3, 0, TAU); cx.stroke(); } if (b.homing) { cx.strokeStyle = '#7ab8ff'; cx.lineWidth = 1; cx.beginPath(); cx.arc(b.x, b.y, b.r + 5, 0, TAU); cx.stroke(); } cx.shadowBlur = 0; } }
function drawFx(wd) {
  for (const f of wd.fxs) {
    cx.globalAlpha = Math.min(1, f.life * 3);
    if (f.type === 'ring') { cx.strokeStyle = f.c; cx.lineWidth = 3; cx.beginPath(); cx.arc(f.x, f.y - 10, f.r, 0, TAU); cx.stroke(); }
    if (f.type === 'bolt') { cx.strokeStyle = '#cfe8ff'; cx.shadowColor = '#6ab0ff'; cx.shadowBlur = 10; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(f.x, f.y - 12); for (let i = 1; i < 6; i++) { const k = i / 6; cx.lineTo(f.x + (f.x2 - f.x) * k + (fx() - .5) * 14, f.y - 12 + (f.y2 - f.y) * k + (fx() - .5) * 14); } cx.lineTo(f.x2, f.y2 - 12); cx.stroke(); cx.shadowBlur = 0; }
  }
  cx.globalAlpha = 1;
  for (const p of wd.parts) { cx.globalAlpha = Math.min(1, p.life * 2.5); cx.fillStyle = p.c; cx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } cx.globalAlpha = 1;
}
const ambient = [];
function render(t) {
  cx = mainCx;
  cx.setTransform(DPR * Z, 0, 0, DPR * Z, 0, 0);
  if (!bg) buildBG();
  let sx = 0, sy = 0; if (shake > 0) { sx = (fx() - .5) * shake; sy = (fx() - .5) * shake; shake = Math.max(0, shake - .5); }
  cx.save(); cx.translate(sx, sy);
  cx.drawImage(bg, 0, 0, W, H);
  for (const [x, y] of braziers()) drawBrazier(x, y, t);
  if (room) {
    drawPatches(room);
    for (const e of room.drops) { cx.fillStyle = '#ff9a3a'; cx.shadowColor = '#ff7a1a'; cx.shadowBlur = 8; cx.beginPath(); cx.moveTo(e.x, e.y - 5); cx.lineTo(e.x + 3.5, e.y); cx.lineTo(e.x, e.y + 5); cx.lineTo(e.x - 3.5, e.y); cx.fill(); cx.shadowBlur = 0; }
    const ents = room.foes.map(f => ({ y: f.y, d: () => { drawFoe(f, t); if (f.frozen > 0) { cx.fillStyle = 'rgba(160,220,255,.35)'; cx.beginPath(); cx.arc(f.x, f.y - f.r, f.r * 1.1, 0, TAU); cx.fill(); } } }));
    ents.push({ y: P.y, d: () => drawPilgrim(P.x, P.y, t, G.cls, P.inv > 0 && Math.floor(t * 20) % 2 ? .4 : 1) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
    drawShots(room);
    for (const b of room.eshots) { cx.fillStyle = '#c23a2a'; cx.shadowColor = '#ff2a1a'; cx.shadowBlur = 10; cx.beginPath(); cx.arc(b.x, b.y, 5, 0, TAU); cx.fill(); cx.shadowBlur = 0; }
    for (const w of room.wisps) { cx.fillStyle = '#d8f6ff'; cx.shadowColor = '#7ad8ff'; cx.shadowBlur = 16; cx.beginPath(); cx.arc(w.x, w.y, 6, 0, TAU); cx.fill(); cx.shadowBlur = 0; }
    drawFx(room);
  } else {
    if (ambient.length < 60) ambient.push({ x: fx() * W, y: H + 10, vy: -20 - fx() * 40, vx: (fx() - .5) * 15, s: 1 + fx() * 2 });
    drawPilgrim(W / 2, H * .82, t, G ? G.cls : 'pilgrim');
  }
  for (const a of ambient) { a.x += a.vx / 60 + Math.sin(t + a.y * .02) * .3; a.y += a.vy / 60; cx.fillStyle = `rgba(255,${130 + a.s * 30 | 0},50,${.5 + Math.sin(t * 5 + a.x) * .3})`; cx.fillRect(a.x, a.y, a.s, a.s); }
  for (let i = ambient.length - 1; i >= 0; i--) if (ambient[i].y < -10) ambient.splice(i, 1);
  cx.restore();
  cx.fillStyle = 'rgba(40,55,35,.08)'; cx.fillRect(0, 0, W, H);
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); // screen space
  if (room && G) drawHUD();
  if (input.stick) { const s = input.stick; cx.strokeStyle = 'rgba(255,180,90,.35)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(s.ox, s.oy, 50, 0, TAU); cx.stroke(); cx.fillStyle = 'rgba(255,170,70,.45)'; cx.beginPath(); cx.arc(s.ox + clamp(input.dx, -1, 1) * 50, s.oy + clamp(input.dy, -1, 1) * 50, 20, 0, TAU); cx.fill(); }
  if (P.hurt > 0) { cx.fillStyle = `rgba(150,20,10,${P.hurt})`; cx.fillRect(0, 0, SW, SH); }
}
function bar(x, y, w, h, f, c1, c2, label) {
  cx.fillStyle = 'rgba(10,8,6,.7)'; cx.fillRect(x, y, w, h);
  const g = cx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2); cx.fillStyle = g; cx.fillRect(x + 2, y + 2, (w - 4) * clamp(f, 0, 1), h - 4);
  cx.strokeStyle = '#6b4a26'; cx.strokeRect(x, y, w, h);
  if (label) { cx.fillStyle = '#ffe9c0'; cx.font = 'bold 11px Georgia'; cx.textBaseline = 'middle'; cx.fillText(label, x + 6, y + h / 2 + .5); }
}
function drawHUD() {
  const x = 14, y = 14, w = Math.min(220, SW - 90), wn = wand();
  bar(x, y, w, 16, G.flame / G.maxFlame, '#a8321e', '#ffb347', '🔥 ' + Math.ceil(G.flame) + '/' + G.maxFlame);
  bar(x, y + 20, w * .7, 9, wn.mana / wn.maxMana, '#2a3a8a', '#7ab8ff');
  cx.font = '12px Georgia'; cx.fillStyle = '#d6b98c'; cx.textBaseline = 'middle';
  cx.fillText('🪄 ' + wn.name + (G.wands.length > 1 ? ' (' + (G.active + 1) + '/2)' : '') + '  ·  Room ' + (G.step + 1) + '/' + G.map.length + '  ·  ✦ ' + Math.floor(G.embersRun) + (G.curses.length ? '  ' + G.curses.map(c => CURSES.find(q => q.id === c).icon).join('') : ''), x, y + 42);
  document.getElementById('dodgeBtn').classList.toggle('cd', P.dodgeCd > 0); document.getElementById('skillBtn').classList.toggle('cd', P.skillCd > 0);
  document.getElementById('swapBtn').classList.toggle('hidden', G.wands.length < 2);
}

// ---------- loop ----------
function resize() { DPR = Math.min(2, devicePixelRatio || 1); SW = innerWidth; SH = innerHeight; Z = clamp(Math.min(SW, SH) / 500, 1, 1.7); W = SW / Z; H = SH / Z; cv.width = SW * DPR; cv.height = SH * DPR; bg = null; }
addEventListener('resize', resize); resize();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { update(dt); render(now / 1000); if (preview) tickPreview(dt, now / 1000); } catch (e) { cx = mainCx; console.error(e); }
  requestAnimationFrame(frame);
}
showCamp();
requestAnimationFrame(frame);
window.__ashen = { get G() { return G; }, get mode() { return mode; }, get room() { return room; }, get preview() { return preview; }, P, input, buildCast, describeCast, CARDS };
window.__ready = true;
