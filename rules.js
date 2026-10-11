// 大鎌戦役 ルールエンジン（純粋関数・Firebase非依存）。
// applyIntent({pub, priv, uid, intent}) → { pub, priv } | { error }
//   pub  = 全員に公開されるゲーム状態 / priv = 行動者本人だけの秘密状態（コイン・手札・目的・個人山札）
// 公式ルールブックの文章で確認できた事項は公式どおり。印刷値が未確認の数値は gamedata.js の [仮] を使う。
import { MAP, ALL_HEX_IDS, isHome, homeNodeId, HOME_ORDER } from './map.js';
import {
  RES, TERRAIN_RES, BOTTOM_OF, BOTTOM_RES, STRUCT_OF_TOP, STRUCT_NAME, RES_NAME, BOTTOM_NAME, matColumns, MAT_NUMBER,
  FACTION_RULES, CUBE_SLOTS, PRODUCE_COST, ENLIST_BONUS, ROB, SCORE_TIERS, ENCOUNTERS, OBJECTIVES, FACTORY_CARDS,
  STRUCTURE_TILES, TERRAIN_NAME,
} from './gamedata.js';
import { BASE_MATS, BASE_FACTIONS, buildCombatDeck } from './data.js';
import { sha256 } from './sha256.js';
import { shuffle, cryptoRng } from './draft.js';
import { DIAL_MAX } from './combat.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const emptyRes = () => ({ metal: 0, oil: 0, food: 0, wood: 0 });
const cardValue = (id) => Number(String(id).split('_')[1]);
export const CARD_BY_ID = Object.fromEntries(ENCOUNTERS.map((c) => [c.id, c]));
export const FACTORY_BY_ID = Object.fromEntries(FACTORY_CARDS.map((c) => [c.id, c]));

// ---------------------------------------------------------------- 新規ゲーム
export function newGame({ players, rng = cryptoRng }) {
  const n = players.length;
  const bySeat = [...players].sort((a, b) => FACTION_RULES[a.faction].seat - FACTION_RULES[b.faction].seat);
  const first = [...players].sort((a, b) => MAT_NUMBER[a.mat] - MAT_NUMBER[b.mat])[0];
  const k = bySeat.findIndex((p) => p.uid === first.uid);
  const order = [...bySeat.slice(k), ...bySeat.slice(0, k)].map((p) => p.uid);

  const pub = {
    v: 1, ruleset: 'provisional-0.1', turnNo: 1, turnUid: order[0], order,
    turn: { section: null, phase: 'section' },
    players: {}, units: {}, hexes: {}, deck: {}, tile: null, ended: false, endedBy: null, finalCoins: {}, result: null, log: [],
  };
  for (const id of ALL_HEX_IDS) pub.hexes[id] = { res: emptyRes(), struct: null, enc: MAP.hexes[id].enc };

  const piles = shuffle(buildCombatDeck().map((c) => c.id), rng);
  const base = Math.floor(piles.length / n), extra = piles.length - base * n;
  const objIds = shuffle(OBJECTIVES.map((o) => o.id), rng);
  const privs = {};
  let cut = 0;
  players.forEach((p, i) => {
    const mat = BASE_MATS[p.mat];
    pub.players[p.uid] = {
      name: p.name || p.uid.slice(0, 4), faction: p.faction, mat: p.mat,
      power: BASE_FACTIONS[p.faction].power, pop: mat.popularity, hand: 0, stars: [], combatWins: 0, objStars: 0,
      cubes: { ...CUBE_SLOTS }, bottom: { upgrade: 0, deploy: 0, build: 0, enlist: 0 }, mechs: 0,
      structures: { monument: null, mill: null, mine: null, armory: null },
      recruits: { upgrade: null, deploy: null, build: null, enlist: null },
      bonusUsed: { power: false, coins: false, pop: false, cards: false },
      produced: 0, last: null, factoryCard: null, pendingDraw: 0,
    };
    const hn = MAP.homes[p.faction].neighbors;
    pub.units[p.uid] = { char: homeNodeId(p.faction), mechs: [null, null, null, null], workers: [hn[0], hn[1]] };
    const size = base + (i < extra ? 1 : 0);
    const deck = piles.slice(cut, cut + size); cut += size;
    const hand = deck.splice(0, BASE_FACTIONS[p.faction].combatCards);
    privs[p.uid] = { coins: mat.coins, hand, deck, discard: [], objectives: objIds.splice(0, mat.objectives), pending: null };
    pub.players[p.uid].hand = hand.length;
  });
  pub.deck.encounter = shuffle(ENCOUNTERS.map((e) => e.id), rng);
  pub.deck.factory = shuffle(FACTORY_CARDS.map((f) => f.id), rng).slice(0, n + 1);
  pub.tile = shuffle(STRUCTURE_TILES.map((t) => t.id), rng)[0];
  say({ pub, uid: order[0] }, `ゲーム開始。先手は ${pub.players[order[0]].name}`);
  return { pub, privs };
}

// ---------------------------------------------------------------- 参照ヘルパー
export function unitsAt(pub, hex) {
  const out = {};
  for (const [u, U] of Object.entries(pub.units)) {
    const e = { char: U.char === hex, mechs: [], workers: [] };
    U.mechs.forEach((h, i) => { if (h === hex) e.mechs.push(i); });
    U.workers.forEach((h, i) => { if (h === hex) e.workers.push(i); });
    if (e.char || e.mechs.length || e.workers.length) out[u] = e;
  }
  return out;
}
export function controller(pub, hex) {
  const u = Object.keys(unitsAt(pub, hex));
  if (u.length === 1) return u[0];
  if (u.length > 1) return null;
  return pub.hexes[hex]?.struct?.uid ?? null;
}
export const controlledHexes = (pub, uid) => ALL_HEX_IDS.filter((h) => controller(pub, h) === uid);
const myWorkersAt = (pub, uid, hex) => pub.units[uid].workers.filter((h) => h === hex).length;
export function has(pub, uid, ability) {
  const P = pub.players[uid], R = FACTION_RULES[P.faction];
  if (R.ability === ability) return true;
  const i = R.mechs.indexOf(ability);
  return i >= 0 && P.mechs > i;
}
const up = (P, k) => CUBE_SLOTS[k] - P.cubes[k];
const sectionInfo = (P, i) => {
  if (i === 4) return { top: 'factory', bottom: 'fmove', factory: true };
  const top = matColumns(P.mat)[i];
  return { top, bottom: BOTTOM_OF[top] };
};
export const currentSection = (pub) => {
  const t = pub.turn;
  return t.section == null ? null : sectionInfo(pub.players[pub.turnUid], t.section);
};
export function say(c, text) {
  c.pub.log.push({ n: c.pub.turnNo, uid: c.uid, t: text });
  if (c.pub.log.length > 150) c.pub.log.splice(0, c.pub.log.length - 150);
}
const pname = (c, uid = c.uid) => c.pub.players[uid].name;

