'use strict';
// ===== Ashen Pilgrim — a dark-fantasy roguelike (vanilla JS + canvas) =====
const cv = document.getElementById('c'), cx = cv.getContext('2d');
const UI = document.getElementById('ui'), HUD = document.getElementById('hud'), TOAST = document.getElementById('toast');
let W = 0, H = 0, DPR = 1;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- seeded RNG ----------
function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const todayKey = () => new Date().toISOString().slice(0, 10);
let rng = Math.random;
const rnd = (a = 1, b) => b === undefined ? rng() * a : a + rng() * (b - a);
const pick = arr => arr[Math.floor(rng() * arr.length)];
const fx = Math.random; // visual-only randomness

// ---------- persistent camp ----------
const CAMP_KEY = 'ashen-camp', RUN_KEY = 'ashen-run';
let camp = { embers: 0, total: 0, witch: false, wick: 0, runs: 0, best: 0, dailyBest: {} };
try { Object.assign(camp, JSON.parse(localStorage.getItem(CAMP_KEY) || '{}')); } catch (e) { }
const saveCamp = () => { try { localStorage.setItem(CAMP_KEY, JSON.stringify(camp)); } catch (e) { } };
const WITCH_COST = 60;

// ---------- data ----------
const CLASSES = {
  pilgrim: { name: 'The Pilgrim', icon: '🕯', flame: 100, speed: 150, dmg: 12, rate: 0.55, skill: 'Flare', desc: 'Hurls embers from a dying candle. Skill: Flare — a burst that hurls foes back.' },
  witch: { name: 'Lantern Witch', icon: '🏮', flame: 80, speed: 160, dmg: 8, rate: 0.36, skill: 'Wisps', desc: 'Swift lantern-bolts. Skill: Wisps — three spirit lights orbit and burn.' },
};
const RELICS = {
  fire: { name: 'Ember Brand', icon: '🔥', desc: 'Bolts set foes alight (burn over time).' },
  chain: { name: 'Chain Censer', icon: '⛓', desc: 'Bolts leap to a second foe.' },
  twin: { name: 'Twin Wick', icon: '🕯', desc: '+1 bolt per volley.' },
  rosary: { name: 'Thorned Rosary', icon: '📿', desc: '+20% chance to crit for double damage.' },
  boots: { name: 'Ash-Walker Boots', icon: '👢', desc: '+15% move speed, faster dodge recharge.' },
  ward: { name: 'Bone Ward', icon: '🦴', desc: 'Take 15% less damage.' },
  tallow: { name: 'Tallow Heart', icon: '❤', desc: '+20 max flame and heal 20.' },
  bell: { name: 'Grave Bell', icon: '🔔', desc: 'Dodging tolls a shockwave that hurts foes.' },
};
const COMBOS = [
  { id: 'storm', a: 'fire', b: 'chain', name: 'Storm Pyre', icon: '⚡', desc: 'Chains become lightning that ignites every foe it touches.' },
  { id: 'volley', a: 'twin', b: 'rosary', name: 'Penitent Volley', icon: '✠', desc: 'Bolts pierce through foes.' },
  { id: 'dirge', a: 'bell', b: 'ward', name: 'Funeral Dirge', icon: '⚱', desc: 'Bell shockwaves are huge and shield you briefly.' },
];
const CURSES = [
  { id: 'wrath', name: 'Curse of Wrath', icon: '☠', desc: 'Foes deal +35% damage.' },
  { id: 'legion', name: 'Curse of the Legion', icon: '👥', desc: 'More foes in every room.' },
  { id: 'iron', name: 'Curse of Iron Flesh', icon: '⛨', desc: 'Foes have +40% health.' },
];
const DOORS = {
  fight: { icon: '⚔', name: 'Fight', desc: 'Hollow dead. A relic awaits.' },
  elite: { icon: '💀', name: 'Elite', desc: 'A hulking foe. Rich reward.' },
  shrine: { icon: '⛪', name: 'Shrine', desc: 'Rest or pray.' },
  merchant: { icon: '⚖', name: 'Merchant', desc: 'Trade flame for power.' },
  treasure: { icon: '⚰', name: 'Cursed Treasure', desc: 'Take a curse for riches.' },
  boss: { icon: '🔔', name: 'The Bell-Warden', desc: 'The keeper of the first floor.' },
};

// ---------- state ----------
let G = null;      // run state
let mode = 'camp'; // camp | map | room | pick | dead | win
let paused = false;
let room = null;   // live combat state
const P = { x: 0, y: 0, vx: 0, vy: 0, r: 13, face: 0, fireT: 0, dodgeT: 0, dodgeCd: 0, skillCd: 0, inv: 0, hurt: 0, walk: 0, shield: 0 };

function newRun(cls, daily) {
  const seed = daily ? hashStr('ashen-' + todayKey()) : (Math.random() * 2 ** 32) >>> 0;
  rng = mulberry(seed);
  const c = CLASSES[cls];
  G = { cls, daily, seed, rngCalls: 0, step: 0, maxFlame: c.flame + camp.wick * 10, flame: c.flame + camp.wick * 10, relics: {}, combos: [], curses: [], embersRun: 0, kills: 0, path: [], dmgBonus: 0, rateBonus: 0 };
  G.map = genMap();
  camp.runs++; saveCamp();
  showMap();
}
// track RNG state for resumable saves: we reseed per step from seed+step
function stepRng(tag) { rng = mulberry(hashStr(G.seed + ':' + G.step + ':' + tag)); }

