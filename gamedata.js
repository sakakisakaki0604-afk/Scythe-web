// ゲーム進行用データ。
// 出所の区分:  [公式] = 公式ルールブックの文章で確認   [資料] = ユーザー提供の調査資料の転記
//              [仮]   = 印刷値が未入力のため仮置き。ルール台帳（RULE_LEDGER）に列挙し、アプリ内に表示する。
import { BASE_FACTIONS, BASE_MATS } from './data.js';

export const RES = ['metal', 'oil', 'food', 'wood'];
export const RES_NAME = { metal: '金属', oil: '油', food: '食料', wood: '木材' };
export const TERRAIN_RES = { mountain: 'metal', tundra: 'oil', farm: 'food', forest: 'wood' }; // [公式]
export const TERRAIN_NAME = { mountain: '山', tundra: 'ツンドラ', farm: '農場', forest: '森', village: '村', lake: '湖', factory: '工場' };

// 列の上段アクションと下段アクションの対応 [仮: 組み合わせは一般的な配置に基づく]
export const BOTTOM_OF = { move: 'upgrade', trade: 'deploy', produce: 'build', bolster: 'enlist' };
export const TOP_OF = { upgrade: 'move', deploy: 'trade', build: 'produce', enlist: 'bolster' };
export const TOP_NAME = { move: '移動／獲得', bolster: '鼓舞', produce: '生産', trade: '交易' };
export const BOTTOM_NAME = { upgrade: '改良', deploy: '配備', build: '建設', enlist: '徴兵', fmove: '工場移動' };
export const BOTTOM_RES = { upgrade: 'oil', deploy: 'metal', build: 'wood', enlist: 'food' }; // [公式]
export const STRUCT_OF_TOP = { bolster: 'monument', produce: 'mill', move: 'mine', trade: 'armory' }; // [公式]
export const STRUCT_NAME = { monument: '記念碑', mill: '製粉所', mine: '鉱山', armory: '兵器庫' };
const COLUMN_TOP = { inspire: 'bolster', produce: 'produce', move: 'move', trade: 'trade' };

export const matColumns = (matId) => BASE_MATS[matId].columns.map((c) => COLUMN_TOP[c.split('+')[0]]);
export const MAT_NUMBER = { industrial: 1, engineering: 2, patriotic: 3, mechanical: 4, agricultural: 5 }; // 先手: 最小番号 [公式]

// 勢力ルール。mechs = 配備順に解放される能力 [仮: 順序は印刷値未確認]
export const FACTION_RULES = {
  nordic:  { seat: 0, ability: 'swim',      mechs: ['riverwalk', 'seaworthy', 'artillery', 'speed'],    riverwalk: ['forest', 'mountain'] },
  rusviet: { seat: 1, ability: 'relentless', mechs: ['riverwalk', 'township', 'peoples_army', 'speed'], riverwalk: ['farm', 'village'] },
  crimea:  { seat: 2, ability: 'coercion',  mechs: ['riverwalk', 'wayfare', 'scout', 'speed'],         riverwalk: ['farm', 'tundra'] },
  saxony:  { seat: 3, ability: 'dominate',  mechs: ['riverwalk', 'underpass', 'disarm', 'speed'],      riverwalk: ['forest', 'mountain'] },
  polania: { seat: 4, ability: 'meander',   mechs: ['riverwalk', 'submerge', 'camaraderie', 'speed'],  riverwalk: ['village', 'mountain'] },
};
export const ABILITY_NAME = {
  riverwalk: '川渡り', speed: '高速移動', seaworthy: '航海', artillery: '砲撃', township: '町', peoples_army: '人民軍',
  wayfare: '旅路(未実装)', scout: '偵察(未実装)', underpass: '地下道', disarm: '武装解除', submerge: '潜水', camaraderie: '連帯',
  swim: '水泳', relentless: '不屈', coercion: '強要', dominate: '支配', meander: '蛇行',
};