// ---------------------------------------------------------------- 移動
function linked(pub, uid, a, b) {
  const hasHome = (x) => isHome(x);
  if (hasHome(a)) return MAP.homes[a.slice(5)].neighbors.includes(b);
  if (hasHome(b)) return false; // 盤上から本拠地へは移動不可
  const A = MAP.hexes[a], B = MAP.hexes[b];
  if (!A || !B || a === b) return false;
  if (A.neighbors.includes(b)) return true;
  if (A.tunnel && B.tunnel) return true;
  const mine = pub.players[uid].structures.mine;
  if (mine && ((a === mine && B.tunnel) || (b === mine && A.tunnel))) return true;
  if (has(pub, uid, 'underpass')) {
    const ok = (h) => MAP.hexes[h].tunnel || (MAP.hexes[h].terrain === 'mountain' && controller(pub, h) === uid);
    if (ok(a) && ok(b)) return true;
  }
  if (has(pub, uid, 'township')) {
    const ok = (h) => MAP.hexes[h].terrain === 'factory' || (MAP.hexes[h].terrain === 'village' && controller(pub, h) === uid);
    if (ok(a) && ok(b)) return true;
  }
  if (has(pub, uid, 'submerge') && A.terrain === 'lake' && B.terrain === 'lake') return true;
  return false;
}
function stepOK(pub, uid, kind, a, b) {
  if (!linked(pub, uid, a, b)) return false;
  if (isHome(a)) return true;
  const A = MAP.hexes[a], B = MAP.hexes[b];
  if (A.terrain === 'lake' || B.terrain === 'lake') {
    if (kind === 'worker') return false;
    return has(pub, uid, 'seaworthy') || has(pub, uid, 'submerge');
  }
  if (A.rivers.includes(b)) {
    if (kind === 'worker') return has(pub, uid, 'swim');
    const R = FACTION_RULES[pub.players[uid].faction];
    return has(pub, uid, 'riverwalk') && R.riverwalk.includes(B.terrain);
  }
  return true;
}
function stopInfo(pub, uid, kind, to) {
  const others = Object.entries(unitsAt(pub, to)).filter(([u]) => u !== uid);
  if (kind === 'worker') return others.length ? { illegal: true } : { stop: false };
  if (others.length) return { stop: true };
  if (kind === 'char' && pub.hexes[to].enc) return { stop: true };
  return { stop: false };
}
export function reach(pub, uid, kind, from, steps) {
  const results = {};
  if (kind === 'worker' && !isHome(from) && Object.keys(unitsAt(pub, from)).some((u) => u !== uid)) return results;
  let frontier = [{ hex: from, path: [] }];
  for (let s = 0; s < steps; s++) {
    const next = [];
    for (const { hex, path } of frontier) {
      const cands = isHome(hex) ? MAP.homes[hex.slice(5)].neighbors : ALL_HEX_IDS;
      for (const to of cands) {
        if (to === from || !stepOK(pub, uid, kind, hex, to)) continue;
        const info = stopInfo(pub, uid, kind, to);
        if (info.illegal) continue;
        const p = [...path, to];
        if (!results[to] || results[to].length > p.length) results[to] = p;
        if (!info.stop) next.push({ hex: to, path: p });
      }
    }
    frontier = next;
  }
  return results;
}
export const moveRange = (pub, uid, kind) => (kind === 'worker' ? 1 : 1 + (has(pub, uid, 'speed') ? 1 : 0));

