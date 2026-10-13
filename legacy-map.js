// 盤面データ（公式盤面画像から読み取り）。board-data.js が元。ゲーム用の形式に変換する。
import { BOARD } from './board-data.js';

export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const RES = ['metal', 'oil', 'food', 'wood'];
export const TERRAIN_RES = { mountain: 'metal', tundra: 'oil', farm: 'food', forest: 'wood' };
const HEXPX = {"0,-3":[335.3,153.2],"3,-2":[769.6,261.3],"3,0":[894.8,475.8],"-3,0":[150.2,473.0],"-4,1":[88.1,579.8],"-1,2":[518.1,688.6],"0,3":[704.0,796.7],"2,-3":[582.5,153.9],"-2,-3":[90.6,152.6],"-2,-1":[212.0,366.3],"2,-1":[707.0,368.0],"0,-1":[458.3,367.1],"-3,1":[210.5,580.2],"0,2":[642.6,689.1],"-2,3":[454.8,795.6],"-1,-3":[212.6,152.8],"2,-2":[644.7,260.8],"4,-2":[895.1,261.7],"-1,-1":[334.8,366.7],"1,0":[644.2,474.7],"1,2":[767.8,689.6],"-4,2":[148.1,687.1],"-1,3":[579.1,796.1],"3,-3":[707.0,154.3],"-1,-2":[273.7,259.7],"1,-2":[520.5,260.4],"2,0":[769.2,475.2],"-1,1":[457.0,581.1],"-2,1":[333.4,580.7],"2,2":[893.6,690.2],"-4,3":[208.0,794.6],"4,-3":[832.1,154.7],"1,-3":[458.6,153.5],"3,-1":[832.2,368.4],"-2,0":[272.7,473.4],"1,1":[706.0,582.1],"-2,2":[394.1,688.1],"-3,2":[270.8,687.6],"1,3":[829.6,797.3],"-2,4":[515.5,903.3],"-2,-2":[151.3,259.4],"0,-2":[396.8,260.0],"1,-1":[582.3,367.5],"-1,0":[395.9,473.8],"0,1":[581.2,581.6],"2,1":[831.4,582.6],"-3,3":[331.1,795.1],"0,0":[519.7,474.3]};
// 盤面画像上の座標：1マスずつ画像の六角形に合わせて補正した値
export const PX = (q, r) => HEXPX[`${q},${r}`] || [520 + 121.8 * (q + r / 2), 471 + 106.5 * r];

const hexes = {}, ids = Object.keys(BOARD.terrain);
const tun = new Set(BOARD.tunnels.map(([q, r]) => `${q},${r}`)), enc = new Set(BOARD.enc.map(([q, r]) => `${q},${r}`));
for (const id of ids) {
  const [q, r] = id.split(',').map(Number);
  hexes[id] = { id, q, r, terrain: BOARD.terrain[id], tunnel: tun.has(id), encounter: enc.has(id), nb: [], river: [], home: null };
}
for (const h of Object.values(hexes)) h.nb = DIRS.map(([a, b]) => `${h.q + a},${h.r + b}`).filter((i) => hexes[i]);
for (const [a, b] of BOARD.rivers) {
  const ia = a.join(','), ib = b.join(',');
  if (hexes[ia] && hexes[ib]) { hexes[ia].river.push(ib); hexes[ib].river.push(ia); }
}
const BASE = ['nordic', 'rusviet', 'crimea', 'saxony', 'polania', 'togawa', 'albion'];
const homes = {}, startAdj = {};
for (const f of BASE) {
  const hm = BOARD.homes[f], [x, y] = hm.px, hid = `home:${f}`;
  const r = (y - 468) / 105, q = (x - 520) / 121.2 - r / 2;
  hexes[hid] = { id: hid, q, r, terrain: 'home', tunnel: false, encounter: false, nb: [...hm.adj], river: [], home: f, px: [x, y] };
  hm.adj.forEach((n) => hexes[n].nb.push(hid));
  homes[f] = hid; startAdj[f] = [...hm.adj];
}
export const MAP = { ids: [...ids, ...BASE.map((f) => homes[f])], hexes, homes, startAdj };
export const isRiver = (a, b) => hexes[a].river.includes(b);