// 上段アクションの改良スロット（緑の箱）合計6 [仮: 内訳は印刷値未確認]
export const CUBE_SLOTS = { move: 2, bolster: 1, produce: 1, trade: 2 };
// 生産コスト（コイン）。生産済みワーカー数 0..6 に応じた露出コスト [仮]
export const PRODUCE_COST = [0, 0, 1, 1, 2, 2, 3];
// 徴兵の1回限りボーナス [公式]
export const ENLIST_BONUS = { power: 2, coins: 2, pop: 2, cards: 2 };
export const ENLIST_BONUS_NAME = { power: '戦力+2', coins: 'コイン+2', pop: '人気度+2', cards: '戦闘カード2枚' };
// 徴兵トークンの継続ボーナス(ROB)。隣席に影響するため公開情報のみ [仮]
export const ROB = { upgrade: { power: 1 }, deploy: { pop: 1 }, build: { power: 1 }, enlist: { pop: 1 } };
export const ROB_NAME = { upgrade: '戦力+1', deploy: '人気度+1', build: '戦力+1', enlist: '人気度+1' };

// 終了時得点: 人気度帯ごとの 星／領土／資源2個 あたりのコイン [資料(一般に知られる値)・盤面で要確認]
export const SCORE_TIERS = [
  { max: 6, star: 3, terr: 2, pair: 1, name: '低' },
  { max: 12, star: 4, terr: 3, pair: 2, name: '中' },
  { max: 18, star: 5, terr: 4, pair: 3, name: '高' },
];

// ---- 以下はすべて [仮] カード/タイル。公式のカード面が入ったら差し替える ----
// 遭遇カード: 3選択肢。cost/gain のキー: coins power pop cards metal oil food wood worker
const E = (id, a, b, c) => ({ id, options: [a, b, c] });
export const ENCOUNTERS = [
  E('e01', { cost: { coins: 1 }, gain: { wood: 2 } }, { cost: { wood: 1 }, gain: { power: 2 } }, { cost: { food: 1 }, gain: { pop: 1, coins: 1 } }),
  E('e02', { cost: { oil: 1 }, gain: { coins: 3 } }, { cost: { coins: 2 }, gain: { cards: 2 } }, { cost: { metal: 1 }, gain: { pop: 2 } }),
  E('e03', { cost: { pop: 1 }, gain: { coins: 3 } }, { cost: { food: 2 }, gain: { power: 3 } }, { cost: { coins: 1 }, gain: { metal: 2 } }),
  E('e04', { cost: { coins: 2 }, gain: { worker: 1 } }, { cost: { power: 1 }, gain: { oil: 2 } }, { cost: { wood: 1 }, gain: { food: 2 } }),
  E('e05', { cost: { metal: 1 }, gain: { coins: 2, pop: 1 } }, { cost: { coins: 1 }, gain: { power: 2 } }, { cost: { oil: 1 }, gain: { cards: 1, coins: 1 } }),
  E('e06', { cost: { food: 1 }, gain: { wood: 1, metal: 1 } }, { cost: { power: 2 }, gain: { pop: 2 } }, { cost: { coins: 3 }, gain: { worker: 1, power: 1 } }),
  E('e07', { cost: { wood: 2 }, gain: { coins: 4 } }, { cost: { coins: 1 }, gain: { food: 2 } }, { cost: { pop: 1 }, gain: { power: 3 } }),
  E('e08', { cost: { coins: 1 }, gain: { oil: 2 } }, { cost: { food: 1 }, gain: { pop: 1, power: 1 } }, { cost: { metal: 2 }, gain: { coins: 3, cards: 1 } }),
  E('e09', { cost: { oil: 2 }, gain: { pop: 2, coins: 1 } }, { cost: { coins: 2 }, gain: { metal: 3 } }, { cost: { power: 1 }, gain: { wood: 2 } }),
  E('e10', { cost: { cards: 1 }, gain: { coins: 3 } }, { cost: { wood: 1 }, gain: { cards: 2 } }, { cost: { food: 2 }, gain: { worker: 1 } }),
  E('e11', { cost: { coins: 1 }, gain: { pop: 1, power: 1 } }, { cost: { oil: 1 }, gain: { food: 2, wood: 1 } }, { cost: { metal: 1 }, gain: { coins: 2, power: 1 } }),
  E('e12', { cost: { power: 1 }, gain: { coins: 2, cards: 1 } }, { cost: { food: 1 }, gain: { metal: 2 } }, { cost: { coins: 2 }, gain: { pop: 2 } }),
];
// 目的カード: 条件は rules.js の objectiveMet() で判定
export const OBJECTIVES = [
  { id: 'o01', text: '領土を6つ以上支配している' },
  { id: 'o02', text: '戦力が10以上' },
  { id: 'o03', text: '人気度が12以上' },
  { id: 'o04', text: '支配する領土の資源トークンが8個以上' },
  { id: 'o05', text: 'ワーカーが盤上に6体以上' },
  { id: 'o06', text: 'メックを2体以上配備している' },
  { id: 'o07', text: '建物を3つ以上建設している' },
  { id: 'o08', text: '改良を4回以上行っている' },
  { id: 'o09', text: 'コインを15枚以上持っている' },
  { id: 'o10', text: '星を3つ以上獲得している（目的の星を除く）' },
  { id: 'o11', text: '工場を支配している' },
  { id: 'o12', text: '湖に隣接する領土を2つ以上支配している' },
];
// 工場カード: 5つ目の区画。上段=下記、下段=工場移動(1体を最大2回移動) [公式] ／ 上段の内容は [仮]
export const FACTORY_CARDS = [
  { id: 'f01', name: '造幣所', top: { cost: {}, gain: { coins: 3 } } },
  { id: 'f02', name: '兵舎', top: { cost: { coins: 1 }, gain: { power: 3 } } },
  { id: 'f03', name: '広報局', top: { cost: { coins: 1 }, gain: { pop: 2 } } },
  { id: 'f04', name: '武器庫', top: { cost: { coins: 1 }, gain: { cards: 2 } } },
  { id: 'f05', name: '製鉄所', top: { cost: {}, gain: { metal: 2 } } },
  { id: 'f06', name: '製油所', top: { cost: {}, gain: { oil: 2 } } },
  { id: 'f07', name: '穀物庫', top: { cost: {}, gain: { food: 2 } } },
  { id: 'f08', name: '製材所', top: { cost: {}, gain: { wood: 2 } } },
  { id: 'f09', name: '補給所', top: { cost: { coins: 1 }, gain: { metal: 1, oil: 1, food: 1, wood: 1 } } },
  { id: 'f10', name: '機械工房', top: { cost: { metal: 1 }, gain: { power: 2, coins: 1 } } },
  { id: 'f11', name: '診療所', top: { cost: { food: 1 }, gain: { pop: 1, power: 1 } } },
  { id: 'f12', name: '書記局', top: { cost: {}, gain: { coins: 1, pop: 1 } } },
];
// 建物ボーナスタイル（終了時、条件を満たす自分の建物1つにつきコイン）[仮]
export const STRUCTURE_TILES = [
  { id: 't1', text: '湖に隣接する建物 1つにつき 3コイン', coins: 3, test: 'lake' },
  { id: 't2', text: 'トンネルにある建物 1つにつき 4コイン', coins: 4, test: 'tunnel' },
  { id: 't3', text: '村にある建物 1つにつき 3コイン', coins: 3, test: 'village' },
];