function genMap() {
  const r = mulberry(G.seed);
  const steps = [];
  const pool = ['fight', 'fight', 'elite', 'shrine', 'merchant', 'treasure'];
  for (let i = 0; i < 6; i++) {
    const n = i === 0 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
    const opts = [];
    if (i === 0) { opts.push('fight', r() < .5 ? 'fight' : 'treasure'); }
    else while (opts.length < n) { const d = pool[Math.floor(r() * pool.length)]; if (!opts.includes(d) || d === 'fight') opts.push(d); }
    if (!opts.includes('fight') && !opts.includes('elite')) opts[0] = 'fight';
    steps.push(opts);
  }
  steps.push(['boss']);
  return steps;
}

const has = id => !!G.relics[id];
const combo = id => G.combos.includes(id);
const curse = id => G.curses.includes(id);
function stats() {
  const c = CLASSES[G.cls], rel = G.relics;
  return {
    speed: c.speed * (1 + 0.15 * (rel.boots || 0)),
    dmg: c.dmg * (1 + G.dmgBonus),
    rate: c.rate / (1 + G.rateBonus),
    shots: 1 + (rel.twin || 0),
    crit: 0.05 + 0.2 * (rel.rosary || 0),
    armor: 1 - Math.min(0.6, 0.15 * (rel.ward || 0)),
    dodgeCd: 1.4 / (1 + 0.3 * (rel.boots || 0)),
    loot: 1 + 0.5 * G.curses.length,
  };
}
function addRelic(id, n = 1) {
  G.relics[id] = (G.relics[id] || 0) + n;
  if (id === 'tallow') { G.maxFlame += 20 * n; G.flame = Math.min(G.maxFlame, G.flame + 20 * n); }
  for (const cb of COMBOS) if (!G.combos.includes(cb.id) && has(cb.a) && has(cb.b)) { G.combos.push(cb.id); toast(cb.icon + ' COMBO: ' + cb.name + '!', 2600); }
}

// ---------- persistence of runs ----------
function saveRun() {
  if (!G || mode === 'dead' || mode === 'win' || mode === 'camp') return;
  try { localStorage.setItem(RUN_KEY, JSON.stringify({ G, mode: mode === 'room' || mode === 'pick' ? 'map' : mode, pend: G.pending || null })); } catch (e) { }
}
function loadRun() { try { return JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) { return null; } }
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveRun(); if (mode === 'room') paused = true; } });
window.addEventListener('pagehide', saveRun);

// ---------- UI ----------
function toast(t, ms = 1600) { TOAST.textContent = t; TOAST.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => TOAST.classList.remove('on'), ms); }
function panel(html) { UI.innerHTML = '<div class="panel">' + html + '</div>'; }
function closeUI() { UI.innerHTML = ''; }
function on(id, f) { const e = document.getElementById(id); if (e) e.onclick = f; }

function showCamp() {
  mode = 'camp'; HUD.classList.add('hidden'); G = G && G.resume ? G : null;
  const saved = loadRun();
  const db = camp.dailyBest[todayKey()];
  panel(`<h1>ASHEN PILGRIM</h1><p class="small">The flame you carry is your life and your coin.</p>
  <p>🔥 <b style="color:#ffcf85">${camp.embers}</b> embers at camp</p>
  ${saved ? '<button class="btn" id="cont">Continue run (room ' + (saved.G.step + 1) + ')</button>' : ''}
  <button class="btn" id="go">Descend as The Pilgrim 🕯</button>
  <button class="btn" id="goW" ${camp.witch ? '' : 'disabled'}>Descend as the Lantern Witch 🏮${camp.witch ? '' : ' (locked)'}</button>
  <button class="btn sub" id="daily">☀ Daily seeded run — ${todayKey()}${db ? ' · best ' + db : ''}</button>
  <h2 style="margin-top:12px">The Camp</h2>
  <button class="btn sub" id="unW" ${camp.witch || camp.embers < WITCH_COST ? 'disabled' : ''}>${camp.witch ? '🏮 Lantern Witch unlocked' : '🏮 Unlock Lantern Witch — ' + WITCH_COST + ' embers'}</button>
  <button class="btn sub" id="wick" ${camp.embers < 25 + camp.wick * 15 || camp.wick >= 5 ? 'disabled' : ''}>🕯 Thicker Wick (+10 starting flame) — ${25 + camp.wick * 15} embers · lv ${camp.wick}/5</button>
  <p class="small">Move: joystick / drag · WASD. Attacks are automatic. Dodge: button / Space. Skill: button / E.</p>`);
  on('cont', () => { const s = loadRun(); G = s.G; G.map = G.map || genMap(); showMap(); });
  on('go', () => { clearRun(); newRun('pilgrim', false); });
  on('goW', () => { clearRun(); newRun('witch', false); });
  on('daily', () => { clearRun(); classPickDaily(); });
  on('unW', () => { camp.embers -= WITCH_COST; camp.witch = true; saveCamp(); toast('The Lantern Witch joins the camp'); showCamp(); });
  on('wick', () => { camp.embers -= 25 + camp.wick * 15; camp.wick++; saveCamp(); showCamp(); });
}
function classPickDaily() {
  if (!camp.witch) return newRun('pilgrim', true);
  panel(`<h2>Daily run</h2><button class="btn" id="a">The Pilgrim 🕯</button><button class="btn" id="b">Lantern Witch 🏮</button>`);
  on('a', () => newRun('pilgrim', true)); on('b', () => newRun('witch', true));
}

