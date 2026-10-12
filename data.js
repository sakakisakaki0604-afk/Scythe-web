// 大鎌戦役 ルールデータ（基本セット）。
// 出所: Scythe_Card_Data_Research_v0.3.docx。verified が true 以外のものは本番で有効化しない。
// 値は資料の転記であり、公式ルールブック／マット画像との最終照合が必要なものは verified:'partial'。

export const BASE_FACTIONS = {
  nordic:  { name: '北方王国', en: 'Nordic',  power: 4, combatCards: 1, ability: 'Swim', verified: 'doc' },
  crimea:  { name: 'クリミア・ハン国', en: 'Crimea',  power: 3, combatCards: 3, ability: 'Coercion', verified: 'doc' },
  saxony:  { name: 'ザクセン帝国', en: 'Saxony', power: 1, combatCards: 4, ability: 'Dominate', verified: 'doc' },
  polania: { name: 'ポーラニア共和国', en: 'Polania', power: 2, combatCards: 2, ability: 'Meander', verified: 'doc' },
  rusviet: { name: 'ロスヴィエト連邦', en: 'Rusviet', power: 3, combatCards: 4, ability: 'Relentless', verified: 'doc' },
};

// 下段アクション: [費用(基本), 減額可能数, コイン報酬]
export const BASE_MATS = {
  industrial:   { name: '工業主義', popularity: 2, coins: 4, objectives: 2,
    columns: ['inspire+monument', 'produce+mill', 'move+mine', 'trade+armory'],
    lower: { upgrade: [3, 1, 3], deploy: [3, 2, 2], build: [3, 1, 1], enlist: [4, 2, 0] }, verified: 'partial' },
  engineering:  { name: '技術者', popularity: 2, coins: 5, objectives: 2,
    columns: ['produce+mill', 'trade+armory', 'inspire+monument', 'move+mine'],
    lower: { upgrade: [3, 1, 2], deploy: [4, 2, 0], build: [3, 2, 3], enlist: [3, 1, 1] }, verified: 'partial' },
  patriotic:    { name: '愛国者', popularity: 2, coins: 6, objectives: 2,
    columns: ['move+mine', 'inspire+monument', 'trade+armory', 'produce+mill'],
    lower: { upgrade: [2, 0, 1], deploy: [4, 3, 3], build: [4, 2, 0], enlist: [3, 1, 2] }, verified: 'partial' },
  mechanical:   { name: '機械論者', popularity: 3, coins: 6, objectives: 2,
    columns: ['trade+armory', 'inspire+monument', 'move+mine', 'produce+mill'],
    lower: { upgrade: [3, 1, 0], deploy: [3, 2, 2], build: [3, 1, 2], enlist: [4, 2, 2] }, verified: 'partial' },
  agricultural: { name: '農業主義', popularity: 4, coins: 7, objectives: 2,
    columns: ['move+mine', 'trade+armory', 'produce+mill', 'inspire+monument'],
    lower: { upgrade: [2, 0, 1], deploy: [4, 2, 0], build: [4, 2, 2], enlist: [3, 2, 3] }, verified: 'partial' },
};

// 公式ルール上の禁止組み合わせ（勢力 → 使えないマット）
export const FORBIDDEN_MATS = {
  rusviet: ['industrial'],
  crimea: ['patriotic'],
};

export function isLegalCombo(factionId, matId) {
  return !(FORBIDDEN_MATS[factionId] || []).includes(matId);
}

// 戦闘カード 42枚
export const COMBAT_DISTRIBUTION = { 2: 16, 3: 12, 4: 8, 5: 6 };

export function buildCombatDeck() {
  const deck = [];
  for (const [v, n] of Object.entries(COMBAT_DISTRIBUTION)) {
    for (let i = 0; i < n; i++) deck.push({ id: `combat_${v}_${String(i + 1).padStart(2, '0')}`, value: Number(v) });
  }
  return deck;
}

// 未入力の台帳。効果は推測で埋めない。入力後に verified:true と出典を設定する。
export const LEDGERS = {
  map:        { label: '盤面（公式盤面画像から読み取り。川の位置は画像からの推定）', expected: 1, entered: 1, verified: false },
  encounters: { label: '遭遇カード#1-74（資料v1.2。非公式仮案を含む／効果未実装の選択肢あり）', expected: 74, entered: 74, verified: false },
  objectives: { label: '目的カード#1-27（資料v1.2。非公式仮案を含む）', expected: 27, entered: 27, verified: false },
  factory:    { label: '工場カード#1-18（付属画像の絵柄からの暫定解釈）', expected: 18, entered: 18, verified: false },
};

export const PLAYER_RANGE = { min: 1, max: 5 }; // 基本セット
export const factoryCandidateCount = (players) => players + 1;

// ---- ゲーム進行用の追加定義 ----
export const MAT_NUMBER = { industrial: 1, engineering: 2, patriotic: 3, mechanical: 4, agricultural: 5 };