// ---------------------------------------------------------------- 支払い・獲得
function payCoins(c, n) {
  if (n <= 0) return null;
  if (c.priv.coins < n) return `コインが足りません（${n}枚必要）`;
  c.priv.coins -= n; return null;
}
function discardCards(c, n, ids) {
  const hand = c.priv.hand;
  const pick = ids?.length ? ids : [...hand].sort((a, b) => cardValue(a) - cardValue(b)).slice(0, n);
  if (pick.length < n || !pick.every((id) => hand.includes(id))) return '戦闘カードが足りません';
  for (const id of pick.slice(0, n)) { hand.splice(hand.indexOf(id), 1); c.priv.discard.push(id); }
  return null;
}
export function drawCards(priv, n, rng) {
  for (let i = 0; i < n; i++) {
    if (!priv.deck.length) {
      if (!priv.discard.length) break;
      priv.deck = shuffle(priv.discard, rng); priv.discard = [];
    }
    priv.hand.push(priv.deck.pop());
  }
}
function payRes(c, need, opts = {}) {
  const n = { ...need };
  if (opts.coerce) {
    const { res, cardId } = opts.coerce;
    if (!has(c.pub, c.uid, 'coercion')) return '強要の能力がありません';
    if (c.pub.turn.coerced) return '強要は1手番に1回までです';
    if (!(n[res] > 0)) return '強要で置き換える資源がありません';
    if (!c.priv.hand.includes(cardId)) return '手札にないカードです';
    n[res] -= 1; c.pub.turn.coerced = true;
    c.priv.hand.splice(c.priv.hand.indexOf(cardId), 1); c.priv.discard.push(cardId);
  }
  const mine = controlledHexes(c.pub, c.uid);
  for (const r of RES) {
    let left = n[r] || 0;
    if (left <= 0) continue;
    const list = mine.filter((h) => c.pub.hexes[h].res[r] > 0).sort((a, b) => c.pub.hexes[b].res[r] - c.pub.hexes[a].res[r]);
    const total = list.reduce((s, h) => s + c.pub.hexes[h].res[r], 0);
    if (total < left) return `${RES_NAME[r]}が足りません（支配する領土の資源のみ使えます）`;
    for (const h of list) { const t = Math.min(left, c.pub.hexes[h].res[r]); c.pub.hexes[h].res[r] -= t; left -= t; if (!left) break; }
  }
  return null;
}
function payCost(c, cost, opts) {
  if (c.priv.coins < (cost.coins || 0)) return 'コインが足りません';
  const P = c.pub.players[c.uid];
  if (P.power < (cost.power || 0)) return '戦力が足りません';
  if (P.pop < (cost.pop || 0)) return '人気度が足りません';
  if (c.priv.hand.length < (cost.cards || 0)) return '戦闘カードが足りません';
  const trial = clone({ pub: c.pub, priv: c.priv });
  const t = { ...c, pub: trial.pub, priv: trial.priv };
  const rc = {}; RES.forEach((r) => { if (cost[r]) rc[r] = cost[r]; });
  const e = payRes(t, rc, opts); if (e) return e;
  Object.assign(c.pub, trial.pub); Object.assign(c.priv, trial.priv);
  c.priv.coins -= cost.coins || 0; P.power -= cost.power || 0; P.pop -= cost.pop || 0;
  if (cost.cards) discardCards(c, cost.cards);
  return null;
}
function gain(c, g, hex) {
  const P = c.pub.players[c.uid];
  if (g.coins) c.priv.coins += g.coins;
  if (g.power) P.power = clamp(P.power + g.power, 0, 16);
  if (g.pop) P.pop = clamp(P.pop + g.pop, 0, 18);
  if (g.cards) drawCards(c.priv, g.cards, c.rng);
  for (const r of RES) if (g[r] && hex) c.pub.hexes[hex].res[r] += g[r];
  if (g.worker && hex && P.produced < 6) { P.produced += 1; c.pub.units[c.uid].workers.push(hex); }
}

// ---------------------------------------------------------------- 星・終了
function addStar(c, uid, type) {
  const P = c.pub.players[uid];
  if (P.stars.length >= 6 || c.pub.ended) return;
  P.stars.push(type);
  say({ ...c, uid }, `${P.name} が星を獲得（${starName(type)}）`);
  if (P.stars.length >= 6) {
    c.pub.ended = true; c.pub.endedBy = uid; c.pub.turn.phase = 'ended';
    say({ ...c, uid }, `${P.name} が6つ目の星を置き、ゲーム終了`);
  }
}
export const STAR_NAME = {
  upgrades: '改良6回', mechs: 'メック4体', structures: '建物4つ', recruits: '徴兵4回', workers: 'ワーカー8体',
  power: '戦力16', popularity: '人気度18', objective: '目的カード', combat: '戦闘勝利',
};
const starName = (t) => STAR_NAME[String(t).split('#')[0]] || t;
function starCheck(c) {
  for (const uid of c.pub.order) {
    const P = c.pub.players[uid], U = c.pub.units[uid], have = new Set(P.stars);
    const goals = {
      upgrades: Object.values(P.cubes).every((x) => x === 0), mechs: P.mechs === 4,
      structures: Object.values(P.structures).every(Boolean), recruits: Object.values(P.recruits).every(Boolean),
      workers: U.workers.length >= 8, power: P.power >= 16, popularity: P.pop >= 18,
    };
    for (const [t, ok] of Object.entries(goals)) if (ok && !have.has(t)) addStar(c, uid, t);
    const cap = has(c.pub, uid, 'dominate') ? 99 : 2;
    const cs = P.stars.filter((s) => s.startsWith('combat')).length;
    for (let i = cs; i < Math.min(P.combatWins, cap); i++) addStar(c, uid, `combat#${i + 1}`);
  }
}

// ---------------------------------------------------------------- 目的カード（仮）
export function objectiveMet(id, pub, uid, coins) {
  const P = pub.players[uid], mine = controlledHexes(pub, uid);
  const resCount = mine.reduce((s, h) => s + RES.reduce((t, r) => t + pub.hexes[h].res[r], 0), 0);
  switch (id) {
    case 'o01': return mine.length >= 6;
    case 'o02': return P.power >= 10;
    case 'o03': return P.pop >= 12;
    case 'o04': return resCount >= 8;
    case 'o05': return pub.units[uid].workers.length >= 6;
    case 'o06': return P.mechs >= 2;
    case 'o07': return Object.values(P.structures).filter(Boolean).length >= 3;
    case 'o08': return Object.values(P.cubes).reduce((s, x) => s + x, 0) <= 2;
    case 'o09': return coins >= 15;
    case 'o10': return P.stars.filter((s) => !s.startsWith('objective')).length >= 3;
    case 'o11': return controller(pub, '0,0') === uid;
    case 'o12': return mine.filter((h) => MAP.hexes[h].neighbors.some((n) => MAP.hexes[n].terrain === 'lake')).length >= 2;
    default: return false;
  }
}

