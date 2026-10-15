'use strict';
// Grimoire Ascent — Legendary pages (rarity 4): rule-breaking pages with a drawback, gold slots and rare ornate grimoires.
// Hooks are called from the cast engine in game.js (lgSpawn, lgTick, lgHitMul, lgAfterHit, lgEnd, lgStatus, lgDeath, lgWorld,
// lgPreCast, lgPostCast). Everything runs the same in solo, the editor preview and the co-op host; guests only draw + play sounds.
const LEG_PROJ = ['requiem', 'lastpage', 'cathedralfall', 'abyssalmaw', 'saintshalo', 'eternalflame', 'ossuary', 'starfall'];
const LEG_GLYPH = ['recursion', 'martyrdom', 'fatebinding', 'timefracture', 'ascension', 'soulbound', 'hereticmark', 'inversion', 'grimoireecho', 'crownedash'];
const LEGENDARY = LEG_PROJ.concat(LEG_GLYPH);
const LVB = {}; LEG_GLYPH.forEach((k, i) => LVB[k] = 1 << i);
const LQ = () => QUAL.parts === 'low';
// performance caps (lower on battery saver / low particles)
const LCAP = { recur: () => LQ() ? 3 : 4, ash: () => LQ() ? 1 : 2, ashCopies: () => LQ() ? 2 : 3, allies: () => LQ() ? 4 : 6, walls: 12, bond: 8, meteors: 10, swallow: 6, shots: 170 };
let LID = 0;
const L = (o) => Object.assign({ leg: true, rar: 4, notrail: true }, o);
Object.assign(CARDS, {
  requiem: L({ t: 'proj', name: 'Requiem', icon: '🔔', mana: 60, delay: 2.2, lgk: 'requiem', shape: 'requiem', el: 'Sound', col: '#cfe0ff', lt: '200,220,255', spd: 0, dmg: 26, r: 14, life: 3.3,
    desc: 'A spectral bell appears above the room and tolls 3 times; every toll strikes every enemy on screen. Drawback: very long recharge, and you cannot cast while it rings.', flav: 'Every bell tolls for someone. This one tolls for all of them.' }),
  lastpage: L({ t: 'proj', name: 'The Last Page', icon: '📃', mana: 0, delay: .4, lgk: 'lastpage', shape: 'lastpage', el: 'Fire', col: '#ffd28a', lt: '255,200,120', spd: 0, dmg: 1, r: 8, life: .55,
    desc: 'Copies the strongest single spell you have cast this run, then burns up for good. Drawback: one use — the page is destroyed.', flav: 'Read it once. There is no second reading.' }),
  cathedralfall: L({ t: 'proj', name: 'Cathedral Fall', icon: '⛪', mana: 55, delay: .9, lgk: 'cathedralfall', shape: 'spire', el: 'Earth', col: '#c8beaa', lt: '230,210,170', spd: 0, dmg: 48, r: 10, life: 2,
    desc: 'A cathedral spire falls from the sky onto your target, leaving rubble walls that block enemies for 7s. Drawback: the rubble blocks your own spells too.', flav: 'Faith, at terminal velocity.' }),
  abyssalmaw: L({ t: 'proj', name: 'Abyssal Maw', icon: '🕳', mana: 45, flame: 3, delay: .7, lgk: 'abyssalmaw', shape: 'maw', el: 'Shadow', col: '#8a1020', lt: '200,40,60', spd: 0, dmg: 14, r: 34, life: 4,
    desc: 'A mouth opens in the floor under your target for 4s. It swallows small enemies whole and spits out their embers, and gnaws on large ones. Drawback: feeding it costs you 3 HP per cast.', flav: 'The floor was always hungry. You just gave it permission.' }),
  saintshalo: L({ t: 'proj', name: "Saint's Halo", icon: '🔆', mana: 40, delay: .5, lgk: 'saintshalo', shape: 'halo', el: 'Light', col: '#fff2b0', lt: '255,240,180', spd: 0, dmg: 24, r: 12, life: 8,
    desc: 'A crown of light rests above you for 8s and beams any enemy that attacks you. Drawback: while it shines, your other spells deal 30% less damage.', flav: 'Raise a hand against her, and heaven answers.' }),
  eternalflame: L({ t: 'proj', name: 'Eternal Flame', icon: '🕯', mana: 50, delay: .5, lgk: 'eternalflame', shape: 'eternal', el: 'Fire', col: '#ffb030', lt: '255,170,60', spd: 240, dmg: 10, r: 7, life: 1e6, burn: true,
    desc: 'A fireball that never goes out: it pierces and bounces around the room until you cast it again. Only one can exist. Drawback: it drains 3 mana a second from its grimoire while it burns.', flav: 'It was lit at the first sermon. It has never been allowed to rest.' }),
  ossuary: L({ t: 'proj', name: 'Ossuary Legion', icon: '🦴', mana: 40, delay: .6, lgk: 'ossuary', shape: 'ossuary', el: 'Shadow', col: '#e8e0c8', lt: '220,230,200', spd: 0, dmg: 9, r: 10, life: .7,
    desc: 'Raises up to 3 skeleton allies from enemies killed in the last 5 seconds; they fight for 9s. Drawback: it fizzles if nothing died recently, and foes the skeletons kill drop no embers.', flav: 'Old bones remember how to march.' }),
  starfall: L({ t: 'proj', name: 'Starfall Rite', icon: '🌠', mana: 65, delay: .6, lgk: 'starfall', shape: 'starfall', el: 'Light', col: '#cfe0ff', lt: '200,220,255', spd: 0, dmg: 22, r: 16, life: 8,
    desc: 'Draws a star rite at your feet that charges while you stand still (up to 3s), then rains meteors in proportion to the charge — up to 10. Drawback: you cannot cast while it charges, and moving in the first half-second breaks the rite.', flav: 'Stand still. Pray. Duck.' }),
  recursion: L({ t: 'mod', name: 'Infinite Recursion', icon: '∞', mana: 30, delay: .6,
    desc: 'When the spell ends it recasts itself at half strength, again and again until it is negligible (at most 4 deep). Drawback: +0.6s cast delay.', flav: 'The page reads itself, then reads itself reading itself.' }),
  martyrdom: L({ t: 'mod', name: 'Martyrdom', icon: '❣', mana: 0,
    desc: 'The whole cast costs HP instead of mana (1 HP per 6 mana). Below half HP the spell deals triple damage. Drawback: you pay in your own flame.', flav: 'The saints were never cheap.' }),
  fatebinding: L({ t: 'mod', name: 'Fatebinding', icon: '🧵', mana: 20,
    desc: 'Binds every enemy the spell hits: whenever one is struck, all the others take 60% of that damage too. Pierces 2 more foes. Drawback: −35% direct damage.', flav: 'One thread. Many necks.' }),
  timefracture: L({ t: 'mod', name: 'Time Fracture', icon: '⏳', mana: 25, delay: .3,
    desc: 'The spell freezes in place after a moment, then replays from that spot 3 times, one second apart. Drawback: the frozen original deals no damage.', flav: 'The clock struck once. Then it struck the same moment three more times.' }),
  ascension: L({ t: 'mod', name: 'Ascension', icon: '🕊', mana: 15,
    desc: 'Every kill with this spell makes it 12% stronger for the rest of the room (up to 25 kills). Drawback: it starts at −40% damage.', flav: 'Each soul is a rung on the ladder.' }),
  soulbound: L({ t: 'mod', name: 'Soulbound', icon: '🔮', mana: 15,
    desc: 'The spell steers with your aim and your movement, and drifts along with you. Drawback: it shatters the moment you are hurt.', flav: 'Where you look, it goes. Where you bleed, it breaks.' }),
  hereticmark: L({ t: 'mod', name: "Heretic's Mark", icon: '🗡', mana: 20,
    desc: 'Enemies hit turn on each other for 3 seconds (bosses for 1). Drawback: when the mark fades they come back enraged: +30% speed for 2s.', flav: 'Doubt is a blade. Hand it out generously.' }),
  inversion: L({ t: 'mod', name: 'The Inversion', icon: '🔃', mana: 20,
    desc: 'After the spell hits, damage you take heals you instead for 2 seconds. Drawback: when it ends you are exposed, taking +50% damage for 1.5s.', flav: 'Pain, read backwards, is a prayer.' }),
  grimoireecho: L({ t: 'mod', name: 'Grimoire Echo', icon: '📑', mana: 25,
    desc: "The next attack page also gets all of this spell's glyphs and elemental effects. Drawback: the echoing spell itself deals −30% damage.", flav: 'Every page remembers the one before it.' }),
  crownedash: L({ t: 'mod', name: 'Crowned in Ash', icon: '♚', mana: 30,
    desc: 'Enemies it kills burst into 3 copies of the spell (copies can burst once more; capped per second). Drawback: −40% damage.', flav: 'Long live the ashes.' }),
});
for (const id of LEGENDARY) CARDS[id].id = id;
Object.assign(SHORT, { lastpage: 'Last Page', cathedralfall: 'Cathedral', abyssalmaw: 'Abyss Maw', saintshalo: 'Halo', eternalflame: 'Eternal', ossuary: 'Ossuary', starfall: 'Starfall', recursion: 'Recursion', fatebinding: 'Fatebind', timefracture: 'Time Fract.', ascension: 'Ascension', soulbound: 'Soulbound', hereticmark: 'Heretic', inversion: 'Inversion', grimoireecho: 'Echo', crownedash: 'Ash Crown' });
// ---------- gold slots + ornate grimoires ----------
const ORNATE_SVG = '<svg class="orn" viewBox="0 0 40 44" width="36" height="40" aria-hidden="true"><rect x="5" y="3" width="30" height="38" rx="2" fill="#5a0a14" stroke="#e8c060" stroke-width="2"/><rect x="5" y="3" width="5" height="38" fill="#3a0610"/><rect x="12" y="8" width="18" height="28" rx="1" fill="none" stroke="#c89a3a" stroke-width="1"/><path d="M21 12 l5 10 -5 10 -5 -10z" fill="#e8c060"/><circle cx="21" cy="22" r="3" fill="#b0102a" stroke="#ffe8a0" stroke-width=".8"/><path d="M5 3h6l-6 6zM35 3h-6l6 6zM5 41h6l-6-6zM35 41h-6l6-6z" fill="#e8c060"/><rect x="34" y="18" width="4" height="8" fill="#e8c060"/></svg>';
function lgGoldN(w) { return w && w.ornate ? 2 : 1; }
function lgGold(w, i) { return !!w && !!w.slots && i < Math.min(lgGoldN(w), w.slots.length); }
function lgOrnate(w) {
  w.ornate = true; if (!/Gilded/.test(w.name)) w.name = /^\w+-Leaf /.test(w.name) ? w.name.replace(/^(\w+-Leaf) /, '$1 Gilded ') : 'Gilded ' + w.name;
  w.maxMana = Math.round(w.maxMana * 1.2); w.mana = w.maxMana; w.regen = Math.round(w.regen * 1.15); w.hue = 352; return w;
}
function lgRoll() { return pick(LEGENDARY); }
// editor: legendaries only in gold slots, and no more than the grimoire's gold slots allow
function lgCheckMove(from, to) {
  const w = G.wands[edWand], a = getLoc(from), b = getLoc(to);
  for (const [loc, id] of [[to, a], [from, b]]) {
    const [k, i] = loc.split(':'); if (k !== 'w' || !id || !CARDS[id].leg || lgGold(w, +i)) continue;
    const gn = Math.min(lgGoldN(w), w.slots.length); let used = 0;
    for (let j = 0; j < gn; j++) if ('w:' + j !== from && 'w:' + j !== to && w.slots[j] && CARDS[w.slots[j]].leg) used++;
    return used >= gn ? 'limit' : 'gold';
  }
  return null;
}
function lgReject(loc, why) {
  const w = G.wands[edWand], n = lgGoldN(w);
  const msg = why === 'limit' ? `This grimoire can hold only ${n} Legendary page${n > 1 ? 's' : ''}${w.ornate ? '' : ' — rare ornate grimoires hold 2'}.` : 'Legendary pages only fit in ♛ gold slots.';
  au('lgDeny'); buzz(40); edSel = null; editor();
  const el = UI.querySelector(`[data-loc="${loc}"]`); if (el) { el.classList.add('shake', 'deny'); setTimeout(() => el.classList.remove('shake', 'deny'), 650); }
  UI.querySelectorAll('.slot.gold').forEach(g => { g.classList.add('pulse'); setTimeout(() => g.classList.remove('pulse'), 900); });
  const info = document.getElementById('info'); if (info) info.innerHTML = `<b class="deny">✖ ${msg}</b>`;
  if (!info) toast('✖ ' + msg, 2200); window.__lgDenied = (window.__lgDenied || 0) + 1; window.__lgDenyMsg = msg;
}
// drop presentation: fanfare + screen flash
function lgFlash() { let d = document.getElementById('lgflash'); if (!d) { d = document.createElement('div'); d.id = 'lgflash'; document.body.appendChild(d); } d.classList.remove('on'); void d.offsetWidth; d.classList.add('on'); }
function lgReveal(picked) { au(picked ? 'lgClaim' : 'lgFanfare'); lgFlash(); buzz(picked ? 60 : 30); window.__lgReveals = (window.__lgReveals || 0) + 1; }
function lgRevealPanel() { if (UI.querySelector('.card.leg, .card.ornate')) lgReveal(); }
// rare altar (12% of altars): a single Legendary page for 15 max HP
function lgAltar() {
  if (!(rng() < .12 || DEBUG === 'altar')) return false;
  mode = 'pick'; const id = lgRoll(), cost = 15;
  const show = () => {
    panel(`<h2>♛ Gilded Reliquary</h2><p>Gold leaf, old blood and a single page that hums like a held breath.</p>
    <div class="cards">${cardRow(id, 'id="lgTake"', CARDS[id].name + ' — costs ' + cost + ' max HP')}</div>
    <button class="btn sub" id="edit">📖 Edit grimoire</button><button class="btn" id="leave">Leave it on the altar</button>`);
    on('lgTake', () => { G.maxFlame -= cost; G.flame = Math.min(G.flame, G.maxFlame); if (!bagAdd(id)) G.bag[7] = id; toast(CARDS[id].icon + ' ' + CARDS[id].name + ' — Legendary!'); lgReveal(true); advance(); });
    on('edit', () => editor(show)); on('leave', advance);
  };
  show(); lgReveal(); return true;
}
// ?debug=legendary: every Legendary page + an ornate 2-gold-slot grimoire
function lgDebugKit(coop) {
  const w = lgOrnate(makeWand({ name: 'Five-Leaf Reliquary Codex', leaves: 5, slots: ['timefracture', 'requiem', 'spark', 'fireball', 'double', 'ice', null, null], delay: .18, recharge: .4, maxMana: 420, mana: 420, regen: 120, hue: 352 }));
  w.name = 'Five-Leaf Gilded Reliquary Codex';
  const w2 = makeWand({ name: 'Three-Leaf Ember Tome', leaves: 3, slots: ['saintshalo', 'spark', 'homing', 'spark', null, null], delay: .2, recharge: .4, maxMana: 300, mana: 300, regen: 90, hue: 30 });
  G.wands = [w, w2]; G.active = 0;
  G.bag = LEGENDARY.filter(id => !['timefracture', 'requiem', 'saintshalo'].includes(id)).concat(['heavy', 'homing', 'double', 'fireball', null, null, null, null]);
  G.maxFlame = Math.max(G.maxFlame, 160); G.flame = G.maxFlame;
  if (!coop) { showMap(); toast('DEBUG: all 18 Legendaries', 2200); }
}
{ const _nr = newRun; newRun = function (cls, daily) { _nr(cls, daily); if (DEBUG === 'legendary') lgDebugKit(); }; }
if (typeof startCoopRun === 'function') { const _sc = startCoopRun; startCoopRun = function (...a) { const r = _sc(...a); if (DEBUG === 'legendary' && G) lgDebugKit(true); return r; }; }
// ---------- helpers ----------
function lgFrac(o) { if (!o) return 1; if (o === P) return G ? G.flame / G.maxFlame : 1; if (o.hp != null && o.maxHp) return o.hp / o.maxHp; return 1; }
function lgHeal(o, n) { if (!o) return; if (o === P) { if (G && !(room && room.guest)) G.flame = Math.min(G.maxFlame, G.flame + n); } else if (o.hp != null && o.maxHp) o.hp = Math.min(o.maxHp, o.hp + n); }
function lgSnd(world, name, x, arg) { if (world !== room) return; au(name, x, arg); world.fxs.push({ type: 'snd', x: x || 0, y: 0, life: .3, txt: name, c: arg || '' }); }
function lgSpawnFrom(world, s, spec, x, y, a) {
  const kc = world.caster, kw = world.curWand; world.caster = s.owner || kc; world.curWand = s.wand || kw;
  let n = null; try { n = spawnShot(world, spec, x, y, a); } finally { world.caster = kc; world.curWand = kw; }
  return n;
}
const lgClean = sp => JSON.parse(JSON.stringify(sp, (k, v) => k[0] === '_' ? undefined : v));
function lgHolder(world, o) { if (world === room) return !o || o === P ? G : o; return world; }
function lgAscMul(world, o) { const m = world.asc; return 1 + .12 * (m ? m.get(o || world) || 0 : 0); }
// ---------- engine hooks ----------
function lgPreCast(world, wand, c) {
  const o = world.caster; if (!o) return true;
  for (const q of world.shots) if (q.owner === o && q.life > 0 && (q.lgk === 'requiem' || (q.lgk === 'starfall' && !q.released))) { wand.cd = .12; return false; }
  return true;
}
function lgPostCast(world, wand, c, x, y) {
  const all = []; const walk = Ls => { for (const s of Ls || []) { all.push(s); walk(s.payload); } }; walk(c.shots);
  if (all.some(s => s.p === 'lastpage')) lgBurnPage(world, wand, x, y);
  let g = null; for (const s of all) { for (const m of s.mods) if (LVB[m]) { g = m; break; } if (g) break; }
  if (g) lgSnd(world, 'lgGlyph', x, g);
}
function lgBurnPage(world, wand, x, y) {
  const i = wand.slots.indexOf('lastpage'); if (i < 0) return; wand.slots[i] = null; wand.idx = 0;
  world.fxs.push({ type: 'burnpage', x, y: y + 14, r: 14, life: 1.1, c: '#ffb050' });
  if (world !== room) return;
  if (G && G.wands.includes(wand)) { toast('📃 The Last Page burns away…', 1800); saveRun(); }
  else if (window.NET && NET.peers) for (const q of NET.peers.values()) if (q.wand === wand) q.lpBurn = (q.lpBurn || 0) + 1;
}
function lgSpawn(world, s, spec, b, m, ang) {
  let lv = 0; for (const q of spec.mods) if (LVB[q]) lv |= LVB[q];
  const o = s.owner;
  if (o && o.x != null) (world.lgOwn || (world.lgOwn = new Set())).add(o);
  if (spec.echoFrom && CARDS[spec.echoFrom]) {
    const E = CARDS[spec.echoFrom]; lv |= LVB.grimoireecho; s.echoed = spec.echoFrom;
    for (const k of ['burn', 'freeze', 'poison', 'hex', 'knock', 'pull']) if (E[k]) s[k] = s[k] || E[k];
    if (E.chain) s.chain += E.chain; if (E.boom && !s.boom) s.boom = Math.round(E.boom * .6); if (E.stun) s.estun = E.stun;
  }
  if (lv) s.lv = lv;
  if (m('grimoireecho')) s.dmg *= .7;
  if (m('martyrdom') && lgFrac(o) < .5) { s.dmg *= 3; s.martyr = true; }
  if (m('fatebinding')) { s.dmg *= .65; s.bond = spec._bond || (spec._bond = { foes: [] }); s.pierce += 2; }
  if (m('timefracture') && !spec.tfCopy && b.spd > 0 && !s.orbit && s.novaR === undefined && !b.meteor && !b.grave && !b.lgk) { s.tfT = .32; s.life = Math.max(s.life, .32) + 3.3; }
  if (m('ascension')) { s.asc = true; s.dmg *= .6 * lgAscMul(world, o); }
  if (m('soulbound') && o && o.x != null && !b.lgk) { s.soul = { o, lx: o.x, ly: o.y, h0: o.lgHurtN || 0 }; s.homing = false; }
  if (m('hereticmark')) s.heretic = true;
  if (m('inversion')) s.invert = true;
  if (m('crownedash')) { s.ash = spec.ashD || 0; if (!spec.ashD) s.dmg *= .6; }
  if (m('recursion')) s.recur = spec.recD || 0;
  if (!spec.lpCopy && !b.leg && !spec.recD && !spec.ashD && !spec.tfCopy && !spec.swarmed && !spec.mirrorCopy && !spec.ghost && !spec.copy && !spec.starfall) {
    const h = lgHolder(world, o); if (h && (!h.lpBest || s.dmg > h.lpBest.dmg)) h.lpBest = { dmg: Math.round(s.dmg * 10) / 10, spec: lgClean(spec) };
  }
  if (!b.lgk) return;
  const A = world.bounds || { x0: 0, y0: 0, x1: 400, y1: 300 }, tgt = nearestFoe(world, s.x, s.y);
  s.lgk = b.lgk; s.pierce = 999;
  const at = (dist, dy) => tgt ? [tgt.x, tgt.y] : [s.x + Math.cos(ang) * dist, s.y + Math.sin(ang) * dist + dy];
  switch (b.lgk) {
    case 'requiem': {
      if (world.shots.some(q => q.lgk === 'requiem' && q.owner === o && q.life > 0)) { s.life = 0; return; }
      s.x = (A.x0 + A.x1) / 2; s.y = A.y0 + 40; s.vx = s.vy = 0; s.tolls = 0; lgSnd(world, 'lgBell', s.x); break;
    }
    case 'lastpage': {
      s.vx = s.vy = 0; const h = lgHolder(world, o), best = h && h.lpBest;
      const cp = best ? Object.assign(JSON.parse(JSON.stringify(best.spec)), { lpCopy: true, off: 0, wait: 0 }) : { p: 'spark', mods: [], off: 0, lpCopy: true };
      const n = spawnShot(world, cp, s.x, s.y, ang); if (n && best) n.dmg = Math.max(n.dmg, best.dmg);
      s.copied = cp.p; lgSnd(world, 'lgBurn', s.x); break;
    }
    case 'cathedralfall': {
      const [tx, ty] = at(150, 14); s.x = clamp(tx, A.x0 + 24, A.x1 - 24); s.y = clamp(ty, A.y0 + 40, A.y1 - 12); s.vx = s.vy = 0;
      s.wz = 300; s.wvz = 120; s.fall = true; s.ca = o && o.x != null ? Math.atan2(o.y - s.y, o.x - s.x) : Math.PI / 2; lgSnd(world, 'lgSpire', s.x); break;
    }
    case 'abyssalmaw': { const [tx, ty] = at(140, 10); s.x = clamp(tx, A.x0 + 30, A.x1 - 30); s.y = clamp(ty + 4, A.y0 + 30, A.y1 - 20); s.vx = s.vy = 0; s.bt = .45; s.eaten = 0; s.grow = 0; lgSnd(world, 'lgMaw', s.x); break; }
    case 'saintshalo': { for (const q of world.shots) if (q.lgk === 'saintshalo' && q.owner === o) q.life = 0; if (o) o._halo = s; s.vx = s.vy = 0; if (o && o.x != null) { s.x = o.x; s.y = o.y - 40; } lgSnd(world, 'lgHalo', s.x); break; }
    case 'eternalflame': {
      for (const q of world.shots) if (q.lgk === 'eternalflame' && q.owner === o && q.life > 0) { q.life = 0; explode(world, q.x, q.y, 34, q.dmg); world.fxs.push({ type: 'ring', x: q.x, y: q.y + 10, r: 4, R: 40, life: .3, c: '#ffd060' }); }
      s.bounce = 1e6; s.rehit = s.rht = .45; s.eternal = true; s.burn = true; lgSnd(world, 'lgEternal', s.x); break;
    }
    case 'ossuary': { s.vx = s.vy = 0; if (o && o.x != null) { s.x = o.x; s.y = o.y; } lgRaise(world, s); break; }
    case 'starfall': {
      if (world.shots.some(q => q.lgk === 'starfall' && q.owner === o && !q.released && q.life > 0)) { s.life = 0; return; }
      const c = o && o.x != null ? o : { x: s.x, y: s.y + 14 }; s.x = c.x; s.y = c.y; s.vx = s.vy = 0; s.grow = 0; s.lx = c.x; s.ly = c.y; s.mods = spec.mods.filter(q => q !== 'timefracture');
      lgSnd(world, 'lgStarCharge', s.x); break;
    }
  }
}
function lgRaise(world, s) {
  const now = world.lgt || 0, D = (world.deaths || []).filter(d => now - d.t <= 5 && !d.used), al = world.allies || (world.allies = []);
  let n = 0;
  for (const d of D.slice(-3)) { if (al.length >= LCAP.allies()) break; d.used = true; al.push({ id: ++LID, x: d.x, y: d.y, r: 11, hp: 40, max: 40, life: 9, raise: .5, atkT: .3, face: 1, walk: 0, dmg: s.dmg, owner: s.owner }); n++; world.fxs.push({ type: 'raise', x: d.x, y: d.y, r: 16, life: .7, c: '#d8e8c8' }); }
  s.raised = n;
  if (!n) { world.fxs.push({ type: 'fizzle', x: s.x, y: s.y - 10, r: 12, life: .6, c: '#8a8a7a' }); lgSnd(world, 'lgFizzle', s.x); } else lgSnd(world, 'lgOssuary', s.x);
}
function lgToll(world, s) {
  world.fxs.push({ type: 'toll', x: s.x, y: s.y, r: 20, life: .8, c: '#d8e6ff', n: s.tolls });
  for (const f of world.foes) if (!f.dead && f.spawnT <= 0) { s.hit.length = 0; s.pierce = 999; onHit(world, s, f); }
  if (world === room) { shake = Math.max(shake, 5); impact(.05); }
  lgSnd(world, 'lgToll', s.x, String(s.tolls));
}
function lgSpireLand(world, s) {
  explode(world, s.x, s.y, 62, s.dmg);
  world.fxs.push({ type: 'quake', x: s.x, y: s.y, r: 74, life: .5, c: '#8a7a64' }); world.fxs.push({ type: 'spiredust', x: s.x, y: s.y, r: 40, life: .7, c: '#b8b0a0' });
  if (world === room) { shake = Math.max(shake, 10); impact(.1); }
  const A = world.bounds, ws = world.walls || (world.walls = []), base = (s.ca != null ? s.ca : Math.PI / 2);
  for (let i = 0; i < 4; i++) { const q = base + (i - 1.5) * .6; ws.push({ id: ++LID, x: clamp(s.x + Math.cos(q) * 60, A.x0 + 14, A.x1 - 14), y: clamp(s.y + Math.sin(q) * 46, A.y0 + 14, A.y1 - 8), r: 15, life: 7, max: 7, seed: (LID * 7919) % 10007 }); }
  if (ws.length > LCAP.walls) ws.splice(0, ws.length - LCAP.walls);
  lgSnd(world, 'lgCrash', s.x);
}
function lgMaw(world, s, dt) {
  const life = s.life == null ? 1 : s.life, open = Math.min(1, s.age / .35) * Math.min(1, Math.max(0, life) / .35); s.grow = Math.round(open * 100) / 100;
  if ((s.bt -= dt) > 0 || open < .6) return;
  s.bt = .4;
  for (const f of world.foes) {
    if (f.dead || f.spawnT > 0 || Math.hypot(f.x - s.x, f.y - s.y) > s.r + f.r * .4) continue;
    if (!f.boss && !f.elite && !f.dummy && s.eaten < LCAP.swallow) {
      s.eaten++; f.swallowed = true; const d0 = world === room ? room.drops.length : 0;
      world.fxs.push({ type: 'chomp', x: s.x, y: s.y, r: s.r, life: .35, c: '#8a1020' }); killFoe(world, f);
      if (world === room) { for (let i = d0; i < room.drops.length; i++) { const q = fx() * TAU, v = 160 + fx() * 140; Object.assign(room.drops[i], { x: s.x, y: s.y - 6, vx: Math.cos(q) * v, vy: Math.sin(q) * v * .6 - 80 }); } room.fxs.push({ type: 'spit', x: s.x, y: s.y, r: 14, life: .45, c: '#ff9a3a' }); }
      lgSnd(world, 'lgGulp', s.x);
    } else { s.hit.length = 0; onHit(world, s, f); world.fxs.push({ type: 'chomp', x: f.x, y: f.y, r: f.r + 6, life: .25, c: '#8a1020' }); }
  }
}
function lgHalo(world, s, dt) {
  const o = s.owner; s.vx = s.vy = 0;
  if (o && o.x != null) { s.x = o.x; s.y = o.y - 40; if (o.down) { s.life = 0; return; } }
  for (const f of world.foes) {
    if (f.dead || f.spawnT > 0 || f.hcd > 0) continue;
    const attacking = f.wind > 0 || f.lunge > 0 || f._fired > 0 || (f.boss && f.atk != null && f.atk < .2);
    if (!attacking) continue;
    if (world === room && o && foeTarget(f) !== o) continue; // only enemies attacking the halo's bearer
    f.hcd = .55; s.hit.length = 0; s.pierce = 999; onHit(world, s, f);
    world.fxs.push({ type: 'halobeam', x: s.x, y: s.y, x2: f.x, y2: f.y - f.r, r: 4, life: .32, c: '#fff2b0' });
    lgSnd(world, 'lgBeam', f.x);
  }
}
function lgStar(world, s, dt) {
  if (s.released) return;
  const o = s.owner && s.owner.x != null ? s.owner : null;
  let mv = 0; if (o) { mv = Math.hypot(o.x - s.lx, o.y - s.ly) / Math.max(dt, 1e-3); s.lx = o.x; s.ly = o.y; s.x = o.x; s.y = o.y; if (o.down) mv = 999; }
  if (mv > 25 && s.age > .05) { if (s.grow < .5) { s.released = true; s.fizzled = true; s.life = .3; world.fxs.push({ type: 'fizzle', x: s.x, y: s.y - 10, r: 16, life: .6, c: '#8aa0c8' }); lgSnd(world, 'lgFizzle', s.x); } else lgStarRelease(world, s); return; }
  s.grow = Math.min(3, s.grow + dt);
  if (fx() < .4 && world.parts.length < PCAP()) { const q = fx() * TAU; world.parts.push({ x: s.x + Math.cos(q) * 26, y: s.y + Math.sin(q) * 11, vx: 0, vy: -50 - s.grow * 30, life: .5, c: '#cfe0ff', s: 1.6, ember: true }); }
  if (s.grow >= 3) lgStarRelease(world, s);
}
function lgStarRelease(world, s) {
  s.released = true; s.life = .6; const n = Math.min(LCAP.meteors, 1 + Math.round(s.grow * 3)); s.meteors = n;
  const foes = world.foes.filter(f => !f.dead && f.spawnT <= 0), pend = world.pending || (world.pending = []);
  for (let i = 0; i < n; i++) {
    const f = foes.length ? foes[i % foes.length] : null, x = f ? f.x + (fx() - .5) * 30 : s.x + (fx() - .5) * 260, y = f ? f.y : s.y - 60 - fx() * 140;
    pend.push({ t: .15 + i * .13, s: { p: 'meteor', mods: s.mods || [], off: 0, starfall: true }, x, y, ang: 0, wand: s.wand, caster: { x, y }, mul: .55 });
  }
  world.fxs.push({ type: 'ring', x: s.x, y: s.y + 10, r: 10, R: 70, life: .5, c: '#cfe0ff' });
  lgSnd(world, 'lgStarfall', s.x, String(n));
}
const LG_SOLO = { lastpage: 1, requiem: 1, starfall: 1, saintshalo: 1, eternalflame: 1, ossuary: 1 };
function lgTick(world, s, dt) {
  if (s.lgk) switch (s.lgk) {
    case 'requiem': if (s.tolls < 3 && s.age >= .6 + s.tolls) { s.tolls++; lgToll(world, s); } return true;
    case 'lastpage': case 'ossuary': return true;
    case 'cathedralfall':
      if (s.fall) { s.wvz += 900 * dt; s.wz -= s.wvz * dt; if (s.wz <= 0) { s.wz = 0; s.fall = false; s.life = .35; lgSpireLand(world, s); } }
      return true;
    case 'abyssalmaw': lgMaw(world, s, dt); return true;
    case 'saintshalo': lgHalo(world, s, dt); return true;
    case 'starfall': lgStar(world, s, dt); return true;
    case 'eternalflame': if (s.wand) s.wand.mana = Math.max(0, s.wand.mana - 3 * dt); break;
  }
  // Time Fracture: fly briefly without hitting, freeze, then replay 3 times from the frozen spot
  if (s.tfT) {
    if (!s.tfF) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.age >= s.tfT) { s.tfF = { a: Math.atan2(s.vy, s.vx) }; s.tfN = 0; s.tfNext = 1; s.vx = s.vy = 0; s.grow = 0; world.fxs.push({ type: 'tfreeze', x: s.x, y: s.y, r: s.r + 10, life: .5, c: '#bfe8ff' }); lgSnd(world, 'lgFracture', s.x); }
      return true;
    }
    s.tfNext -= dt; s.spin -= dt * 14;
    if (s.tfNext <= 0) {
      s.tfN++; const sp = Object.assign({}, s.spec, { tfCopy: true, trig: s.spec.trig, mods: s.spec.mods.filter(q => q !== 'timefracture') });
      if (world.shots.length < LCAP.shots) lgSpawnFrom(world, s, sp, s.x, s.y, s.tfF.a);
      world.fxs.push({ type: 'tfreplay', x: s.x, y: s.y, r: s.r + 12, life: .4, c: '#bfe8ff', n: s.tfN }); lgSnd(world, 'lgTick', s.x, String(s.tfN));
      if (s.tfN >= 3) { s.life = 0; s.tfDone = true; world.fxs.push({ type: 'tshatter', x: s.x, y: s.y, r: s.r + 8, life: .45, c: '#dff4ff' }); } else s.tfNext = 1;
    }
    return true;
  }
  // Soulbound: steer with the owner's aim and movement; shatters when the owner is hurt
  if (s.soul) {
    const S = s.soul, o = S.o;
    if ((o.lgHurtN || 0) > S.h0 || o.down) { s.life = 0; s.soulBroke = true; s.recur = undefined; world.fxs.push({ type: 'soulbreak', x: s.x, y: s.y, r: s.r + 8, life: .45, c: '#c8a0ff' }); lgSnd(world, 'lgFizzle', s.x); return true; }
    const mx = o.x - S.lx, my = o.y - S.ly; S.lx = o.x; S.ly = o.y; if (Math.abs(mx) + Math.abs(my) < 60) { s.x += mx * .8; s.y += my * .8; }
    const want = o.face != null ? o.face : Math.atan2(s.vy, s.vx), cur = Math.atan2(s.vy, s.vx); let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    const na = cur + clamp(d, -5 * dt, 5 * dt), sp = Math.hypot(s.vx, s.vy); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
  }
  // Cathedral rubble blocks spells (yours too)
  if (world.walls && world.walls.length && s.novaR === undefined && s.groundY === undefined && !s.orbit) {
    for (const w of world.walls) {
      const dx = s.x - w.x, dy = s.y - (w.y - 8), d = Math.hypot(dx, dy);
      if (d > w.r + s.r) continue;
      if (s.bounce > 0) { const nx = dx / (d || 1), ny = dy / (d || 1), dot = s.vx * nx + s.vy * ny; if (dot < 0) { s.vx -= 2 * dot * nx; s.vy -= 2 * dot * ny; s.bounce--; } s.x = w.x + nx * (w.r + s.r + 1); s.y = w.y - 8 + ny * (w.r + s.r + 1); }
      else { s.life = 0; s.blocked = true; world.fxs.push({ type: 'dust', x: s.x, y: s.y, r: 8, life: .35, c: '#b8b0a0' }); }
      break;
    }
  }
  return false;
}
function lgHitMul(world, s, f) {
  let k = 1; const o = s.owner;
  if (o && o._halo && o._halo.life > 0 && s.lgk !== 'saintshalo') k *= .7;
  return k;
}
function lgAfterHit(world, s, f, killed, dmg) {
  const o = s.owner;
  if (s.bond && !s._fate) {
    const B = s.bond; if (!B.foes.includes(f) && B.foes.length < LCAP.bond) B.foes.push(f); f.bondT = 4;
    let n = 0; s._fate = true;
    for (const q of B.foes) { if (q === f || q.dead) continue; hurtFoe(world, q, dmg * .6); if (n++ < 4) world.fxs.push({ type: 'fate', x: f.x, y: f.y - f.r, x2: q.x, y2: q.y - q.r, r: 2, life: .3, c: '#e8c060' }); }
    s._fate = false; if (n) lgSnd(world, 'lgFate', f.x);
  }
  if (s.heretic && !f.dummy && !f.dead) { const was = f.heretic > 0; f.heretic = f.boss ? 1 : 3; f.rage = 0; if (!was) { world.fxs.push({ type: 'heresy', x: f.x, y: f.y - f.r * 2.2, r: 8, life: .5, c: '#d0203a' }); lgSnd(world, 'lgHeretic', f.x); } }
  if (s.invert && o && o.x != null && !(o.invertT > 0)) { o.invertT = 2; o.exposeT = 0; world.fxs.push({ type: 'invert', x: o.x, y: o.y, r: 18, life: .6, c: '#ff6a8a' }); lgSnd(world, 'lgInvert', o.x); }
  if (!killed) return;
  if (s.asc) { const m = world.asc || (world.asc = new Map()), key = o || world, v = Math.min(25, (m.get(key) || 0) + 1); m.set(key, v); world.fxs.push({ type: 'ascend', x: f.x, y: f.y - f.r, r: 10, life: .7, c: '#fff2b0', n: v }); lgSnd(world, 'lgAscend', f.x, String(v)); }
  if (s.ash !== undefined && s.ash < LCAP.ash()) {
    const n = LCAP.ashCopies(); if ((world.ashB == null ? 24 : world.ashB) < n || world.shots.length > LCAP.shots - n) return;
    world.ashB = (world.ashB == null ? 24 : world.ashB) - n;
    const sp = Object.assign({}, s.spec, { ashD: s.ash + 1, trig: null, payload: null, mods: s.spec.mods.filter(q => q !== 'recursion' && q !== 'timefracture') });
    for (let i = 0; i < n; i++) { const c = lgSpawnFrom(world, s, sp, f.x, f.y - f.r, i * TAU / n + fx() * .5); if (c) { c.dmg = s.dmg * .6; c.hit.push(f); } }
    world.fxs.push({ type: 'ashburst', x: f.x, y: f.y - f.r, r: f.r + 6, life: .55, c: '#ff8a3a', n: s.ash + 1 }); lgSnd(world, 'lgAsh', f.x);
  }
}
function lgEnd(world, s) {
  if (s.recur === undefined || s.soulBroke || s.blocked && s.recur > 0 || (s.lgk && LG_SOLO[s.lgk]) || s.fizzled || s.tfT) return;
  if (s.recur >= LCAP.recur() || s.dmg * .5 < 1.5 || world.shots.length >= LCAP.shots) return;
  const sp = Object.assign({}, s.spec, { recD: s.recur + 1, trig: null, payload: null });
  const A = world.bounds, x = A ? clamp(s.x, A.x0 + 6, A.x1 - 6) : s.x, y = A ? clamp(s.y, A.y0 + 6, A.y1 - 6) : s.y, t = nearestFoe(world, x, y, s.hit);
  const a = t ? Math.atan2(t.y - t.r * .8 - y, t.x - x) : (Math.hypot(s.vx, s.vy) > 1 ? Math.atan2(s.vy, s.vx) + Math.PI : s.ang) + (fx() - .5) * .8; // recast from where it ended, at the nearest foe
  const n = lgSpawnFrom(world, s, sp, x, y, a); if (!n) return;
  n.dmg = s.dmg * .5; n.r = Math.max(2, s.r * .85); n.life = Math.max(.25, n.life * .7);
  world.fxs.push({ type: 'recur', x: s.x, y: s.y, r: s.r + 8, life: .35, c: '#b0a0ff', n: s.recur + 1 }); lgSnd(world, 'lgRecur', s.x, String(s.recur + 1));
}
function lgStatus(world, f, dt) {
  if (f.heretic > 0) { f.heretic -= dt; if (f.heretic <= 0) { f.heretic = 0; if (!f.boss) { f.rage = 2; f._spd0 = f.spd; f.spd *= 1.3; } } }
  if (f.rage > 0) { f.rage -= dt; if (f.rage <= 0 && f._spd0) { f.spd = f._spd0; f._spd0 = 0; } }
  for (const k of ['bondT', 'hsc', 'hcd', '_fired']) if (f[k] > 0) f[k] -= dt;
}
function lgDeath(world, f) {
  const D = world.deaths || (world.deaths = []); D.push({ x: f.x, y: f.y, t: world.lgt || 0 }); if (D.length > 24) D.shift();
}
function lgWorld(world, dt) {
  world.lgt = (world.lgt || 0) + dt; world.ashB = Math.min(24, (world.ashB == null ? 24 : world.ashB) + 24 * dt);
  const A = world.bounds;
  if (world.walls && world.walls.length) {
    for (const w of world.walls) {
      w.life -= dt;
      if (world.guest) continue;
      for (const f of world.foes) { if (f.dead || f.boss) continue; const dx = f.x - w.x, dy = f.y - w.y, d = Math.hypot(dx, dy) || 1, m = w.r + f.r * .8; if (d < m) { f.x = w.x + dx / d * m; f.y = w.y + dy / d * m; f.kx *= .5; f.ky *= .5; } }
      if (w.life <= 0) world.fxs.push({ type: 'crumble', x: w.x, y: w.y, r: w.r, life: .5, c: '#9a907e' });
    }
    world.walls = world.walls.filter(w => w.life > 0);
  }
  if (world.allies && world.allies.length && !world.guest) {
    for (const a of world.allies) {
      a.life -= dt; if (a.raise > 0) { a.raise -= dt; continue; }
      a.atkT -= dt; a.swing = Math.max(0, (a.swing || 0) - dt);
      const t = nearestFoe(world, a.x, a.y); if (!t) continue;
      const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1; a.face = dx >= 0 ? 1 : -1;
      if (d > a.r + t.r + 4) { a.x += dx / d * 95 * dt; a.y += dy / d * 95 * dt; a.walk += dt * 10; }
      else { a.hp -= (t.boss ? 10 : 6) * dt; if (a.atkT <= 0) { a.atkT = .7; a.swing = .25; const lethal = !t.dummy && t.hp <= a.dmg * (t.hex > 0 ? 1.3 : 1) * (t.mark > 0 ? 1.35 : 1); if (lethal) t.skelKill = true; const k = hurtFoe(world, t, a.dmg, dx / d * 60, dy / d * 60); if (!k) t.skelKill = false; world.fxs.push({ type: 'slash', x: t.x, y: t.y - t.r, r: t.r + 4, life: .2, c: '#e8e0c8' }); } }
      if (A) { a.x = clamp(a.x, A.x0 + a.r, A.x1 - a.r); a.y = clamp(a.y, A.y0 + a.r, A.y1 - a.r); }
      if (a.life <= 0 || a.hp <= 0) { a.life = 0; world.fxs.push({ type: 'crumble', x: a.x, y: a.y, r: 10, life: .5, c: '#d8d0b8' }); }
    }
    world.allies = world.allies.filter(a => a.life > 0);
  } else if (world.allies && world.guest) for (const a of world.allies) a.life -= dt;
  if (world.lgOwn) for (const o of world.lgOwn) {
    if (o.invertT > 0) { o.invertT -= dt; if (o.invertT <= 0) { o.invertT = 0; o.exposeT = 1.5; world.fxs.push({ type: 'expose', x: o.x, y: o.y, r: 16, life: .5, c: '#ff3a4a' }); } }
    else if (o.exposeT > 0) o.exposeT -= dt;
    if (o._halo && o._halo.life <= 0) o._halo = null;
  }
  if (world === room && room.eshots && !world.guest) {
    for (const b of room.eshots) {
      if (b._lg === undefined) { b._lg = 1; let src = null, bd = 1e9; for (const f of room.foes) { if (f.dead) continue; const d = Math.hypot(f.x - b.x, f.y - 20 - b.y); if (d < bd) { bd = d; src = f; } } if (src && bd < src.r + 40) { b.src = src; if (src.heretic > 0) b.her = true; else src._fired = .35; } }
      if (b.her && b.life > 0) for (const f of room.foes) if (f !== b.src && !f.dead && Math.hypot(f.x - b.x, f.y - f.r * .6 - b.y) < f.r + 6) { hurtFoe(room, f, b.dmg); b.life = 0; world.fxs.push({ type: 'slash', x: f.x, y: f.y - f.r, r: f.r + 4, life: .2, c: '#d0203a' }); break; }
    }
  }
}
// ---------- co-op/solo hook wrappers ----------
{
  const _ft = foeTarget;
  foeTarget = f => { if (f && f.heretic > 0 && room) { let b = null, bd = 1e9; for (const o of room.foes) { if (o === f || o.dead || o.spawnT > 0) continue; const d = Math.hypot(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; b = o; } } if (b) return b; } return _ft(f); };
  const _ht = hurtTarget;
  hurtTarget = (T, d) => {
    if (!T) return;
    if (T.max != null && T.type && room && room.foes.includes(T)) { if (!(T.hsc > 0)) { T.hsc = .5; hurtFoe(room, T, d); room.fxs.push({ type: 'slash', x: T.x, y: T.y - T.r, r: T.r + 4, life: .2, c: '#d0203a' }); } return; }
    if (T.invertT > 0) { if (T.inv > 0 || T.dodgeT > 0 || T.dodge || T.down) return; lgHeal(T, d); T.inv = .5; if (room) { room.fxs.push({ type: 'invert', x: T.x, y: T.y, r: 14, life: .45, c: '#7dff9a' }); lgSnd(room, 'lgHealInv', T.x); } T.lgInvHeals = (T.lgInvHeals || 0) + 1; return; }
    if (T.exposeT > 0) d *= 1.5;
    const hp = o => o === P ? (G ? G.flame : 0) : o.hp, before = hp(T);
    _ht(T, d);
    if (hp(T) < before) T.lgHurtN = (T.lgHurtN || 0) + 1;
  };
  const _co = corpse; corpse = f => { if (!f.swallowed) _co(f); };
  const _ds = drawShape2; drawShape2 = (b, C, r, a) => { if (C.lgk) { lgShape(b, C, r, a); return true; } return _ds(b, C, r, a); };
  const _fx2 = drawFx2; drawFx2 = f => lgFx(f) || _fx2(f);
  const _fs = drawFoeStatus2; drawFoeStatus2 = (f, t) => { _fs(f, t); lgFoeStatus(f, t); };
  const _ee = extraEnts; extraEnts = () => { const e = _ee(); if (room) { const t = performance.now() / 1000; for (const w of room.walls || []) e.push({ y: w.y, d: () => lgDrawWall(w) }); for (const a of room.allies || []) e.push({ y: a.y, d: () => lgDrawSkel(a, t) }); } return e; };
  const _dp = drawPatches; drawPatches = wd => { _dp(wd); if (wd !== room) { const t = performance.now() / 1000; for (const w of wd.walls || []) lgDrawWall(w); for (const a of wd.allies || []) lgDrawSkel(a, t); } };
}
// ---------- visuals (crisp vector shapes, no blur) ----------
const LG_GOLD = '#e8c060', LG_CRIM = '#b0102a';
function lgShape(b, C, r, a) {
  const t = b.age || 0, L = b.life == null ? 1 : b.life;
  switch (C.shape) {
    case 'requiem': {
      const fade = Math.min(1, t * 4, Math.max(0, L) * 3), sw = Math.sin(t * 3.2) * .22; cx.globalAlpha *= fade;
      cx.strokeStyle = 'rgba(200,220,255,.5)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(0, -40); cx.lineTo(0, -22); cx.stroke();
      cx.rotate(sw);
      cx.fillStyle = 'rgba(150,180,240,.28)'; cx.strokeStyle = '#d8e6ff'; cx.lineWidth = 1.6;
      cx.beginPath(); cx.moveTo(-6, -22); cx.quadraticCurveTo(-9, -6, -17, 6); cx.lineTo(17, 6); cx.quadraticCurveTo(9, -6, 6, -22); cx.closePath(); cx.fill(); cx.stroke();
      cx.strokeStyle = LG_GOLD; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(-15, 3); cx.lineTo(15, 3); cx.moveTo(-8, -10); cx.lineTo(8, -10); cx.stroke();
      cx.fillStyle = '#f0f6ff'; cx.beginPath(); cx.arc(Math.sin(t * 3.2 + 1) * 4, 9, 3, 0, TAU); cx.fill();
      cx.rotate(-sw);
      for (let i = 0; i < 3; i++) { const on = i < (b.tolls || 0); cx.fillStyle = on ? LG_GOLD : 'rgba(216,230,255,.35)'; cx.beginPath(); cx.arc(-8 + i * 8, -30, 2, 0, TAU); cx.fill(); }
      const ph = (t - .6) % 1; if (t > .6 && ph < .5) { cx.strokeStyle = `rgba(216,230,255,${(.5 - ph) * 1.6})`; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(0, 4, 20 + ph * 120, (20 + ph * 120) * .45, 0, 0, TAU); cx.stroke(); }
      cx.globalAlpha /= fade || 1; return;
    }
    case 'lastpage': {
      const k = 1 - Math.max(0, L) / .55; cx.rotate(Math.sin(t * 9) * .15); cx.fillStyle = '#efe0b8'; cx.strokeStyle = '#7a5a2a'; cx.lineWidth = 1;
      const h = 18 * (1 - k * .9); cx.beginPath(); cx.rect(-6, 9 - h, 12, h); cx.fill(); cx.stroke();
      cx.strokeStyle = '#8a7050'; cx.beginPath(); for (let i = 0; i < 3; i++) { const y = 6 - i * 4; if (y > 9 - h) { cx.moveTo(-4, y); cx.lineTo(4, y); } } cx.stroke();
      cx.fillStyle = '#ff8a2a'; cx.beginPath(); cx.moveTo(-7, 9 - h); for (let i = 0; i <= 6; i++) cx.lineTo(-7 + i * 14 / 6, 9 - h - (i % 2 ? 4 + fx() * 2 : 0)); cx.closePath(); cx.fill();
      cx.fillStyle = '#ffe08a'; cx.fillRect(-4, 8 - h, 8, 1.5); return;
    }
    case 'spire': {
      const z = b.wz || 0;
      if (z > 0) {
        cx.strokeStyle = 'rgba(232,192,96,.8)'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(0, z, 26, 10, 0, 0, TAU); cx.stroke(); cx.setLineDash([3, 3]); cx.beginPath(); cx.ellipse(0, z, 60, 24, 0, 0, TAU); cx.stroke(); cx.setLineDash([]);
        cx.fillStyle = '#8a8274'; cx.strokeStyle = '#2a241c'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(0, -46); cx.lineTo(10, -14); cx.lineTo(10, 14); cx.lineTo(-10, 14); cx.lineTo(-10, -14); cx.closePath(); cx.fill(); cx.stroke();
        cx.fillStyle = '#c8beaa'; cx.beginPath(); cx.moveTo(0, -46); cx.lineTo(4, -14); cx.lineTo(-4, -14); cx.closePath(); cx.fill();
        cx.fillStyle = LG_CRIM; cx.beginPath(); cx.moveTo(-4, 8); cx.lineTo(-4, -2); cx.arc(0, -2, 4, Math.PI, 0); cx.lineTo(4, 8); cx.closePath(); cx.fill(); cx.strokeStyle = LG_GOLD; cx.lineWidth = .8; cx.stroke();
        cx.strokeStyle = LG_GOLD; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(0, -46); cx.lineTo(0, -56); cx.moveTo(-4, -52); cx.lineTo(4, -52); cx.stroke();
        cx.strokeStyle = 'rgba(255,255,255,.5)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-6, -60); cx.lineTo(-6, -90); cx.moveTo(6, -62); cx.lineTo(6, -84); cx.stroke();
      }
      return;
    }
    case 'maw': {
      const o = Math.max(.05, b.grow == null ? 1 : b.grow), R = b.r || 34, rx = R * o, ry = R * .42 * o;
      cx.fillStyle = '#12020a'; cx.beginPath(); cx.ellipse(0, 0, rx + 3, ry + 3, 0, 0, TAU); cx.fill();
      cx.fillStyle = '#5a0812'; cx.beginPath(); cx.ellipse(0, 0, rx, ry, 0, 0, TAU); cx.fill();
      cx.fillStyle = '#0a0004'; cx.beginPath(); cx.ellipse(0, ry * .15, rx * .7, ry * .55, 0, 0, TAU); cx.fill();
      cx.fillStyle = '#efe6d0'; const n = 12;
      for (let i = 0; i < n; i++) { const q = i * TAU / n, x = Math.cos(q) * rx, y = Math.sin(q) * ry, ix = Math.cos(q) * rx * .72, iy = Math.sin(q) * ry * .72, tq = q + Math.PI / 2; cx.beginPath(); cx.moveTo(x + Math.cos(tq) * 3, y + Math.sin(tq) * 1.4); cx.lineTo(ix, iy); cx.lineTo(x - Math.cos(tq) * 3, y - Math.sin(tq) * 1.4); cx.closePath(); cx.fill(); }
      cx.strokeStyle = '#d0203a'; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(0, 0, rx + 1, ry + 1, 0, 0, TAU); cx.stroke();
      return;
    }
    case 'halo': {
      const p = 1 + Math.sin(t * 5) * .08; cx.strokeStyle = '#fff2b0'; cx.lineWidth = 2.4; cx.beginPath(); cx.ellipse(0, 0, 13 * p, 4.5 * p, 0, 0, TAU); cx.stroke();
      cx.strokeStyle = LG_GOLD; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(0, 0, 16 * p, 6 * p, 0, 0, TAU); cx.stroke();
      cx.fillStyle = '#fffbe0'; for (let i = 0; i < 5; i++) { const q = -Math.PI + i * Math.PI / 4, x = Math.cos(q) * 13 * p, y = Math.sin(q) * 4.5 * p; cx.beginPath(); cx.moveTo(x - 1.4, y); cx.lineTo(x, y - 6 - (i % 2 ? 0 : 3)); cx.lineTo(x + 1.4, y); cx.closePath(); cx.fill(); }
      if (b.life < 1.5 && Math.floor(t * 10) % 2) cx.globalAlpha *= .5;
      return;
    }
    case 'eternal': {
      cx.save(); cx.rotate(a);
      cx.fillStyle = '#b02a10'; cx.beginPath(); cx.moveTo(-r * 3.6, 0); cx.quadraticCurveTo(-r, -r * 1.4, 0, -r * 1.1); cx.arc(0, 0, r * 1.1, -Math.PI / 2, Math.PI / 2); cx.quadraticCurveTo(-r, r * 1.4, -r * 3.6, 0); cx.fill();
      cx.fillStyle = '#ffb030'; cx.beginPath(); cx.moveTo(-r * 2.4, 0); cx.quadraticCurveTo(-r * .6, -r, 0, -r * .8); cx.arc(0, 0, r * .8, -Math.PI / 2, Math.PI / 2); cx.quadraticCurveTo(-r * .6, r, -r * 2.4, 0); cx.fill();
      cx.restore();
      cx.fillStyle = '#ffffff'; cx.beginPath(); cx.moveTo(0, -r * .9); cx.quadraticCurveTo(r * .45, 0, 0, r * .4); cx.quadraticCurveTo(-r * .45, 0, 0, -r * .9); cx.fill();
      cx.strokeStyle = LG_GOLD; cx.lineWidth = 1; cx.beginPath(); for (let i = 0; i < 4; i++) { const q = b.spin * .4 + i * TAU / 4; cx.moveTo(Math.cos(q) * (r + 4), Math.sin(q) * (r + 4)); cx.lineTo(Math.cos(q) * (r + 7), Math.sin(q) * (r + 7)); } cx.stroke();
      return;
    }
    case 'ossuary': {
      const k = Math.min(1, t / .5), R = 10 + k * 26; cx.globalAlpha *= Math.max(0, Math.min(1, (b.life == null ? 1 : b.life) * 3));
      cx.strokeStyle = '#d8e8c8'; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(0, 8, R, R * .4, 0, 0, TAU); cx.stroke();
      cx.fillStyle = '#e8e0c8'; for (let i = 0; i < 8; i++) { const q = i * TAU / 8 + t * 2, x = Math.cos(q) * R, y = 8 + Math.sin(q) * R * .4; cx.save(); cx.translate(x, y); cx.rotate(q); cx.fillRect(-3, -.8, 6, 1.6); cx.beginPath(); cx.arc(-3, 0, 1.4, 0, TAU); cx.arc(3, 0, 1.4, 0, TAU); cx.fill(); cx.restore(); }
      return;
    }
    case 'starfall': {
      const g = Math.min(3, b.grow || 0), k = g / 3, R = 18 + k * 18, rot = t * (1 + k * 2); cx.translate(0, 6);
      cx.strokeStyle = b.released ? 'rgba(207,224,255,.5)' : '#cfe0ff'; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(0, 0, R, R * .42, 0, 0, TAU); cx.stroke();
      cx.beginPath(); for (let i = 0; i <= 5; i++) { const q = rot + i * TAU * 2 / 5 - Math.PI / 2; cx.lineTo(Math.cos(q) * R * .9, Math.sin(q) * R * .38); } cx.stroke();
      cx.strokeStyle = LG_GOLD; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(0, 0, R + 4, (R + 4) * .42, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k); cx.stroke();
      if (g >= .5) { cx.fillStyle = '#fff6d0'; const n = Math.min(10, 1 + Math.round(g * 3)); for (let i = 0; i < n; i++) { const q = i * TAU / 10 - Math.PI / 2; cx.fillRect(Math.cos(q) * (R + 9) - 1, Math.sin(q) * (R + 9) * .42 - 1, 2, 2); } }
      cx.translate(0, -6); return;
    }
  }
}
function lgOverlays(b, r, a) {
  const o = b.lv, sp = b.spin || 0;
  if (o & LVB.recursion) { cx.strokeStyle = '#b0a0ff'; cx.lineWidth = .9; for (const s of [-1, 1]) { cx.beginPath(); cx.arc(s * 3 + Math.cos(sp) * (r + 6), Math.sin(sp) * (r + 6), 2.2, 0, TAU); cx.stroke(); } }
  if (o & LVB.martyrdom) { cx.fillStyle = '#d0203a'; cx.beginPath(); cx.moveTo(0, -r - 9); cx.quadraticCurveTo(3, -r - 4, 0, -r - 2.5); cx.quadraticCurveTo(-3, -r - 4, 0, -r - 9); cx.fill(); }
  if (o & LVB.fatebinding) { cx.strokeStyle = LG_GOLD; cx.lineWidth = .8; cx.beginPath(); for (let i = 0; i <= 10; i++) { const k = i / 10, x = -Math.cos(a) * (r + 2 + k * 16), y = -Math.sin(a) * (r + 2 + k * 16); cx.lineTo(x - Math.sin(a) * Math.sin(k * 9 + sp) * 2.5, y + Math.cos(a) * Math.sin(k * 9 + sp) * 2.5); } cx.stroke(); }
  if (o & LVB.timefracture) { cx.strokeStyle = '#bfe8ff'; cx.lineWidth = 1; cx.beginPath(); cx.arc(0, 0, r + 5, 0, TAU); cx.stroke(); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.cos(sp * .5) * (r + 4), Math.sin(sp * .5) * (r + 4)); cx.stroke(); }
  if (o & LVB.ascension) { cx.fillStyle = '#fff2b0'; for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(s * (r + 1), -1); cx.lineTo(s * (r + 9), -5 - Math.sin(sp) * 2); cx.lineTo(s * (r + 6), 0); cx.lineTo(s * (r + 8), 2); cx.closePath(); cx.fill(); } }
  if (o & LVB.soulbound) { cx.strokeStyle = '#c8a0ff'; cx.lineWidth = 1; cx.setLineDash([2, 2]); cx.beginPath(); cx.arc(0, 0, r + 3, sp, sp + Math.PI * 1.5); cx.stroke(); cx.setLineDash([]); }
  if (o & LVB.hereticmark) { cx.strokeStyle = '#d0203a'; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(r + 2, -r - 2); cx.lineTo(r + 8, -r - 8); cx.moveTo(r + 3, -r - 6); cx.lineTo(r + 6, -r - 3); cx.stroke(); }
  if (o & LVB.inversion) { cx.strokeStyle = '#ff6a8a'; cx.lineWidth = 1; for (const s of [0, Math.PI]) { const q = -sp + s; cx.beginPath(); cx.arc(0, 0, r + 6, q, q + 1.2); cx.stroke(); const ex = Math.cos(q + 1.2) * (r + 6), ey = Math.sin(q + 1.2) * (r + 6); cx.beginPath(); cx.arc(ex, ey, 1.3, 0, TAU); cx.fill(); } }
  if (o & LVB.grimoireecho) { cx.strokeStyle = 'rgba(232,192,96,.75)'; cx.lineWidth = .9; cx.strokeRect(-Math.cos(a) * 8 - r, -Math.sin(a) * 8 - r, r * 2, r * 2); }
  if (o & LVB.crownedash) { cx.fillStyle = '#ff9a3a'; cx.beginPath(); cx.moveTo(-5, -r - 3); cx.lineTo(-5, -r - 8); cx.lineTo(-2.5, -r - 5.5); cx.lineTo(0, -r - 9); cx.lineTo(2.5, -r - 5.5); cx.lineTo(5, -r - 8); cx.lineTo(5, -r - 3); cx.closePath(); cx.fill(); }
}
function lgFoeStatus(f, t) {
  const top = f.y - f.r * 2.3 - 14;
  if (f.heretic > 0 || (f.st & 256)) { cx.fillStyle = '#d0203a'; cx.strokeStyle = '#1a0006'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(f.x, top - 8); cx.lineTo(f.x + 2.2, top + 2); cx.lineTo(f.x - 2.2, top + 2); cx.closePath(); cx.fill(); cx.stroke(); cx.fillRect(f.x - 4, top + 2, 8, 1.6); cx.fillRect(f.x - .8, top + 3.6, 1.6, 3); }
  if (f.bondT > 0 || (f.st & 512)) { cx.strokeStyle = LG_GOLD; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(f.x, f.y - f.r * .9, f.r + 3, (f.r + 3) * .5, Math.sin(t * 3) * .3, 0, TAU); cx.stroke(); }
  if (f.rage > 0 || (f.st & 1024)) { cx.fillStyle = 'rgba(255,60,60,.8)'; for (let i = -1; i <= 1; i++) cx.fillRect(f.x + i * 5 - .8, top + 4 - ((t * 20 + i * 3) % 8), 1.6, 3); }
}
function lgFx(f) {
  const k = f.life;
  switch (f.type) {
    case 'snd': if (!f._p) { f._p = 1; if (room && room.guest) au(f.txt, f.x, f.c); } return true;
    case 'toll': { const R = 30 + (.8 - k) * 300; cx.strokeStyle = '#d8e6ff'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(f.x, f.y + 40, R, R * .45, 0, 0, TAU); cx.stroke(); cx.strokeStyle = LG_GOLD; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(f.x, f.y + 40, R * .8, R * .36, 0, 0, TAU); cx.stroke(); return true; }
    case 'halobeam': { cx.strokeStyle = '#fff2b0'; cx.lineWidth = 4 * k / .32; cx.beginPath(); cx.moveTo(f.x, f.y); cx.lineTo(f.x2, f.y2); cx.stroke(); cx.strokeStyle = '#ffffff'; cx.lineWidth = 1.2; cx.stroke(); cx.fillStyle = '#fffbe0'; cx.beginPath(); cx.arc(f.x2, f.y2, 5 * k / .32 + 1, 0, TAU); cx.fill(); return true; }
    case 'chomp': { const c = Math.min(1, (.35 - k) * 6); cx.fillStyle = '#efe6d0'; for (const s of [-1, 1]) for (let i = -2; i <= 2; i++) { const x = f.x + i * f.r * .3, y = f.y + s * f.r * .4 * (1 - c); cx.beginPath(); cx.moveTo(x - 3, y); cx.lineTo(x, y - s * 6); cx.lineTo(x + 3, y); cx.closePath(); cx.fill(); } return true; }
    case 'spit': case 'ashburst': case 'dust': case 'spiredust': case 'crumble': { const n = f.type === 'dust' ? 5 : 9, R = f.r * (1.5 - k); cx.fillStyle = f.c; for (let i = 0; i < n; i++) { const q = i * TAU / n + f.x * .1; const s = f.type === 'crumble' ? 3 : 2; cx.fillRect(f.x + Math.cos(q) * R - s / 2, f.y - 6 + Math.sin(q) * R * .6 - s / 2 + (f.type === 'crumble' ? (.5 - k) * 16 : 0), s, s); } if (f.type === 'ashburst') { cx.strokeStyle = '#ff9a3a'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(f.x, f.y, R, 0, TAU); cx.stroke(); } return true; }
    case 'burnpage': { const y = f.y - (1.1 - k) * 30; cx.fillStyle = '#ffb050'; for (let i = 0; i < 7; i++) { const q = i * 1.7 + k * 4; cx.fillRect(f.x + Math.sin(q) * 10 * (1.2 - k), y - i * 3, 2, 2); } cx.fillStyle = '#3a2a1a'; cx.fillRect(f.x - 4 * k, y + 4, 8 * k, 1.5); return true; }
    case 'fizzle': { cx.strokeStyle = f.c; cx.lineWidth = 1.2; cx.beginPath(); for (let i = 0; i < 4; i++) { const x = f.x - 9 + i * 6; cx.moveTo(x, f.y - (.6 - k) * 20); cx.quadraticCurveTo(x + 3, f.y - 6 - (.6 - k) * 20, x, f.y - 12 - (.6 - k) * 20); } cx.stroke(); return true; }
    case 'raise': { cx.strokeStyle = f.c; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(f.x, f.y, f.r * (1.4 - k), f.r * .4 * (1.4 - k), 0, 0, TAU); cx.stroke(); cx.fillStyle = '#7dff9a'; cx.fillRect(f.x - 1, f.y - 20 * (1 - k), 2, 6); return true; }
    case 'slash': { cx.strokeStyle = f.c; cx.lineWidth = 2; cx.beginPath(); cx.arc(f.x, f.y, f.r, -2.4 + (.2 - k) * 8, -1 + (.2 - k) * 8); cx.stroke(); return true; }
    case 'fate': { cx.strokeStyle = f.c; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(f.x, f.y); const mx = (f.x + f.x2) / 2, my = (f.y + f.y2) / 2 - 18; cx.quadraticCurveTo(mx, my, f.x2, f.y2); cx.stroke(); cx.fillStyle = f.c; cx.beginPath(); cx.arc(f.x2, f.y2, 2, 0, TAU); cx.fill(); return true; }
    case 'tfreeze': case 'tfreplay': { const R = f.r * (f.type === 'tfreeze' ? (1.5 - k) : 1 + (.4 - k) * 2); cx.strokeStyle = f.c; cx.lineWidth = 1.4; cx.beginPath(); cx.arc(f.x, f.y, R, 0, TAU); cx.stroke(); for (let i = 0; i < 12; i++) { const q = i * TAU / 12; cx.beginPath(); cx.moveTo(f.x + Math.cos(q) * R, f.y + Math.sin(q) * R); cx.lineTo(f.x + Math.cos(q) * (R - (i % 3 ? 2 : 5)), f.y + Math.sin(q) * (R - (i % 3 ? 2 : 5))); cx.stroke(); } if (f.n) { cx.fillStyle = f.c; cx.font = 'bold 9px Georgia'; cx.textAlign = 'center'; cx.fillText('×' + f.n, f.x, f.y - R - 3); cx.textAlign = 'left'; } return true; }
    case 'tshatter': case 'soulbreak': { const R = f.r * (1.6 - k); cx.strokeStyle = f.c; cx.lineWidth = 1.2; cx.beginPath(); for (let i = 0; i < 6; i++) { const q = i * TAU / 6 + .3; cx.moveTo(f.x + Math.cos(q) * R * .4, f.y + Math.sin(q) * R * .4); cx.lineTo(f.x + Math.cos(q) * R, f.y + Math.sin(q) * R); } cx.stroke(); return true; }
    case 'ascend': { const y = f.y - (.7 - k) * 30; cx.fillStyle = f.c; cx.beginPath(); cx.moveTo(f.x, y - 6); cx.lineTo(f.x + 4, y); cx.lineTo(f.x - 4, y); cx.closePath(); cx.fill(); if (f.n) { cx.font = 'bold 8px Georgia'; cx.textAlign = 'center'; cx.fillText('+' + f.n, f.x, y - 8); cx.textAlign = 'left'; } return true; }
    case 'invert': case 'expose': { const R = f.r * (1.5 - k * .8); cx.strokeStyle = f.c; cx.lineWidth = 1.5; for (const s of [0, Math.PI]) { cx.beginPath(); cx.ellipse(f.x, f.y - 10, R, R * .5, 0, s + k * 6, s + k * 6 + 2); cx.stroke(); } return true; }
    case 'heresy': { cx.fillStyle = f.c; cx.font = 'bold 12px Georgia'; cx.textAlign = 'center'; cx.fillText('✠', f.x, f.y - (.5 - k) * 14); cx.textAlign = 'left'; return true; }
    case 'recur': { cx.strokeStyle = f.c; cx.lineWidth = 1; const R = f.r * (1.4 - k); cx.beginPath(); cx.arc(f.x - R * .45, f.y, R * .45, 0, TAU); cx.arc(f.x + R * .45, f.y, R * .45, Math.PI, Math.PI + TAU); cx.stroke(); return true; }
  }
  return false;
}
function mulb(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function lgDrawWall(w) {
  const R = mulb(w.seed || 1), al = Math.min(1, w.life), rise = Math.min(1, (w.max - w.life) * 6);
  cx.save(); cx.globalAlpha = al; cx.translate(w.x, w.y);
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(0, 2, w.r + 3, (w.r + 3) * .4, 0, 0, TAU); cx.fill();
  const n = 5; for (let i = 0; i < n; i++) { const bw = 8 + R() * 8, bh = 6 + R() * 6, x = (R() - .5) * w.r * 1.4, y = -bh * rise - i * 3 * rise + 2; cx.fillStyle = i % 2 ? '#8a8274' : '#a69c88'; cx.strokeStyle = '#2a241c'; cx.lineWidth = 1; cx.beginPath(); cx.rect(Math.round(x - bw / 2), Math.round(y), Math.round(bw), Math.round(bh)); cx.fill(); cx.stroke(); }
  if (R() < .6) { cx.strokeStyle = LG_GOLD; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-3, -14 * rise); cx.lineTo(3, -14 * rise); cx.stroke(); }
  cx.restore();
}
function lgDrawSkel(a, t) {
  const up = a.raise > 0 ? 1 - a.raise / .5 : 1, bob = Math.sin((a.walk || 0)) * 1.2, al = Math.min(1, a.life * 2);
  cx.save(); cx.globalAlpha = al; cx.translate(a.x, a.y); cx.scale(a.face || 1, 1);
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(0, 1, 9, 3.5, 0, 0, TAU); cx.fill();
  cx.beginPath(); cx.rect(-14, -40, 34, 41); cx.clip(); cx.translate(0, (1 - up) * 26);
  cx.strokeStyle = '#e8e0c8'; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(-3, 0); cx.lineTo(-1, -9 + bob); cx.moveTo(3, 0); cx.lineTo(1, -9 + bob); cx.moveTo(0, -9 + bob); cx.lineTo(0, -20 + bob); cx.stroke();
  cx.lineWidth = 1; for (let i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(-4, -18 + i * 3 + bob); cx.lineTo(4, -18 + i * 3 + bob); cx.stroke(); }
  cx.fillStyle = '#efe8d4'; cx.beginPath(); cx.arc(0, -25 + bob, 5, 0, TAU); cx.fill(); cx.fillRect(-3, -22 + bob, 6, 3);
  cx.fillStyle = '#1a120a'; cx.fillRect(-2.5, -27 + bob, 2, 2); cx.fillRect(1, -27 + bob, 2, 2); cx.fillStyle = '#7dff9a'; cx.fillRect(1.5, -26.5 + bob, 1, 1);
  const sw = a.swing > 0 ? -1.4 + (1 - a.swing / .25) * 2.4 : -.4; cx.save(); cx.translate(3, -16 + bob); cx.rotate(sw); cx.strokeStyle = '#c8ccd4'; cx.lineWidth = 1.8; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(13, 0); cx.stroke(); cx.strokeStyle = '#6a4a2a'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(1, -3); cx.lineTo(1, 3); cx.stroke(); cx.restore();
  cx.restore();
}
// ---------- sounds (procedural, via AUD.reg) ----------
if (window.AUD && AUD.reg) AUD.reg(({ tone, noise, bell, panOf }) => {
  const GL = {
    recursion: p => [0, 1, 2].forEach(i => tone('sine', 880 / Math.pow(1.5, i), 0, .12, .06 / (i + 1), { at: i * .07, pan: p })),
    martyrdom: p => { tone('sine', 220, 110, .4, .12, { pan: p }); tone('sine', 62, 50, .3, .3, { at: .05, pan: p }); },
    fatebinding: p => { tone('triangle', 660, 990, .15, .06, { pan: p }); tone('triangle', 990, 660, .15, .05, { at: .08, pan: p }); },
    timefracture: p => { [0, .06, .12].forEach(a => tone('square', 2400, 2400, .015, .04, { at: a, pan: p })); },
    ascension: p => [0, 4, 7].forEach((s, i) => tone('sine', 523 * Math.pow(2, s / 12), 0, .25, .05, { at: i * .05, pan: p })),
    soulbound: p => { tone('sine', 330, 335, .4, .06, { pan: p }); tone('sine', 495, 500, .4, .04, { pan: p }); },
    hereticmark: p => { tone('sawtooth', 300, 150, .2, .06, { lp: 1200, pan: p }); noise(.08, .08, { f0: 3000, q: 4, pan: p }); },
    inversion: p => { tone('sine', 300, 600, .2, .06, { pan: p }); tone('sine', 600, 300, .2, .05, { at: .1, pan: p }); },
    grimoireecho: p => { noise(.12, .1, { f0: 2400, q: 2, pan: p }); noise(.12, .05, { f0: 2400, q: 2, at: .12, pan: p }); },
    crownedash: p => { bell(784, .5, .05, { pan: p }); noise(.25, .07, { ft: 'lowpass', f0: 900, f1: 200, pan: p }); },
  };
  return {
    lgFanfare: () => { [0, 4, 7, 12, 16].forEach((s, i) => bell(392 * Math.pow(2, s / 12), 1.2, .1, { at: i * .09 })); tone('sawtooth', 98, 98, 1.1, .05, { lp: 700, at: .4 }); tone('sawtooth', 147, 147, 1.1, .04, { lp: 700, at: .4 }); noise(.6, .06, { ft: 'highpass', f0: 5000, at: .4 }); },
    lgClaim: () => { [12, 7, 16, 19].forEach((s, i) => bell(392 * Math.pow(2, s / 12), .9, .1, { at: i * .07 })); tone('sine', 98, 49, .6, .3); },
    lgDeny: () => { tone('square', 180, 120, .12, .07, { lp: 900 }); tone('square', 150, 100, .14, .07, { lp: 900, at: .1 }); },
    lgBell: p => { p = panOf(p); bell(147, 1.4, .08, { pan: p, a: .3 }); },
    lgToll: (p, n) => { p = panOf(p); const f = [131, 123, 98][(+n || 1) - 1] || 110; bell(f, 2.6, .32, { pan: p }); tone('sine', f / 2, f / 2, 2, .2, { pan: p }); noise(.4, .05, { ft: 'highpass', f0: 4000, pan: p }); },
    lgBurn: p => { p = panOf(p); noise(.6, .14, { f0: 600, f1: 3000, q: .8, pan: p, a: .05 }); tone('sine', 880, 440, .5, .05, { pan: p }); },
    lgSpire: p => { p = panOf(p); noise(.9, .12, { f0: 300, f1: 2400, q: 1.5, pan: p, a: .4 }); },
    lgCrash: p => { p = panOf(p); tone('sine', 70, 30, .9, .5, { pan: p }); noise(.9, .3, { ft: 'lowpass', f0: 1600, f1: 120, pan: p }); bell(220, 1.2, .08, { pan: p, at: .05 }); },
    lgMaw: p => { p = panOf(p); tone('sawtooth', 60, 40, .8, .12, { lp: 300, pan: p, a: .1 }); noise(.6, .08, { ft: 'lowpass', f0: 400, pan: p, a: .1 }); },
    lgGulp: p => { p = panOf(p); tone('sine', 220, 60, .22, .3, { pan: p }); noise(.08, .1, { f0: 400, pan: p }); },
    lgHalo: p => { p = panOf(p); [0, 7, 12].forEach((s, i) => bell(1047 * Math.pow(2, s / 12), .9, .05, { at: i * .05, pan: p })); },
    lgBeam: p => { p = panOf(p); tone('sine', 2093, 1568, .2, .09, { pan: p }); noise(.1, .05, { ft: 'highpass', f0: 6000, pan: p }); },
    lgEternal: p => { p = panOf(p); noise(.5, .18, { f0: 400, f1: 1400, q: 1, pan: p }); bell(523, .8, .05, { pan: p }); },
    lgOssuary: p => { p = panOf(p); for (let i = 0; i < 5; i++) tone('square', 900 + Math.random() * 600, 0, .03, .05, { at: i * .05, pan: p }); tone('sawtooth', 98, 92, .6, .05, { lp: 500, pan: p }); },
    lgFizzle: p => { p = panOf(p); noise(.25, .07, { f0: 2000, f1: 400, q: 2, pan: p }); },
    lgStarCharge: p => { p = panOf(p); tone('sine', 330, 660, 1.2, .05, { pan: p, a: .3 }); },
    lgStarfall: (p, n) => { p = panOf(p); const k = Math.min(10, +n || 1); for (let i = 0; i < Math.min(k, 6); i++) tone('sine', 2200 - i * 180, 300, .3, .04, { at: i * .12, pan: p }); bell(659, 1, .07, { pan: p }); },
    lgGlyph: (p, g) => { p = panOf(p); (GL[g] || GL.recursion)(p); },
    lgFate: p => tone('triangle', 1320, 1100, .1, .04, { pan: panOf(p) }),
    lgFracture: p => { p = panOf(p); tone('sine', 1760, 1700, .5, .05, { pan: p }); noise(.15, .05, { ft: 'highpass', f0: 5000, pan: p }); },
    lgTick: (p, n) => { p = panOf(p); tone('square', 1400 + (+n || 1) * 200, 0, .03, .07, { pan: p }); tone('sine', 700, 350, .15, .06, { pan: p }); },
    lgAscend: (p, n) => { p = panOf(p); tone('sine', 523 * Math.pow(2, Math.min(24, +n || 1) / 24), 0, .2, .06, { pan: p }); },
    lgHeretic: p => { p = panOf(p); tone('sawtooth', 220, 330, .2, .05, { lp: 1500, pan: p }); },
    lgInvert: p => { p = panOf(p); tone('sine', 300, 900, .3, .06, { pan: p }); },
    lgHealInv: p => { p = panOf(p); tone('sine', 660, 990, .15, .07, { pan: p }); },
    lgAsh: p => { p = panOf(p); noise(.3, .12, { f0: 900, f1: 200, q: 1.2, pan: p }); bell(784, .4, .04, { pan: p }); },
    lgRecur: (p, n) => { p = panOf(p); tone('sine', 880 / Math.pow(1.4, +n || 1), 0, .1, .05, { pan: p }); },
  };
}, { lgToll: .3, lgBeam: .12, lgGulp: .1, lgFate: .1, lgAscend: .08, lgAsh: .12, lgRecur: .06, lgTick: .2, lgHealInv: .2, lgHeretic: .15, lgGlyph: .12, lgFizzle: .2, lgCrash: .3, lgDeny: .2 });
window.__legend = { LEGENDARY, LEG_PROJ, LEG_GLYPH, LVB, LCAP, lgGold, lgGoldN, lgOrnate, lgCheckMove, lgReject, lgReveal, lgAltar, lgDebugKit, lgRoll };