// メック能力スロット4つ（ルールブックの並び: Riverwalk → 勢力固有2つ → Speed）。
// 実装済み: speed / riverwalk / camaraderie。それ以外は表示のみ（未実装）。
export const MECH_SLOTS = {
  nordic:  ['riverwalk', 'seaworthy', 'artillery', 'speed'],
  crimea:  ['riverwalk', 'wayfare', 'scout', 'speed'],
  saxony:  ['riverwalk', 'underpass', 'disarm', 'speed'],
  polania: ['riverwalk', 'submerge', 'camaraderie', 'speed'],
  rusviet: ['riverwalk', 'township', 'peoples_army', 'speed'],
};
export const IMPLEMENTED_ABILITIES = ['speed', 'riverwalk', 'camaraderie'];
export const RIVERWALK = {
  nordic: ['forest', 'mountain'], crimea: ['farm', 'tundra'], saxony: ['forest', 'mountain'],
  polania: ['village', 'mountain'], rusviet: ['farm', 'village'],
};
export const ABILITY_NAMES = {
  riverwalk: 'リバーウォーク', speed: 'スピード', camaraderie: '連帯', seaworthy: '航海', artillery: '砲撃',
  wayfare: '道中', scout: '偵察', underpass: '地下道', disarm: '武装解除', submerge: '潜行', township: '町', peoples_army: '人民軍',
};

// 下段アクションの並び（★仮: マット画像との照合まで列0〜3の順に固定）
export const BOTTOM_ORDER = ['upgrade', 'deploy', 'build', 'enlist'];
export const BOTTOM_NAMES = { upgrade: '改良', deploy: '配備', build: '建設', enlist: '徴兵' };
export const BOTTOM_RES = { upgrade: 'oil', deploy: 'metal', build: 'wood', enlist: 'food' };
export const TOP_NAMES = { move: '移動', bolster: '鼓舞', trade: '交易', produce: '生産', factory: '工場' };
export const STRUCT_NAMES = { monument: '記念碑', mill: '製粉所', mine: '鉱山', armory: '兵器庫' };
export const RES_NAMES = { oil: '油', metal: '鉄', wood: '木材', food: '食料' };

// 徴兵の一時ボーナス（各2）と、常時ボーナス（★仮: 下段アクション別）
export const RECRUIT_ONETIME = ['power', 'coins', 'pop', 'card'];
export const RECRUIT_ONGOING = { upgrade: { coins: 1 }, deploy: { power: 1 }, build: { pop: 1 }, enlist: { card: 1 } };

export const topOf = (mat, idx) => BASE_MATS[mat].columns[idx].split('+')[0].replace('inspire', 'bolster');
export const structOf = (mat, idx) => BASE_MATS[mat].columns[idx].split('+')[1];

// ---- 表示用の説明文（資料: 勢力能力・メック能力・プレイヤーマット総覧 v1.0） ----
export const PASSIVE = {
  nordic: ['スイム', 'ワーカーは川を越えて、湖以外の地形へ移動できる。'],
  crimea: ['コアーション', '1手番に1回、戦闘カード1枚を価値に関係なく任意の資源1個の代わりに支払える。'],
  saxony: ['ドミネート', '戦闘勝利の星に上限がなく、目的カード2枚とも達成して星を得られる。'],
  polania: ['メアンダー', '遭遇カード1枚で最大2つの選択肢を順に解決できる。1つ目の利益を2つ目の費用に使える。'],
  rusviet: ['リレントレス', '前の手番と同じ行動マット区画を続けて選べる。'],
};
export const RIVER_TEXT = { forest: '森林', mountain: '山岳', farm: '農地', tundra: 'ツンドラ', village: '村' };
export const ABILITY_TEXT = {
  riverwalk: (f) => `川を越えて${(RIVERWALK[f] || []).map((t) => RIVER_TEXT[t]).join('・')}へ移動できる。`,
  speed: () => 'キャラクターとメックの移動距離が1領土分増える。',
  seaworthy: () => 'キャラクター／メックは湖へ出入りできる（湖に駒・資源は残せない）。【未実装】',
  artillery: () => '戦闘開始時に戦力1を払い、相手の戦力を2下げる（1戦闘1回）。【未実装】',
  wayfare: () => 'キャラクター／メックは自分の本拠地や無人の本拠地へ距離無視で移動できる。【未実装】',
  scout: () => '戦闘開始時、相手の戦闘カードをランダムに1枚奪う。【未実装】',
  underpass: () => '自分が支配する山岳とトンネルを接続先として扱う。【未実装】',
  disarm: () => '自分の鉱山／トンネルでの戦闘開始時、相手の戦力を2下げる。【未実装】',
  submerge: () => 'キャラクター／メックは湖へ出入りでき、湖から湖へも移動できる。【未実装】',
  camaraderie: () => '攻撃側で勝ったとき、敗者のワーカー退却による支持の損失を防ぐ。',
  township: () => '自分が支配する村と工場を隣接として扱う。【未実装】',
  peoples_army: () => '自分のワーカーがいる領土の戦闘で、戦闘カードを1枚多く使える。【未実装】',
};
export const TOP_TEXT = {
  move: '最大2体を移動（またはコイン+1）。キャラ・メックは基本1マス、スピードで+1、改良で+1マス',
  bolster: '1コイン → 戦力+2 か 戦闘カード+1',
  trade: '1コイン → 支持+1 か 資源2個',
  produce: 'ワーカーのいる支配領土で最大2か所を生産（改良で3か所）。各ワーカー1体につき1個',
};
export const BOTTOM_TEXT = {
  upgrade: '改良キューブを移し、コインを減らす', deploy: 'メックを配備し、能力を解放', build: '建物を1つ建てる', enlist: '徴兵トークンを置き、ボーナスを得る',
};

// 改良キューブ: 上段の各アクションにある数（6個）。取ると上段が強化され、下段に置くとコストが下がる。
export const TOP_CUBES = { move: 1, bolster: 2, trade: 2, produce: 1 };

export const STRUCT_TEXT = { monument: '鼓舞のたびに 支持+1', mill: '生産のとき、この領土は+1個', mine: 'トンネルとして使える（移動）', armory: '交易のたびに 戦力+1' };
