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
const CAMP_KEY = 'ashen-camp', RUN_KEY = 'grimoire-run3';
const DEBUG = new URLSearchParams(location.search).get('debug');
let camp = { embers: 0, total: 0, witch: false, wick: 0, runs: 0, best: 0, bestDepth: 0, dailyBest: {} };
try { Object.assign(camp, JSON.parse(localStorage.getItem(CAMP_KEY) || '{}')); } catch (e) { }
const saveCamp = () => { try { localStorage.setItem(CAMP_KEY, JSON.stringify(camp)); } catch (e) { } };
const WITCH_COST = 60;

// ---------- cards ----------
// t: proj (orange) | mod (blue) | multi (purple) | trig (green) | curse (red, acts as modifier) | rare (gold, rule-breakers)
const CARDS = {
  // projectiles
  spark: { t: 'proj', name: 'Spark Bolt', icon: '✦', mana: 5, delay: 0.05, desc: 'A quick, weak bolt.', spd: 380, dmg: 9, r: 3, life: 1.1, col: '#ffcf6a', lt: '255,200,100' },
  fireball: { t: 'proj', name: 'Fireball', icon: '☄', mana: 25, delay: 0.25, desc: 'Slow; explodes and burns.', spd: 220, dmg: 14, r: 6, life: 1.6, col: '#ff7a1a', lt: '255,120,40', boom: 46, burn: true },
  ice: { t: 'proj', name: 'Ice Shard', icon: '❄', mana: 10, delay: 0.1, desc: 'Freezes foes it hits.', spd: 330, dmg: 10, r: 4, life: 1.2, col: '#bfe8ff', lt: '150,220,255', freeze: true },
  chain: { t: 'proj', name: 'Chain Lightning', icon: '⚡', mana: 22, delay: 0.15, desc: 'Leaps between 3 foes.', spd: 620, dmg: 9, r: 3, life: .8, col: '#cfe0ff', lt: '170,200,255', chain: 3 },
  burst: { t: 'proj', name: 'Bouncing Burst', icon: '◎', mana: 8, delay: 0.08, desc: 'Ricochets off walls.', spd: 300, dmg: 7, r: 4, life: 2.6, col: '#d4ff8a', lt: '200,255,120', bounce: 4 },
  skull: { t: 'proj', name: 'Grave Skull', icon: '☠', mana: 30, delay: 0.35, desc: 'Heavy skull that pierces.', spd: 160, dmg: 26, r: 7, life: 2.4, col: '#e9e2c8', lt: '220,210,170', pierce: 3 },
  missile: { t: 'proj', name: 'Magic Missile', icon: '◆', mana: 18, delay: 0.12, desc: 'Seeks the nearest foe.', spd: 300, dmg: 12, r: 4, life: 1.8, col: '#d08aff', lt: '200,120,255', homing: true },
  acid: { t: 'proj', name: 'Acid Orb', icon: '☣', mana: 16, delay: 0.15, desc: 'Poisons and leaves an acid pool.', spd: 210, dmg: 6, r: 5, life: 1.3, col: '#8aff4a', lt: '130,255,80', acid: true, poison: true },
  blackhole: { t: 'proj', name: 'Black Hole', icon: '●', mana: 60, delay: 0.5, desc: 'Crawls forward, dragging foes in and grinding them.', spd: 70, dmg: 4, r: 9, life: 3.5, col: '#7a3aff', lt: '120,60,255', pull: true, pierce: 999, rehit: .2 },
  meteor: { t: 'proj', name: 'Meteor', icon: '☄', mana: 70, delay: 0.6, desc: 'Falls from the sky onto your target. Huge blast.', spd: 420, dmg: 40, r: 9, life: 3, col: '#ff5a1a', lt: '255,100,30', meteor: true, boom: 70, burn: true },
  saw: { t: 'proj', name: 'Sawblade', icon: '⚙', mana: 20, delay: 0.15, desc: 'Spinning blade: pierces everything, bounces, slows.', spd: 260, dmg: 6, r: 6, life: 2.5, col: '#c8ccd0', lt: '200,200,210', pierce: 999, rehit: .2, bounce: 3, drag: .6 },
  lance: { t: 'proj', name: 'Lance', icon: '⟶', mana: 22, delay: 0.3, desc: 'Very fast spear; pierces 5 foes.', spd: 720, dmg: 18, r: 3, life: .8, col: '#f4e6b0', lt: '255,230,170', pierce: 5, line: 18 },
  bubble: { t: 'proj', name: 'Bubble', icon: '○', mana: 3, delay: 0.03, desc: 'Cheap, slow and wobbly.', spd: 120, dmg: 5, r: 6, life: 2.4, col: '#a8e8ff', lt: '160,220,255', wobble: true, bounce: 1 },
  bolt: { t: 'proj', name: 'Lightning Bolt', icon: 'ϟ', mana: 40, delay: 0.4, desc: 'Near-instant bolt; pierces 2.', spd: 1300, dmg: 20, r: 3, life: .5, col: '#e8f0ff', lt: '190,210,255', pierce: 2, line: 26, zap: true },
  wisp: { t: 'proj', name: 'Summon Wisp', icon: '✧', mana: 35, delay: 0.3, desc: 'A spirit circles you for 4s, burning foes.', spd: 0, dmg: 6, r: 5, life: 4, col: '#d8f6ff', lt: '170,230,255', guard: true, pierce: 999, rehit: .35, burn: true },
  nova: { t: 'proj', name: 'Nova', icon: '✺', mana: 35, delay: 0.35, desc: 'A ring of fire bursts from you.', spd: 0, dmg: 14, r: 4, life: .35, col: '#ffb347', lt: '255,170,70', nova: 90, burn: true },
  sickle: { t: 'proj', name: 'Boomerang Sickle', icon: '☾', mana: 14, delay: 0.15, desc: 'Flies out and returns; hits on both passes.', spd: 340, dmg: 10, r: 5, life: 1.6, col: '#d8d0b8', lt: '220,210,180', boomerang: true, pierce: 999, rehit: .3 },
  mine: { t: 'proj', name: 'Mine', icon: '✇', mana: 18, delay: 0.2, desc: 'Lands and arms; explodes when a foe steps close.', spd: 260, dmg: 24, r: 5, life: 6, col: '#ff4a3a', lt: '255,80,60', mine: true, boom: 55, drag: 1.6 },
  // modifiers
  homing: { t: 'mod', name: 'Homing', icon: '➰', mana: 8, desc: 'Next spell seeks foes.' },
  pierce: { t: 'mod', name: 'Pierce', icon: '➶', mana: 10, desc: 'Next spell passes through 2 more foes.' },
  bounce: { t: 'mod', name: 'Bounce', icon: '↯', mana: 4, desc: 'Next spell bounces off walls 3 times.' },
  speed: { t: 'mod', name: 'Speed Up', icon: '»', mana: 3, desc: 'Next spell flies 80% faster.' },
  heavy: { t: 'mod', name: 'Heavy', icon: '⚓', mana: 10, delay: 0.1, desc: '+80% damage, 30% slower.' },
  trail: { t: 'mod', name: 'Fire Trail', icon: '🔥', mana: 10, desc: 'Next spell leaves burning ground.' },
  freeze: { t: 'mod', name: 'Freeze on Hit', icon: '✻', mana: 10, desc: 'Next spell freezes foes.' },
  explode: { t: 'mod', name: 'Explode on Hit', icon: '✸', mana: 15, desc: 'Next spell explodes on impact.' },
  orbit: { t: 'mod', name: 'Orbit', icon: '⟲', mana: 8, desc: 'Next spell circles you instead of flying (lasts longer).' },
  split: { t: 'mod', name: 'Split on Hit', icon: '⑂', mana: 14, desc: 'On hit, bursts into 3 sparks.' },
  poison: { t: 'mod', name: 'Poison', icon: '☠', mana: 8, desc: 'Next spell poisons (5 dmg/s for 3s).' },
  knock: { t: 'mod', name: 'Knockback', icon: '⇉', mana: 5, desc: 'Next spell hurls foes back.' },
  larger: { t: 'mod', name: 'Larger', icon: '⬤', mana: 12, delay: 0.05, desc: 'Double size, +30% damage, 20% slower.' },
  smallfast: { t: 'mod', name: 'Smaller and Faster', icon: '·»', mana: 2, delay: -0.05, desc: 'Half size, 60% faster, quicker to cast.' },
  accel: { t: 'mod', name: 'Accelerate', icon: '⤴', mana: 5, desc: 'Next spell starts slow and speeds up; hits harder when fast.' },
  pingpong: { t: 'mod', name: 'Ping-pong', icon: '⇄', mana: 4, desc: 'Next spell reverses direction twice.' },
  critburn: { t: 'mod', name: 'Critical on Burning', icon: '✹', mana: 8, desc: 'Triple damage against burning foes.' },
  lifesteal: { t: 'mod', name: 'Lifesteal', icon: '♥', mana: 25, delay: 0.1, desc: 'Next spell returns 15% of its damage as HP.' },
  chainmod: { t: 'mod', name: 'Chain', icon: '⛓', mana: 15, desc: 'Next spell arcs to 2 more foes.' },
  wave: { t: 'mod', name: 'Wave Path', icon: '∿', mana: 2, desc: 'Next spell weaves side to side.' },
  addmana: { t: 'mod', name: 'Add Mana', icon: '✚', mana: -30, delay: 0.1, desc: 'Refunds 30 mana. Does nothing else.' },
  // multicasts
  double: { t: 'multi', name: 'Double Spell', icon: '⑵', mana: 0, n: 2, spread: 0.12, desc: 'Casts the next 2 spells at once.' },
  triple: { t: 'multi', name: 'Triple Spell', icon: '⑶', mana: 2, n: 3, spread: 0.12, desc: 'Casts the next 3 spells at once.' },
  quad: { t: 'multi', name: 'Quad Spell', icon: '⑷', mana: 5, n: 4, spread: 0.1, desc: 'Casts the next 4 spells at once.' },
  spreadc: { t: 'multi', name: 'Spread', icon: '⋔', mana: 0, n: 2, spread: 0.6, desc: 'Next 2 spells in a wide fan.' },
  circle: { t: 'multi', name: 'Circle Cast', icon: '❂', mana: 6, n: 4, circle: true, desc: 'Next 4 spells fire in a full circle.' },
  behind: { t: 'multi', name: 'Behind-and-Forward', icon: '⇋', mana: 2, n: 2, behind: true, desc: 'Next 2 spells: one forward, one behind.' },
  // triggers
  trigger: { t: 'trig', name: 'Spark Bolt with Trigger', icon: '✦⇢', mana: 10, delay: 0.05, trig: 'hit', desc: 'A spark; casts the next spell where it hits.' },
  timer: { t: 'trig', name: 'Timer Bolt', icon: '⏱', mana: 10, delay: 0.05, trig: 'timer', desc: 'A spark; casts the next spell after 0.5s.' },
  deathtrig: { t: 'trig', name: 'Death Trigger', icon: '✝', mana: 12, delay: 0.05, trig: 'death', desc: 'A spark; casts the next spell from any foe it kills.' },
  expiry: { t: 'trig', name: 'Expiry Trigger', icon: '⌛', mana: 10, delay: 0.05, trig: 'expiry', desc: 'A spark; casts the next spell where it vanishes.' },
  // cursed
  bloodwax: { t: 'curse', name: 'Bloodwax', icon: '🩸', mana: 0, desc: 'CURSED: costs 3 flame, not mana. Next spell deals double damage.' },
  // rare rule-breakers
  copy: { t: 'rare', name: 'Copy Wand', icon: '⎘', mana: 50, delay: 0.3, desc: 'RARE: also casts a bare copy of every projectile in this wand.' },
  inverted: { t: 'rare', name: 'Inverted', icon: '⇆', mana: 0, desc: 'RARE: anywhere in a wand, makes it read right→left.' },
};
// ---------- anime retheme: grimoire page names + element colours (mechanics unchanged) ----------
const PAGE_THEME = {
  spark: ['Wind Dart', '#6dffb0', '110,255,170', 'Wind'], fireball: ['Blaze Orb', '#ff5a1a', '255,110,40', 'Fire'], ice: ['Frost Needle', '#8fe4ff', '140,220,255', 'Water'],
  chain: ['Thunder Chain', '#ffe84a', '255,230,80', 'Lightning'], burst: ['Gale Ricochet', '#a8ff6a', '170,255,110', 'Wind'], skull: ['Shadow Skull', '#b07aff', '170,110,255', 'Shadow'],
  missile: ['Seeker Star', '#ff7ae0', '255,120,220', 'Light'], acid: ['Venom Drop', '#9aff3a', '150,255,60', 'Poison'], blackhole: ['Void Maw', '#7a3aff', '120,60,255', 'Shadow'],
  meteor: ['Falling Star', '#ff8a2a', '255,140,40', 'Fire'], saw: ['Cyclone Disc', '#c8fff0', '200,255,240', 'Wind'], lance: ['Light Spear', '#fff6a0', '255,245,160', 'Light'],
  bubble: ['Water Bubble', '#5ac8ff', '90,200,255', 'Water'], bolt: ['Sky Thunder', '#fff04a', '255,240,80', 'Lightning'], wisp: ['Spirit Familiar', '#d8f6ff', '200,240,255', 'Light'],
  nova: ['Flare Ring', '#ffb347', '255,180,70', 'Fire'], sickle: ['Crescent Blade', '#e8e8ff', '230,230,255', 'Wind'], mine: ['Earth Rune Trap', '#d08a4a', '210,140,70', 'Earth'],
  homing: ['Tracking Glyph'], pierce: ['Piercing Glyph'], bounce: ['Rebound Glyph'], speed: ['Haste Glyph'], heavy: ['Stone Weight'], trail: ['Flame Wake'], freeze: ['Frost Seal'],
  explode: ['Burst Seal'], orbit: ['Orbit Glyph'], split: ['Scatter Seal'], poison: ['Venom Seal'], knock: ['Gust Push'], larger: ['Grand Glyph'], smallfast: ['Swift Glyph'],
  accel: ['Surge Glyph'], pingpong: ['Mirror Glyph'], critburn: ['Inferno Critical'], lifesteal: ['Life Drain'], chainmod: ['Arc Link'], wave: ['Serpent Path'], addmana: ['Mana Font'],
  double: ['Twin Chant'], triple: ['Triple Chant'], quad: ['Quad Chant'], spreadc: ['Fan Chant'], circle: ['Ring Chant'], behind: ['Back-and-Front Chant'],
  trigger: ['Relay Dart'], timer: ['Delay Dart'], deathtrig: ['Requiem Dart'], expiry: ['Fading Dart'],
  bloodwax: ['Blood Pact'], copy: ['Echo Page'], inverted: ['Null Reversal'],
};
for (const [id, [name, col, lt, el]] of Object.entries(PAGE_THEME)) { const c = CARDS[id]; c.name = name; if (col) { c.col = col; c.lt = lt; c.el = el; } }
CARDS.split.desc = 'On hit, bursts into 3 wind darts.';
CARDS.trigger.desc = 'A wind dart; casts the next page where it hits.'; CARDS.timer.desc = 'A wind dart; casts the next page after 0.5s.';
CARDS.deathtrig.desc = 'A wind dart; casts the next page from any foe it defeats.'; CARDS.expiry.desc = 'A wind dart; casts the next page where it fades.';
CARDS.bloodwax.desc = 'FORBIDDEN: costs 3 HP, not mana. Next spell deals double damage.';
CARDS.copy.desc = 'RARE: also casts a bare echo of every attack page in this grimoire.';
CARDS.inverted.desc = 'RARE anti-magic: anywhere in a grimoire, negates its order so it reads right→left.';
CARDS.addmana.desc = 'Refunds 30 mana. Does nothing else.';
for (const c of Object.values(CARDS)) c.desc = c.desc.replace(/Next spell/g, 'Next spell');
// ---------- floors / biomes ----------
const FLOORS = [
  { name: 'Verdant Ruins', boss: 'Thorn Colossus', pattern: 'radial', prop: 'leaf', lamp: '#d8b060', lampRgb: '220,150,70',
    names: ['Thornling', 'Moss Imp', 'Bramble Seer'], pal: { bg: '#0c0f0a', wallTop: '#0a0d09', wallBot: '#1f2a1e', block: [58, 70, 50], surround: '#2f3a2a', win: ['#3e5e44', '#1e3024', '#0c140e'], winHi: 'rgba(150,220,150,.12)', pillar: '#1d241a', pillarL: '#2e3a28', ledge: '#3a4632', banner: '#1f3a22', trim: '#9a8a4a', floorTop: '#232a1e', floorBot: '#161b13', tile: [38, 46, 32], moss: 'rgba(80,120,50,.6)', grade: 'rgba(30,60,30,.10)' },
    skin: { a: '#5ac85a', d: '#3a8a3a', horn: '#f0e0a0', eye: '#ffe14a', wing: '#2f8a5a', robe: '#3a7a4a', robeD: '#285a34' }, bossSkin: { a: '#4aa84a', d: '#2f7a34', trim: '#c89a4a', gem: '#ff5aa8', glow: '#7dff9a' } },
  { name: 'Cinder Caldera', boss: 'Magma Tyrant', pattern: 'spiral', prop: 'lava', lamp: '#ffb02a', lampRgb: '255,150,50',
    names: ['Cinder Brute', 'Ash Imp', 'Pyre Seer'], pal: { bg: '#120a08', wallTop: '#0e0706', wallBot: '#2e1a14', block: [80, 46, 34], surround: '#3a2218', win: ['#a8461a', '#5a1e0e', '#1e0a06'], winHi: 'rgba(255,150,60,.16)', pillar: '#24140f', pillarL: '#3a2218', ledge: '#4a2c1e', banner: '#5a1a12', trim: '#c88a3a', floorTop: '#2a1a15', floorBot: '#170e0b', tile: [50, 32, 26], moss: 'rgba(255,90,20,.55)', grade: 'rgba(80,20,0,.10)' },
    skin: { a: '#e8503a', d: '#a8302a', horn: '#2a1a1a', eye: '#fff04a', wing: '#8a2a2a', robe: '#4a2a3a', robeD: '#301a28' }, bossSkin: { a: '#c8402a', d: '#8a2a1a', trim: '#ffcf4a', gem: '#fff04a', glow: '#ffb02a' } },
  { name: 'Frostspire Halls', boss: 'Rime Matriarch', pattern: 'aimed', prop: 'ice', lamp: '#9ac8ff', lampRgb: '120,170,255',
    names: ['Frost Ghoul', 'Ice Sprite', 'Rime Seer'], pal: { bg: '#0a0d12', wallTop: '#080a10', wallBot: '#1e2633', block: [56, 66, 84], surround: '#2c3546', win: ['#4a6a90', '#1e2c44', '#0a1018'], winHi: 'rgba(170,210,255,.14)', pillar: '#181e2a', pillarL: '#2a3446', ledge: '#36425a', banner: '#1e2a4a', trim: '#8aa0c0', floorTop: '#1f2530', floorBot: '#12161e', tile: [36, 42, 54], moss: 'rgba(170,215,255,.35)', grade: 'rgba(20,40,80,.10)' },
    skin: { a: '#bfe8ff', d: '#7ab0e0', horn: '#ffffff', eye: '#3a8aff', wing: '#8ac8f0', robe: '#5a7ad0', robeD: '#3a54a0' }, bossSkin: { a: '#e8f4ff', d: '#9ac0e8', trim: '#5a8aff', gem: '#4ad8ff', glow: '#8fe4ff' } },
  { name: 'Abyssal Palace', boss: 'Hollow Sovereign', pattern: 'chaos', prop: 'void', lamp: '#c07aff', lampRgb: '170,90,240',
    names: ['Void Knight', 'Shade Bat', 'Abyss Priest'], pal: { bg: '#0b0810', wallTop: '#08060c', wallBot: '#221a2e', block: [62, 48, 78], surround: '#30243e', win: ['#6a2a6a', '#2e1236', '#0e0612'], winHi: 'rgba(220,120,255,.14)', pillar: '#1a1424', pillarL: '#2c2238', ledge: '#3a2c48', banner: '#3a1240', trim: '#b08ac8', floorTop: '#1e1826', floorBot: '#110d16', tile: [40, 32, 50], moss: 'rgba(180,90,255,.45)', grade: 'rgba(50,10,70,.12)' },
    skin: { a: '#5a4a8a', d: '#382a60', horn: '#ff4a9a', eye: '#ff4a9a', wing: '#2a1a4a', robe: '#22183a', robeD: '#140e24' }, bossSkin: { a: '#3a2a5a', d: '#22183a', trim: '#ffcf4a', gem: '#ff4a9a', glow: '#d07aff' } },
];
const ENDLESS_START = 4;
function biome() { return FLOORS[(G ? G.floor || 0 : 0) % 4]; }
function depthOf() { return G.floor - ENDLESS_START + 1; }
function leavesOf(w) { return clamp(w.leaves || Math.ceil(w.slots.length / 2), 1, 5); }
function difficulty() { return 1 + G.floor * 0.5 + G.step * 0.1 + Math.max(0, G.floor - 3) * 0.15; }
const CARD_POOL = Object.keys(CARDS).filter(k => !['bloodwax', 'copy', 'inverted'].includes(k));
const RARE_POOL = ['copy', 'inverted'];
const TYPE_NAME = { proj: 'Attack Page', mod: 'Glyph Page', multi: 'Chant Page', trig: 'Trigger Page', curse: 'Forbidden Page', rare: 'Rare Page' };

