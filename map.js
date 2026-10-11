// 【仮マップ】公式盤面のヘクス配置は未入力のため、遊べる形の仮の盤面を決定的に生成する。
// 公式盤面データが入手できたら buildMap() の戻り値と同じ形式のデータに差し替える。
// 構造: 37ヘクス（半径3）、中央=工場。外周に本拠地5つ。川=ヘクス間の辺、トンネル4、遭遇トークン11。

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const hexId = (q, r) => `${q},${r}`;
export const homeNodeId = (faction) => `home:${faction}`;
export const isHome = (id) => String(id).startsWith('home:');
export const HOME_ORDER = ['nordic', 'rusviet', 'crimea', 'saxony', 'polania']; // 時計回りの席順

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function tryBuild(seed) {
  const rng = mulberry32(seed);
  const hexes = {};
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) {
    if (Math.abs(q + r) > 3) continue;
    hexes[hexId(q, r)] = { id: hexId(q, r), q, r, terrain: null, tunnel: false, enc: false, neighbors: [], rivers: [], homeOf: null };
  }
  for (const h of Object.values(hexes)) {
    h.neighbors = DIRS.map(([dq, dr]) => hexId(h.q + dq, h.r + dr)).filter((id) => hexes[id]);
  }
  hexes['0,0'].terrain = 'factory';

  // 外周を角度順に並べ、本拠地5つを置く（各本拠地は隣り合う2ヘクスに接続）
  const ring = Object.values(hexes).filter((h) => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 3)
    .sort((a, b) => Math.atan2(a.r * 0.866, a.q + a.r / 2) - Math.atan2(b.r * 0.866, b.q + b.r / 2));
  const starts = [0, 4, 7, 11, 14];
  const homes = {};
  HOME_ORDER.forEach((f, i) => {
    const a = ring[starts[i]], b = ring[starts[i] + 1];
    homes[f] = { id: homeNodeId(f), faction: f, neighbors: [a.id, b.id] };
    a.homeOf = f; b.homeOf = f;
  });
  const homeAdj = new Set(Object.values(homes).flatMap((h) => h.neighbors));

  // 地形（山7・ツンドラ6・農場7・森7・村6・湖3 = 36）
  const bag = shuffled([
    ...Array(7).fill('mountain'), ...Array(6).fill('tundra'), ...Array(7).fill('farm'),
    ...Array(7).fill('forest'), ...Array(6).fill('village'), ...Array(3).fill('lake'),
  ], rng);
  const ids = Object.keys(hexes).filter((id) => id !== '0,0').sort();
  ids.forEach((id, i) => { hexes[id].terrain = bag[i]; });
  if ([...homeAdj].some((id) => hexes[id].terrain === 'lake')) return null;
  // 工場の隣は湖にしない（工場に到達できなくなるのを避ける）
  if (hexes['0,0'].neighbors.some((id) => hexes[id].terrain === 'lake')) return null;

  // トンネル4（山、本拠地隣接を除く）
  const mountains = shuffled(ids.filter((id) => hexes[id].terrain === 'mountain' && !homeAdj.has(id)), rng);
  if (mountains.length < 4) return null;
  mountains.slice(0, 4).forEach((id) => { hexes[id].tunnel = true; });

  // 遭遇トークン11（湖・本拠地隣接・工場を除く）
  const encCand = shuffled(ids.filter((id) => hexes[id].terrain !== 'lake' && !homeAdj.has(id)), rng);
  encCand.slice(0, 11).forEach((id) => { hexes[id].enc = true; });

  // 川9本（湖・本拠地隣接・工場を除く辺）
  const edges = [];
  for (const h of Object.values(hexes)) for (const n of h.neighbors) {
    if (h.id < n && ![h.id, n].some((x) => homeAdj.has(x) || hexes[x].terrain === 'lake' || x === '0,0')) edges.push([h.id, n]);
  }
  shuffled(edges, rng).slice(0, 9).forEach(([a, b]) => { hexes[a].rivers.push(b); hexes[b].rivers.push(a); });

  // 川で分断されても、陸続きの全ヘクス（湖以外）が1つの塊であること
  const land = Object.keys(hexes).filter((id) => hexes[id].terrain !== 'lake');
  const seen = new Set([land[0]]); const q = [land[0]];
  while (q.length) {
    const c = q.pop();
    for (const n of hexes[c].neighbors) {
      if (seen.has(n) || hexes[n].terrain === 'lake' || hexes[c].rivers.includes(n)) continue;
      seen.add(n); q.push(n);
    }
  }
  if (seen.size !== land.length) return null;
  return { hexes, homes, seed, placeholder: true };
}

export function buildMap() {
  for (let seed = 1; seed < 500; seed++) { const m = tryBuild(seed); if (m) return m; }
  throw new Error('仮マップを生成できません');
}

export const MAP = buildMap();
export const ALL_HEX_IDS = Object.keys(MAP.hexes);