function showMap() {
  mode = 'map'; room = null; HUD.classList.add('hidden'); saveRun();
  const opts = G.map[G.step];
  const crumbs = G.map.map((s, i) => i < G.step ? (DOORS[G.path[i]] || {}).icon || '·' : i === G.step ? '◉' : '·').join(' ');
  panel(`<h2>Floor I — the Drowned Nave</h2><p class="small">${crumbs}</p>
  <p>Flame ${Math.ceil(G.flame)}/${G.maxFlame}${G.curses.length ? ' · ' + G.curses.map(c => CURSES.find(x => x.id === c).icon).join('') : ''}</p>
  <p class="small">Choose a door</p><div class="cards">${opts.map((d, i) => `<button class="card" id="door${i}" data-door="${d}"><span class="ic">${DOORS[d].icon}</span><div><b>${DOORS[d].name}</b><span>${DOORS[d].desc}</span></div></button>`).join('')}</div>
  <button class="btn sub" id="relics">Relics (${Object.keys(G.relics).length})</button><button class="btn sub" id="quit">Abandon run</button>`);
  opts.forEach((d, i) => on('door' + i, () => enterDoor(d)));
  on('relics', showRelics);
  on('quit', () => die(true));
}
function showRelics(back) {
  const list = Object.entries(G.relics).map(([k, n]) => `<div class="card"><span class="ic">${RELICS[k].icon}</span><div><b>${RELICS[k].name} ×${n}</b><span>${RELICS[k].desc}</span></div></div>`)
    .concat(G.combos.map(id => { const c = COMBOS.find(x => x.id === id); return `<div class="card gild"><span class="ic">${c.icon}</span><div><b>${c.name}</b><span>${c.desc}</span></div></div>`; }))
    .concat(G.curses.map(id => { const c = CURSES.find(x => x.id === id); return `<div class="card curse"><span class="ic">${c.icon}</span><div><b>${c.name}</b><span>${c.desc}</span></div></div>`; }));
  panel(`<h2>Relics</h2><div class="cards">${list.join('') || '<p>None yet.</p>'}</div><p class="small">Combos: ${COMBOS.map(c => RELICS[c.a].icon + '+' + RELICS[c.b].icon + '=' + c.icon).join(' · ')}</p><button class="btn" id="bk">Back</button>`);
  on('bk', () => mode === 'room' ? (closeUI(), paused = false) : showMap());
}

function enterDoor(d) {
  G.path[G.step] = d; G.pending = d; stepRng(d);
  if (d === 'fight' || d === 'elite' || d === 'boss') return startRoom(d);
  if (d === 'shrine') return shrine();
  if (d === 'merchant') return merchant();
  if (d === 'treasure') return treasure();
}
function advance() { G.pending = null; G.step++; showMap(); }

function relicChoices(n = 3) {
  const ids = Object.keys(RELICS), out = [];
  // bias toward combo partners
  while (out.length < n) { const id = pick(ids); if (!out.includes(id)) out.push(id); }
  return out;
}
function relicPick(reason) {
  mode = 'pick'; HUD.classList.add('hidden');
  const ch = relicChoices(3), gild = G.curses.length > 0;
  const gildIdx = gild ? Math.floor(rnd(3)) : -1;
  panel(`<h2>${reason || 'Choose a relic'}</h2>${gild ? '<p class="small">Your curses gild one relic (double strength)</p>' : ''}<div class="cards">${ch.map((id, i) => {
    const r = RELICS[id], cb = COMBOS.find(c => (c.a === id && has(c.b)) || (c.b === id && has(c.a)));
    return `<button class="card ${i === gildIdx ? 'gild' : ''}" id="rel${i}"><span class="ic">${r.icon}</span><div><b>${r.name}${i === gildIdx ? ' ✦ gilded' : ''}${G.relics[id] ? ' (×' + (G.relics[id] + 1) + ')' : ''}</b><span>${r.desc}${cb && !combo(cb.id) ? ' <b style="display:inline;color:#ffb347">→ completes ' + cb.name + '!</b>' : ''}</span></div></button>`;
  }).join('')}</div>`);
  ch.forEach((id, i) => on('rel' + i, () => { addRelic(id, i === gildIdx ? 2 : 1); toast(RELICS[id].icon + ' ' + RELICS[id].name); advance(); }));
}
function shrine() {
  mode = 'pick';
  const heal = Math.round(G.maxFlame * 0.35);
  panel(`<h2>⛪ Forgotten Shrine</h2><p>Candles gutter before a faceless saint.</p>
  <button class="btn" id="rest">Rest — restore ${heal} flame</button>
  <button class="btn" id="pray">Pray — +15% damage, lose 10 max flame</button>`);
  on('rest', () => { G.flame = Math.min(G.maxFlame, G.flame + heal); advance(); });
  on('pray', () => { G.dmgBonus += 0.15; G.maxFlame -= 10; G.flame = Math.min(G.flame, G.maxFlame); advance(); });
}
function merchant() {
  mode = 'pick';
  const ch = relicChoices(3), prices = ch.map(() => Math.round(rnd(18, 30)));
  const draw = () => {
    panel(`<h2>⚖ The Ash Merchant</h2><p>"Your flame for my wares, pilgrim. Burn bright… or burn out."</p><p>Flame: <b style="color:#ffcf85">${Math.ceil(G.flame)}</b>/${G.maxFlame}</p><div class="cards">${ch.map((id, i) => id ? `<button class="card" id="buy${i}" ${G.flame <= prices[i] ? 'disabled' : ''}><span class="ic">${RELICS[id].icon}</span><div><b>${RELICS[id].name} — ${prices[i]} 🔥</b><span>${RELICS[id].desc}</span></div></button>` : '').join('')}
    <button class="card" id="buyR" ${G.flame <= 15 ? 'disabled' : ''}><span class="ic">⚔</span><div><b>Whetted Faith — 15 🔥</b><span>+12% attack speed.</span></div></button></div><button class="btn" id="leave">Leave</button>`);
    ch.forEach((id, i) => id && on('buy' + i, () => { G.flame -= prices[i]; addRelic(id); ch[i] = null; draw(); }));
    on('buyR', () => { G.flame -= 15; G.rateBonus += 0.12; draw(); });
    on('leave', advance);
  };
  draw();
}
function treasure() {
  mode = 'pick';
  const avail = CURSES.filter(c => !curse(c.id));
  const cs = avail.length ? pick(avail) : null;
  panel(`<h2>⚰ Cursed Reliquary</h2><p>A coffin chained shut. Something inside hums with power.</p>
  ${cs ? `<div class="card curse"><span class="ic">${cs.icon}</span><div><b>${cs.name}</b><span>${cs.desc} Embers +50%, and relic picks offer a gilded relic.</span></div></div><button class="btn" id="take">Accept the curse — take a relic</button>` : ''}
  <button class="btn sub" id="leave">Leave it sealed</button>`);
  on('take', () => { G.curses.push(cs.id); toast(cs.icon + ' ' + cs.name); relicPick('The reliquary opens'); });
  on('leave', advance);
}

