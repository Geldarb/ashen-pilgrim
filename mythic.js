'use strict';
// Grimoire Ascent — Mythic pages (rarity 5, above Legendary). Black-and-prismatic pages that bend the rules of the run.
// One ✶ mythic slot at the end of a grimoire holds one Mythic page; at most one Mythic is found per run (final boss,
// Endless depth 25+, or the hidden Forbidden Archive). Each Mythic carries a curse while it sits in a mythic slot.
// Engine hooks wrap the Legendary hooks (lgSpawn/lgTick/lgEnd/lgAfterHit/lgWorld/lgPostCast) + buildCast/spawnShot,
// so solo, the editor preview and the co-op host all run the same code; guests only draw + play sounds.
const MYTH_PROJ = ['unwritten', 'godfall', 'worldscar', 'blacksun', 'covenant', 'eclipsechoir'];
const MYTH_GLYPH = ['omnicast', 'sovereign', 'paradox', 'undying', 'ascendantcrown', 'fateunbound'];
const MYTHIC = MYTH_PROJ.concat(MYTH_GLYPH);
const MVB = {}; MYTH_GLYPH.forEach((k, i) => MVB[k] = 1 << i);
// tight performance caps (lower on battery saver / low particles)
const MCAP = { scarB: () => LQ() ? 5 : 10, undying: () => LQ() ? 4 : 6, choirEvery: () => LQ() ? 1.2 : .85, choirShots: 2, omni: () => LQ() ? 6 : 10, absorb: 30, crown: 150, sov: 3, room: 150 };
const MCURSE = {
  noheal: { icon: '🩸', name: 'No healing', desc: 'you cannot heal during fights' },
  foespd: { icon: '💨', name: 'Swift foes', desc: 'enemies move 25% faster' },
  foehp: { icon: '🛡', name: 'Hardened foes', desc: 'enemies have 30% more HP' },
  hurtmore: { icon: '💔', name: 'Frail', desc: 'you take 25% more damage' },
  manadrain: { icon: '🫗', name: 'Mana leak', desc: 'this grimoire regenerates mana 40% slower' },
  eshotfast: { icon: '🏹', name: 'Quickened volleys', desc: 'enemy projectiles fly 30% faster' },
};
const MY = o => Object.assign({ myth: true, rar: 5, notrail: true }, o);
Object.assign(CARDS, {
  unwritten: MY({ t: 'proj', name: 'The Unwritten', icon: '📄', mana: 40, delay: .5, mk: 'unwritten', shape: 'm_unwritten', el: 'Light', col: '#ffffff', lt: '255,255,255', spd: 0, dmg: 1, r: 8, life: .45, curse: 'manadrain',
    desc: 'A blank page that becomes a random Legendary attack every time it is cast (with all of its glyphs).', flav: 'Nothing is written on it yet. Everything could be.' }),
  godfall: MY({ t: 'proj', name: 'Godfall', icon: '👑', mana: 80, delay: 1.2, mk: 'godfall', shape: 'm_godfall', el: 'Shadow', col: '#c8a0ff', lt: '200,160,255', spd: 0, dmg: 34, r: 10, life: .9, curse: 'hurtmore',
    desc: "This floor's boss rises as a spectral ally and fights for you for 8 seconds, slamming the ground (one at a time).", flav: 'Even kings kneel, eventually. Some kneel to you.' }),
  worldscar: MY({ t: 'proj', name: 'Worldscar', icon: '⚡', mana: 60, delay: .8, mk: 'worldscar', shape: 'm_scar', el: 'Shadow', col: '#e8dcff', lt: '230,220,255', spd: 0, dmg: 6, r: 14, life: 6, curse: 'foespd',
    desc: 'Tears a rift across the whole room for 6s. Every spell of yours that passes through it is cast twice; foes inside it are cut.', flav: 'The world has a seam. You found it.' }),
  blacksun: MY({ t: 'proj', name: 'The Black Sun', icon: '🌑', mana: 70, delay: 1, mk: 'blacksun', shape: 'm_sun', el: 'Shadow', col: '#1a0a2a', lt: '180,120,255', spd: 0, dmg: 60, r: 20, life: 3, curse: 'eshotfast',
    desc: 'A black sun drags in enemies and enemy projectiles for 2.4s, then collapses into a huge blast — 15% stronger for every projectile it swallowed.', flav: 'It does not shine. It takes.' }),
  covenant: MY({ t: 'proj', name: 'Covenant of Ruin', icon: '🩸', mana: 0, delay: 3, mk: 'covenant', shape: 'm_cov', el: 'Fire', col: '#ff2a4a', lt: '255,40,70', spd: 0, dmg: 0, r: 10, life: 1, curse: 'noheal',
    desc: 'Pay 50% of your max flame: every enemy in the room that is not a boss is wiped out.', flav: 'Ruin was always on offer. The price was simply never this honest.' }),
  eclipsechoir: MY({ t: 'proj', name: 'Eclipse Choir', icon: '📚', mana: 90, delay: 1.5, mk: 'eclipsechoir', shape: 'm_choir', el: 'Light', col: '#e8d8ff', lt: '230,215,255', spd: 0, dmg: 1, r: 10, life: 6, curse: 'foehp',
    desc: '5 floating grimoires circle you for 6s, each casting a copy of this grimoire at half damage.', flav: 'Five voices. One hymn. No mercy.' }),
  omnicast: MY({ t: 'mod', name: 'Omnicast', icon: '🌌', mana: 30, curse: 'hurtmore',
    desc: 'Every attack page in the grimoire casts at once with all of its glyphs (up to 10 spells), then a long 2.5s recharge.', flav: 'Why read one page, when you can read the book?' }),
  sovereign: MY({ t: 'mod', name: 'Sovereign', icon: '⚜', mana: 20, curse: 'foespd',
    desc: "For 5s after each cast, this spell's glyphs (up to 3) also apply to every other spell cast — your co-op allies' spells and your other grimoire.", flav: 'Rule is just magic everyone agrees to.' }),
  paradox: MY({ t: 'mod', name: 'Paradox', icon: '☯', mana: 20, curse: 'eshotfast',
    desc: 'Every spell also fires in reverse. When either half first hits, the other half bursts — once.', flav: 'It hit before you cast it. Probably.' }),
  undying: MY({ t: 'mod', name: 'Undying Word', icon: '⚱', mana: 25, curse: 'foehp',
    desc: 'When the spell ends it comes back, again and again, until it has scored 10 kills (at most 6 returns).', flav: 'Speak it once. It keeps speaking.' }),
  ascendantcrown: MY({ t: 'mod', name: 'Ascendant Crown', icon: '💠', mana: 15, curse: 'noheal',
    desc: 'Every kill grants +1% damage to this grimoire for the rest of the run (up to +150%).', flav: 'Each crown is heavier than the last. Wear them all.' }),
  fateunbound: MY({ t: 'mod', name: 'Fate Unbound', icon: '⛓', mana: 25, curse: 'manadrain',
    desc: 'Legendary pages work from any slot of this grimoire, ignoring the gold-slot limit, and every other glyph applies twice.', flav: 'The chains were the only thing keeping it gentle.' }),
});
for (const id of MYTHIC) CARDS[id].id = id;
Object.assign(SHORT, { unwritten: 'Unwritten', godfall: 'Godfall', worldscar: 'Worldscar', blacksun: 'Black Sun', covenant: 'Covenant', eclipsechoir: 'Eclipse', omnicast: 'Omnicast', sovereign: 'Sovereign', paradox: 'Paradox', undying: 'Undying', ascendantcrown: 'Asc. Crown', fateunbound: 'Unbound' });
RAR_NAME[5] = 'mythic';
const myCurseOf = id => id && CARDS[id] && CARDS[id].curse ? MCURSE[CARDS[id].curse] : null;
const myCurseTxt = id => { const c = myCurseOf(id); return c ? `Curse: ${c.icon} ${c.name} — ${c.desc} (while it sits in a mythic slot).` : ''; };
// ---------- the mythic slot ----------
function myIdx(w) { return w && w.myth && w.slots && w.slots.length ? w.slots.length - 1 : -1; }
function myEquipped(w) { const i = myIdx(w), id = i >= 0 ? w.slots[i] : null; return id && CARDS[id] && CARDS[id].myth ? id : null; }
function myAddSlot(w) { if (!w || w.myth) return false; w.myth = 1; w.slots.push(null); return true; }
{ const _b = lgBind; lgBind = function (w) { if (!w || !w.myth) return _b(w); const last = w.slots.pop(); const r = _b(w); w.slots.push(last); return r; }; } // keep the mythic slot last
let MY_FU = null; { const _g = lgGold; lgGold = (w, i) => (MY_FU !== null && w === MY_FU) || _g(w, i); } // Fate Unbound: any slot is "gold" while casting
// editor: Mythic pages only in the ✶ mythic slot; only Mythic pages in it; Fate Unbound lifts the gold-slot rules
{
  const _cm = lgCheckMove;
  lgCheckMove = function (from, to) {
    const w = G.wands[edWand], a = getLoc(from), b = getLoc(to), mi = myIdx(w);
    for (const [loc, id] of [[to, a], [from, b]]) {
      const [k, i] = loc.split(':'); if (k !== 'w') continue; const isM = !!(id && CARDS[id].myth);
      if (+i === mi) { if (id && !isM) return 'mythslot'; } else if (isM) return 'myth';
    }
    const fu = (to === 'w:' + mi ? a : from === 'w:' + mi ? b : myEquipped(w)) === 'fateunbound';
    if (fu) return null;
    return _cm(from, to);
  };
  const _rj = lgReject;
  lgReject = function (loc, why) {
    if (why !== 'myth' && why !== 'mythslot') return _rj(loc, why);
    const w = G.wands[edWand];
    const msg = why === 'myth' ? (w.myth ? 'Mythic pages only fit in the ✶ mythic slot at the end of the grimoire.' : 'Mythic pages need a ✶ mythic slot — this grimoire has none (claiming a Mythic binds one).') : 'Only a Mythic page fits in the ✶ mythic slot.';
    au('lgDeny'); buzz(40); edSel = null; editor();
    const el = UI.querySelector(`[data-loc="${loc}"]`); if (el) { el.classList.add('shake', 'deny'); setTimeout(() => el.classList.remove('shake', 'deny'), 650); }
    UI.querySelectorAll('.slot.myth').forEach(g => { g.classList.add('pulse'); setTimeout(() => g.classList.remove('pulse'), 900); });
    const info = document.getElementById('info'); if (info) info.innerHTML = `<b class="deny">✖ ${msg}</b>`; else toast('✖ ' + msg, 2200);
    window.__lgDenied = (window.__lgDenied || 0) + 1; window.__lgDenyMsg = msg;
  };
}
// ---------- cast engine ----------
{
  const _bc = buildCast;
  buildCast = function (wand) {
    if (!wand || !wand.slots) return _bc(wand);
    const mi = myIdx(wand), eq = myEquipped(wand), s0 = wand.slots, bad = (x, i) => x && CARDS[x] && CARDS[x].myth && (i !== mi || CARDS[x].t === 'mod');
    if (s0.some(bad)) wand.slots = s0.map((x, i) => bad(x, i) ? null : x); // a Mythic outside its slot is inert; Mythic glyphs act grimoire-wide
    MY_FU = eq === 'fateunbound' ? wand : null; let c;
    try { c = _bc(wand); } finally { wand.slots = s0; MY_FU = null; }
    if (!c || !eq || CARDS[eq].t !== 'mod') return c;
    c.mana += CARDS[eq].mana || 0; c.myth = eq;
    if (eq === 'omnicast') {
      const deck = s0.filter((id, i) => id && !bad(id, i) && !(CARDS[id].myth) && CARDS[id].t !== 'sigil' && (!CARDS[id].leg || lgGold(wand, i)));
      const mods = deck.filter(id => CARDS[id].t === 'mod' && id !== 'grimoireecho' && id !== 'martyrdom'), projs = deck.filter(id => CARDS[id].t === 'proj').slice(0, MCAP.omni());
      if (projs.length) {
        const n = projs.length; c.shots = projs.map((p, i) => ({ p, mods: mods.concat('omnicast'), off: (i - (n - 1) / 2) * .14, omni: true }));
        c.mana = Math.round(projs.reduce((a, p) => a + (CARDS[p].mana || 0), 0) * .6 + mods.reduce((a, p) => a + (CARDS[p].mana || 0), 0) * .5) + CARDS.omnicast.mana;
        c.delay += 2.5; c.wrapped = true; c.nextIdx = 0; c.chants = []; c.flame = 0; c.echoCarry = null;
      }
      return c;
    }
    if (eq === 'fateunbound') { const dbl = L => { for (const s of L || []) { s.mods = s.mods.concat(s.mods.filter(q => CARDS[q] && (CARDS[q].t === 'mod' || CARDS[q].t === 'curse'))); dbl(s.payload); } }; dbl(c.shots); }
    for (const s of c.shots) s.mods = s.mods.concat(eq);
    return c;
  };
  // Sovereign: for 5s, other grimoires' spells (co-op allies, your 2nd grimoire) also carry the Sovereign spell's glyphs
  const _ss = spawnShot;
  spawnShot = function (world, spec, x, y, ang) {
    const S = world.sov;
    if (S && S.t > 0 && S.mods.length && world.curWand !== S.wand && !spec.sovd && CARDS[spec.p] && !CARDS[spec.p].myth) { spec = Object.assign({}, spec, { sovd: true, mods: spec.mods.concat(S.mods) }); world.sovN = (world.sovN || 0) + 1; }
    return _ss(world, spec, x, y, ang);
  };
  const _ls = lgSpawn;
  lgSpawn = function (world, s, spec, b, m, ang) {
    const cp = spec.copy; if (b.myth) spec.copy = true; // the Last Page never copies a Mythic
    try { _ls(world, s, spec, b, m, ang); } finally { if (b.myth) spec.copy = cp; }
    myMods(world, s, spec, b, m, ang);
    if (b.mk) mySpawnK(world, s, spec, b, ang);
  };
  const _lt = lgTick; lgTick = function (world, s, dt) { if (s.mk) { myTick(world, s, dt); return true; } return _lt(world, s, dt); };
  const _ah = lgAfterHit; lgAfterHit = function (world, s, f, killed, dmg) { _ah(world, s, f, killed, dmg); myAfterHit(world, s, f, killed); };
  const _le = lgEnd; lgEnd = function (world, s) { _le(world, s); myEnd(world, s); };
  const _lw = lgWorld; lgWorld = function (world, dt) { _lw(world, dt); myWorld(world, dt); };
  const _pc = lgPostCast; lgPostCast = function (world, wand, c, x, y) { _pc(world, wand, c, x, y); if (c.myth) lgSnd(world, 'myGlyph', x, c.myth); };
}
function myHolder(world, o) { if (world === room) return !o || o === P ? G : o; return world; }
function myCrownN(world, o) { const h = myHolder(world, o); return h ? Math.min(MCAP.crown, h.myCrown || 0) : 0; }
function myMods(world, s, spec, b, m, ang) {
  let mv = 0; for (const q of spec.mods) if (MVB[q]) mv |= MVB[q]; if (mv) s.mv = mv;
  if (!mv) return;
  const o = s.owner;
  if (m('ascendantcrown')) { s.dmg *= 1 + .01 * myCrownN(world, o); s.crown2 = true; }
  if (m('undying') && !b.mk && !b.lgk) s.und = spec._und || (spec._und = { k: 0, n: 0 });
  if (m('sovereign') && !spec.sovd && !b.mk) { const mods = spec.mods.filter(q => q !== 'sovereign' && !MVB[q] && CARDS[q] && CARDS[q].t === 'mod').slice(0, MCAP.sov); world.sov = { wand: s.wand, mods, t: 5 }; world.sovCasts = (world.sovCasts || 0) + 1; }
  if (m('paradox') && !spec.pdx && !b.mk && !b.lgk && !spec.tfCopy && !spec.recD && !spec.ashD && b.spd > 0 && world.shots.length < LCAP.shots) {
    const pp = { done: false }; s.pp = pp;
    const tw = lgSpawnFrom(world, s, Object.assign({}, spec, { pdx: true }), s.x, s.y, ang + Math.PI);
    if (tw) { tw.pp = pp; tw.pair = s; s.pair = tw; tw.dmg = s.dmg; world.pdxN = (world.pdxN || 0) + 1; }
  }
}
function myAfterHit(world, s, f, killed) {
  if (s.pp && !s.pp.done) {
    s.pp.done = true; const o = s.pair;
    if (o && o.life > 0) { explode(world, o.x, o.y, 46, s.dmg * .8); world.fxs.push({ type: 'm_paradox', x: o.x, y: o.y, x2: s.x, y2: s.y, r: 20, life: .45, c: '#ffffff' }); lgSnd(world, 'myParadox', o.x); world.pdxBursts = (world.pdxBursts || 0) + 1; }
  }
  if (!killed) return;
  if (s.und) s.und.k++;
  if (s.crown2) { const h = myHolder(world, s.owner); if (h) { h.myCrown = Math.min(MCAP.crown, (h.myCrown || 0) + 1); if (h.myCrown % 10 === 0) world.fxs.push({ type: 'ascend', x: f.x, y: f.y - f.r, r: 10, life: .7, c: '#a0f0ff', n: h.myCrown }); } }
}
function myEnd(world, s) {
  const U = s.und; if (!U || s.blocked || s.mk || U.k >= 10 || U.n >= MCAP.undying() || world.shots.length >= LCAP.shots) return;
  U.n++;
  const sp = Object.assign({}, s.spec, { undR: U.n, pdx: true });
  const A = world.bounds, x = A ? clamp(s.x, A.x0 + 6, A.x1 - 6) : s.x, y = A ? clamp(s.y, A.y0 + 6, A.y1 - 6) : s.y, t = nearestFoe(world, x, y);
  const a = t ? Math.atan2(t.y - t.r * .8 - y, t.x - x) : (Math.hypot(s.vx, s.vy) > 1 ? Math.atan2(s.vy, s.vx) + Math.PI : s.ang);
  const n = lgSpawnFrom(world, s, sp, x, y, a); if (!n) return; n.dmg = s.dmg;
  world.undN = (world.undN || 0) + 1; world.fxs.push({ type: 'm_undying', x, y, r: s.r + 10, life: .4, c: '#c8f0ff', n: U.n }); lgSnd(world, 'myUndying', x, String(U.n));
}
// ---------- Mythic attacks ----------
function mySpawnK(world, s, spec, b, ang) {
  const o = s.owner && s.owner.x != null ? s.owner : null, A = world.bounds || { x0: 0, y0: 0, x1: 400, y1: 300 }, tgt = nearestFoe(world, s.x, s.y);
  s.mk = b.mk; s.pierce = 999; s.vx = s.vy = 0; s.grow = 0;
  const mine = k => world.shots.filter(q => q.mk === k && q.owner === s.owner && q !== s && q.life > 0);
  switch (b.mk) {
    case 'unwritten': {
      const pool = LEG_PROJ.filter(k => k !== 'lastpage'), id = pool[Math.min(pool.length - 1, Math.floor(fx() * pool.length))];
      s.became = id; lgSpawnFrom(world, s, Object.assign({}, spec, { p: id, unw: true }), s.x, s.y, ang);
      (world.unwLog || (world.unwLog = [])).push(id); if (world.unwLog.length > 40) world.unwLog.shift();
      world.fxs.push({ type: 'm_ink', x: s.x, y: s.y, r: 16, life: .55, c: '#ffffff', txt: CARDS[id].icon }); lgSnd(world, 'myUnwritten', s.x); break;
    }
    case 'godfall': {
      const al = world.allies || (world.allies = []); for (const a of al) if (a.god && a.owner === s.owner) a.life = Math.min(a.life, .3);
      const c = o || { x: s.x, y: s.y }, x = clamp(c.x + 44, A.x0 + 30, A.x1 - 30), y = clamp(c.y - 6, A.y0 + 30, A.y1 - 16);
      al.push({ id: ++LID, god: 1, x, y, r: 22, hp: 9999, max: 9999, life: 8, raise: .6, atkT: .5, face: 1, walk: 0, dmg: s.dmg, owner: s.owner, slamT: 1 });
      s.x = x; s.y = y; world.godN = (world.godN || 0) + 1;
      world.fxs.push({ type: 'm_rise', x, y, r: 40, life: .9, c: '#c8a0ff' }); lgSnd(world, 'myGodfall', x); break;
    }
    case 'worldscar': {
      for (const q of mine('worldscar')) q.life = Math.min(q.life, .3);
      const c = o || { x: s.x }, tx = tgt ? tgt.x : s.x + Math.cos(ang) * 160;
      s.x = clamp((c.x + tx) / 2, A.x0 + 20, A.x1 - 20); s.y = (A.y0 + A.y1) / 2; s.ht = .5; lgSnd(world, 'myScar', s.x); break;
    }
    case 'blacksun': {
      for (const q of mine('blacksun')) q.life = Math.min(q.life, .2);
      const tx = tgt ? tgt.x : s.x + Math.cos(ang) * 150, ty = tgt ? tgt.y - tgt.r : s.y + Math.sin(ang) * 150;
      s.x = clamp(tx, A.x0 + 30, A.x1 - 30); s.y = clamp(ty, A.y0 + 30, A.y1 - 20); s.absorb = 0; s.collapsed = false; lgSnd(world, 'mySunPull', s.x); break;
    }
    case 'covenant': {
      if (world === room && !room.guest) { if (!s.owner || s.owner === P) { if (G) G.flame = Math.max(1, G.flame - G.maxFlame * .5); } else if (s.owner.hp != null && s.owner.maxHp) s.owner.hp = Math.max(1, s.owner.hp - s.owner.maxHp * .5); }
      let n = 0;
      for (const f of world.foes) {
        if (f.dead || f.boss || f.spawnT > 0) continue;
        if (f.dummy) { hurtFoe(world, f, 999); continue; }
        world.fxs.push({ type: 'm_ruin', x: f.x, y: f.y, r: f.r + 8, life: .6, c: '#ff2a4a' }); killFoe(world, f); n++;
      }
      s.wiped = n; world.covN = (world.covN || 0) + n; if (o) { s.x = o.x; s.y = o.y; }
      if (world === room) { shake = Math.max(shake, 14); impact(.15); }
      lgSnd(world, 'myCovenant', s.x); break;
    }
    case 'eclipsechoir': {
      for (const q of mine('eclipsechoir')) q.life = 0;
      s.books = [0, 1, 2, 3, 4].map(i => ({ t: .35 + i * .17 })); s.cidx = 0; if (o) { s.x = o.x; s.y = o.y - 20; } lgSnd(world, 'myChoir', s.x); break;
    }
  }
}
function myTick(world, s, dt) {
  const o = s.owner && s.owner.x != null ? s.owner : null;
  switch (s.mk) {
    case 'unwritten': case 'godfall': s.grow = Math.min(1, s.age / .4); return;
    case 'covenant': s.grow = Math.min(1, s.age); if (o) { s.x = o.x; s.y = o.y; } return;
    case 'worldscar': {
      s.grow = Math.round(Math.min(1, s.age / .3) * Math.min(1, Math.max(0, s.life) / .4) * 100) / 100;
      if ((s.ht -= dt) <= 0) { s.ht = .5; for (const f of world.foes) if (!f.dead && f.spawnT <= 0 && Math.abs(f.x - s.x) < 14 + f.r) { s.hit.length = 0; onHit(world, s, f); } }
      for (const q of world.shots) {
        if (q === s || q.mk || q._sc === s || q.life <= 0 || (q.spec && q.spec.scar) || q.novaR !== undefined || q.orbit || q.groundY !== undefined) continue;
        const sp = Math.abs(q.vx); if (sp < 30 || Math.abs(q.x - s.x) > 6 + q.r + sp * dt) continue;
        q._sc = s; if ((world.scarB == null ? 10 : world.scarB) < 1 || world.shots.length >= LCAP.shots) continue;
        world.scarB = (world.scarB == null ? 10 : world.scarB) - 1;
        const c = lgSpawnFrom(world, q, Object.assign({}, q.spec, { scar: true, pdx: true }), q.x, q.y, Math.atan2(q.vy, q.vx) + (fx() < .5 ? .2 : -.2));
        if (c) { c._sc = s; c.dmg = q.dmg; world.scarN = (world.scarN || 0) + 1; }
        world.fxs.push({ type: 'm_scarflash', x: s.x, y: q.y, r: 10, life: .25, c: '#ffffff' });
      }
      return;
    }
    case 'blacksun': {
      if (s.collapsed) { s.grow = Math.round((1 + (.5 - Math.max(0, s.life)) * 2) * 100) / 100; return; }
      s.grow = Math.round(Math.min(1, s.age / 2.4) * 100) / 100;
      if (!world.guest) {
        for (const f of world.foes) { if (f.dead || f.dummy) continue; const dx = s.x - f.x, dy = s.y - f.y, d = Math.hypot(dx, dy) || 1; if (d < 230 && d > 10) { const k = (f.boss ? 35 : 170) * dt; f.x += dx / d * k; f.y += dy / d * k; } }
        if (world === room && room.eshots) for (const e of room.eshots) { if (e.life <= 0) continue; const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1; if (d < 24) { e.life = 0; if (s.absorb < MCAP.absorb) s.absorb++; world.fxs.push({ type: 'm_scarflash', x: s.x, y: s.y, r: 6, life: .2, c: '#b080ff' }); } else if (d < 210) { e.vx += dx / d * 900 * dt; e.vy += dy / d * 900 * dt; } }
      }
      if (s.age >= 2.4) {
        s.collapsed = true; s.life = .5; const R = 140, dm = s.dmg * (1 + .15 * s.absorb);
        explode(world, s.x, s.y, R, dm); world.fxs.push({ type: 'm_collapse', x: s.x, y: s.y, r: R, life: .6, c: '#ffffff' });
        if (world === room) { shake = Math.max(shake, 16); impact(.12); }
        world.sunBooms = (world.sunBooms || 0) + 1; world.lastSun = { absorb: s.absorb, dmg: Math.round(dm) }; lgSnd(world, 'mySunBoom', s.x);
      }
      return;
    }
    case 'eclipsechoir': {
      if (o) { s.x = o.x; s.y = o.y - 20; if (o.down) { s.life = 0; return; } }
      s.grow = Math.round(Math.min(1, s.age / .4) * Math.min(1, Math.max(0, s.life) / .4) * 100) / 100;
      const w = s.wand; if (!w || world.guest) return;
      for (let i = 0; i < 5; i++) {
        const B = s.books[i]; if ((B.t -= dt) > 0) continue; B.t = MCAP.choirEvery();
        if (world.shots.length >= LCAP.shots - 6) continue; const t = nearestFoe(world, s.x, s.y); if (!t) continue;
        const q = s.age * 1.6 + i * TAU / 5, bx = s.x + Math.cos(q) * 46, by = s.y + Math.sin(q) * 20;
        const clone = Object.assign({}, w, { slots: w.slots.map(x => x && CARDS[x].myth ? null : x), myth: 0, idx: s.cidx || 0, _echo: null });
        const c = buildCast(clone); if (!c || !c.shots.length) continue; s.cidx = c.nextIdx;
        const a = Math.atan2(t.y - t.r * .8 - by, t.x - bx);
        for (const sp of c.shots.slice(0, MCAP.choirShots)) { const n = lgSpawnFrom(world, s, Object.assign({}, sp, { copy: true, choir: true, pdx: true }), bx, by, a + (sp.off || 0)); if (n) n.dmg *= .5; }
        world.choirN = (world.choirN || 0) + 1; world.fxs.push({ type: 'm_choir', x: bx, y: by, r: 8, life: .25, c: '#e8d8ff' });
      }
      return;
    }
  }
}
// ---------- world: Godfall slams, Sovereign timer, curses ----------
const MY_HEAL = new Map();
function myWorld(world, dt) {
  const cap = MCAP.scarB(); world.scarB = Math.min(cap, (world.scarB == null ? cap : world.scarB) + cap * dt);
  if (world.sov && (world.sov.t -= dt) <= 0) world.sov = null;
  if (world.guest) return;
  if (world.allies) for (const a of world.allies) if (a.god && a.raise <= 0 && a.life > 0 && (a.slamT -= dt) <= 0) {
    a.slamT = 1.5; const t = nearestFoe(world, a.x, a.y); if (t && Math.hypot(t.x - a.x, t.y - a.y) < 95) { a.swing = .25; explode(world, a.x + (a.face || 1) * 18, a.y, 72, a.dmg * .7); world.fxs.push({ type: 'quake', x: a.x, y: a.y, r: 80, life: .4, c: '#c8a0ff' }); lgSnd(world, 'myGodSlam', a.x); }
  }
  if (world === room) myCurses(world, dt);
}
function myBearers() { // who carries an equipped Mythic (and so its curse): the local mage's grimoires + co-op peers' active grimoires (host)
  const out = []; if (G && G.wands) for (const w of G.wands) { const id = myEquipped(w); if (id) out.push({ o: P, w, id, c: CARDS[id].curse }); }
  if (window.NET && NET.on && NET.host && NET.peers) for (const q of NET.peers.values()) { const id = q.wand && myEquipped(q.wand); if (id && q.inRoom) out.push({ o: q, w: q.wand, id, c: CARDS[id].curse }); }
  return out;
}
function myCurses(world, dt) {
  const B = myBearers(), on = new Set(B.map(b => b.c)); world.myCurses = [...on];
  P._myFrail = false; if (window.NET && NET.peers) for (const q of NET.peers.values()) q._myFrail = false;
  if (!B.length) { MY_HEAL.clear(); return; }
  if (on.has('foespd') || on.has('foehp')) for (const f of world.foes) {
    if (on.has('foespd') && !f._mys) { f._mys = 1; f.spd *= 1.25; }
    if (on.has('foehp') && !f._myh && !f.dummy) { f._myh = 1; f.hp *= 1.3; f.max *= 1.3; }
  }
  if (on.has('eshotfast') && room.eshots) for (const e of room.eshots) if (!e._mye) { e._mye = 1; e.vx *= 1.3; e.vy *= 1.3; }
  for (const b of B) {
    if (b.c === 'manadrain') b.w.mana = Math.max(0, b.w.mana - (b.w.regen || 0) * .4 * dt);
    if (b.c === 'hurtmore') b.o._myFrail = true;
    if (b.c === 'noheal') {
      const cur = b.o === P ? G.flame : b.o.hp, k = MY_HEAL.get(b.o);
      if (k && k.room === room && cur > k.v) { if (b.o === P) G.flame = k.v; else b.o.hp = k.v; world.healsBlocked = (world.healsBlocked || 0) + 1; }
      MY_HEAL.set(b.o, { room, v: b.o === P ? G.flame : b.o.hp });
    }
  }
}
{ const _ht = hurtTarget; hurtTarget = (T, d) => _ht(T, T && T._myFrail ? d * 1.25 : d); }
// ---------- drops: final boss, Endless depth 25+, the hidden Forbidden Archive (max 1 per run) ----------
const myCanDrop = () => !!G && !G.mythicRun;
const myRoll = () => MYTHIC[Math.min(MYTHIC.length - 1, Math.floor(rng() * MYTHIC.length))];
function myFlash() { let d = document.getElementById('myflash'); if (!d) { d = document.createElement('div'); d.id = 'myflash'; document.body.appendChild(d); } d.classList.remove('on'); void d.offsetWidth; d.classList.add('on'); }
function myReveal(picked) { au(picked ? 'myClaim' : 'myFanfare'); myFlash(); buzz(picked ? 90 : 50); window.__myReveals = (window.__myReveals || 0) + 1; }
function myOffer(title, sub, cost, then) {
  if (!myCanDrop()) return then();
  mode = 'pick'; HUD.classList.add('hidden'); const id = myRoll();
  const show = () => {
    panel(`<h2 class="mythh">✶ ${title}</h2><p>${sub}</p><div class="cards">${cardRow(id, 'id="myTake"', CARDS[id].name + (cost ? ' — costs ' + cost + ' max HP' : ''))}</div>
    <p class="small mythnote">Only one Mythic page can be found per run. It lives in a ✶ mythic slot — claiming it binds one to the end of a grimoire.</p>
    <button class="btn sub" id="edit">📖 Edit grimoire</button><button class="btn" id="myLeave">Leave it</button>`);
    on('myTake', () => myClaim(id, cost, then)); on('edit', () => editor(show)); on('myLeave', then);
  };
  show(); myReveal(false); window.__myOffers = (window.__myOffers || 0) + 1;
}
function myClaim(id, cost, then) {
  G.mythicRun = id; if (cost) { G.maxFlame -= cost; G.flame = Math.min(G.flame, G.maxFlame); }
  if (!bagAdd(id)) G.bag[7] = id;
  const fin = w => { if (w) myAddSlot(w); toast('✶ ' + CARDS[id].name + ' — Mythic!' + (w ? ' +✶ slot' : ''), 2400); myReveal(true); try { saveRun(); } catch (e) { } then(); };
  if (G.wands.some(w => w.myth)) return fin(null);
  if (G.wands.length === 1) return fin(G.wands[0]);
  panel(`<h2 class="mythh">✶ Bind a mythic slot</h2><p>Which grimoire receives the ✶ mythic slot?</p><div class="cards">${G.wands.map((w, i) => wandRow(w, `id="mw${i}"`, w.name)).join('')}</div>`);
  G.wands.forEach((w, i) => on('mw' + i, () => fin(w)));
}
function myArchive() {
  mode = 'pick'; HUD.classList.add('hidden');
  if (!myCanDrop()) {
    panel(`<h2 class="mythh">🕮 The Forbidden Archive</h2><p>Endless shelves, all empty. You already carry what was kept here.</p><button class="btn" id="arLeave">Leave</button>`);
    on('arLeave', advance); return;
  }
  myOffer('The Forbidden Archive', 'Behind the sealed door, one page hangs in the dark, chained to nothing. It costs a piece of you to take it.', 20, advance);
}
DOORS.archive = { icon: '🕮', name: 'Sealed Door', desc: 'An unmarked door. Something behind it is whispering.' };
{
  const _gm = genMap;
  genMap = function () {
    const m = _gm(); if (!G) return m;
    const r = mulberry(hashStr(G.seed + ':archive:' + G.floor)), force = DEBUG === 'archive', chance = force ? 1 : G.floor >= 1 ? .1 : 0;
    if (r() < chance) { const i = force ? 0 : 1 + Math.floor(r() * 4); if (m[i] && !m[i].includes('archive')) m[i].push('archive'); }
    return m;
  };
  const _ed = enterDoor;
  enterDoor = function (d) {
    if (d !== 'archive') return _ed(d);
    if (window.NET && NET.on && NET.host) toAll({ k: 'door', d, floor: G.floor, step: G.step, endless: !!G.endless });
    G.path[G.step] = d; stepRng(d); myArchive();
  };
  const _bd = bossDown;
  bossDown = function () {
    const d = G.floor >= ENDLESS_START ? depthOf() : 0;
    if (G.floor !== 3 && d >= 25 && myCanDrop()) { if (d) { camp.bestDepth = Math.max(camp.bestDepth || 0, d); saveCamp(); } return myOffer('Depth ' + d + ': a Mythic page surfaces', 'Deep enough that the rules start to fray. A black page drifts up out of the dark.', 0, _bd); }
    return _bd();
  };
  const _vi = victory; let vbusy = false;
  victory = function () {
    if (!vbusy && myCanDrop()) { vbusy = true; return myOffer('The Hollow Sovereign drops a Mythic page', 'As the Sovereign shatters, a page of black glass falls from its crown.', 0, () => { vbusy = false; _vi(); }); }
    return _vi();
  };
}
// ?debug=mythic (and ?debug=legendary): every Mythic page + a grimoire with a mythic slot, on top of the Legendary kit
function myDebugKit(coop) {
  if (DEBUG === 'mythic') lgDebugKit(true);
  const w = G.wands[0]; myAddSlot(w); w.slots[myIdx(w)] = 'worldscar';
  G.bag = G.bag.filter(Boolean).concat(MYTHIC.filter(id => id !== 'worldscar')).concat([null, null, null, null]);
  if (!coop) { showMap(); toast('DEBUG: 18 Legendaries + 12 Mythics', 2200); }
}
{ const _nr = newRun; newRun = function (cls, daily) { _nr(cls, daily); if (DEBUG === 'legendary' || DEBUG === 'mythic') myDebugKit(); }; }
if (typeof startCoopRun === 'function') { const _sc = startCoopRun; startCoopRun = function (...a) { const r = _sc(...a); if ((DEBUG === 'legendary' || DEBUG === 'mythic') && G) myDebugKit(true); return r; }; }
// ---------- visuals: black cores, prismatic edges (crisp vector, no blur) ----------
const prism = (t, k = 0, l = 70) => `hsl(${((t * 140 + k) % 360 + 360) % 360},95%,${l}%)`;
function myBounds() { return (room && room.bounds) || (preview && preview.world && preview.world.bounds) || null; }
function myShape(b, C, r, a) {
  const t = b.age || 0, g = b.grow == null ? 1 : b.grow, now = performance.now() / 1000;
  switch (C.shape) {
    case 'm_unwritten': {
      const k = 1 - Math.min(1, t / .45); cx.globalAlpha *= Math.max(0, k);
      cx.fillStyle = '#ffffff'; cx.strokeStyle = prism(now); cx.lineWidth = 1.6; cx.beginPath(); cx.rect(-7, -10 - t * 20, 14, 18); cx.fill(); cx.stroke();
      cx.globalAlpha /= Math.max(.001, k); return;
    }
    case 'm_godfall': {
      const R = 10 + g * 30; cx.strokeStyle = prism(now, 200); cx.lineWidth = 2; cx.beginPath(); cx.ellipse(0, 6, R, R * .4, 0, 0, TAU); cx.stroke();
      cx.fillStyle = '#0a0612'; cx.strokeStyle = prism(now, 60); cx.lineWidth = 1.2; const y = -40 + g * 16; cx.beginPath(); cx.moveTo(-9, y + 6); cx.lineTo(-9, y - 2); cx.lineTo(-4.5, y + 2); cx.lineTo(0, y - 5); cx.lineTo(4.5, y + 2); cx.lineTo(9, y - 2); cx.lineTo(9, y + 6); cx.closePath(); cx.fill(); cx.stroke(); return;
    }
    case 'm_scar': {
      const A = myBounds(), top = A ? A.y0 - 30 - b.y : -220, bot = A ? A.y1 - b.y : 160, w = 2 + 6 * g, seed = Math.floor(now * 12);
      const pts = []; for (let y = top, i = 0; y <= bot; y += 14, i++) pts.push([Math.sin(i * 1.7 + seed * .9) * 5 * g, y]);
      for (const [lw, col] of [[w + 6, prism(now, 0, 60)], [w + 2, prism(now, 120, 75)], [w, '#000000']]) { cx.strokeStyle = col; cx.lineWidth = lw; cx.beginPath(); pts.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); cx.stroke(); }
      cx.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { const y = top + ((now * 90 + i * 53) % (bot - top)); cx.fillRect(-1 + Math.sin(i + now * 5) * 6, y, 2, 2); }
      return;
    }
    case 'm_sun': {
      if (g > 1) { const k = Math.min(1, (g - 1) / 1); cx.strokeStyle = prism(now); cx.lineWidth = 6 * (1 - k) + 1; cx.beginPath(); cx.arc(0, 0, 20 + k * 130, 0, TAU); cx.stroke(); cx.fillStyle = `rgba(255,255,255,${.6 * (1 - k)})`; cx.beginPath(); cx.arc(0, 0, 20 + k * 60, 0, TAU); cx.fill(); return; }
      const R = 10 + g * 14;
      for (let i = 0; i < 3; i++) { cx.strokeStyle = prism(now, i * 120, 65); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(0, 0, R + 18 + i * 10 - ((now * 30) % 10), now * (1 + i) + i, now * (1 + i) + i + 2.2); cx.stroke(); }
      cx.fillStyle = '#000000'; cx.beginPath(); cx.arc(0, 0, R, 0, TAU); cx.fill(); cx.strokeStyle = prism(now, 40, 80); cx.lineWidth = 2.5; cx.stroke();
      cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = .8; cx.beginPath(); cx.arc(0, 0, R + 3, 0, TAU); cx.stroke(); return;
    }
    case 'm_cov': {
      const k = Math.min(1, t * 2), R = 20 + k * 220, al = Math.max(0, Math.min(1, (b.life == null ? 1 : b.life) * 1.5));
      cx.globalAlpha *= al; cx.strokeStyle = '#ff2a4a'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(0, 6, R, R * .45, 0, 0, TAU); cx.stroke();
      cx.strokeStyle = '#000000'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(0, 6, R * .8, R * .36, 0, 0, TAU); cx.stroke();
      cx.strokeStyle = prism(now, 0, 70); cx.lineWidth = 1; cx.beginPath(); for (let i = 0; i <= 5; i++) { const q = i * TAU * 2 / 5 - Math.PI / 2 + t; cx.lineTo(Math.cos(q) * R * .7, 6 + Math.sin(q) * R * .32); } cx.stroke();
      cx.globalAlpha /= al || 1; return;
    }
    case 'm_choir': {
      for (let i = 0; i < 5; i++) {
        const q = t * 1.6 + i * TAU / 5, x = Math.cos(q) * 46, y = Math.sin(q) * 20 + Math.sin(now * 3 + i) * 2;
        cx.save(); cx.translate(x, y); cx.scale(g, g); cx.fillStyle = '#0a0612'; cx.strokeStyle = prism(now, i * 72, 72); cx.lineWidth = 1.3;
        cx.beginPath(); cx.rect(-6, -8, 12, 15); cx.fill(); cx.stroke(); cx.strokeStyle = '#ffffff'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(0, -7); cx.lineTo(0, 6); cx.stroke(); cx.restore();
      }
      return;
    }
  }
}
function myOverlays(b, r, a) {
  const o = b.mv, sp = b.spin || 0, now = performance.now() / 1000;
  cx.strokeStyle = prism(now); cx.lineWidth = 1;
  if (o & MVB.omnicast) { cx.beginPath(); for (let i = 0; i < 6; i++) { const q = sp * .3 + i * TAU / 6; cx.moveTo(Math.cos(q) * (r + 3), Math.sin(q) * (r + 3)); cx.lineTo(Math.cos(q) * (r + 7), Math.sin(q) * (r + 7)); } cx.stroke(); }
  if (o & MVB.sovereign) { cx.beginPath(); cx.moveTo(-4, -r - 3); cx.lineTo(0, -r - 9); cx.lineTo(4, -r - 3); cx.stroke(); }
  if (o & MVB.paradox) { cx.beginPath(); cx.arc(0, 0, r + 4, sp, sp + Math.PI); cx.stroke(); cx.strokeStyle = '#000'; cx.beginPath(); cx.arc(0, 0, r + 4, sp + Math.PI, sp + TAU); cx.stroke(); }
  if (o & MVB.undying) { cx.beginPath(); cx.arc(0, 0, r + 6, -sp, -sp + 4.5); cx.stroke(); }
  if (o & MVB.ascendantcrown) { cx.fillStyle = prism(now, 180); for (const s of [-1, 1]) cx.fillRect(s * (r + 5) - 1, -1, 2, 2); }
  if (o & MVB.fateunbound) { cx.setLineDash([1.5, 2]); cx.beginPath(); cx.arc(0, 0, r + 8, 0, TAU); cx.stroke(); cx.setLineDash([]); }
}
function myDrawGod(a, t) {
  const up = a.raise > 0 ? 1 - a.raise / .6 : 1, al = Math.min(1, a.life * 1.5) * (.55 + .1 * Math.sin(t * 6)), bob = Math.sin(t * 2.4) * 2, B = biome(), glow = (B.bossSkin && B.bossSkin.glow) || '#c8a0ff';
  cx.save(); cx.translate(a.x, a.y); cx.scale(a.face || 1, 1);
  cx.globalAlpha = Math.min(1, a.life * 2) * .5; cx.fillStyle = '#000'; cx.beginPath(); cx.ellipse(0, 1, 22, 7, 0, 0, TAU); cx.fill();
  cx.globalAlpha = al; cx.translate(0, (1 - up) * 40);
  const sw = a.swing > 0 ? (1 - a.swing / .25) : 0;
  cx.fillStyle = 'rgba(60,30,110,.65)'; cx.strokeStyle = prism(t, 260, 72); cx.lineWidth = 1.6;
  cx.beginPath(); cx.moveTo(-20, 0); cx.lineTo(-13, -40 + bob); cx.lineTo(13, -40 + bob); cx.lineTo(20, 0); cx.closePath(); cx.fill(); cx.stroke();
  cx.beginPath(); cx.arc(0, -48 + bob, 10, 0, TAU); cx.fill(); cx.stroke();
  cx.fillStyle = glow; cx.fillRect(-5, -50 + bob, 3, 2); cx.fillRect(2, -50 + bob, 3, 2);
  cx.fillStyle = '#0a0612'; cx.strokeStyle = prism(t, 40, 75); cx.beginPath(); cx.moveTo(-10, -56 + bob); cx.lineTo(-10, -64 + bob); cx.lineTo(-5, -59 + bob); cx.lineTo(0, -67 + bob); cx.lineTo(5, -59 + bob); cx.lineTo(10, -64 + bob); cx.lineTo(10, -56 + bob); cx.closePath(); cx.fill(); cx.stroke();
  cx.strokeStyle = prism(t, 140, 80); cx.lineWidth = 3; cx.beginPath(); cx.moveTo(12, -30 + bob); cx.lineTo(12 + 16 * Math.cos(-1.2 + sw * 2), -30 + bob + 16 * Math.sin(-1.2 + sw * 2)); cx.stroke();
  cx.restore();
}
function myFx(f) {
  const k = f.life, now = performance.now() / 1000;
  switch (f.type) {
    case 'm_ink': { const y = f.y - 20 - (.55 - k) * 30; cx.globalAlpha = Math.min(1, k * 3); cx.font = '16px serif'; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.fillText(f.txt || '?', f.x, y); cx.textAlign = 'left'; cx.globalAlpha = 1; return true; }
    case 'm_rise': case 'm_collapse': case 'm_undying': case 'm_choir': case 'm_scarflash': { const R = f.r * (1.4 - k * (f.type === 'm_collapse' ? 1.2 : .8)); cx.strokeStyle = prism(now, f.x); cx.lineWidth = f.type === 'm_collapse' ? 4 : 1.5; cx.beginPath(); cx.ellipse(f.x, f.y, R, R * (f.type === 'm_scarflash' ? 1 : .5), 0, 0, TAU); cx.stroke(); return true; }
    case 'm_ruin': { cx.strokeStyle = '#ff2a4a'; cx.lineWidth = 2; const R = f.r * (1.5 - k); cx.beginPath(); cx.moveTo(f.x - R, f.y - R); cx.lineTo(f.x + R, f.y + R); cx.moveTo(f.x + R, f.y - R); cx.lineTo(f.x - R, f.y + R); cx.stroke(); return true; }
    case 'm_paradox': { cx.strokeStyle = prism(now); cx.lineWidth = 1.5; cx.setLineDash([3, 3]); cx.beginPath(); cx.moveTo(f.x, f.y); cx.lineTo(f.x2, f.y2); cx.stroke(); cx.setLineDash([]); cx.beginPath(); cx.arc(f.x, f.y, f.r * (1.4 - k), 0, TAU); cx.stroke(); return true; }
  }
  return false;
}
{
  const _ds = drawShape2; drawShape2 = (b, C, r, a) => { if (C.mk) { myShape(b, C, r, a); return true; } return _ds(b, C, r, a); };
  const _fx2 = drawFx2; drawFx2 = f => myFx(f) || _fx2(f);
  const _sk = lgDrawSkel; lgDrawSkel = (a, t) => a.god ? myDrawGod(a, t) : _sk(a, t);
}
// ---------- sounds ----------
if (window.AUD && AUD.reg) AUD.reg(({ tone, noise, bell, panOf }) => ({
  myFanfare: () => { [0, 3, 7, 10, 14, 19].forEach((s, i) => bell(220 * Math.pow(2, s / 12), 1.6, .09, { at: i * .1 })); tone('sawtooth', 55, 55, 1.6, .06, { lp: 500, at: .3 }); tone('sine', 41, 30, 1.8, .25, { at: .2 }); noise(1, .05, { ft: 'highpass', f0: 5000, at: .5 }); },
  myClaim: () => { [19, 14, 10, 7, 24].forEach((s, i) => bell(220 * Math.pow(2, s / 12), 1.2, .1, { at: i * .08 })); tone('sine', 55, 27, .9, .35); },
  myGlyph: p => { p = panOf(p); tone('sine', 1320, 660, .2, .05, { pan: p }); tone('triangle', 330, 165, .25, .05, { pan: p, at: .04 }); },
  myUnwritten: p => { p = panOf(p); noise(.2, .1, { f0: 6000, f1: 1500, q: 2, pan: p }); bell(880, .4, .05, { pan: p }); },
  myGodfall: p => { p = panOf(p); tone('sawtooth', 70, 35, 1.2, .1, { lp: 400, pan: p }); bell(110, 1.5, .1, { pan: p, at: .1 }); noise(.8, .08, { ft: 'lowpass', f0: 400, pan: p }); },
  myGodSlam: p => { p = panOf(p); tone('sine', 60, 30, .4, .3, { pan: p }); noise(.3, .12, { ft: 'lowpass', f0: 900, f1: 120, pan: p }); },
  myScar: p => { p = panOf(p); noise(.7, .14, { f0: 300, f1: 5000, q: 4, pan: p }); tone('square', 40, 80, .6, .05, { lp: 600, pan: p }); },
  mySunPull: p => { p = panOf(p); tone('sine', 300, 40, 2.3, .12, { pan: p }); noise(2.2, .06, { f0: 2000, f1: 200, q: 3, pan: p, a: .3 }); },
  mySunBoom: p => { p = panOf(p); tone('sine', 50, 20, 1, .4, { pan: p }); noise(1, .25, { ft: 'lowpass', f0: 2400, f1: 80, pan: p }); bell(165, 1.2, .07, { pan: p }); },
  myCovenant: () => { tone('sawtooth', 110, 27, 1.4, .1, { lp: 700 }); [0, .15, .3].forEach(a => bell(98, 1.3, .08, { at: a })); noise(1.2, .15, { ft: 'lowpass', f0: 1500, f1: 100 }); },
  myChoir: p => { p = panOf(p); [0, 4, 7, 11, 14].forEach((s, i) => tone('sine', 330 * Math.pow(2, s / 12), 0, 1.2, .035, { pan: p, at: i * .06, a: .2 })); },
  myParadox: p => { p = panOf(p); tone('sine', 900, 300, .18, .06, { pan: p }); tone('sine', 300, 900, .18, .06, { pan: -p, at: .05 }); },
  myUndying: p => { p = panOf(p); tone('triangle', 520, 780, .2, .05, { pan: p }); },
}), { myGlyph: .12, myUndying: .08, myParadox: .08, myGodSlam: .2, myChoir: .5 });
window.__mythic = { MYTHIC, MYTH_PROJ, MYTH_GLYPH, MVB, MCAP, MCURSE, myIdx, myEquipped, myAddSlot, myOffer, myClaim, myArchive, myDebugKit, myBearers, myCurseTxt, myCurseOf, archive: myArchive, myReveal };
