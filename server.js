'use strict';
// Grimoire Ascent: static game + co-op lobby relay (host-authoritative: the host's browser simulates, the server only relays)
const http = require('http'), path = require('path'), express = require('express'), { WebSocketServer } = require('ws');
const app = express(), ROOT = __dirname;
const fs = require('fs');
const ASSETS = ['/', '/index.html', '/style.css', '/art.js', '/game.js', '/pages2.js', '/foes.js', '/coop.js', '/audio.js', '/mobile.js', '/legend.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png'];
const PUBLIC = new Set(ASSETS);
// build version: the deployed commit on Render, else the server start time (local dev)
const BUILD = (process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || 'dev-' + Date.now().toString(36);
const SW = fs.readFileSync(path.join(ROOT, 'sw.template.js'), 'utf8').replace('__BUILD__', BUILD).replace('__ASSETS__', JSON.stringify(ASSETS));
app.get('/healthz', (q, r) => r.send('ok'));
app.get('/version', (q, r) => r.set('Cache-Control', 'no-store').json({ build: BUILD }));
app.get('/sw.js', (q, r) => r.set({ 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache, no-store', 'Service-Worker-Allowed': '/' }).send(SW));
app.use((q, r, next) => PUBLIC.has(q.path) ? next() : r.status(404).send('Not found'));
// no-cache = always revalidate (ETag), so a new deploy is picked up on the next load; the service worker is network-first
app.use(express.static(ROOT, { index: 'index.html', setHeaders: (r, f) => { r.setHeader('Cache-Control', 'no-cache'); if (f.endsWith('.webmanifest')) r.setHeader('Content-Type', 'application/manifest+json'); } }));
const server = http.createServer(app), wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
const rooms = new Map(); // code -> { code, host, members: Map(id -> ws), started }
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
let nextId = 1;
const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
const roster = R => [...R.members.values()].map(w => ({ id: w.id, name: w.name, slot: w.slot, host: w.id === R.host }));
const bcast = (R, m, except) => { for (const w of R.members.values()) if (w !== except) send(w, m); };
function newCode() { for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += LETTERS[Math.random() * LETTERS.length | 0]; if (!rooms.has(c)) return c; } }
function join(ws, R, name) {
  const used = new Set([...R.members.values()].map(w => w.slot)); let slot = 0; while (used.has(slot)) slot++;
  ws.room = R; ws.name = String(name || 'Mage').slice(0, 14); ws.slot = slot; R.members.set(ws.id, ws);
  send(ws, { t: 'joined', code: R.code, id: ws.id, host: R.host === ws.id, slot, players: roster(R) });
  bcast(R, { t: 'roster', players: roster(R) }, ws);
}
function leave(ws) {
  const R = ws.room; if (!R) return; ws.room = null; R.members.delete(ws.id);
  if (R.host === ws.id) { bcast(R, { t: 'host-left' }); for (const w of R.members.values()) w.room = null; rooms.delete(R.code); return; }
  if (!R.members.size) return rooms.delete(R.code);
  bcast(R, { t: 'left', id: ws.id, name: ws.name }); bcast(R, { t: 'roster', players: roster(R) });
}
wss.on('connection', ws => {
  ws.id = nextId++; ws.alive = true; ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'host') { if (ws.room) leave(ws); const R = { code: newCode(), host: ws.id, members: new Map(), started: false }; rooms.set(R.code, R); join(ws, R, m.name); }
    else if (m.t === 'join') {
      const R = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!R) return send(ws, { t: 'error', msg: 'No room with that code.' });
      if (R.members.size >= 4) return send(ws, { t: 'error', msg: 'That room is full (4 mages).' });
      if (R.started) return send(ws, { t: 'error', msg: 'That run has already started.' });
      if (ws.room) leave(ws); join(ws, R, m.name);
    }
    else if (m.t === 'lock') { const R = ws.room; if (R && R.host === ws.id) R.started = !!m.v; }
    else if (m.t === 'leave') leave(ws);
    else if (m.t === 'msg') { // relay: to 'host', 'all' or a member id
      const R = ws.room; if (!R) return; const out = { t: 'msg', from: ws.id, d: m.d };
      if (m.to === 'host') { const h = R.members.get(R.host); if (h && h !== ws) send(h, out); }
      else if (m.to === 'all') bcast(R, out, ws);
      else { const w = R.members.get(m.to); if (w) send(w, out); }
    }
  });
  ws.on('close', () => leave(ws));
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 20000);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Grimoire Ascent on :' + PORT));