function makeWand(o) { return Object.assign({ name: 'Wand', slots: [], delay: .25, recharge: .5, maxMana: 100, mana: 100, regen: 30, idx: 0, cd: 0, hue: 30 }, o); }
const WAND_NAMES = ['Gale Codex', 'Ember Tome', 'Tidebound Grimoire', 'Storm Ledger', 'Umbral Folio', 'Dawn Psalter', 'Stoneleaf Book', 'Starlit Almanac'];
function randomWand(tier) {
  const n = clamp(Math.round(2 + rnd(2, 4) + tier * 0.5), 2, 8);
  const w = makeWand({ name: pick(WAND_NAMES), slots: Array(n).fill(null), delay: +rnd(.08, .35).toFixed(2), recharge: +rnd(.2, .9).toFixed(2), maxMana: Math.round(rnd(80, 220)), regen: Math.round(rnd(25, 70)), hue: Math.round(rnd(360)) });
  w.mana = w.maxMana; w.leaves = clamp(Math.ceil(n / 2) + (rng() < .2 ? 1 : 0), 1, 5); w.name = ['One', 'Two', 'Three', 'Four', 'Five'][w.leaves - 1] + '-Leaf ' + w.name;
  w.slots[0] = pick(['spark', 'burst', 'ice', 'spark', 'missile', 'bubble']); if (rng() < .5) w.slots[1] = pick(['double', 'speed', 'homing', 'spark', 'wave']);
  return w;
}
function starter(cls) {
  if (cls === 'witch') return { wands: [makeWand({ name: 'Three-Leaf Tidebound Grimoire', leaves: 3, slots: ['ice', 'spark', null], delay: .17, recharge: .35, maxMana: 120, mana: 120, regen: 40, hue: 195 })], bag: ['double', 'speed', null, null, null, null, null, null] };
  return { wands: [makeWand({ name: 'One-Leaf Ember Tome', leaves: 1, slots: ['spark', null], delay: .22, recharge: .4, maxMana: 80, mana: 80, regen: 30, hue: 30 })], bag: ['homing', null, null, null, null, null, null, null] };
}

