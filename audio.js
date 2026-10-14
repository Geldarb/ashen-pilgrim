'use strict';
// Grimoire Ascent — original procedural audio (WebAudio only, no samples): biome ambience/music, boss theme, SFX.
// Settings (shared with mobile.js) persist in localStorage.
const SET_KEY = 'ga-settings';
const SET = Object.assign({ master: .8, music: .5, sfx: .8, mute: false, haptics: true, fps: 60, parts: 'high' }, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY) || '{}'); } catch (e) { return {}; } })());
function saveSet() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) { } }
const AUD = (() => {
  let ctx = null, master, comp, musicBus, sfxBus, noiseBuf = null, track = null, trackId = '', step = 0, nextT = 0, voices = 0, peakVoices = 0, played = 0, dropped = 0, hbT = 0;
  const MAXV = 14, last = {};
  const TH = { hit: .045, cast: .07, castGuest: .08, pickup: .05, death: .06, click: .03, slot: .05, hurt: .12, dodge: .1 };
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
      master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain();
      musicBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // iOS: a silent buffer started inside the gesture unlocks output
      const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0);
      apply(); setInterval(tick, 100);
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
  }
  function apply() { if (!ctx) return; const t = ctx.currentTime; master.gain.setTargetAtTime(SET.mute ? 0 : SET.master, t, .05); musicBus.gain.setTargetAtTime(SET.music * .55, t, .05); sfxBus.gain.setTargetAtTime(SET.sfx, t, .05); }
  // ---- primitives ----
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur); }
  function out(bus, pan) { if (pan == null || !ctx.createStereoPanner) return bus; const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -.8, .8); p.connect(bus); return p; }
  function tone(type, f0, f1, dur, vol, o = {}) {
    const t = (o.t || ctx.currentTime) + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = type;
    osc.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * (o.glide || .9));
    if (o.det) osc.detune.value = o.det;
    let node = osc; if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || .7; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.dest || out(o.bus || sfxBus, o.pan)); env(g, t, o.a || .005, vol, dur);
    osc.start(t); osc.stop(t + dur + .05); if (!o.music) { voices++; peakVoices = Math.max(peakVoices, voices); osc.onended = () => voices--; }
    return osc;
  }
  function noise(dur, vol, o = {}) {
    const t = (o.t || ctx.currentTime) + (o.at || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = o.ft || 'bandpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || out(o.bus || sfxBus, o.pan)); env(g, t, o.a || .004, vol, dur);
    src.start(t, Math.random() * .5); src.stop(t + dur + .05); if (!o.music) { voices++; peakVoices = Math.max(peakVoices, voices); src.onended = () => voices--; }
  }
  function bell(f, dur, vol, o = {}) { tone('sine', f, f, dur, vol, o); tone('sine', f * 2.76, f * 2.76, dur * .5, vol * .35, o); tone('sine', f * 5.4, f * 5.4, dur * .25, vol * .15, o); }
  const panOf = x => x == null || !W ? 0 : (x / W - .5) * 1.4;
  // ---- sound designs ----
  const EL = {
    Fire: p => { noise(.2, .22, { f0: 500, f1: 2600, q: 1.2, pan: p }); tone('sawtooth', 190, 90, .16, .05, { lp: 900, pan: p }); },
    Water: p => { tone('sine', 760, 240, .16, .2, { pan: p }); noise(.12, .06, { ft: 'lowpass', f0: 900, pan: p }); },
    Wind: p => noise(.22, .18, { f0: 380, f1: 1700, q: 2.2, pan: p, a: .03 }),
    Lightning: p => { tone('square', 1600, 260, .08, .06, { pan: p }); noise(.07, .12, { ft: 'highpass', f0: 3000, pan: p }); },
    Shadow: p => { tone('sawtooth', 110, 82, .26, .07, { lp: 520, pan: p }); tone('sawtooth', 116, 86, .26, .06, { lp: 520, pan: p }); },
    Light: p => bell(1320, .45, .09, { pan: p }),
    Earth: p => { tone('sine', 95, 48, .22, .26, { pan: p }); noise(.1, .1, { ft: 'lowpass', f0: 320, pan: p }); },
    Sound: p => bell(196, 1.3, .2, { pan: p }),
    Blood: p => { tone('sine', 320, 120, .14, .15, { pan: p }); noise(.08, .08, { f0: 700, pan: p }); },
    Poison: p => { tone('sine', 300, 520, .12, .12, { pan: p }); noise(.1, .05, { f0: 1500, q: 4, pan: p }); },
    '': p => tone('triangle', 880, 640, .1, .1, { pan: p }),
  };
  const ELK = { fireball: 'Fire', meteor: 'Fire', nova: 'Fire', ice: 'Water', chain: 'Lightning', bolt: 'Lightning', missile: 'Shadow', blackhole: 'Shadow', acid: 'Poison', skull: 'Shadow', wisp: 'Light', saw: 'Earth', mine: 'Earth', lance: 'Light', bubble: 'Water', sickle: 'Wind', burst: 'Wind', spark: '' };
  const elOf = k => (CARDS[k] && CARDS[k].el) || ELK[k] || '';
  const FX = {
    click: () => tone('triangle', 1250, 950, .05, .1),
    slot: () => { noise(.08, .2, { f0: 900, q: .8 }); tone('sine', 230, 170, .1, .16); },
    cast: (c, world) => {
      if (!c || !c.shots || (world && world !== room)) return false;
      const p = panOf(P.x), k = c.shots[0] && (c.shots[0].tcard || c.shots[0].p); (EL[elOf(c.shots[0].p)] || EL[''])(p);
      if (c.chants && c.chants.length) [0, 4, 7].forEach((s, i) => tone('sine', 440 * Math.pow(2, s / 12), 0, .25, .045, { at: i * .03, pan: p }));
      if (c.shots.some(s => s.trig)) tone('square', 2200, 2200, .02, .04, { pan: p });
      if (c.shots.some(s => s.mods && s.mods.length)) tone('sine', 2640, 2400, .08, .03, { pan: p, at: .02 });
    },
    castGuest: (el, kind) => (EL[el || elOf(kind)] || EL[''])(0),
    hit: f => { const p = panOf(f && f.x); noise(.05, .14, { f0: 1300, q: 1.4, pan: p }); tone('sine', 170, 90, .06, .12, { pan: p }); },
    death: f => { const p = panOf(f && f.x); if (f && f.boss) { bell(98, 2.6, .3); noise(1.6, .25, { ft: 'lowpass', f0: 1200, f1: 80, a: .02 }); tone('sine', 55, 30, 1.5, .3); return; } noise(.36, .18, { ft: 'bandpass', f0: 2200, f1: 260, q: .9, pan: p }); tone('triangle', 140, 60, .25, .1, { pan: p }); },
    hurt: () => { tone('sawtooth', 210, 70, .2, .12, { lp: 1400 }); noise(.12, .14, { f0: 600 }); },
    dodge: () => noise(.2, .16, { f0: 300, f1: 2200, q: 1.6, a: .02 }),
    pickup: () => { const n = (FX._pk = ((FX._pk || 0) + 1) % 8); tone('sine', 1320 * Math.pow(2, n / 24), 1980 * Math.pow(2, n / 24), .08, .08); },
    heart: () => { tone('sine', 62, 40, .14, .5, { bus: sfxBus }); tone('sine', 58, 38, .12, .38, { at: .2 }); },
    revive: () => [0, 4, 7, 12].forEach((s, i) => bell(392 * Math.pow(2, s / 12), .7, .12, { at: i * .09 })),
    phase: () => { bell(110, 2.2, .3); noise(1, .2, { ft: 'lowpass', f0: 600, f1: 60 }); tone('sawtooth', 55, 41, 1.2, .1, { lp: 300 }); },
    bossIntro: () => { bell(82.4, 3, .3); bell(123.5, 2.5, .15, { at: .4 }); },
  };
  function play(name, a, b) {
    if (!ctx || ctx.state !== 'running' || SET.mute || !FX[name]) return;
    const now = ctx.currentTime, th = TH[name] || 0; if (th && now - (last[name] || -9) < th) return;
    if (voices >= MAXV && !['hurt', 'death', 'revive', 'phase', 'click', 'bossIntro'].includes(name)) { dropped++; return; }
    if (FX[name](a, b) === false) return; last[name] = now; played++;
  }
  // ---- music: per-biome moody loops + boss theme, scheduled with lookahead ----
  const AEOL = [0, 2, 3, 5, 7, 8, 10], PHRY = [0, 1, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], LOCR = [0, 1, 3, 5, 6, 8, 10], HARM = [0, 2, 3, 5, 7, 8, 11];
  const TR = {
    hall: { root: 110, sc: AEOL, bpm: 60, prog: [0, 5, 3, 4], pad: 'organ', bell: .25 },
    b0: { root: 110, sc: AEOL, bpm: 66, prog: [0, 3, 5, 4], pad: 'organ', bell: .3, pulse: false },
    b1: { root: 73.42, sc: PHRY, bpm: 76, prog: [0, 1, 0, 6], pad: 'saw', bell: .12, pulse: true },
    b2: { root: 164.8, sc: DOR, bpm: 56, prog: [0, 4, 5, 3], pad: 'glass', bell: .55 },
    b3: { root: 65.41, sc: LOCR, bpm: 60, prog: [0, 6, 1, 0], pad: 'choir', bell: .18 },
    boss: { root: 82.41, sc: HARM, bpm: 116, prog: [0, 5, 6, 4], pad: 'organ', bell: .1, drums: true, bass: true },
  };
  const nf = (T, deg, oct = 0) => { const n = T.sc.length, o = Math.floor(deg / n), d = ((deg % n) + n) % n; return T.root * Math.pow(2, (T.sc[d] + 12 * (o + oct)) / 12); };
  function padNote(f, t, dur, kind, dest) {
    const v = kind === 'glass' ? .03 : .045, o = { t, dest, music: true, a: Math.min(.9, dur * .3) };
    if (kind === 'organ') { tone('sine', f, f, dur, v, o); tone('triangle', f * 2, f * 2, dur, v * .45, o); tone('sine', f * 3, f * 3, dur, v * .15, o); }
    else if (kind === 'saw') { tone('sawtooth', f, f, dur, v * .6, Object.assign({ lp: 600 }, o)); tone('sawtooth', f, f, dur, v * .6, Object.assign({ lp: 600, det: 9 }, o)); }
    else if (kind === 'glass') { tone('sine', f * 2, f * 2, dur, v, o); tone('sine', f * 4.01, f * 4.01, dur * .7, v * .4, o); }
    else { tone('sawtooth', f, f, dur, v * .5, Object.assign({ lp: 750, q: 6 }, o)); tone('sawtooth', f * 1.003, f * 1.003, dur, v * .5, Object.assign({ lp: 1100, q: 5 }, o)); }
  }
  function schedule() {
    if (!track) return; const T = TR[trackId.startsWith('boss') ? 'boss' : trackId] || TR.hall, e = 60 / T.bpm / 2;
    while (nextT < ctx.currentTime + .45) {
      const t = nextT, bar = Math.floor(step / 8), s8 = step % 8, ch = T.prog[bar % T.prog.length], D = track.g;
      if (s8 === 0) for (const k of [0, 2, 4]) padNote(nf(T, ch + k, k ? 0 : -1), t, e * 8 + .4, T.pad, D);
      if (T.bell && Math.random() < T.bell * (s8 % 2 ? .4 : 1)) bell(nf(T, ch + [0, 2, 4, 7][Math.floor(Math.random() * 4)], 1), 1.6, .035, { t, dest: D, music: true });
      if (T.pulse && s8 % 4 === 0) tone('sine', nf(T, ch, -1), nf(T, ch, -1) * .8, .5, .08, { t, dest: D, music: true });
      if (T.drums) {
        if (s8 === 0 || s8 === 3 || s8 === 4) tone('sine', 120, 38, .25, .32, { t, dest: D, music: true });
        if (s8 === 2 || s8 === 6) noise(.16, .1, { t, dest: D, music: true, f0: 1800, q: .7 });
        noise(.03, .025, { t, dest: D, music: true, ft: 'highpass', f0: 7000 });
      }
      if (T.bass) tone('sawtooth', nf(T, ch + (s8 % 4 === 2 ? 4 : 0), -1), 0, e * .9, .06, { t, dest: D, music: true, lp: 500 });
      step++; nextT += e;
    }
  }
  function setTrack(id) {
    if (id === trackId || !ctx) return;
    const t = ctx.currentTime; if (track) { const g = track.g; g.gain.setTargetAtTime(0, t, .5); setTimeout(() => g.disconnect(), 3000); }
    trackId = id; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(1, t + .1, .8); g.connect(musicBus); track = { g }; step = 0; nextT = t + .15;
    if (id.startsWith('boss')) FX.bossIntro();
    if (id.startsWith('boss')) TR.boss.root = [82.41, 73.42, 98, 65.41][(G ? G.floor : 0) % 4];
  }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const want = mode === 'room' && room && room.kind === 'boss' ? 'boss' + (G ? G.floor : 0) : G && mode !== 'camp' ? 'b' + ((G.floor || 0) % 4) : 'hall';
    setTrack(want); schedule();
    // low-HP heartbeat
    if (mode === 'room' && G && G.flame > 0 && G.flame / G.maxFlame < .25 && !P.down) { hbT -= .1; if (hbT <= 0) { hbT = .5 + 1.2 * (G.flame / G.maxFlame) * 4 * .25 + .35; play('heart'); } } else hbT = 0;
  }
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) addEventListener(ev, unlock, { capture: true, passive: true });
  addEventListener('click', e => { if (e.target.closest && e.target.closest('button, .card, .tab')) play('click'); }, true);
  return {
    play, unlock, apply,
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    state: () => ({ ctx: ctx ? ctx.state : 'none', voices, peakVoices, played, dropped, track: trackId, maxVoices: MAXV }),
    get ctx() { return ctx; },
  };
})();
window.AUD = AUD;