function die(abandon) {
  mode = 'dead'; HUD.classList.add('hidden'); clearRun();
  const gained = Math.floor(G.embersRun);
  camp.embers += gained; camp.total += gained; camp.best = Math.max(camp.best, G.step);
  if (G.daily) { const k = todayKey(); camp.dailyBest[k] = Math.max(camp.dailyBest[k] || 0, G.step); }
  saveCamp();
  panel(`<h1>${abandon ? 'ABANDONED' : 'THE FLAME DIES'}</h1><p>You reached room ${G.step + 1} of ${G.map.length} and slew ${G.kills}.</p>
  <p>🔥 ${gained} embers carried back to camp.</p>${!camp.witch && camp.embers >= WITCH_COST ? '<p style="color:#ffb347">You can now unlock the Lantern Witch!</p>' : ''}<button class="btn" id="camp">Return to camp</button>`);
  on('camp', () => { G = null; showCamp(); });
}
function win() {
  mode = 'win'; HUD.classList.add('hidden'); clearRun();
  const gained = Math.floor(G.embersRun + 40 * stats().loot);
  camp.embers += gained; camp.total += gained; camp.best = Math.max(camp.best, G.map.length);
  if (G.daily) { const k = todayKey(); camp.dailyBest[k] = Math.max(camp.dailyBest[k] || 0, G.map.length); }
  saveCamp();
  panel(`<h1>FLOOR CLEARED</h1><p>The Bell-Warden falls silent. Deeper floors await (coming soon).</p><p>🔥 ${gained} embers carried back to camp.</p><button class="btn" id="camp">Return to camp</button>`);
  on('camp', () => { G = null; showCamp(); });
}