// ---------- cast engine (Noita-style) ----------
// Slots read left→right (or right→left if Inverted is anywhere in the wand). Modifiers attach to the next projectile;
// multicasts draw the next N spells into one cast; triggers are a spark whose payload is the next spell drawn.
function buildCast(wand) {
  let deck = wand.slots.filter(Boolean);
  if (deck.includes('inverted')) deck = deck.filter(id => id !== 'inverted').reverse();
  if (!deck.some(id => CARDS[id].t === 'proj' || CARDS[id].t === 'trig')) return null;
  let p = wand.idx >= deck.length ? 0 : wand.idx, drawn = 0, wrapped = false, mana = 0, delay = 0, flame = 0;
  const next = () => { if (drawn >= deck.length) return null; if (p >= deck.length) { p = 0; wrapped = true; } const id = deck[p++]; drawn++; const c = CARDS[id]; mana += c.mana || 0; delay += c.delay || 0; if (id === 'bloodwax') flame += 3; return id; };
  function one(mods) {
    for (; ;) {
      const id = next(); if (!id) return [];
      const c = CARDS[id];
      if (c.t === 'mod' || c.t === 'curse') { if (id !== 'addmana') mods.push(id); continue; }
      if (c.t === 'proj') return [{ p: id, mods, off: 0 }];
      if (c.t === 'trig') return [{ p: 'spark', mods, off: 0, trig: c.trig, tcard: id, payload: one([]) }];
      if (c.t === 'rare') { const copies = deck.filter(d => CARDS[d].t === 'proj').map(d => ({ p: d, mods: [], off: 0, copy: true })); copies.forEach(s => mana += Math.round(CARDS[s.p].mana / 2)); return copies.concat(one(mods)); }
      if (c.t === 'multi') {
        const g = []; for (let i = 0; i < c.n; i++) g.push(...one(mods.slice()));
        g.forEach((s, i) => s.off += c.circle ? i * TAU / g.length : c.behind ? (i % 2) * Math.PI : (i - (g.length - 1) / 2) * c.spread);
        return g;
      }
    }
  }
  const shots = one([]);
  if (p >= deck.length) { p = 0; wrapped = true; }
  return { shots, mana, delay, flame, wrapped, nextIdx: p };
}
function describeCast(wand) {
  const c = buildCast(Object.assign({}, wand, { idx: 0 })); if (!c) return 'No attack page — this grimoire casts nothing.';
  const d = s => (s.tcard ? CARDS[s.tcard].name : CARDS[s.p].name + (s.copy ? ' (copy)' : '')) + (s.mods.length ? ' [' + s.mods.map(m => CARDS[m].name).join(', ') + ']' : '') + (s.trig ? ' → (' + (s.payload.map(d).join(' + ') || 'nothing') + ')' : '');
  return c.shots.map(d).join(' + ') + ' · ' + c.mana + ' mana';
}
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
  const b = CARDS[spec.p], cnt = id => spec.mods.filter(q => q === id).length, m = id => cnt(id) > 0;
  let spd = b.spd * Math.pow(1.8, cnt('speed')) * Math.pow(0.7, cnt('heavy')) * Math.pow(.8, cnt('larger')) * Math.pow(1.6, cnt('smallfast'));
  let dmg = b.dmg * Math.pow(1.8, cnt('heavy')) * Math.pow(2, cnt('bloodwax')) * Math.pow(1.3, cnt('larger')) * (world.dmgMul || 1);
  const r = b.r * Math.pow(2, cnt('larger')) * Math.pow(.5, cnt('smallfast'));
  const s = {
    kind: spec.p, x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, spd, dmg, r, el: b.el, col: m('bloodwax') ? '#ff4a5a' : b.col, lt: m('bloodwax') ? '255,60,70' : b.lt,
    life: b.life * (m('speed') ? 0.8 : 1) + (m('bounce') ? 1 : 0) + (m('orbit') ? 1.5 : 0),
    homing: b.homing || m('homing'), pierce: (b.pierce || 0) + 2 * cnt('pierce'), bounce: (b.bounce || 0) + 3 * cnt('bounce') + (m('pingpong') ? 0 : 0), trail: m('trail'), trailT: 0,
    freeze: b.freeze || m('freeze'), boom: b.boom || (m('explode') ? 40 : 0), burn: b.burn || m('trail'), chain: (b.chain || 0) + 2 * cnt('chainmod'),
    poison: b.poison || m('poison'), knock: m('knock'), accel: m('accel'), pingpong: m('pingpong') ? 2 : 0, critburn: m('critburn'), lifesteal: m('lifesteal'), wave: m('wave'), split: m('split') && !spec.nosplit,
    rehit: b.rehit || 0, rht: b.rehit || 0, trig: spec.trig, payload: spec.payload, age: 0, hit: [], spin: fx() * TAU, ang,
  };
  if (s.accel) { s.spd *= .35; s.vx *= .35; s.vy *= .35; }
  const caster = world.caster || { x, y };
  if (b.meteor) { const t = nearestFoe(world, x, y); const tx = t ? t.x : x + Math.cos(ang) * 160, ty = t ? t.y : y + Math.sin(ang) * 160; s.x = tx + 30; s.y = ty - 240; s.groundY = ty; const l = Math.hypot(-30, 240); s.vx = -30 / l * spd; s.vy = 240 / l * spd; s.tx = tx; s.ty = ty; }
  if (b.nova) { s.x = caster.x; s.y = caster.y - 10; s.vx = s.vy = 0; s.novaR = 4; s.novaMax = b.nova * (r / b.r); s.pierce = 999; }
  if (b.guard || m('orbit')) { s.orbit = { c: caster, a: ang, rad: b.guard ? 42 : 48 + fx() * 6 }; }
  world.shots.push(s);
  return s;
}
function releasePayload(world, s, avoid, noRehit) {
  if (!s.payload || !s.payload.length || s.released) return; s.released = true;
  const t = nearestFoe(world, s.x, s.y, avoid ? [avoid] : null);
  const a = t ? Math.atan2(t.y - t.r * .8 - s.y, t.x - s.x) : Math.atan2(s.vy, s.vx);
  const keep = world.caster; world.caster = { x: s.x, y: s.y + 10 }; // novas/orbits from a payload centre on the impact point
  for (const p of s.payload) { const n = spawnShot(world, p, s.x, s.y, a + p.off); if (noRehit) n.hit.push(avoid); }
  world.caster = keep;
  world.fxs.push({ type: 'ring', x: s.x, y: s.y + 10, r: 2, R: 16, life: .2, c: '#7dff7a' });
}
function nearestFoe(world, x, y, skip) { let b = null, bd = 1e9; for (const f of world.foes) { if (f.dead || f.spawnT > 0 || (skip && skip.includes(f))) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; b = f; } } return b; }
function explode(world, x, y, R, dmg) { if (world === room) { sfx(x, y - R * .6, R > 60 ? 'KA-BOOM!' : 'BOOM!', '#ffb02a', R > 60 ? 22 : 16); if (R > 60) impact(.06); } world.fxs.push({ type: 'boom', x, y, r: 4, R, life: .32 }); for (let i = 0; i < 18; i++) { const a = fx() * TAU, v = 80 + fx() * 140; world.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .3 + fx() * .3, c: i % 3 ? '#ffb347' : '#ff5a1a', s: 2 + fx() * 2, ember: true }); } for (const f of world.foes) if (!f.dead && Math.hypot(f.x - x, f.y - f.r * .6 - y) < R + f.r) hurtFoe(world, f, dmg); }
function onHit(world, s, f) {
  let dmg = s.dmg * (s.critburn && f.burn > 0 ? 3 : 1) * (s.accel ? clamp(s.spd / 300, .6, 2.2) : 1);
  if (s.critburn && f.burn > 0) world.fxs.push({ type: 'sfx', x: f.x, y: f.y - f.r * 2.2, txt: 'CRIT!', col: '#ff5a1a', size: 14, life: .6, rot: -.2 });
  const k = s.knock ? .9 : .12, killed = hurtFoe(world, f, dmg, s.vx * k, s.vy * k);
  if (s.lifesteal && world.onHeal) world.onHeal(dmg * .15);
  if (s.freeze) f.frozen = 1.6; if (s.burn) f.burn = Math.max(f.burn, 2.2); if (s.poison) f.poison = 3;
  if (s.boom) explode(world, s.x, s.y, s.boom, s.dmg * .7);
  if (s.chain) { let from = f, hitL = [f]; for (let q = 0; q < s.chain; q++) { const n = nearestFoe(world, from.x, from.y, hitL); if (!n || Math.hypot(n.x - from.x, n.y - from.y) > 170) break; world.fxs.push({ type: 'bolt', x: from.x, y: from.y, x2: n.x, y2: n.y, life: .18 }); if (q === 0 && world === room && fx() < .4) sfx(n.x, n.y - 30, 'ZAP!', '#ffe84a', 13); hurtFoe(world, n, s.dmg * .8); hitL.push(n); from = n; } }
  if (s.split) { const a = Math.atan2(s.vy, s.vx); for (let i = -1; i <= 1; i++) { const c = spawnShot(world, { p: 'spark', mods: [], nosplit: true }, s.x, s.y, a + Math.PI + i * .7); c.dmg *= .5; c.hit.push(f); } }
  if (s.trig === 'hit') releasePayload(world, s, f);
  if (s.trig === 'death' && killed) { s.x = f.x; s.y = f.y - f.r; releasePayload(world, s, f, true); }
  if (s.pierce > 0) s.pierce--; else s.life = 0;
}
function updateShots(world, dt) {
  const A = world.bounds;
  for (const s of world.shots) {
    s.age += dt; s.life -= dt; s.spin += dt * 14;
    if (s.rehit && (s.rht -= dt) <= 0) { s.rht = s.rehit; s.hit.length = 0; }
    if (s.orbit) { const o = s.orbit; o.a += dt * (s.kind === 'wisp' ? 3.5 : 5); const nx = o.c.x + Math.cos(o.a) * o.rad, ny = o.c.y - 12 + Math.sin(o.a) * o.rad; s.vx = (nx - s.x) / Math.max(dt, 1e-3); s.vy = (ny - s.y) / Math.max(dt, 1e-3); s.x = nx; s.y = ny; }
    else if (s.novaR !== undefined) { s.novaR = Math.min(s.novaMax, s.novaR + dt * 320); }
    else {
      if (s.homing) { const t = nearestFoe(world, s.x, s.y, s.hit); if (t) { const want = Math.atan2(t.y - t.r * .8 - s.y, t.x - s.x), cur = Math.atan2(s.vy, s.vx); let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; const na = cur + clamp(d, -6 * dt, 6 * dt), sp = Math.hypot(s.vx, s.vy); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp; } }
      if (s.accel) { const k = 1 + 2.2 * dt; s.vx *= k; s.vy *= k; s.spd *= k; }
      if (s.wave) { const a = Math.cos(s.age * 14) * 9 * dt, c = Math.cos(a), si = Math.sin(a); [s.vx, s.vy] = [s.vx * c - s.vy * si, s.vx * si + s.vy * c]; }
      if (s.pingpong && s.age > (3 - s.pingpong) * .35) { s.pingpong--; s.vx *= -1; s.vy *= -1; s.hit.length = 0; }
      if (CARDS[s.kind].boomerang && s.age > .45) { const c = world.caster || s; const dx = c.x - s.x, dy = c.y - 12 - s.y, d = Math.hypot(dx, dy) || 1; s.vx += (dx / d * 900) * dt; s.vy += (dy / d * 900) * dt; const sp = Math.hypot(s.vx, s.vy); if (sp > 380) { s.vx *= 380 / sp; s.vy *= 380 / sp; } if (d < 14 && s.age > .7) s.life = 0; }
      if (CARDS[s.kind].drag) { const k = Math.max(0, 1 - CARDS[s.kind].drag * dt); s.vx *= k; s.vy *= k; }
      if (CARDS[s.kind].wobble) { s.vx += Math.cos(s.age * 9) * 60 * dt; s.vy += Math.sin(s.age * 7) * 60 * dt; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (!s.groundY) {
        if (s.x < A.x0 || s.x > A.x1) { if (s.bounce > 0) { s.bounce--; s.vx *= -1; s.x = clamp(s.x, A.x0, A.x1); } else s.life = 0; }
        if (s.y < A.y0 - 20 || s.y > A.y1) { if (s.bounce > 0) { s.bounce--; s.vy *= -1; s.y = clamp(s.y, A.y0 - 20, A.y1); } else s.life = 0; }
      }
    }
    if (s.trail && (s.trailT -= dt) <= 0) { s.trailT = 0.05; world.patches.push({ x: s.x, y: s.y + 8, life: 1.3, kind: 'fire' }); }
    if (fx() < .5) world.parts.push({ x: s.x, y: s.y, vx: (fx() - .5) * 30, vy: (fx() - .5) * 30, life: .22, c: s.col, s: 2 });
    if (CARDS[s.kind].pull) for (const f of world.foes) { if (f.boss || f.dummy || f.dead) continue; const dx = s.x - f.x, dy = s.y - f.y, d = Math.hypot(dx, dy) || 1; if (d < 110) { f.x += dx / d * 120 * dt; f.y += dy / d * 120 * dt; } }
    if (s.groundY !== undefined) { if (s.y >= s.groundY) { s.y = s.groundY; explode(world, s.x, s.y - 6, s.boom, s.dmg); shake = Math.max(shake, 6); s.life = 0; } continue; }
    if (s.novaR !== undefined) { for (const f of world.foes) if (!f.dead && !s.hit.includes(f) && Math.abs(Math.hypot(f.x - s.x, f.y - f.r * .6 - s.y) - s.novaR) < f.r + 8) { s.hit.push(f); onHit(world, s, f); s.life = Math.max(s.life, .01); s.pierce = 999; } continue; }
    if (CARDS[s.kind].mine) { if (s.age > .4) for (const f of world.foes) if (!f.dead && Math.hypot(f.x - s.x, f.y - f.r * .5 - s.y) < 34 + f.r) { explode(world, s.x, s.y, s.boom, s.dmg); s.life = 0; break; } continue; }
    if (s.trig === 'timer' && s.age > .5) { releasePayload(world, s); s.life = 0; }
    for (const f of world.foes) {
      if (f.dead || f.spawnT > 0 || s.hit.includes(f) || s.life <= 0) continue;
      if (Math.hypot(f.x - s.x, f.y - s.y - f.r * .8) > f.r + s.r + 4) continue;
      s.hit.push(f); onHit(world, s, f);
    }
    if (s.life <= 0) {
      if (s.trig === 'hit' || s.trig === 'expiry') releasePayload(world, s);
      if (CARDS[s.kind].acid) for (let i = 0; i < 4; i++) world.patches.push({ x: s.x + (fx() - .5) * 26, y: s.y + 6 + (fx() - .5) * 10, life: 2.5, kind: 'acid' });
    }
  }
  world.shots = world.shots.filter(s => s.life > 0);
  if (world.shots.length > 260) world.shots.splice(0, world.shots.length - 260);
  for (const p of world.patches) { p.life -= dt; for (const f of world.foes) if (!f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 14 + f.r * .5) { if (p.kind === 'acid') f.poison = Math.max(f.poison || 0, 1); else f.burn = Math.max(f.burn, 1); } }
  world.patches = world.patches.filter(p => p.life > 0); if (world.patches.length > 220) world.patches.splice(0, world.patches.length - 220);
}
function tickStatus(world, f, dt) {
  if (f.burn > 0) { f.burn -= dt; hurtTick(world, f, 6 * dt); if (fx() < .3) world.parts.push({ x: f.x + (fx() - .5) * f.r, y: f.y - f.r * .5, vx: 0, vy: -40, life: .4, c: '#ff7a1a', s: 2, ember: true }); }
  if (f.poison > 0) { f.poison -= dt; hurtTick(world, f, 5 * dt); }
}
function hurtTick(world, f, d) { f.hp -= d; f.dmgTaken = (f.dmgTaken || 0) + d; if (world.onDmg) world.onDmg(f, d); if (f.hp <= 0 && !f.dead) { if (f.dummy) f.hp = f.max; else killFoe(world, f); } }
function hurtFoe(world, f, dmg, kx = 0, ky = 0) {
  if (f.dead) return false;
  f.hp -= dmg; f.hit = 0.12; f.dmgTaken = (f.dmgTaken || 0) + dmg; if (!f.boss && !f.dummy) { f.kx += kx; f.ky += ky; }
  for (let i = 0; i < 3; i++) world.parts.push({ x: f.x, y: f.y - f.r, vx: (fx() - .5) * 160, vy: (fx() - .5) * 160, life: .35, c: '#9a8a6a', s: 2 });
  if (world.onDmg) world.onDmg(f, dmg);
  if (f.hp <= 0) { if (f.dummy) { f.hp = f.max; return true; } killFoe(world, f); return true; }
  return false;
}

// ---------- state ----------
let G = null, mode = 'camp', paused = false, room = null;
const P = { x: 0, y: 0, vx: 0, vy: 0, r: 13, face: 0, dodgeT: 0, dodgeCd: 0, skillCd: 0, inv: 0, hurt: 0, walk: 0 };
const CLASSES = {
  pilgrim: { name: 'Kai Emberline', flame: 100, speed: 150 },
  witch: { name: 'Lumi Vesper', flame: 80, speed: 162 },
};
const CURSES = [
  { id: 'wrath', name: 'Hex of Wrath', icon: '☠', desc: 'Foes deal +35% damage.' },
  { id: 'legion', name: 'Hex of the Horde', icon: '👥', desc: 'More foes in every room.' },
  { id: 'iron', name: 'Hex of Iron Hide', icon: '⛨', desc: 'Foes have +40% health.' },
];
const DOORS = {
  fight: { icon: '⚔', name: 'Battle', desc: 'Monsters ahead. A page or grimoire awaits.' },
  elite: { icon: '💀', name: 'Elite', desc: 'A powerful foe. Likely a new grimoire.' },
  shrine: { icon: '⛩', name: 'Ancient Altar', desc: 'Recover, pray, and rebind your grimoire.' },
  merchant: { icon: '⚖', name: 'Wandering Peddler', desc: 'Trade HP for pages.' },
  treasure: { icon: '📕', name: 'Forbidden Tome', desc: 'Accept a hex for riches.' },
  boss: { icon: '👑', name: 'Floor Boss', desc: 'The master of this floor.' },
};
const curse = id => G.curses.includes(id);
const wand = () => G.wands[G.active] || G.wands[0];

function newRun(cls, daily) {
  const seed = daily ? hashStr('grimoire-' + todayKey()) : (Math.random() * 2 ** 32) >>> 0;
  const st = starter(cls), fl = CLASSES[cls].flame + camp.wick * 10;
  G = { cls, daily, seed, floor: 0, step: 0, maxFlame: fl, flame: fl, wands: st.wands, active: 0, bag: st.bag, curses: [], embersRun: 0, kills: 0, path: [] };
  G.map = genMap(); camp.runs++; saveCamp();
  showMap();
}
function stepRng(tag) { rng = mulberry(hashStr(G.seed + ':' + G.floor + ':' + G.step + ':' + tag)); }
function genMap() {
  const r = mulberry(hashStr(G.seed + ':floor:' + G.floor)), steps = [], pool = ['fight', 'fight', 'elite', 'shrine', 'merchant', 'treasure'];
  for (let i = 0; i < 5; i++) {
    const n = i === 0 ? 2 : 2 + (r() < 0.5 ? 1 : 0), opts = [];
    if (i === 0) opts.push('fight', r() < .5 ? 'fight' : (G.floor ? 'shrine' : 'treasure'));
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
const SHORT = { critburn: 'Crit on Burn', smallfast: 'Small+Fast', trigger: 'Trigger Bolt', behind: 'Behind+Fwd', blackhole: 'Black Hole', sickle: 'Sickle', bolt: 'Lightning', missile: 'Missile', chain: 'Chain Ltng', burst: 'Bounce Burst', skull: 'Grave Skull', explode: 'Explode', freeze: 'Freeze', wisp: 'Wisp', deathtrig: 'Death Trig', expiry: 'Expiry Trig', lifesteal: 'Lifesteal', knock: 'Knockback' };
const cardChip = (id, extra = '') => id ? `<div class="chip t-${CARDS[id].t}" data-card="${id}" title="${CARDS[id].name}" ${extra}><i>${CARDS[id].icon}</i><u>${SHORT[id] || CARDS[id].name}</u></div>` : '';
function cardRow(id, attrs = '', label) { const c = CARDS[id]; return `<button class="card t-${c.t}" ${attrs}><span class="ic">${c.icon}</span><div><b>${label || c.name}</b><span><em>${TYPE_NAME[c.t]}</em> · ${c.mana ? c.mana + ' mana · ' : ''}${c.desc}</span></div></button>`; }
function wandRow(w, attrs = '', label) { return `<button class="card t-wand" ${attrs}><span class="ic">📖</span><div><b>${label || w.name}</b><span>${w.slots.length} slots · delay ${w.delay}s · recharge ${w.recharge}s · mana ${w.maxMana} (+${w.regen}/s)${w.slots.some(Boolean) ? ' · holds ' + w.slots.filter(Boolean).map(i => CARDS[i].name).join(', ') : ''}</span></div></button>`; }

function showCamp() {
  mode = 'camp'; HUD.classList.add('hidden'); G = null; bg = null;
  const saved = loadRun(), db = camp.dailyBest[todayKey()];
  panel(`<div class="logo"><span>GRIMOIRE</span><b>ASCENT</b></div><p class="small">Bind pages to your grimoire. Climb four floors. Then keep climbing.</p>
  <p class="stat">✦ <b>${camp.embers}</b> mana shards · best: ${camp.best >= 4 ? 'all 4 floors' : 'floor ' + Math.max(1, camp.best)}${camp.bestDepth ? ' · Endless depth ' + camp.bestDepth : ''}</p>
  ${saved ? '<button class="btn hot" id="cont">Continue — ' + (saved.G.floor >= ENDLESS_START ? 'Endless depth ' + (saved.G.floor - ENDLESS_START + 1) : 'Floor ' + (saved.G.floor + 1)) + ', room ' + (saved.G.step + 1) + '</button>' : ''}
  <button class="btn hot" id="go">Ascend as Kai Emberline 🔥</button>
  <button class="btn" id="goW" ${camp.witch ? '' : 'disabled'}>Ascend as Lumi Vesper 🏮${camp.witch ? '' : ' (locked)'}</button>
  <button class="btn sub" id="daily">☀ Daily seeded run — ${todayKey()}${db ? ' · best ' + db : ''}</button>
  ${DEBUG === 'endless' ? '<button class="btn sub" id="dbgE">DEBUG: start at Endless depth 1</button>' : ''}${DEBUG === 'victory' ? '<button class="btn sub" id="dbgV">DEBUG: show victory screen</button>' : ''}
  <h2>The Mage Hall</h2>
  <button class="btn sub" id="unW" ${camp.witch || camp.embers < WITCH_COST ? 'disabled' : ''}>${camp.witch ? '🏮 Lumi Vesper has joined (Three-Leaf grimoire: Frost Needle + Wind Dart)' : '🏮 Recruit Lumi Vesper, Lantern Mage — ' + WITCH_COST + ' shards'}</button>
  <button class="btn sub" id="wick" ${camp.embers < 25 + camp.wick * 15 || camp.wick >= 5 ? 'disabled' : ''}>💪 Spirit Training (+10 starting HP) — ${25 + camp.wick * 15} shards · lv ${camp.wick}/5</button>
  <p class="small">Move: drag / WASD · Your grimoire casts by itself · Dodge: button / Space · Skill: button / E · Swap grimoire: ⇄ / Q</p>`, 'title');
  on('cont', () => { const s = loadRun(); G = s.G; bg = null; showMap(); });
  on('go', () => { clearRun(); newRun('pilgrim', false); });
  on('goW', () => { clearRun(); newRun('witch', false); });
  on('daily', () => { clearRun(); if (!camp.witch) return newRun('pilgrim', true); panel(`<h2>Daily run</h2><button class="btn" id="a">Kai Emberline 🔥</button><button class="btn" id="b">Lumi Vesper 🏮</button>`); on('a', () => newRun('pilgrim', true)); on('b', () => newRun('witch', true)); });
  on('unW', () => { camp.embers -= WITCH_COST; camp.witch = true; saveCamp(); toast('Lumi Vesper joins the Mage Hall!'); showCamp(); });
  on('wick', () => { camp.embers -= 25 + camp.wick * 15; camp.wick++; saveCamp(); showCamp(); });
  on('dbgE', () => { clearRun(); newRun('pilgrim', false); G.floor = ENDLESS_START; G.endless = true; G.step = 0; G.map = genMap(); bg = null; showMap(); });
  on('dbgV', () => { clearRun(); newRun('pilgrim', false); G.floor = 3; victory(); });
}
function floorLabel() { return G.floor >= ENDLESS_START ? 'ENDLESS — depth ' + depthOf() + ' · ' + biome().name : 'Floor ' + (G.floor + 1) + '/4 — ' + biome().name; }
function showMap() {
  mode = 'map'; room = null; HUD.classList.add('hidden'); saveRun();
  if (!bg) buildBG();
  const opts = G.map[G.step];
  const crumbs = G.map.map((s, i) => i < G.step ? (DOORS[G.path[i]] || {}).icon || '·' : i === G.step ? '◉' : s[0] === 'boss' ? '👑' : '·').join(' ');
  panel(`<h2>${floorLabel()}</h2><p class="small">${crumbs}</p>
  <p class="stat">HP ${Math.ceil(G.flame)}/${G.maxFlame}${G.curses.length ? ' · ' + G.curses.map(c => CURSES.find(x => x.id === c).icon).join('') : ''}</p>
  <button class="btn hot" id="edit">📖 Edit grimoire</button>
  <p class="small">Choose a path</p><div class="cards">${opts.map((d, i) => `<button class="card" id="door${i}" data-door="${d}"><span class="ic">${DOORS[d].icon}</span><div><b>${d === 'boss' ? biome().boss : DOORS[d].name}</b><span>${DOORS[d].desc}</span></div></button>`).join('')}</div>
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
function advance() { G.step++; if (G.step >= G.map.length) return nextFloor(); showMap(); }
function nextFloor() { G.floor++; G.step = 0; G.path = []; G.map = genMap(); bg = null; G.flame = Math.min(G.maxFlame, G.flame + G.maxFlame * .3); toast(G.floor >= ENDLESS_START ? 'ENDLESS DEPTH ' + depthOf() + '!' : 'FLOOR ' + (G.floor + 1) + ': ' + biome().name.toUpperCase() + '!', 2200); showMap(); }
function bossDown() {
  if (G.floor === 3) return victory();
  const d = G.floor >= ENDLESS_START ? depthOf() : 0;
  if (d) { camp.bestDepth = Math.max(camp.bestDepth || 0, d); saveCamp(); }
  reward(d ? 'Depth ' + d + ' cleared! Claim a reward' : biome().boss + ' defeated! Claim a reward', .6);
}
function victory() {
  mode = 'win'; HUD.classList.add('hidden');
  const gained = Math.floor(G.embersRun + 60 * (1 + .5 * G.curses.length));
  camp.embers += gained; camp.total += gained; camp.best = Math.max(camp.best, 4); G.embersRun = 0;
  if (G.daily) { const k = todayKey(); camp.dailyBest[k] = Math.max(camp.dailyBest[k] || 0, 4); }
  saveCamp(); saveRun();
  panel(`<div class="sfx big">VICTORY!!</div><h1>ALL FOUR FLOORS CONQUERED</h1><p>The Hollow Sovereign shatters. Your grimoire hums with power you didn't know it had.</p><p class="stat">✦ ${gained} mana shards banked at the Mage Hall.</p>
  <button class="btn hot" id="endless">♾ GO ENDLESS</button><p class="small">Endlessly generated floors, rotating bosses, ever-rising difficulty. Beat your best depth${camp.bestDepth ? ' (' + camp.bestDepth + ')' : ''}.</p>
  <button class="btn sub" id="camp">Return to the Mage Hall</button>`, 'title');
  on('endless', () => { mode = 'map'; G.endless = true; G.step = G.map.length; reward('A gift for the endless climb', .7); });
  on('camp', () => { clearRun(); showCamp(); });
}


function cardChoices(n, cursed) { const out = []; while (out.length < n) { const id = cursed && rng() < .25 ? 'bloodwax' : rng() < (cursed ? .1 : .04) ? pick(RARE_POOL) : pick(CARD_POOL); if (!out.includes(id)) out.push(id); } return out; }
function bagAdd(id) { const i = G.bag.indexOf(null); if (i >= 0) { G.bag[i] = id; return true; } return false; }
function reward(title, wandChance) {
  mode = 'pick'; HUD.classList.add('hidden');
  const opts = cardChoices(3, G.curses.length > 0).map(id => ({ card: id }));
  if (rng() < wandChance) opts[2] = { wand: randomWand(G.step + G.curses.length) };
  const full = !G.bag.includes(null);
  panel(`<h2>${title}</h2><p class="small">Choose one${full ? ' · satchel full: a page will replace slot 8' : ''}</p><div class="cards">${opts.map((o, i) => o.card ? cardRow(o.card, `id="rw${i}" data-reward="card"`) : wandRow(o.wand, `id="rw${i}" data-reward="wand"`, 'New grimoire: ' + o.wand.name)).join('')}</div><button class="btn sub" id="skip">Skip</button>`);
  opts.forEach((o, i) => on('rw' + i, () => {
    if (o.card) { if (!bagAdd(o.card)) G.bag[7] = o.card; toast(CARDS[o.card].icon + ' ' + CARDS[o.card].name + ' added to your satchel'); advance(); }
    else takeWand(o.wand, advance);
  }));
  on('skip', advance);
}
function takeWand(w, then) {
  if (G.wands.length < 2) { G.wands.push(w); toast('📖 ' + w.name + ' — swap with ⇄ / Q'); return then(); }
  panel(`<h2>You can only carry two!</h2><p>Replace which grimoire? Its pages go to your satchel if there is room.</p>${G.wands.map((x, i) => wandRow(x, `id="rep${i}"`, 'Replace ' + x.name)).join('')}<button class="btn sub" id="keep">Keep both, leave the new grimoire</button>`);
  G.wands.forEach((x, i) => on('rep' + i, () => { x.slots.filter(Boolean).forEach(bagAdd); G.wands[i] = w; then(); }));
  on('keep', then);
}
function shrine() {
  mode = 'pick'; const heal = Math.round(G.maxFlame * 0.35);
  panel(`<h2>⛩ Ancient Altar</h2><p>A glowing sigil-stone hums with old magic. You can rebind your grimoire here.</p>
  <button class="btn sub" id="edit">📖 Edit grimoire</button>
  <button class="btn hot" id="rest">Meditate — restore ${heal} HP</button>
  <button class="btn" id="pray">Pray — a random page, lose 10 max HP</button>`);
  on('edit', () => editor(shrine));
  on('rest', () => { G.flame = Math.min(G.maxFlame, G.flame + heal); advance(); });
  on('pray', () => { const id = pick(CARD_POOL); bagAdd(id); toast(CARDS[id].icon + ' ' + CARDS[id].name); G.maxFlame -= 10; G.flame = Math.min(G.flame, G.maxFlame); advance(); });
}
function merchant() {
  mode = 'pick';
  const ch = cardChoices(4, true), prices = ch.map(id => Math.round((CARDS[id].t === 'proj' ? 16 : 12) + rnd(0, 10)));
  let wnd = randomWand(G.step + 1); const wp = 35;
  const draw = () => {
    panel(`<h2>⚖ Wandering Peddler</h2><p>"Pages for a bit of your life force, young mage! Fair trade, heh."</p><p class="stat">HP ${Math.ceil(G.flame)}/${G.maxFlame} · Satchel ${G.bag.filter(Boolean).length}/8</p><div class="cards">${ch.map((id, i) => id ? cardRow(id, `id="buy${i}" ${G.flame <= prices[i] || !G.bag.includes(null) ? 'disabled' : ''}`, CARDS[id].name + ' — ' + prices[i] + ' HP') : '').join('')}
    ${wnd ? wandRow(wnd, `id="buyW" ${G.flame <= wp ? 'disabled' : ''}`, wnd.name + ' — ' + wp + ' HP') : ''}</div><button class="btn sub" id="edit">📖 Edit grimoire</button><button class="btn" id="leave">Leave</button>`);
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
  panel(`<h2>📕 Forbidden Tome</h2><p>A chained book bound in black leather. It whispers your name.</p>
  ${cs ? `<div class="card curse"><span class="ic">${cs.icon}</span><div><b>${cs.name}</b><span>${cs.desc} Shards +50%, and rewards may hold forbidden pages and better grimoires.</span></div></div><button class="btn" id="take">Accept the hex — open it</button>` : ''}
  <button class="btn sub" id="leave">Leave it sealed</button>`);
  on('take', () => { G.curses.push(cs.id); toast(cs.icon + ' ' + cs.name); reward('The tome unlocks!', 0.5); });
  on('leave', advance);
}
function die(abandon) {
  mode = 'dead'; room = null; HUD.classList.add('hidden'); clearRun();
  const gained = Math.floor(G.embersRun), d = G.floor >= ENDLESS_START ? depthOf() : 0;
  camp.embers += gained; camp.total += gained; camp.best = Math.max(camp.best, Math.min(4, G.floor + (d ? 0 : 0)));
  if (d) camp.bestDepth = Math.max(camp.bestDepth || 0, d - 1);
  if (G.daily) { const k = todayKey(); camp.dailyBest[k] = Math.max(camp.dailyBest[k] || 0, G.floor + 1); }
  saveCamp();
  panel(`<div class="sfx big">${abandon ? 'RETREAT!' : 'DEFEATED...'}</div><p>${d ? 'You fell at Endless depth ' + d : 'You fell on floor ' + (G.floor + 1) + ' (' + biome().name + '), room ' + (G.step + 1)} after defeating ${G.kills} foes.</p>
  <p class="stat">✦ ${gained} mana shards carried back to the Mage Hall.</p>${!camp.witch && camp.embers >= WITCH_COST ? '<p class="stat">You can now recruit Lumi Vesper!</p>' : ''}<button class="btn hot" id="camp">Return to the Mage Hall</button>`, 'title');
  on('camp', showCamp);
}
function win() { victory(); }

// ---------- wand editor (drag & drop, touch + mouse) ----------
let edWand = 0, edSel = null, preview = null, edBack = null;
function editor(back) {
  if (back) edBack = back;
  mode = mode === 'room' ? mode : 'edit';
  edWand = Math.min(edWand, G.wands.length - 1);
  const w = G.wands[edWand];
  panel(`<h2>📖 Grimoire</h2>
  ${G.wands.length > 1 ? `<div class="tabs">${G.wands.map((x, i) => `<button class="tab ${i === edWand ? 'on' : ''}" id="wt${i}">${x.name}</button>`).join('')}</div>` : `<p class="small">${w.name}</p>`}
  <p class="small">delay ${w.delay}s · recharge ${w.recharge}s · mana ${w.maxMana} (+${w.regen}/s) · ${w.slots.length} slots</p>
  <div class="slots wand" id="wslots">${w.slots.map((id, i) => `<div class="slot" data-loc="w:${i}">${cardChip(id)}</div>`).join('')}</div>
  <canvas id="pv" width="300" height="120"></canvas>
  <p class="cast" id="castDesc">${describeCast(w)}</p>
  <p class="small">Satchel</p>
  <div class="slots bag" id="bslots">${G.bag.map((id, i) => `<div class="slot" data-loc="b:${i}">${cardChip(id)}</div>`).join('')}</div>
  <p class="info" id="info">Drag pages between your satchel and grimoire (or tap one, then a slot). Read left→right: glyphs power up the next attack; chants cast the next N pages together.</p>
  <div class="legend"><span class="t-proj">Attack</span><span class="t-mod">Glyph</span><span class="t-multi">Chant</span><span class="t-trig">Trigger</span><span class="t-curse">Forbidden</span><span class="t-rare">Rare</span></div>
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
  const pd = Math.min(3, devicePixelRatio || 1); c.width = 300 * pd; c.height = 120 * pd;
  const dummy = { type: 'husk', dummy: true, x: 250, y: 85, hp: 20, max: 20, spd: 0, r: 14, dmg: 0, burn: 0, poison: 0, hit: 0, t: 0, kx: 0, ky: 0, spawnT: 0, frozen: 0 };
  preview = { canvas: c, ctx: c.getContext('2d'), pd, wand: JSON.parse(JSON.stringify(w)), world: { caster: { x: 34, y: 82 }, bounds: { x0: 0, y0: 20, x1: 300, y1: 120 }, foes: [dummy], shots: [], parts: [], fxs: [], patches: [], dmgMul: 1, onDmg: (f, d) => preview.dps.push({ t: preview.t, d }) }, dummy, t: 0, dps: [] };
  preview.wand.idx = 0; preview.wand.cd = 0.3; preview.wand.mana = preview.wand.maxMana;
}
function stopPreview() { preview = null; }
function tickPreview(dt, t) {
  const pv = preview; if (!pv || !document.body.contains(pv.canvas)) { preview = null; return; }
  pv.t += dt; const wd = pv.world, d = pv.dummy, wn = pv.wand;
  d.t += dt; d.y = 74 + Math.sin(pv.t * 1.6) * 28; d.hit = Math.max(0, d.hit - dt); tickStatus(wd, d, dt); d.frozen = Math.max(0, (d.frozen || 0) - dt);
  wn.mana = Math.min(wn.maxMana, wn.mana + wn.regen * dt); wn.cd -= dt;
  if (wn.cd <= 0) { const a = Math.atan2(d.y - d.r * .8 - 70, d.x - 34); tryCast(wd, wn, 34, 70, a, null); }
  updateShots(wd, dt);
  for (const p of wd.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; } wd.parts = wd.parts.filter(p => p.life > 0);
  for (const f of wd.fxs) { f.life -= dt; if (f.type === 'ring') f.r += (f.R - f.r) * Math.min(1, dt * 12); } wd.fxs = wd.fxs.filter(f => f.life > 0);
  pv.dps = pv.dps.filter(e => pv.t - e.t < 3);
  // draw
  const g = pv.ctx; cx = g; g.setTransform(pv.pd, 0, 0, pv.pd, 0, 0);
  g.fillStyle = '#1a1813'; g.fillRect(0, 0, 300, 120); g.fillStyle = '#14120e'; g.fillRect(0, 96, 300, 24); g.strokeStyle = 'rgba(0,0,0,.4)'; for (let x = 0; x < 300; x += 30) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 120); g.stroke(); }
  drawPatches(wd); drawFoe(d, t);
  light(34, 70, 40, '255,150,60', .8); glowDot(34, 70, 4, '#fff0c0', 'rgba(255,150,60,.45)');
  drawShots(wd); drawFx(wd);
  g.fillStyle = '#d6b98c'; g.font = '11px Georgia'; g.textBaseline = 'top';
  g.fillText('Training dummy · DPS ≈ ' + Math.round(pv.dps.reduce((s, e) => s + e.d, 0) / 3) + ' · mana ' + Math.floor(wn.mana) + '/' + wn.maxMana, 6, 4);
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
  const A = arena(); if (!bg) buildBG();
  room = { kind, t: 0, bounds: A, foes: [], shots: [], eshots: [], parts: [], drops: [], fxs: [], patches: [], wisps: [], waves: [], done: false, doneT: 0, caster: P, onHeal: n => { G.flame = Math.min(G.maxFlame, G.flame + n); } };
  for (const w of G.wands) { w.mana = w.maxMana; w.idx = 0; w.cd = 0.4; }
  P.x = (A.x0 + A.x1) / 2; P.y = A.y1 - 60; P.vx = P.vy = 0; P.inv = 1; P.dodgeT = 0; P.skillCd = 0; P.dodgeCd = 0;
  const leg = curse('legion') ? 1.4 : 1;
  if (kind === 'boss') { spawn('warden', (A.x0 + A.x1) / 2, A.y0 + 100, difficulty()); room.boss = true; impact(.12); sfx(W / 2, H * .35, biome().boss.toUpperCase() + '!', '#ffffff', 22); }
  else {
    const n = Math.round((5 + G.step * 1.2 + Math.min(G.floor, 8) * 1.5) * leg);
    room.waves = [Math.ceil(n * 0.55), Math.floor(n * 0.45)];
    room.kindsPool = G.floor === 0 && G.step < 1 ? ['husk', 'husk', 'bat'] : ['husk', 'husk', 'bat', 'cultist'];
    room.elite = kind === 'elite'; nextWave();
    toast(kind === 'elite' ? '💀 ELITE!' : '⚔ BATTLE!', 1200);
  }
}
function nextWave() {
  const A = arena(), tier = difficulty(), n = room.waves.shift();
  for (let i = 0; i < n; i++) { const side = Math.floor(rnd(3)); spawn(pick(room.kindsPool), side === 0 ? rnd(A.x0 + 20, A.x1 - 20) : side === 1 ? A.x0 + 20 : A.x1 - 20, side === 0 ? A.y0 + 20 : rnd(A.y0 + 20, (A.y0 + A.y1) / 2), tier); }
  if (room.elite && room.waves.length === 0) spawn('husk', (A.x0 + A.x1) / 2, A.y0 + 40, tier, true);
}
function spawn(type, x, y, tier, elite) {
  const f = FOES[type], hpm = (curse('iron') ? 1.4 : 1) * tier * (elite ? 7 : 1), dm = 1 + G.floor * .22;
  room.foes.push({ type, x, y, hp: f.hp * hpm, max: f.hp * hpm, spd: f.spd * (elite ? 0.85 : 1) * (1 + Math.min(G.floor, 6) * .05), r: f.r * (elite ? 1.8 : 1), dmg: f.dmg * dm * (curse('wrath') ? 1.35 : 1) * (elite ? 1.6 : 1), elite: !!elite, boss: !!f.boss, ember: f.ember * (elite ? 6 : 1), burn: 0, hit: 0, t: fx() * 9, atk: f.boss ? .8 : rnd(1, 2.5), kx: 0, ky: 0, spawnT: 0.5, phase: 0, frozen: 0, poison: 0 });
}
function killFoe(world, f) {
  f.dead = true; if (world !== room) return; G.kills++;
  if (f.boss) { impact(.2); shake = 14; sfx(f.x, f.y - 60, 'KA-BOOM!!', '#ffe14a', 30); room.eshots.length = 0; for (const o of room.foes) if (!o.dead && o !== f) killFoe(world, o); } else if (f.elite || fx() < .25) sfx(f.x, f.y - f.r * 2, pick(['SLASH!', 'WHAM!', 'POW!', 'KRAK!']), '#ffffff', f.elite ? 22 : 14);
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
  const l = Math.hypot(dx, dy) || 1; P.vx = dx / l * 520; P.vy = dy / l * 520; P.dodgeT = 0.22; P.dodgeCd = 1.3; speedT = .22; speedAng = Math.atan2(dy, dx); sfx(P.x, P.y - 50, 'WHOOSH!', '#bff2ff', 13);
}
function skill() {
  if (mode !== 'room' || P.skillCd > 0 || paused) return;
  P.skillCd = G.cls === 'witch' ? 9 : 7;
  if (G.cls === 'witch') { room.wisps = [0, 1, 2].map(i => ({ a: i * TAU / 3, life: 6 })); sfx(P.x, P.y - 60, 'LANTERN LIGHTS!', '#bff2ff', 16); }
  else {
    room.fxs.push({ type: 'ring', x: P.x, y: P.y, r: 10, R: 140, life: .5, c: '#ff9a3a' }); room.fxs.push({ type: 'circle', x: P.x, y: P.y, r: 70, life: .5, c: '#ff5a1a' }); shake = 8; impact(.07); sfx(P.x, P.y - 60, 'FLARE BURST!', '#ff9a3a', 18);
    for (const f of room.foes) { const d = Math.hypot(f.x - P.x, f.y - P.y) || 1; if (d < 140) hurtFoe(room, f, 30, (f.x - P.x) / d * 260, (f.y - P.y) / d * 260); }
  }
}
function swapWand() {
  if (!G || G.wands.length < 2 || (mode !== 'room' && mode !== 'map')) return;
  G.active = (G.active + 1) % G.wands.length; wand().cd = Math.max(wand().cd, .25); toast('📖 ' + wand().name, 900);
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
  P.castT = Math.max(0, (P.castT || 0) - dt);
  if (t && w.cd <= 0 && mode === 'room' && (P.castT = .18, room.fxs.push({ type: 'circle', x: P.x, y: P.y, r: 20, life: .3, c: w.slots.includes('inverted') ? '#e8e4f0' : `hsl(${w.hue},80%,65%)` }), true)) tryCast(room, w, P.x + Math.cos(P.face) * 14, P.y - 14, Math.atan2(t.y - t.r * .8 - (P.y - 14), t.x - P.x), payFlame);
  for (const ws of room.wisps) { ws.life -= dt; ws.a += dt * 3.2; ws.x = P.x + Math.cos(ws.a) * 46; ws.y = P.y - 8 + Math.sin(ws.a) * 46; for (const f of room.foes) if (Math.hypot(f.x - ws.x, f.y - ws.y) < f.r + 8 && (f.wt || 0) <= 0) { hurtFoe(room, f, 10); f.burn = 2; f.wt = 0.3; } }
  room.wisps = room.wisps.filter(x => x.life > 0);
  updateShots(room, dt);
  for (const f of room.foes) {
    f.t += dt; f.hit = Math.max(0, f.hit - dt); f.wt = (f.wt || 0) - dt; f.frozen = Math.max(0, f.frozen - dt);
    if (f.spawnT > 0) { f.spawnT -= dt; continue; }
    tickStatus(room, f, dt);
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
  if (room.done) { room.doneT += dt; if (room.doneT > 1.2 && room.drops.length === 0) { const k = room.kind; room = null; HUD.classList.add('hidden'); if (k === 'boss') bossDown(); else reward(k === 'elite' ? 'Elite slain — claim a reward' : 'Claim a reward', k === 'elite' ? .6 : .25); } }
}
function bossAI(f, dt) {
  const B = biome(), wr = (curse('wrath') ? 1.35 : 1) * (1 + G.floor * .2), A = arena();
  if (f.hp / f.max < .5 && f.phase === 0) { f.phase = 1; impact(.15); sfx(f.x, f.y - 80, 'RAGE!!', '#ff2a4a', 26); shake = 10; }
  const shoot = (a, sp, d = 9) => room.eshots.push({ x: f.x, y: f.y - 36, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 4, dmg: d * wr, col: B.lamp });
  f.atk -= dt; f.spin = (f.spin || 0) + dt * (f.phase ? 2.6 : 1.8);
  const pat = B.pattern;
  if (pat === 'spiral' || (pat === 'chaos' && f.phase)) { f.st = (f.st || 0) - dt; if (f.st <= 0) { f.st = f.phase ? .09 : .14; shoot(f.spin * 2.2, 130, 7); if (f.phase) shoot(f.spin * 2.2 + Math.PI, 130, 7); } }
  if (f.atk <= 0) {
    f.atk = f.phase ? 2 : 2.8;
    room.fxs.push({ type: 'circle', x: f.x, y: f.y, r: 50, life: .5, c: B.lamp });
    if (pat === 'radial' || pat === 'chaos') { const n = f.phase ? 18 : 12; for (let i = 0; i < n; i++) shoot(i / n * TAU + f.t, 120); }
    if (pat === 'aimed' || pat === 'chaos') { const a0 = Math.atan2(P.y - 14 - (f.y - 36), P.x - f.x); for (let i = -2; i <= 2; i++) shoot(a0 + i * .18, 190, 10); if (f.phase) setTimeout(() => { if (room && !f.dead) for (let i = -3; i <= 3; i++) shoot(a0 + i * .14, 160, 8); }, 400); }
    if (pat === 'spiral') { for (let i = 0; i < 6; i++) shoot(i / 6 * TAU + f.spin, 90, 8); }
    if (room.foes.length < (pat === 'chaos' ? 7 : 5)) spawn(f.phase ? 'bat' : (pat === 'aimed' ? 'cultist' : 'husk'), rnd(A.x0 + 30, A.x1 - 30), A.y0 + 30, difficulty() * .8);
  }
}
// ---------- anime FX helpers ----------
let impactT = 0, speedT = 0, speedAng = 0;
function impact(d) { impactT = Math.max(impactT, d); }
function sfx(x, y, txt, col, size = 16) { return; const w = room || (preview && preview.world); if (!w) return; w.fxs.push({ type: 'sfx', x, y, txt, col, size, life: .7, rot: (fx() - .5) * .4 }); }
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
  panel(`<h2>Paused</h2><button class="btn" id="res">Resume</button><button class="btn sub" id="ab">Abandon run</button><p class="small">Grimoires can be edited between rooms and at altars.</p>`);
  on('res', togglePause); on('ab', () => { paused = false; closeUI(); die(true); });
}

// ---------- rendering ----------
function drawPatches(wd) {
  for (const p of wd.patches) { const a = Math.min(1, p.life) * .75; if (p.kind === 'acid') { cx.fillStyle = `rgba(110,220,60,${a * .7})`; cx.beginPath(); cx.ellipse(p.x, p.y, 9, 4, 0, 0, TAU); cx.fill(); cx.fillStyle = `rgba(200,255,140,${a})`; cx.fillRect(Math.round(p.x - 2), Math.round(p.y - 1), 2, 2); } else { cx.fillStyle = `rgba(255,90,20,${a * .6})`; cx.beginPath(); cx.ellipse(p.x, p.y, 7, 3.5, 0, 0, TAU); cx.fill(); cx.fillStyle = `rgba(255,200,90,${a})`; cx.beginPath(); cx.moveTo(p.x - 2, p.y); cx.lineTo(p.x, p.y - 5 * a); cx.lineTo(p.x + 2, p.y); cx.fill(); } }
}
function drawShots(wd) {
  const lights = wd.shots.length < 70;
  for (const b of wd.shots) {
    const a = Math.atan2(b.vy, b.vx), x = b.x, y = b.y, r = b.r;
    if (lights && b.novaR === undefined) light(x, y, 14 + r * 3, b.lt || '255,200,120', .55);
    cx.save(); cx.translate(x, y); cx.lineJoin = 'round';
    if (b.kind !== 'nova' && b.kind !== 'meteor') { cx.save(); cx.rotate(a); cx.strokeStyle = b.col || '#ffd070'; cx.globalAlpha = .45; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-r * 2 - 10, -r * .6); cx.lineTo(-r, -r * .3); cx.moveTo(-r * 2 - 14, r * .6); cx.lineTo(-r, r * .3); cx.stroke(); cx.restore(); }
    switch (b.kind) {
      case 'fireball': cx.rotate(a); cx.fillStyle = '#c8301a'; cx.beginPath(); cx.moveTo(-r * 3.2, 0); cx.quadraticCurveTo(-r, -r * 1.2, 0, -r); cx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); cx.quadraticCurveTo(-r, r * 1.2, -r * 3.2, 0); cx.fill(); glowDot(0, 0, r * .75, '#ffe08a', '#ff7a1a'); break;
      case 'ice': cx.rotate(a); cx.fillStyle = '#7ac8ff'; cx.beginPath(); cx.moveTo(r * 2.4, 0); cx.lineTo(-r, -r); cx.lineTo(-r * 1.6, 0); cx.lineTo(-r, r); cx.closePath(); cx.fill(); cx.fillStyle = '#eaf8ff'; cx.beginPath(); cx.moveTo(r * 2.2, 0); cx.lineTo(-r * .6, -r * .4); cx.lineTo(-r * .2, 0); cx.fill(); break;
      case 'chain': case 'bolt': { cx.rotate(a); const L = b.kind === 'bolt' ? 26 : 12; cx.strokeStyle = '#7aa0ff'; cx.lineWidth = 3.5; cx.beginPath(); cx.moveTo(-L, 0); cx.lineTo(-L * .6, -3); cx.lineTo(-L * .3, 2); cx.lineTo(0, -2); cx.lineTo(4, 0); cx.stroke(); cx.strokeStyle = '#ffffff'; cx.lineWidth = 1.5; cx.stroke(); break; }
      case 'burst': cx.strokeStyle = '#d4ff8a'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, r + 1, 0, TAU); cx.stroke(); glowDot(0, 0, r * .5, '#ffffff', '#8ad04a'); break;
      case 'skull': cx.rotate(Math.sin(b.age * 8) * .3); cx.fillStyle = '#e9e2c8'; cx.beginPath(); cx.arc(0, -1, r, 0, TAU); cx.fill(); cx.fillRect(-r * .6, r * .4, r * 1.2, r * .6); cx.fillStyle = '#1a120a'; cx.fillRect(-r * .55, -r * .4, r * .4, r * .45); cx.fillRect(r * .15, -r * .4, r * .4, r * .45); cx.fillStyle = '#7dff7a'; cx.fillRect(-r * .45, -r * .3, 1.5, 1.5); cx.fillRect(r * .25, -r * .3, 1.5, 1.5); break;
      case 'missile': cx.rotate(a); cx.fillStyle = '#7a3ab0'; cx.beginPath(); cx.moveTo(-r * 3, 0); cx.lineTo(0, -r * .7); cx.lineTo(0, r * .7); cx.fill(); cx.fillStyle = '#d08aff'; cx.beginPath(); cx.moveTo(r * 1.6, 0); cx.lineTo(0, -r); cx.lineTo(-r, 0); cx.lineTo(0, r); cx.closePath(); cx.fill(); cx.fillStyle = '#fff'; cx.fillRect(-1, -1, 2, 2); break;
      case 'acid': cx.fillStyle = '#3a8a1a'; cx.beginPath(); cx.arc(0, 0, r + 1, 0, TAU); cx.fill(); cx.fillStyle = '#8aff4a'; cx.beginPath(); cx.arc(0, 0, r - .5, 0, TAU); cx.fill(); cx.fillStyle = '#e0ffc0'; cx.fillRect(-r * .5, -r * .5, 2, 2); cx.fillStyle = '#8aff4a'; cx.fillRect(-1, r, 2, 3 + Math.sin(b.age * 10) * 1.5); break;
      case 'blackhole': cx.fillStyle = '#000'; cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill(); cx.lineWidth = 2; for (let i = 0; i < 3; i++) { cx.strokeStyle = ['#7a3aff', '#b08aff', '#4a1a9a'][i]; cx.beginPath(); cx.arc(0, 0, r + 3 + i * 3, b.spin * (1 + i * .3) + i, b.spin * (1 + i * .3) + i + 2.2); cx.stroke(); } break;
      case 'meteor': cx.restore(); cx.save(); cx.strokeStyle = 'rgba(255,90,30,.6)'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(b.tx, b.ty, 18, 7, 0, 0, TAU); cx.stroke(); cx.translate(x, y); cx.rotate(a); cx.fillStyle = '#ff5a1a'; cx.beginPath(); cx.moveTo(-r * 4, 0); cx.lineTo(0, -r); cx.lineTo(0, r); cx.fill(); cx.fillStyle = '#ffd070'; cx.beginPath(); cx.moveTo(-r * 2.4, 0); cx.lineTo(0, -r * .5); cx.lineTo(0, r * .5); cx.fill(); cx.fillStyle = '#4a3020'; cx.beginPath(); cx.arc(0, 0, r * .9, 0, TAU); cx.fill(); cx.fillStyle = '#ff9a3a'; cx.fillRect(-2, -2, 3, 3); break;
      case 'saw': cx.rotate(b.spin); cx.fillStyle = '#8a8e94'; cx.beginPath(); for (let i = 0; i < 16; i++) { const rr = i % 2 ? r : r * 1.45, aa = i * TAU / 16; cx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } cx.closePath(); cx.fill(); cx.fillStyle = '#d8dce0'; cx.beginPath(); cx.arc(0, 0, r * .55, 0, TAU); cx.fill(); cx.fillStyle = '#2a2a2a'; cx.beginPath(); cx.arc(0, 0, r * .2, 0, TAU); cx.fill(); break;
      case 'lance': cx.rotate(a); cx.strokeStyle = '#8a6a3a'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-20, 0); cx.lineTo(0, 0); cx.stroke(); cx.fillStyle = '#f4e6b0'; cx.beginPath(); cx.moveTo(8, 0); cx.lineTo(-1, -3); cx.lineTo(-1, 3); cx.fill(); break;
      case 'bubble': cx.strokeStyle = 'rgba(190,240,255,.9)'; cx.lineWidth = 1.5; cx.fillStyle = 'rgba(160,220,255,.18)'; cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill(); cx.stroke(); cx.fillStyle = '#ffffff'; cx.fillRect(-r * .5, -r * .55, 2, 2); break;
      case 'wisp': glowDot(0, 0, 3.5, '#ffffff', 'rgba(160,230,255,.55)'); cx.fillStyle = 'rgba(200,240,255,.6)'; cx.beginPath(); cx.moveTo(-3, 2); cx.lineTo(0, 9 + Math.sin(b.age * 12) * 2); cx.lineTo(3, 2); cx.fill(); break;
      case 'nova': cx.lineWidth = 4; cx.strokeStyle = `rgba(255,150,50,${Math.min(1, b.life * 4)})`; cx.beginPath(); cx.arc(0, 0, b.novaR, 0, TAU); cx.stroke(); cx.lineWidth = 1.5; cx.strokeStyle = `rgba(255,240,180,${Math.min(1, b.life * 4)})`; cx.stroke(); break;
      case 'sickle': cx.rotate(b.spin); cx.fillStyle = '#d8d0b8'; cx.beginPath(); cx.arc(0, 0, r * 1.5, 0, Math.PI * 1.3); cx.arc(r * .4, -r * .2, r * 1.1, Math.PI * 1.3, 0, true); cx.closePath(); cx.fill(); cx.fillStyle = '#6a4a2a'; cx.fillRect(-1.5, -1.5, 3, 3); break;
      case 'mine': cx.fillStyle = '#2a2420'; cx.beginPath(); cx.arc(0, 0, r + 1, 0, TAU); cx.fill(); cx.strokeStyle = '#6a5a4a'; cx.lineWidth = 1.5; cx.stroke(); for (let i = 0; i < 4; i++) { const aa = i * TAU / 4; cx.fillStyle = '#6a5a4a'; cx.fillRect(Math.cos(aa) * (r + 2) - 1, Math.sin(aa) * (r + 2) - 1, 2, 2); } cx.fillStyle = b.age > .4 && Math.sin(b.age * 14) > 0 ? '#ff3a2a' : '#5a1a14'; cx.fillRect(-1.5, -1.5, 3, 3); break;
      default: glowDot(0, 0, Math.max(1.5, r * .8), '#fff6d0', b.col); // spark
    }
    if (b.el && b.kind !== 'nova') { // elemental accent: crisp, grounded
      const sp = b.spin + b.age * 9;
      switch (b.el) {
        case 'Wind': cx.strokeStyle = 'rgba(200,255,225,.7)'; cx.lineWidth = 1; for (let k = 0; k < 2; k++) { cx.beginPath(); cx.arc(0, 0, r + 4, sp + k * Math.PI, sp + k * Math.PI + 1.3); cx.stroke(); } break;
        case 'Fire': if (fx() < .35) wd.parts.push({ x: x + (fx() - .5) * r, y: y + (fx() - .5) * r, vx: (fx() - .5) * 30, vy: -30 - fx() * 30, life: .4, c: fx() < .5 ? '#ffb347' : '#ff5a1a', s: 1.6, ember: true }); break;
        case 'Water': cx.strokeStyle = 'rgba(160,220,255,.55)'; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(0, 0, r + 3 + Math.sin(b.age * 14), (r + 3) * .6, sp * .2, 0, TAU); cx.stroke(); break;
        case 'Lightning': if (fx() < .5) { cx.strokeStyle = '#fff8c0'; cx.lineWidth = 1; cx.beginPath(); const q = fx() * TAU; cx.moveTo(Math.cos(q) * r, Math.sin(q) * r); cx.lineTo(Math.cos(q + .3) * (r + 5), Math.sin(q + .3) * (r + 5)); cx.lineTo(Math.cos(q - .1) * (r + 8), Math.sin(q - .1) * (r + 8)); cx.stroke(); } break;
        case 'Shadow': if (fx() < .4) wd.parts.push({ x: x + (fx() - .5) * r * 2, y: y + (fx() - .5) * r * 2, vx: (fx() - .5) * 10, vy: -8, life: .45, c: 'rgba(40,10,60,.75)', s: 3 }); break;
        case 'Light': { cx.fillStyle = 'rgba(255,250,220,.85)'; const L = r + 4 + Math.sin(b.age * 20) * 1.5; cx.beginPath(); cx.moveTo(0, -L); cx.lineTo(.8, -.8); cx.lineTo(L, 0); cx.lineTo(.8, .8); cx.lineTo(0, L); cx.lineTo(-.8, .8); cx.lineTo(-L, 0); cx.lineTo(-.8, -.8); cx.closePath(); cx.fill(); break; }
        case 'Earth': cx.fillStyle = '#6a4a2a'; for (let k = 0; k < 3; k++) { const q = sp + k * 2.1; cx.fillRect(Math.cos(q) * (r + 4) - 1, Math.sin(q) * (r + 4) - 1, 2.5, 2.5); } break;
        case 'Poison': if (fx() < .25) wd.parts.push({ x, y, vx: (fx() - .5) * 12, vy: 10, life: .35, c: '#6ad02a', s: 2 }); break;
      }
    }
    if (b.trig) { cx.strokeStyle = '#4fd46a'; cx.lineWidth = 1.5; cx.setLineDash([2, 2]); cx.beginPath(); cx.arc(0, 0, r + 4, 0, TAU); cx.stroke(); cx.setLineDash([]); }
    if (b.homing && b.kind !== 'missile') { cx.strokeStyle = '#4a9aff'; cx.lineWidth = 1; cx.beginPath(); cx.arc(0, 0, r + 6, b.spin, b.spin + 2); cx.stroke(); }
    if (b.poison && b.kind !== 'acid') { cx.fillStyle = '#8aff4a'; cx.fillRect(-r - 2, -1, 2, 2); }
    cx.restore();
  }
}
function drawFx(wd) {
  for (const f of wd.fxs) {
    cx.globalAlpha = Math.min(1, f.life * 3);
    if (f.type === 'ring') { cx.strokeStyle = f.c; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(f.x, f.y - 10, f.r, 0, TAU); cx.stroke(); }
    if (f.type === 'boom') { f.r += (f.R - f.r) * .35; cx.fillStyle = 'rgba(255,120,30,.25)'; cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, TAU); cx.fill(); cx.strokeStyle = '#ffd070'; cx.lineWidth = 3; cx.stroke(); cx.fillStyle = '#fff0c0'; cx.beginPath(); cx.arc(f.x, f.y, f.r * .3 * f.life * 3, 0, TAU); cx.fill(); }
    if (f.type === 'bolt') { cx.strokeStyle = '#7aa0ff'; cx.lineWidth = 3.5; cx.beginPath(); cx.moveTo(f.x, f.y - 12); const pts = []; for (let i = 1; i < 6; i++) { const k = i / 6; pts.push([f.x + (f.x2 - f.x) * k + (fx() - .5) * 14, f.y - 12 + (f.y2 - f.y) * k + (fx() - .5) * 14]); } pts.forEach(q => cx.lineTo(q[0], q[1])); cx.lineTo(f.x2, f.y2 - 12); cx.stroke(); cx.strokeStyle = '#ffffff'; cx.lineWidth = 1.3; cx.stroke(); }
    if (f.type === 'circle') { drawSpellCircle(f.x, f.y, f.r * (1.3 - f.life), f.c, f.life * 4, Math.min(1, f.life * 4)); }
    if (f.type === 'sfx') { const k = 1 + Math.max(0, f.life - .55) * 4; cx.save(); cx.translate(f.x, f.y - (0.7 - f.life) * 16); cx.rotate(f.rot); cx.scale(k, k); cx.font = `bold ${f.size}px Impact, "Arial Black", sans-serif`; cx.textAlign = 'center'; cx.lineJoin = 'round'; cx.lineWidth = f.size / 4; cx.strokeStyle = INK; cx.strokeText(f.txt, 0, 0); cx.fillStyle = f.col; cx.fillText(f.txt, 0, 0); cx.restore(); }
    if (f.type === 'text') { cx.fillStyle = '#ffe08a'; cx.font = 'bold 10px Georgia'; cx.textAlign = 'center'; cx.fillText(f.txt, f.x, f.y - (1 - f.life) * 20); cx.textAlign = 'left'; f.life -= 0; }
  }
  cx.globalAlpha = 1;
  for (const p of wd.parts) { cx.globalAlpha = Math.min(1, p.life * 2.5); cx.fillStyle = p.c; if (p.ember) { const z = p.s; cx.beginPath(); cx.moveTo(p.x, p.y - z); cx.lineTo(p.x + z * .6, p.y); cx.lineTo(p.x, p.y + z); cx.lineTo(p.x - z * .6, p.y); cx.fill(); } else cx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
  cx.globalAlpha = 1;
}
const ambient = [];
function render(t) {
  cx = mainCx;
  cx.setTransform(DPR * Z, 0, 0, DPR * Z, 0, 0);
  if (!bg) buildBG();
  let sx = 0, sy = 0; if (shake > 0) { sx = (fx() - .5) * shake; sy = (fx() - .5) * shake; shake = Math.max(0, shake - .5); }
  cx.save(); cx.translate(sx, sy);
  cx.restore(); drawBG(); cx.save(); cx.translate(sx, sy);
  for (const [x, y] of braziers()) drawBrazier(x, y, t);
  if (room) {
    drawPatches(room);
    for (const e of room.drops) { const bob = Math.sin(e.t * 8 + e.x) * 1.5; cx.fillStyle = 'rgba(255,120,40,.35)'; cx.beginPath(); cx.moveTo(e.x, e.y - 8 + bob); cx.lineTo(e.x + 5.5, e.y + bob); cx.lineTo(e.x, e.y + 8 + bob); cx.lineTo(e.x - 5.5, e.y + bob); cx.fill(); cx.fillStyle = '#ff9a3a'; cx.beginPath(); cx.moveTo(e.x, e.y - 5 + bob); cx.lineTo(e.x + 3.5, e.y + bob); cx.lineTo(e.x, e.y + 5 + bob); cx.lineTo(e.x - 3.5, e.y + bob); cx.fill(); cx.fillStyle = '#fff0c0'; cx.fillRect(e.x - 1, e.y - 2 + bob, 2, 2); }
    const ents = room.foes.map(f => ({ y: f.y, d: () => { drawFoe(f, t); } }));
    ents.push({ y: P.y, d: () => drawPilgrim(P.x, P.y, t, G.cls, P.inv > 0 && Math.floor(t * 20) % 2 ? .4 : 1) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
    drawShots(room);
    for (const b of room.eshots) { light(b.x, b.y, 20, biome().lampRgb, .45); cx.fillStyle = '#1a0a0a'; cx.beginPath(); cx.arc(b.x, b.y, 6, 0, TAU); cx.fill(); glowDot(b.x, b.y, 3, '#fff0e0', b.col || '#e02a1a'); }
    for (const w of room.wisps) { light(w.x, w.y, 26, '150,220,255', .6); glowDot(w.x, w.y, 4, '#ffffff', 'rgba(140,220,255,.6)'); }
    drawFx(room);
  } else {
    if (ambient.length < 60) ambient.push({ x: fx() * W, y: H + 10, vy: -20 - fx() * 40, vx: (fx() - .5) * 15, s: 1 + fx() * 2 });
    drawPilgrim(W / 2, H * .82, t, G ? G.cls : 'pilgrim');
  }
  for (const a of ambient) { a.x += a.vx / 60 + Math.sin(t + a.y * .02) * .3; a.y += a.vy / 60; cx.fillStyle = `rgba(${biome().lampRgb},${.45 + Math.sin(t * 5 + a.x) * .3})`; cx.fillRect(a.x, a.y, a.s, a.s); }
  for (let i = ambient.length - 1; i >= 0; i--) if (ambient[i].y < -10) ambient.splice(i, 1);
  cx.restore();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); // screen space
  if (speedT > 0 && room) { speedT -= 1 / 60; cx.strokeStyle = 'rgba(220,230,255,.18)'; cx.lineWidth = 1; cx.beginPath(); const c = Math.cos(speedAng), sn = Math.sin(speedAng); for (let i = 0; i < 14; i++) { const o = (fx() - .5) * 160, px = (P.x - sn * o) * Z, py = (P.y - 20 + c * o) * Z, L = 30 + fx() * 60; cx.moveTo(px - c * 10, py - sn * 10); cx.lineTo(px - c * (10 + L), py - sn * (10 + L)); } cx.stroke(); }
  if (impactT > 0) { impactT -= 1 / 60; cx.fillStyle = `rgba(255,236,200,${Math.min(.22, impactT * 1.6)})`; cx.fillRect(0, 0, SW, SH); }
  cx.save(); cx.setTransform(DPR * Z, 0, 0, DPR * Z, 0, 0); cx.fillStyle = biome().pal.grade; cx.fillRect(0, 0, W, H); cx.restore();
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
  bar(x, y, w, 16, G.flame / G.maxFlame, '#a8321e', '#ffb347', '❤ ' + Math.ceil(G.flame) + '/' + G.maxFlame);
  bar(x, y + 20, w * .7, 9, wn.mana / wn.maxMana, '#2a3a8a', '#7ab8ff');
  cx.font = '12px Georgia'; cx.fillStyle = '#d6b98c'; cx.textBaseline = 'middle';
  cx.fillText('📖 ' + wn.name + (G.wands.length > 1 ? ' (' + (G.active + 1) + '/2)' : '') + '  ·  ' + (G.floor >= ENDLESS_START ? 'Depth ' + depthOf() : 'Floor ' + (G.floor + 1) + '/4') + '  ·  Room ' + (G.step + 1) + '/' + G.map.length + '  ·  ✦ ' + Math.floor(G.embersRun) + (G.curses.length ? '  ' + G.curses.map(c => CURSES.find(q => q.id === c).icon).join('') : ''), x, y + 42);
  document.getElementById('dodgeBtn').classList.toggle('cd', P.dodgeCd > 0); document.getElementById('skillBtn').classList.toggle('cd', P.skillCd > 0);
  document.getElementById('swapBtn').classList.toggle('hidden', G.wands.length < 2);
}

// ---------- loop ----------
let dprCap = 3, slowFrames = 0, perfFrames = 0;
function resize() { DPR = Math.min(dprCap, devicePixelRatio || 1); lightCache.clear(); SW = innerWidth; SH = innerHeight; Z = clamp(Math.min(SW, SH) / 500, 1, 1.7); W = SW / Z; H = SH / Z; cv.width = SW * DPR; cv.height = SH * DPR; bg = null; }
addEventListener('resize', resize); resize();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // adaptive resolution: render at full devicePixelRatio, but step down if a slow phone can't hold ~60fps in combat
  if (mode === 'room' && !document.hidden) { perfFrames++; if (dt > 0.022) slowFrames++; if (perfFrames >= 120) { if (slowFrames > 60 && dprCap > 1.5 && Math.min(dprCap, devicePixelRatio || 1) > 1.5) { dprCap = Math.max(1.5, Math.min(dprCap, devicePixelRatio || 1) - 0.5); resize(); } perfFrames = slowFrames = 0; } }
  try { update(dt); render(now / 1000); if (preview) tickPreview(dt, now / 1000); } catch (e) { cx = mainCx; console.error(e); }
  requestAnimationFrame(frame);
}
showCamp();
requestAnimationFrame(frame);
window.__ashen = { get G() { return G; }, get mode() { return mode; }, get room() { return room; }, get preview() { return preview; }, P, input, buildCast, describeCast, CARDS, editor, showMap, victory, bossDown, jump(fl, st) { G.floor = fl; G.step = 0; G.path = []; G.map = genMap(); G.step = st == null ? 0 : Math.min(st, G.map.length - 1); bg = null; showMap(); }, get FLOORS() { return FLOORS; } };
window.__ready = true;