export const RULE_LEDGER = [
  { s: '公式', t: '手番: 前回と違う区画を選び、上段→下段の順で行う。ラスヴィエトは同じ区画を連続で選べる（工場カードを除く）' },
  { s: '公式', t: '星10種・6個で終了、戦闘星は最大2・目的星は最大1（ザクソンは無制限）' },
  { s: '公式', t: '戦闘: 戦力ダイヤルと戦闘カードを秘密に決め同時公開、同点は攻撃側勝利、双方がダイヤル分の戦力を支払う、敗者は撤退' },
  { s: '公式', t: '終了時得点: コイン＋人気度帯別の星・領土・資源2個あたり。工場は領土3つ分。同点時の順位決定も公式の順' },
  { s: 'ユーザー指定', t: '下段アクションだけの実行は不可（上段を実行した後のみ下段を実行できる）' },
  { s: '仮', t: 'マップ（地形・川・トンネル・遭遇位置・本拠地）は仮の盤面。公式盤面データ未入力' },
  { s: '仮', t: '遭遇・目的・工場の各カードは仮カード。公式のカード面が入るまで効果は本物と異なる' },
  { s: '仮', t: 'マットの上段強化内訳・生産コスト・徴兵の継続ボーナス・メック能力の解放順は仮の数値' },
  { s: '仮', t: '建物ボーナスタイルは仮。終了時得点の人気度帯別コイン値は盤面の印刷値で要確認' },
  { s: '仮', t: '戦闘カードは各プレイヤーの個人山札に分配（Spark構成で秘密を守るための簡易処理）。引く順序の分布が公式と異なる' },
  { s: '未実装', t: '偵察(クリミア)・旅路(クリミア)・湖での輸送制限・終了ターンの移動巻き戻し・目的の「ターン終了時のみ」条件' },
];
export { BASE_FACTIONS, BASE_MATS };
