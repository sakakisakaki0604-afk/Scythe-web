// 対戦画面（game.js / game-ui.js）が使う盤面データ形式。実データは map.js（仮マップ）から変換して作る。
// 公式盤面に差し替えるときは map.js だけを差し替えればよい。
import { MAP as M, ALL_HEX_IDS, HOME_ORDER } from './map.js';

export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const RES = ['metal', 'oil', 'food', 'wood'];
export const TERRAIN_RES = { mountain: 'metal', tundra: 'oil', farm: 'food', forest: 'wood' };

const hexes = {};
for (const id of ALL_HEX_IDS) {
  const h = M.hexes[id];
  hexes[id] = { id, q: h.q, r: h.r, terrain: h.terrain, tunnel: h.tunnel, encounter: h.enc, nb: [...h.neighbors], river: [...h.rivers], home: null };
}
const homes = {}, startAdj = {};
for (const f of HOME_ORDER) {
  const hm = M.homes[f];
  const [a, b] = hm.neighbors.map((id) => M.hexes[id]);
  const k = 1.34; // 外周のすぐ外側に本拠地を描く
  hexes[hm.id] = { id: hm.id, q: ((a.q + b.q) / 2) * k, r: ((a.r + b.r) / 2) * k, terrain: 'home', tunnel: false, encounter: false, nb: [...hm.neighbors], river: [], home: f };
  hm.neighbors.forEach((n) => hexes[n].nb.push(hm.id));
  homes[f] = hm.id;
  startAdj[f] = [...hm.neighbors];
}

export const MAP = { ids: [...ALL_HEX_IDS, ...HOME_ORDER.map((f) => homes[f])], hexes, homes, startAdj, placeholder: true };
export const isRiver = (a, b) => hexes[a].river.includes(b);
