'use strict';
// ===== Grimoire Ascent — online co-op (1–4 mages) =====
// Host-authoritative: the host's browser runs the whole simulation (foes, loot, spells, bosses) and broadcasts
// snapshots ~15x/s; guests simulate only their own movement and send position + grimoire. The server just relays.
// Positions travel normalised to the arena (0..1) so phones and desktops with different arena sizes agree.
const COLS = ['#ffb347', '#7ac8ff', '#9aff7a', '#e07aff'];
const NET = { ws: null, on: false, host: false, id: 0, code: '', slot: 0, players: [], peers: new Map(), queue: null, lastSnap: 0, sendT: 0, em0: 0, foeMap: new Map(), name: '', cls: 'pilgrim', started: false, ready: new Set() };
window.NET = NET;
const myName = () => NET.name || (NET.name = (localStorage.getItem('ga-name') || ('Mage' + (100 + Math.random() * 900 | 0))));
function wsURL() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'; }
function netSend(m) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(m)); }
const toHost = d => netSend({ t: 'msg', to: 'host', d }), toAll = d => netSend({ t: 'msg', to: 'all', d });
const nx = x => { const A = arena(); return +((x - A.x0) / (A.x1 - A.x0)).toFixed(4); }, ny = y => { const A = arena(); return +((y - A.y0) / (A.y1 - A.y0)).toFixed(4); };
const dx_ = u => { const A = arena(); return A.x0 + u * (A.x1 - A.x0); }, dy_ = v => { const A = arena(); return A.y0 + v * (A.y1 - A.y0); };
const slotCol = s => COLS[s % 4];
function connect(then) {
  if (location.protocol === 'file:') return toast('Co-op needs the online version');
  if (NET.ws && NET.ws.readyState === 1) return then();
  let ws; try { ws = new WebSocket(wsURL()); } catch (e) { return toast('Could not reach the co-op server'); }
  NET.ws = ws; panel('<h2>Connecting…</h2><p class="small">Waking the co-op server (a sleeping free server can take up to a minute).</p><button class="btn sub" id="cx">Cancel</button>'); on('cx', () => { leaveCoop(); showCamp(); });
  ws.onopen = then; ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } onNet(m); };
  ws.onerror = () => { };
  ws.onclose = () => { const was = NET.on; NET.ws = null; if (was) { NET.on = false; endCoop('Connection to the co-op server was lost.'); } };
}
function leaveCoop() { const ws = NET.ws; NET.on = false; NET.host = false; NET.peers.clear(); NET.players = []; NET.queue = null; NET.started = false; NET.ws = null; if (ws) { try { ws.send(JSON.stringify({ t: 'leave' })); ws.close(); } catch (e) { } } }
function endCoop(msg) {
  leaveCoop(); room = null; HUD.classList.add('hidden'); mode = 'dead'; paused = false;
  panel(`<h2>Co-op ended</h2><p>${msg}</p><button class="btn hot" id="camp">Return to the Mage Hall</button>`, 'title'); on('camp', showCamp);
}
// ---------- lobby UI ----------
function coopMenu(code) {
  const nm = myName();
  panel(`<h2>⚔ Co-op Ascent</h2><p class="small">Climb together with up to 4 mages. Each of you keeps your own grimoire and pages.</p>
  <p class="small">Your name</p><input id="nm" class="inp" maxlength="14" value="${nm.replace(/"/g, '')}">
  <button class="btn hot" id="hostB">Host Co-op</button>
  <div class="joinrow"><input id="code" class="inp code" maxlength="4" placeholder="CODE" value="${code || ''}" autocapitalize="characters"><button class="btn" id="joinB">Join</button></div>
  <p class="small">Solo play never needs a connection.</p><button class="btn sub" id="back">Back</button>`, 'title');
  const saveNm = () => { NET.name = (document.getElementById('nm').value || nm).trim().slice(0, 14) || nm; try { localStorage.setItem('ga-name', NET.name); } catch (e) { } };
  on('hostB', () => { saveNm(); connect(() => netSend({ t: 'host', name: NET.name })); });
  on('joinB', () => { saveNm(); const c = document.getElementById('code').value.toUpperCase().trim(); if (c.length !== 4) return toast('Enter the 4-letter code'); connect(() => netSend({ t: 'join', code: c, name: NET.name })); });
  on('back', () => { history.replaceState(null, '', location.pathname); showCamp(); });
}
function lobby() {
  mode = 'lobby'; const link = location.origin + location.pathname + '?room=' + NET.code;
  const me = NET.players.find(p => p.id === NET.id);
  panel(`<h2>Co-op lobby</h2><p class="small">Room code</p><div class="roomcode" id="rc">${NET.code}</div>
  <button class="btn sub" id="copy">🔗 Copy invite link</button><p class="small linkline">${link}</p>
  <div class="roster">${NET.players.map(p => `<div class="mate"><i style="background:${slotCol(p.slot)}"></i>${p.name.replace(/</g, '')}${p.host ? ' · host' : ''}${p.id === NET.id ? ' (you)' : ''}</div>`).join('')}${'<div class="mate empty"><i></i>open seat</div>'.repeat(Math.max(0, 4 - NET.players.length))}</div>
  <div class="magepick"><p class="small">Your mage</p><div class="tabs"><button class="tab ${NET.cls === 'pilgrim' ? 'on' : ''}" id="cK">Kai Emberline 🔥</button><button class="tab ${NET.cls === 'witch' ? 'on' : ''}" id="cL" ${camp.witch ? '' : 'disabled'}>Lumi Vesper 🏮${camp.witch ? '' : ' 🔒'}</button></div></div>
  ${NET.host ? `<button class="btn hot" id="begin">Begin the ascent (${NET.players.length} mage${NET.players.length > 1 ? 's' : ''})</button>` : '<p class="stat">Waiting for the host to begin…</p>'}
  <button class="btn sub" id="lv">Leave</button>`, 'title');
  on('copy', () => { (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Invite link copied'), () => toast(link, 4000)); });
  on('cK', () => { NET.cls = 'pilgrim'; lobby(); }); on('cL', () => { NET.cls = 'witch'; lobby(); });
  on('begin', () => { const seed = (Math.random() * 2 ** 32) >>> 0; netSend({ t: 'lock', v: true }); toAll({ k: 'go', seed }); startCoopRun(seed); });
  on('lv', () => { leaveCoop(); history.replaceState(null, '', location.pathname); showCamp(); });
}
function startCoopRun(seed) {
  NET.started = true; clearRun();
  const st = starter(NET.cls), fl = CLASSES[NET.cls].flame + camp.wick * 10;
  G = { cls: NET.cls, daily: false, coop: true, seed, floor: 0, step: 0, maxFlame: fl, flame: fl, wands: st.wands, active: 0, bag: st.bag, curses: [], embersRun: 0, kills: 0, path: [] };
  G.map = genMap(); camp.runs++; saveCamp(); bg = null; NET.ready.clear();
  showMap();
}
// ---------- messages ----------
function onNet(m) {
  if (m.t === 'error') { toast(m.msg, 2600); return coopMenu(); }
  if (m.t === 'joined') { NET.on = true; NET.host = m.host; NET.id = m.id; NET.code = m.code; NET.slot = m.slot; NET.players = m.players; history.replaceState(null, '', location.pathname + '?room=' + m.code); return lobby(); }
  if (m.t === 'roster') { NET.players = m.players; for (const id of [...NET.peers.keys()]) if (!m.players.some(p => p.id === id)) NET.peers.delete(id); if (mode === 'lobby') lobby(); if (mode === 'map' && NET.host && document.getElementById('door0')) showMap(); return; }
  if (m.t === 'left') { toast(m.name + ' left the party', 2200); NET.peers.delete(m.id); NET.ready.delete(m.id); return; }
  if (m.t === 'host-left') { return endCoop('The host left, so the run has ended. Your shards from this run were not banked.'); }
  if (m.t !== 'msg') return;
  const d = m.d, from = m.from;
  if (NET.host) return hostMsg(from, d);
  switch (d.k) {
    case 'go': return startCoopRun(d.seed);
    case 'door': if (mode === 'wait' || mode === 'map') return applyDoor(d); NET.queue = d; return;
    case 'snap': return applySnap(d);
    case 'clear': return clientClear(d);
    case 'over': return coopOver();
    case 'endless': G.endless = true; return;
    case 'end': return endCoop('The host returned to the Mage Hall. Your shards were banked.');
  }
}
// ---------- host side ----------
function peerOf(id) {
  let q = NET.peers.get(id);
  if (!q) { const pl = NET.players.find(p => p.id === id) || { name: 'Mage', slot: 1 }; q = { id, name: pl.name, slot: pl.slot, x: 0, y: 0, r: 13, face: 0, walk: 0, castT: 0, hp: 80, maxHp: 80, down: false, rev: 0, inv: 0, em: 0, wandKey: '', wand: null, cls: 'pilgrim', inRoom: false, skillCd: 0 }; NET.peers.set(id, q); }
  return q;
}
function hostMsg(from, d) {
  const q = peerOf(from);
  if (d.k === 'st') {
    const wasIn = q.inRoom; q.cls = d.cls; q.name = d.name || q.name;
    if (d.w) { const key = JSON.stringify(d.w); if (key !== q.wandKey) { q.wandKey = key; q.wand = makeWand(Object.assign({}, d.w, { idx: 0, cd: .4 })); q.wand.mana = mmax(q.wand); q.sg = null; for (let n = (q.lpBurn || 0) - (d.lb || 0); n > 0; n--) { const i = q.wand.slots.indexOf('lastpage'); if (i < 0) break; q.wand.slots[i] = null; } } }
    if (!room || !d.inRoom) { q.hp = d.hp; q.maxHp = d.maxHp; q.inRoom = false; q.down = false; NET.ready[d.ready ? 'add' : 'delete'](from); if (d.ready !== q.lastReady) { q.lastReady = d.ready; if (mode === 'map' && document.getElementById('door0')) showMap(); } return; }
    if (!wasIn) { q.inRoom = true; q.hp = d.hp; q.maxHp = d.maxHp; q.em = 0; q.down = false; q.inv = 1; }
    if (!q.down) { q.x = dx_(d.x); q.y = dy_(d.y); q.face = d.face; q.walk = d.walk; if (d.dodge && !q.dodge) dodgeSigils(q, q.wand, room); q.dodge = d.dodge; }
  }
  if ((d.k === 'burn' || d.k === 'unburn') && window.__burn) { // a guest burned (or un-burned) a page: the host computes the refund itself; in a room it is authoritative for hp/embers
    const B = q.burns || (q.burns = []); const live = room && q.inRoom;
    if (d.k === 'burn' && CARDS[d.id]) { const rf = __burn.burnRefund(d.id), fl = live ? Math.max(0, Math.min(rf.fl, q.maxHp - q.hp)) : 0, em = live ? rf.em : 0; B.push({ id: d.id, fl, em }); NET.burnLog = (NET.burnLog || 0) + 1;
      if (live) { q.hp += fl; q.em = (q.em || 0) + em; room.fxs.push({ type: 'ring', x: q.x, y: q.y - 20, r: 6, R: 46, life: .6, c: '#ffb050' }); room.fxs.push({ type: 'circle', x: q.x, y: q.y - 20, r: 22, life: .5, c: '#ff7a2a' }); } }
    else if (d.k === 'unburn' && B.length) { const r = B.pop(); if (live) { q.hp = Math.max(1, q.hp - r.fl); q.em = Math.max(0, (q.em || 0) - r.em); } }
  }
  if (d.k === 'skill' && room && q.inRoom && !q.down && q.skillCd <= 0) {
    q.skillCd = q.cls === 'witch' ? 9 : 7;
    if (q.cls === 'witch') { for (let i = 0; i < 3; i++) room.wisps.push({ a: i * TAU / 3, life: 6, o: q }); }
    else { room.fxs.push({ type: 'ring', x: q.x, y: q.y, r: 10, R: 140, life: .5, c: '#ff9a3a' }); room.fxs.push({ type: 'circle', x: q.x, y: q.y, r: 70, life: .5, c: '#ff5a1a' }); for (const f of room.foes) { const dd = Math.hypot(f.x - q.x, f.y - q.y) || 1; if (dd < 140) hurtFoe(room, f, 30, (f.x - q.x) / dd * 260, (f.y - q.y) / dd * 260); } }
  }
}
const livePeers = () => [...NET.peers.values()].filter(q => q.inRoom);
coopN = () => NET.on ? Math.max(1, NET.players.length) : 1;
targets = () => { const out = P.down ? [] : [P]; if (NET.on && NET.host) for (const q of livePeers()) if (!q.down) out.push(q); return out; };
foeTarget = f => { let b = null, bd = 1e9; for (const q of targets()) { const d = Math.hypot(q.x - f.x, q.y - f.y); if (d < bd) { bd = d; b = q; } } return b || P; };
hurtTarget = (T, d) => { if (T === P) return hurtPlayer(d); if (T.inv > 0 || T.dodge || T.down) return; if (absorbHit(T, T.wand, room)) { T.inv = .5; return; } T.hp -= d; T.inv = .7; thornsOf(T, T.wand, room); if (T.hp <= 0) { T.hp = 0; T.down = true; T.rev = 0; toast('💀 ' + T.name + ' is down!', 1400); } };
collectDrop = T => { if (T === P) { G.embersRun += 1; G.flame = Math.min(G.maxFlame, G.flame + 1.2); } else { T.em++; T.hp = Math.min(T.maxHp, T.hp + 1.2); } };
const _zero = onZeroHp;
onZeroHp = () => { if (!NET.on) return _zero(); P.down = true; P.rev = 0; toast('💀 You are down — an ally can revive you!', 1800); };
const _update = update;
update = dt => {
  if (!NET.on || !room || mode !== 'room') return _update(dt);
  if (!NET.host) return clientUpdate(dt);
  _update(dt); if (!room) return;
  // peers: casting, timers, revives
  for (const q of livePeers()) {
    q.inv = Math.max(0, q.inv - dt); q.skillCd = Math.max(0, q.skillCd - dt); q.castT = Math.max(0, q.castT - dt);
    const w = q.wand; if (!w || q.down) continue;
    w.mana = Math.min(mmax(w), w.mana + mreg(w) * dt); w.cd -= dt; { const kc = room.caster; room.caster = q; sigilTick(q, w, dt, room); room.caster = kc; }
    const t = nearestFoe(room, q.x, q.y); if (t) q.face = Math.atan2(t.y - q.y, t.x - q.x);
    if (t && w.cd <= 0) { q.castT = .18; room.fxs.push({ type: 'circle', x: q.x, y: q.y, r: 20, life: .3, c: w.slots.includes('inverted') ? '#e8e4f0' : `hsl(${w.hue},80%,65%)` }); const keep = room.caster; room.caster = q; tryCast(room, w, q.x + Math.cos(q.face) * 14, q.y - 14, Math.atan2(t.y - t.r * .8 - (q.y - 14), t.x - q.x), n => { q.hp = Math.max(1, q.hp - n); }); room.caster = keep; }
  }
  const all = [P, ...livePeers()];
  for (const D of all) {
    if (!D.down) continue;
    const helper = all.some(A => A !== D && !A.down && Math.hypot(A.x - D.x, A.y - D.y) < 42);
    D.rev = helper ? (D.rev || 0) + dt : Math.max(0, (D.rev || 0) - dt * .5);
    if (D.rev >= 2) { D.down = false; D.rev = 0; D.inv = 1.5; au('revive'); if (D === P) { G.flame = Math.max(1, Math.round(G.maxFlame * .3)); toast('✚ You were revived!'); } else { D.hp = Math.max(1, Math.round(D.maxHp * .3)); toast('✚ ' + D.name + ' revived'); } }
  }
  if (all.every(D => D.down) && mode === 'room') { toAll({ k: 'over' }); return coopOver(); }
  NET.sendT -= dt; if (NET.sendT <= 0) { NET.sendT = 1 / 15; toAll(makeSnap()); }
};
function makeSnap() {
  const A = arena(), r2 = v => Math.round(v * 10) / 10;
  const fxs = []; for (const f of room.fxs) if (!f._s && f.type !== 'sfx') { f._s = 1; fxs.push({ type: f.type, x: nx(f.x), y: ny(f.y), x2: f.x2 != null ? nx(f.x2) : undefined, y2: f.y2 != null ? ny(f.y2) : undefined, r: f.r, R: f.R, n: f.n, life: f.life, c: f.c, txt: f.txt }); }
  const pl = [[NET.id, nx(P.x), ny(P.y), r2(P.face), r2(P.walk), Math.ceil(G.flame), G.maxFlame, P.down ? 1 : 0, r2(P.castT || 0), wand().hue, leavesOf(wand()), G.cls, r2(P.rev || 0), 0, sigList(wand()), P.shield ? 1 : 0, wand().ornate ? 1 : 0, 0]];
  for (const q of livePeers()) pl.push([q.id, nx(q.x), ny(q.y), r2(q.face), r2(q.walk), Math.ceil(q.hp), q.maxHp, q.down ? 1 : 0, r2(q.castT), q.wand ? q.wand.hue : 30, q.wand ? leavesOf(q.wand) : 1, q.cls, r2(q.rev || 0), q.em, sigList(q.wand), q.shield ? 1 : 0, q.wand && q.wand.ornate ? 1 : 0, q.lpBurn || 0]);
  return {
    k: 'snap', kind: room.kind, aw: A.x1 - A.x0, ah: A.y1 - A.y0, done: room.done ? 1 : 0, fl: G.floor, st: G.step,
    foes: room.foes.map(f => [f.id, f.type, nx(f.x), ny(f.y), Math.ceil(f.hp), Math.ceil(f.max), f.elite ? 1 : 0, f.boss ? 1 : 0, f.hit > 0 ? 1 : 0, f.phase, r2(Math.max(0, f.spawnT)), f.burn > 0 ? 1 : 0, f.frozen > 0 ? 1 : 0, f.poison > 0 ? 1 : 0, r2(f.r), r2(tellOf(f)), f.face || 1, (f.stun > 0 ? 1 : 0) | (f.mark > 0 ? 2 : 0) | (f.silence > 0 ? 4 : 0) | (f.slowT > 0 ? 8 : 0) | (f.hex > 0 ? 16 : 0) | (f.gild > 0 ? 32 : 0) | (f.lunge > 0 ? 64 : 0) | (f.phaseT > 0 ? 128 : 0) | (f.heretic > 0 ? 256 : 0) | (f.bondT > 0 ? 512 : 0) | (f.rage > 0 ? 1024 : 0)]),
    shots: room.shots.slice(-140).map(b => [b.kind, nx(b.x), ny(b.y), Math.round(b.vx), Math.round(b.vy), r2(b.r), b.col, b.el || 0, r2(b.age), r2(b.spin || 0), b.novaR != null ? r2(b.novaR) : -1, b.tx != null ? nx(b.tx) : -1, b.ty != null ? ny(b.ty) : -1, (b.trig ? 1 : 0) | (b.homing ? 2 : 0) | (b.poison ? 4 : 0), b.ov || 0, b.grow || 0, r2(b.wz || 0), ...(A_ => A_ ? [nx(A_.x), ny(A_.y)] : [-1, -1])(anchorOf(b)), r2(b.gy != null ? b.gy - b.y : 0), b.fateT > 0 ? 1 : 0, b.lv || 0, b.tolls || 0, b.mv || 0]),
    es: room.eshots.map(b => [nx(b.x), ny(b.y), Math.round(b.vx), Math.round(b.vy), b.col || 0]),
    dr: room.drops.map(e => [nx(e.x), ny(e.y)]), wi: room.wisps.map(w => [nx(w.x), ny(w.y)]), fxs, pl,
    lg: [(room.walls || []).map(w => [nx(w.x), ny(w.y), r2(w.r), r2(w.life), w.seed]), (room.allies || []).map(a => [nx(a.x), ny(a.y), a.face || 1, r2(Math.max(0, a.raise)), r2(a.life), r2(a.swing || 0), r2(a.walk || 0), a.god ? 1 : 0])],
  };
}
const _cleared = roomCleared;
roomCleared = k => {
  if (!NET.on || !NET.host) return _cleared(k);
  if (P.down) { P.down = false; G.flame = Math.max(1, Math.round(G.maxFlame * .2)); }
  const hp = {}; for (const q of livePeers()) { hp[q.id] = { hp: q.down ? Math.max(1, Math.round(q.maxHp * .2)) : q.hp, em: q.em }; q.inRoom = false; q.down = false; }
  NET.ready.clear(); toAll({ k: 'clear', kind: k, hp }); _cleared(k);
};
function coopOver() { if (mode === 'dead') return; P.down = false; G.flame = 0; room = null; NET.started = false; die(false); }
// host map: shows who is ready; host picks the door for everyone
const _showMap = showMap;
showMap = () => {
  if (!NET.on) return _showMap();
  if (!NET.host) { if (NET.queue) { const q = NET.queue; NET.queue = null; return applyDoor(q); } return waitPanel(); }
  _showMap();
  const others = NET.players.filter(p => p.id !== NET.id), cards = UI.querySelector('.cards');
  if (cards) cards.insertAdjacentHTML('beforebegin', `<div class="roster small">${NET.players.map(p => `<div class="mate"><i style="background:${slotCol(p.slot)}"></i>${p.name.replace(/</g, '')} ${p.id === NET.id ? '· you pick the path' : NET.ready.has(p.id) ? '✓ ready' : '… choosing reward'}</div>`).join('')}</div>${others.length && others.some(p => !NET.ready.has(p.id)) ? '<p class="small">Mages still choosing will join the room when they finish.</p>' : ''}`);
};
const _enter = enterDoor;
enterDoor = d => { if (NET.on && NET.host) toAll({ k: 'door', d, floor: G.floor, step: G.step, endless: !!G.endless }); _enter(d); };
// ---------- guest side ----------
function waitPanel() {
  mode = 'wait'; room = null; HUD.classList.add('hidden'); if (!bg) buildBG();
  const opts = G.map[G.step] || [];
  panel(`<h2>${floorLabel()}</h2><p class="stat">HP ${Math.ceil(G.flame)}/${G.maxFlame}</p><button class="btn hot" id="edit">📖 Edit grimoire</button>
  <p class="small">The host chooses the path: ${opts.map(d => DOORS[d].icon + ' ' + (d === 'boss' ? biome().boss : DOORS[d].name)).join(' · ')}</p><p class="stat">Waiting for the host…</p><button class="btn sub" id="lv">Leave co-op</button>`);
  on('edit', () => editor(waitPanel)); on('lv', () => { leaveCoop(); die(true); });
}
function applyDoor(d) {
  if (G.floor !== d.floor) { G.floor = d.floor; G.map = genMap(); bg = null; }
  G.step = d.step; G.endless = d.endless; G.path[G.step] = d.d; stepRng(d.d);
  if (d.d === 'fight' || d.d === 'elite' || d.d === 'boss') return clientStartRoom(d.d);
  if (d.d === 'archive' && window.__mythic) return __mythic.archive(); if (d.d === 'shrine') return shrine(); if (d.d === 'merchant') return merchant(); if (d.d === 'treasure') return treasure();
}
const _advance = advance;
advance = () => { if (!NET.on || NET.host) return _advance(); showMap(); };
function clientStartRoom(kind) {
  mode = 'room'; paused = false; closeUI(); HUD.classList.remove('hidden'); if (!bg) buildBG();
  const A = arena(); room = { kind, t: 0, bounds: A, foes: [], shots: [], eshots: [], parts: [], drops: [], fxs: [], patches: [], wisps: [], waves: [], done: false, doneT: 0, caster: P, guest: true, others: [] };
  P.x = (A.x0 + A.x1) / 2 + (NET.slot - 1.5) * 40; P.y = A.y1 - 60; P.vx = P.vy = 0; P.inv = 1; P.dodgeT = 0; P.skillCd = 0; P.dodgeCd = 0; P.down = false; P.rev = 0;
  NET.em0 = G.embersRun; NET.foeMap.clear(); NET.sendT = 0;
  toast(kind === 'boss' ? '👑 ' + biome().boss.toUpperCase() : kind === 'elite' ? '💀 ELITE!' : '⚔ BATTLE!', 1200);
}
function clientUpdate(dt) {
  const A = arena(); room.t += dt;
  P.inv = Math.max(0, P.inv - dt); P.hurt = Math.max(0, P.hurt - dt); P.dodgeCd = Math.max(0, P.dodgeCd - dt); P.skillCd = Math.max(0, P.skillCd - dt);
  const spd = CLASSES[G.cls].speed * (1 + .12 * sigN(wand(), 'lode'));
  if (P.down) P.vx = P.vy = 0;
  else if (P.dodgeT > 0) { P.dodgeT -= dt; room.parts.push({ x: P.x, y: P.y - 8, vx: 0, vy: 0, life: .25, c: '#ff8a2a55', s: 9 }); }
  else { let dx = input.dx, dy = input.dy; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } P.vx = dx * spd; P.vy = dy * spd; if (l > .1) P.walk += dt * 10; }
  P.x = clamp(P.x + P.vx * dt, A.x0 + P.r, A.x1 - P.r); P.y = clamp(P.y + P.vy * dt, A.y0 + P.r + 10, A.y1 - P.r);
  const t = nearestFoe(room, P.x, P.y); if (t) P.face = Math.atan2(t.y - P.y, t.x - P.x); else if (Math.hypot(P.vx, P.vy) > 1) P.face = Math.atan2(P.vy, P.vx);
  for (const w of G.wands) { w.mana = Math.min(mmax(w), w.mana + mreg(w) * dt); }
  // extrapolate host entities between snapshots
  const k = room.scale || 1;
  for (const b of room.shots) { b.x += b.vx * k * dt; b.y += b.vy * k * dt; b.age += dt; b.spin += dt * 10; }
  for (const b of room.eshots) { b.x += b.vx * k * dt; b.y += b.vy * k * dt; }
  for (const f of room.foes) { f.t += dt; f.hit = Math.max(0, f.hit - dt); if (f.spawnT > 0) f.spawnT -= dt; if (f.tx != null) { f.x += (f.tx - f.x) * Math.min(1, dt * 12); f.y += (f.ty - f.y) * Math.min(1, dt * 12); } }
  for (const o of room.others) { if (o.tx != null) { o.x += (o.tx - o.x) * Math.min(1, dt * 12); o.y += (o.ty - o.y) * Math.min(1, dt * 12); } }
  for (const p of room.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; p.life -= dt; }
  room.parts = room.parts.filter(p => p.life > 0); if (room.parts.length > 500) room.parts.splice(0, room.parts.length - 500);
  for (const f of room.fxs) { f.life -= dt; if (f.type === 'ring') f.r += (f.R - f.r) * Math.min(1, dt * 12); }
  room.fxs = room.fxs.filter(f => f.life > 0);
  NET.sendT -= dt; if (NET.sendT <= 0) { NET.sendT = 1 / 20; sendState(true); }
  if (performance.now() - NET.lastSnap > 8000 && NET.lastSnap) { NET.lastSnap = performance.now(); toast('Waiting for the host…', 1500); }
}
function sendState(inRoom) {
  const w = wand();
  toHost({ k: 'st', inRoom, x: nx(P.x), y: ny(P.y), face: +P.face.toFixed(2), walk: +P.walk.toFixed(2), dodge: P.dodgeT > 0 ? 1 : 0, hp: Math.ceil(G.flame), maxHp: G.maxFlame, cls: G.cls, name: myName(), ready: mode === 'wait',
    w: { name: w.name, slots: w.slots, delay: w.delay, recharge: w.recharge, maxMana: w.maxMana, regen: w.regen, hue: w.hue, leaves: w.leaves, ornate: !!w.ornate, gold: w.gold || 0, myth: w.myth ? 1 : 0 }, lb: NET.lpAck || 0 });
}
setInterval(() => { if (NET.on && !NET.host && G && G.coop && mode !== 'room') sendState(false); }, 500);
function applySnap(s) {
  if (!room || !room.guest) return;
  NET.lastSnap = performance.now(); const A = arena(); room.scale = (A.x1 - A.x0) / s.aw;
  const seen = new Set();
  for (const a of s.foes) {
    const [id, type, x, y, hp, max, elite, boss, hit, phase, spawnT, burn, frozen, poison, r, tell, face, st] = a; seen.add(id);
    let f = NET.foeMap.get(id); const X = dx_(x), Y = dy_(y);
    if (!f) { f = { id, type, x: X, y: Y, t: Math.random() * 9, kx: 0, ky: 0 }; NET.foeMap.set(id, f); }
    Object.assign(f, { tx: X, ty: Y, hp, max, elite: !!elite, boss: !!boss, phase, spawnT, burn: burn ? 1 : 0, frozen: frozen ? 1 : 0, poison: poison ? 1 : 0, r, tell: tell || 0, face: face || 1, stun: st & 1 ? 1 : 0, mark: st & 2 ? 1 : 0, silence: st & 4 ? 1 : 0, slowT: st & 8 ? 1 : 0, hex: st & 16 ? 1 : 0, gild: st & 32 ? 1 : 0, lunge: st & 64 ? 1 : 0, phaseT: st & 128 ? 1 : 0, heretic: st & 256 ? 1 : 0, bondT: st & 512 ? 1 : 0, rage: st & 1024 ? 1 : 0 }); if (hit) { f.hit = .08; au('hit', f); }
  }
  for (const [id, f] of NET.foeMap) if (!seen.has(id)) { NET.foeMap.delete(id); G.kills++; corpse(f); au('death', f); for (let i = 0; i < 14; i++) room.parts.push({ x: f.x, y: f.y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .5) * 220, life: .6, c: i % 2 ? '#ff8a2a' : '#3a3428', s: 3 }); }
  room.foes = [...NET.foeMap.values()];
  const nNew = s.shots.filter(b => b[8] < .1).length; if (nNew) { const b = s.shots.find(b => b[8] < .1); au('castGuest', b[7] || '', b[0]); }
  room.shots = s.shots.map(([kind, x, y, vx, vy, r, col, el, age, spin, novaR, tx, ty, fl, ov, grow, wz, ax, ay, gy, fate, lv, tolls, mv]) => ({ ov, mv: mv || 0, lv: lv || 0, tolls: tolls || 0, grow, wz: wz || 0, ax: ax >= 0 ? dx_(ax) : undefined, ay: ay >= 0 ? dy_(ay) : undefined, gy: gy ? dy_(y) + gy : undefined, fateT: fate ? .1 : 0, armT: CARDS[kind] && CARDS[kind].grave ? .28 : undefined, kind, x: dx_(x), y: dy_(y), vx, vy, r, col, el: el || undefined, age, spin, novaR: novaR >= 0 ? novaR : undefined, tx: tx >= 0 ? dx_(tx) : undefined, ty: ty >= 0 ? dy_(ty) : undefined, trig: fl & 1, homing: fl & 2, poison: fl & 4, hit: [] }));
  room.eshots = s.es.map(([x, y, vx, vy, col]) => ({ x: dx_(x), y: dy_(y), vx, vy, col: col || undefined }));
  room.drops = s.dr.map(([x, y], i) => ({ x: dx_(x), y: dy_(y), t: i }));
  room.wisps = s.wi.map(([x, y]) => ({ x: dx_(x), y: dy_(y), life: 1 }));
  for (const f of s.fxs) room.fxs.push(Object.assign({}, f, { x: dx_(f.x), y: dy_(f.y), x2: f.x2 != null ? dx_(f.x2) : undefined, y2: f.y2 != null ? dy_(f.y2) : undefined }));
  room.done = !!s.done;
  if (s.lg) { const k = room.scale || 1; room.walls = s.lg[0].map(([x, y, r, life, seed]) => ({ x: dx_(x), y: dy_(y), r: r * k, life, max: life + 1, seed })); room.allies = s.lg[1].map(([x, y, face, raise, life, swing, walk, god]) => ({ x: dx_(x), y: dy_(y), r: god ? 22 : 11, face, raise, life, swing, walk, god })); }
  const others = [];
  for (const [id, x, y, face, walk, hp, maxHp, down, castT, hue, leaves, cls, rev, em, sigs, shield, orn, lpb] of s.pl) {
    const pl = NET.players.find(p => p.id === id) || { name: 'Mage', slot: 0 };
    if (id === NET.id) { const was = P.down; if (hp < G.flame - .5) { P.hurt = .25; shake = 5; au('hurt'); buzz(35, 'hurt'); } G.flame = hp; G.maxFlame = maxHp; P.down = !!down; P.rev = rev; P.castT = castT; P.shield = !!shield; if (NET.em0 + em > G.embersRun) au('pickup'); G.embersRun = NET.em0 + em; if (lpb > (NET.lpAck || 0)) { const w = wand(), i = w.slots.indexOf('lastpage'); if (i >= 0) { w.slots[i] = null; w.idx = 0; toast('📃 The Last Page burns away…', 1800); saveRun(); } NET.lpAck = lpb; } if (P.down && !was) toast('💀 You are down — an ally can revive you!', 1800); if (!P.down && was) { toast('✚ You were revived!'); au('revive'); } continue; }
    const prev = room.others.find(o => o.id === id), X = dx_(x), Y = dy_(y);
    others.push({ id, name: pl.name, slot: pl.slot, x: prev ? prev.x : X, y: prev ? prev.y : Y, tx: X, ty: Y, face, walk, hp, maxHp, down: !!down, castT, hue, leaves, cls, rev, sigs, shield: !!shield, orn: !!orn });
  }
  room.others = others;
}
function clientClear(d) {
  const me = d.hp[NET.id]; if (me) { G.flame = me.hp; G.embersRun = NET.em0 + me.em; }
  P.down = false; room = null; HUD.classList.add('hidden');
  if (d.kind === 'boss') bossDown(); else reward(d.kind === 'elite' ? 'Elite slain — claim a reward' : 'Claim a reward', d.kind === 'elite' ? .6 : .25, d.kind === 'elite' ? { leg: .05, orn: .2 } : null);
}
// guest skill goes to the host; dodge stays local
const _skill = skill;
skill = () => { if (!(NET.on && !NET.host && room && room.guest)) return _skill(); if (P.skillCd > 0 || P.down) return; P.skillCd = G.cls === 'witch' ? 9 : 7; toHost({ k: 'skill' }); };
// ---------- drawing other mages ----------
function mates() {
  if (!NET.on || !room) return [];
  if (NET.host) return livePeers().map(q => ({ id: q.id, name: q.name, slot: q.slot, x: q.x, y: q.y, face: q.face, walk: q.walk, castT: q.castT, hue: q.wand ? q.wand.hue : 30, leaves: q.wand ? leavesOf(q.wand) : 1, cls: q.cls, hp: q.hp, maxHp: q.maxHp, down: q.down, rev: q.rev, sigs: sigList(q.wand), shield: q.shield, orn: !!(q.wand && q.wand.ornate) }));
  return room.others;
}
extraEnts = () => mates().map(o => ({ y: o.y, d: () => drawMate(o) }));
function drawMate(o) {
  const t = performance.now() / 1000;
  drawSigils(o.x, o.y, o.sigs, t, o.shield);
  MAGE_OV = { walk: o.walk, face: o.face, castT: o.castT, fl: clamp(o.hp / o.maxHp, .2, 1), hue: o.hue, leaves: o.leaves, orn: !!o.orn };
  try { drawPilgrim(o.x, o.y, t, o.cls, o.down ? .45 : 1); } finally { MAGE_OV = null; }
  tag(o.x, o.y, o.name, slotCol(o.slot), o.hp / o.maxHp, o.down, o.rev);
}
function tag(x, y, name, col, f, down, rev) {
  cx.strokeStyle = col; cx.globalAlpha = .8; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(x, y + 1, 15, 5, 0, 0, TAU); cx.stroke(); cx.globalAlpha = 1;
  cx.font = '9px Georgia'; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillText(name, x + .5, y - 70.5); cx.fillStyle = col; cx.fillText(name, x, y - 71);
  cx.fillStyle = 'rgba(0,0,0,.7)'; cx.fillRect(x - 14, y - 67, 28, 3); cx.fillStyle = col; cx.fillRect(x - 14, y - 67, 28 * clamp(f, 0, 1), 3);
  if (down) { cx.fillStyle = '#ff7a5a'; cx.font = 'bold 10px Georgia'; cx.fillText('DOWN — stand close to revive', x, y + 18); cx.strokeStyle = '#9aff7a'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(x, y - 24, 20, -Math.PI / 2, -Math.PI / 2 + TAU * clamp((rev || 0) / 2, 0, 1)); cx.stroke(); }
  cx.textAlign = 'left';
}
// own tag + downed state, drawn on top of the room in co-op
const _render = render;
render = t => {
  _render(t);
  if (!NET.on || !room || !G) return;
  cx.save(); cx.setTransform(DPR * Z, 0, 0, DPR * Z, 0, 0); tag(P.x, P.y, myName(), slotCol(NET.slot), G.flame / G.maxFlame, P.down, P.rev); cx.restore();
  cx.save(); cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.font = '11px Georgia'; cx.fillStyle = '#d6b98c'; cx.textBaseline = 'middle';
  cx.fillText('⚔ Co-op ' + NET.code + ' · ' + NET.players.length + ' mage' + (NET.players.length > 1 ? 's' : '') + (NET.host ? ' · host' : ''), 14 + SAFE.l, 74 + SAFE.t); cx.restore();
};
// in co-op the world never pauses; the menu offers leaving instead
const _pause = togglePause;
togglePause = () => {
  if (!NET.on) return _pause();
  if (mode !== 'room') return;
  if (UI.innerHTML) return closeUI();
  panel(`<h2>Co-op ${NET.code}</h2><p class="small">The world keeps moving while this is open.</p><button class="btn" id="res">Resume</button><button class="btn sub" id="ab">${NET.host ? 'End the run for everyone' : 'Leave co-op'}</button>`);
  on('res', closeUI); on('ab', () => { if (NET.host) toAll({ k: 'end' }); leaveCoop(); closeUI(); die(true); });
};
// leaving the run / returning to camp closes the session
const _camp = showCamp;
showCamp = () => {
  if (NET.on) { if (NET.host && NET.started) toAll({ k: 'end' }); leaveCoop(); }
  _camp();
  const go = document.getElementById('daily'); if (!go) return;
  go.insertAdjacentHTML('afterend', '<button class="btn" id="coop">⚔ Co-op (1–4 mages online)</button>');
  on('coop', () => coopMenu());
};
// victory: only the host decides about Endless; guests follow
const _victory = victory;
victory = () => {
  _victory(); if (!NET.on) return;
  if (NET.host) { const b = document.getElementById('endless'); if (b) { const f = b.onclick; b.onclick = () => { toAll({ k: 'endless' }); f(); }; } }
};
// boot: invite links (?room=CODE) open the join screen
(function boot() {
  const code = new URLSearchParams(location.search).get('room');
  showCamp();
  if (code) coopMenu(code.toUpperCase().slice(0, 4));
})();
window.__coop = { NET, get room() { return room; }, coopMenu, lobby, makeSnap: () => room && makeSnap() };