// ---------- combat ----------
function arena() { const m = 18, top = Math.max(70, H * 0.12); return { x0: m, y0: top, x1: W - m, y1: H - m }; }
function startRoom(kind) {
  mode = 'room'; paused = false; closeUI(); HUD.classList.remove('hidden');
  const A = arena();
  room = { kind, t: 0, foes: [], shots: [], eshots: [], parts: [], drops: [], waves: [], wisps: [], fxs: [], done: false, doneT: 0 };
  P.x = (A.x0 + A.x1) / 2; P.y = A.y1 - 60; P.vx = P.vy = 0; P.inv = 1; P.dodgeT = 0; P.skillCd = 0; P.dodgeCd = 0; P.shield = 0;
  const leg = curse('legion') ? 1.4 : 1, tier = 1 + G.step * 0.12;
  if (kind === 'boss') { spawn('warden', (A.x0 + A.x1) / 2, A.y0 + 90, tier); room.spawnLeft = 0; }
  else {
    const n = Math.round((5 + G.step * 1.3) * leg);
    room.waves = [Math.ceil(n * 0.55), Math.floor(n * 0.45)];
    room.kindsPool = G.step < 1 ? ['husk', 'husk', 'bat'] : ['husk', 'husk', 'bat', 'cultist'];
    if (kind === 'elite') room.elite = true;
    nextWave();
  }
  toast(kind === 'boss' ? '🔔 THE BELL-WARDEN' : kind === 'elite' ? '💀 An elite stirs' : '⚔ The hollow rise', 1400);
}
function nextWave() {
  const A = arena(), tier = 1 + G.step * 0.12, n = room.waves.shift();
  for (let i = 0; i < n; i++) {
    const side = Math.floor(rnd(3));
    const x = side === 0 ? rnd(A.x0 + 20, A.x1 - 20) : side === 1 ? A.x0 + 20 : A.x1 - 20;
    const y = side === 0 ? A.y0 + 20 : rnd(A.y0 + 20, (A.y0 + A.y1) / 2);
    spawn(pick(room.kindsPool), x, y, tier);
  }
  if (room.elite && room.waves.length === 0) { spawn('husk', (A.x0 + A.x1) / 2, A.y0 + 40, tier, true); }
}
const FOES = {
  husk: { hp: 30, spd: 48, r: 14, dmg: 10, ember: 3 },
  bat: { hp: 16, spd: 105, r: 11, dmg: 6, ember: 2 },
  cultist: { hp: 24, spd: 38, r: 13, dmg: 8, ember: 4, ranged: true },
  warden: { hp: 650, spd: 34, r: 34, dmg: 18, ember: 30, boss: true },
};
function spawn(type, x, y, tier, elite) {
  const f = FOES[type], hpm = (curse('iron') ? 1.4 : 1) * tier * (elite ? 7 : 1);
  room.foes.push({ type, x, y, hp: f.hp * hpm, max: f.hp * hpm, spd: f.spd * (elite ? 0.85 : 1), r: f.r * (elite ? 1.8 : 1), dmg: f.dmg * (curse('wrath') ? 1.35 : 1) * (elite ? 1.6 : 1), elite: !!elite, boss: !!f.boss, ember: f.ember * (elite ? 6 : 1), burn: 0, hit: 0, t: fx() * 9, atk: rnd(1, 2.5), kx: 0, ky: 0, spawnT: 0.5, phase: 0 });
}
function nearestFoe(x, y, skip) { let b = null, bd = 1e9; for (const f of room.foes) { if (f.spawnT > 0 || (skip && skip.includes(f))) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; b = f; } } return b; }
function fire() {
  const s = stats(), t = nearestFoe(P.x, P.y); if (!t) return;
  const a = Math.atan2(t.y - P.y, t.x - P.x); P.face = a;
  for (let i = 0; i < s.shots; i++) {
    const off = (i - (s.shots - 1) / 2) * 0.16;
    const sp = G.cls === 'witch' ? 420 : 340;
    room.shots.push({ x: P.x + Math.cos(a) * 14, y: P.y - 10 + Math.sin(a) * 14, vx: Math.cos(a + off) * sp, vy: Math.sin(a + off) * sp, life: 1.2, chain: (G.relics.chain || 0) + (combo('storm') ? 1 : 0), pierce: combo('volley') ? 2 : 0, hitList: [] });
  }
}
function hurtFoe(f, dmg, kx = 0, ky = 0, src) {
  const s = stats(); let crit = fx() < s.crit; if (crit) dmg *= 2;
  f.hp -= dmg; f.hit = 0.12; if (!f.boss) { f.kx += kx; f.ky += ky; }
  if (has('fire') && src === 'shot') f.burn = Math.max(f.burn, 2.5);
  for (let i = 0; i < (crit ? 6 : 3); i++) room.parts.push({ x: f.x, y: f.y, vx: (fx() - .5) * 160, vy: (fx() - .5) * 160, life: .4, c: crit ? '#ffe08a' : '#7a6a4a', s: 2 });
  if (f.hp <= 0 && !f.dead) killFoe(f);
}
function killFoe(f) {
  f.dead = true; G.kills++;
  const n = Math.max(1, Math.round(f.ember * stats().loot / 2));
  for (let i = 0; i < n; i++) room.drops.push({ x: f.x + (fx() - .5) * 20, y: f.y + (fx() - .5) * 20, vx: (fx() - .5) * 120, vy: (fx() - .5) * 120, v: 2, t: 0 });
  for (let i = 0; i < 14; i++) room.parts.push({ x: f.x, y: f.y, vx: (fx() - .5) * 220, vy: (fx() - .5) * 220, life: .6, c: i % 2 ? '#ff8a2a' : '#3a3428', s: 3 });
}
function hurtPlayer(d) {
  if (P.inv > 0 || P.dodgeT > 0) return;
  if (P.shield > 0) { P.shield = 0; P.inv = 0.5; toast('🛡 Blocked'); return; }
  G.flame -= d * stats().armor; P.inv = 0.7; P.hurt = 0.25; shake = 6;
  if (G.flame <= 0) { G.flame = 0; setTimeout(() => die(false), 600); mode = 'dying'; }
}
function dodge() {
  if (mode !== 'room' || P.dodgeCd > 0 || paused) return;
  let dx = input.dx, dy = input.dy; if (!dx && !dy) { dx = Math.cos(P.face); dy = Math.sin(P.face); }
  const l = Math.hypot(dx, dy) || 1; P.vx = dx / l * 520; P.vy = dy / l * 520; P.dodgeT = 0.22; P.dodgeCd = stats().dodgeCd;
  if (has('bell')) { const R = combo('dirge') ? 150 : 85; room.fxs.push({ type: 'ring', x: P.x, y: P.y, r: 10, R, life: .4, c: '#e9d7a8' }); for (const f of room.foes) if (Math.hypot(f.x - P.x, f.y - P.y) < R) hurtFoe(f, 14 * G.relics.bell, (f.x - P.x) * 2, (f.y - P.y) * 2); if (combo('dirge')) P.shield = 1; }
}
function skill() {
  if (mode !== 'room' || P.skillCd > 0 || paused) return;
  P.skillCd = G.cls === 'witch' ? 9 : 7;
  if (G.cls === 'witch') { room.wisps = [0, 1, 2].map(i => ({ a: i * TAU / 3, life: 6 })); toast('Wisps'); }
  else {
    room.fxs.push({ type: 'ring', x: P.x, y: P.y, r: 10, R: 140, life: .5, c: '#ff9a3a' }); shake = 8;
    for (const f of room.foes) { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < 140) hurtFoe(f, 30 + stats().dmg, (f.x - P.x) / d * 260, (f.y - P.y) / d * 260); }
    for (let i = 0; i < 40; i++) { const a = fx() * TAU; room.parts.push({ x: P.x, y: P.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: .5, c: '#ffb347', s: 3 }); }
  }
}
let shake = 0;
function update(dt) {
  if (mode !== 'room' && mode !== 'dying') return;
  if (paused) return;
  const A = arena(), s = stats(); room.t += dt;
  // player
  P.inv = Math.max(0, P.inv - dt); P.hurt = Math.max(0, P.hurt - dt); P.dodgeCd = Math.max(0, P.dodgeCd - dt); P.skillCd = Math.max(0, P.skillCd - dt);
  if (P.dodgeT > 0) { P.dodgeT -= dt; room.parts.push({ x: P.x, y: P.y - 8, vx: 0, vy: 0, life: .25, c: '#ff8a2a55', s: 9 }); }
  else if (mode === 'room') { let dx = input.dx, dy = input.dy; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } P.vx = dx * s.speed; P.vy = dy * s.speed; if (l > .1) { P.walk += dt * 10; if (!nearestFoe(P.x, P.y)) P.face = Math.atan2(dy, dx); } }
  else { P.vx = P.vy = 0; }
  P.x = clamp(P.x + P.vx * dt, A.x0 + P.r, A.x1 - P.r); P.y = clamp(P.y + P.vy * dt, A.y0 + P.r + 10, A.y1 - P.r);
  P.fireT -= dt; if (P.fireT <= 0 && mode === 'room' && room.foes.length) { fire(); P.fireT = s.rate; }
  // wisps
  for (const w of room.wisps) { w.life -= dt; w.a += dt * 3.2; w.x = P.x + Math.cos(w.a) * 46; w.y = P.y - 8 + Math.sin(w.a) * 46; for (const f of room.foes) if (Math.hypot(f.x - w.x, f.y - w.y) < f.r + 8 && (f.wt || 0) <= 0) { hurtFoe(f, s.dmg * 1.2); f.burn = 2; f.wt = 0.3; } }
  room.wisps = room.wisps.filter(w => w.life > 0);
  // shots
  for (const b of room.shots) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (fx() < .5) room.parts.push({ x: b.x, y: b.y, vx: (fx() - .5) * 30, vy: (fx() - .5) * 30, life: .25, c: G.cls === 'witch' ? '#b8f0ff' : '#ffb347', s: 2 });
    for (const f of room.foes) {
      if (f.dead || f.spawnT > 0 || b.hitList.includes(f) || Math.hypot(f.x - b.x, f.y - b.y) > f.r + 5) continue;
      b.hitList.push(f); hurtFoe(f, s.dmg, b.vx * .15, b.vy * .15, 'shot');
      if (b.chain > 0) { const n = nearestFoe(f.x, f.y, b.hitList); if (n && Math.hypot(n.x - f.x, n.y - f.y) < 180) { b.chain--; room.fxs.push({ type: 'bolt', x: f.x, y: f.y, x2: n.x, y2: n.y, life: .18, storm: combo('storm') }); b.hitList.push(n); hurtFoe(n, s.dmg * 0.7, 0, 0, 'chain'); if (combo('storm')) n.burn = 3; } }
      if (b.pierce > 0) b.pierce--; else b.life = 0;
      break;
    }
  }
  room.shots = room.shots.filter(b => b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
  // foes
  for (const f of room.foes) {
    f.t += dt; f.hit = Math.max(0, f.hit - dt); f.wt = (f.wt || 0) - dt;
    if (f.spawnT > 0) { f.spawnT -= dt; continue; }
    if (f.burn > 0) { f.burn -= dt; f.hp -= 6 * dt * (combo('storm') ? 1.6 : 1); if (fx() < .3) room.parts.push({ x: f.x + (fx() - .5) * f.r, y: f.y - f.r * .5, vx: 0, vy: -40, life: .4, c: '#ff7a1a', s: 2 }); if (f.hp <= 0 && !f.dead) killFoe(f); }
    const dx = P.x - f.x, dy = P.y - f.y, d = Math.hypot(dx, dy) || 1;
    let sp = f.spd;
    if (FOES[f.type].ranged) { if (d < 160) sp = -f.spd; else if (d < 240) sp = 0; f.atk -= dt; if (f.atk <= 0 && d < 380) { f.atk = rnd(1.8, 2.8); const a = Math.atan2(dy, dx); room.eshots.push({ x: f.x, y: f.y - 10, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 3, dmg: f.dmg }); } }
    if (f.type === 'bat') { sp *= 1 + .3 * Math.sin(f.t * 4); }
    if (f.boss) bossAI(f, dt, d, dx, dy);
    f.x += (dx / d * sp + f.kx) * dt; f.y += (dy / d * sp + f.ky) * dt + (f.type === 'bat' ? Math.sin(f.t * 7) * 30 * dt : 0);
    f.kx *= .86; f.ky *= .86;
    f.x = clamp(f.x, A.x0 + f.r, A.x1 - f.r); f.y = clamp(f.y, A.y0 + f.r, A.y1 - f.r);
    if (d < f.r + P.r) hurtPlayer(f.dmg);
  }
  // separation
  for (let i = 0; i < room.foes.length; i++) for (let j = i + 1; j < room.foes.length; j++) { const a = room.foes[i], b = room.foes[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r; if (d < m && d > 0) { const p = (m - d) / 2 / d; if (!a.boss) { a.x -= dx * p; a.y -= dy * p; } if (!b.boss) { b.x += dx * p; b.y += dy * p; } } }
  room.foes = room.foes.filter(f => !f.dead);
  // enemy shots
  for (const b of room.eshots) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (Math.hypot(b.x - P.x, b.y - (P.y - 8)) < P.r + 5) { hurtPlayer(b.dmg); b.life = 0; } }
  room.eshots = room.eshots.filter(b => b.life > 0 && b.x > A.x0 && b.x < A.x1 && b.y > A.y0 && b.y < A.y1);
  // drops: embers heal flame & add to run embers
  for (const e of room.drops) {
    e.t += dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= .9; e.vy *= .9;
    const d = Math.hypot(P.x - e.x, P.y - e.y);
    if (e.t > .4 && (d < 90 || room.done)) { e.x += (P.x - e.x) / d * 420 * dt; e.y += (P.y - e.y) / d * 420 * dt; }
    if (d < 16) { e.got = true; G.embersRun += 1; G.flame = Math.min(G.maxFlame, G.flame + 1.2); }
  }
  room.drops = room.drops.filter(e => !e.got);
  // particles & fx
  for (const p of room.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; p.life -= dt; }
  room.parts = room.parts.filter(p => p.life > 0); if (room.parts.length > 500) room.parts.splice(0, room.parts.length - 500);
  for (const f of room.fxs) { f.life -= dt; if (f.type === 'ring') f.r += (f.R - f.r) * Math.min(1, dt * 12); }
  room.fxs = room.fxs.filter(f => f.life > 0);
  // waves / clear
  if (!room.done && room.foes.length === 0 && mode === 'room') {
    if (room.waves.length) nextWave();
    else { room.done = true; room.doneT = 0; toast(room.kind === 'boss' ? 'The bell is silenced' : 'Room cleared'); }
  }
  if (room.done) { room.doneT += dt; if (room.doneT > 1.2 && room.drops.length === 0) { const k = room.kind; room = null; HUD.classList.add('hidden'); if (k === 'boss') win(); else relicPick(k === 'elite' ? 'Elite slain — choose a relic' : 'Choose a relic'); } }
}
function bossAI(f, dt, d, dx, dy) {
  const hpF = f.hp / f.max;
  if (hpF < .5 && f.phase === 0) { f.phase = 1; toast('The Warden tolls in fury'); shake = 10; }
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
addEventListener('keydown', e => { input.keys[e.code] = true; if (e.code === 'Space') { dodge(); e.preventDefault(); } if (e.code === 'KeyE') skill(); if (e.code === 'Escape' && mode === 'room') togglePause(); keyDir(); });
addEventListener('keyup', e => { input.keys[e.code] = false; keyDir(); });
function keyDir() { const k = input.keys; if (input.stick) return; input.dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0); input.dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0); }
cv.addEventListener('pointerdown', e => { if (mode !== 'room') return; input.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { const s = input.stick; if (!s || s.id !== e.pointerId) return; let dx = e.clientX - s.ox, dy = e.clientY - s.oy; const l = Math.hypot(dx, dy), M = 50; if (l > M) { s.ox += dx * (1 - M / l); s.oy += dy * (1 - M / l); dx = e.clientX - s.ox; dy = e.clientY - s.oy; } s.x = e.clientX; s.y = e.clientY; input.dx = dx / M; input.dy = dy / M; });
const endStick = e => { if (input.stick && input.stick.id === e.pointerId) { input.stick = null; input.dx = input.dy = 0; keyDir(); } };
cv.addEventListener('pointerup', endStick); cv.addEventListener('pointercancel', endStick);
const bindBtn = (id, f) => document.getElementById(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); f(); });
bindBtn('dodgeBtn', dodge); bindBtn('skillBtn', skill); bindBtn('menuBtn', togglePause);
function togglePause() {
  if (mode !== 'room') return;
  paused = !paused;
  if (!paused) return closeUI();
  panel(`<h2>Paused</h2><button class="btn" id="res">Resume</button><button class="btn sub" id="rel">Relics</button><button class="btn sub" id="ab">Abandon run</button>`);
  on('res', togglePause); on('rel', showRelics); on('ab', () => { closeUI(); room = null; die(true); });
}