// ---------------------------------------------------------------- 最終得点
export function tierOf(pop) { return SCORE_TIERS.find((t) => pop <= t.max) || SCORE_TIERS[2]; }
export function computeResults(pub, coins) {
  const tile = STRUCTURE_TILES.find((t) => t.id === pub.tile);
  const rows = pub.order.map((uid) => {
    const P = pub.players[uid], U = pub.units[uid], T = tierOf(P.pop);
    const mine = controlledHexes(pub, uid);
    const terr = mine.reduce((s, h) => s + (MAP.hexes[h].terrain === 'factory' ? 3 : 1), 0);
    const res = mine.reduce((s, h) => s + RES.reduce((t, r) => t + pub.hexes[h].res[r], 0), 0);
    const structHexes = Object.values(P.structures).filter(Boolean);
    const test = { lake: (h) => MAP.hexes[h].neighbors.some((n) => MAP.hexes[n].terrain === 'lake'), tunnel: (h) => MAP.hexes[h].tunnel, village: (h) => MAP.hexes[h].terrain === 'village' }[tile.test];
    const bonus = structHexes.filter(test).length * tile.coins;
    const parts = { coins: coins[uid] ?? 0, stars: P.stars.length * T.star, territories: terr * T.terr, resources: Math.floor(res / 2) * T.pair, structureBonus: bonus };
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    const onBoard = U.workers.length + P.mechs + structHexes.length;
    return { uid, name: P.name, faction: P.faction, tier: T.name, parts, total, tie: [total, onBoard, P.power, P.pop, res, terr, P.stars.length], detail: { terr, res, stars: P.stars.length, pop: P.pop, power: P.power } };
  });
  rows.sort((a, b) => { for (let i = 0; i < a.tie.length; i++) if (a.tie[i] !== b.tie[i]) return b.tie[i] - a.tie[i]; return 0; });
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// ---------------------------------------------------------------- インテント処理
const NEED_TURN = new Set(['section', 'moveGain', 'move', 'finishMove', 'bolster', 'trade', 'produce', 'factoryTop', 'upgrade', 'deploy',
  'build', 'enlist', 'combatStart', 'combatResolve', 'encounter', 'factoryPick', 'objective', 'endTurn']);

export function applyIntent({ pub, priv, uid, intent, rng = cryptoRng }) {
  const c = { pub: clone(pub), priv: clone(priv), uid, rng };
  const P = c.pub.players[uid];
  if (!P) return { error: '参加者ではありません' };
  const type = intent.type;
  if (type === 'finalCoins') {
    if (!c.pub.ended) return { error: 'ゲームはまだ終わっていません' };
    c.pub.finalCoins[uid] = c.priv.coins;
    if (c.pub.order.every((u) => u in c.pub.finalCoins)) c.pub.result = computeResults(c.pub, c.pub.finalCoins);
    return { pub: c.pub, priv: c.priv };
  }
  if (c.pub.ended) return { error: 'ゲームは終了しています' };
  if (NEED_TURN.has(type) && c.pub.turnUid !== uid) return { error: 'あなたの手番ではありません' };
  const h = HANDLERS[type];
  if (!h) return { error: `未対応の操作です: ${type}` };
  const err = h(c, intent);
  if (err) return { error: err };
  starCheck(c);
  c.pub.players[uid].hand = c.priv.hand.length;
  return { pub: c.pub, priv: c.priv };
}

const inPhase = (c, ...ph) => ph.includes(c.pub.turn.phase);
const needMain = (c) => (inPhase(c, 'main') ? null : '今はその操作ができません');

function topGuard(c, top) {
  const e = needMain(c); if (e) return e;
  const t = c.pub.turn, info = sectionInfo(c.pub.players[c.uid], t.section);
  if (info.top !== top) return `この区画の上段は「${top}」ではありません`;
  if (t.topDone) return '上段アクションは実行済みです';
  return null;
}
function bottomGuard(c, bottom) {
  const e = needMain(c); if (e) return e;
  const t = c.pub.turn, info = sectionInfo(c.pub.players[c.uid], t.section);
  if (info.bottom !== bottom) return 'この区画の下段ではありません';
  if (!t.topPerformed) return '上段アクションを実行してから下段を実行します';
  if (t.bottomDone) return '下段アクションは実行済みです';
  return null;
}
const topDone = (c) => { c.pub.turn.topDone = true; c.pub.turn.topPerformed = true; };

const HANDLERS = {
  section(c, { i }) {
    const t = c.pub.turn, P = c.pub.players[c.uid];
    if (t.phase !== 'section') return '今は区画を選べません';
    if (!Number.isInteger(i) || i < 0 || i > 4) return '区画が不正です';
    if (i === 4 && !P.factoryCard) return '工場カードを持っていません';
    if (P.last === i && !(i < 4 && FACTION_RULES[P.faction].ability === 'relentless')) return '前回と同じ区画は選べません';
    c.pub.turn = { section: i, phase: 'main', topDone: false, topPerformed: false, bottomDone: false, coerced: false };
    say(c, `${pname(c)} が区画${i + 1}を選択`);
    return null;
  },

  moveGain(c) {
    const e = topGuard(c, 'move'); if (e) return e;
    const P = c.pub.players[c.uid], n = 1 + (up(P, 'move') >= 2 ? 1 : 0);
    c.priv.coins += n; topDone(c);
    say(c, `${pname(c)} がコイン${n}枚を獲得`); return null;
  },

  bolster(c, { mode }) {
    const e = topGuard(c, 'bolster'); if (e) return e;
    const P = c.pub.players[c.uid];
    const pe = payCoins(c, 1); if (pe) return pe;
    if (mode === 'power') { const n = 2 + up(P, 'bolster'); P.power = clamp(P.power + n, 0, 16); say(c, `${pname(c)} が戦力+${n}`); }
    else if (mode === 'cards') { const n = 1 + up(P, 'bolster'); drawCards(c.priv, n, c.rng); say(c, `${pname(c)} が戦闘カードを${n}枚引いた`); }
    else return '鼓舞の種類を選んでください';
    if (P.structures.monument) { P.pop = clamp(P.pop + 1, 0, 18); }
    topDone(c); return null;
  },

  trade(c, { mode, picks }) {
    const e = topGuard(c, 'trade'); if (e) return e;
    const P = c.pub.players[c.uid];
    if (mode === 'res') {
      const n = 2 + (up(P, 'trade') >= 1 ? 1 : 0);
      if (!Array.isArray(picks) || picks.length < 1 || picks.length > n) return `資源は1〜${n}個選びます`;
      for (const { res, hex } of picks) {
        if (!RES.includes(res)) return '資源の種類が不正です';
        if (controller(c.pub, hex) !== c.uid || !myWorkersAt(c.pub, c.uid, hex)) return '資源は自分のワーカーがいる支配領土にだけ置けます';
      }
    } else if (mode !== 'pop') return '交易の種類を選んでください';
    const pe = payCoins(c, 1); if (pe) return pe;
    if (mode === 'res') {
      for (const { res, hex } of picks) c.pub.hexes[hex].res[res] += 1;
      say(c, `${pname(c)} が資源${picks.length}個を獲得`);
    } else {
      const n = 1 + (up(P, 'trade') >= 2 ? 1 : 0); P.pop = clamp(P.pop + n, 0, 18); say(c, `${pname(c)} が人気度+${n}`);
    }
    if (P.structures.armory) P.power = clamp(P.power + 1, 0, 16);
    topDone(c); return null;
  },

  produce(c, { hexes, coerce }) {
    const e = topGuard(c, 'produce'); if (e) return e;
    const P = c.pub.players[c.uid], U = c.pub.units[c.uid];
    if (!Array.isArray(hexes) || !hexes.length || new Set(hexes).size !== hexes.length) return '生産する領土を選んでください';
    const limit = 2 + up(P, 'produce'), mill = P.structures.mill;
    let normal = 0;
    for (const h of hexes) {
      if (!MAP.hexes[h]) return '領土が不正です';
      if (controller(c.pub, h) !== c.uid) return '支配していない領土です';
      const t = MAP.hexes[h].terrain;
      if (t === 'lake' || t === 'factory') return `${TERRAIN_NAME[t]}では生産できません`;
      if (h === mill) continue;
      if (!myWorkersAt(c.pub, c.uid, h)) return 'ワーカーのいない領土では生産できません';
      normal++;
    }
    if (normal > limit) return `生産できる領土は${limit}か所までです`;
    const pe = payCoins(c, PRODUCE_COST[Math.min(P.produced, 6)]); if (pe) return pe;
    void coerce;
    for (const h of hexes) {
      const n = myWorkersAt(c.pub, c.uid, h) + (h === mill ? 1 : 0), t = MAP.hexes[h].terrain;
      if (t === 'village') {
        const k = Math.min(n, 6 - P.produced);
        for (let i = 0; i < k; i++) { U.workers.push(h); P.produced += 1; }
      } else c.pub.hexes[h].res[TERRAIN_RES[t]] += n;
    }
    say(c, `${pname(c)} が${hexes.length}か所で生産`);
    topDone(c); return null;
  },

  factoryTop(c) {
    const e = topGuard(c, 'factory'); if (e) return e;
    const P = c.pub.players[c.uid], card = FACTORY_BY_ID[P.factoryCard];
    const pe = payCost(c, card.top.cost); if (pe) return pe;
    const U = c.pub.units[c.uid], at = U.char;
    const hex = isHome(at) ? controlledHexes(c.pub, c.uid)[0] : at;
    gain(c, card.top.gain, hex);
    say(c, `${pname(c)} が工場カード「${card.name}」を使用`);
    topDone(c); return null;
  },

  // ----- 下段
  upgrade(c, { from, to, coerce }) {
    const e = bottomGuard(c, 'upgrade'); if (e) return e;
    return doBottom(c, 'upgrade', coerce, (P) => {
      if (from == null && to == null) return null;
      if (!(P.cubes[from] > 0)) return '改良するキューブがありません';
      if (!(P.bottom[to] < BASE_MATS[P.mat].lower[to][1])) return 'その下段には空きスロットがありません';
      P.cubes[from] -= 1; P.bottom[to] += 1; return null;
    });
  },
  deploy(c, { hex, coerce }) {
    const e = bottomGuard(c, 'deploy'); if (e) return e;
    return doBottom(c, 'deploy', coerce, (P, U) => {
      if (P.mechs >= 4) return null;
      if (!hex || controller(c.pub, hex) !== c.uid || !myWorkersAt(c.pub, c.uid, hex)) return 'メックは自分のワーカーがいる支配領土に配備します';
      if (MAP.hexes[hex].terrain === 'lake') return '湖には配備できません';
      U.mechs[P.mechs] = hex; P.mechs += 1; return null;
    });
  },
  build(c, { struct, hex, coerce }) {
    const e = bottomGuard(c, 'build'); if (e) return e;
    return doBottom(c, 'build', coerce, (P) => {
      if (Object.values(P.structures).every(Boolean)) return null;
      if (!STRUCT_NAME[struct] || P.structures[struct]) return '建てる建物を選んでください';
      if (!hex || controller(c.pub, hex) !== c.uid || !myWorkersAt(c.pub, c.uid, hex)) return '建物は自分のワーカーがいる支配領土に建てます';
      if (MAP.hexes[hex].terrain === 'lake') return '湖には建てられません';
      if (c.pub.hexes[hex].struct) return 'その領土にはすでに建物があります';
      c.pub.hexes[hex].struct = { uid: c.uid, type: struct }; P.structures[struct] = hex; return null;
    });
  },
  enlist(c, { section, bonus, coerce }) {
    const e = bottomGuard(c, 'enlist'); if (e) return e;
    return doBottom(c, 'enlist', coerce, (P) => {
      if (Object.values(P.recruits).every(Boolean)) return null;
      if (!(section in P.recruits) || P.recruits[section]) return '徴兵する区画を選んでください';
      if (!(bonus in ENLIST_BONUS) || P.bonusUsed[bonus]) return '使える徴兵ボーナスを選んでください';
      P.recruits[section] = bonus; P.bonusUsed[bonus] = true;
      if (bonus === 'power') P.power = clamp(P.power + 2, 0, 16);
      if (bonus === 'pop') P.pop = clamp(P.pop + 2, 0, 18);
      if (bonus === 'coins') c.priv.coins += 2;
      if (bonus === 'cards') drawCards(c.priv, 2, c.rng);
      return null;
    });
  },

  // ----- 目的・手番終了
  objective(c, { id }) {
    const e = needMain(c); if (e) return e;
    const P = c.pub.players[c.uid];
    if (!c.priv.objectives.includes(id)) return 'そのカードを持っていません';
    if (P.objStars >= (has(c.pub, c.uid, 'dominate') ? 2 : 1)) return '目的カードの星はこれ以上獲得できません';
    if (!objectiveMet(id, c.pub, c.uid, c.priv.coins)) return '達成条件を満たしていません';
    c.priv.objectives.splice(c.priv.objectives.indexOf(id), 1);
    P.objStars += 1;
    say(c, `${pname(c)} が目的カードを公開（${OBJECTIVES.find((o) => o.id === id).text}）`);
    addStar(c, c.uid, 'objective'); return null;
  },
  endTurn(c) {
    const e = needMain(c); if (e) return e;
    const P = c.pub.players[c.uid], pub = c.pub;
    P.last = pub.turn.section;
    const i = pub.order.indexOf(c.uid);
    pub.turnUid = pub.order[(i + 1) % pub.order.length];
    if ((i + 1) % pub.order.length === 0) pub.turnNo += 1;
    pub.turn = { section: null, phase: 'section' };
    say(c, `${pname(c)} が手番を終了`); return null;
  },

  // ----- 移動
  move(c, { unit, to, carry }) {
    const t = c.pub.turn, P = c.pub.players[c.uid], U = c.pub.units[c.uid];
    if (t.phase === 'main') {
      const info = sectionInfo(P, t.section);
      if (info.top === 'move' && !t.topDone) t.mv = { kind: 'top', max: 2 + (up(P, 'move') >= 1 ? 1 : 0), moved: [], moves: 0, combat: [], charTo: null };
      else if (info.bottom === 'fmove' && t.topPerformed && !t.bottomDone) t.mv = { kind: 'bottom', max: 1, moved: [], moves: 0, used: 0, budget: null, combat: [], charTo: null };
      else return '今は移動できません';
      t.phase = 'moving';
    }
    if (t.phase !== 'moving') return '今は移動できません';
    const mv = t.mv, kind = unit?.kind, idx = unit?.idx ?? 0;
    const key = kind === 'char' ? 'c' : kind === 'mech' ? `m${idx}` : `w${idx}`;
    const from = kind === 'char' ? U.char : kind === 'mech' ? U.mechs[idx] : U.workers[idx];
    if (!['char', 'mech', 'worker'].includes(kind) || !from) return '移動する駒を選んでください';
    if (mv.kind === 'top') {
      if (mv.moved.includes(key)) return '同じ駒は1回の移動アクションで1度しか動かせません';
      if (!mv.moved.includes(key) && mv.moved.length >= mv.max) return `移動できる駒は${mv.max}つまでです`;
    } else if (mv.moved.length && mv.moved[0] !== key) return '工場移動は1つの駒だけを動かします';
    let range;
    if (mv.kind === 'bottom') {
      if (mv.budget == null) mv.budget = 2 + (kind !== 'worker' && has(c.pub, c.uid, 'speed') ? 1 : 0);
      range = mv.budget - mv.used;
      if (range <= 0) return '工場移動の歩数を使い切りました';
    } else range = moveRange(c.pub, c.uid, kind);
    const dest = reach(c.pub, c.uid, kind, from, range);
    if (!dest[to]) return 'そこへは移動できません';
    // 運搬
    const cr = carry?.res || {}, cw = carry?.workers || [];
    for (const r of RES) if ((cr[r] || 0) > c.pub.hexes[from]?.res[r] || (cr[r] || 0) < 0) return '運べる資源が足りません';
    if (cw.length && kind !== 'mech') return 'ワーカーを運べるのはメックだけです';
    for (const w of cw) if (U.workers[w] !== from || (kind === 'worker' && w === idx)) return '運べないワーカーです';
    if (isHome(from) && (Object.values(cr).some(Boolean) || cw.length)) return '本拠地からは運搬できません';
    // 実行
    if (kind === 'char') U.char = to; else if (kind === 'mech') U.mechs[idx] = to; else U.workers[idx] = to;
    if (!isHome(from)) for (const r of RES) if (cr[r]) { c.pub.hexes[from].res[r] -= cr[r]; c.pub.hexes[to].res[r] += cr[r]; }
    for (const w of cw) U.workers[w] = to;
    if (!mv.moved.includes(key)) mv.moved.push(key);
    mv.moves += 1; mv.used = (mv.used || 0) + dest[to].length;
    // 到着処理
    const others = Object.entries(unitsAt(c.pub, to)).filter(([u]) => u !== c.uid);
    if (kind !== 'worker' && others.length) {
      const enemyCombat = others.filter(([, e]) => e.char || e.mechs.length);
      if (enemyCombat.length) { if (!mv.combat.includes(to)) mv.combat.push(to); }
      else {
        for (const [u, e] of others) {
          for (const w of e.workers) c.pub.units[u].workers[w] = homeNodeId(c.pub.players[u].faction);
          if (!has(c.pub, c.uid, 'camaraderie')) P.pop = clamp(P.pop - e.workers.length, 0, 18);
          say(c, `${pname(c)} が ${pname(c, u)} のワーカー${e.workers.length}体を退かせた`);
        }
      }
    }
    if (kind === 'char') mv.charTo = to;
    say(c, `${pname(c)} が${kind === 'char' ? 'キャラクター' : kind === 'mech' ? 'メック' : 'ワーカー'}を移動`);
    return null;
  },
  finishMove(c) {
    const t = c.pub.turn;
    if (t.phase !== 'moving') return '移動中ではありません';
    const mv = t.mv, P = c.pub.players[c.uid];
    if (mv.kind === 'top') topDone(c); else t.bottomDone = true;
    void P;
    t.queue = mv.combat.filter((h) => combatants(c.pub, h));
    t.post = [];
    const U = c.pub.units[c.uid];
    if (mv.charTo && U.char === mv.charTo) {
      if (c.pub.hexes[mv.charTo].enc) t.post.push({ kind: 'encounter', hex: mv.charTo });
      if (MAP.hexes[mv.charTo].terrain === 'factory' && !P.factoryCard && c.pub.deck.factory.length) t.post.push({ kind: 'factory', hex: mv.charTo });
    }
    delete t.mv;
    if (t.queue.length) { t.phase = 'combat'; return null; }
    return advancePost(c);
  },

  // ----- 戦闘
  combatStart(c, { hex }) {
    const t = c.pub.turn;
    if (t.phase !== 'combat' || !t.queue.includes(hex)) return '開始できる戦闘がありません';
    const cb = combatants(c.pub, hex); if (!cb) return '戦闘できる状態ではありません';
    const att = c.uid, def = cb.def;
    const maxCards = {};
    for (const u of [att, def]) {
      const e = unitsAt(c.pub, hex)[u];
      maxCards[u] = (e.char ? 1 : 0) + e.mechs.length + (has(c.pub, u, 'peoples_army') && e.workers.length ? 1 : 0);
    }
    t.combat = { hex, att, def, phase: 'select', commits: {}, reveals: {}, used: {}, maxCards, log: [] };
    // 武装解除: 先に攻撃側
    for (const [u, o] of [[att, def], [def, att]]) {
      const isTunnel = MAP.hexes[hex].tunnel || c.pub.players[u].structures.mine === hex;
      if (has(c.pub, u, 'disarm') && isTunnel) {
        c.pub.players[o].power = Math.max(0, c.pub.players[o].power - 2);
        say({ ...c, uid: u }, `${pname(c, u)} の武装解除！ ${pname(c, o)} の戦力-2`);
      }
    }
    say(c, `${pname(c, att)} と ${pname(c, def)} の戦闘開始`);
    return null;
  },
  combatAbility(c, { name }) {
    const cb = c.pub.turn.combat;
    if (!cb || cb.phase !== 'select' || ![cb.att, cb.def].includes(c.uid)) return '今は使えません';
    if (name !== 'artillery' || !has(c.pub, c.uid, 'artillery')) return '使える能力がありません';
    if (cb.used[c.uid] || cb.commits[c.uid]) return 'すでに使用済み、または選択済みです';
    const P = c.pub.players[c.uid];
    if (P.power < 1) return '戦力が足りません';
    const o = c.uid === cb.att ? cb.def : cb.att;
    P.power -= 1; c.pub.players[o].power = Math.max(0, c.pub.players[o].power - 2);
    cb.used[c.uid] = true;
    say(c, `${pname(c)} の砲撃！ ${pname(c, o)} の戦力-2`); return null;
  },
  combatCommit(c, { dial, cardIds, nonce }) {
    const cb = c.pub.turn.combat;
    if (!cb || cb.phase !== 'select' || ![cb.att, cb.def].includes(c.uid)) return '今は選択できません';
    if (cb.commits[c.uid]) return 'すでに選択済みです';
    const err = checkChoice(c, cb, dial, cardIds); if (err) return err;
    if (!nonce) return '内部エラー: nonce がありません';
    cb.commits[c.uid] = sha256(JSON.stringify({ dial, cardIds: [...cardIds].sort(), nonce }));
    c.priv.pending = { dial, cardIds, nonce };
    if (cb.commits[cb.att] && cb.commits[cb.def]) cb.phase = 'reveal';
    return null;
  },
  combatReveal(c) {
    const cb = c.pub.turn.combat;
    if (!cb || cb.phase !== 'reveal' || ![cb.att, cb.def].includes(c.uid)) return '今は公開できません';
    if (cb.reveals[c.uid]) return 'すでに公開済みです';
    const pend = c.priv.pending; if (!pend) return '選択内容が見つかりません';
    cb.reveals[c.uid] = pend;
    for (const id of pend.cardIds) { const i = c.priv.hand.indexOf(id); if (i >= 0) { c.priv.hand.splice(i, 1); c.priv.discard.push(id); } }
    c.priv.pending = null;
    if (cb.reveals[cb.att] && cb.reveals[cb.def]) cb.phase = 'resolve';
    return null;
  },
  combatResolve(c) {
    const t = c.pub.turn, cb = t.combat;
    if (!cb || cb.phase !== 'resolve' || c.uid !== cb.att) return '今は解決できません';
    const sides = {};
    for (const u of [cb.att, cb.def]) {
      const r = cb.reveals[u], P = c.pub.players[u];
      const okHash = r && sha256(JSON.stringify({ dial: r.dial, cardIds: [...r.cardIds].sort(), nonce: r.nonce })) === cb.commits[u];
      const valid = okHash && Number.isInteger(r.dial) && r.dial >= 0 && r.dial <= Math.min(DIAL_MAX, P.power) && r.cardIds.length <= cb.maxCards[u] && new Set(r.cardIds).size === r.cardIds.length;
      if (!valid) say(c, `${P.name} の選択が不正だったため戦力0・カードなしとして扱う`);
      sides[u] = valid ? { dial: r.dial, cards: r.cardIds.map(cardValue) } : { dial: 0, cards: [] };
      sides[u].total = sides[u].dial + sides[u].cards.reduce((a, b) => a + b, 0);
    }
    const winner = sides[cb.att].total >= sides[cb.def].total ? cb.att : cb.def;
    const loser = winner === cb.att ? cb.def : cb.att;
    for (const u of [cb.att, cb.def]) { const P = c.pub.players[u]; P.power = clamp(P.power - sides[u].dial, 0, 16); }
    // 敗者の撤退
    const lu = unitsAt(c.pub, cb.hex)[loser] || { char: false, mechs: [], workers: [] };
    const U = c.pub.units[loser], home = homeNodeId(c.pub.players[loser].faction);
    if (lu.char) U.char = home;
    lu.mechs.forEach((i) => { U.mechs[i] = home; });
    lu.workers.forEach((i) => { U.workers[i] = home; });
    if (winner === cb.att && lu.workers.length && !has(c.pub, cb.att, 'camaraderie')) {
      c.pub.players[cb.att].pop = clamp(c.pub.players[cb.att].pop - lu.workers.length, 0, 18);
    }
    c.pub.players[winner].combatWins += 1;
    const shown = sides[loser].total > 0;
    if (shown) {
      if (loser === c.uid) { drawCards(c.priv, 1, c.rng); } else c.pub.players[loser].pendingDraw += 1;
    }
    t.last = { hex: cb.hex, att: cb.att, def: cb.def, sides, winner, loser };
    say(c, `戦闘結果: ${pname(c, cb.att)} ${sides[cb.att].total} 対 ${pname(c, cb.def)} ${sides[cb.def].total} → ${pname(c, winner)} の勝利`);
    delete t.combat;
    t.queue = t.queue.filter((h) => h !== cb.hex && combatants(c.pub, h));
    if (t.queue.length) { t.phase = 'combat'; return null; }
    return advancePost(c);
  },
  drawPending(c) {
    const P = c.pub.players[c.uid];
    if (!(P.pendingDraw > 0)) return '引くカードはありません';
    drawCards(c.priv, P.pendingDraw, c.rng); P.pendingDraw = 0; return null;
  },

  // ----- 遭遇・工場
  encounter(c, { options }) {
    const t = c.pub.turn;
    if (t.phase !== 'encounter') return '遭遇中ではありません';
    const card = CARD_BY_ID[t.enc.cardId], max = has(c.pub, c.uid, 'meander') ? 2 : 1;
    const picks = options || [];
    if (picks.length > max || new Set(picks).size !== picks.length) return `選べる選択肢は${max}つまでです`;
    const hex = t.enc.hex;
    for (const i of picks) {
      const o = card.options[i]; if (!o) return '選択肢が不正です';
      const e = payCost(c, o.cost); if (e) return `選択肢${'ABC'[i]}: ${e}`;
      gain(c, o.gain, hex);
    }
    c.pub.deck.encounter.push(c.pub.deck.encounter.shift());
    c.pub.hexes[hex].enc = false;
    say(c, `${pname(c)} が遭遇を解決`);
    delete t.enc;
    return advancePost(c);
  },
  factoryPick(c, { id }) {
    const t = c.pub.turn, P = c.pub.players[c.uid];
    if (t.phase !== 'factory') return '工場カードを選ぶ場面ではありません';
    const i = c.pub.deck.factory.indexOf(id); if (i < 0) return 'そのカードは選べません';
    c.pub.deck.factory.splice(i, 1); P.factoryCard = id;
    say(c, `${pname(c)} が工場カード「${FACTORY_BY_ID[id].name}」を獲得`);
    return advancePost(c);
  },
};

// ---------------------------------------------------------------- 内部処理
function combatants(pub, hex) {
  const u = unitsAt(pub, hex), uids = Object.keys(u).filter((k) => u[k].char || u[k].mechs.length);
  if (uids.length !== 2) return null;
  const att = pub.turnUid;
  if (!uids.includes(att)) return null;
  return { att, def: uids.find((x) => x !== att) };
}
function checkChoice(c, cb, dial, cardIds) {
  const P = c.pub.players[c.uid];
  if (!Number.isInteger(dial) || dial < 0 || dial > Math.min(DIAL_MAX, P.power)) return `戦力ダイヤルは0〜${Math.min(DIAL_MAX, P.power)}です`;
  if (!Array.isArray(cardIds) || new Set(cardIds).size !== cardIds.length) return '戦闘カードの指定が不正です';
  if (cardIds.length > cb.maxCards[c.uid]) return `戦闘カードは${cb.maxCards[c.uid]}枚までです`;
  if (!cardIds.every((id) => c.priv.hand.includes(id))) return '手札にないカードです';
  return null;
}
function advancePost(c) {
  const t = c.pub.turn, U = c.pub.units[c.uid], P = c.pub.players[c.uid];
  while (t.post && t.post.length) {
    const it = t.post.shift();
    if (U.char !== it.hex) continue;
    if (it.kind === 'encounter' && c.pub.hexes[it.hex].enc) {
      t.enc = { cardId: c.pub.deck.encounter[0], hex: it.hex }; t.phase = 'encounter';
      say(c, `${pname(c)} が遭遇カードを引いた`); return null;
    }
    if (it.kind === 'factory' && !P.factoryCard && c.pub.deck.factory.length) { t.phase = 'factory'; return null; }
  }
  t.phase = 'main'; delete t.post; delete t.queue; return null;
}
function doBottom(c, key, coerce, effect) {
  const P = c.pub.players[c.uid], lower = BASE_MATS[P.mat].lower[key];
  return effect2(c, key, lower, Math.max(0, lower[0] - P.bottom[key]), coerce, effect);
}
function effect2(c, key, lower, cost, coerce, effect) {
  const P = c.pub.players[c.uid], U = c.pub.units[c.uid];
  // 1) 効果の事前検証（コピー上で）
  const probe = clone({ pub: c.pub, priv: c.priv }); const pc = { ...c, pub: probe.pub, priv: probe.priv };
  const pe0 = payRes(pc, { [BOTTOM_RES[key]]: cost }, { coerce }); if (pe0) return pe0;
  const e = effect(pc.pub.players[c.uid], pc.pub.units[c.uid]); if (e) return e;
  // 2) 本適用
  payRes(c, { [BOTTOM_RES[key]]: cost }, { coerce });
  effect(P, U);
  c.priv.coins += lower[2];
  c.pub.turn.bottomDone = true;
  say(c, `${pname(c)} が「${BOTTOM_NAME[key]}」を実行`);
  triggerRob(c, key);
  return null;
}
function triggerRob(c, key) {
  const o = c.pub.order, i = o.indexOf(c.uid);
  const set = new Set([c.uid, o[(i + 1) % o.length], o[(i - 1 + o.length) % o.length]]);
  for (const u of set) {
    const P = c.pub.players[u];
    if (!P.recruits[key]) continue;
    const r = ROB[key];
    if (r.power) P.power = clamp(P.power + r.power, 0, 16);
    if (r.pop) P.pop = clamp(P.pop + r.pop, 0, 18);
  }
}

export { HOME_ORDER, STRUCT_OF_TOP };
