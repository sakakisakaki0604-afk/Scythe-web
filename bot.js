// 簡易ボット。テスト（ランダム対局）と、後日のAIプレイヤー実装の土台に使う。
// candidates() は「試す価値のある操作」を優先順で返す。最初に applyIntent が成功したものを採用する。
import { MAP, ALL_HEX_IDS } from './map.js';
import { RES, matColumns, BOTTOM_OF, STRUCT_NAME, ENCOUNTERS } from './gamedata.js';
import { controlledHexes, reach, moveRange, has, objectiveMet, currentSection } from './rules.js';
import { shuffle } from './draft.js';

const pick = (a, rng) => a[Math.floor(rng() * a.length)];

export function moveCandidates(pub, uid, rng, n = 6) {
  const U = pub.units[uid], units = [{ kind: 'char' }];
  U.mechs.forEach((h, i) => { if (h) units.push({ kind: 'mech', idx: i }); });
  U.workers.forEach((h, i) => units.push({ kind: 'worker', idx: i }));
  const out = [];
  for (const u of shuffle(units, rng)) {
    const from = u.kind === 'char' ? U.char : u.kind === 'mech' ? U.mechs[u.idx] : U.workers[u.idx];
    const dest = reach(pub, uid, u.kind, from, moveRange(pub, uid, u.kind));
    const hexes = Object.keys(dest);
    if (!hexes.length) continue;
    const pref = hexes.filter((h) => pub.hexes[h].enc || Object.keys(pub.units).some((o) => o !== uid && [pub.units[o].char, ...pub.units[o].mechs].includes(h)));
    const to = pref.length && rng() < 0.6 ? pick(pref, rng) : pick(hexes, rng);
    const carry = { res: {}, workers: [] };
    if (from && pub.hexes[from] && rng() < 0.4) for (const r of RES) if (pub.hexes[from].res[r]) carry.res[r] = pub.hexes[from].res[r];
    out.push({ type: 'move', unit: u, to, carry });
    if (out.length >= n) break;
  }
  return out;
}

export function candidates(pub, priv, uid, rng) {
  const P = pub.players[uid], t = pub.turn, out = [];
  if (t.phase === 'section') {
    const secs = shuffle([0, 1, 2, 3, ...(P.factoryCard ? [4] : [])], rng);
    return secs.map((i) => ({ type: 'section', i }));
  }
  if (t.phase === 'moving') {
    if (rng() < 0.5) out.push(...moveCandidates(pub, uid, rng, 3));
    out.push({ type: 'finishMove' });
    return out;
  }
  if (t.phase === 'combat') return shuffle([...t.queue], rng).map((hex) => ({ type: 'combatStart', hex }));
  if (t.phase === 'encounter') {
    const card = ENCOUNTERS.find((c) => c.id === t.enc.cardId), max = has(pub, uid, 'meander') ? 2 : 1;
    const idx = shuffle([0, 1, 2], rng);
    const combos = [];
    if (max === 2) for (const a of idx) for (const b of idx) if (a !== b) combos.push([a, b]);
    idx.forEach((i) => combos.push([i]));
    void card; combos.push([]);
    return combos.map((options) => ({ type: 'encounter', options }));
  }
  if (t.phase === 'factory') return pub.deck.factory.map((id) => ({ type: 'factoryPick', id }));
  if (t.phase !== 'main') return out;

  const info = currentSection(pub);
  const mine = controlledHexes(pub, uid);
  const withWorker = mine.filter((h) => pub.units[uid].workers.includes(h));
  for (const id of priv.objectives) if (objectiveMet(id, pub, uid, priv.coins)) out.push({ type: 'objective', id });
  if (!t.topDone) {
    if (info.top === 'move') { out.push(...moveCandidates(pub, uid, rng, 3), { type: 'moveGain' }); }
    if (info.top === 'bolster') out.push({ type: 'bolster', mode: rng() < 0.6 ? 'power' : 'cards' }, { type: 'bolster', mode: 'power' });
    if (info.top === 'trade') {
      out.push({ type: 'trade', mode: 'res', picks: withWorker.length ? [0, 1].map(() => ({ res: pick(RES, rng), hex: pick(withWorker, rng) })) : [] });
      out.push({ type: 'trade', mode: 'pop' });
    }
    if (info.top === 'produce') {
      const cand = withWorker.filter((h) => !['lake', 'factory'].includes(MAP.hexes[h].terrain));
      out.push({ type: 'produce', hexes: shuffle(cand, rng).slice(0, 2) }, { type: 'produce', hexes: cand.slice(0, 1) });
    }
    if (info.top === 'factory') out.push({ type: 'factoryTop' });
    out.push({ type: 'endTurn' });
    return out;
  }
  if (!t.bottomDone && t.topPerformed) {
    const b = info.bottom;
    if (b === 'upgrade') {
      const from = shuffle(Object.keys(P.cubes).filter((k) => P.cubes[k] > 0), rng)[0];
      const to = shuffle(Object.keys(P.bottom), rng)[0];
      out.push({ type: 'upgrade', from, to }, { type: 'upgrade', from: shuffle(Object.keys(P.cubes), rng)[0], to: 'deploy' }, { type: 'upgrade' });
    }
    if (b === 'deploy') out.push(...shuffle(withWorker, rng).slice(0, 3).map((hex) => ({ type: 'deploy', hex })), { type: 'deploy' });
    if (b === 'build') {
      const types = Object.keys(STRUCT_NAME).filter((k) => !P.structures[k]);
      for (const hex of shuffle(withWorker, rng).slice(0, 3)) out.push({ type: 'build', struct: pick(types.length ? types : ['mill'], rng), hex });
      out.push({ type: 'build' });
    }
    if (b === 'enlist') {
      const sec = shuffle(Object.keys(P.recruits).filter((k) => !P.recruits[k]), rng)[0];
      const bonus = shuffle(Object.keys(P.bonusUsed).filter((k) => !P.bonusUsed[k]), rng)[0];
      out.push({ type: 'enlist', section: sec, bonus });
    }
    if (b === 'fmove') out.push(...moveCandidates(pub, uid, rng, 2));
  }
  out.push({ type: 'endTurn' });
  return out;
}
void MAP; void ALL_HEX_IDS; void matColumns; void BOTTOM_OF;