// ---------- art ----------
let bg = null;
function buildBG() {
  bg = document.createElement('canvas'); bg.width = W * DPR; bg.height = H * DPR;
  const g = bg.getContext('2d'); g.scale(DPR, DPR);
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
function braziers() { const A = arena(); return [[A.x0 + 40, A.y0 + 30], [A.x1 - 40, A.y0 + 30], [A.x0 + 40, A.y1 - 70], [A.x1 - 40, A.y1 - 70]]; }
function drawBrazier(x, y, t) {
  const gl = cx.createRadialGradient(x, y - 14, 2, x, y - 14, 110); gl.addColorStop(0, 'rgba(255,140,40,.32)'); gl.addColorStop(1, 'rgba(255,100,20,0)'); cx.fillStyle = gl; cx.fillRect(x - 110, y - 124, 220, 220);
  cx.fillStyle = '#2a241a'; cx.fillRect(x - 2, y - 4, 4, 16); cx.fillRect(x - 9, y + 10, 18, 4);
  cx.fillStyle = '#4a3a24'; cx.beginPath(); cx.moveTo(x - 12, y - 8); cx.lineTo(x + 12, y - 8); cx.lineTo(x + 7, y); cx.lineTo(x - 7, y); cx.fill();
  for (let i = 0; i < 3; i++) { const h = 14 + Math.sin(t * 9 + i * 2) * 4; cx.fillStyle = ['#ff6a1a', '#ffa030', '#ffe08a'][i]; cx.beginPath(); cx.moveTo(x - 9 + i * 3, y - 8); cx.quadraticCurveTo(x, y - 8 - h * (1 - i * .25) * 1.4, x + 9 - i * 3, y - 8); cx.fill(); }
  if (fx() < .15 && room) room.parts.push({ x: x + (fx() - .5) * 10, y: y - 18, vx: (fx() - .5) * 20, vy: -40 - fx() * 40, life: .9, c: '#ffb347', s: 1.5 });
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
let titleT = 0;
const ambient = [];
function render(t) {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!bg) buildBG();
  let sx = 0, sy = 0; if (shake > 0) { sx = (fx() - .5) * shake; sy = (fx() - .5) * shake; shake = Math.max(0, shake - .5); }
  cx.save(); cx.translate(sx, sy);
  cx.drawImage(bg, 0, 0, W, H);
  for (const [x, y] of braziers()) drawBrazier(x, y, t);
  if (room) {
    for (const e of room.drops) { cx.fillStyle = '#ff9a3a'; cx.shadowColor = '#ff7a1a'; cx.shadowBlur = 8; cx.beginPath(); cx.moveTo(e.x, e.y - 5); cx.lineTo(e.x + 3.5, e.y); cx.lineTo(e.x, e.y + 5); cx.lineTo(e.x - 3.5, e.y); cx.fill(); cx.shadowBlur = 0; }
    const ents = room.foes.map(f => ({ y: f.y, d: () => drawFoe(f, t) })); ents.push({ y: P.y, d: () => drawPilgrim(P.x, P.y, t, G.cls, P.inv > 0 && Math.floor(t * 20) % 2 ? .4 : 1) }); ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
    if (P.shield > 0) { cx.strokeStyle = '#e9d7a8aa'; cx.lineWidth = 2; cx.beginPath(); cx.arc(P.x, P.y - 16, 24, 0, TAU); cx.stroke(); }
    for (const b of room.shots) { const w = G.cls === 'witch'; cx.fillStyle = w ? '#b8f0ff' : '#ffcf6a'; cx.shadowColor = w ? '#6ad0ff' : '#ff7a1a'; cx.shadowBlur = 12; cx.beginPath(); cx.arc(b.x, b.y, 4, 0, TAU); cx.fill(); cx.shadowBlur = 0; }
    for (const b of room.eshots) { cx.fillStyle = '#c23a2a'; cx.shadowColor = '#ff2a1a'; cx.shadowBlur = 10; cx.beginPath(); cx.arc(b.x, b.y, 5, 0, TAU); cx.fill(); cx.shadowBlur = 0; }
    for (const w of room.wisps) { cx.fillStyle = '#d8f6ff'; cx.shadowColor = '#7ad8ff'; cx.shadowBlur = 16; cx.beginPath(); cx.arc(w.x, w.y, 6, 0, TAU); cx.fill(); cx.shadowBlur = 0; }
    for (const f of room.fxs) {
      cx.globalAlpha = Math.min(1, f.life * 3);
      if (f.type === 'ring') { cx.strokeStyle = f.c; cx.lineWidth = 3; cx.beginPath(); cx.arc(f.x, f.y - 10, f.r, 0, TAU); cx.stroke(); }
      if (f.type === 'bolt') { cx.strokeStyle = f.storm ? '#cfe8ff' : '#d8b878'; cx.shadowColor = f.storm ? '#6ab0ff' : '#ff9a3a'; cx.shadowBlur = 10; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(f.x, f.y - 12); for (let i = 1; i < 6; i++) { const k = i / 6; cx.lineTo(f.x + (f.x2 - f.x) * k + (fx() - .5) * 14, f.y - 12 + (f.y2 - f.y) * k + (fx() - .5) * 14); } cx.lineTo(f.x2, f.y2 - 12); cx.stroke(); cx.shadowBlur = 0; }
      cx.globalAlpha = 1;
    }
    for (const p of room.parts) { cx.globalAlpha = Math.min(1, p.life * 2.5); cx.fillStyle = p.c; cx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } cx.globalAlpha = 1;
  } else {
    // title/menu backdrop: drifting sparks and a resting pilgrim
    titleT += 1 / 60;
    if (ambient.length < 60) ambient.push({ x: fx() * W, y: H + 10, vy: -20 - fx() * 40, vx: (fx() - .5) * 15, s: 1 + fx() * 2 });
    drawPilgrim(W / 2, H * .82, t, G ? G.cls : 'pilgrim');
  }
  for (const a of ambient) { a.x += a.vx / 60 + Math.sin(t + a.y * .02) * .3; a.y += a.vy / 60; cx.fillStyle = `rgba(255,${130 + a.s * 30 | 0},50,${.5 + Math.sin(t * 5 + a.x) * .3})`; cx.fillRect(a.x, a.y, a.s, a.s); }
  for (let i = ambient.length - 1; i >= 0; i--) if (ambient[i].y < -10) ambient.splice(i, 1);
  cx.restore();
  // fog tint
  cx.fillStyle = 'rgba(40,55,35,.08)'; cx.fillRect(0, 0, W, H);
  if (room && G) drawHUD(t);
  if (input.stick) { const s = input.stick; cx.strokeStyle = 'rgba(255,180,90,.35)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(s.ox, s.oy, 50, 0, TAU); cx.stroke(); cx.fillStyle = 'rgba(255,170,70,.45)'; cx.beginPath(); cx.arc(s.ox + input.dx * 50, s.oy + input.dy * 50, 20, 0, TAU); cx.fill(); }
  if (P.hurt > 0) { cx.fillStyle = `rgba(150,20,10,${P.hurt})`; cx.fillRect(0, 0, W, H); }
}
function drawHUD(t) {
  // minimal: flame bar + embers + room pips
  const x = 14, y = 14 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0), w = Math.min(220, W - 90), f = G.flame / G.maxFlame;
  cx.fillStyle = 'rgba(10,8,6,.7)'; cx.fillRect(x, y, w, 16);
  const g = cx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#a8321e'); g.addColorStop(1, '#ffb347'); cx.fillStyle = g; cx.fillRect(x + 2, y + 2, (w - 4) * f, 12);
  cx.strokeStyle = '#6b4a26'; cx.strokeRect(x, y, w, 16);
  cx.fillStyle = '#ffe9c0'; cx.font = 'bold 11px Georgia'; cx.textBaseline = 'middle'; cx.fillText('🔥 ' + Math.ceil(G.flame) + '/' + G.maxFlame, x + 6, y + 8.5);
  cx.font = '12px Georgia'; cx.fillStyle = '#d6b98c'; cx.fillText('Room ' + (G.step + 1) + '/' + G.map.length + '  ·  ✦ ' + Math.floor(G.embersRun) + (G.curses.length ? '  ·  ' + G.curses.map(c => CURSES.find(x => x.id === c).icon).join('') : ''), x, y + 30);
  document.getElementById('dodgeBtn').classList.toggle('cd', P.dodgeCd > 0); document.getElementById('skillBtn').classList.toggle('cd', P.skillCd > 0);
}

// ---------- loop ----------
function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; bg = null; }
addEventListener('resize', resize); resize();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { update(dt); render(now / 1000); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
showCamp();
requestAnimationFrame(frame);
// test hooks
window.__ashen = { get G() { return G; }, get mode() { return mode; }, get room() { return room; }, P, input, update };
window.__ready = true;
