// public/js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, initializeAuth, browserSessionPersistence, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  doc as doc2,
  getDoc as getDoc2,
  setDoc as setDoc2,
  onSnapshot,
  runTransaction as runTransaction2,
  serverTimestamp,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// public/js/firebase-config.js
var firebaseConfig = {
  apiKey: "AIzaSyAto_hzADdh7BLZWoZoreZIbSI5xHQ1dIA",
  authDomain: "scythe-game.firebaseapp.com",
  projectId: "scythe-game",
  storageBucket: "scythe-game.firebasestorage.app",
  messagingSenderId: "1087411065179",
  appId: "1:1087411065179:web:be0e9e1309425dd96b8a7e"
};

// public/js/engine/data.js
var BASE_FACTIONS = {
  nordic: { name: "\u5317\u65B9\u738B\u56FD", en: "Nordic", power: 4, combatCards: 1, ability: "Swim", verified: "doc" },
  crimea: { name: "\u30AF\u30EA\u30DF\u30A2\u30FB\u30CF\u30F3\u56FD", en: "Crimea", power: 3, combatCards: 3, ability: "Coercion", verified: "doc" },
  saxony: { name: "\u30B6\u30AF\u30BB\u30F3\u5E1D\u56FD", en: "Saxony", power: 1, combatCards: 4, ability: "Dominate", verified: "doc" },
  polania: { name: "\u30DD\u30FC\u30E9\u30CB\u30A2\u5171\u548C\u56FD", en: "Polania", power: 2, combatCards: 2, ability: "Meander", verified: "doc" },
  rusviet: { name: "\u30ED\u30B9\u30F4\u30A3\u30A8\u30C8\u9023\u90A6", en: "Rusviet", power: 3, combatCards: 4, ability: "Relentless", verified: "doc" },
  // 拡張「彼方よりの侵攻」。初期戦力・戦闘カード枚数は資料に記載がなく【仮値】（公式値が分かったらここだけ直す）
  albion: { name: "\u30A2\u30EB\u30D3\u30AA\u30F3\u6C0F\u65CF", en: "Albion", power: 3, combatCards: 2, ability: "Exalt", verified: "placeholder", ext: "invaders" },
  togawa: { name: "\u52D8\u89E3\u7531\u5C0F\u8DEF\u5E55\u5E9C", en: "Togawa", power: 3, combatCards: 3, ability: "Maifuku", verified: "placeholder", ext: "invaders" }
};
var BASE_MATS = {
  industrial: {
    name: "\u5DE5\u696D\u4E3B\u7FA9",
    popularity: 2,
    coins: 4,
    objectives: 2,
    columns: ["inspire+monument", "produce+mill", "move+mine", "trade+armory"],
    lower: { upgrade: [3, 1, 3], deploy: [3, 2, 2], build: [3, 1, 1], enlist: [4, 2, 0] },
    verified: "partial"
  },
  engineering: {
    name: "\u6280\u8853\u8005",
    popularity: 2,
    coins: 5,
    objectives: 2,
    columns: ["produce+mill", "trade+armory", "inspire+monument", "move+mine"],
    lower: { upgrade: [3, 1, 2], deploy: [4, 2, 0], build: [3, 2, 3], enlist: [3, 1, 1] },
    verified: "partial"
  },
  patriotic: {
    name: "\u611B\u56FD\u8005",
    popularity: 2,
    coins: 6,
    objectives: 2,
    columns: ["move+mine", "inspire+monument", "trade+armory", "produce+mill"],
    lower: { upgrade: [2, 0, 1], deploy: [4, 3, 3], build: [4, 2, 0], enlist: [3, 1, 2] },
    verified: "partial"
  },
  mechanical: {
    name: "\u6A5F\u68B0\u8AD6\u8005",
    popularity: 3,
    coins: 6,
    objectives: 2,
    columns: ["trade+armory", "inspire+monument", "move+mine", "produce+mill"],
    lower: { upgrade: [3, 1, 0], deploy: [3, 2, 2], build: [3, 1, 2], enlist: [4, 2, 2] },
    verified: "partial"
  },
  agricultural: {
    name: "\u8FB2\u696D\u4E3B\u7FA9",
    popularity: 4,
    coins: 7,
    objectives: 2,
    columns: ["move+mine", "trade+armory", "produce+mill", "inspire+monument"],
    lower: { upgrade: [2, 0, 1], deploy: [4, 2, 0], build: [4, 2, 2], enlist: [3, 2, 3] },
    verified: "partial"
  },
  // 拡張「彼方よりの侵攻」の追加マット（実物写真より転記：Militant=2a / Innovative=3a）
  militant: {
    name: "\u8ECD\u56FD\u4E3B\u7FA9\uFF082a\uFF09",
    popularity: 3,
    coins: 4,
    objectives: 2,
    ext: "invaders",
    columns: ["inspire+monument", "move+mine", "produce+mill", "trade+armory"],
    lower: { upgrade: [3, 2, 0], deploy: [3, 1, 3], build: [4, 1, 1], enlist: [3, 2, 2] },
    verified: "photo"
  },
  innovative: {
    name: "\u9769\u65B0\u4E3B\u7FA9\uFF083a\uFF09",
    popularity: 3,
    coins: 5,
    objectives: 2,
    ext: "invaders",
    columns: ["trade+armory", "produce+mill", "inspire+monument", "move+mine"],
    lower: { upgrade: [3, 0, 3], deploy: [3, 1, 1], build: [4, 3, 2], enlist: [3, 2, 0] },
    verified: "photo"
  }
};
var FORBIDDEN_MATS = {
  rusviet: ["industrial"],
  crimea: ["patriotic"]
};
function isLegalCombo(factionId, matId) {
  return !(FORBIDDEN_MATS[factionId] || []).includes(matId);
}
var LEDGERS = {
  map: { label: "\u76E4\u9762\uFF08\u516C\u5F0F\u76E4\u9762\u753B\u50CF\u304B\u3089\u8AAD\u307F\u53D6\u308A\u3002\u5DDD\u306E\u4F4D\u7F6E\u306F\u753B\u50CF\u304B\u3089\u306E\u63A8\u5B9A\uFF09", expected: 1, entered: 1, verified: false },
  encounters: { label: "\u906D\u9047\u30AB\u30FC\u30C9#1-74\uFF08\u8CC7\u6599v1.2\u3002\u975E\u516C\u5F0F\u4EEE\u6848\u3092\u542B\u3080\uFF0F\u52B9\u679C\u672A\u5B9F\u88C5\u306E\u9078\u629E\u80A2\u3042\u308A\uFF09", expected: 74, entered: 74, verified: false },
  objectives: { label: "\u76EE\u7684\u30AB\u30FC\u30C9#1-27\uFF08\u8CC7\u6599v1.2\u3002\u975E\u516C\u5F0F\u4EEE\u6848\u3092\u542B\u3080\uFF09", expected: 27, entered: 27, verified: false },
  factory: { label: "\u5DE5\u5834\u30AB\u30FC\u30C9#1-18\uFF08\u4ED8\u5C5E\u753B\u50CF\u306E\u7D75\u67C4\u304B\u3089\u306E\u66AB\u5B9A\u89E3\u91C8\uFF09", expected: 18, entered: 18, verified: false }
};
var PLAYER_RANGE = { min: 1, max: 7 };
var MAT_NUMBER = { industrial: 1, engineering: 2, militant: 2.5, patriotic: 3, innovative: 3.5, mechanical: 4, agricultural: 5 };
var MECH_SLOTS = {
  nordic: ["riverwalk", "seaworthy", "artillery", "speed"],
  crimea: ["riverwalk", "wayfare", "scout", "speed"],
  saxony: ["riverwalk", "underpass", "disarm", "speed"],
  polania: ["riverwalk", "submerge", "camaraderie", "speed"],
  rusviet: ["riverwalk", "township", "peoples_army", "speed"],
  togawa: ["toka", "suiton", "ronin", "shinobi"],
  albion: ["burrow", "sword", "shield", "rally"]
};
var IMPLEMENTED_ABILITIES = ["burrow", "sword", "shield", "rally", "speed", "riverwalk", "camaraderie", "seaworthy", "submerge", "artillery", "wayfare", "underpass", "disarm", "township", "peoples_army", "toka", "suiton", "ronin", "shinobi"];
var RIVERWALK = {
  nordic: ["forest", "mountain"],
  crimea: ["farm", "tundra"],
  saxony: ["forest", "mountain"],
  polania: ["village", "mountain"],
  rusviet: ["farm", "village"]
};
var ABILITY_NAMES = {
  burrow: "\u6F5C\u4F0F",
  sword: "\u5263",
  shield: "\u76FE",
  rally: "\u96C6\u5408",
  toka: "\u6E21\u6CB3",
  suiton: "\u6C34\u9041",
  ronin: "\u6D6A\u4EBA",
  shinobi: "\u5FCD\u3073",
  riverwalk: "\u30EA\u30D0\u30FC\u30A6\u30A9\u30FC\u30AF",
  speed: "\u30B9\u30D4\u30FC\u30C9",
  camaraderie: "\u9023\u5E2F",
  seaworthy: "\u822A\u6D77",
  artillery: "\u7832\u6483",
  wayfare: "\u9053\u4E2D",
  scout: "\u5075\u5BDF",
  underpass: "\u5730\u4E0B\u9053",
  disarm: "\u6B66\u88C5\u89E3\u9664",
  submerge: "\u6F5C\u884C",
  township: "\u753A",
  peoples_army: "\u4EBA\u6C11\u8ECD"
};
var BOTTOM_ORDER = ["upgrade", "deploy", "build", "enlist"];
var BOTTOM_NAMES = { upgrade: "\u6539\u826F", deploy: "\u914D\u5099", build: "\u5EFA\u8A2D", enlist: "\u5FB4\u5175" };
var BOTTOM_RES = { upgrade: "oil", deploy: "metal", build: "wood", enlist: "food" };
var TOP_NAMES = { move: "\u79FB\u52D5", bolster: "\u9F13\u821E", trade: "\u4EA4\u6613", produce: "\u751F\u7523", factory: "\u5DE5\u5834" };
var STRUCT_NAMES = { monument: "\u8A18\u5FF5\u7891", mill: "\u88FD\u7C89\u6240", mine: "\u9271\u5C71", armory: "\u5175\u5668\u5EAB" };
var RES_NAMES = { oil: "\u6CB9", metal: "\u9244", wood: "\u6728\u6750", food: "\u98DF\u6599" };
var RECRUIT_ONETIME = ["power", "coins", "pop", "card"];
var RECRUIT_ONGOING = { upgrade: { power: 1 }, deploy: { coins: 1 }, build: { pop: 1 }, enlist: { card: 1 } };
var topOf = (mat, idx) => BASE_MATS[mat].columns[idx].split("+")[0].replace("inspire", "bolster");
var structOf = (mat, idx) => BASE_MATS[mat].columns[idx].split("+")[1];
var PASSIVE = {
  nordic: ["\u30B9\u30A4\u30E0", "\u30EF\u30FC\u30AB\u30FC\u306F\u5DDD\u3092\u8D8A\u3048\u3066\u3001\u6E56\u4EE5\u5916\u306E\u5730\u5F62\u3078\u79FB\u52D5\u3067\u304D\u308B\u3002"],
  crimea: ["\u30B3\u30A2\u30FC\u30B7\u30E7\u30F3", "1\u624B\u756A\u306B1\u56DE\u3001\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3092\u4FA1\u5024\u306B\u95A2\u4FC2\u306A\u304F\u4EFB\u610F\u306E\u8CC7\u6E901\u500B\u306E\u4EE3\u308F\u308A\u306B\u652F\u6255\u3048\u308B\u3002"],
  saxony: ["\u30C9\u30DF\u30CD\u30FC\u30C8", "\u6226\u95D8\u52DD\u5229\u306E\u661F\u306B\u4E0A\u9650\u304C\u306A\u304F\u3001\u76EE\u7684\u30AB\u30FC\u30C92\u679A\u3068\u3082\u9054\u6210\u3057\u3066\u661F\u3092\u5F97\u3089\u308C\u308B\u3002"],
  polania: ["\u30E1\u30A2\u30F3\u30C0\u30FC", "\u906D\u9047\u30AB\u30FC\u30C91\u679A\u3067\u6700\u59272\u3064\u306E\u9078\u629E\u80A2\u3092\u9806\u306B\u89E3\u6C7A\u3067\u304D\u308B\u30021\u3064\u76EE\u306E\u5229\u76CA\u30922\u3064\u76EE\u306E\u8CBB\u7528\u306B\u4F7F\u3048\u308B\u3002"],
  rusviet: ["\u30EA\u30EC\u30F3\u30C8\u30EC\u30B9", "\u524D\u306E\u624B\u756A\u3068\u540C\u3058\u884C\u52D5\u30DE\u30C3\u30C8\u533A\u753B\u3092\u7D9A\u3051\u3066\u9078\u3079\u308B\u3002"],
  albion: ["\u6607\u63DA\uFF08\u65D7\uFF09", "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u306E\u79FB\u52D5\u5F8C\uFF08\u6226\u95D8\u30FB\u906D\u9047\u306E\u89E3\u6C7A\u5F8C\uFF09\u3001\u3044\u308B\u9818\u571F\u306B\u65D7\u30921\u3064\u7F6E\u3051\u308B\uFF084\u3064\u307E\u3067\u30FB\u52D5\u304B\u305B\u306A\u3044\uFF09\u3002\u7D42\u4E86\u6642\u3001\u305D\u306E\u9818\u571F\u3092\u652F\u914D\u3057\u3066\u3044\u3066\u81EA\u5206\u306E\u672C\u62E0\u5730\u306B\u96A3\u63A5\u3057\u3066\u3044\u306A\u3051\u308C\u3070\u3001\u65D71\u3064\u306B\u3064\u304D\u9818\u571F1\u3064\u5206\u3068\u3057\u3066\u6570\u3048\u308B\u3002"],
  togawa: ["\u57CB\u4F0F\uFF08\u7F60\uFF09", "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u306E\u79FB\u52D5\u5F8C\uFF08\u6226\u95D8\u30FB\u906D\u9047\u306E\u89E3\u6C7A\u5F8C\uFF09\u3001\u3044\u308B\u9818\u571F\u306B\u7F60\u30C8\u30FC\u30AF\u30F3\u30921\u3064\u7F6E\u3051\u308B\uFF08\u76F8\u624B\u306E\u5EFA\u7269\u304C\u3042\u308B\u9818\u571F\u306B\u3082\u53EF\uFF09\u3002\u6B66\u88C5\u4E2D\u306E\u7F60\u306F\u7D42\u4E86\u6642\u306B\u305D\u306E\u9818\u571F\u3092\u652F\u914D\u6271\u3044\u3002\u76F8\u624B\u30E6\u30CB\u30C3\u30C8\u304C\u5165\u308B\u3068\u79FB\u52D5\u304C\u6B62\u307E\u308A\u3001\u7F60\u306E\u30DA\u30CA\u30EB\u30C6\u30A3\u3092\u53D7\u3051\u3066\u7F60\u306F\u6B66\u88C5\u89E3\u9664\u3055\u308C\u308B\u3002"]
};
var TRAP_PENALTIES = { pop: "\u652F\u6301-2", power: "\u6226\u529B-3", coins: "\u30B3\u30A4\u30F3-4", cards: "\u6226\u95D8\u30AB\u30FC\u30C92\u679A\u3092\u6368\u3066\u308B" };
var RIVER_TEXT = { forest: "\u68EE\u6797", mountain: "\u5C71\u5CB3", farm: "\u8FB2\u5730", tundra: "\u30C4\u30F3\u30C9\u30E9", village: "\u6751" };
var ABILITY_TEXT = {
  riverwalk: (f) => `\u5DDD\u3092\u8D8A\u3048\u3066${(RIVERWALK[f] || []).map((t) => RIVER_TEXT[t]).join("\u30FB")}\u3078\u79FB\u52D5\u3067\u304D\u308B\u3002`,
  speed: () => "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3068\u30E1\u30C3\u30AF\u306E\u79FB\u52D5\u8DDD\u96E2\u304C1\u9818\u571F\u5206\u5897\u3048\u308B\u3002",
  seaworthy: () => "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\uFF0F\u30E1\u30C3\u30AF\u306F\u6E56\u3078\u51FA\u5165\u308A\u3067\u304D\u308B\uFF08\u6E56\u306B\u99D2\u30FB\u8CC7\u6E90\u306F\u6B8B\u305B\u306A\u3044\uFF09\u3002",
  artillery: () => "\u6226\u95D8\u958B\u59CB\u6642\u306B\u6226\u529B1\u3092\u6255\u3044\u3001\u76F8\u624B\u306E\u6226\u529B\u30922\u4E0B\u3052\u308B\uFF081\u6226\u95D81\u56DE\uFF09\u3002",
  wayfare: () => "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\uFF0F\u30E1\u30C3\u30AF\u306F\u81EA\u5206\u306E\u672C\u62E0\u5730\u3084\u7121\u4EBA\u306E\u672C\u62E0\u5730\u3078\u8DDD\u96E2\u7121\u8996\u3067\u79FB\u52D5\u3067\u304D\u308B\u3002",
  scout: () => "\u6226\u95D8\u958B\u59CB\u6642\u306B\u6226\u95D8\u30AB\u30FC\u30C9\u30921\u679A\u5F97\u308B\uFF08\u5C71\u672D\u304B\u3089\u3002\u76F8\u624B\u306E\u624B\u672D\u306F\u4ED6\u4EBA\u304B\u3089\u64CD\u4F5C\u3067\u304D\u306A\u3044\u4ED5\u69D8\u306E\u305F\u3081\u3001\u596A\u3046\u306E\u3067\u306F\u306A\u304F\u5C71\u672D\u304B\u3089\u5F97\u308B\uFF09\u3002",
  underpass: () => "\u81EA\u5206\u304C\u652F\u914D\u3059\u308B\u5C71\u5CB3\u3068\u30C8\u30F3\u30CD\u30EB\u3092\u63A5\u7D9A\u5148\u3068\u3057\u3066\u6271\u3046\u3002",
  disarm: () => "\u81EA\u5206\u306E\u9271\u5C71\uFF0F\u30C8\u30F3\u30CD\u30EB\u3067\u306E\u6226\u95D8\u958B\u59CB\u6642\u3001\u76F8\u624B\u306E\u6226\u529B\u30922\u4E0B\u3052\u308B\u3002",
  submerge: () => "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\uFF0F\u30E1\u30C3\u30AF\u306F\u6E56\u3078\u51FA\u5165\u308A\u3067\u304D\u3001\u6E56\u304B\u3089\u6E56\u3078\u3082\u79FB\u52D5\u3067\u304D\u308B\u3002",
  burrow: () => "\u3010\u6F5C\u4F0F\u3011\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\uFF0F\u30E1\u30C3\u30AF\u306F\u3001\u30C8\u30F3\u30CD\u30EB\u9818\u571F\uFF08\u81EA\u5206\u306E\u9271\u5C71\u306E\u9818\u571F\u3092\u542B\u3080\uFF09\u3078\u51FA\u5165\u308A\u3059\u308B\u3068\u304D\u3001\u96A3\u63A5\u3059\u308B\u5DDD\u3092\u8D8A\u3048\u3089\u308C\u308B\u3002",
  sword: () => "\u3010\u5263\u3011\u653B\u6483\u5074\u306E\u3068\u304D\u3001\u6226\u95D8\u958B\u59CB\u6642\u306B\u9632\u5FA1\u5074\u306E\u6226\u529B\u30922\u6E1B\u3089\u3059\uFF081\u6226\u95D81\u56DE\uFF09\u3002",
  shield: () => "\u3010\u76FE\u3011\u9632\u5FA1\u5074\u306E\u3068\u304D\u3001\u6226\u95D8\u958B\u59CB\u6642\u306B\u81EA\u5206\u306E\u6226\u529B+2\uFF081\u6226\u95D81\u56DE\uFF09\u3002",
  rally: () => "\u3010\u96C6\u5408\u3011\u79FB\u52D5\u30A2\u30AF\u30B7\u30E7\u30F3\u3067\u3001\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\uFF0F\u30E1\u30C3\u30AF\u3092\u81EA\u5206\u306E\u30EF\u30FC\u30AB\u30FC\u304B\u65D7\u304C\u3042\u308B\u4EFB\u610F\u306E\u9818\u571F\u3078\u8DDD\u96E2\u7121\u8996\u3067\u79FB\u52D5\u3067\u304D\u308B\u3002",
  toka: () => "\u3010\u6E21\u6CB3\u30111\u56DE\u306E\u79FB\u52D5\u30A2\u30AF\u30B7\u30E7\u30F3\u4E2D\u3001\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u304B\u30E1\u30C3\u30AF1\u4F53\u304C\u5DDD\u30921\u672C\u8D8A\u3048\u3089\u308C\u308B\u3002",
  suiton: () => "\u3010\u6C34\u9041\u3011\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\uFF0F\u30E1\u30C3\u30AF\u306F\u6E56\u3078\u51FA\u5165\u308A\u3067\u304D\u308B\uFF08\u6E56\u3067\u306F\u5EFA\u8A2D\u30FB\u914D\u5099\u4E0D\u53EF\uFF09\u3002\u6E56\u306E\u6226\u95D8\u3067\u6226\u95D8\u30AB\u30FC\u30C9+1\u679A\u306F\u3010\u672A\u5B9F\u88C5\u3011\u3002",
  ronin: () => "\u3010\u6D6A\u4EBA\u3011\u6226\u95D8\u306B\u53C2\u52A0\u3059\u308B\u81EA\u5206\u306E\u30E6\u30CB\u30C3\u30C8\u304C\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\uFF0F\u30E1\u30C3\u30AF1\u4F53\u3060\u3051\uFF08\u30EF\u30FC\u30AB\u30FC\u7121\u3057\uFF09\u306A\u3089\u3001\u6226\u95D8\u524D\u306B\u6226\u529B+2\u3002",
  shinobi: () => "\u3010\u5FCD\u3073\u3011\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\uFF0F\u30E1\u30C3\u30AF\u306F\u7F60\u30C8\u30FC\u30AF\u30F3\u306E\u3042\u308B\u9818\u571F\u3078\u8DDD\u96E2\u7121\u8996\u3067\u79FB\u52D5\u3067\u304D\u308B\u3002\u6B66\u88C5\u89E3\u9664\u6E08\u307F\u306E\u81EA\u5206\u306E\u7F60\u306E\u4E0A\u3067\u6B62\u307E\u308C\u3070\u518D\u6B66\u88C5\u3059\u308B\u3002",
  camaraderie: () => "\u653B\u6483\u5074\u3067\u52DD\u3063\u305F\u3068\u304D\u3001\u6557\u8005\u306E\u30EF\u30FC\u30AB\u30FC\u9000\u5374\u306B\u3088\u308B\u652F\u6301\u306E\u640D\u5931\u3092\u9632\u3050\u3002",
  township: () => "\u81EA\u5206\u304C\u652F\u914D\u3059\u308B\u6751\u3068\u5DE5\u5834\u3092\u96A3\u63A5\u3068\u3057\u3066\u6271\u3046\u3002",
  peoples_army: () => "\u81EA\u5206\u306E\u30EF\u30FC\u30AB\u30FC\u304C\u3044\u308B\u9818\u571F\u306E\u6226\u95D8\u3067\u3001\u6226\u95D8\u30AB\u30FC\u30C9\u30921\u679A\u591A\u304F\u4F7F\u3048\u308B\u3002"
};
var TOP_TEXT = {
  move: "\u6700\u59272\u4F53\u3092\u79FB\u52D5\uFF08\u307E\u305F\u306F\u30B3\u30A4\u30F3+1\uFF09\u3002\u30AD\u30E3\u30E9\u30FB\u30E1\u30C3\u30AF\u306F\u57FA\u672C1\u30DE\u30B9\u3001\u30B9\u30D4\u30FC\u30C9\u3067+1\u3001\u6539\u826F\u3067+1\u30DE\u30B9",
  bolster: "1\u30B3\u30A4\u30F3 \u2192 \u6226\u529B+2 \u304B \u6226\u95D8\u30AB\u30FC\u30C9+1",
  trade: "1\u30B3\u30A4\u30F3 \u2192 \u652F\u6301+1 \u304B \u8CC7\u6E902\u500B",
  produce: "\u30EF\u30FC\u30AB\u30FC\u306E\u3044\u308B\u652F\u914D\u9818\u571F\u3067\u6700\u59272\u304B\u6240\u3092\u751F\u7523\uFF08\u6539\u826F\u30673\u304B\u6240\uFF09\u3002\u5404\u30EF\u30FC\u30AB\u30FC1\u4F53\u306B\u3064\u304D1\u500B"
};
var BOTTOM_TEXT = {
  upgrade: "\u6539\u826F\u30AD\u30E5\u30FC\u30D6\u3092\u79FB\u3057\u3001\u30B3\u30A4\u30F3\u3092\u6E1B\u3089\u3059",
  deploy: "\u30E1\u30C3\u30AF\u3092\u914D\u5099\u3057\u3001\u80FD\u529B\u3092\u89E3\u653E",
  build: "\u5EFA\u7269\u30921\u3064\u5EFA\u3066\u308B",
  enlist: "\u5FB4\u5175\u30C8\u30FC\u30AF\u30F3\u3092\u7F6E\u304D\u3001\u30DC\u30FC\u30CA\u30B9\u3092\u5F97\u308B"
};
var TOP_CUBES = { move: 1, bolster: 2, trade: 2, produce: 1 };
var STRUCT_TEXT = { monument: "\u9F13\u821E\u306E\u305F\u3073\u306B \u652F\u6301+1", mill: "\u751F\u7523\u306E\u3068\u304D\u3001\u3053\u306E\u9818\u571F\u306F+1\u500B", mine: "\u30C8\u30F3\u30CD\u30EB\u3068\u3057\u3066\u4F7F\u3048\u308B\uFF08\u79FB\u52D5\uFF09", armory: "\u4EA4\u6613\u306E\u305F\u3073\u306B \u6226\u529B+1" };
function produceCost(workersOnBoard) {
  const c = {};
  if (workersOnBoard >= 4) c.pop = 1;
  if (workersOnBoard >= 6) c.power = 1;
  if (workersOnBoard >= 8) c.coins = 1;
  return c;
}

// public/js/bgm.js
var VIDEO = "M3Gz4ih2HNE";
var TRACKS = [
  ["turning the tables", 0],
  ["The Destiny Reverser", 79],
  ["The Lights of Revival", 303],
  ["Heartbeat of Reversal", 482],
  ["will to stand up", 657],
  ["Revived fighting spirit", 767],
  ["Counterattack of Heaven's Fate", 875],
  ["furious attack", 1049],
  ["Overture of Counterattack", 1121],
  ["the recovery of lost ground", 1280],
  ["Rebellion out of Despair", 1422],
  ["Inversion melody", 1501],
  ["Capsizing Fate", 1588],
  ["Beyond Adversity", 1648],
  ["Overturned winners and losers", 1830],
  ["Reverse of light", 1993],
  ["Turn of Revenge", 2108],
  ["Reversal to Hope", 2232],
  ["Backwash to Victory", 2402],
  ["whirlwind of victory", 2573],
  ["Striking Back from Ruin", 2695],
  ["Last counter", 2813],
  ["Rebuilding Destiny", 2982],
  ["The Last Counterattack", 3177],
  ["reversal blow", 3426],
  ["Aftermath of Victory", 3762],
  ["continue walking", 3840]
];
var KEY = "scythe_bgm";
var load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};
var save = (o2) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(o2));
  } catch {
  }
};
function initBgm() {
  const cfg = { on: false, vol: 40, ...load() };
  let player = null, ready = false, cur = 0, timer = null;
  const box = document.createElement("div");
  box.id = "bgm";
  box.innerHTML = `<button id="bgmT" class="ghost sm" title="BGM">\u266A BGM</button>
    <div id="bgmP" hidden>
      <div class="row"><button id="bgmPlay" class="sm">\u25B6 \u518D\u751F</button><button id="bgmPrev" class="ghost sm">\u23EE</button><button id="bgmNext" class="ghost sm">\u23ED</button></div>
      <select id="bgmSel">${TRACKS.map((t, i) => `<option value="${i}">${i + 1}. ${t[0]}</option>`).join("")}</select>
      <label class="mute">\u97F3\u91CF <input id="bgmVol" type="range" min="0" max="100" value="${cfg.vol}"></label>
      <div class="mute" id="bgmNow"></div><div id="bgmYT"></div>
    </div>`;
  document.body.append(box);
  const $ = (id) => box.querySelector("#" + id);
  const now = () => {
    $("bgmNow").textContent = `\u266A ${cur + 1}. ${TRACKS[cur][0]}`;
    $("bgmSel").value = String(cur);
  };
  const trackAt = (s) => {
    let i = 0;
    TRACKS.forEach((t, k) => {
      if (s >= t[1]) i = k;
    });
    return i;
  };
  function create() {
    if (player) return;
    const mk = () => {
      player = new window.YT.Player("bgmYT", { height: "90", width: "160", videoId: VIDEO, playerVars: { controls: 0, rel: 0, playsinline: 1 }, events: {
        onReady: () => {
          ready = true;
          player.setVolume(cfg.vol);
        },
        onStateChange: (e) => {
          $("bgmPlay").textContent = e.data === 1 ? "\u23F8 \u505C\u6B62" : "\u25B6 \u518D\u751F";
        }
      } });
    };
    if (window.YT?.Player) mk();
    else {
      window.onYouTubeIframeAPIReady = mk;
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.append(s);
    }
    timer = setInterval(() => {
      if (ready && player.getPlayerState?.() === 1) {
        const i = trackAt(player.getCurrentTime());
        if (i !== cur) {
          cur = i;
          now();
        }
      }
    }, 1e3);
  }
  const play = (i) => {
    create();
    const go = () => {
      if (i != null) {
        cur = i;
        player.seekTo(TRACKS[i][1], true);
      }
      player.playVideo();
      cfg.on = true;
      save(cfg);
      now();
    };
    if (ready) go();
    else {
      const w = setInterval(() => {
        if (ready) {
          clearInterval(w);
          go();
        }
      }, 200);
    }
  };
  $("bgmT").onclick = () => {
    $("bgmP").hidden = !$("bgmP").hidden;
  };
  $("bgmPlay").onclick = () => {
    if (ready && player.getPlayerState() === 1) {
      player.pauseVideo();
      cfg.on = false;
      save(cfg);
    } else play();
  };
  $("bgmSel").onchange = (e) => play(+e.target.value);
  $("bgmPrev").onclick = () => play((cur + TRACKS.length - 1) % TRACKS.length);
  $("bgmNext").onclick = () => play((cur + 1) % TRACKS.length);
  $("bgmVol").oninput = (e) => {
    cfg.vol = +e.target.value;
    save(cfg);
    if (ready) player.setVolume(cfg.vol);
  };
  now();
  if (cfg.on) window.addEventListener("pointerdown", () => play(), { once: true });
}

// public/js/engine/cards-data.js
var CARDS = { "enc": [{ "id": "enc_01", "no": 1, "official": true, "options": [{ "text": "\u30B3\u30A4\u30F3+2\u3001\u652F\u6301+1\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "food": 4 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "build" }] }] }, { "id": "enc_02", "no": 2, "official": true, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "card": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "wood": 4 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "enlist" }] }] }, { "id": "enc_03", "no": 3, "official": true, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u98DF\u65993\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "food": 3, "worker": 1 } }, { "text": "\u652F\u63013\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "pop": 3 }, "free": [{ "k": "deploy" }] }] }, { "id": "enc_04", "no": 4, "official": true, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "enlist" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_05", "no": 5, "official": true, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F34\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "coins": 4 }, "free": [{ "k": "deploy" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65992\u3068\u92442\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 2, "food": 2 } }] }, { "id": "enc_06", "no": 6, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 2 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_07", "no": 7, "official": true, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 2 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_08", "no": 8, "official": true, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "oil": 4 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "enlist" }] }] }, { "id": "enc_09", "no": 9, "official": true, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_10", "no": 10, "official": true, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F34\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "coins": 4 }, "free": [{ "k": "deploy" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u30B3\u30A4\u30F32\u3068\u4EFB\u610F\u306E\u8CC7\u6E902\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "coins": 2 }, "free": [{ "k": "anyRes", "n": 2 }] }] }, { "id": "enc_11", "no": 11, "official": true, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u98DF\u65993\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "food": 3, "worker": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "build" }] }] }, { "id": "enc_12", "no": 12, "official": false, "options": [{ "text": "\u6728\u67502\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "wood": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u6728\u67502\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "wood": 2, "worker": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "wood": 4 } }] }, { "id": "enc_13", "no": 13, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_14", "no": 14, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u98DF\u65992\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "card": 1, "food": 2 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "upgrade" }] }] }, { "id": "enc_15", "no": 15, "official": true, "options": [{ "text": "\u652F\u63012\u3092\u5F97\u308B\u3002", "gain": { "pop": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E90\u3092\u5408\u8A083\u500B\u5F97\u308B\u3002", "cost": { "coins": 2 }, "free": [{ "k": "anyRes", "n": 3 }] }, { "text": "\u652F\u63013\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E90\u3092\u5408\u8A085\u500B\u5F97\u308B\u3002", "cost": { "pop": 3 }, "free": [{ "k": "anyRes", "n": 5 }] }] }, { "id": "enc_16", "no": 16, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "enlist" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E903\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "anyRes", "n": 3 }] }] }, { "id": "enc_17", "no": 17, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "deploy" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "food": 4 } }] }, { "id": "enc_18", "no": 18, "official": false, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "card": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E903\u500B\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "free": [{ "k": "anyRes", "n": 3 }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "enlist" }] }] }, { "id": "enc_19", "no": 19, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F34\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 4 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_20", "no": 20, "official": true, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "card": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u652F\u63013\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "pop": 3 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "wood": 4 } }] }, { "id": "enc_21", "no": 21, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "build" }] }] }, { "id": "enc_22", "no": 22, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "wood": 4 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "enlist" }] }] }, { "id": "enc_23", "no": 23, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u92442\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "metal": 2, "worker": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_24", "no": 24, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F34\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "coins": 4 }, "free": [{ "k": "deploy" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "food": 4 } }] }, { "id": "enc_25", "no": 25, "official": false, "options": [{ "text": "\u6728\u67502\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "wood": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "enlist" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E904\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "anyRes", "n": 4 }] }] }, { "id": "enc_26", "no": 26, "official": false, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "card": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 2 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_27", "no": 27, "official": false, "options": [{ "text": "\u6728\u67502\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "wood": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6728\u67502\u3068\u92442\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 2, "wood": 2 } }] }, { "id": "enc_28", "no": 28, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u98DF\u65992\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "food": 2, "worker": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "food": 4 } }] }, { "id": "enc_29", "no": 29, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 2 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "food": 4 } }] }, { "id": "enc_30", "no": 30, "official": false, "options": [{ "text": "\u6728\u67502\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "wood": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "wood": 4 } }] }, { "id": "enc_31", "no": 31, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "enlist" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_32", "no": 32, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F34\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "coins": 4 }, "free": [{ "k": "deploy" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_33", "no": 33, "official": false, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "card": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "oil": 4 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "build" }] }] }, { "id": "enc_34", "no": 34, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "upgrade" }] }] }, { "id": "enc_35", "no": 35, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u98DF\u65993\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "food": 3, "worker": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65992\u3068\u92442\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 2, "food": 2 } }] }, { "id": "enc_36", "no": 36, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "card": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "enlist" }] }] }, { "id": "enc_37", "no": 37, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E903\u500B\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "free": [{ "k": "anyRes", "n": 3 }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "upgrade" }] }] }, { "id": "enc_38", "no": 38, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "deploy" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65993\u3068\u92442\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 2, "food": 3 } }] }, { "id": "enc_39", "no": 39, "official": true, "options": [{ "text": "\u98DF\u65992\u3092\u652F\u6255\u3044\u3001\u652F\u63011\u3092\u5F97\u308B\u3002", "cost": { "food": 2 }, "gain": { "pop": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "food": 4 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6226\u529B5\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "power": 5 } }] }, { "id": "enc_40", "no": 40, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 2 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "food": 4 } }] }, { "id": "enc_41", "no": 41, "official": false, "options": [{ "text": "\u6728\u67502\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "wood": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "wood": 4 } }] }, { "id": "enc_42", "no": 42, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63013\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E905\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 3 }, "free": [{ "k": "anyRes", "n": 5 }] }] }, { "id": "enc_43", "no": 43, "official": false, "options": [{ "text": "\u652F\u63011\u3092\u5F97\u3066\u3001\u3053\u306E\u30AB\u30FC\u30C9\u4E0A\u306B\u5C02\u7528\u306E\u6CB9\u30AB\u30A6\u30F3\u30BF\u30FC1\u500B\u3092\u7F6E\u304F\u3002", "gain": { "pop": 1 }, "unsupported": true }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "oil": 4 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u30AB\u30FC\u30C9\u4E0A\u30AB\u30A6\u30F3\u30BF\u30FC3\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "unsupported": true }] }, { "id": "enc_44", "no": 44, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u81EA\u5206\u306E\u30E1\u30C3\u30AF1\u4F53\u3092\u5408\u6CD5\u306A\u96A3\u63A5\u9818\u571F\u3078\u79FB\u3059\uFF08\u901A\u5E38\u306E\u79FB\u52D5\u30A2\u30AF\u30B7\u30E7\u30F3\u6271\u3044\u306B\u3057\u306A\u3044\uFF09\u3002", "cost": { "coins": 2 }, "unsupported": true }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_45", "no": 45, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "enlist" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "pop": 2 }, "free": [{ "k": "upgrade" }] }] }, { "id": "enc_46", "no": 46, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u6728\u67502\u3092\u652F\u6255\u3044\u3001\u76EE\u7684\u30AB\u30FC\u30C9\u30921\u679A\u6368\u3066\u3066\u65B0\u3057\u3044\u76EE\u7684\u30AB\u30FC\u30C9\u30921\u679A\u5F15\u304F\u3002", "cost": { "wood": 2 }, "unsupported": true }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E904\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "anyRes", "n": 4 }] }] }, { "id": "enc_47", "no": 47, "official": true, "options": [{ "text": "\u3053\u306E\u9078\u629E\u80A2\u3092\u79D8\u5BC6\u88CF\u306B\u4FDD\u6301\u3057\u3001\u6307\u5B9A\u6761\u4EF6\u9054\u6210\u6642\u306B\u661F\u3092\u5F97\u308B\u3002", "unsupported": true }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u76F8\u624B\u306E\u76EE\u7684\u30AB\u30FC\u30C9\u306B\u95A2\u3059\u308B\u52B9\u679C\u3092\u89E3\u6C7A\u3059\u308B\u3002", "cost": { "coins": 2 }, "unsupported": true }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E902\u500B\u3068\u6226\u529B2\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "power": 2 }, "free": [{ "k": "anyRes", "n": 2 }] }] }, { "id": "enc_48", "no": 48, "official": true, "options": [{ "text": "\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "worker": 1 } }, { "text": "\u30B3\u30A4\u30F31\u3092\u652F\u6255\u3044\u3001\u3053\u306E\u9818\u571F\u3068\u96A3\u63A5\u9818\u571F\u306B\u92441\u500B\u305A\u3064\u3092\u7F6E\u304F\u3002", "cost": { "coins": 1 }, "gain": { "metal": 1 } }, { "text": "\u652F\u63011\u3092\u652F\u6255\u3044\u3001\u6226\u529B3\u3092\u5F97\u308B\u3002\u81EA\u5206\u306E\u6226\u529B\u304C\u5168\u5BFE\u6226\u76F8\u624B\u3092\u4E0A\u56DE\u308C\u3070\u4EFB\u610F\u306E\u8CC7\u6E902\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 1 }, "gain": { "power": 3 }, "free": [{ "k": "anyRes", "n": 2 }], "unsupported": true }] }, { "id": "enc_49", "no": 49, "official": true, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C9\u5C71\u672D\u306E\u6700\u4E0A\u6BB5\u3092\u516C\u958B\u3057\u3066\u6368\u3066\u3001\u305D\u306E\u5024\u3068\u540C\u3058\u6226\u529B\u3092\u5F97\u308B\u3002", "unsupported": true }, { "text": "\u6B21\u306E\u81EA\u5206\u306E\u30BF\u30FC\u30F3\u3092\u98DB\u3070\u3057\u3001\u652F\u63015\u3092\u5F97\u308B\u3002", "gain": { "pop": 5 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6751\u9818\u571F1\u3064\u306E\u30E6\u30CB\u30C3\u30C8\u3092\u5404\u672C\u62E0\u5730\u3078\u623B\u3059\u3002", "cost": { "pop": 2 }, "unsupported": true }] }, { "id": "enc_50", "no": 50, "official": true, "options": [{ "text": "\u652F\u63011\u3092\u5F97\u3066\u3001\u5DE5\u5834\u306B\u96A3\u63A5\u3059\u308B\u7A7A\u306E\u9678\u5730\u306B\u906D\u9047\u30C8\u30FC\u30AF\u30F3\u3092\u7F6E\u304F\u3002", "gain": { "pop": 1 } }, { "text": "\u30B3\u30A4\u30F31\u3092\u652F\u6255\u3044\u3001\u906D\u9047\u7B49\u306E\u30C8\u30FC\u30AF\u30F31\u500B\u3092\u5225\u306E\u7A7A\u306E\u9678\u5730\u3078\u79FB\u3059\u3002", "cost": { "coins": 1 }, "unsupported": true }, { "text": "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3092\u4EFB\u610F\u306E\u7A7A\u306E\u9678\u5730\u3078\u914D\u7F6E\u3059\u308B\u3002", "unsupported": true }] }, { "id": "enc_51", "no": 51, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u98DF\u65992\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "food": 2, "worker": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6226\u529B4\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "power": 4 } }] }, { "id": "enc_52", "no": 52, "official": false, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "card": 1 } }, { "text": "\u50242\u4EE5\u4E0A\u306E\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3092\u6368\u3066\u3001\u30B3\u30A4\u30F33\u3068\u8CC7\u6E902\u500B\u3092\u5F97\u308B\u3002", "gain": { "coins": 3, "card": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "wood": 4 } }] }, { "id": "enc_53", "no": 53, "official": true, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C9\u30923\u679A\u5F15\u304D\u30011\u679A\u3092\u6368\u3066\u308B\u3002", "gain": { "card": 2 } }, { "text": "\u30B3\u30A4\u30F36\u3092\u652F\u6255\u3044\u3001\u307E\u3060\u30D5\u30A1\u30AF\u30C8\u30EA\u30FC\u30AB\u30FC\u30C9\u3092\u6301\u3063\u3066\u3044\u306A\u3051\u308C\u3070\u5019\u88DC\u304B\u3089\u30E9\u30F3\u30C0\u30E0\u306B1\u679A\u5F97\u308B\u3002", "cost": { "coins": 6 }, "unsupported": true }, { "text": "\u6226\u529B9\u3092\u652F\u6255\u3044\u3001\u6226\u95D8\u306E\u661F1\u3064\u3092\u7F6E\u304F\u3002", "cost": { "power": 9 }, "unsupported": true }] }, { "id": "enc_54", "no": 54, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u81EA\u5206\u306E\u30E1\u30C3\u30AF1\u4F53\u3092\u81EA\u5206\u306E\u9271\u5C71\uFF0F\u30C8\u30F3\u30CD\u30EB\u3078\u79FB\u3059\u3002", "cost": { "coins": 3 }, "unsupported": true }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_55", "no": 55, "official": false, "options": [{ "text": "\u30EF\u30FC\u30AB\u30FC1\u4F53\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "worker": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_56", "no": 56, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E904\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "anyRes", "n": 4 }] }] }, { "id": "enc_57", "no": 57, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u6226\u95D8\u30AB\u30FC\u30C9\u30922\u679A\u5F15\u304F\u30022\u679A\u76EE\u306F\u6B21\u306E\u81EA\u5206\u306E\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B\u5F15\u304F\u3002", "gain": { "card": 2 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_58", "no": 58, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "enlist" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "food": 4 } }] }, { "id": "enc_59", "no": 59, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u81EA\u5206\u306E\u7F60\u30C8\u30FC\u30AF\u30F3\u3092\u7A7A\u306E\u9678\u57301\u304B\u6240\u306B\u7F6E\u304F\uFF08\u6240\u6709\u3057\u3066\u3044\u308B\u5834\u5408\uFF09\u3002", "cost": { "pop": 2 }, "unsupported": true }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "coins": 3 }, "gain": { "metal": 4 } }] }, { "id": "enc_60", "no": 60, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 2 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u81EA\u5206\u306E\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3092\u96A3\u63A5\u3059\u308B\u7A7A\u306E\u9678\u5730\u3078\u914D\u7F6E\u3059\u308B\u3002", "cost": { "pop": 2 }, "unsupported": true }] }, { "id": "enc_61", "no": 61, "official": false, "options": [{ "text": "\u6728\u67502\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "wood": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "wood": 4 } }] }, { "id": "enc_62", "no": 62, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "coins": 2 }, "gain": { "metal": 4 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "build" }] }] }, { "id": "enc_63", "no": 63, "official": false, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "card": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5FB4\u51751\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "enlist" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E904\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "anyRes", "n": 4 }] }] }, { "id": "enc_64", "no": 64, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u30B3\u30A4\u30F34\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "coins": 4 }, "free": [{ "k": "deploy" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "food": 4 } }] }, { "id": "enc_65", "no": 65, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u9078\u3093\u3060\u76F8\u624B1\u4EBA\u306F\u6B21\u306E\u81EA\u5206\u306E\u30BF\u30FC\u30F3\u958B\u59CB\u307E\u3067\u3042\u306A\u305F\u3092\u653B\u6483\u5BFE\u8C61\u306B\u3067\u304D\u306A\u3044\u3002", "cost": { "coins": 3 }, "unsupported": true }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_66", "no": 66, "official": false, "options": [{ "text": "\u6728\u67502\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "wood": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6728\u67504\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "wood": 4 } }] }, { "id": "enc_67", "no": 67, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u652F\u914D\u9818\u571F\u306B\u30EF\u30FC\u30AB\u30FC1\u4F53\u3092\u914D\u7F6E\u3059\u308B\u3002\u901A\u5E38\u79FB\u52D5\u3068\u306F\u6271\u308F\u306A\u3044\u3002", "cost": { "coins": 2 }, "gain": { "worker": 1 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_68", "no": 68, "official": false, "options": [{ "text": "\u6CB92\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "oil": 2 } }, { "text": "\u30B3\u30A4\u30F32\u3092\u652F\u6255\u3044\u3001\u3053\u306E\u30AB\u30FC\u30C9\u4E0A\u306E\u5C02\u7528\u6CB9\u30AB\u30A6\u30F3\u30BF\u30FC\u30922\u500B\u5F97\u308B\u3002", "cost": { "coins": 2 }, "unsupported": true }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u6CB94\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "oil": 4 } }] }, { "id": "enc_69", "no": 69, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3046\u3002\u6B21\u306E\u81EA\u5206\u306E\u30BF\u30FC\u30F3\u306B\u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u30921\u56DE\u3060\u3051\u8FFD\u52A0\u3067\u5B9F\u884C\u3067\u304D\u308B\uFF08\u4E0B\u6BB5\u5831\u916C\u306A\u3057\uFF09\u3002", "gain": { "coins": 3 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E904\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "anyRes", "n": 4 }] }] }, { "id": "enc_70", "no": 70, "official": false, "options": [{ "text": "\u98DF\u65992\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "food": 2 } }, { "text": "\u81EA\u5206\u304C\u652F\u914D\u3059\u308B\u9818\u571F\u304B\u3089\u98DF\u65993\u500B\u307E\u3067\u3092\u3001\u5225\u306E\u81EA\u5206\u306E\u652F\u914D\u9818\u571F1\u304B\u6240\u3078\u79FB\u3059\u3002", "gain": { "food": 3 } }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u98DF\u65994\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "food": 4 } }] }, { "id": "enc_71", "no": 71, "official": false, "options": [{ "text": "\u6728\u67502\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "wood": 2 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u5EFA\u72691\u3064\u3092\u5EFA\u8A2D\u3059\u308B\u3002", "cost": { "coins": 3 }, "free": [{ "k": "build" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_72", "no": 72, "official": false, "options": [{ "text": "\u30B3\u30A4\u30F32\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "coins": 2, "pop": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u30B2\u30FC\u30E0\u304B\u3089\u30D5\u30A1\u30AF\u30C8\u30EA\u30FC\u30AB\u30FC\u30C91\u679A\u3092\u9664\u5916\u3059\u308B\uFF08\u5BFE\u8C61\u30FB\u5236\u7D04\u306F\u5F8C\u65E5\u78BA\u8A8D\uFF09\u3002", "cost": { "coins": 3 }, "unsupported": true }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E904\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "anyRes", "n": 4 }] }] }, { "id": "enc_73", "no": 73, "official": false, "options": [{ "text": "\u92442\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "metal": 2 } }, { "text": "\u30B3\u30A4\u30F34\u3092\u652F\u6255\u3044\u3001\u30E1\u30C3\u30AF1\u4F53\u3092\u914D\u5099\u3059\u308B\u3002", "cost": { "coins": 4 }, "free": [{ "k": "deploy" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u92444\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "gain": { "metal": 4 } }] }, { "id": "enc_74", "no": 74, "official": false, "options": [{ "text": "\u6226\u95D8\u30AB\u30FC\u30C91\u679A\u3068\u652F\u63011\u3092\u5F97\u308B\u3002", "gain": { "pop": 1, "card": 1 } }, { "text": "\u30B3\u30A4\u30F33\u3092\u652F\u6255\u3044\u3001\u6539\u826F1\u56DE\u3092\u884C\u3046\u3002", "cost": { "coins": 3 }, "free": [{ "k": "upgrade" }] }, { "text": "\u652F\u63012\u3092\u652F\u6255\u3044\u3001\u4EFB\u610F\u306E\u8CC7\u6E904\u500B\u3092\u5F97\u308B\u3002", "cost": { "pop": 2 }, "free": [{ "k": "anyRes", "n": 4 }] }] }], "obj": [{ "id": "obj_01", "no": 1, "name": "Higher Ground Advantage", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u5C71\u5CB3\u9818\u571F\u30923\u3064\u4EE5\u4E0A\u652F\u914D\u3057\u3066\u3044\u308B\u3002", "official": true }, { "id": "obj_02", "no": 2, "name": "\u98DF\u6599\u5099\u84C4", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u98DF\u6599\u30926\u500B\u4EE5\u4E0A\u4FDD\u6301\u3057\u3001\u8FB2\u5834\u30921\u9818\u571F\u4EE5\u4E0A\u652F\u914D\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_03", "no": 3, "name": "\u6CB9\u7530\u7D4C\u55B6", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u6CB9\u30925\u500B\u4EE5\u4E0A\u4FDD\u6301\u3057\u3001\u30C4\u30F3\u30C9\u30E9\u30922\u9818\u571F\u4EE5\u4E0A\u652F\u914D\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_04", "no": 4, "name": "\u9244\u52A0\u5DE5", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u9244\u30925\u500B\u4EE5\u4E0A\u4FDD\u6301\u3057\u3001\u30E1\u30C3\u30AF\u30921\u4F53\u4EE5\u4E0A\u914D\u5099\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_05", "no": 5, "name": "\u5546\u696D\u7DB2", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u30B3\u30A4\u30F3\u309210\u4EE5\u4E0A\u4FDD\u6301\u3057\u3001\u6751\u30922\u9818\u571F\u4EE5\u4E0A\u652F\u914D\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_06", "no": 6, "name": "\u52B4\u50CD\u529B\u306E\u62E1\u5927", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u30EF\u30FC\u30AB\u30FC\u30926\u4F53\u4EE5\u4E0A\u76E4\u9762\u306B\u914D\u7F6E\u3057\u3001\u8FB2\u5834\u30921\u9818\u571F\u4EE5\u4E0A\u652F\u914D\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_07", "no": 7, "name": "\u6280\u8853\u8005\u306E\u8A87\u308A", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u6280\u8853\u30AD\u30E5\u30FC\u30D6\u30925\u500B\u4EE5\u4E0A\u53D6\u308A\u9664\u3044\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_08", "no": 8, "name": "\u69CB\u9020\u7269\u7DB2", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u5EFA\u7269\u30923\u3064\u4EE5\u4E0A\u5EFA\u8A2D\u3057\u3001\u68EE\u30922\u9818\u571F\u4EE5\u4E0A\u652F\u914D\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_09", "no": 9, "name": "\u8ECD\u5099\u306E\u5099\u84C4", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u6226\u529B\u304C12\u4EE5\u4E0A\u3067\u3001\u30E1\u30C3\u30AF\u30921\u4F53\u4EE5\u4E0A\u914D\u5099\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_10", "no": 10, "name": "\u8CC7\u6E90\u306E\u5206\u6563", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u6728\u6750\u30FB\u9244\u30FB\u6CB9\u30FB\u98DF\u6599\u306E\u3046\u30613\u7A2E\u985E\u4EE5\u4E0A\u3092\u54042\u500B\u4EE5\u4E0A\u4FDD\u6301\u3059\u308B\u3002", "official": false }, { "id": "obj_11", "no": 11, "name": "Population Advantage", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u6751\u30923\u9818\u571F\u4EE5\u4E0A\u652F\u914D\u3057\u3066\u3044\u308B\u3002", "official": true }, { "id": "obj_12", "no": 12, "name": "\u63A1\u6398\u652F\u914D", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u5C71\u5CB3\u30922\u9818\u571F\u4EE5\u4E0A\u652F\u914D\u3057\u3001\u9244\u30924\u500B\u4EE5\u4E0A\u4FDD\u6301\u3059\u308B\u3002", "official": false }, { "id": "obj_13", "no": 13, "name": "\u751F\u7523\u529B", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u30EF\u30FC\u30AB\u30FC\u304C\u914D\u7F6E\u3055\u308C\u305F\u8CC7\u6E90\u751F\u7523\u5730\u5F62\u30923\u7A2E\u985E\u4EE5\u4E0A\u652F\u914D\u3059\u308B\u3002", "official": false }, { "id": "obj_14", "no": 14, "name": "\u5FB4\u5175\u306E\u9023\u643A", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u5FB4\u5175\u6E08\u307F\u306E\u7D99\u7D9A\u30DC\u30FC\u30CA\u30B9\u30922\u3064\u4EE5\u4E0A\u7372\u5F97\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_15", "no": 15, "name": "\u5DE5\u5834\u9032\u51FA", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u5DE5\u5834\u3092\u652F\u914D\u3057\u3001\u30E1\u30C3\u30AF\u30921\u4F53\u4EE5\u4E0A\u914D\u5099\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_16", "no": 16, "name": "A Wolf Among the Sheep", "text": "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3001\u30E1\u30C3\u30AF1\u4F53\u3001\u30EF\u30FC\u30AB\u30FC1\u4F53\u304C\u540C\u3058\u652F\u914D\u9818\u571F\u306B\u3044\u3066\u3001\u8CC7\u6E90\u30C8\u30FC\u30AF\u30F3\u304C\u5408\u8A085\u500B\u4EE5\u4E0A\u3042\u308B\u3002", "official": false }, { "id": "obj_17", "no": 17, "name": "\u6A5F\u68B0\u5316\u90E8\u968A", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u30E1\u30C3\u30AF\u30923\u4F53\u4EE5\u4E0A\u914D\u5099\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_18", "no": 18, "name": "\u4EA4\u6613\u306E\u84C4\u3048", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u30B3\u30A4\u30F3\u30927\u4EE5\u4E0A\u4FDD\u6301\u3057\u3001\u4EFB\u610F\u306E\u8CC7\u6E90\u3092\u5408\u8A088\u500B\u4EE5\u4E0A\u4FDD\u6301\u3059\u308B\u3002", "official": false }, { "id": "obj_19", "no": 19, "name": "\u5EFA\u7BC9\u5BB6", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u5EFA\u7269\u30924\u3064\u5EFA\u8A2D\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_20", "no": 20, "name": "\u9818\u571F\u306E\u5E83\u304C\u308A", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u672C\u62E0\u5730\u3092\u9664\u304F\u9818\u571F\u30928\u3064\u4EE5\u4E0A\u652F\u914D\u3057\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_21", "no": 21, "name": "\u4EBA\u6C17\u306E\u6307\u5C0E\u8005", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u652F\u6301\u304C13\u4EE5\u4E0A\u3067\u3001\u5FB4\u5175\u6E08\u307F\u306E\u7D99\u7D9A\u30DC\u30FC\u30CA\u30B9\u304C1\u3064\u4EE5\u4E0A\u3042\u308B\u3002", "official": false }, { "id": "obj_22", "no": 22, "name": "\u8907\u5408\u751F\u7523", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u98DF\u6599\u30FB\u6728\u6750\u30FB\u9244\u30FB\u6CB9\u3092\u305D\u308C\u305E\u308C2\u500B\u4EE5\u4E0A\u4FDD\u6301\u3059\u308B\u3002", "official": false }, { "id": "obj_23", "no": 23, "name": "\u524D\u7DDA\u306E\u5099\u3048", "text": "\u30BF\u30FC\u30F3\u7D42\u4E86\u6642\u3001\u81EA\u5206\u306E\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u304C\u672C\u62E0\u5730\u4EE5\u5916\u306E\u9818\u571F\u306B\u3044\u3066\u3001\u6226\u95D8\u30AB\u30FC\u30C9\u30923\u679A\u4EE5\u4E0A\u6301\u3063\u3066\u3044\u308B\u3002", "official": false }, { "id": "obj_24", "no": 24, "name": "Establish a Human Shield", "text": "\u5DE5\u5834\u306B\u96A3\u63A5\u3059\u308B\u9818\u571F\u306B\u30EF\u30FC\u30AB\u30FC\u30925\u4F53\u4EE5\u4E0A\u914D\u7F6E\u3057\u3066\u3044\u308B\u3002", "official": true }, { "id": "obj_25", "no": 25, "name": "Become a Despised Warmonger", "text": "\u652F\u63013\u4EE5\u4E0B\u3001\u6226\u529B13\u4EE5\u4E0A\u3001\u30E1\u30C3\u30AF2\u4F53\u4EE5\u4E0A\u3092\u540C\u6642\u306B\u6E80\u305F\u3059\u3002", "official": true }, { "id": "obj_26", "no": 26, "name": "Diversify Production", "text": "\u30EF\u30FC\u30AB\u30FC\u304C\u914D\u7F6E\u3055\u308C\u305F\u8CC7\u6E90\u751F\u7523\u5730\u5F62\u30924\u7A2E\u985E\u4EE5\u4E0A\u652F\u914D\u3059\u308B\u3002", "official": false }, { "id": "obj_27", "no": 27, "name": "Build Local Infrastructure", "text": "\u5EFA\u7269\u30923\u3064\u4EE5\u4E0A\u5EFA\u8A2D\u3057\u3001\u305D\u306E\u5EFA\u7269\u306E\u3044\u305A\u308C\u3082\u672C\u62E0\u5730\u306B\u96A3\u63A5\u3057\u3066\u3044\u306A\u3044\u3002", "official": true }] };

// public/js/engine/placeholder.js
var E = (name, a, b, c) => ({ name, verified: false, options: [a, b, c] });
var o = (cost, gain2) => ({ cost, gain: gain2 });
var ENCOUNTERS = [
  E("\u65C5\u306E\u5546\u4EBA", o({}, { coins: 2 }), o({ coins: 1 }, { food: 2 }), o({ coins: 2 }, { metal: 2 })),
  E("\u53E4\u3044\u7960", o({}, { pop: 1 }), o({ coins: 1 }, { pop: 2 }), o({ food: 1 }, { power: 2 })),
  E("\u5EC3\u5751", o({}, { metal: 1 }), o({ food: 1 }, { metal: 3 }), o({ coins: 2 }, { oil: 2 })),
  E("\u8131\u8D70\u5175", o({}, { power: 2 }), o({ coins: 2 }, { card: 1 }), o({ pop: 1 }, { coins: 3 })),
  E("\u5D50\u306E\u591C", o({}, { wood: 2 }), o({ food: 1 }, { power: 3 }), o({ power: 1 }, { pop: 2 })),
  E("\u8FB2\u592B\u306E\u983C\u307F", o({}, { food: 2 }), o({ food: 2 }, { pop: 2 }), o({ coins: 1 }, { worker: 1 })),
  E("\u935B\u51B6\u5E2B", o({}, { metal: 1, wood: 1 }), o({ metal: 2 }, { power: 3 }), o({ metal: 1 }, { card: 1 })),
  E("\u6D41\u308C\u8005\u306E\u5175", o({}, { card: 1 }), o({ coins: 1 }, { card: 2 }), o({ coins: 3 }, { power: 4 })),
  E("\u6CB9\u7530\u306E\u5642", o({}, { oil: 1 }), o({ coins: 1 }, { oil: 3 }), o({ oil: 1 }, { coins: 4 })),
  E("\u6751\u306E\u796D\u308A", o({}, { pop: 1 }), o({ food: 1 }, { pop: 2, coins: 1 }), o({ coins: 2 }, { pop: 3 })),
  E("\u68EE\u306E\u96A0\u8005", o({}, { wood: 1 }), o({ wood: 1 }, { power: 2 }), o({ wood: 2 }, { pop: 2 })),
  E("\u56FD\u5883\u306E\u691C\u554F", o({}, { coins: 1 }), o({ pop: 1 }, { coins: 4 }), o({ power: 2 }, { coins: 5 })),
  E("\u96E3\u6C11", o({}, { pop: 1 }), o({ food: 2 }, { worker: 1 }), o({ coins: 2 }, { worker: 1, pop: 1 })),
  E("\u5BC6\u8F38\u4EBA", o({}, { coins: 2 }), o({ coins: 2 }, { oil: 1, metal: 1, wood: 1, food: 1 }), o({ pop: 1 }, { coins: 3, power: 1 })),
  E("\u53E4\u6226\u5834", o({}, { power: 1 }), o({ metal: 1 }, { power: 3 }), o({ power: 1 }, { card: 2 })),
  E("\u898B\u5F35\u308A\u53F0", o({}, { power: 2 }), o({ wood: 1 }, { card: 1, power: 1 }), o({ coins: 1 }, { pop: 1, power: 1 })),
  E("\u6E56\u306E\u6F01\u5E2B", o({}, { food: 1 }), o({ coins: 1 }, { food: 3 }), o({ food: 1 }, { coins: 2 })),
  E("\u541F\u904A\u8A69\u4EBA", o({}, { pop: 1 }), o({ coins: 1 }, { pop: 2 }), o({ coins: 3 }, { pop: 3, power: 1 })),
  E("\u5D29\u308C\u305F\u6A4B", o({}, { wood: 2 }), o({ wood: 1 }, { coins: 3 }), o({ wood: 2 }, { pop: 2 })),
  E("\u6A5F\u68B0\u306E\u6B8B\u9AB8", o({}, { metal: 2 }), o({ metal: 1 }, { oil: 2 }), o({ metal: 2 }, { power: 3, coins: 1 })),
  E("\u8CED\u535A\u5E2B", o({}, { coins: 1 }), o({ coins: 2 }, { coins: 5 }), o({ pop: 1 }, { coins: 4 })),
  E("\u5FB4\u5175\u5B98", o({}, { card: 1 }), o({ food: 1 }, { card: 2 }), o({ food: 2 }, { worker: 1 })),
  E("\u968A\u5546\u306E\u8B77\u885B", o({}, { coins: 2 }), o({ power: 1 }, { coins: 4 }), o({ power: 2 }, { pop: 2, coins: 2 })),
  E("\u67AF\u308C\u305F\u4E95\u6238", o({}, { oil: 1 }), o({ coins: 1 }, { oil: 2, food: 1 }), o({ oil: 1 }, { power: 2 })),
  E("\u4E0D\u601D\u8B70\u306A\u65C5\u4EBA", o({}, { pop: 1, coins: 1 }), o({ coins: 1 }, { power: 2, pop: 1 }), o({ pop: 1 }, { card: 2 })),
  E("\u5FD8\u308C\u3089\u308C\u305F\u5009\u5EAB", o({}, { food: 1, wood: 1 }), o({ coins: 1 }, { metal: 2, oil: 1 }), o({ coins: 2 }, { worker: 1 })),
  E("\u6751\u9577\u306E\u5BB4", o({}, { food: 1 }), o({ food: 2 }, { pop: 2, power: 1 }), o({ food: 1 }, { coins: 3 })),
  E("\u661F\u306E\u4E0B\u306E\u8A93\u3044", o({}, { power: 1, pop: 1 }), o({ power: 1 }, { pop: 2 }), o({ pop: 1 }, { power: 3 }))
].map((e, i) => ({ id: `enc_${String(i + 1).padStart(2, "0")}`, no: i + 1, ...e }));
var O = (name, text, check) => ({ name, text, verified: false, check });
var OBJECTIVES = [
  O("\u5E83\u5927\u306A\u9818\u571F", "\u652F\u914D\u3059\u308B\u9818\u571F\u304C7\u4EE5\u4E0A", (p, h) => h.controlled >= 7),
  O("\u5C0F\u3055\u306A\u738B\u56FD", "\u652F\u914D\u3059\u308B\u9818\u571F\u304C5\u4EE5\u4E0A", (p, h) => h.controlled >= 5),
  O("\u52B4\u50CD\u8005\u306E\u56FD", "\u76E4\u4E0A\u306E\u30EF\u30FC\u30AB\u30FC\u304C6\u4EBA\u4EE5\u4E0A", (p, h) => h.workers >= 6),
  O("\u5165\u690D", "\u76E4\u4E0A\u306E\u30EF\u30FC\u30AB\u30FC\u304C4\u4EBA\u4EE5\u4E0A", (p, h) => h.workers >= 4),
  O("\u4E8C\u3064\u306E\u7826", "\u5EFA\u7269\u30922\u3064\u4EE5\u4E0A\u5EFA\u8A2D", (p, h) => h.structures >= 2),
  O("\u5EFA\u7BC9\u5BB6", "\u5EFA\u7269\u30923\u3064\u4EE5\u4E0A\u5EFA\u8A2D", (p, h) => h.structures >= 3),
  O("\u8ECD\u5099", "\u30E1\u30C3\u30AF\u30922\u4F53\u4EE5\u4E0A\u914D\u5099", (p, h) => p.mechs.length >= 2),
  O("\u6A5F\u7532\u90E8\u968A", "\u30E1\u30C3\u30AF\u30923\u4F53\u4EE5\u4E0A\u914D\u5099", (p, h) => p.mechs.length >= 3),
  O("\u4EBA\u6C17\u8005", "\u652F\u6301\u304C12\u4EE5\u4E0A", (p) => p.pop >= 12),
  O("\u540D\u58F0", "\u652F\u6301\u304C9\u4EE5\u4E0A", (p) => p.pop >= 9),
  O("\u5F37\u5927\u306A\u529B", "\u6226\u529B\u304C12\u4EE5\u4E0A", (p) => p.power >= 12),
  O("\u84C4\u3048", "\u6226\u529B\u304C9\u4EE5\u4E0A", (p) => p.power >= 9),
  O("\u8C4A\u304B\u306A\u56FD", "\u30B3\u30A4\u30F3\u304C12\u4EE5\u4E0A", (p) => p.coins >= 12),
  O("\u8CC7\u6E90\u738B", "\u652F\u914D\u9818\u571F\u4E0A\u306E\u8CC7\u6E90\u304C8\u500B\u4EE5\u4E0A", (p, h) => h.resTotal >= 8),
  O("\u5009\u5EAB\u756A", "\u652F\u914D\u9818\u571F\u4E0A\u306E\u8CC7\u6E90\u304C5\u500B\u4EE5\u4E0A", (p, h) => h.resTotal >= 5),
  O("\u6539\u826F", "\u6539\u826F\u30923\u56DE\u4EE5\u4E0A", (p) => p.cubes >= 3),
  O("\u6280\u8853\u9769\u65B0", "\u6539\u826F\u30924\u56DE\u4EE5\u4E0A", (p) => p.cubes >= 4),
  O("\u5FD7\u9858\u5175", "\u5FB4\u5175\u30922\u56DE\u4EE5\u4E0A", (p) => p.recruits.length >= 2),
  O("\u5DE5\u5834\u306E\u4E3B", "\u5DE5\u5834\u9818\u571F\u3092\u652F\u914D\u3057\u3066\u3044\u308B", (p, h) => h.hasFactory),
  O("\u6E56\u306E\u6C11", "\u6E56\u3092\u652F\u914D\u3057\u3066\u3044\u308B", (p, h) => h.hasLake),
  O("\u5C71\u306E\u6C11", "\u5C71\u30923\u3064\u4EE5\u4E0A\u652F\u914D", (p, h) => h.mountains >= 3),
  O("\u8FB2\u8015\u306E\u6C11", "\u8FB2\u5834\u30922\u3064\u4EE5\u4E0A\u652F\u914D", (p, h) => h.farms >= 2),
  O("\u6226\u52DD", "\u6226\u95D8\u306B1\u56DE\u4EE5\u4E0A\u52DD\u5229", (p) => p.combatWins >= 1)
].map((e, i) => ({ id: `obj_${String(i + 1).padStart(2, "0")}`, no: i + 1, ...e }));
var F = (name, text, cost, gain2) => ({ name, text, verified: false, cost, gain: gain2 });
var FACTORY_CARDS = [
  F("\u52D5\u529B\u7089", "1\u30B3\u30A4\u30F3\u2192\u6226\u529B+3", { coins: 1 }, { power: 3 }),
  F("\u9020\u5E63\u6240", "\u30B3\u30A4\u30F3+3", {}, { coins: 3 }),
  F("\u8CC7\u6750\u5EAB", "\u597D\u304D\u306A\u8CC7\u6E902\u500B\u3092\u81EA\u9818\u571F\u3078", { coins: 1 }, { anyRes: 2 }),
  F("\u5BA3\u4F1D\u5C40", "1\u30B3\u30A4\u30F3\u2192\u652F\u6301+2", { coins: 1 }, { pop: 2 }),
  F("\u8A13\u7DF4\u6240", "1\u30B3\u30A4\u30F3\u2192\u6226\u95D8\u30AB\u30FC\u30C9+2", { coins: 1 }, { card: 2 }),
  F("\u7D66\u98DF\u6240", "\u98DF\u6599+2\u3092\u81EA\u9818\u571F\u3078", {}, { food: 2 }),
  F("\u88FD\u6CB9\u6240", "\u6CB9+2\u3092\u81EA\u9818\u571F\u3078", {}, { oil: 2 }),
  F("\u88FD\u9244\u6240", "\u9244+2\u3092\u81EA\u9818\u571F\u3078", {}, { metal: 2 }),
  F("\u88FD\u6750\u6240", "\u6728\u6750+2\u3092\u81EA\u9818\u571F\u3078", {}, { wood: 2 }),
  F("\u5DE5\u5EE0", "2\u30B3\u30A4\u30F3\u2192\u6226\u529B+2\u30FB\u652F\u6301+1", { coins: 2 }, { power: 2, pop: 1 }),
  F("\u52DF\u5175\u5C40", "1\u30B3\u30A4\u30F3\u2192\u6226\u95D8\u30AB\u30FC\u30C9+1\u30FB\u6226\u529B+1", { coins: 1 }, { card: 1, power: 1 }),
  F("\u5186\u5353", "\u652F\u6301+1\u30FB\u30B3\u30A4\u30F3+1", {}, { pop: 1, coins: 1 })
].map((e, i) => ({ id: `fac_${String(i + 1).padStart(2, "0")}`, no: i + 1, ...e }));
var BONUS_TILES = [
  {
    id: "bonus_lake",
    name: "\u6E56\u306B\u96A3\u63A5\u3059\u308B\u5EFA\u7269",
    text: "\u6E56\u306B\u96A3\u63A5\u3059\u308B\u5EFA\u72691\u3064\u306B\u3064\u304D2\u30B3\u30A4\u30F3",
    perStructure: 2,
    test: (hex, map) => hex.nb.some((n) => map.hexes[n].terrain === "lake")
  },
  {
    id: "bonus_tunnel",
    name: "\u30C8\u30F3\u30CD\u30EB\u306B\u96A3\u63A5/\u4E0A\u306E\u5EFA\u7269",
    text: "\u30C8\u30F3\u30CD\u30EB\u9818\u571F\u307E\u305F\u306F\u305D\u306E\u96A3\u306E\u5EFA\u72691\u3064\u306B\u3064\u304D2\u30B3\u30A4\u30F3",
    perStructure: 2,
    test: (hex, map) => hex.tunnel || hex.nb.some((n) => map.hexes[n].tunnel)
  },
  {
    id: "bonus_encounter",
    name: "\u906D\u9047\u306E\u3042\u308B\u9818\u571F\u306B\u96A3\u63A5",
    text: "\u906D\u9047\u30C8\u30FC\u30AF\u30F3\u306E\u9818\u571F\u306B\u96A3\u63A5\u3059\u308B\u5EFA\u72691\u3064\u306B\u3064\u304D2\u30B3\u30A4\u30F3",
    perStructure: 2,
    test: (hex, map) => hex.nb.some((n) => map.hexes[n].encounter)
  }
];
var byId = (list, id) => list.find((x) => x.id === id);

// public/js/engine/cards.js
var ENC_FX = {
  "44.1": { free: [{ k: "reposition", unit: "mech", mode: "adj" }] },
  "54.1": { free: [{ k: "reposition", unit: "mech", mode: "mine" }] },
  "50.2": { free: [{ k: "reposition", unit: "char", mode: "any" }] },
  "60.2": { free: [{ k: "reposition", unit: "char", mode: "adj" }] },
  "49.2": { free: [{ k: "recall" }] },
  "50.1": { free: [{ k: "moveToken" }] },
  "59.1": { free: [{ k: "trapPlace" }] },
  "48.2": { fx: "leadPower" },
  "49.0": { fx: "topCombat" },
  "53.1": { fx: "factoryRand" },
  "53.2": { fx: "combatStar" },
  "65.1": { fx: "truce" },
  "46.1": { fx: "objSwap" }
};
var ENCOUNTERS2 = CARDS.enc.map((e) => ({
  id: e.id,
  no: e.no,
  official: e.official,
  name: `\u906D\u9047#${e.no}`,
  options: e.options.map((o2, i) => {
    const x = ENC_FX[`${e.no}.${i}`];
    return { cost: o2.cost || {}, gain: o2.gain || {}, free: x?.free || o2.free || [], fx: x?.fx || null, unsupported: x ? false : !!o2.unsupported, text: o2.text };
  })
}));
var rt4 = (h) => ["wood", "metal", "oil", "food"].map((k) => h.rt[k] || 0);
var CHECKS = {
  1: (p, h) => h.count.mountain >= 3,
  2: (p, h) => h.rt.food >= 6 && h.count.farm >= 1,
  3: (p, h) => h.rt.oil >= 5 && h.count.tundra >= 2,
  4: (p, h) => h.rt.metal >= 5 && p.mechs.length >= 1,
  5: (p, h) => p.coins >= 10 && h.count.village >= 2,
  6: (p, h) => p.workers.length >= 6 && h.count.farm >= 1,
  7: (p) => p.cubes >= 5,
  8: (p, h) => p.structures.length >= 3 && h.count.forest >= 2,
  9: (p) => p.power >= 12 && p.mechs.length >= 1,
  10: (p, h) => rt4(h).filter((v) => v >= 2).length >= 3,
  11: (p, h) => h.count.village >= 3,
  12: (p, h) => h.count.mountain >= 2 && h.rt.metal >= 4,
  13: (p, h) => h.prodTypes >= 3,
  14: (p) => p.recruits.length >= 2,
  15: (p, h) => h.hasFactory && p.mechs.length >= 1,
  16: (p, h) => h.cs.some((x) => h.at(x).char && h.at(x).mech && h.at(x).worker && h.resAt(x) >= 5),
  17: (p) => p.mechs.length >= 3,
  18: (p, h) => p.coins >= 7 && h.resTotal >= 8,
  19: (p) => p.structures.length >= 4,
  20: (p, h) => h.cs.length >= 8,
  21: (p) => p.pop >= 13 && p.recruits.length >= 1,
  22: (p, h) => rt4(h).every((v) => v >= 2),
  23: (p, h) => !h.charAtHome && p.hand >= 3,
  24: (p, h) => h.factoryAdjWorkers >= 5,
  25: (p) => p.pop <= 3 && p.power >= 13 && p.mechs.length >= 2,
  26: (p, h) => h.prodTypes >= 4,
  27: (p, h) => p.structures.length >= 3 && !h.structNearHome
};
var OFFICIAL_NAMES = { 1: "Higher Ground Advantage", 11: "Population Advantage", 16: "A Wolf Among the Sheep", 24: "Establish a Human Shield", 25: "Become a Despised Warmonger", 26: "Diversify Production", 27: "Build Local Infrastructure" };
var OBJECTIVES2 = CARDS.obj.map((o2) => ({
  id: o2.id,
  no: o2.no,
  official: o2.official,
  name: OFFICIAL_NAMES[o2.no] || o2.name,
  text: o2.text,
  check: CHECKS[o2.no]
}));
var FC = (cost, gain2, free, text) => ({ cost, gain: gain2, free, text, verified: false });
var alt = (...k) => [{ alt: k }];
var SPEC = [
  FC({ coins: 1, card: 1 }, {}, [{ k: "produce" }], "1\u30B3\u30A4\u30F3\uFF0B\u6226\u95D8\u30AB\u30FC\u30C91\u679A \u2192 \u751F\u7523\uFF082\u9818\u571F\u307E\u3067\uFF09"),
  FC({ pop: 1 }, {}, alt("enlist", "upgrade"), "\u652F\u63011 \u2192 \u5FB4\u5175\u304B\u6539\u826F\uFF08\u7121\u6599\uFF09"),
  FC({ card: 1 }, { pop: 2 }, [], "\u6226\u95D8\u30AB\u30FC\u30C91\u679A \u2192 \u652F\u6301+2"),
  FC({ card: 1 }, { coins: 3 }, [], "\u6226\u95D8\u30AB\u30FC\u30C91\u679A \u2192 \u30B3\u30A4\u30F3+3"),
  FC({ power: 1 }, { pop: 2 }, [], "\u6226\u529B1 \u2192 \u652F\u6301+2"),
  FC({ power: 1 }, { coins: 3 }, [], "\u6226\u529B1 \u2192 \u30B3\u30A4\u30F3+3"),
  FC({ pop: 1 }, {}, alt("deploy", "build"), "\u652F\u63011 \u2192 \u914D\u5099\u304B\u5EFA\u8A2D\uFF08\u7121\u6599\uFF09"),
  FC({ card: 1 }, {}, [{ k: "anyRes", n: 3 }], "\u6226\u95D8\u30AB\u30FC\u30C91\u679A \u2192 \u597D\u304D\u306A\u8CC7\u6E903\u500B"),
  FC({ coins: 2 }, { pop: 1 }, [{ k: "upgrade" }], "2\u30B3\u30A4\u30F3 \u2192 \u6539\u826F\uFF08\u7121\u6599\uFF09\uFF0B\u652F\u6301+1"),
  FC({ coins: 2 }, { power: 1 }, [{ k: "deploy" }], "2\u30B3\u30A4\u30F3 \u2192 \u914D\u5099\uFF08\u7121\u6599\uFF09\uFF0B\u6226\u529B+1"),
  FC({ coins: 2 }, { pop: 1 }, [{ k: "build" }], "2\u30B3\u30A4\u30F3 \u2192 \u5EFA\u8A2D\uFF08\u7121\u6599\uFF09\uFF0B\u652F\u6301+1"),
  FC({ coins: 2 }, { power: 1 }, [{ k: "enlist" }], "2\u30B3\u30A4\u30F3 \u2192 \u5FB4\u5175\uFF08\u7121\u6599\uFF09\uFF0B\u6226\u529B+1"),
  FC({ anyRes: 2, diff: true }, {}, alt("deploy", "build"), "\u7570\u306A\u308B\u8CC7\u6E902\u500B \u2192 \u914D\u5099\u304B\u5EFA\u8A2D\uFF08\u7121\u6599\uFF09"),
  FC({ card: 1 }, { worker: 1, coins: 2 }, [], "\u6226\u95D8\u30AB\u30FC\u30C91\u679A \u2192 \u30EF\u30FC\u30AB\u30FC1\u4F53\uFF0B2\u30B3\u30A4\u30F3"),
  FC({ anyRes: 1 }, { card: 1, power: 2 }, [], "\u8CC7\u6E901\u500B \u2192 \u6226\u95D8\u30AB\u30FC\u30C91\u679A\uFF0B\u6226\u529B+2"),
  FC({ anyRes: 1 }, { power: 1, pop: 1, coins: 1 }, [], "\u8CC7\u6E901\u500B \u2192 \u6226\u529B\u30FB\u652F\u6301\u30FB\u30B3\u30A4\u30F3\u5404+1"),
  FC({ card: 1 }, { power: 1 }, [{ k: "upgrade" }], "\u6226\u95D8\u30AB\u30FC\u30C91\u679A \u2192 \u6539\u826F\uFF08\u7121\u6599\uFF09\uFF0B\u6226\u529B+1"),
  FC({ anyRes: 2, diff: true }, {}, alt("enlist", "upgrade"), "\u7570\u306A\u308B\u8CC7\u6E902\u500B \u2192 \u5FB4\u5175\u304B\u6539\u826F\uFF08\u7121\u6599\uFF09")
];
var FACTORY_CARDS2 = SPEC.map((c, i) => ({ id: `fac_${String(i + 1).padStart(2, "0")}`, no: i + 1, name: `\u5DE5\u5834\u30AB\u30FC\u30C9${i + 1}`, img: `i-factory_${String(i + 1).padStart(2, "0")}.jpg`, ...c }));
var DEFAULT_EXP = { invaders: false, promo: true, encounters: true };
function allowedCards(exp = DEFAULT_EXP) {
  const e = { ...DEFAULT_EXP, ...exp };
  const enc2 = ENCOUNTERS2.filter((c) => c.no <= 28 || (c.no <= 42 ? e.promo : e.encounters)).map((c) => c.id);
  const obj = OBJECTIVES2.filter((c) => c.no <= 23 || e.promo).map((c) => c.id);
  const fac = FACTORY_CARDS2.filter((c, i) => i < 12 || e.promo).map((c) => c.id);
  return { enc: enc2, obj, fac };
}

// public/js/engine/draft.js
var cryptoRng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
var pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
function shuffle(arr, rng = cryptoRng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function canMatch(players, avail, legal) {
  if (players.length === 0) return true;
  const [p, ...rest] = players;
  return avail.some((c) => legal(p, c) && canMatch(rest, avail.filter((x) => x !== c), legal));
}
function validatePrefs(prefs, candidates, uid, legal) {
  if (!Array.isArray(prefs) || prefs.length > 3) return "\u5E0C\u671B\u306F\u6700\u59273\u3064\u3067\u3059";
  if (new Set(prefs).size !== prefs.length) return "\u540C\u3058\u5019\u88DC\u3092\u91CD\u8907\u3057\u3066\u6307\u5B9A\u3067\u304D\u307E\u305B\u3093";
  for (const c of prefs) {
    if (!candidates.includes(c)) return "\u5B58\u5728\u3057\u306A\u3044\u5019\u88DC\u3067\u3059";
    if (!legal(uid, c)) return "\u516C\u5F0F\u30EB\u30FC\u30EB\u3067\u7981\u6B62\u3055\u308C\u305F\u7D44\u307F\u5408\u308F\u305B\u3067\u3059";
  }
  return null;
}
function resolveDraft({ players, prefs, candidates, legal, rng = cryptoRng }) {
  if (!canMatch(players, candidates, legal)) throw new Error("\u5408\u6CD5\u306A\u5272\u5F53\u304C\u5B58\u5728\u3057\u307E\u305B\u3093");
  const assigned = {};
  const log2 = [];
  const taken = /* @__PURE__ */ new Set();
  const remainingPlayers = () => players.filter((p) => !(p in assigned));
  for (let rank = 0; rank < 3; rank++) {
    const groups = /* @__PURE__ */ new Map();
    for (const p of remainingPlayers()) {
      const c = (prefs[p] || [])[rank];
      if (c === void 0 || taken.has(c) || !legal(p, c)) continue;
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(p);
    }
    for (const c of shuffle([...groups.keys()], rng)) {
      let contenders = groups.get(c).filter((p) => !(p in assigned));
      while (contenders.length) {
        const winner = pick(contenders, rng);
        const rest = players.filter((p) => p !== winner && !(p in assigned));
        const avail = candidates.filter((x) => !taken.has(x) && x !== c);
        if (canMatch(rest, avail, legal)) {
          assigned[winner] = c;
          taken.add(c);
          log2.push({ type: "pref", rank: rank + 1, candidate: c, winner, contenders: [...contenders] });
          break;
        }
        log2.push({ type: "pref_blocked", rank: rank + 1, candidate: c, player: winner });
        contenders = contenders.filter((p) => p !== winner);
      }
    }
  }
  for (const p of shuffle(remainingPlayers(), rng)) {
    const rest = players.filter((x) => x !== p && !(x in assigned));
    const options = candidates.filter(
      (c2) => !taken.has(c2) && legal(p, c2) && canMatch(rest, candidates.filter((x) => !taken.has(x) && x !== c2), legal)
    );
    const c = pick(options, rng);
    assigned[p] = c;
    taken.add(c);
    log2.push({ type: "random", candidate: c, player: p });
  }
  return { assignments: assigned, log: log2 };
}

// public/js/engine/setup.js
function startBlockers(playerCount, ledgers = LEDGERS, { allowPlaceholder = false } = {}) {
  const out = [];
  if (playerCount < PLAYER_RANGE.min || playerCount > PLAYER_RANGE.max) {
    out.push(`\u5BFE\u5FDC\u4EBA\u6570\u306F${PLAYER_RANGE.min}\u301C${PLAYER_RANGE.max}\u4EBA\u3067\u3059`);
  }
  for (const [k, l] of Object.entries(ledgers)) {
    if (l.verified !== true && !allowPlaceholder) out.push(`\u30AB\u30FC\u30C9/\u76E4\u9762\u30C7\u30FC\u30BF\u672A\u78BA\u8A8D: ${l.label}\uFF08${l.entered}/${l.expected}\uFF09`);
  }
  return out;
}
var placeholderNotes = (ledgers = LEDGERS) => Object.values(ledgers).filter((l) => l.verified !== true).map((l) => `\u4EEE\u30C7\u30FC\u30BF: ${l.label}`);

// public/js/engine/board-data.js
var BOARD = { "terrain": { "0,-3": "farm", "3,-2": "farm", "3,0": "farm", "-3,0": "farm", "-4,1": "farm", "-1,2": "farm", "0,3": "farm", "2,-3": "forest", "-2,-3": "forest", "-2,-1": "forest", "2,-1": "forest", "0,-1": "forest", "-3,1": "forest", "0,2": "forest", "-2,3": "forest", "-1,-3": "mountain", "2,-2": "mountain", "4,-2": "mountain", "-1,-1": "mountain", "1,0": "mountain", "1,2": "mountain", "-4,2": "mountain", "-1,3": "mountain", "3,-3": "tundra", "-1,-2": "tundra", "1,-2": "tundra", "2,0": "tundra", "-1,1": "tundra", "-2,1": "tundra", "2,2": "tundra", "-4,3": "tundra", "4,-3": "village", "1,-3": "village", "3,-1": "village", "-2,0": "village", "1,1": "village", "-2,2": "village", "-3,2": "village", "1,3": "village", "-2,4": "village", "-2,-2": "lake", "0,-2": "lake", "1,-1": "lake", "-1,0": "lake", "0,1": "lake", "2,1": "lake", "-3,3": "lake", "0,0": "factory" }, "tunnels": [[1, -2], [-1, -1], [2, -1], [-2, 1], [1, 1], [-1, 2]], "enc": [[1, -3], [-1, -2], [2, -2], [4, -2], [2, 0], [-2, 0], [-4, 1], [-3, 2], [-2, 2], [1, 2], [-1, 3]], "rivers": [[[3, -2], [3, -3]], [[-3, 0], [-4, 1]], [[-3, 0], [-3, 1]], [[-4, 1], [-4, 2]], [[-1, 2], [0, 2]], [[-1, 2], [-1, 3]], [[2, -1], [3, -1]], [[2, -1], [2, -2]], [[2, -1], [2, 0]], [[-3, 1], [-3, 2]], [[2, -2], [3, -2]], [[-1, -1], [-2, -1]], [[-1, -1], [-2, 0]], [[1, 0], [2, 0]], [[-1, 3], [0, 3]], [[-1, 3], [0, 2]], [[3, -3], [4, -3]], [[-1, -2], [-2, -1]], [[1, -2], [2, -2]], [[1, -2], [2, -3]], [[1, -2], [1, -3]], [[1, -3], [2, -3]], [[3, -1], [4, -2]], [[3, -1], [3, -2]], [[-2, 0], [-3, 1]], [[-2, 0], [-2, 1]], [[1, 1], [2, 0]], [[-2, 2], [-3, 2]], [[-2, 2], [-2, 3]]], "homes": { "albion": { "adj": ["0,-3", "-1,-3"], "px": [285, 48] }, "nordic": { "adj": ["3,-3", "2,-3"], "px": [690, 52] }, "rusviet": { "adj": ["3,-1", "3,0"], "px": [960, 368] }, "togawa": { "adj": ["1,3", "2,2"], "px": [955, 795] }, "crimea": { "adj": ["-2,4", "-2,3"], "px": [405, 900] }, "saxony": { "adj": ["-4,3", "-4,2"], "px": [88, 790] }, "polania": { "adj": ["-3,0", "-2,-1"], "px": [88, 370] } } };

// public/js/engine/legacy-map.js
var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
var RES = ["metal", "oil", "food", "wood"];
var TERRAIN_RES = { mountain: "metal", tundra: "oil", farm: "food", forest: "wood" };
var HEXPX = { "0,-3": [335.3, 153.2], "3,-2": [769.6, 261.3], "3,0": [894.8, 475.8], "-3,0": [150.2, 473], "-4,1": [88.1, 579.8], "-1,2": [518.1, 688.6], "0,3": [704, 796.7], "2,-3": [582.5, 153.9], "-2,-3": [90.6, 152.6], "-2,-1": [212, 366.3], "2,-1": [707, 368], "0,-1": [458.3, 367.1], "-3,1": [210.5, 580.2], "0,2": [642.6, 689.1], "-2,3": [454.8, 795.6], "-1,-3": [212.6, 152.8], "2,-2": [644.7, 260.8], "4,-2": [895.1, 261.7], "-1,-1": [334.8, 366.7], "1,0": [644.2, 474.7], "1,2": [767.8, 689.6], "-4,2": [148.1, 687.1], "-1,3": [579.1, 796.1], "3,-3": [707, 154.3], "-1,-2": [273.7, 259.7], "1,-2": [520.5, 260.4], "2,0": [769.2, 475.2], "-1,1": [457, 581.1], "-2,1": [333.4, 580.7], "2,2": [893.6, 690.2], "-4,3": [208, 794.6], "4,-3": [832.1, 154.7], "1,-3": [458.6, 153.5], "3,-1": [832.2, 368.4], "-2,0": [272.7, 473.4], "1,1": [706, 582.1], "-2,2": [394.1, 688.1], "-3,2": [270.8, 687.6], "1,3": [829.6, 797.3], "-2,4": [515.5, 903.3], "-2,-2": [151.3, 259.4], "0,-2": [396.8, 260], "1,-1": [582.3, 367.5], "-1,0": [395.9, 473.8], "0,1": [581.2, 581.6], "2,1": [831.4, 582.6], "-3,3": [331.1, 795.1], "0,0": [519.7, 474.3] };
var PX = (q, r) => HEXPX[`${q},${r}`] || [520 + 121.8 * (q + r / 2), 471 + 106.5 * r];
var hexes = {};
var ids = Object.keys(BOARD.terrain);
var tun = new Set(BOARD.tunnels.map(([q, r]) => `${q},${r}`));
var enc = new Set(BOARD.enc.map(([q, r]) => `${q},${r}`));
for (const id of ids) {
  const [q, r] = id.split(",").map(Number);
  hexes[id] = { id, q, r, terrain: BOARD.terrain[id], tunnel: tun.has(id), encounter: enc.has(id), nb: [], river: [], home: null };
}
for (const h of Object.values(hexes)) h.nb = DIRS.map(([a, b]) => `${h.q + a},${h.r + b}`).filter((i) => hexes[i]);
for (const [a, b] of BOARD.rivers) {
  const ia = a.join(","), ib = b.join(",");
  if (hexes[ia] && hexes[ib]) {
    hexes[ia].river.push(ib);
    hexes[ib].river.push(ia);
  }
}
var BASE = ["nordic", "rusviet", "crimea", "saxony", "polania", "togawa", "albion"];
var homes = {};
var startAdj = {};
for (const f of BASE) {
  const hm = BOARD.homes[f], [x, y] = hm.px, hid = `home:${f}`;
  const r = (y - 468) / 105, q = (x - 520) / 121.2 - r / 2;
  hexes[hid] = { id: hid, q, r, terrain: "home", tunnel: false, encounter: false, nb: [...hm.adj], river: [], home: f, px: [x, y] };
  hm.adj.forEach((n) => hexes[n].nb.push(hid));
  homes[f] = hid;
  startAdj[f] = [...hm.adj];
}
var MAP = { ids: [...ids, ...BASE.map((f) => homes[f])], hexes, homes, startAdj };
var isRiver = (a, b) => hexes[a].river.includes(b);

// public/js/engine/game.js
var RuleError = class extends Error {
};
var fail = (m) => {
  throw new RuleError(m);
};
var POWER_MAX = 16;
var POP_MAX = 18;
var STAR_MAX = 6;
var STRUCTS = ["monument", "mill", "mine", "armory"];
function createGame({ players, bonusTileId, factoryIds, gid = "g0" }) {
  const order = [...players].sort((a, b) => MAT_NUMBER[a.mat] - MAT_NUMBER[b.mat]).map((p) => p.uid);
  const st = {
    v: 1,
    gid,
    order,
    turnUid: order[0],
    turnNo: 1,
    over: false,
    result: null,
    bonusTile: bonusTileId,
    factoryCandidates: [...factoryIds],
    log: [],
    hexes: {},
    players: {},
    turn: { phase: "section" },
    pending: null,
    traps: [],
    flagHexes: []
  };
  for (const id of MAP.ids) st.hexes[id] = { res: {}, structure: null, enc: MAP.hexes[id].encounter };
  for (const { uid, faction, mat } of players) {
    const f = BASE_FACTIONS[faction], m = BASE_MATS[mat];
    st.players[uid] = {
      faction,
      mat,
      power: f.power,
      pop: m.popularity,
      coins: m.coins,
      hand: f.combatCards,
      objs: m.objectives,
      section: null,
      last: null,
      char: MAP.homes[faction],
      mechs: [],
      workers: [...MAP.startAdj[faction]],
      matWorkers: 6,
      red: { upgrade: 0, deploy: 0, build: 0, enlist: 0 },
      cubes: 0,
      structures: [],
      recruits: [],
      stars: [],
      combatWins: 0,
      factory: null,
      traps: faction === "togawa" ? ["pop", "power", "coins", "cards"] : [],
      flags: faction === "albion" ? 4 : 0,
      up: { move: 0, bolster: 0, trade: 0, produce: 0 }
    };
  }
  log(st, order[0], "\u30B2\u30FC\u30E0\u958B\u59CB");
  return st;
}
function log(st, uid, text) {
  st.log.push({ n: st.turnNo, uid, text });
  if (st.log.length > 200) st.log.shift();
}
var H = (id) => MAP.hexes[id];
var homeOf = (st, uid) => MAP.homes[st.players[uid].faction];
function unitsAt(st, hex) {
  const out = {};
  const add = (uid, k) => {
    out[uid] ||= { char: false, mechs: 0, workers: 0 };
    if (k === "char") out[uid].char = true;
    else out[uid][k]++;
  };
  for (const [uid, p] of Object.entries(st.players)) {
    if (p.char === hex) add(uid, "char");
    for (const m of p.mechs) if (m.hex === hex) add(uid, "mechs");
    for (const w of p.workers) if (w === hex) add(uid, "workers");
  }
  return out;
}
function controller(st, hex) {
  const u = Object.keys(unitsAt(st, hex));
  if (u.length === 1) return u[0];
  if (u.length > 1) return null;
  const tr = (st.traps || []).find((x) => x.hex === hex && x.armed);
  return st.hexes[hex].structure?.owner ?? tr?.owner ?? null;
}
var controlled = (st, uid) => MAP.ids.filter((h) => controller(st, h) === uid && H(h).terrain !== "home");
var hasAbility = (st, uid, ab) => {
  const p = st.players[uid];
  return p.mechs.some((m) => MECH_SLOTS[p.faction][m.slot] === ab);
};
var resTotals = (st, uid) => {
  const t = { oil: 0, metal: 0, wood: 0, food: 0 };
  for (const h of controlled(st, uid)) for (const r of RES) t[r] += st.hexes[h].res[r] || 0;
  return t;
};
var myWorkersAt = (st, uid, hex) => st.players[uid].workers.filter((w) => w === hex).length;
function takeRes(st, uid, type, n) {
  let need = n;
  for (const h of controlled(st, uid)) {
    const have = st.hexes[h].res[type] || 0;
    const t = Math.min(have, need);
    if (t) {
      st.hexes[h].res[type] -= t;
      need -= t;
    }
    if (!need) return;
  }
  fail(`${type}\u304C\u8DB3\u308A\u307E\u305B\u3093`);
}
var total = (st, uid, type) => resTotals(st, uid)[type];
function canPay(st, uid, cost) {
  const p = st.players[uid];
  for (const [k, v] of Object.entries(cost || {})) {
    if (k === "coins" && p.coins < v) return false;
    if (k === "power" && p.power < v) return false;
    if (k === "pop" && p.pop < v) return false;
    if (RES.includes(k) && total(st, uid, k) < v) return false;
  }
  return true;
}
function pay(st, uid, cost) {
  if (!canPay(st, uid, cost)) fail("\u30B3\u30B9\u30C8\u3092\u652F\u6255\u3048\u307E\u305B\u3093");
  const p = st.players[uid];
  for (const [k, v] of Object.entries(cost || {})) {
    if (k === "coins") p.coins -= v;
    else if (k === "power") p.power -= v;
    else if (k === "pop") p.pop -= v;
    else if (RES.includes(k)) takeRes(st, uid, k, v);
  }
}
function gain(st, uid, g, hex, ctx) {
  const p = st.players[uid];
  for (const [k, v] of Object.entries(g || {})) {
    if (k === "coins") p.coins += v;
    else if (k === "power") p.power = Math.min(POWER_MAX, p.power + v);
    else if (k === "pop") p.pop = Math.min(POP_MAX, p.pop + v);
    else if (k === "card") grantCards(st, uid, v, ctx);
    else if (RES.includes(k)) st.hexes[hex].res[k] = (st.hexes[hex].res[k] || 0) + v;
    else if (k === "worker") {
      for (let i = 0; i < v && p.matWorkers > 0; i++) {
        p.matWorkers--;
        p.workers.push(hex);
      }
    }
  }
}
function grantCards(st, uid, n, ctx) {
  st.players[uid].hand += n;
  ctx.grants[uid] = (ctx.grants[uid] || 0) + n;
}
var losePop = (st, uid, n) => {
  const p = st.players[uid];
  p.pop = Math.max(0, p.pop - n);
};
var topo = (st, uid, hex) => {
  const p = st.players[uid];
  const under = hasAbility(st, uid, "underpass");
  const inNet = (h) => H(h).tunnel || p.structures.some((s) => s.type === "mine" && s.hex === h) || under && H(h).terrain === "mountain" && controller(st, h) === uid;
  let out = inNet(hex) ? MAP.ids.filter((h) => h !== hex && inNet(h)) : [];
  if (hasAbility(st, uid, "township")) {
    const net = ["0,0", ...MAP.ids.filter((h) => H(h).terrain === "village" && controller(st, h) === uid)];
    if (net.includes(hex)) out = [.../* @__PURE__ */ new Set([...out, ...net.filter((h) => h !== hex)])];
  }
  return out;
};
function unitHex(st, uid, unit) {
  const p = st.players[uid];
  if (unit === "char") return p.char;
  if (unit[0] === "m") return p.mechs[+unit.slice(1)]?.hex;
  if (unit[0] === "w") return p.workers[+unit.slice(1)];
  return void 0;
}
function setUnitHex(st, uid, unit, hex) {
  const p = st.players[uid];
  if (unit === "char") p.char = hex;
  else if (unit[0] === "m") p.mechs[+unit.slice(1)].hex = hex;
  else p.workers[+unit.slice(1)] = hex;
}
var enemyTrap = (st, uid, hex) => (st.traps || []).find((x) => x.hex === hex && x.armed && x.owner !== uid);
function moveTargets(st, uid, unit, stepsAllowed, opts = {}) {
  const p = st.players[uid];
  const from = unitHex(st, uid, unit);
  if (!from) return [];
  const isWorker = unit[0] === "w";
  const maxSteps = stepsAllowed ?? (isWorker ? 1 : 1 + (hasAbility(st, uid, "speed") ? 1 : 0) + (p.up?.move || 0));
  const rw = !isWorker && hasAbility(st, uid, "riverwalk") ? RIVERWALK[p.faction] : [];
  const toka = !isWorker && !opts.noToka && hasAbility(st, uid, "toka") && !st.turn?.move?.tokaUsed;
  const burrow = !isWorker && hasAbility(st, uid, "burrow");
  const isTunnel = (h) => H(h).tunnel || p.structures.some((s) => s.type === "mine" && s.hex === h);
  const suiton = !isWorker && ["suiton", "seaworthy", "submerge"].some((x) => hasAbility(st, uid, x));
  const seen = /* @__PURE__ */ new Set([`${from}|0`]), best = /* @__PURE__ */ new Map([[from, 0]]);
  const out = [];
  let frontier = [[from, 0]];
  for (let s = 1; s <= maxSteps; s++) {
    const next = [];
    for (const [cur, used] of frontier) {
      const nbs = /* @__PURE__ */ new Set([...H(cur).nb, ...topo(st, uid, cur)]);
      for (const c of nbs) {
        const ch = H(c);
        if (ch.terrain === "lake" && !suiton) continue;
        if (ch.terrain === "home" && ch.home !== p.faction) continue;
        const viaTunnel = !H(cur).nb.includes(c);
        let nu = used;
        if (!viaTunnel && isRiver(cur, c)) {
          const ok = isWorker && p.faction === "nordic" || rw.includes(ch.terrain) || burrow && (isTunnel(cur) || isTunnel(c));
          if (!ok) {
            if (toka && !used) nu = 1;
            else continue;
          }
        }
        if (seen.has(`${c}|${nu}`)) continue;
        seen.add(`${c}|${nu}`);
        const here = unitsAt(st, c);
        const enemies = Object.keys(here).filter((u) => u !== uid);
        if (isWorker && enemies.length) continue;
        if (!best.has(c)) {
          best.set(c, s);
          out.push({ to: c, steps: s });
        }
        const stops = enemies.length || st.hexes[c].enc || enemyTrap(st, uid, c);
        if (!stops) next.push([c, nu]);
      }
    }
    frontier = next;
  }
  if (!isWorker && hasAbility(st, uid, "rally")) {
    const tg = /* @__PURE__ */ new Set([...p.workers, ...(st.flagHexes || []).filter((f) => f.owner === uid).map((f) => f.hex)]);
    for (const h of tg) {
      if (h === from || best.has(h) || H(h).terrain === "lake" && !suiton) continue;
      best.set(h, 1);
      out.push({ to: h, steps: 1 });
    }
  }
  if (!isWorker && hasAbility(st, uid, "submerge") && H(from).terrain === "lake") {
    for (const h of MAP.ids) if (h !== from && H(h).terrain === "lake" && !best.has(h)) {
      best.set(h, 1);
      out.push({ to: h, steps: 1 });
    }
  }
  if (!isWorker && hasAbility(st, uid, "wayfare") && Object.keys(st.players).length >= 6) {
    for (const h of MAP.ids) if (H(h).terrain === "farm" && h !== from && !best.has(h) && !Object.keys(unitsAt(st, h)).length) {
      best.set(h, 1);
      out.push({ to: h, steps: 1 });
    }
  } else if (!isWorker && hasAbility(st, uid, "wayfare")) {
    for (const h of MAP.ids) {
      if (H(h).terrain !== "home" || h === from || best.has(h)) continue;
      if (H(h).home !== p.faction && Object.keys(unitsAt(st, h)).length) continue;
      best.set(h, 1);
      out.push({ to: h, steps: 1 });
    }
  }
  if (!isWorker && hasAbility(st, uid, "shinobi")) {
    for (const tr of st.traps || []) {
      if (tr.owner !== uid || tr.hex === from || best.has(tr.hex)) continue;
      if (H(tr.hex).terrain === "lake" && !suiton) continue;
      best.set(tr.hex, 1);
      out.push({ to: tr.hex, steps: 1 });
    }
  }
  return out;
}
var sectionTop = (p, s) => s === "factory" ? "factory" : topOf(p.mat, s);
var sectionBottom = (p, s) => s === "factory" ? "factoryMove" : BOTTOM_ORDER[s];
function legalSections(st, uid) {
  const p = st.players[uid];
  const all = [0, 1, 2, 3, ...p.factory ? ["factory"] : []];
  return all.filter((s) => s !== p.section || p.faction === "rusviet");
}
function startMove(st, uid, kind) {
  const t = st.turn;
  t.move = { kind, left: 2, moved: [], single: null, idx: 0 };
  t.phase = "moving";
}
function ensureTurn(st, uid) {
  if (st.over) fail("\u30B2\u30FC\u30E0\u306F\u7D42\u4E86\u3057\u3066\u3044\u307E\u3059");
  if (st.turnUid !== uid) fail("\u3042\u306A\u305F\u306E\u624B\u756A\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
}
function apply(stIn, uid, action, rng = Math.random) {
  const st = structuredClone(stIn);
  const ctx = { grants: {}, discards: {}, events: [] };
  ensureTurn(st, uid);
  const p = st.players[uid];
  const t = st.turn;
  const a = action;
  const phase = t.phase;
  if (st.pending?.type === "free" && a.t !== "free") fail("\u7121\u6599\u52B9\u679C\u306E\u51E6\u7406\u304C\u6B8B\u3063\u3066\u3044\u307E\u3059");
  switch (a.t) {
    case "free": {
      if (!st.pending || st.pending.type !== "free") fail("\u7121\u6599\u52B9\u679C\u306F\u3042\u308A\u307E\u305B\u3093");
      doFree(st, uid, a, ctx);
      break;
    }
    case "section": {
      if (phase !== "section") fail("\u3059\u3067\u306B\u30BB\u30AF\u30B7\u30E7\u30F3\u3092\u9078\u3093\u3067\u3044\u307E\u3059");
      if (!legalSections(st, uid).includes(a.section)) fail("\u305D\u306E\u30BB\u30AF\u30B7\u30E7\u30F3\u306F\u9078\u3079\u307E\u305B\u3093\uFF08\u524D\u56DE\u3068\u5225\u306E\u30BB\u30AF\u30B7\u30E7\u30F3\u3092\u9078\u3073\u307E\u3059\uFF09");
      p.last = p.section;
      p.section = a.section;
      t.phase = "top";
      t.topTaken = false;
      log(st, uid, `\u30BB\u30AF\u30B7\u30E7\u30F3${a.section === "factory" ? "\uFF08\u5DE5\u5834\uFF09" : a.section + 1}\u3092\u9078\u629E`);
      break;
    }
    case "convert": {
      if (st.pending) fail("\u51E6\u7406\u4E2D\u306E\u9805\u76EE\u304C\u3042\u308A\u307E\u3059");
      const give = a.give || [];
      if (give.length !== 2 || !give.every((r) => RES.includes(r)) || !RES.includes(a.to)) fail("\u8CC7\u6E90\u306E\u6307\u5B9A\u304C\u4E0D\u6B63\u3067\u3059");
      if (controller(st, a.hex) !== uid || !myWorkersAt(st, uid, a.hex)) fail("\u8CC7\u6E90\u306F\u81EA\u5206\u306E\u30EF\u30FC\u30AB\u30FC\u304C\u3044\u308B\u652F\u914D\u9818\u571F\u306B\u7F6E\u304D\u307E\u3059");
      pay(st, uid, give.reduce((o2, r) => ({ ...o2, [r]: (o2[r] || 0) + 1 }), {}));
      st.hexes[a.hex].res[a.to] = (st.hexes[a.hex].res[a.to] || 0) + 1;
      log(st, uid, `\u8CC7\u6E90\u4EA4\u63DB\uFF1A${give.map((r) => RES_NAMES[r]).join("\u30FB")} \u2192 ${RES_NAMES[a.to]}`);
      break;
    }
    case "cancelSection": {
      if (phase !== "top" || t.topTaken) fail("\u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u884C\u3046\u524D\u3060\u3051\u53D6\u308A\u6D88\u305B\u307E\u3059");
      p.section = p.last;
      t.phase = "section";
      log(st, uid, "\u30BB\u30AF\u30B7\u30E7\u30F3\u9078\u629E\u3092\u53D6\u308A\u6D88\u3057");
      break;
    }
    case "top": {
      if (phase !== "top") fail("\u4ECA\u306F\u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u9078\u3079\u307E\u305B\u3093");
      topAction(st, uid, a, ctx);
      break;
    }
    case "move": {
      if (phase !== "moving") fail("\u4ECA\u306F\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093");
      if (st.pending) fail("\u51E6\u7406\u4E2D\u306E\u9805\u76EE\u304C\u3042\u308A\u307E\u3059");
      doMove(st, uid, a, ctx);
      break;
    }
    case "endMove": {
      if (phase !== "moving") fail("\u79FB\u52D5\u4E2D\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
      if (st.pending) fail("\u51E6\u7406\u4E2D\u306E\u9805\u76EE\u304C\u3042\u308A\u307E\u3059");
      finishMove(st, uid, ctx);
      break;
    }
    case "combat": {
      if (!st.pending || st.pending.type !== "combat") fail("\u6226\u95D8\u306F\u3042\u308A\u307E\u305B\u3093");
      doCombat(st, uid, a, ctx);
      break;
    }
    case "encounterDraw": {
      if (!st.pending || st.pending.type !== "encounter" || st.pending.cardId) fail("\u906D\u9047\u3092\u5F15\u3051\u307E\u305B\u3093");
      if (!byId(ENCOUNTERS2, a.cardId)) fail("\u4E0D\u660E\u306A\u906D\u9047\u30AB\u30FC\u30C9\u3067\u3059");
      st.pending.cardId = a.cardId;
      break;
    }
    case "encounter": {
      if (!st.pending || st.pending.type !== "encounter" || !st.pending.cardId) fail("\u906D\u9047\u306F\u3042\u308A\u307E\u305B\u3093");
      doEncounter(st, uid, a, ctx);
      break;
    }
    case "flag": {
      if (!st.pending || st.pending.type !== "flag") fail("\u65D7\u3092\u7F6E\u304F\u5834\u9762\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
      if (!a.skip) {
        p.flags--;
        st.flagHexes.push({ hex: st.pending.hex, owner: uid });
        log(st, uid, "\u65D7\u3092\u8A2D\u7F6E");
      }
      st.pending = null;
      settle(st, uid, ctx);
      break;
    }
    case "coercion": {
      if (p.faction !== "crimea") fail("\u30AF\u30EA\u30DF\u30A2\u3060\u3051\u306E\u80FD\u529B\u3067\u3059");
      if (st.pending) fail("\u51E6\u7406\u4E2D\u306E\u9805\u76EE\u304C\u3042\u308A\u307E\u3059");
      if (t.coerced) fail("\u3053\u306E\u624B\u756A\u3067\u306F\u3059\u3067\u306B\u4F7F\u3044\u307E\u3057\u305F");
      if (p.hand < 1) fail("\u6226\u95D8\u30AB\u30FC\u30C9\u304C\u3042\u308A\u307E\u305B\u3093");
      if (!RES.includes(a.res)) fail("\u8CC7\u6E90\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
      if (controller(st, a.hex) !== uid || !myWorkersAt(st, uid, a.hex)) fail("\u8CC7\u6E90\u306F\u81EA\u5206\u306E\u30EF\u30FC\u30AB\u30FC\u304C\u3044\u308B\u652F\u914D\u9818\u571F\u306B\u7F6E\u304D\u307E\u3059");
      p.hand -= 1;
      ctx.cardPays = (ctx.cardPays || 0) + 1;
      t.coerced = true;
      st.hexes[a.hex].res[a.res] = (st.hexes[a.hex].res[a.res] || 0) + 1;
      log(st, uid, `\u5F37\u8981\uFF1A\u6226\u95D8\u30AB\u30FC\u30C91\u679A \u2192 ${RES_NAMES[a.res]}1\u500B`);
      break;
    }
    case "trap": {
      if (!st.pending || st.pending.type !== "trap") fail("\u7F60\u3092\u7F6E\u304F\u5834\u9762\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
      if (!a.skip) {
        if (!p.traps.includes(a.penalty)) fail("\u305D\u306E\u7F60\u30C8\u30FC\u30AF\u30F3\u306F\u6B8B\u3063\u3066\u3044\u307E\u305B\u3093");
        p.traps = p.traps.filter((x) => x !== a.penalty);
        st.traps.push({ hex: st.pending.hex, owner: uid, penalty: a.penalty, armed: true });
        log(st, uid, "\u7F60\u3092\u8A2D\u7F6E");
      }
      st.pending = null;
      settle(st, uid, ctx);
      break;
    }
    case "factory": {
      if (!st.pending || st.pending.type !== "factory") fail("\u5DE5\u5834\u30AB\u30FC\u30C9\u306E\u9078\u629E\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
      if (!st.factoryCandidates.includes(a.cardId)) fail("\u305D\u306E\u5DE5\u5834\u30AB\u30FC\u30C9\u306F\u9078\u3079\u307E\u305B\u3093");
      p.factory = a.cardId;
      st.factoryCandidates = st.factoryCandidates.filter((c) => c !== a.cardId);
      st.pending = null;
      log(st, uid, `\u5DE5\u5834\u30AB\u30FC\u30C9\u300C${byId(FACTORY_CARDS2, a.cardId).name}\u300D\u3092\u7372\u5F97`);
      settle(st, uid, ctx);
      break;
    }
    case "bottom": {
      if (phase !== "bottom") fail("\u4ECA\u306F\u4E0B\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u9078\u3079\u307E\u305B\u3093");
      if (!t.topTaken) fail("\u4E0B\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u306F\u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u884C\u3063\u305F\u5F8C\u306B\u306E\u307F\u5B9F\u884C\u3067\u304D\u307E\u3059");
      bottomAction(st, uid, a, ctx);
      break;
    }
    case "objective": {
      if (st.pending || phase === "moving") fail("\u51E6\u7406\u4E2D\u306F\u5BA3\u8A00\u3067\u304D\u307E\u305B\u3093");
      doObjective(st, uid, a, ctx);
      break;
    }
    case "endTurn": {
      if (st.pending) fail("\u51E6\u7406\u4E2D\u306E\u9805\u76EE\u304C\u3042\u308A\u307E\u3059");
      if (phase === "section") {
        p.last = p.section;
        p.section = null;
        log(st, uid, "\u4F55\u3082\u884C\u308F\u305A\u306B\u30BF\u30FC\u30F3\u3092\u7D42\u4E86\uFF08\u4F11\u307F\uFF09");
      } else if (phase === "moving") {
        finishMove(st, uid, ctx);
        if (st.pending) break;
      } else if (phase === "top") log(st, uid, "\u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u884C\u308F\u306A\u3044");
      endTurn(st, uid, ctx);
      break;
    }
    default:
      fail("\u4E0D\u660E\u306A\u64CD\u4F5C\u3067\u3059");
  }
  awardStars(st, uid);
  return { state: st, ...ctx };
}
function topAction(st, uid, a, ctx) {
  const p = st.players[uid], t = st.turn;
  const kind = sectionTop(p, p.section);
  if (a.kind === "skip") {
    t.phase = "end";
    log(st, uid, "\u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u884C\u308F\u306A\u3044");
    return;
  }
  if (a.kind !== kind) fail("\u3053\u306E\u30BB\u30AF\u30B7\u30E7\u30F3\u306E\u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
  const done = () => {
    t.topTaken = true;
    t.phase = "bottom";
  };
  if (kind === "move") {
    if (a.mode === "coin") {
      p.coins += 1;
      log(st, uid, "\u30B3\u30A4\u30F3+1\uFF08\u79FB\u52D5\u306E\u4EE3\u308F\u308A\uFF09");
      done();
      return;
    }
    t.topTaken = true;
    startMove(st, uid, "move");
    log(st, uid, "\u79FB\u52D5\u30A2\u30AF\u30B7\u30E7\u30F3");
    return;
  }
  if (kind === "bolster") {
    pay(st, uid, { coins: 1 });
    const ub = p.up?.bolster || 0;
    if (a.mode === "card") grantCards(st, uid, 1 + ub, ctx);
    else p.power = Math.min(POWER_MAX, p.power + 2 + ub);
    if (p.structures.some((s) => s.type === "monument")) p.pop = Math.min(POP_MAX, p.pop + 1);
    log(st, uid, `\u9F13\u821E: ${a.mode === "card" ? "\u6226\u95D8\u30AB\u30FC\u30C9+1" : "\u6226\u529B+2"}`);
    done();
    return;
  }
  if (kind === "trade") {
    pay(st, uid, { coins: 1 });
    const ut = p.up?.trade || 0;
    if (a.mode === "pop") p.pop = Math.min(POP_MAX, p.pop + 1 + ut);
    else {
      const picks = a.res || [];
      if (picks.length !== 2 + ut) fail(`\u8CC7\u6E90\u3092${2 + ut}\u3064\u9078\u3093\u3067\u304F\u3060\u3055\u3044`);
      for (const { type, hex } of picks) {
        if (!RES.includes(type)) fail("\u4E0D\u6B63\u306A\u8CC7\u6E90");
        if (controller(st, hex) !== uid || !myWorkersAt(st, uid, hex)) fail("\u8CC7\u6E90\u306F\u81EA\u5206\u306E\u30EF\u30FC\u30AB\u30FC\u304C\u3044\u308B\u652F\u914D\u9818\u571F\u306B\u7F6E\u304D\u307E\u3059");
        st.hexes[hex].res[type] = (st.hexes[hex].res[type] || 0) + 1;
      }
    }
    if (p.structures.some((s) => s.type === "armory")) p.power = Math.min(POWER_MAX, p.power + 1);
    log(st, uid, `\u4EA4\u6613: ${a.mode === "pop" ? "\u652F\u6301+1" : "\u8CC7\u6E90+2"}`);
    done();
    return;
  }
  if (kind === "produce") {
    doProduce(st, uid, a.hexes, ctx, true);
    done();
    return;
  }
  if (kind === "factory") {
    const card = byId(FACTORY_CARDS2, p.factory);
    payCost(st, uid, card.cost, a, ctx);
    const hex = a.hex || p.char;
    if (card.gain.worker && controller(st, hex) !== uid) fail("\u30EF\u30FC\u30AB\u30FC\u306F\u81EA\u5206\u304C\u652F\u914D\u3059\u308B\u9818\u571F\u306B\u7F6E\u304D\u307E\u3059");
    gain(st, uid, card.gain, hex, ctx);
    log(st, uid, `\u5DE5\u5834\u300C${card.name}\u300D`);
    done();
    enqueueFree(st, hex, card.free, null);
    return;
  }
}
function doMove(st, uid, a, ctx) {
  const p = st.players[uid], mv = st.turn.move;
  const unit = a.unit;
  if (mv.moved.includes(unit)) fail("\u540C\u3058\u30E6\u30CB\u30C3\u30C8\u306F1\u56DE\u306E\u79FB\u52D5\u30A2\u30AF\u30B7\u30E7\u30F3\u30671\u5EA6\u3060\u3051\u3067\u3059");
  const allow = void 0;
  const from = unitHex(st, uid, unit);
  const cand = moveTargets(st, uid, unit, allow).find((c) => c.to === a.to);
  if (!cand) fail("\u305D\u3053\u3078\u306F\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093");
  if (unit[0] !== "w" && hasAbility(st, uid, "toka") && !mv.tokaUsed && !moveTargets(st, uid, unit, allow, { noToka: true }).some((c) => c.to === a.to)) mv.tokaUsed = true;
  for (const [r, n] of Object.entries(a.carry || {})) {
    if (!RES.includes(r) || !Number.isInteger(n) || n < 0) fail("\u4E0D\u6B63\u306A\u904B\u642C\u6307\u5B9A");
    if ((st.hexes[from].res[r] || 0) < n) fail("\u305D\u306E\u8CC7\u6E90\u306F\u9818\u571F\u306B\u3042\u308A\u307E\u305B\u3093");
    st.hexes[from].res[r] -= n;
    st.hexes[a.to].res[r] = (st.hexes[a.to].res[r] || 0) + n;
  }
  const nCarry = Math.max(0, Math.min(+a.workers || 0, 9));
  const via = Array.isArray(a.via) ? a.via.slice(0, 3) : [];
  if (nCarry || via.some((v) => (+v.take || 0) > 0)) {
    if (unit[0] !== "m") fail("\u30EF\u30FC\u30AB\u30FC\u3092\u904B\u3079\u308B\u306E\u306F\u30E1\u30C3\u30AF\u3060\u3051\u3067\u3059");
    const okHex = (h) => !(Object.keys(unitsAt(st, h)).some((u) => u !== uid) || H(h).terrain === "lake" || H(h).terrain === "home" && H(h).home !== p.faction);
    const mi = +unit.slice(1), save3 = p.mechs[mi].hex;
    let cur = from, load3 = [];
    const pick3 = (h, n) => {
      const idx = p.workers.map((w, i) => w === h && !load3.includes(i) ? i : -1).filter((i) => i >= 0);
      if (idx.length < n) fail("\u305D\u3053\u306B\u305D\u308C\u3060\u3051\u306E\u30EF\u30FC\u30AB\u30FC\u304C\u3044\u307E\u305B\u3093");
      load3.push(...idx.slice(0, n));
    };
    pick3(from, nCarry);
    for (const v of via) {
      const reach = cur === from ? moveTargets(st, uid, unit, void 0) : (p.mechs[mi].hex = cur, moveTargets(st, uid, unit, void 0));
      p.mechs[mi].hex = save3;
      if (!reach.some((c) => c.to === v.hex) && v.hex !== from) fail("\u7D4C\u7531\u5730\u3078\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093");
      if (!okHex(v.hex)) fail("\u7D4C\u7531\u5730\u306B\u30EF\u30FC\u30AB\u30FC\u306F\u964D\u308D\u305B\u307E\u305B\u3093");
      const d = Math.max(0, Math.min(+v.drop || 0, load3.length));
      for (const i of load3.splice(0, d)) p.workers[i] = v.hex;
      pick3(v.hex, Math.max(0, +v.take || 0));
      cur = v.hex;
    }
    p.mechs[mi].hex = cur;
    const finalOk = moveTargets(st, uid, unit, void 0).some((c) => c.to === a.to);
    p.mechs[mi].hex = save3;
    if (via.length && !finalOk && cur !== a.to) fail("\u7D4C\u7531\u5730\u304B\u3089\u76EE\u7684\u5730\u3078\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093");
    if (load3.length && !okHex(a.to)) fail("\u305D\u3053\u3078\u30EF\u30FC\u30AB\u30FC\u306F\u904B\u3079\u307E\u305B\u3093");
    for (const i of load3) p.workers[i] = a.to;
  }
  const before = unitsAt(st, a.to);
  setUnitHex(st, uid, unit, a.to);
  mv.moved.push(unit);
  mv.idx++;
  mv.left--;
  const fighter = unit[0] !== "w";
  let stop = false;
  const enemies = Object.keys(before).filter((u) => u !== uid);
  if (fighter && enemies.length) {
    const defender = enemies.find((u) => before[u].char || before[u].mechs);
    if (defender && (st.truces || []).some((x) => x.owner === defender && x.blocked === uid)) fail("\u76F8\u624B\u306E\u4F11\u6226\u52B9\u679C\u3067\u3001\u6B21\u306E\u76F8\u624B\u306E\u624B\u756A\u307E\u3067\u653B\u6483\u3067\u304D\u307E\u305B\u3093");
    if (defender) {
      st.turn.combatWith = { hex: a.to, defender };
      stop = true;
    } else {
      let forced = 0;
      for (const e of enemies) {
        const ep = st.players[e];
        ep.workers = ep.workers.map((w) => {
          if (w === a.to) {
            forced++;
            return homeOf(st, e);
          }
          return w;
        });
      }
      if (!hasAbility(st, uid, "camaraderie")) losePop(st, uid, forced);
      log(st, uid, `\u30EF\u30FC\u30AB\u30FC${forced}\u4EBA\u3092\u9000\u5374\u3055\u305B\u305F`);
    }
  }
  if (unit === "char") st.turn.charMoved = true;
  const trap = enemyTrap(st, uid, a.to);
  if (trap) {
    trap.armed = false;
    stop = true;
    applyPenalty(st, uid, trap.penalty, ctx);
    log(st, uid, `\u7F60\u306B\u304B\u304B\u3063\u305F\uFF01\uFF08${TRAP_PENALTIES[trap.penalty]}\uFF09`);
  }
  const own = (st.traps || []).find((x) => x.hex === a.to && x.owner === uid && !x.armed);
  if (own && unit[0] !== "w" && hasAbility(st, uid, "shinobi") && mv.kind === "move") {
    if (st.turn.combatWith) st.turn.rearm = a.to;
    else {
      own.armed = true;
      log(st, uid, "\u7F60\u3092\u518D\u6B66\u88C5");
    }
  }
  log(st, uid, `${unit === "char" ? "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC" : unit[0] === "m" ? "\u30E1\u30C3\u30AF" : "\u30EF\u30FC\u30AB\u30FC"}\u304C\u79FB\u52D5`);
  if (stop || mv.left <= 0) finishMove(st, uid, ctx);
  else if (unit === "char" && st.hexes[a.to].enc) st.pending = { type: "encounter", hex: a.to, cardId: null };
}
function applyPenalty(st, uid, pen, ctx) {
  const p = st.players[uid];
  if (pen === "pop") p.pop = Math.max(0, p.pop - 2);
  else if (pen === "power") p.power = Math.max(0, p.power - 3);
  else if (pen === "coins") p.coins = Math.max(0, p.coins - 4);
  else if (pen === "cards") {
    const n = Math.min(2, p.hand);
    p.hand -= n;
    ctx.cardPays = (ctx.cardPays || 0) + n;
  }
}
function finishMove(st, uid, ctx) {
  const cw = st.turn.combatWith;
  st.turn.move = null;
  if (cw) {
    st.turn.combatWith = null;
    const defU = unitsAt(st, cw.hex);
    st.combatSeq = (st.combatSeq || 0) + 1;
    for (const u of [uid, cw.defender]) {
      const pl = st.players[u], d = defU[u];
      if (hasAbility(st, u, "ronin") && d && (d.char ? 1 : 0) + d.mechs === 1 && !d.workers) {
        pl.power = Math.min(POWER_MAX, pl.power + 2);
        log(st, u, "\u6D6A\u4EBA\uFF1A\u6226\u529B+2");
      }
    }
    const other = { [uid]: cw.defender, [cw.defender]: uid };
    for (const u of [uid, cw.defender]) {
      const pl = st.players[u], op = st.players[other[u]];
      if (hasAbility(st, u, "artillery") && pl.power >= 1 && op.power > 0) {
        pl.power -= 1;
        op.power = Math.max(0, op.power - 2);
        log(st, u, "\u7832\u6483\uFF1A\u76F8\u624B\u306E\u6226\u529B-2");
      }
      if (hasAbility(st, u, "scout")) {
        grantCards(st, u, 1, ctx);
        log(st, u, "\u5075\u5BDF\uFF1A\u6226\u95D8\u30AB\u30FC\u30C9+1");
      }
      if (u === uid && hasAbility(st, u, "sword") && op.power > 0) {
        op.power = Math.max(0, op.power - 2);
        log(st, u, "\u5263\uFF1A\u76F8\u624B\u306E\u6226\u529B-2");
      }
      if (u === cw.defender && hasAbility(st, u, "shield")) {
        pl.power = Math.min(POWER_MAX, pl.power + 2);
        log(st, u, "\u76FE\uFF1A\u6226\u529B+2");
      }
      const stx = st.hexes[cw.hex].structure;
      if (hasAbility(st, u, "disarm") && (H(cw.hex).tunnel || stx?.type === "mine" && stx.owner === u)) {
        op.power = Math.max(0, op.power - 2);
        log(st, u, "\u6B66\u88C5\u89E3\u9664\uFF1A\u76F8\u624B\u306E\u6226\u529B-2");
      }
    }
    const pa = (u) => hasAbility(st, u, "peoples_army") && st.players[u].workers.includes(cw.hex) ? 1 : 0;
    st.pending = {
      type: "combat",
      seq: st.combatSeq,
      key: `${st.gid}_${st.combatSeq}`,
      hex: cw.hex,
      attacker: uid,
      defender: cw.defender,
      attUnits: (defU[uid]?.char ? 1 : 0) + (defU[uid]?.mechs || 0) + pa(uid),
      defUnits: (defU[cw.defender]?.char ? 1 : 0) + (defU[cw.defender]?.mechs || 0) + pa(cw.defender)
    };
    return;
  }
  settle(st, uid, ctx);
}
function settle(st, uid, ctx) {
  const p = st.players[uid], t = st.turn;
  if (st.pending) return;
  if (t.move) return;
  if (st.hexes[p.char].enc) {
    st.pending = { type: "encounter", hex: p.char, cardId: null };
    return;
  }
  if (p.char === "0,0" && !p.factory && st.factoryCandidates.length && !t.factoryOffered) {
    st.pending = { type: "factory" };
    t.factoryOffered = true;
    return;
  }
  if (p.faction === "togawa" && t.charMoved && !t.trapOffered && p.traps.length && p.char !== homeOf(st, uid) && !(st.traps || []).some((x) => x.hex === p.char)) {
    t.trapOffered = true;
    st.pending = { type: "trap", hex: p.char };
    return;
  }
  if (p.faction === "albion" && t.charMoved && !t.flagOffered && p.flags > 0 && p.char !== homeOf(st, uid) && !(st.flagHexes || []).some((x) => x.hex === p.char) && !(st.traps || []).some((x) => x.hex === p.char)) {
    t.flagOffered = true;
    st.pending = { type: "flag", hex: p.char };
    return;
  }
  t.phase = t.afterMove === "bottom" ? "end" : "bottom";
}
function doCombat(st, uid, a, ctx) {
  const pd = st.pending;
  if (uid !== pd.attacker) fail("\u6226\u95D8\u306E\u89E3\u6C7A\u306F\u653B\u6483\u5074\u304C\u884C\u3044\u307E\u3059");
  const sides = { att: pd.attacker, def: pd.defender };
  const choice = {};
  for (const k of ["att", "def"]) {
    const c = a[k], pl = st.players[sides[k]];
    if (!c || !Number.isInteger(c.dial) || c.dial < 0) fail("\u30C0\u30A4\u30E4\u30EB\u304C\u4E0D\u6B63\u3067\u3059");
    if (c.dial > Math.min(7, pl.power)) fail("\u30C0\u30A4\u30E4\u30EB\u306F\u6226\u529B\u4EE5\u4E0B\u30FB7\u4EE5\u4E0B\u3067\u3059");
    const cards = c.cards || [];
    if (cards.length > (k === "att" ? pd.attUnits : pd.defUnits)) fail("\u6226\u95D8\u30AB\u30FC\u30C9\u306F\u95A2\u4E0E\u30E6\u30CB\u30C3\u30C8\u6570\u307E\u3067\u3067\u3059");
    if (cards.length > pl.hand) fail("\u624B\u672D\u304C\u8DB3\u308A\u307E\u305B\u3093");
    if (!cards.every((v) => [2, 3, 4, 5].includes(v))) fail("\u4E0D\u6B63\u306A\u6226\u95D8\u30AB\u30FC\u30C9");
    choice[k] = { dial: c.dial, cards, sum: c.dial + cards.reduce((s, v) => s + v, 0) };
  }
  const attWins = choice.att.sum >= choice.def.sum;
  const winner = attWins ? pd.attacker : pd.defender, loser = attWins ? pd.defender : pd.attacker;
  const lp = st.players[loser], wp = st.players[winner];
  for (const k of ["att", "def"]) {
    const pl = st.players[sides[k]];
    pl.power = Math.max(0, pl.power - choice[k].dial);
    pl.hand -= choice[k].cards.length;
    for (const v of choice[k].cards) ctx.discards[v] = (ctx.discards[v] || 0) + 1;
  }
  let workersForced = 0;
  if (lp.char === pd.hex) lp.char = homeOf(st, loser);
  lp.mechs.forEach((m) => {
    if (m.hex === pd.hex) m.hex = homeOf(st, loser);
  });
  lp.workers = lp.workers.map((w) => {
    if (w === pd.hex) {
      workersForced++;
      return homeOf(st, loser);
    }
    return w;
  });
  if (attWins && workersForced && !hasAbility(st, winner, "camaraderie")) losePop(st, winner, workersForced);
  const revealed = choice[loser === pd.attacker ? "att" : "def"];
  if (revealed.sum > 0) grantCards(st, loser, 1, ctx);
  const maxStars = wp.faction === "saxony" ? Infinity : 2;
  if (wp.combatWins < maxStars) {
    wp.combatWins++;
    addStar(st, winner, `combat${wp.combatWins}`);
  }
  log(st, winner, `\u6226\u95D8\u306B\u52DD\u5229\uFF08${choice.att.sum} \u5BFE ${choice.def.sum}\uFF09`);
  st.lastCombat = { hex: pd.hex, att: choice.att, def: choice.def, winner };
  if (st.turn.rearm === pd.hex && winner === pd.attacker) {
    const tr = (st.traps || []).find((x) => x.hex === pd.hex && x.owner === pd.attacker);
    if (tr) {
      tr.armed = true;
      log(st, winner, "\u7F60\u3092\u518D\u6B66\u88C5");
    }
  }
  st.turn.rearm = null;
  st.pending = null;
  settle(st, uid, ctx);
}
function payCost(st, uid, cost, a, ctx) {
  const p = st.players[uid];
  const { card = 0, anyRes = 0, diff, ...rest } = cost || {};
  if (p.hand < card) fail("\u6226\u95D8\u30AB\u30FC\u30C9\u304C\u8DB3\u308A\u307E\u305B\u3093");
  const types = a && a.payRes || [];
  if (anyRes) {
    if (types.length !== anyRes) fail(`\u652F\u6255\u3046\u8CC7\u6E90\u3092${anyRes}\u500B\u9078\u3093\u3067\u304F\u3060\u3055\u3044`);
    if (diff && new Set(types).size !== types.length) fail("\u7570\u306A\u308B\u7A2E\u985E\u306E\u8CC7\u6E90\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    for (const ty of types) if (!RES.includes(ty)) fail("\u4E0D\u6B63\u306A\u8CC7\u6E90");
  }
  const need = { ...rest };
  for (const ty of types) need[ty] = (need[ty] || 0) + 1;
  pay(st, uid, need);
  if (card) {
    p.hand -= card;
    ctx.cardPays = (ctx.cardPays || 0) + card;
  }
}
function enqueueFree(st, hex, items, after) {
  if (!items.length) return false;
  st.pending = { type: "free", queue: items.map((x) => ({ ...x })), hex, after };
  return true;
}
function doProduce(st, uid, hexes2, ctx, paid = false) {
  const p = st.players[uid];
  hexes2 = [...new Set(hexes2 || [])];
  const lim = 2 + (p.up?.produce || 0);
  if (!hexes2.length) fail("\u751F\u7523\u3067\u304D\u308B\u9818\u571F\u304C\u3042\u308A\u307E\u305B\u3093");
  if (hexes2.length > lim) fail(`\u751F\u7523\u3067\u304D\u308B\u9818\u571F\u306F\u6700\u5927${lim}\u304B\u6240\u3067\u3059`);
  if (paid) {
    const c = produceCost(p.workers.length);
    if (Object.keys(c).length) {
      if (!canPay(st, uid, c)) fail("\u751F\u7523\u306E\u30B3\u30B9\u30C8\u3092\u6255\u3048\u307E\u305B\u3093");
      pay(st, uid, c);
    }
  }
  for (const h of hexes2) {
    if (controller(st, h) !== uid) fail("\u652F\u914D\u3057\u3066\u3044\u308B\u9818\u571F\u3067\u751F\u7523\u3057\u307E\u3059");
    const mill = p.structures.some((s) => s.type === "mill" && s.hex === h) ? 1 : 0;
    const n = myWorkersAt(st, uid, h) + mill;
    if (!n) fail("\u30EF\u30FC\u30AB\u30FC\u306E\u3044\u306A\u3044\u9818\u571F\u3067\u306F\u751F\u7523\u3067\u304D\u307E\u305B\u3093");
    const terr = H(h).terrain;
    if (terr === "village") gain(st, uid, { worker: n }, h, ctx);
    else if (TERRAIN_RES[terr]) st.hexes[h].res[TERRAIN_RES[terr]] = (st.hexes[h].res[TERRAIN_RES[terr]] || 0) + n;
    else fail("\u3053\u306E\u5730\u5F62\u3067\u306F\u751F\u7523\u3067\u304D\u307E\u305B\u3093");
  }
  log(st, uid, `\u751F\u7523\uFF08${hexes2.length}\u304B\u6240\uFF09`);
}
function doFree(st, uid, a, ctx) {
  const pd = st.pending, head = pd.queue[0], p = st.players[uid];
  if (a.skip) {
    log(st, uid, "\u7121\u6599\u52B9\u679C\u3092\u884C\u308F\u306A\u3044");
  } else {
    const kind = a.kind;
    if (head.alt ? !head.alt.includes(kind) : head.k !== kind) fail("\u305D\u306E\u52B9\u679C\u306F\u4ECA\u306F\u9078\u3079\u307E\u305B\u3093");
    if (["build", "upgrade", "deploy", "enlist"].includes(kind)) runBottom(st, uid, kind, a, ctx, true);
    else if (kind === "produce") doProduce(st, uid, a.hexes, ctx);
    else if (kind === "anyRes") {
      const types = a.res || [];
      if (types.length !== head.n) fail(`\u8CC7\u6E90\u3092${head.n}\u500B\u9078\u3093\u3067\u304F\u3060\u3055\u3044`);
      const hex = a.hex || pd.hex;
      if (controller(st, hex) !== uid) fail("\u8CC7\u6E90\u306F\u81EA\u5206\u304C\u652F\u914D\u3059\u308B\u9818\u571F\u306B\u7F6E\u304D\u307E\u3059");
      for (const ty of types) {
        if (!RES.includes(ty)) fail("\u4E0D\u6B63\u306A\u8CC7\u6E90");
        st.hexes[hex].res[ty] = (st.hexes[hex].res[ty] || 0) + 1;
      }
      log(st, uid, `\u8CC7\u6E90${head.n}\u500B\u3092\u7372\u5F97`);
    } else if (kind === "reposition") {
      const unit = head.unit === "char" ? "char" : a.unit;
      if (!unit || unit !== "char" && !p.mechs[+String(unit).slice(1)]) fail("\u52D5\u304B\u3059\u30E6\u30CB\u30C3\u30C8\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
      if (!repoTargets(st, uid, unit, head.mode).includes(a.hex)) fail("\u305D\u3053\u3078\u306F\u79FB\u305B\u307E\u305B\u3093");
      setUnitHex(st, uid, unit, a.hex);
      if (unit === "char") pd.hex = a.hex;
      log(st, uid, `${unit === "char" ? "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC" : "\u30E1\u30C3\u30AF"}\u3092${a.hex}\u3078\u914D\u7F6E`);
    } else if (kind === "recall") {
      if (!H(a.hex) || H(a.hex).terrain !== "village" || !Object.keys(unitsAt(st, a.hex)).length) fail("\u30E6\u30CB\u30C3\u30C8\u306E\u3044\u308B\u6751\u9818\u571F\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
      for (const u of Object.keys(st.players)) {
        const q = st.players[u], home = homeOf(st, u);
        if (q.char === a.hex) q.char = home;
        q.mechs.forEach((m) => {
          if (m.hex === a.hex) m.hex = home;
        });
        q.workers = q.workers.map((w) => w === a.hex ? home : w);
      }
      log(st, uid, `${a.hex}\u306E\u30E6\u30CB\u30C3\u30C8\u3092\u5404\u672C\u62E0\u5730\u3078\u623B\u3057\u305F`);
    } else if (kind === "moveToken") {
      if (!st.hexes[a.from]?.enc || !emptyLand(st, a.to) || st.hexes[a.to].enc || a.to === "0,0") fail("\u79FB\u305B\u307E\u305B\u3093\uFF08\u79FB\u52D5\u5143\u306B\u906D\u9047\u30C8\u30FC\u30AF\u30F3\u3001\u79FB\u52D5\u5148\u306F\u7A7A\u306E\u9678\u5730\uFF09");
      st.hexes[a.from].enc = false;
      st.hexes[a.to].enc = true;
      log(st, uid, `\u906D\u9047\u30C8\u30FC\u30AF\u30F3\u3092${a.from}\u2192${a.to}\u3078\u79FB\u3057\u305F`);
    } else if (kind === "trapPlace") {
      if (!(p.traps || []).includes(a.penalty)) fail("\u305D\u306E\u7F60\u30C8\u30FC\u30AF\u30F3\u306F\u3042\u308A\u307E\u305B\u3093");
      if (!emptyLand(st, a.hex) || (st.traps || []).some((x) => x.hex === a.hex)) fail("\u7A7A\u306E\u9678\u5730\u306B\u7F6E\u304D\u307E\u3059");
      p.traps = p.traps.filter((x) => x !== a.penalty);
      st.traps.push({ hex: a.hex, owner: uid, penalty: a.penalty, armed: true });
      log(st, uid, "\u7F60\u3092\u8A2D\u7F6E");
    } else fail("\u4E0D\u660E\u306A\u52B9\u679C\u3067\u3059");
  }
  pd.queue.shift();
  if (!pd.queue.length) {
    st.pending = null;
    if (pd.after === "settle") settle(st, uid, ctx);
  }
}
function encAvail(st, uid, opt) {
  if (opt.unsupported || !canPay(st, uid, opt.cost)) return false;
  const p = st.players[uid];
  for (const f of opt.free || []) {
    if (f.k === "reposition" && f.unit === "mech" && !p.mechs.length) return false;
    if (f.k === "reposition" && repoTargets(st, uid, f.unit === "char" ? "char" : "m0", f.mode, true).length === 0 && !(f.unit === "mech" && p.mechs.some((_, i) => repoTargets(st, uid, `m${i}`, f.mode).length))) return false;
    if (f.k === "recall" && !MAP.ids.some((h) => H(h).terrain === "village" && Object.keys(unitsAt(st, h)).length)) return false;
    if (f.k === "moveToken" && !MAP.ids.some((h) => st.hexes[h].enc)) return false;
    if (f.k === "trapPlace" && !(p.traps || []).length) return false;
  }
  if (opt.fx === "factoryRand" && (p.factory || !st.factoryCandidates.length)) return false;
  if (opt.fx === "truce" && Object.keys(st.players).length < 2) return false;
  return true;
}
var emptyLand = (st, h) => H(h) && H(h).terrain !== "lake" && H(h).terrain !== "home" && !Object.keys(unitsAt(st, h)).length;
function repoTargets(st, uid, unit, mode) {
  const p = st.players[uid], from = unitHex(st, uid, unit);
  if (!from) return [];
  if (mode === "any") return MAP.ids.filter((h) => h !== from && emptyLand(st, h));
  if (mode === "adj") return H(from).nb.filter((h) => emptyLand(st, h));
  return MAP.ids.filter((h) => h !== from && (H(h).tunnel || p.structures.some((s) => s.type === "mine" && s.hex === h)) && H(h).terrain !== "lake" && !Object.keys(unitsAt(st, h)).some((u) => u !== uid));
}
function doEncounter(st, uid, a, ctx) {
  const p = st.players[uid], pd = st.pending;
  const card = byId(ENCOUNTERS2, pd.cardId);
  const picks = a.picks || [];
  const max = p.faction === "polania" ? 2 : 1;
  if (picks.length > max) fail(`\u9078\u629E\u80A2\u306F${max}\u3064\u307E\u3067\u3067\u3059`);
  if (new Set(picks).size !== picks.length) fail("\u540C\u3058\u9078\u629E\u80A2\u306F\u9078\u3079\u307E\u305B\u3093");
  if (!picks.length && card.options.some((o2) => encAvail(st, uid, o2))) fail("\u9078\u3079\u308B\u9078\u629E\u80A2\u304C\u3042\u308A\u307E\u3059");
  const items = [];
  for (const i of picks) {
    const opt = card.options[i];
    if (!opt) fail("\u4E0D\u6B63\u306A\u9078\u629E\u80A2");
    if (opt.unsupported) fail("\u3053\u306E\u9078\u629E\u80A2\u306F\u307E\u3060\u5B9F\u88C5\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    if (!encAvail(st, uid, opt)) fail("\u305D\u306E\u9078\u629E\u80A2\u306F\u4ECA\u306F\u9078\u3079\u307E\u305B\u3093");
    payCost(st, uid, opt.cost, a, ctx);
    gain(st, uid, opt.gain, pd.hex, ctx);
    items.push(...opt.free);
    if (opt.fx === "leadPower") {
      if (Object.entries(st.players).every(([u, q]) => u === uid || q.power < p.power)) items.push({ k: "anyRes", n: 2 });
    } else if (opt.fx === "topCombat") {
      const r = Math.random() * 42;
      const v = r < 16 ? 2 : r < 28 ? 3 : r < 36 ? 4 : 5;
      p.power = Math.min(POWER_MAX, p.power + v);
      ctx.discards[v] = (ctx.discards[v] || 0) + 1;
      log(st, uid, `\u6226\u95D8\u30AB\u30FC\u30C9${v}\u3092\u516C\u958B\uFF1A\u6226\u529B+${v}`);
    } else if (opt.fx === "factoryRand") {
      const c = st.factoryCandidates[Math.floor(Math.random() * st.factoryCandidates.length)];
      p.factory = c;
      st.factoryCandidates = st.factoryCandidates.filter((x) => x !== c);
      log(st, uid, `\u5DE5\u5834\u30AB\u30FC\u30C9\u300C${byId(FACTORY_CARDS2, c).name}\u300D\u3092\u7372\u5F97`);
    } else if (opt.fx === "combatStar") {
      addStar(st, uid, `combatE${p.stars.length}`);
    } else if (opt.fx === "truce") {
      if (!st.players[a.target] || a.target === uid) fail("\u5BFE\u8C61\u306E\u76F8\u624B\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
      (st.truces ||= []).push({ owner: uid, blocked: a.target });
      log(st, uid, `${st.players[a.target].faction}\u306F\u6B21\u306E\u624B\u756A\u958B\u59CB\u307E\u3067\u653B\u6483\u3067\u304D\u306A\u3044`);
    } else if (opt.fx === "objSwap") {
      if (!a.objId) fail("\u6368\u3066\u308B\u76EE\u7684\u30AB\u30FC\u30C9\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
      ctx.objSwap = a.objId;
    }
  }
  st.hexes[pd.hex].enc = false;
  log(st, uid, picks.length ? `\u906D\u9047#${card.no}\u3092\u89E3\u6C7A` : `\u906D\u9047#${card.no}\uFF1A\u9078\u3079\u308B\u9078\u629E\u80A2\u304C\u306A\u304F\u898B\u9001\u308A`);
  st.pending = null;
  if (!enqueueFree(st, pd.hex, items, "settle")) settle(st, uid, ctx);
}
function bottomAction(st, uid, a, ctx) {
  const p = st.players[uid], t = st.turn;
  const kind = sectionBottom(p, p.section);
  if (a.kind === "skip") {
    t.phase = "end";
    log(st, uid, "\u4E0B\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u884C\u308F\u306A\u3044");
    return;
  }
  if (kind === "factoryMove") {
    if (a.kind !== "factoryMove") fail("\u5DE5\u5834\u30BB\u30AF\u30B7\u30E7\u30F3\u306E\u4E0B\u6BB5\u306F\u79FB\u52D5\u3067\u3059");
    t.afterMove = "bottom";
    startMove(st, uid, "factoryMove");
    log(st, uid, "\u5DE5\u5834\u306E\u79FB\u52D5");
    return;
  }
  if (a.kind !== kind) fail("\u3053\u306E\u30BB\u30AF\u30B7\u30E7\u30F3\u306E\u4E0B\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
  runBottom(st, uid, kind, a, ctx, false);
  t.phase = "end";
}
function runBottom(st, uid, kind, a, ctx, free) {
  const p = st.players[uid];
  const m = BASE_MATS[p.mat].lower[kind];
  const cost = Math.max(0, m[0] - p.red[kind]);
  const res = BOTTOM_RES[kind];
  const needPay = free ? {} : { [res]: cost };
  const hexOk = (h) => {
    if (!h || !H(h)) fail("\u9818\u571F\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    if (controller(st, h) !== uid || !myWorkersAt(st, uid, h)) fail("\u30EF\u30FC\u30AB\u30FC\u306E\u3044\u308B\u652F\u914D\u9818\u571F\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    if (["lake", "home"].includes(H(h).terrain)) fail("\u6E56\u3068\u672C\u62E0\u5730\u306B\u306F\u7F6E\u3051\u307E\u305B\u3093");
  };
  if (kind === "upgrade") {
    if (p.cubes >= 6) fail("\u6539\u826F\u306F\u3059\u3079\u3066\u5B8C\u4E86\u3057\u3066\u3044\u307E\u3059");
    const slot = a.slot, top = a.top;
    if (!BOTTOM_ORDER.includes(slot)) fail("\u57CB\u3081\u308B\u4E0B\u6BB5\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    if (!TOP_CUBES[top] || (p.up[top] || 0) >= TOP_CUBES[top]) fail("\u305D\u306E\u4E0A\u6BB5\u306B\u306F\u3082\u3046\u30AD\u30E5\u30FC\u30D6\u304C\u3042\u308A\u307E\u305B\u3093");
    if (p.red[slot] >= BASE_MATS[p.mat].lower[slot][1]) fail("\u305D\u306E\u4E0B\u6BB5\u306B\u306F\u3082\u3046\u7F6E\u3051\u307E\u305B\u3093");
    pay(st, uid, needPay);
    p.up[top] = (p.up[top] || 0) + 1;
    p.red[slot]++;
    p.cubes++;
    log(st, uid, `\u6539\u826F\uFF08${top}\u306E\u5F37\u5316\u30FB${slot}\u306E\u30B3\u30B9\u30C8-1\uFF09`);
  } else if (kind === "deploy") {
    if (p.mechs.length >= 4) fail("\u30E1\u30C3\u30AF\u306F\u3059\u3079\u3066\u914D\u5099\u6E08\u307F\u3067\u3059");
    const slot = a.slot;
    if (!(slot >= 0 && slot <= 3) || p.mechs.some((x) => x.slot === slot)) fail("\u914D\u5099\u3059\u308B\u30E1\u30C3\u30AF\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    hexOk(a.hex);
    pay(st, uid, needPay);
    p.mechs.push({ slot, hex: a.hex });
    log(st, uid, `\u30E1\u30C3\u30AF\u914D\u5099\uFF08${MECH_SLOTS[p.faction][slot]}\uFF09`);
  } else if (kind === "build") {
    const type = a.type;
    if (!STRUCTS.includes(type) || p.structures.some((s) => s.type === type)) fail("\u5EFA\u8A2D\u3059\u308B\u5EFA\u7269\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    hexOk(a.hex);
    if (st.hexes[a.hex].structure) fail("\u305D\u306E\u9818\u571F\u306B\u306F\u3059\u3067\u306B\u5EFA\u7269\u304C\u3042\u308A\u307E\u3059");
    pay(st, uid, needPay);
    st.hexes[a.hex].structure = { owner: uid, type };
    p.structures.push({ type, hex: a.hex });
    log(st, uid, `${type}\u3092\u5EFA\u8A2D`);
  } else if (kind === "enlist") {
    if (p.recruits.length >= 4) fail("\u5FB4\u5175\u306F\u3059\u3079\u3066\u5B8C\u4E86\u3057\u3066\u3044\u307E\u3059");
    const from = a.from, bonus = a.bonus;
    if (!BOTTOM_ORDER.includes(from) || p.recruits.some((r) => r.section === from)) fail("\u5FB4\u5175\u30C8\u30FC\u30AF\u30F3\u306E\u53D6\u5F97\u5143\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    if (!RECRUIT_ONETIME.includes(bonus) || p.recruits.some((r) => r.bonus === bonus)) fail("\u4E00\u6642\u30DC\u30FC\u30CA\u30B9\u306E\u7A7A\u304D\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    pay(st, uid, needPay);
    p.recruits.push({ section: from, bonus });
    gain(st, uid, { [bonus === "card" ? "card" : bonus]: 2 }, p.char, ctx);
    log(st, uid, `\u5FB4\u5175\uFF08\u4E00\u6642\u30DC\u30FC\u30CA\u30B9: ${bonus}\uFF09`);
  }
  if (free) return;
  p.coins += m[2];
  const i = st.order.indexOf(uid), n = st.order.length;
  const chain = [.../* @__PURE__ */ new Set([uid, st.order[(i + 1) % n], st.order[(i + n - 1) % n]])];
  for (const u of chain) {
    for (const r of st.players[u].recruits) if (r.section === kind) {
      gain(st, u, RECRUIT_ONGOING[kind], st.players[u].char, ctx);
      log(st, u, `\u5FB4\u5175\u306E\u5E38\u6642\u30DC\u30FC\u30CA\u30B9\u7372\u5F97\uFF08${kind}\uFF09`);
    }
  }
}
function objectiveHelpers(st, uid) {
  const p = st.players[uid];
  const cs = controlled(st, uid);
  const rt = resTotals(st, uid);
  const count = { mountain: 0, farm: 0, tundra: 0, forest: 0, village: 0 };
  for (const h of cs) if (count[H(h).terrain] !== void 0) count[H(h).terrain]++;
  const prod = new Set(cs.filter((h) => TERRAIN_RES[H(h).terrain] && myWorkersAt(st, uid, h)).map((h) => H(h).terrain));
  const at = (h) => ({ char: p.char === h, mech: p.mechs.some((m) => m.hex === h), worker: p.workers.includes(h) });
  return {
    controlled: cs.length + (cs.includes("0,0") ? 2 : 0),
    cs,
    rt,
    count,
    at,
    resAt: (h) => Object.values(st.hexes[h].res).reduce((x, v) => x + v, 0),
    prodTypes: prod.size,
    charAtHome: H(p.char).terrain === "home",
    factoryAdjWorkers: p.workers.filter((w) => H("0,0").nb.includes(w)).length,
    structNearHome: p.structures.some((s) => H(s.hex).nb.some((n) => H(n).terrain === "home")),
    workers: p.workers.length,
    structures: p.structures.length,
    resTotal: Object.values(rt).reduce((x, v) => x + v, 0),
    hasFactory: cs.includes("0,0"),
    hasLake: cs.some((h) => H(h).terrain === "lake"),
    mountains: count.mountain,
    farms: count.farm
  };
}
function doObjective(st, uid, a, ctx) {
  const p = st.players[uid];
  const card = byId(OBJECTIVES2, a.cardId);
  if (!card) fail("\u4E0D\u660E\u306A\u76EE\u7684\u30AB\u30FC\u30C9\u3067\u3059");
  if (p.objs <= 0) fail("\u76EE\u7684\u30AB\u30FC\u30C9\u3092\u6301\u3063\u3066\u3044\u307E\u305B\u3093");
  const key = !p.stars.includes("objective") ? "objective" : p.faction === "saxony" && !p.stars.includes("objective2") ? "objective2" : null;
  if (!key) fail("\u76EE\u7684\u306E\u661F\u306F\u3053\u308C\u4EE5\u4E0A\u7F6E\u3051\u307E\u305B\u3093");
  if (!card.check({ ...p, cubes: p.cubes }, objectiveHelpers(st, uid))) fail("\u76EE\u7684\u3092\u9054\u6210\u3057\u3066\u3044\u307E\u305B\u3093");
  p.objs--;
  addStar(st, uid, key);
  log(st, uid, `\u76EE\u7684\u300C${card.name}\u300D\u3092\u9054\u6210`);
}
function addStar(st, uid, key) {
  const p = st.players[uid];
  if (p.stars.includes(key) || p.stars.length >= STAR_MAX) return;
  p.stars.push(key);
  log(st, uid, `\u661F\u3092\u7372\u5F97\uFF08${key}\uFF09`);
  if (p.stars.length >= STAR_MAX && !st.over) {
    st.over = true;
    st.result = computeScores(st);
  }
}
function awardStars(st, uid) {
  for (const [u, p] of Object.entries(st.players)) {
    if (p.cubes >= 6) addStar(st, u, "upgrades");
    if (p.mechs.length >= 4) addStar(st, u, "mechs");
    if (p.structures.length >= 4) addStar(st, u, "structures");
    if (p.recruits.length >= 4) addStar(st, u, "recruits");
    if (p.workers.length >= 8) addStar(st, u, "workers");
    if (p.pop >= POP_MAX) addStar(st, u, "popularity");
    if (p.power >= POWER_MAX) addStar(st, u, "power");
  }
}
var popTier = (pop) => pop <= 6 ? { star: 3, terr: 2, res: 1 } : pop <= 12 ? { star: 4, terr: 3, res: 2 } : { star: 5, terr: 4, res: 3 };
function scoreOf(st, uid) {
  const p = st.players[uid];
  const tier = popTier(p.pop);
  const cs = controlled(st, uid);
  const flagTerr = (st.flagHexes || []).filter((f) => f.owner === uid && controller(st, f.hex) === uid && !H(homeOf(st, uid)).nb.includes(f.hex)).length;
  const terr = cs.length + (cs.includes("0,0") ? 2 : 0) + flagTerr;
  const rt = Object.values(resTotals(st, uid)).reduce((s, v) => s + v, 0);
  const tile = byId(BONUS_TILES, st.bonusTile);
  const bonusN = tile ? p.structures.filter((s) => tile.test(H(s.hex), MAP)).length : 0;
  const parts = {
    coins: p.coins + (p.faction === "polania" && Object.keys(st.players).length >= 6 ? 3 * cs.filter((h) => H(h).encounter).length : 0),
    stars: p.stars.length * tier.star,
    territories: terr * tier.terr,
    resources: Math.floor(rt / 2) * tier.res,
    structureBonus: bonusN * (tile?.perStructure || 0)
  };
  return { uid, total: Object.values(parts).reduce((s, v) => s + v, 0), parts, tier, terr, resCount: rt };
}
function computeScores(st) {
  const rows = Object.keys(st.players).map((uid) => {
    const p = st.players[uid], s = scoreOf(st, uid);
    s.tie = [p.workers.length + p.mechs.length + p.structures.length, p.power, p.pop, s.resCount, s.terr, p.stars.length];
    return s;
  });
  rows.sort((a, b) => b.total - a.total || cmpTie(b.tie, a.tie));
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return { rows, winner: rows[0].uid };
}
var cmpTie = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
function endTurn(st, uid, ctx) {
  const t = st.turn;
  log(st, uid, "\u624B\u756A\u7D42\u4E86");
  if (st.over) return;
  const i = st.order.indexOf(uid);
  st.turnUid = st.order[(i + 1) % st.order.length];
  st.turnNo++;
  st.turn = { phase: "section" };
  st.truces = (st.truces || []).filter((x) => x.owner !== st.turnUid);
  void t;
  void ctx;
}
function producibleHexes(st, uid) {
  return controlled(st, uid).filter((h) => myWorkersAt(st, uid, h) && (H(h).terrain === "village" || TERRAIN_RES[H(h).terrain]));
}
function canDo(st, uid, kind, free = false, conv = false) {
  const p = st.players[uid], m = BASE_MATS[p.mat];
  const wHex = controlled(st, uid).some((h) => myWorkersAt(st, uid, h) && !["lake", "home"].includes(H(h).terrain));
  const afford = (k) => {
    if (free) return true;
    const r = BOTTOM_RES[k], need = Math.max(0, m.lower[k][0] - p.red[k]), have = total(st, uid, r) + (conv && p.faction === "crimea" && p.hand > 0 && !st.turn.coerced ? 1 : 0);
    if (have >= need) return true;
    if (!conv || !wHex) return false;
    const others = ["oil", "metal", "wood", "food"].filter((x) => x !== r).reduce((s, x) => s + total(st, uid, x), 0);
    return Math.floor(others / 2) >= need - have;
  };
  switch (kind) {
    case "upgrade":
      return p.cubes < 6 && afford(kind) && Object.keys(TOP_CUBES).some((t) => (p.up[t] || 0) < TOP_CUBES[t]) && BOTTOM_ORDER.some((x) => p.red[x] < m.lower[x][1]);
    case "deploy":
      return p.mechs.length < 4 && wHex && afford(kind);
    case "build":
      return STRUCTS.some((x) => !p.structures.some((q) => q.type === x)) && wHex && afford(kind);
    case "enlist":
      return p.recruits.length < 4 && afford(kind);
    case "produce":
      return producibleHexes(st, uid).length > 0 && (free || canPay(st, uid, produceCost(p.workers.length)));
    case "anyRes":
      return controlled(st, uid).length > 0;
    case "bolster":
    case "trade":
      return p.coins >= 1;
    default:
      return true;
  }
}

// public/js/net.js
import { doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// public/js/engine/combat.js
async function commitChoice(choice, nonce) {
  const data = new TextEncoder().encode(JSON.stringify({ choice, nonce }));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// public/js/net.js
var pick2 = (arr) => arr[Math.floor(Math.random() * arr.length)];
var sum = (o2) => Object.values(o2).reduce((s, v) => s + v, 0);
var rid32 = () => [...crypto.getRandomValues(new Uint8Array(6))].map((x) => x.toString(16).padStart(2, "0")).join("");
function makeNet(db2, roomId2, uid) {
  const roomRef2 = doc(db2, "rooms", roomId2);
  const deckRef = doc(db2, "rooms", roomId2, "pub", "deck");
  const privRef = doc(db2, "rooms", roomId2, "private", uid);
  const combatRef = (key) => doc(db2, "rooms", roomId2, "pub", `combat_${key}`);
  const gamePatch = (room2, st) => ({ game: { turnUid: st.turnUid, json: JSON.stringify(st), over: st.over }, revision: room2.revision + 1 });
  async function dispatch(action) {
    return runTransaction(db2, async (tx) => {
      const rs = await tx.get(roomRef2);
      const ds = await tx.get(deckRef);
      const ps = await tx.get(privRef);
      const room2 = rs.data();
      const deck = ds.data();
      const res = apply(JSON.parse(room2.game.json), uid, action);
      tx.update(roomRef2, gamePatch(room2, res.state));
      const upd = {};
      if (res.cardPays) {
        const hand = [...ps.data()?.hand || []].sort((x, y) => x.value - y.value);
        const gone = hand.splice(0, res.cardPays);
        for (const c of gone) res.discards[c.value] = (res.discards[c.value] || 0) + 1;
        tx.set(privRef, { hand }, { merge: true });
      }
      if (res.objSwap) {
        const priv = ps.data() || { hand: [], objectives: [] };
        const objs = (priv.objectives || []).filter((o2) => o2 !== res.objSwap);
        if (objs.length === (priv.objectives || []).length) throw new Error("\u305D\u306E\u76EE\u7684\u30AB\u30FC\u30C9\u306F\u6301\u3063\u3066\u3044\u307E\u305B\u3093");
        tx.set(privRef, { objectives: objs }, { merge: true });
        res.grants[uid] = res.grants[uid] || 0;
        upd[`objGrants.${uid}`] = (deck.objGrants?.[uid] || 0) + 1;
        upd.objPool = [...deck.objPool || [], res.objSwap];
      }
      for (const [u, n] of Object.entries(res.grants)) upd[`grants.${u}`] = (deck.grants?.[u] || 0) + n;
      for (const [v, n] of Object.entries(res.discards)) upd[`discards.${v}`] = (deck.discards?.[v] || 0) + n;
      if (Object.keys(upd).length) tx.update(deckRef, upd);
      return res.state;
    });
  }
  async function drawEncounter() {
    return runTransaction(db2, async (tx) => {
      const rs = await tx.get(roomRef2);
      const ds = await tx.get(deckRef);
      const room2 = rs.data();
      const deck = ds.data();
      let rem = deck.encRemaining?.length ? deck.encRemaining : deck.encAll || ENCOUNTERS2.map((e) => e.id);
      const cardId = pick2(rem);
      rem = rem.filter((c) => c !== cardId);
      const res = apply(JSON.parse(room2.game.json), uid, { t: "encounterDraw", cardId });
      tx.update(roomRef2, gamePatch(room2, res.state));
      tx.update(deckRef, { encRemaining: rem });
    });
  }
  async function claim() {
    return runTransaction(db2, async (tx) => {
      const ds = await tx.get(deckRef);
      const ps = await tx.get(privRef);
      const deck = ds.data();
      const priv = ps.exists() ? ps.data() : { hand: [], objectives: [] };
      const gN = deck.grants?.[uid] || 0, oN = deck.objGrants?.[uid] || 0;
      if (!gN && !oN) return false;
      let counts = { ...deck.counts }, discards = { ...deck.discards };
      const hand = [...priv.hand || []];
      for (let i = 0; i < gN; i++) {
        if (sum(counts) === 0) {
          counts = { ...discards };
          discards = { 2: 0, 3: 0, 4: 0, 5: 0 };
        }
        if (sum(counts) === 0) break;
        let r = Math.random() * sum(counts), v = 2;
        for (const k of [2, 3, 4, 5]) {
          if (r < counts[k]) {
            v = k;
            break;
          }
          r -= counts[k];
          v = k;
        }
        counts[v]--;
        hand.push({ id: `c_${rid32()}`, value: v });
      }
      let objPool = [...deck.objPool || []];
      const objectives = [...priv.objectives || []];
      for (let i = 0; i < oN && objPool.length; i++) {
        const o2 = pick2(objPool);
        objPool = objPool.filter((x) => x !== o2);
        objectives.push(o2);
      }
      tx.set(privRef, { ...priv, hand, objectives }, { merge: true });
      tx.update(deckRef, { counts, discards, objPool, [`grants.${uid}`]: 0, [`objGrants.${uid}`]: 0 });
      return true;
    });
  }
  async function commitCombat(key, dial, cardIds) {
    const ps = await getDoc(privRef);
    const priv = ps.data() || { hand: [] };
    const cards = cardIds.map((id) => priv.hand.find((c) => c.id === id)?.value).filter(Boolean);
    const choice = { dial, cards };
    const nonce = rid32();
    const hash = await commitChoice(choice, nonce);
    await setDoc(privRef, { combat: { key, choice, nonce, cardIds, removed: false } }, { merge: true });
    await setDoc(combatRef(key), { commits: { [uid]: hash } }, { merge: true });
  }
  async function revealCombat(key) {
    const ps = await getDoc(privRef);
    const priv = ps.data();
    const c = priv?.combat;
    if (!c || c.key !== key) return;
    await setDoc(combatRef(key), { reveals: { [uid]: { choice: c.choice, nonce: c.nonce } } }, { merge: true });
    if (!c.removed) {
      const hand = (priv.hand || []).filter((x) => !c.cardIds.includes(x.id));
      await setDoc(privRef, { hand, combat: { ...c, removed: true } }, { merge: true });
    }
  }
  async function verifyReveal(key, who, data) {
    const r = data?.reveals?.[who], h = data?.commits?.[who];
    if (!r || !h) return null;
    return await commitChoice(r.choice, r.nonce) === h ? r.choice : false;
  }
  return { dispatch, drawEncounter, claim, commitCombat, revealCombat, verifyReveal, roomRef: roomRef2, deckRef, privRef, combatRef };
}
function initialDeck(players, allowed) {
  return {
    counts: { 2: 16, 3: 12, 4: 8, 5: 6 },
    discards: { 2: 0, 3: 0, 4: 0, 5: 0 },
    grants: Object.fromEntries(players.map((p) => [p.uid, p.combatCards])),
    objPool: (allowed?.obj || OBJECTIVES2.map((o2) => o2.id)).slice().sort(() => Math.random() - 0.5),
    objGrants: Object.fromEntries(players.map((p) => [p.uid, p.objectives])),
    encRemaining: allowed?.enc || ENCOUNTERS2.map((e) => e.id),
    encAll: allowed?.enc || null
  };
}

// public/js/game-ui.js
var esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var FACTION_COLOR = { rusviet: "#d62d2d", saxony: "#1c1c1f", nordic: "#2f6fd6", crimea: "#f0c419", polania: "#f2f2f2", togawa: "#8e44c9", albion: "#2e9e4f" };
var colorFor = (st, uid) => FACTION_COLOR[st.players[uid]?.faction] || "#888";
var inkOn = (c) => c === "#f2f2f2" || c === "#f0c419" ? "#111" : "#fff";
var TERR = {
  mountain: ["#8d8d93", "\u5C71"],
  farm: ["#d6c26a", "\u8FB2"],
  tundra: ["#9fb9c8", "\u6CB9"],
  forest: ["#4f7d41", "\u68EE"],
  village: ["#c98f5e", "\u6751"],
  lake: ["#3f70b3", "\u6E56"],
  factory: ["#80608f", "\u5DE5\u5834"],
  home: ["#5a5148", "\u672C"]
};
var SIZE = 34;
var SQ3 = Math.sqrt(3);
var K = 70 / 34;
var corner = (cx, cy, i) => {
  const a = Math.PI / 180 * (60 * i - 30);
  return [cx + SIZE * Math.cos(a), cy + SIZE * Math.sin(a)];
};
function createGameUI({ root, net, toast: toast2, getCtx, onLeave, onRematch }) {
  const ui = {
    selUnit: null,
    targets: [],
    carry: false,
    pick: null,
    sel: null,
    zoom: 1,
    resMode: false,
    objOpen: true,
    produce: [],
    trade: { r1: "oil", r2: "wood", hex: null },
    conv: { a: "oil", b: "oil", to: "wood", hex: null },
    encx: {},
    free: { top: "move", kind: null, hex: null, from2: null, unit: "m0", pen: null, type: "monument", mech: 0, slot: "upgrade", from: "upgrade", bonus: "power" },
    bot: { top: "move", slot: "upgrade", mech: 0, hex: null, type: "monument", from: "upgrade", bonus: "power" },
    fac: { hex: null, r1: "oil", r2: "wood" },
    combat: { dial: 0, cards: [] },
    enc: [],
    sound: true,
    lastLog: 0
  };
  const busy = /* @__PURE__ */ new Set();
  let audio = null;
  let master = null;
  const chain = () => {
    if (master) return master;
    const comp = audio.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    const conv = audio.createConvolver(), len = audio.sampleRate * 1.4, ir = audio.createBuffer(2, len, audio.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    conv.buffer = ir;
    const wet = audio.createGain();
    wet.gain.value = 0.28;
    const dry = audio.createGain();
    dry.gain.value = 0.9;
    comp.connect(dry);
    comp.connect(conv);
    conv.connect(wet);
    dry.connect(audio.destination);
    wet.connect(audio.destination);
    master = comp;
    return comp;
  };
  const tone = (f, at, dur, type = "sine", vol = 0.15, slide = 0, lp = 0) => {
    const o2 = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + at;
    let node = o2;
    o2.type = type;
    o2.frequency.setValueAtTime(f, t0);
    if (slide) o2.frequency.exponentialRampToValueAtTime(Math.max(25, f * slide), t0 + dur);
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 8e-3);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
    if (lp) {
      const fl = audio.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.value = lp;
      o2.connect(fl);
      node = fl;
    }
    node.connect(g);
    g.connect(chain());
    o2.start(t0);
    o2.stop(t0 + dur + 0.05);
  };
  const noise = (at, dur, vol = 0.2, f0 = 4e3, f1 = 300, type = "lowpass") => {
    const n = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
    const src = audio.createBufferSource(), g = audio.createGain(), fl = audio.createBiquadFilter(), t0 = audio.currentTime + at;
    src.buffer = buf;
    g.gain.value = vol;
    fl.type = type;
    fl.frequency.setValueAtTime(f0, t0);
    fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(chain());
    src.start(t0);
  };
  const metal = (base, at, dur = 0.5, vol = 0.1) => [1, 1.504, 2.17, 2.76, 3.9].forEach((m, i) => tone(base * m, at, dur / (1 + i * 0.5), "sine", vol / (1 + i * 0.6)));
  const thud = (at, f = 70, vol = 0.5) => {
    tone(f, at, 0.28, "sine", vol, 0.35);
    noise(at, 0.06, vol * 0.5, 900, 120);
  };
  const SFX = {
    click: () => {
      noise(0, 0.04, 0.12, 5e3, 1500, "bandpass");
      tone(160, 0, 0.06, "square", 0.07, 0.6, 500);
    },
    move: () => {
      thud(0, 62, 0.35);
      thud(0.13, 55, 0.3);
      noise(0.05, 0.25, 0.07, 3e3, 800, "bandpass");
    },
    coin: () => {
      metal(1100, 0, 0.35, 0.09);
      metal(1650, 0.07, 0.3, 0.07);
      thud(0, 110, 0.15);
    },
    build: () => {
      thud(0, 90, 0.55);
      noise(0, 0.1, 0.3, 3500, 400);
      metal(420, 0.02, 0.9, 0.12);
      thud(0.28, 85, 0.45);
      metal(520, 0.3, 0.8, 0.1);
    },
    produce: () => {
      noise(0, 0.5, 0.12, 1800, 4500, "highpass");
      [0, 0.12, 0.24].forEach((a) => {
        thud(a, 100, 0.2);
        metal(700, a, 0.15, 0.05);
      });
    },
    deploy: () => {
      thud(0, 52, 0.7);
      noise(0, 0.18, 0.35, 2500, 200);
      thud(0.32, 48, 0.75);
      noise(0.32, 0.2, 0.35, 2500, 200);
      tone(180, 0.5, 0.7, "sawtooth", 0.07, 2.2, 900);
      noise(0.55, 0.6, 0.1, 2e3, 6e3, "highpass");
    },
    combat: () => {
      noise(0, 0.5, 0.55, 3e3, 80);
      thud(0, 42, 0.9);
      tone(95, 0.02, 0.6, "sawtooth", 0.14, 0.4, 500);
      metal(260, 0.1, 0.8, 0.12);
      noise(0.4, 0.5, 0.2, 900, 90);
    },
    star: () => {
      [130.8, 196, 261.6].forEach((f, i) => tone(f, i * 0.1, 1.6, "sawtooth", 0.1, 1, 1400));
      thud(0, 55, 0.5);
      metal(523, 0.35, 1.4, 0.13);
      metal(784, 0.55, 1.3, 0.1);
      noise(0.3, 0.6, 0.08, 2500, 7e3, "highpass");
    },
    turn: () => {
      metal(98, 0, 2.2, 0.2);
      metal(147, 0.02, 2, 0.12);
      thud(0, 60, 0.4);
    },
    end: () => {
      thud(0, 70, 0.4);
      metal(180, 0.03, 0.5, 0.07);
    }
  };
  const sfx = (k) => {
    if (!ui.sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      SFX[k]?.();
    } catch {
    }
  };
  const beep = () => sfx("move");
  const guard = async (fn) => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof RuleError) toast2(e.message);
      else {
        toast2("\u901A\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u8A66\u3057\u3066\u304F\u3060\u3055\u3044");
        console.error(e);
      }
    }
  };
  const act = (action) => guard(async () => {
    await net().dispatch(action);
  });
  const RES_OF = { mountain: "metal", tundra: "oil", farm: "food", forest: "wood" };
  function prodMode(ctx) {
    const { st, me: me2 } = ctx, p = st.players[me2];
    if (st.turnUid !== me2) return false;
    if (st.pending) return st.pending.type === "free" && st.pending.queue[0].k === "produce";
    return st.turn.phase === "top" && p.section != null && (p.section === "factory" ? false : topOf(p.mat, p.section) === "produce");
  }
  function boardSVG(ctx) {
    const { st, me: me2 } = ctx;
    ctx_names = ctx.names;
    const colorOf = (uid) => colorFor(st, uid);
    const tg = new Set(ui.targets.map((t) => t.to));
    let hexes2 = "", top = "";
    for (const id of MAP.ids) {
      const h = MAP.hexes[id], [X, Y] = h.px || PX(h.q, h.r), hs = st.hexes[id];
      const poly = [0, 1, 2, 3, 4, 5].map((i) => corner(0, 0, i).map((v) => v.toFixed(1)).join(",")).join(" ");
      const homeColor = h.home ? colorOf(Object.keys(st.players).find((u) => st.players[u].faction === h.home) || "") : null;
      const sel = ui.sel === id, isT = tg.has(id), pk = ui.pick && ui.pick.ok?.(id), ps = prodMode(ctx) && ui.produce.includes(id), pc = prodMode(ctx) && !ps && producibleHexes(st, me2).includes(id);
      const hi = sel || isT || pk || ps || pc, hc = ps ? "#ffd400" : sel ? "#ffffff" : isT ? "#00f0ff" : "#7dff7d";
      const shape = h.home ? `<circle r="${SIZE * 0.95}" fill="#000" fill-opacity=".01" stroke="${hi ? hc : "none"}" stroke-width="3.4"/>` : `<polygon points="${poly}" fill="${hi ? hc : "#000"}" fill-opacity="${ps ? 0.5 : hi ? 0.25 : 0.01}" stroke="${hi ? hc : "none"}" stroke-width="${ps ? 6 : 3.4}" stroke-linejoin="round"/>`;
      const rIcon = ui.resMode && RES_OF[h.terrain] ? `<image href="i-${RES_OF[h.terrain]}.png" x="${-SIZE * 0.55}" y="${-SIZE * 0.55}" width="${SIZE * 1.1}" height="${SIZE * 1.1}" opacity=".95" pointer-events="none"/>` : ui.resMode && h.terrain === "village" ? `<image href="i-people.png" x="${-SIZE * 0.55}" y="${-SIZE * 0.55}" width="${SIZE * 1.1}" height="${SIZE * 1.1}" opacity=".95" pointer-events="none"/>` : "";
      const dim = ui.resMode && !h.home ? `<polygon points="${poly}" fill="#000" fill-opacity=".5" pointer-events="none"/>` : "";
      hexes2 += `<g class="hx" data-hex="${id}" transform="translate(${X.toFixed(1)} ${Y.toFixed(1)}) scale(${K.toFixed(4)})">
        ${dim}${shape}${rIcon}${ps ? '<text y="8" text-anchor="middle" class="stp">\u2714</text>' : ""}${isT ? `<text y="6" text-anchor="middle" class="stp">${ui.targets.find((t) => t.to === id)?.steps ?? ""}</text>` : ""}
        ${hs.enc ? `<circle cx="18" cy="-21" r="8" fill="#e8c14a" stroke="#222"><title>\u906D\u9047\u30C8\u30FC\u30AF\u30F3</title></circle><text x="18" y="-17.5" class="eb">!</text>` : ""}
        ${structMark(st, hs, colorOf, ctx)}${trapMark(st, id, colorOf, ctx)}${flagMark(st, id, colorOf, ctx)}
        ${resChips(hs, 0, 0)}
        </g>`;
      top += `<g transform="translate(${X.toFixed(1)} ${Y.toFixed(1)}) scale(${K.toFixed(4)})">${unitMarks(st, id, 0, 0, colorOf, me2)}</g>`;
    }
    return `<svg viewBox="0 0 1024 1024" class="boardsvg" role="img" aria-label="\u76E4\u9762"><image href="i-map.jpg" width="1024" height="1024"/>${hexes2}${top}</svg>`;
  }
  function structMark(st, hs, colorOf, ctx) {
    if (!hs.structure) return "";
    const c = colorOf(hs.structure.owner), n = STRUCT_NAMES[hs.structure.type];
    return `<g class="struct"><title>${n}\uFF08${esc(ctx.names(hs.structure.owner))}\uFF09</title><circle cx="-18" cy="-21" r="10" fill="${c}" stroke="#fff" stroke-width="2"/><image href="i-${hs.structure.type}.png" x="-25" y="-28" width="14" height="14"/></g>`;
  }
  function flagMark(st, id, colorOf, ctx) {
    const f = (st.flagHexes || []).find((x) => x.hex === id);
    if (!f) return "";
    return `<g class="trap"><title>\u65D7\uFF08${esc(ctx.names(f.owner))}\uFF09</title><path d="M-27 14 L-27 -10 L-10 -4 L-27 2" fill="${colorOf(f.owner)}" stroke="#fff" stroke-width="1.8"/><line x1="-27" y1="-12" x2="-27" y2="16" stroke="#ddd" stroke-width="2"/></g>`;
  }
  function trapMark(st, id, colorOf, ctx) {
    const tr = (st.traps || []).find((x) => x.hex === id);
    if (!tr) return "";
    const c = colorOf(tr.owner), mine = tr.owner === ctx.me;
    return `<g class="trap"><title>\u7F60\uFF08${esc(ctx.names(tr.owner))}\uFF09${tr.armed ? "\u6B66\u88C5\u4E2D" : "\u6B66\u88C5\u89E3\u9664\u6E08\u307F"}${mine ? "\uFF1A" + TRAP_PENALTIES[tr.penalty] : ""}</title><rect x="-30" y="-6" width="20" height="20" rx="4" fill="${tr.armed ? c : "#555"}" stroke="#fff" stroke-width="1.8" ${tr.armed ? "" : 'stroke-dasharray="3 2"'}/><text x="-20" y="8.5" class="ub" style="font-size:11px">\u7F60</text></g>`;
  }
  function resChips(hs) {
    const items = Object.entries(hs.res).filter(([, v]) => v > 0);
    if (!items.length) return "";
    const pill = (x, k, v, tip) => `<g transform="translate(${x} 24)"><title>${tip}</title><rect x="-13" y="-7" width="26" height="14" rx="7" fill="#000" fill-opacity=".72" stroke="#fff" stroke-opacity=".5"/><image href="i-${k}.png" width="12" height="12" x="-12" y="-6"/><text x="6" y="3.5" class="rc">\xD7${v}</text></g>`;
    if (items.length <= 2) return items.map(([k, v], i) => pill(items.length === 1 ? 0 : i ? 14 : -14, k, v, `${RES_NAMES[k]}\xD7${v}`)).join("");
    const tot = items.reduce((s, [, v]) => s + v, 0);
    return pill(0, items[0][0], tot, items.map(([k, v]) => `${RES_NAMES[k]}\xD7${v}`).join(" / "));
  }
  const UNIT_ART = { char: ["rusviet", "nordic", "albion", "saxony"], mech: ["rusviet", "nordic", "albion", "saxony"] };
  function unitMarks(st, id, cx, cy, colorOf, me2) {
    const us = unitsAt(st, id), list = [];
    for (const [uid, u] of Object.entries(us)) {
      const p = st.players[uid];
      if (u.char) list.push({ uid, shape: "c", unit: "char", label: "\u5C06", name: "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC" });
      p.mechs.forEach((m, mi) => {
        if (m.hex === id) list.push({ uid, shape: "m", unit: `m${mi}`, label: "M", name: "\u30E1\u30C3\u30AF" });
      });
      p.workers.forEach((w, wi) => {
        if (w === id) list.push({ uid, shape: "w", unit: `w${wi}`, label: "", name: "\u30EF\u30FC\u30AB\u30FC" });
      });
    }
    const dot = (e, x, y, count) => {
      const c = colorOf(e.uid), mine = e.uid === me2, on = mine && ui.selUnit === e.unit;
      const data = mine && e.unit ? `data-unit="${e.unit}" class="unit"` : "";
      const art = e.shape === "m" && UNIT_ART.mech.includes(st.players[e.uid].faction) || e.shape === "c" && UNIT_ART.char.includes(st.players[e.uid].faction);
      const ring2 = on ? `<circle cx="${x}" cy="${y}" r="${art ? 22 : 13}" fill="none" stroke="#00f0ff" stroke-width="3"/>` : "";
      const t = `<title>${esc(ctx_names(e.uid))}\u306E${e.name}${count > 1 ? "\xD7" + count : ""}</title>`;
      const txt = count > 1 ? `\xD7${count}` : e.label;
      const fac = st.players[e.uid].faction;
      if (e.shape === "m" && UNIT_ART.mech.includes(fac)) return `${ring2}<image href="i-mech_${fac}.png" x="${x - 19}" y="${y - 19}" width="38" height="38" style="filter:drop-shadow(0 1px 2px #000)" ${data}>${t}</image>${count > 1 ? `<text x="${x + 10}" y="${y + 14}" class="ub" style="font-size:11px">\xD7${count}</text>` : ""}`;
      if (e.shape === "c" && UNIT_ART.char.includes(fac)) return `${ring2}<image href="i-char_${fac}.png" x="${x - 19}" y="${y - 19}" width="38" height="38" style="filter:drop-shadow(0 1px 2px #000)" ${data}>${t}</image>`;
      if (e.shape === "m") return `${ring2}<rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="3" fill="${c}" stroke="${c === "#f2f2f2" ? "#444" : "#fff"}" stroke-width="1.8" ${data}>${t}</rect><text x="${x}" y="${y + 3.5}" class="ub" style="fill:${inkOn(c)}">${txt}</text>`;
      if (e.shape === "c") return `${ring2}<circle cx="${x}" cy="${y}" r="9.5" fill="${c}" stroke="${c === "#f2f2f2" ? "#444" : "#fff"}" stroke-width="1.8" ${data}>${t}</circle><text x="${x}" y="${y + 3.5}" class="ub" style="fill:${inkOn(c)}">${txt}</text>`;
      return `${ring2}<circle cx="${x}" cy="${y}" r="${count > 1 ? 9 : 6.5}" fill="${c}" stroke="${c === "#f2f2f2" ? "#444" : "#fff"}" stroke-width="1.8" ${data}>${t}</circle>${count > 1 ? `<text x="${x}" y="${y + 3.5}" class="ub" style="fill:${inkOn(c)}">\xD7${count}</text>` : ""}`;
    };
    let out = "";
    if (list.length <= 4) {
      const pos = list.length <= 3 ? list.map((_, i) => [(i - (list.length - 1) / 2) * 24, 3]) : [[-12, -5], [12, -5], [-12, 15], [12, 15]];
      list.forEach((e, i) => {
        out += dot(e, pos[i][0], pos[i][1], 1);
      });
    } else {
      const groups = [];
      for (const e of list) {
        const g = groups.find((x) => x.uid === e.uid && x.shape === e.shape);
        if (g) {
          g.n++;
          g.units.push(e.unit);
        } else groups.push({ ...e, units: [e.unit], n: 1 });
      }
      const mv = st.turn.move;
      for (const g of groups) g.unit = g.units.find((u) => !(mv && mv.moved.includes(u))) || g.units[0];
      const pos = groups.length <= 2 ? groups.map((_, i) => [(i - (groups.length - 1) / 2) * 22, 3]) : groups.map((_, i) => [(i % 3 - 1) * 20, -4 + Math.floor(i / 3) * 18]);
      groups.forEach((g, i) => {
        out += dot(g, pos[i][0], pos[i][1], g.n);
      });
    }
    return out;
  }
  let ctx_names = (u) => u;
  function stepsBar(st) {
    const ph = st.turn.phase, pd = st.pending;
    const cur = pd?.type === "combat" ? 1 : pd ? 2 : { section: 0, top: 1, moving: 1, bottom: 2, end: 3 }[ph] ?? 0;
    const S = ["\u2460 \u30BB\u30AF\u30B7\u30E7\u30F3\u9078\u629E", "\u2461 \u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3", "\u2462 \u4E0B\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3", "\u2463 \u30BF\u30FC\u30F3\u7D42\u4E86"];
    return `<div class="steps">${S.map((x, i) => `<span class="${i === cur ? "now" : i < cur ? "done" : ""}">${x}</span>`).join("")}${pd ? `<span class="pend">${{ combat: "\u6226\u95D8\u4E2D", trap: "\u7F60\u306E\u8A2D\u7F6E", flag: "\u65D7\u306E\u8A2D\u7F6E", encounter: "\u906D\u9047", factory: "\u5DE5\u5834\u30AB\u30FC\u30C9\u9078\u629E", free: "\u7121\u6599\u52B9\u679C" }[pd.type] || ""}</span>` : ""}</div>`;
  }
  const nm = (ctx, uid) => esc(ctx.names(uid));
  const sectionLabel = (p, s) => {
    if (s === "factory") return `\u5DE5\u5834\uFF0F\u79FB\u52D5\uFF08${esc(byId(FACTORY_CARDS2, p.factory)?.name || "")}\uFF09`;
    return `${TOP_NAMES[topOf(p.mat, s)]}\uFF0F${BOTTOM_NAMES[BOTTOM_ORDER[s]]}`;
  };
  const resSel = (key, val) => `<span class="rsel">${["oil", "metal", "wood", "food"].map((r) => `<button type="button" class="rbtn ${r === val ? "on" : ""}" data-act="resset" data-v="${key}|${r}" title="${RES_NAMES[r]}"><img src="i-${r}.png" alt="${RES_NAMES[r]}"></button>`).join("")}</span>`;
  const hexBtn = (label, key, cur) => `<button class="ghost sm" data-act="pick" data-v="${key}">${label}: ${cur ? esc(cur) : "\u9078\u629E"}</button>`;
  function topDoable(st, me2, kind) {
    const p = st.players[me2];
    if (kind === "produce") return producibleHexes(st, me2).length > 0;
    if (kind === "bolster" || kind === "trade") return canDo(st, me2, kind);
    if (kind === "factory") {
      const c = byId(FACTORY_CARDS2, p.factory);
      if (!c) return false;
      const { card = 0, anyRes = 0, diff, ...rest } = c.cost;
      return p.hand >= card && canPay(st, me2, rest);
    }
    return true;
  }
  function panelAction(ctx) {
    const { st, me: me2 } = ctx, p = st.players[me2], t = st.turn;
    if (st.over) return resultPanel(ctx);
    const mine = st.turnUid === me2;
    if (st.pending?.type === "combat") return combatPanel(ctx);
    if (!mine) return "";
    if (st.pending?.type === "encounter") return encounterPanel(ctx);
    if (st.pending?.type === "flag") return `<div class="card"><h2>\u{1F6A9} \u65D7\u3092\u8A2D\u7F6E\uFF08${esc(st.pending.hex)}\uFF09</h2><p class="mute">\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u306E\u3044\u308B\u9818\u571F\u306B\u65D7\u30921\u3064\u7F6E\u3051\u307E\u3059\uFF08\u6B8B\u308A${p.flags}\u500B\u30FB\u52D5\u304B\u305B\u307E\u305B\u3093\uFF09\u3002\u7D42\u4E86\u6642\u306B\u305D\u306E\u9818\u571F\u3092\u652F\u914D\u3057\u3066\u3044\u3066\u3001\u81EA\u5206\u306E\u672C\u62E0\u5730\u306B\u96A3\u63A5\u3057\u3066\u3044\u306A\u3051\u308C\u3070\u3001\u9818\u571F1\u3064\u5206\u3068\u3057\u3066\u6570\u3048\u307E\u3059\u3002</p>
      <div class="row"><button data-act="flag" data-v="1">\u65D7\u3092\u7F6E\u304F</button><button class="ghost" data-act="flag" data-v="">\u7F6E\u304B\u306A\u3044</button></div></div>`;
    if (st.pending?.type === "trap") return `<div class="card"><h2>\u{1FAA4} \u7F60\u3092\u8A2D\u7F6E\uFF08${esc(st.pending.hex)}\uFF09</h2><p class="mute">\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u306E\u3044\u308B\u9818\u571F\u306B\u7F60\u30921\u3064\u7F6E\u3051\u307E\u3059\uFF08\u7F6E\u3044\u305F\u7F60\u306F\u52D5\u304B\u305B\u307E\u305B\u3093\uFF09\u3002\u6B66\u88C5\u4E2D\u306E\u7F60\u306F\u3001\u7D42\u4E86\u6642\u306B\u3042\u306A\u305F\u306E\u652F\u914D\u9818\u571F\u306B\u306A\u308A\u3001\u76F8\u624B\u30E6\u30CB\u30C3\u30C8\u304C\u5165\u308B\u3068\u79FB\u52D5\u304C\u6B62\u307E\u3063\u3066\u30DA\u30CA\u30EB\u30C6\u30A3\u3092\u4E0E\u3048\u307E\u3059\u3002</p>
      <div class="row">${p.traps.map((x) => `<button data-act="trap" data-v="${x}">${TRAP_PENALTIES[x]}\u306E\u7F60</button>`).join("")}<button class="ghost" data-act="trap" data-v="">\u7F6E\u304B\u306A\u3044</button></div></div>`;
    if (st.pending?.type === "free") return freePanel(ctx);
    if (st.pending?.type === "factory") {
      return `<div class="card"><h2>\u5DE5\u5834\u30AB\u30FC\u30C9\u3092\u9078\u3076\uFF081\u679A\u30FB\u5909\u66F4\u4E0D\u53EF\uFF09</h2>${st.factoryCandidates.map((id) => {
        const c = byId(FACTORY_CARDS2, id);
        return `<div class="opt facopt"><img src="${c.img}" alt="${esc(c.name)}"><div><b>${esc(c.name)}</b><div class="mute">${esc(c.text)}</div><button data-act="factory-pick" data-v="${id}">\u3053\u308C\u306B\u3059\u308B</button></div></div>`;
      }).join("")}</div>`;
    }
    if (t.phase === "section") return "";
    const kindTop = p.section === "factory" ? "factory" : topOf(p.mat, p.section);
    if (t.phase === "top" && !topDoable(st, me2, kindTop)) return `<div class="card"><h2>\u26A0 \u4E0A\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u5B9F\u884C\u3067\u304D\u307E\u305B\u3093</h2><p>\u300C${TOP_NAMES[kindTop]}\u300D\u306F\u3001\u3044\u307E\u306E\u72B6\u6CC1\uFF08${{ produce: "\u751F\u7523\u3067\u304D\u308B\u9818\u571F\u304C\u306A\u3044\u3001\u307E\u305F\u306F\u751F\u7523\u30B3\u30B9\u30C8\u3092\u6255\u3048\u307E\u305B\u3093", bolster: "\u30B3\u30A4\u30F3\u304C\u8DB3\u308A\u307E\u305B\u3093", trade: "\u30B3\u30A4\u30F3\u304C\u8DB3\u308A\u307E\u305B\u3093", factory: "\u5DE5\u5834\u30AB\u30FC\u30C9\u306E\u30B3\u30B9\u30C8\u3092\u6255\u3048\u307E\u305B\u3093" }[kindTop] || "\u6761\u4EF6\u3092\u6E80\u305F\u3057\u3066\u3044\u307E\u305B\u3093"}\uFF09\u3067\u306F\u5B9F\u884C\u3067\u304D\u307E\u305B\u3093\u3002</p>
      <div class="row"><button data-act="top-skip">\u4E0A\u6BB5\u3092\u884C\u308F\u305A\u306B\u9032\u3080</button><button class="ghost" data-act="cancel-sec">\u21A9 \u30BB\u30AF\u30B7\u30E7\u30F3\u9078\u629E\u306B\u623B\u308B</button></div></div>`;
    if (t.phase === "top") return `<div class="card"><h2>\u4E0A\u6BB5\uFF1A${TOP_NAMES[kindTop]}</h2>${topForm(ctx, kindTop)}
      <div class="row"><button class="ghost" data-act="top-skip">\u4E0A\u6BB5\u3092\u884C\u308F\u306A\u3044</button><button class="ghost" data-act="cancel-sec">\u21A9 \u30BB\u30AF\u30B7\u30E7\u30F3\u9078\u629E\u306B\u623B\u308B</button></div></div>`;
    if (t.phase === "moving") return movingPanel(ctx);
    if (t.phase === "bottom") {
      const kb = p.section === "factory" ? "factoryMove" : BOTTOM_ORDER[p.section];
      return `<div class="card"><h2>\u4E0B\u6BB5\uFF1A${kb === "factoryMove" ? "\u79FB\u52D5\uFF08\u6700\u59272\u56DE\uFF09" : BOTTOM_NAMES[kb]}</h2>${bottomForm(ctx, kb)}
        <div class="row"><button class="ghost" data-act="bot-skip">\u4E0B\u6BB5\u3092\u884C\u308F\u306A\u3044</button></div></div>`;
    }
    return "";
  }
  function topForm(ctx, kind) {
    const { st, me: me2 } = ctx, p = st.players[me2];
    if (kind === "move") return `<div class="row"><button data-act="move-units">\u30E6\u30CB\u30C3\u30C8\u3092\u79FB\u52D5\uFF08\u6700\u59272\u4F53\u30FB\u54041\u56DE\uFF09</button><button class="ghost" data-act="move-coin">\u4EE3\u308F\u308A\u306B\u30B3\u30A4\u30F3+1</button></div>`;
    if (kind === "bolster") return `<p class="mute">1\u30B3\u30A4\u30F3\u652F\u6255\u3044</p><div class="row"><button data-act="bolster-power">\u6226\u529B+2</button><button data-act="bolster-card">\u6226\u95D8\u30AB\u30FC\u30C9+1</button></div>`;
    if (kind === "trade") return `<p class="mute">1\u30B3\u30A4\u30F3\u652F\u6255\u3044</p><div class="row"><button data-act="trade-pop">\u652F\u6301+1</button></div>
      <div class="row">\u8CC7\u6E90 ${resSel("trade.r1", ui.trade.r1)} ${resSel("trade.r2", ui.trade.r2)} ${hexBtn("\u7F6E\u304F\u9818\u571F", "trade.hex", ui.trade.hex)} <button data-act="trade-res">\u8CC7\u6E90+2</button></div>`;
    if (kind === "produce") {
      const lim = 2 + (p.up.produce || 0), cands = producibleHexes(st, me2), pk = `${st.gid}.${st.log.length}`;
      if (ui.pf !== pk) {
        ui.pf = pk;
        ui.produce = cands.length <= lim ? [...cands] : [];
      }
      return `<p>\u751F\u7523\u30B3\u30B9\u30C8\uFF1A${Object.entries(produceCost(p.workers.length)).map(([k, v]) => (RES_NAMES[k] || { pop: "\u652F\u6301", power: "\u6226\u529B", coins: "\u30B3\u30A4\u30F3" }[k]) + v).join("\u30FB") || "\u306A\u3057"}\uFF08\u30EF\u30FC\u30AB\u30FC${p.workers.length}\u4EBA\uFF09</p><p>\u751F\u7523\u3059\u308B\u9818\u571F\u3092\u6700\u5927${lim}\u304B\u6240\u9078\u3093\u3067\u304F\u3060\u3055\u3044\uFF08\u5019\u88DC\u304C${lim}\u304B\u6240\u4EE5\u4E0B\u306A\u3089\u6700\u521D\u304B\u3089\u9078\u629E\u6E08\u307F\uFF09</p>
      <div class="chips">${producibleHexes(st, me2).map((id) => `<button class="chip ${ui.produce.includes(id) ? "on" : ""}" data-act="produce-toggle" data-v="${id}">${TERR[MAP.hexes[id].terrain][1]} ${id}</button>`).join("")}</div>
      <div class="row"><button data-act="produce-go" ${ui.produce.length ? "" : "disabled"}>\u751F\u7523\u3059\u308B</button><button class="ghost sm" data-act="produce-clear">\u30AF\u30EA\u30A2</button></div>`;
    }
    if (kind === "factory") {
      const c = byId(FACTORY_CARDS2, p.factory), n = c.cost.anyRes || 0;
      return `<div class="facopt"><img src="${c.img}" alt=""><div><b>${esc(c.name)}</b><div class="mute">${esc(c.text)}</div>
        ${n ? `<div class="row">\u652F\u6255\u3046\u8CC7\u6E90 ${Array.from({ length: n }, (_, i) => resSel(`fac.pay${i}`, ui.fac["pay" + i] || ["oil", "wood"][i] || "oil")).join(" ")}</div>` : ""}
        ${c.gain.worker ? `<div class="row">${hexBtn("\u30EF\u30FC\u30AB\u30FC\u3092\u7F6E\u304F\u9818\u571F", "fac.hex", ui.fac.hex)}</div>` : ""}
        <div class="row"><button data-act="factory-go">\u5B9F\u884C</button></div></div></div>`;
    }
    return "";
  }
  const producible = (ctx) => MAP.ids.filter((id) => okMine(ctx, id) && !["lake", "home", "factory"].includes(MAP.hexes[id].terrain));
  const MAT_IMG = { industrial: 1, engineering: 2, patriotic: 3, mechanical: 4, agricultural: 5, militant: 6, innovative: 7 };
  const FAC_IMG = { nordic: "nordic", crimea: "crimea", saxony: "saxony", polania: "polania", rusviet: "rusviet", togawa: "togawa" };
  const matWrap = (ctx, inner) => `<div class="matbg" style="background-image:linear-gradient(rgba(12,10,8,.35),rgba(12,10,8,.7)),url(i-mat_${MAT_IMG[ctx.st.players[ctx.me].mat] || 1}.jpg)">${inner}</div>`;
  const stepsOf = (p, u) => u[0] === "w" ? 1 : 1 + (p.mechs.some((m) => MECH_SLOTS[p.faction][m.slot] === "speed") ? 1 : 0) + (p.up.move || 0);
  function movingPanel(ctx) {
    const { st, me: me2 } = ctx, p = st.players[me2], mv = st.turn.move;
    const hexOf = (u) => u === "char" ? p.char : u[0] === "m" ? p.mechs[+u.slice(1)].hex : p.workers[+u.slice(1)];
    const done = mv.moved;
    const opts = (max, cur) => Array.from({ length: max + 1 }, (_, n) => `<option ${+cur === n ? "selected" : ""}>${n}</option>`).join("");
    const hl = (h) => String(h).startsWith("home:") ? "\u672C\u62E0\u5730" : h;
    const btn = (u, label, sub) => `<button class="mvb ${ui.selUnit && hexOf(ui.selUnit) === hexOf(u) && ui.selUnit[0] === u[0] ? "sel" : ""}" data-act="unit" data-v="${u}" ${done.includes(u) ? "disabled" : ""}><b>${label}</b><small>${sub}</small></button>`;
    const ub = [btn("char", "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC", `@${hl(p.char)}\u30FB${stepsOf(p, "char")}\u30DE\u30B9`), ...p.mechs.map((m, i) => btn(`m${i}`, `\u30E1\u30C3\u30AF${i + 1}`, `@${hl(m.hex)}\u30FB${stepsOf(p, `m${i}`)}\u30DE\u30B9`))];
    const seen = /* @__PURE__ */ new Set();
    p.workers.forEach((h, i) => {
      if (seen.has(h)) return;
      seen.add(h);
      const idxs = p.workers.map((x, j) => x === h ? j : -1).filter((j) => j >= 0);
      const free = idxs.find((j) => !done.includes(`w${j}`));
      ub.push(btn(`w${free ?? idxs[0]}`, `\u30EF\u30FC\u30AB\u30FC\xD7${idxs.length}`, `@${hl(h)}\u30FB1\u30DE\u30B9\uFF081\u4F53\u305A\u3064\uFF09`));
    });
    const sel = ui.selUnit, isMech = sel && sel[0] === "m";
    let ride = "";
    if (isMech) {
      const from = hexOf(sel), avail = p.workers.filter((w) => w === from).length;
      const viaHex = ui.via?.hex, viaAvail = viaHex ? p.workers.filter((w) => w === viaHex).length : 0;
      const loadAtVia = Math.min(+ui.wcar || 0, avail);
      ride = `<div class="ride"><b>\u2461 \u30E1\u30C3\u30AF\u306B\u30EF\u30FC\u30AB\u30FC\u3092\u4E57\u305B\u308B\uFF08\u4EFB\u610F\uFF09</b>
        <div class="row">\u3044\u307E\u306E\u5834\u6240\uFF08${from}\uFF09\u306E\u30EF\u30FC\u30AB\u30FC ${avail}\u4EBA\u306E\u3046\u3061 <select data-bind="wcar">${opts(avail, Math.min(+ui.wcar || 0, avail))}</select> \u4EBA\u3092\u4E57\u305B\u3066\u904B\u3076</div>
        <div class="row">\u9014\u4E2D\u3067\u4E57\u308A\u964D\u308A\u3059\u308B\u5834\u5408\uFF1A\u7D4C\u7531\u5730 <select data-bind="via.hex"><option value="">\uFF08\u7D4C\u7531\u3057\u306A\u3044\uFF09</option>${(ui.targets || []).map((c) => `<option ${viaHex === c.to ? "selected" : ""}>${c.to}</option>`).join("")}</select>
        ${viaHex ? `\u3067 \u964D\u308D\u3059 <select data-bind="via.drop">${opts(loadAtVia, Math.min(+ui.via?.drop || 0, loadAtVia))}</select>\u4EBA\uFF0F\u4E57\u305B\u308B\uFF08\u305D\u3053\u306B${viaAvail}\u4EBA\uFF09 <select data-bind="via.take">${opts(viaAvail, Math.min(+ui.via?.take || 0, viaAvail))}</select>\u4EBA` : ""}</div>
        <small class="mute">\u4E57\u305B\u305F\u30EF\u30FC\u30AB\u30FC\u306F\u6700\u7D42\u7684\u306A\u79FB\u52D5\u5148\u3078\u7740\u304D\u307E\u3059\u3002\u79FB\u52D5\u3057\u305F\u306E\u306F\u30E1\u30C3\u30AF1\u4F53\u3068\u3057\u3066\u6570\u3048\u307E\u3059\u3002</small></div>`;
    }
    return `<div class="card mvp"><h2>\u79FB\u52D5\u30A2\u30AF\u30B7\u30E7\u30F3\uFF1A\u3042\u3068${mv.left}\u4F53\u307E\u3067</h2>
      <div class="mstep"><b>\u2460 \u52D5\u304B\u3059\u30E6\u30CB\u30C3\u30C8\u3092\u9078\u3076</b>\uFF08\u76E4\u9762\u306E\u30E6\u30CB\u30C3\u30C8\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u3082\u9078\u3079\u307E\u3059\uFF09<div class="units">${ub.join("")}</div></div>
      ${sel ? `<div class="mstep now">\u9078\u629E\u4E2D\uFF1A<b>${sel === "char" ? "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC" : sel[0] === "m" ? `\u30E1\u30C3\u30AF${+sel.slice(1) + 1}` : "\u30EF\u30FC\u30AB\u30FC"}</b>\uFF08${hexOf(sel)}\uFF09\u2192 ${isMech ? "\u2462 " : "\u2461 "}<b>\u76E4\u9762\u306E\u9EC4\u8272\u3044\u9818\u571F\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u79FB\u52D5</b></div>` : '<div class="mstep mute">\u30E6\u30CB\u30C3\u30C8\u3092\u9078\u3076\u3068\u3001\u79FB\u52D5\u3067\u304D\u308B\u9818\u571F\u304C\u9EC4\u8272\u3067\u5149\u308A\u307E\u3059\u3002</div>'}
      ${ride}
      <label class="chk"><input type="checkbox" data-bind="carry" ${ui.carry ? "checked" : ""}> \u51FA\u767A\u5730\u306E\u8CC7\u6E90\u3082\u3044\u3063\u3057\u3087\u306B\u904B\u3076</label>
      <div class="row"><button data-act="endMove">\u79FB\u52D5\u3092\u7D42\u3048\u308B</button></div></div>`;
  }
  const UP_EFFECT = { move: "\u79FB\u52D5+1\u30DE\u30B9", bolster: "\u6226\u529B+1\uFF0F\u30AB\u30FC\u30C9+1", trade: "\u652F\u6301+1\uFF0F\u8CC7\u6E90+1", produce: "\u751F\u7523+1\u9818\u571F" };
  const BON_NAME = { power: "\u6226\u529B+2", coins: "\u30B3\u30A4\u30F3+2", pop: "\u652F\u6301+2", card: "\u6226\u95D8\u30AB\u30FC\u30C9+2" };
  const ONG = { upgrade: "\u6226\u529B+1", deploy: "\u30B3\u30A4\u30F3+1", build: "\u652F\u6301+1", enlist: "\u6226\u95D8\u30AB\u30FC\u30C9+1" };
  const topOpts = (p, cur) => Object.keys(TOP_CUBES).filter((t) => (p.up[t] || 0) < TOP_CUBES[t]).map((t) => `<option value="${t}" ${cur === t ? "selected" : ""}>${TOP_NAMES[t]}\uFF1A${UP_EFFECT[t]}</option>`).join("");
  const slotOpts = (p, cur) => {
    const m = BASE_MATS[p.mat];
    return BOTTOM_ORDER.filter((s) => p.red[s] < m.lower[s][1]).map((s) => {
      const c = Math.max(0, m.lower[s][0] - p.red[s]);
      return `<option value="${s}" ${cur === s ? "selected" : ""}>${BOTTOM_NAMES[s]}\uFF1A\u30B3\u30B9\u30C8${c}\u2192${Math.max(0, c - 1)}</option>`;
    }).join("");
  };
  const upNote = '<p class="mute">\u6539\u826F\uFF1A\u4E0A\u6BB5\u306E\u5F37\u5316\uFF08\u52B9\u679C\u306F\u9078\u629E\u80A2\u306B\u8868\u793A\uFF09\u3092\u5F97\u3066\u3001\u4E0B\u6BB5\u306E\u30B3\u30B9\u30C8\u304C1\u4E0B\u304C\u308A\u307E\u3059\u3002</p>';
  function bottomForm(ctx, kind) {
    const { st, me: me2 } = ctx, p = st.players[me2], m = BASE_MATS[p.mat];
    if (kind === "factoryMove") return `<p class="mute">\u5DE5\u5834\u30BB\u30AF\u30B7\u30E7\u30F3\u306E\u4E0B\u6BB5\u3067\u3059\u3002\u901A\u5E38\u306E<b>\u79FB\u52D5\u30A2\u30AF\u30B7\u30E7\u30F3\u3068\u540C\u3058</b>\u3067\u3059\uFF1A<b>\u6700\u59272\u4F53</b>\u307E\u3067\u3001\u540C\u3058\u30E6\u30CB\u30C3\u30C8\u306F1\u56DE\u3060\u3051\u52D5\u304B\u305B\u307E\u3059\u3002</p><div class="row"><button data-act="bot-factory">\u79FB\u52D5\u3092\u59CB\u3081\u308B</button></div>`;
    const cost = Math.max(0, m.lower[kind][0] - p.red[kind]);
    const hint = canDo(st, me2, kind) ? "" : '<p class="bad">\u26A0 \u8CC7\u6E90\u304C\u8DB3\u308A\u307E\u305B\u3093\u3002\u4E0A\u306E\u300C\u21C4 \u8CC7\u6E90\u4EA4\u63DB\u300D\uFF082\u500B\u21921\u500B\uFF09\u3067\u8DB3\u308A\u308B\u304B\u8A66\u305B\u307E\u3059\u3002</p>';
    const head = hint + `<p>\u30B3\u30B9\u30C8\uFF1A${RES_NAMES[BOTTOM_RES[kind]]} ${cost}\uFF08\u6301\u3063\u3066\u3044\u308B${RES_NAMES[BOTTOM_RES[kind]]} ${resTotals(st, me2)[BOTTOM_RES[kind]]}\uFF09\uFF0F \u5831\u916C\uFF1A${m.lower[kind][2]}\u30B3\u30A4\u30F3</p>`;
    const b = ui.bot;
    if (kind === "upgrade") {
      const opts = BOTTOM_ORDER.filter((s) => p.red[s] < m.lower[s][1]);
      return head + upNote + `<div class="row">\u4E0A\u6BB5\u304B\u3089\u53D6\u308B <select data-bind="bot.top">${topOpts(p, b.top)}</select> \u4E0B\u6BB5\u306B\u7F6E\u304F <select data-bind="bot.slot">${slotOpts(p, b.slot)}</select><button data-act="bot-go">\u6539\u826F\u3059\u308B</button></div>`;
    }
    if (kind === "deploy") {
      const free = [0, 1, 2, 3].filter((i) => !p.mechs.some((x) => x.slot === i));
      return head + `<div class="row">\u30E1\u30C3\u30AF <select data-bind="bot.mech">${free.map((i) => {
        const a = MECH_SLOTS[p.faction][i];
        return `<option value="${i}" ${+b.mech === i ? "selected" : ""}>${ABILITY_NAMES[a]}${IMPLEMENTED_ABILITIES.includes(a) ? "" : "\uFF08\u52B9\u679C\u672A\u5B9F\u88C5\uFF09"}</option>`;
      }).join("")}</select> ${hexBtn("\u914D\u7F6E\u9818\u571F", "bot.hex", b.hex)}<button data-act="bot-go">\u914D\u5099\u3059\u308B</button></div>`;
    }
    if (kind === "build") {
      const free = ["monument", "mill", "mine", "armory"].filter((x) => !p.structures.some((s) => s.type === x));
      return head + `<div class="row">\u5EFA\u7269 <select data-bind="bot.type">${free.map((x) => `<option value="${x}" ${b.type === x ? "selected" : ""}>${STRUCT_NAMES[x]}</option>`).join("")}</select> ${hexBtn("\u5EFA\u8A2D\u9818\u571F", "bot.hex", b.hex)}<button data-act="bot-go">\u5EFA\u8A2D\u3059\u308B</button></div>`;
    }
    const fromFree = BOTTOM_ORDER.filter((s) => !p.recruits.some((r) => r.section === s));
    const bonFree = RECRUIT_ONETIME.filter((x) => !p.recruits.some((r) => r.bonus === x));
    const BN = { power: "\u6226\u529B+2", coins: "\u30B3\u30A4\u30F3+2", pop: "\u652F\u6301+2", card: "\u6226\u95D8\u30AB\u30FC\u30C9+2" };
    return head + `<p class="mute">\u5FB4\u5175\uFF1A\u2460\u9078\u3093\u3060\u4E0B\u6BB5\u306B\u5FB4\u5175\u30C8\u30FC\u30AF\u30F3\u3092\u7F6E\u304F \u2192 \u4EE5\u5F8C\u3001<b>\u81EA\u5206\u3068\u4E21\u96A3\u306E\u4EBA</b>\u304C\u305D\u306E\u4E0B\u6BB5\u3092\u884C\u3046\u305F\u3073\u306B<b>\u5E38\u6642\u30DC\u30FC\u30CA\u30B9</b>\u304C\u5165\u308A\u307E\u3059\u3002\u2461\u540C\u6642\u306B<b>\u4E00\u6642\u30DC\u30FC\u30CA\u30B9</b>\u3092\u4ECA\u3059\u3050\u7372\u5F97\uFF084\u67A0\u306F\u54041\u56DE\uFF09\u30024\u3064\u63C3\u3046\u3068\u661F\u3002</p><div class="row">\u5FB4\u5175\u30C8\u30FC\u30AF\u30F3\u306E\u53D6\u5F97\u5143 <select data-bind="bot.from">${fromFree.map((s) => `<option value="${s}" ${b.from === s ? "selected" : ""}>${BOTTOM_NAMES[s]}\uFF08\u5E38\u6642\uFF1A${ONG[s]}\uFF09</option>`).join("")}</select> \u4E00\u6642\u30DC\u30FC\u30CA\u30B9 <select data-bind="bot.bonus">${bonFree.map((x) => `<option value="${x}" ${b.bonus === x ? "selected" : ""}>${BN[x]}</option>`).join("")}</select><button data-act="bot-go">\u5FB4\u5175\u3059\u308B</button></div>`;
  }
  function encounterPanel(ctx) {
    const { st, me: me2 } = ctx, p = st.players[me2], pd = st.pending;
    if (!pd.cardId) return `<div class="card"><h2>\u906D\u9047</h2><p class="mute">\u906D\u9047\u30AB\u30FC\u30C9\u3092\u5F15\u3044\u3066\u3044\u307E\u3059\u2026</p></div>`;
    const c = byId(ENCOUNTERS2, pd.cardId), max = p.faction === "polania" ? 2 : 1;
    const okOpt = (o2) => encAvail(st, me2, o2);
    const none = !c.options.some(okOpt);
    return `<div class="card"><h2>\u906D\u9047 #${c.no}</h2><p class="mute">\u9078\u629E\u80A2\u3092${max === 2 ? "\u6700\u59272\u3064\uFF08\u30DD\u30FC\u30E9\u30CB\u30A2\uFF09" : "1\u3064"}\u9078\u3073\u307E\u3059\u3002</p>
      ${c.options.map((o2, i) => `<label class="opt ${okOpt(o2) ? "" : "dim"}"><input type="${max === 2 ? "checkbox" : "radio"}" name="enc" data-bind="enc" value="${i}" ${okOpt(o2) ? "" : "disabled"} ${ui.enc.includes(i) ? "checked" : ""}> ${esc(o2.text)}${o2.unsupported ? ' <span class="tag">\u672A\u5B9F\u88C5</span>' : ""}</label>`).join("")}
      ${(() => {
      const picked = ui.enc.map((i) => c.options[i]).filter(Boolean);
      const x = ui.encx || {};
      let h = "";
      if (picked.some((o2) => o2.fx === "truce")) {
        const opp = Object.keys(st.players).filter((u) => u !== me2);
        h += `<div class="row">\u653B\u6483\u3067\u304D\u306A\u304F\u3059\u308B\u76F8\u624B <select data-bind="encx.target">${opp.map((u) => `<option value="${u}" ${x.target === u ? "selected" : ""}>${nm(ctx, u)}</option>`).join("")}</select></div>`;
      }
      if (picked.some((o2) => o2.fx === "objSwap")) {
        const ob = (ctx.priv?.objectives || []).map((id) => byId(OBJECTIVES2, id)).filter(Boolean);
        h += `<div class="row">\u6368\u3066\u308B\u76EE\u7684\u30AB\u30FC\u30C9 <select data-bind="encx.obj">${ob.map((o2) => `<option value="${o2.id}" ${x.obj === o2.id ? "selected" : ""}>${esc(o2.name)}</option>`).join("")}</select></div>`;
      }
      return h;
    })()}
      <div class="row"><button data-act="enc-go" ${none || ui.enc.length ? "" : "disabled"}>${none ? "\u898B\u9001\u308B\uFF08\u9078\u3079\u308B\u9078\u629E\u80A2\u306A\u3057\uFF09" : "\u3053\u306E\u9078\u629E\u3067\u89E3\u6C7A"}</button></div></div>`;
  }
  const FREE_NAMES = { reposition: "\u914D\u7F6E\u63DB\u3048", recall: "\u30E6\u30CB\u30C3\u30C8\u5E30\u9084", moveToken: "\u906D\u9047\u30C8\u30FC\u30AF\u30F3\u79FB\u52D5", trapPlace: "\u7F60\u8A2D\u7F6E", build: "\u5EFA\u8A2D", upgrade: "\u6539\u826F", deploy: "\u914D\u5099", enlist: "\u5FB4\u5175", produce: "\u751F\u7523", anyRes: "\u597D\u304D\u306A\u8CC7\u6E90" };
  function freePanel(ctx) {
    const { st, me: me2 } = ctx, p = st.players[me2], pd = st.pending, head = pd.queue[0];
    const kinds = head.alt || [head.k];
    const f = ui.free, k = kinds.includes(f.kind) ? f.kind : kinds[0];
    let body = "";
    if (k === "build") {
      const fr = ["monument", "mill", "mine", "armory"].filter((x) => !p.structures.some((s) => s.type === x));
      body = `\u5EFA\u7269 <select data-bind="free.type">${fr.map((x) => `<option value="${x}" ${f.type === x ? "selected" : ""}>${STRUCT_NAMES[x]}</option>`).join("")}</select> ${hexBtn("\u5EFA\u8A2D\u9818\u571F", "free.hex", f.hex)}`;
    } else if (k === "deploy") {
      const free = [0, 1, 2, 3].filter((i) => !p.mechs.some((x) => x.slot === i));
      body = `\u30E1\u30C3\u30AF <select data-bind="free.mech">${free.map((i) => `<option value="${i}" ${+f.mech === i ? "selected" : ""}>${ABILITY_NAMES[MECH_SLOTS[p.faction][i]]}</option>`).join("")}</select> ${hexBtn("\u914D\u7F6E\u9818\u571F", "free.hex", f.hex)}`;
    } else if (k === "upgrade") {
      const opts = BOTTOM_ORDER.filter((s) => p.red[s] < BASE_MATS[p.mat].lower[s][1]);
      body = upNote + `\u4E0A\u6BB5\u304B\u3089\u53D6\u308B <select data-bind="free.top">${topOpts(p, f.top)}</select> \u4E0B\u6BB5\u306B\u7F6E\u304F <select data-bind="free.slot">${slotOpts(p, f.slot)}</select>`;
    } else if (k === "enlist") {
      const fromFree = BOTTOM_ORDER.filter((s) => !p.recruits.some((r) => r.section === s));
      const bonFree = RECRUIT_ONETIME.filter((x) => !p.recruits.some((r) => r.bonus === x));
      const BN = { power: "\u6226\u529B+2", coins: "\u30B3\u30A4\u30F3+2", pop: "\u652F\u6301+2", card: "\u6226\u95D8\u30AB\u30FC\u30C9+2" };
      body = `\u53D6\u5F97\u5143 <select data-bind="free.from">${fromFree.map((s) => `<option value="${s}" ${f.from === s ? "selected" : ""}>${BOTTOM_NAMES[s]}\uFF08\u5E38\u6642\uFF1A${ONG[s]}\uFF09</option>`).join("")}</select> \u4E00\u6642\u30DC\u30FC\u30CA\u30B9 <select data-bind="free.bonus">${bonFree.map((x) => `<option value="${x}" ${f.bonus === x ? "selected" : ""}>${BN[x]}</option>`).join("")}</select>`;
    } else if (k === "produce") {
      body = `<div class="chips">${producible(ctx).map((id) => `<button class="chip ${ui.produce.includes(id) ? "on" : ""}" data-act="produce-toggle" data-v="${id}">${TERR[MAP.hexes[id].terrain][1]} ${id}</button>`).join("")}</div>`;
    } else if (k === "reposition") {
      const mode = head.mode, who = head.unit === "char" ? "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC" : "\u30E1\u30C3\u30AF";
      body = `<span class="mute">${who}\u3092${{ any: "\u4EFB\u610F\u306E\u7A7A\u306E\u9678\u5730", adj: "\u96A3\u63A5\u3059\u308B\u7A7A\u306E\u9678\u5730", mine: "\u81EA\u5206\u306E\u9271\u5C71\uFF0F\u30C8\u30F3\u30CD\u30EB" }[mode]}\u3078\u79FB\u3059</span> ${head.unit === "mech" ? `<select data-bind="free.unit">${p.mechs.map((m, i) => `<option value="m${i}" ${f.unit === `m${i}` ? "selected" : ""}>\u30E1\u30C3\u30AF${i + 1} @${m.hex}</option>`).join("")}</select>` : ""} ${hexBtn("\u79FB\u52D5\u5148", "free.hex", f.hex)}`;
    } else if (k === "recall") {
      body = `<span class="mute">\u30E6\u30CB\u30C3\u30C8\u306E\u3044\u308B\u6751\u9818\u571F\u3092\u9078\u3076\u3068\u3001\u305D\u3053\u306E\u5168\u30E6\u30CB\u30C3\u30C8\u304C\u5404\u672C\u62E0\u5730\u3078\u623B\u308A\u307E\u3059</span> ${hexBtn("\u6751\u9818\u571F", "free.hex", f.hex)}`;
    } else if (k === "moveToken") {
      body = `${hexBtn("\u79FB\u3059\u906D\u9047\u30C8\u30FC\u30AF\u30F3", "free.from2", f.from2)} \u2192 ${hexBtn("\u79FB\u52D5\u5148\u306E\u7A7A\u306E\u9678\u5730", "free.hex", f.hex)}`;
    } else if (k === "trapPlace") {
      body = `\u7F60 <select data-bind="free.pen">${(p.traps || []).map((x) => `<option value="${x}" ${(f.pen || p.traps[0]) === x ? "selected" : ""}>${TRAP_PENALTIES[x]}</option>`).join("")}</select> ${hexBtn("\u8A2D\u7F6E\u9818\u571F", "free.hex", f.hex)}`;
    } else if (k === "anyRes") {
      body = `${Array.from({ length: head.n }, (_, i) => resSel(`free.r${i}`, f["r" + i] || "oil")).join(" ")} ${hexBtn("\u7F6E\u304F\u9818\u571F", "free.hex", f.hex)}`;
    }
    const sel = kinds.length > 1 ? `<div class="row">${kinds.map((x) => `<button class="sm ${x === k ? "" : "ghost"}" data-act="free-kind" data-v="${x}">${FREE_NAMES[x]}</button>`).join("")}</div>` : "";
    return `<div class="card"><h2>\u7121\u6599\u52B9\u679C\uFF1A${kinds.map((x) => FREE_NAMES[x]).join("\u304B")}\uFF08\u6B8B\u308A${pd.queue.length}\uFF09</h2><p class="mute">\u8CBB\u7528\u306A\u3057\u3067\u5B9F\u884C\u3057\u307E\u3059\u3002</p>${sel}
      <div class="row">${body}<button data-act="free-go" data-v="${k}">\u5B9F\u884C</button><button class="ghost" data-act="free-skip">\u884C\u308F\u306A\u3044</button></div></div>`;
  }
  const LABEL = { coins: "\u30B3\u30A4\u30F3", power: "\u6226\u529B", pop: "\u652F\u6301", card: "\u6226\u95D8\u30AB\u30FC\u30C9", oil: "\u6CB9", metal: "\u9244", wood: "\u6728\u6750", food: "\u98DF\u6599", worker: "\u30EF\u30FC\u30AB\u30FC" };
  function combatPanel(ctx) {
    const { st, me: me2, priv, combat } = ctx, pd = st.pending;
    const inFight = me2 === pd.attacker || me2 === pd.defender;
    const head = `<h2>\u6226\u95D8\uFF1A${nm(ctx, pd.attacker)}\uFF08\u653B\u6483\uFF09\u5BFE ${nm(ctx, pd.defender)}</h2>`;
    if (!inFight) return `<div class="card">${head}<p class="mute">\u6226\u95D8\u306E\u7D50\u679C\u3092\u5F85\u3063\u3066\u3044\u307E\u3059\u3002</p></div>`;
    const p = st.players[me2], units = me2 === pd.attacker ? pd.attUnits : pd.defUnits;
    const committed = !!combat?.commits?.[me2];
    if (committed) return `<div class="card">${head}<p>\u6226\u529B\u3092\u78BA\u5B9A\u3057\u307E\u3057\u305F\u3002${combat?.commits && Object.keys(combat.commits).length >= 2 ? "\u516C\u958B\u3057\u3066\u3044\u307E\u3059\u2026" : "\u76F8\u624B\u306E\u78BA\u5B9A\u3092\u5F85\u3063\u3066\u3044\u307E\u3059\u2026"}</p></div>`;
    const hand = (priv?.hand || []).slice().sort((a, b) => a.value - b.value);
    const maxDial = Math.min(7, p.power);
    return `<div class="card">${head}<p class="mute">\u30C0\u30A4\u30E4\u30EB\u3068\u6226\u95D8\u30AB\u30FC\u30C9\u3092\u79D8\u5BC6\u306B\u6C7A\u3081\u3001\u540C\u6642\u306B\u516C\u958B\u3057\u307E\u3059\u3002\u540C\u70B9\u306F\u653B\u6483\u5074\u306E\u52DD\u3061\u3002</p>
      <div class="row">\u30C0\u30A4\u30E4\u30EB\uFF08\u6226\u529B${p.power}\u30FB\u6700\u5927${maxDial}\uFF09 <select data-bind="combat.dial">${Array.from({ length: maxDial + 1 }, (_, i) => `<option value="${i}" ${+ui.combat.dial === i ? "selected" : ""}>${i}</option>`).join("")}</select></div>
      <p>\u6226\u95D8\u30AB\u30FC\u30C9\uFF08\u95A2\u4E0E\u30E6\u30CB\u30C3\u30C8${units}\u4F53\u307E\u3067\uFF0F\u624B\u672D${hand.length}\u679A\uFF09</p>
      <div class="row">${hand.map((c) => `<label class="cardchip"><input type="checkbox" data-bind="combat.card" value="${c.id}" ${ui.combat.cards.includes(c.id) ? "checked" : ""}> ${c.value}</label>`).join("") || '<span class="mute">\u624B\u672D\u306A\u3057</span>'}</div>
      <div class="row"><button data-act="combat-commit">\u78BA\u5B9A\u3059\u308B</button></div></div>`;
  }
  function objectivePanel(ctx) {
    const { st, me: me2, priv } = ctx, p = st.players[me2];
    const list = (priv?.objectives || []).map((id) => byId(OBJECTIVES2, id)).filter(Boolean);
    if (!list.length) return "";
    const h = objectiveHelpers(st, me2);
    return `<p class="mute">\u76EE\u7684\u30AB\u30FC\u30C9\uFF08\u9054\u6210\u3057\u3066\u3044\u308C\u3070\u5BA3\u8A00\u3057\u3066\u661F\u3092\u5F97\u307E\u3059\uFF09</p>${list.map((o2) => {
      const ok = o2.check(p, h) && !(p.stars.includes("objective") && (p.faction !== "saxony" || p.stars.includes("objective2")));
      return `<div class="opt"><b>${esc(o2.name)}</b> <span class="mute">${esc(o2.text)}</span> <button class="sm" data-act="objective" data-v="${o2.id}" ${ok ? "" : "disabled"}>\u5BA3\u8A00</button></div>`;
    }).join("")}`;
  }
  function resultPanel(ctx) {
    const { st, room: room2, me: me2 } = ctx, r = st.result;
    return `<div class="card"><h2>\u30B2\u30FC\u30E0\u7D42\u4E86</h2><p>\u52DD\u8005\uFF1A<b>${nm(ctx, r.winner)}</b></p>
      <table class="tbl"><tr><th>\u9806\u4F4D</th><th>\u540D\u524D</th><th>\u5408\u8A08</th><th>\u30B3\u30A4\u30F3</th><th>\u661F</th><th>\u9818\u571F</th><th>\u8CC7\u6E90</th><th>\u5EFA\u7269\u30DC\u30FC\u30CA\u30B9</th></tr>
      ${r.rows.map((x) => `<tr><td>${x.rank}</td><td>${nm(ctx, x.uid)}</td><td><b>${x.total}</b></td><td>${x.parts.coins}</td><td>${x.parts.stars}</td><td>${x.parts.territories}</td><td>${x.parts.resources}</td><td>${x.parts.structureBonus}</td></tr>`).join("")}</table>
      <div class="row">${room2.hostUid === me2 ? '<button data-act="rematch">\u540C\u3058\u30E1\u30F3\u30D0\u30FC\u3067\u3082\u3046\u4E00\u5EA6</button>' : ""}<button class="ghost" data-act="leave">\u9000\u51FA</button></div></div>`;
  }
  const II = (n, t) => `<img class="ri" src="i-${n}.png" title="${t}" alt="${t}">`;
  const ICO = { coins: II("coin", "\u30B3\u30A4\u30F3"), power: II("power", "\u6226\u529B"), pop: II("pop", "\u652F\u6301"), star: II("star", "\u661F"), card: '<span class="ic" title="\u6226\u95D8\u30AB\u30FC\u30C9">\u{1F0A0}</span>', worker: II("people", "\u30EF\u30FC\u30AB\u30FC"), mech: '<span class="ic" title="\u30E1\u30C3\u30AF">\u25A3</span>' };
  const FACE = (f, n = 26) => `<img class="face" style="width:${n}px;height:${n}px" src="i-faction_${f}.jpg" alt="">`;
  const gauge = (ico, v, max, extra = "") => `<span class="gauge" title="${v} / \u6700\u5927${max}">${ico}<i class="gbar ${ico === ICO.pop ? "popbar" : ""}"><i style="width:${Math.min(100, v / max * 100)}%"></i></i><b>${v}<small>/${max}</small></b>${extra ? `<small>${extra}</small>` : ""}</span>`;
  function comparePanel(ctx) {
    const { st } = ctx;
    const rows = [[ICO.pop, (p) => p.pop, 18], [ICO.power, (p) => p.power, 16], [ICO.star, (p) => p.stars.length, 6], [ICO.coins, (p) => p.coins, Math.max(10, Math.ceil(Math.max(...Object.values(st.players).map((p) => p.coins)) / 5) * 5)]];
    return `<div class="card"><h2>\u30D7\u30EC\u30A4\u30E4\u30FC\u6BD4\u8F03</h2>${st.order.map((u, i) => `<span class="legend">${FACE(st.players[u].faction, 22)}<i style="background:${colorFor(st, u)};border:1px solid #888"></i>${nm(ctx, u)}\uFF08${BASE_FACTIONS[st.players[u].faction].name}\uFF09</span>`).join("")}
      ${rows.map(([lab, f, mx]) => `<div class="cmp"><b class="cl">${lab}</b><div class="track ${lab === ICO.pop ? "poptrack" : ""}">${lab === ICO.pop ? '<div class="tiers"><span style="width:36.1%">\u301C6\uFF1A\u9818\u571F\xD72 \u661F\xD73 \u8CC7\u6E90\xD71</span><span style="width:33.3%">7\u301C12\uFF1A\u9818\u571F\xD73 \u661F\xD74 \u8CC7\u6E90\xD72</span><span style="flex:1">13\u301C\uFF1A\u9818\u571F\xD74 \u661F\xD75 \u8CC7\u6E90\xD73</span></div>' : ""}${[...Array(mx + 1).keys()].filter((i) => i % (mx > 20 ? 5 : 2) === 0).map((i) => `<s style="left:${i / mx * 100}%"><u>${i}</u></s>`).join("")}${st.order.map((u, i) => {
      const v = f(st.players[u]);
      return `<span class="pin" data-ink="${inkOn(colorFor(st, u))}" style="left:${Math.min(100, v / mx * 100)}%;top:${4 + i * 2}px;border-color:#fff;background:${colorFor(st, u)}" title="${nm(ctx, u)}\uFF1A${v}"><em>${v}</em></span>`;
    }).join("")}<small class="mx">${lab === ICO.coins ? "\u4E0A\u9650\u306A\u3057\uFF08\u73FE\u5728\u306E\u6700\u5927\u306B\u5408\u308F\u305B\u3066\u53EF\u5909\uFF09" : `\u6700\u5927${mx}`}</small></div>
      </div>`).join("")}</div>`;
  }
  const RESIMG = (r) => `<img class="ri" src="i-${r}.png" alt="${RES_NAMES[r]}">`;
  function prodPreview(ctx) {
    const { st, me: me2 } = ctx, p = st.players[me2], out = [];
    for (const h of MAP.ids) {
      const T = MAP.hexes[h].terrain, n = p.workers.filter((w) => w === h).length;
      if (!n || controller(st, h) !== me2) continue;
      const mill = p.structures.some((s) => s.type === "mill" && s.hex === h) ? 1 : 0;
      if (T === "village") out.push(`\u6751${h}\uFF1A\u30EF\u30FC\u30AB\u30FC+${n + mill}`);
      else {
        const r = { mountain: "metal", tundra: "oil", farm: "food", forest: "wood" }[T];
        if (r) out.push(`${RESIMG(r)}\xD7${n + mill}\uFF08${h}\uFF09`);
      }
    }
    return out.length ? out.join(" ") : '<span class="mute">\u751F\u7523\u3067\u304D\u308B\u9818\u571F\u306A\u3057</span>';
  }
  function factionMat(ctx) {
    const { st, me: me2 } = ctx, p = st.players[me2];
    const fc = p.factory ? byId(FACTORY_CARDS2, p.factory) : null;
    const pick3 = st.turnUid === me2 && st.turn.phase === "section" && !st.pending && legalSections(st, me2).includes("factory");
    const fcol = fc ? `<${pick3 ? "button" : "div"} class="acol fac ${p.section === "factory" ? "cur" : ""} ${pick3 ? "can" : ""}" ${pick3 ? 'data-act="section" data-v="factory"' : ""} title="${esc(fc.text)}"><img src="${fc.img}" alt=""><small>\u5DE5\u5834\uFF1A${esc(fc.text)}</small></${pick3 ? "button" : "div"}>` : "";
    return `<div class="fwrap">${factionMat0(ctx)}${fcol}</div>`;
  }
  function factionMat0(ctx) {
    const { st, me: me2, priv } = ctx, p = st.players[me2], f = p.faction, F2 = BASE_FACTIONS[f];
    const hand = (priv?.hand || []).map((c) => c.value).sort((a, b) => a - b);
    const slots = MECH_SLOTS[f].map((a, i) => {
      const on = p.mechs.some((m) => m.slot === i);
      return `<div class="slot ${on ? "on" : ""}"><b>${on ? "\u2714 " : "\u25A1 "}${ABILITY_NAMES[a]}</b><span>${ABILITY_TEXT[a](f)}</span></div>`;
    }).join("");
    return `<div class="mat fmat" style="background-image:linear-gradient(rgba(10,8,6,.55),rgba(10,8,6,.88)),url(i-faction_${f}.jpg)">
      <div class="mh"><b>${F2.name}</b> <span class="pas">\u56FA\u6709\uFF1A${PASSIVE[f][0]}</span> <span class="mute">${PASSIVE[f][1]}</span></div>
      <div class="chips2">${gauge(ICO.power, p.power, 16)}${gauge(ICO.pop, p.pop, 18, `\uFF08\u9818\u571F\xD7${popTier(p.pop).terr}\uFF09`)}<span class="gauge" title="\u30B3\u30A4\u30F3\u306B\u4E0A\u9650\u306F\u3042\u308A\u307E\u305B\u3093\uFF08\u30B2\u30FC\u30B8\u306F\u53C2\u52A0\u8005\u306E\u6700\u5927\u5024\u306B\u5408\u308F\u305B\u3066\u4F38\u3073\u307E\u3059\uFF09">${ICO.coins}<i class="gbar"><i style="width:${Math.min(100, p.coins / Math.max(10, ...Object.values(st.players).map((q) => q.coins)) * 100)}%"></i></i><b>${p.coins}</b></span>${gauge(ICO.star, p.stars.length, 6)}<span>${ICO.card}<b>${hand.join(",") || "-"}</b></span><span>${ICO.worker}<b>${p.workers.length}+${p.matWorkers}</b></span>${gauge(ICO.mech, p.mechs.length, 4)}${["oil", "metal", "wood", "food"].map((r) => `<span>${RESIMG(r)}<b>${resTotals(st, me2)[r]}</b></span>`).join("")}</div>
      <div class="slots">${slots}</div>
      <div class="mute small">\u30E1\u30C3\u30AF\u3092\u914D\u5099\u3059\u308B\u3068\u304D\u3001\u89E3\u653E\u3059\u308B\u80FD\u529B\u3092\u4E0A\u304B\u3089\u9078\u3079\u307E\u3059\uFF08\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3068\u5168\u30E1\u30C3\u30AF\u306B\u9069\u7528\uFF09\u3002</div></div>`;
  }
  function actionMat(ctx) {
    const { st, me: me2 } = ctx, p = st.players[me2], m = BASE_MATS[p.mat];
    const pick3 = st.turnUid === me2 && st.turn.phase === "section" && !st.pending;
    const ok = pick3 ? legalSections(st, me2) : [];
    const ic = (x) => `<span class="g">${x}</span>`;
    const SQ = (cls, inner, title = "") => `<i class="sq ${cls}" ${title ? `title="${title}"` : ""}>${inner}</i>`;
    const coinI = II("coin", "\u30B3\u30A4\u30F3"), powI = II("power", "\u6226\u529B"), popI = II("pop", "\u652F\u6301");
    const GLYPH = { power: powI, card: '<b class="em">\u{1F0A0}</b>', move: '<b class="em">\u{1F3C3}</b>', coin: coinI, pop: popI, hex: '<b class="em">\u2B21</b>', res: '<b class="em">\u25D0</b>' };
    const TOPSPEC = {
      bolster: { pay: coinI, groups: [["power", 2, 1], ["card", 1, 1]] },
      move: { pay: "", groups: [["move", 2, 1], ["coin", 1, 0]] },
      produce: { pay: "", groups: [["hex", 2, 1]] },
      trade: { pay: coinI, groups: [["res", 2, 1], ["pop", 1, 1]] }
    };
    const LABEL2 = { bolster: "\u5F37\u5316", move: "\u79FB\u52D5\uFF0F\u7372\u5F97", produce: "\u751F\u7523", trade: "\u4EA4\u6613" };
    const topBlock = (top, s) => {
      const sp = TOPSPEC[top], up = p.up[top] || 0;
      let used = 0, bar = "";
      const grp = sp.groups.map(([g, n, slots]) => {
        const cells = Array.from({ length: n }, () => SQ("gain", GLYPH[g])).join("");
        const sl = Array.from({ length: Math.min(slots, Math.max(0, (TOP_CUBES[top] || 0) - used)) }, () => {
          const filled = used < up;
          used++;
          return SQ(`slot ${filled ? "got" : ""}`, filled ? GLYPH[g] : '<u class="cube"></u>', filled ? "\u6539\u826F\u6E08\u307F\uFF08\u52B9\u679C\u767A\u52D5\u4E2D\uFF09" : "\u6539\u826F\u30AD\u30E5\u30FC\u30D6\u67A0");
        }).join("");
        return `<span class="grp">${cells}${sl}</span>`;
      }).join('<b class="sl">\uFF0F</b>');
      if (top === "produce") {
        const w = p.workers.length, cost = produceCost(w);
        bar = `<div class="pbar" title="\u30EF\u30FC\u30AB\u30FC\u6570\u306B\u5FDC\u3058\u305F\u751F\u7523\u30B3\u30B9\u30C8\uFF08\u8D64\u67A0\uFF09">${[1, 2, 3, 4, 5, 6].map((k) => `<i class="${w >= 2 * k ? "act" : ""}">${k === 2 ? powI : k === 4 ? popI : k === 6 ? coinI : ""}</i>`).join("")}</div>`;
      }
      return `<div class="top"><div class="lbl">${LABEL2[top]}</div>${sp.pay ? `<div class="row1"><small>\u652F\u6255</small>${SQ("pay", sp.pay)}</div>` : ""}${bar}<div class="row1">${grp}</div></div>`;
    };
    const cols = [0, 1, 2, 3].map((s) => {
      const top = topOf(p.mat, s), sk = structOf(p.mat, s), bk = BOTTOM_ORDER[s], [base, maxRed, coin] = m.lower[bk];
      const cost = Math.max(0, base - p.red[bk]), built = p.structures.some((x) => x.type === sk);
      const cur = p.section === s, rec = p.recruits.find((x) => x.section === bk);
      const ONGI = { upgrade: powI, deploy: coinI, build: popI, enlist: GLYPH.card }[bk];
      const BG = { upgrade: "\u2699", deploy: "\u25A3", build: "\u2302", enlist: "\u{1FA96}" }[bk];
      const pay2 = Array.from({ length: base }, (_, i) => i >= base - maxRed && i - (base - maxRed) < p.red[bk] ? SQ("slot got", '<u class="cube"></u>', "\u6539\u826F\u6E08\u307F\uFF08\u3053\u306E\u30B3\u30B9\u30C8\u304C\u4E0D\u8981\u306B\uFF09") : SQ("pay", RESIMG(BOTTOM_RES[bk]))).join("");
      return `<${pick3 ? "button" : "div"} class="acol pm ${cur ? "cur" : ""} ${pick3 && ok.includes(s) ? "can" : ""}" ${pick3 ? `data-act="section" data-v="${s}" ${ok.includes(s) ? "" : "disabled"}` : ""} title="${esc(TOP_TEXT[top])}\uFF0F${esc(BOTTOM_TEXT[bk])}">
        ${topBlock(top, s)}
        <div class="bld ${built ? "built" : ""}" title="${esc(STRUCT_TEXT[sk])}"><span class="bi"><img src="i-${sk}.png" alt=""></span><small>${STRUCT_NAMES[sk]}${built ? "\uFF1A\u767A\u52D5\u4E2D" : ""}</small></div>
        <div class="bot"><div class="row1"><small>\u652F\u6255</small>${pay2}</div>
          <div class="row1 act2"><small class="nm">${BOTTOM_NAMES[bk]}</small>${SQ("gain", `<b class="em">${BG}</b>`)}${Array.from({ length: coin }, () => `<i class="cn">${coinI}</i>`).join("")}</div>
          <div class="rc"><span class="ring ${rec ? "on" : ""}" title="${rec ? `\u5FB4\u5175\u6E08\u307F\uFF1A\u81EA\u5206\u3068\u4E21\u96A3\u304C\u3053\u306E\u4E0B\u6BB5\u3092\u884C\u3046\u305F\u3073 ${ONG[bk]}` : `\u5FB4\u5175\u3059\u308B\u3068\u3001\u81EA\u5206\u3068\u4E21\u96A3\u304C\u3053\u306E\u4E0B\u6BB5\u3092\u884C\u3046\u305F\u3073 ${ONG[bk]}`}">${II("people", "\u5FB4\u5175")}</span><span class="ring2" title="\u5E38\u6642\u30DC\u30FC\u30CA\u30B9\uFF1A${ONG[bk]}">${ONGI}</span></div>
          ${cost !== base ? `<small class="cst">\u30B3\u30B9\u30C8 ${cost}</small>` : ""}</div></${pick3 ? "button" : "div"}>`;
    }).join("");
    return `<div class="mat amat" style="background-image:linear-gradient(rgba(10,8,6,.5),rgba(10,8,6,.85)),url(i-mat_${MAT_IMG[p.mat] || 1}.jpg)">
      <div class="mh"><b>${m.name}\u30DE\u30C3\u30C8</b> <span class="mute">\u6539\u826F ${p.cubes}/6 \u30FB \u5FB4\u5175 ${p.recruits.length}/4 \u30FB \u5EFA\u7269 ${p.structures.length}/4${pick3 ? ' \u30FB <b class="hint">\u5217\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u4ECA\u56DE\u306E\u30BB\u30AF\u30B7\u30E7\u30F3\u3092\u9078\u3076</b>' : ""}</span></div>
      <div class="acols">${cols}</div></div>`;
  }
  function modalHtml(ctx) {
    const { st } = ctx;
    const inner = ui.convOpen && ctx.st.turnUid === ctx.me && !ctx.st.pending && ctx.st.turn.phase !== "moving" ? convertPanel(ctx, true) : panelAction(ctx);
    if (!inner) return "";
    if (st.over) return `<div class="modal wide">${inner}</div>`;
    const pos = ui.mpos ? `left:${ui.mpos.x}px;top:${ui.mpos.y}px;transform:none;` : "";
    return `<div class="modal ${ui.mfold ? "fold" : ""}" style="${pos}"><div class="mdrag" data-drag title="\u30C9\u30E9\u30C3\u30B0\u3067\u79FB\u52D5\uFF0F\u30AF\u30EA\u30C3\u30AF\u3067\u305F\u305F\u3080">\u283F ${ui.mfold ? "\u25BC \u3072\u3089\u304F" : "\u25B2 \u305F\u305F\u3080"}\uFF08\u30C9\u30E9\u30C3\u30B0\u3067\u79FB\u52D5\uFF09</div>${ui.mfold ? "" : matWrap(ctx, inner)}</div>`;
  }
  function objBox(ctx) {
    const { st, me: me2, priv } = ctx, p = st.players[me2];
    const list = (priv?.objectives || []).map((id) => byId(OBJECTIVES2, id)).filter(Boolean);
    const bt = byId(BONUS_TILES, st.bonusTile);
    if (!ui.objOpen) return `<div class="objbox shut"><button class="ghost sm" data-act="objtoggle">\u76EE\u7684\u30AB\u30FC\u30C9 ${list.length}\u679A \u25BC</button></div>`;
    const JP = { 1: "\u9AD8\u5730\u306E\u5229", 11: "\u4EBA\u53E3\u306E\u512A\u4F4D", 16: "\u7F8A\u306E\u7FA4\u308C\u306E\u72FC", 24: "\u4EBA\u9593\u306E\u76FE", 25: "\u5FCC\u307E\u308F\u3057\u304D\u6226\u4E89\u5C4B", 26: "\u591A\u69D8\u306A\u751F\u7523", 27: "\u5730\u57DF\u57FA\u76E4\u6574\u5099" };
    const got = p.stars.includes("objective");
    const row = (o2) => {
      let ok = false;
      try {
        ok = !!o2.check(p, objectiveHelpers(st, me2));
      } catch {
      }
      return `<div class="ob ${ok ? "okc" : ""}"><b>${ok ? "\u2705" : "\u2B1C"} ${esc(JP[o2.no] || o2.name)}</b><span><u>\u6761\u4EF6</u> ${esc(o2.text)}</span><em>${ok ? "\u6761\u4EF6\u3092\u6E80\u305F\u3057\u3066\u3044\u307E\u3059\uFF08\u81EA\u52D5\u3067\u661F\u3092\u7372\u5F97\uFF09" : "\u672A\u9054\u6210"}</em></div>`;
    };
    return `<div class="objbox"><button class="ghost sm fold" data-act="objtoggle">\u25B2 \u305F\u305F\u3080</button><b>\u76EE\u7684\u30AB\u30FC\u30C9</b>
      <div class="ob mute">\u6761\u4EF6\u3092\u6E80\u305F\u3057\u305F\u6642\u70B9\u3067\u81EA\u52D5\u7684\u306B\u661F1\u3064\u3092\u7372\u5F97\u3057\u307E\u3059\uFF08\u64CD\u4F5C\u4E0D\u8981\u30FB\u661F\u306F1\u679A\u5206\u306E\u307F\uFF09</div>
      ${list.length ? list.map(row).join("") : '<div class="ob mute">\u306A\u3057</div>'}${got ? '<div class="ob">\u2B50 \u76EE\u7684\u306E\u661F\u3092\u7372\u5F97\u6E08\u307F</div>' : ""}<div class="ob bt"><b>\u5EFA\u7269\u30DC\u30FC\u30CA\u30B9</b><span>${esc(bt?.text || "")}</span></div></div>`;
  }
  function convertPanel(ctx, inModal) {
    const { st, me: me2 } = ctx;
    if (st.turnUid !== me2 || st.pending || st.over) return "";
    const me_p = st.players[me2];
    const coer = me_p.faction === "crimea" ? `<div class="row" style="margin-top:8px"><b>\u5F37\u8981\uFF08\u30AF\u30EA\u30DF\u30A2\uFF09</b> \u6226\u95D8\u30AB\u30FC\u30C91\u679A \u2192 ${resSel("conv.to", ui.conv.to)} ${hexBtn("\u7F6E\u304F\u9818\u571F", "conv.hex", ui.conv.hex)}<button data-act="coercion" ${st.turn.coerced ? "disabled" : ""}>${st.turn.coerced ? "\u4F7F\u7528\u6E08\u307F\uFF081\u624B\u756A1\u56DE\uFF09" : "\u30AB\u30FC\u30C9\u3092\u8CC7\u6E90\u306B\u3059\u308B"}</button></div>` : "";
    return `<div class="card"><h2>\u21C4 \u8CC7\u6E90\u4EA4\u63DB</h2><p class="mute">\u4EFB\u610F\u306E\u8CC7\u6E902\u500B \u2192 \u4EFB\u610F\u306E\u8CC7\u6E901\u500B\uFF08\u81EA\u5206\u306E\u30EF\u30FC\u30AB\u30FC\u304C\u3044\u308B\u652F\u914D\u9818\u571F\u306B\u7F6E\u304F\uFF09</p>
      <div class="row">${resSel("conv.a", ui.conv.a)} \uFF0B ${resSel("conv.b", ui.conv.b)} \u2192 ${resSel("conv.to", ui.conv.to)} ${hexBtn("\u7F6E\u304F\u9818\u571F", "conv.hex", ui.conv.hex)}<button data-act="convert">\u4EA4\u63DB\u3059\u308B</button>${inModal ? '<button class="ghost" data-act="convtoggle">\u9589\u3058\u308B</button>' : ""}</div>${coer}</div>`;
  }
  function hexPanel(ctx) {
    const { st } = ctx;
    if (!ui.sel) return `<div class="card"><h2>\u9818\u571F</h2><p class="mute">\u76E4\u9762\u306E\u9818\u571F\u3092\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u3068\u8A73\u7D30\u3092\u8868\u793A\u3057\u307E\u3059\u3002</p></div>`;
    const h = MAP.hexes[ui.sel], hs = st.hexes[ui.sel], us = unitsAt(st, ui.sel), c = controller(st, ui.sel);
    return `<div class="card"><h2>\u9818\u571F ${ui.sel}\uFF1A${TERR[h.terrain][1]}</h2>
      <div class="stats">\u652F\u914D: ${c ? nm(ctx, c) : "\u306A\u3057"} ${hs.enc ? "\uFF0F \u906D\u9047\u30C8\u30FC\u30AF\u30F3\u3042\u308A" : ""} ${h.tunnel ? "\uFF0F \u30C8\u30F3\u30CD\u30EB" : ""}</div>
      <div class="stats">\u8CC7\u6E90: ${Object.entries(hs.res).filter(([, v]) => v).map(([k, v]) => `${RES_NAMES[k]}${v}`).join(" ") || "\u306A\u3057"} ${hs.structure ? `\uFF0F \u5EFA\u7269: ${STRUCT_NAMES[hs.structure.type]}\uFF08${nm(ctx, hs.structure.owner)}\uFF09` : ""}</div>
      <div class="stats">\u30E6\u30CB\u30C3\u30C8: ${Object.entries(us).map(([u, x]) => `${nm(ctx, u)}(\u5C06${x.char ? 1 : 0} M${x.mechs} \u5DE5${x.workers})`).join(" ") || "\u306A\u3057"}</div></div>`;
  }
  function logPanel(ctx) {
    const { st } = ctx;
    return `<div class="card"><h2>\u30ED\u30B0</h2><div class="log">${st.log.slice(-40).reverse().map((l) => `<div><span class="mute">T${l.n}</span> ${nm(ctx, l.uid)}\uFF1A${esc(l.text)}</div>`).join("")}</div></div>`;
  }
  function render2() {
    const ctx = getCtx();
    if (!ctx?.st) {
      root.innerHTML = "<p>\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026</p>";
      return;
    }
    const { st, me: me2 } = ctx;
    const tile = byId(BONUS_TILES, st.bonusTile);
    const mine = st.turnUid === me2 && !st.over;
    root.innerHTML = `
      <div class="turnbar ${mine ? "mine" : ""}">${st.over ? "\u30B2\u30FC\u30E0\u7D42\u4E86" : `\u624B\u756A\uFF1A<b>${nm(ctx, st.turnUid)}</b>${mine ? "\uFF08\u3042\u306A\u305F\uFF09" : ""}`} <span class="mute">\u30BF\u30FC\u30F3${st.turnNo}</span>
        <span class="tools"><button class="ghost sm" data-act="convtoggle" ${mine && !st.pending ? "" : "disabled"} title="\u81EA\u5206\u306E\u624B\u756A\u4E2D\u306E\u307F">\u21C4 \u8CC7\u6E90\u4EA4\u63DB</button><button class="ghost sm ${ui.resMode ? "on" : ""}" data-act="resmode">${ui.resMode ? "\u901A\u5E38\u30DE\u30C3\u30D7\u306B\u623B\u3059" : "\u53D6\u308C\u308B\u8CC7\u6E90\u3092\u8868\u793A"}</button>${mine ? `<button class="endbtn" data-act="endTurn" ${st.pending ? "disabled" : ""}>\u30BF\u30FC\u30F3\u7D42\u4E86</button>` : ""}<button class="ghost sm" data-act="zoom-">\u2212</button><button class="ghost sm" data-act="zoom+">\uFF0B</button>
        <label class="chk"><input type="checkbox" data-bind="sound" ${ui.sound ? "checked" : ""}> \u52B9\u679C\u97F3</label></span></div>
      ${st.over ? "" : stepsBar(st)}
      <div class="game"><div class="boardwrap" id="boardwrap">${boardSVG(ctx)}${objBox(ctx)}</div>
      <div class="mats2">${st.over ? "" : `${factionMat(ctx)}${actionMat(ctx)}`}</div></div>
      <div class="below">${convertPanel(ctx)}${comparePanel(ctx)}${hexPanel(ctx)}${logPanel(ctx)}</div>${modalHtml(ctx)}`;
    root.querySelectorAll("select[data-bind]").forEach((el) => setPath(el.dataset.bind, el.value));
    fitMats();
    try {
      fx(ctx);
    } catch (e) {
      console.error(e);
    }
    if (st.log.length !== ui.lastLog) {
      if (ui.lastLog) {
        const last = st.log[st.log.length - 1], x = last.text;
        sfx(/星/.test(x) ? "star" : /戦闘|退却/.test(x) ? "combat" : /建設|配備|改良|徴兵|工場/.test(x) ? "build" : /生産/.test(x) ? "produce" : /コイン|資源|獲得|遭遇/.test(x) ? "coin" : /移動/.test(x) ? "move" : /終了/.test(x) ? "end" : "click");
      }
      if (ui.lastTurn !== st.turnUid) {
        if (ui.lastTurn && st.turnUid === me2) sfx("turn");
        ui.lastTurn = st.turnUid;
      }
      ui.lastLog = st.log.length;
    }
  }
  const tried = /* @__PURE__ */ new Set();
  function autoAction(ctx) {
    const { st, me: me2, priv } = ctx, p = st.players[me2], pd = st.pending, t = st.turn;
    const once = (key, a) => tried.has(key) ? null : (tried.add(key), a);
    const sig = `${st.gid}.${st.log.length}`;
    if (pd?.type === "free") {
      const h = pd.queue[0], kinds = h.alt || [h.k];
      if (!kinds.some((k) => canDo(st, me2, k, true))) return once(`fs${sig}`, { t: "free", skip: true });
      return null;
    }
    if (pd?.type === "encounter" && pd.cardId) {
      const c = byId(ENCOUNTERS2, pd.cardId);
      return c.options.some((o2) => encAvail(st, me2, o2)) ? null : once(`en${sig}`, { t: "encounter", picks: [] });
    }
    if (pd) return null;
    if (t.phase === "section") {
      const anyUnit = (u) => moveTargets(st, me2, u).length > 0;
      const can = legalSections(st, me2).some((sec) => {
        const kind = sec === "factory" ? "factory" : topOf(p.mat, sec);
        const topOk = kind === "move" ? ["char", ...p.mechs.map((_, i) => `m${i}`), ...p.workers.map((_, i) => `w${i}`)].some(anyUnit) : kind === "factory" ? true : canDo(st, me2, kind);
        return topOk || sec !== "factory" && canDo(st, me2, BOTTOM_ORDER[sec], false, true);
      });
      if (!can) return once(`ae${sig}`, { t: "endTurn" });
    }
    if (t.phase !== "moving") {
      const free = !p.stars.includes("objective") || p.faction === "saxony" && !p.stars.includes("objective2");
      if (free && p.objs > 0) for (const id of priv?.objectives || []) {
        const c = byId(OBJECTIVES2, id);
        if (c && c.check(p, objectiveHelpers(st, me2))) return once(`ob${id}${sig}`, { t: "objective", cardId: id });
      }
    }
    if (t.phase === "end") return once(`ee${sig}`, { t: "endTurn" });
    if (t.phase === "top") {
      const kind = p.section === "factory" ? "factory" : topOf(p.mat, p.section);
    }
    if (t.phase === "moving" && t.move) {
      const units = ["char", ...p.mechs.map((_, i) => `m${i}`), ...p.workers.map((_, i) => `w${i}`)].filter((u) => !t.move.moved.includes(u));
      if (!units.some((u) => moveTargets(st, me2, u).length)) return once(`mv${sig}`, { t: "endMove" });
    }
    if (t.phase === "bottom" && p.section !== "factory") {
      if (!canDo(st, me2, BOTTOM_ORDER[p.section], false, true)) return once(`bt${sig}`, { t: "bottom", kind: "skip" });
    }
    return null;
  }
  async function tick() {
    const ctx = getCtx();
    if (!ctx?.st) return;
    const { st, me: me2, deck, combat } = ctx;
    if (deck && ((deck.grants?.[me2] || 0) > 0 || (deck.objGrants?.[me2] || 0) > 0) && !busy.has("claim")) {
      busy.add("claim");
      await guard(() => net().claim());
      busy.delete("claim");
    }
    if (st.turnUid === me2 && !st.over && !busy.has("auto")) {
      const a = autoAction(ctx);
      if (a) {
        busy.add("auto");
        if (a.t === "bottom" && a.kind === "skip") toast2("\u4E0B\u6BB5\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u5B9F\u884C\u3067\u304D\u306A\u3044\u305F\u3081\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F");
        await guard(() => net().dispatch(a));
        busy.delete("auto");
        return;
      }
    }
    const pd = st.pending;
    if (pd?.type === "encounter" && !pd.cardId && st.turnUid === me2 && !busy.has("enc")) {
      busy.add("enc");
      await guard(() => net().drawEncounter());
      busy.delete("enc");
    }
    if (pd?.type === "combat" && (me2 === pd.attacker || me2 === pd.defender)) {
      const both = combat?.commits && Object.keys(combat.commits).length >= 2;
      if (both && !combat.reveals?.[me2] && !busy.has(`rv${pd.key}`)) {
        busy.add(`rv${pd.key}`);
        try {
          await guard(() => net().revealCombat(pd.key));
        } finally {
          setTimeout(() => busy.delete(`rv${pd.key}`), 1500);
        }
      }
      if (me2 === pd.attacker && combat?.reveals && Object.keys(combat.reveals).length >= 2 && !busy.has(`rs${pd.key}`)) {
        busy.add(`rs${pd.key}`);
        try {
          const a = await net().verifyReveal(pd.key, pd.attacker, combat), d = await net().verifyReveal(pd.key, pd.defender, combat);
          if (!a || !d) toast2("\u6226\u529B\u306E\u516C\u958B\u5185\u5BB9\u304C\u78BA\u5B9A\u6642\u3068\u4E00\u81F4\u3057\u307E\u305B\u3093");
          else await guard(() => net().dispatch({ t: "combat", att: a, def: d }));
        } finally {
          setTimeout(() => busy.delete(`rs${pd.key}`), 1500);
        }
      }
    }
  }
  const setPath = (path, val) => {
    const [a, b] = path.split(".");
    if (b) ui[a][b] = val;
    else ui[a] = val;
  };
  function selectUnit(ctx, unit) {
    const { st, me: me2 } = ctx, mv = st.turn.move;
    if (!mv) return;
    if (mv.moved.includes(unit)) return toast2("\u305D\u306E\u30E6\u30CB\u30C3\u30C8\u306F\u3059\u3067\u306B\u52D5\u304B\u3057\u307E\u3057\u305F");
    ui.selUnit = unit;
    ui.pick = null;
    const allow = void 0;
    ui.targets = moveTargets(st, me2, unit, allow);
    render2();
  }
  function onHex(ctx, id) {
    const { st, me: me2 } = ctx;
    if (ui.pick && st.turn.phase === "moving" && !st.pending) ui.pick = null;
    if (!ui.pick && prodMode(ctx) && producibleHexes(st, me2).includes(id)) {
      const lim = 2 + (st.players[me2].up.produce || 0);
      ui.produce = ui.produce.includes(id) ? ui.produce.filter((x) => x !== id) : [...ui.produce, id].slice(-lim);
      render2();
      return;
    }
    if (ui.pick) {
      const { key } = ui.pick;
      if (!ui.pick.ok(id)) {
        toast2("\u305D\u3053\u306F\u9078\u3079\u307E\u305B\u3093");
        return;
      }
      if (key === "produce") {
        if (!ui.produce.includes(id)) ui.produce = [...ui.produce, id].slice(-2);
        else ui.produce = ui.produce.filter((x) => x !== id);
      } else if (key === "trade.hex") ui.trade.hex = id;
      else if (key === "fac.hex") ui.fac.hex = id;
      else if (key === "bot.hex") ui.bot.hex = id;
      else if (key === "free.hex") ui.free.hex = id;
      else if (key === "free.from2") ui.free.from2 = id;
      else if (key === "conv.hex") ui.conv.hex = id;
      if (key !== "produce") ui.pick = null;
      render2();
      return;
    }
    if (st.turn.phase === "moving" && ui.selUnit && ui.targets.some((t) => t.to === id)) {
      const unit = ui.selUnit;
      let carry;
      if (ui.carry) {
        const from = st.turn.move && (unit === "char" ? st.players[me2].char : unit[0] === "m" ? st.players[me2].mechs[+unit.slice(1)].hex : st.players[me2].workers[+unit.slice(1)]);
        carry = { ...st.hexes[from].res };
      }
      ui.selUnit = null;
      ui.targets = [];
      const workers = unit[0] === "m" ? +ui.wcar || 0 : 0;
      ui.wcar = 0;
      const via = unit[0] === "m" && ui.via?.hex ? [{ hex: ui.via.hex, drop: +ui.via.drop || 0, take: +ui.via.take || 0 }] : void 0;
      ui.via = null;
      act({ t: "move", unit, to: id, carry, workers, via });
      return;
    }
    ui.sel = id;
    render2();
  }
  const okMine = (ctx, id) => controller(ctx.st, id) === ctx.me && ctx.st.players[ctx.me].workers.includes(id);
  function onClick(e) {
    const ctx = getCtx();
    if (!ctx?.st) return;
    const { st, me: me2 } = ctx;
    const unitEl = e.target.closest("[data-unit]");
    if (unitEl && st.turn.phase === "moving" && st.turnUid === me2 && !st.pending) {
      selectUnit(ctx, unitEl.dataset.unit);
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (btn) {
      if (!/section|endTurn/.test(btn.dataset.act)) sfx("click");
      handleAct(ctx, btn.dataset.act, btn.dataset.v);
      return;
    }
    const hx = e.target.closest("[data-hex]");
    if (hx) onHex(ctx, hx.dataset.hex);
  }
  function handleAct(ctx, a, v) {
    const { st, me: me2 } = ctx, p = st.players[me2];
    switch (a) {
      case "objtoggle":
        ui.objOpen = !ui.objOpen;
        render2();
        break;
      case "resmode":
        ui.resMode = !ui.resMode;
        render2();
        break;
      case "zoom+":
        ui.zoom = Math.min(2.4, ui.zoom + 0.2);
        render2();
        break;
      case "zoom-":
        ui.zoom = Math.max(0.6, ui.zoom - 0.2);
        render2();
        break;
      case "leave":
        onLeave();
        break;
      case "rematch":
        onRematch();
        break;
      case "section":
        act({ t: "section", section: v === "factory" ? "factory" : +v });
        break;
      case "cancel-sec":
        act({ t: "cancelSection" });
        break;
      case "top-skip":
        act({ t: "top", kind: "skip" });
        break;
      case "move-units":
        act({ t: "top", kind: "move", mode: "units" });
        break;
      case "move-coin":
        act({ t: "top", kind: "move", mode: "coin" });
        break;
      case "bolster-power":
        act({ t: "top", kind: "bolster", mode: "power" });
        break;
      case "bolster-card":
        act({ t: "top", kind: "bolster", mode: "card" });
        break;
      case "trade-pop":
        act({ t: "top", kind: "trade", mode: "pop" });
        break;
      case "flag":
        act(v ? { t: "flag" } : { t: "flag", skip: true });
        break;
      case "trap":
        act(v ? { t: "trap", penalty: v } : { t: "trap", skip: true });
        break;
      case "resset": {
        const [k, r] = v.split("|");
        setPath(k, r);
        render2();
        break;
      }
      case "coercion":
        if (!ui.conv.hex) return toast2("\u7F6E\u304F\u9818\u571F\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
        act({ t: "coercion", res: ui.conv.to, hex: ui.conv.hex });
        break;
      case "convtoggle":
        if (st.turnUid !== me2) return toast2("\u8CC7\u6E90\u4EA4\u63DB\u306F\u81EA\u5206\u306E\u624B\u756A\u4E2D\u3060\u3051\u3067\u3059");
        ui.convOpen = !ui.convOpen;
        render2();
        break;
      case "convert":
        if (!ui.conv.hex) return toast2("\u7F6E\u304F\u9818\u571F\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
        act({ t: "convert", give: [ui.conv.a, ui.conv.b], to: ui.conv.to, hex: ui.conv.hex });
        break;
      case "trade-res":
        if (!ui.trade.hex) return toast2("\u8CC7\u6E90\u3092\u7F6E\u304F\u9818\u571F\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
        act({ t: "top", kind: "trade", mode: "res", res: [{ type: ui.trade.r1, hex: ui.trade.hex }, { type: ui.trade.r2, hex: ui.trade.hex }] });
        break;
      case "produce-go":
        act({ t: "top", kind: "produce", hexes: ui.produce });
        ui.produce = [];
        ui.pick = null;
        break;
      case "produce-toggle":
        ui.produce = ui.produce.includes(v) ? ui.produce.filter((x) => x !== v) : [...ui.produce, v].slice(-(2 + (st.players[me2].up.produce || 0)));
        render2();
        break;
      case "free-kind":
        ui.free.kind = v;
        render2();
        break;
      case "free-skip":
        ui.produce = [];
        act({ t: "free", skip: true });
        break;
      case "free-go": {
        const f = ui.free, body = { t: "free", kind: v };
        if (v === "build") Object.assign(body, { type: f.type, hex: f.hex });
        else if (v === "deploy") Object.assign(body, { slot: +f.mech, hex: f.hex });
        else if (v === "upgrade") Object.assign(body, { slot: f.slot, top: f.top });
        else if (v === "enlist") Object.assign(body, { from: f.from, bonus: f.bonus });
        else if (v === "produce") {
          body.hexes = ui.produce;
          ui.produce = [];
        } else if (v === "reposition") Object.assign(body, { unit: f.unit, hex: f.hex });
        else if (v === "recall") Object.assign(body, { hex: f.hex });
        else if (v === "moveToken") Object.assign(body, { from: f.from2, to: f.hex });
        else if (v === "trapPlace") Object.assign(body, { penalty: f.pen || p.traps[0], hex: f.hex });
        else if (v === "anyRes") {
          const n = st.pending.queue[0].n;
          body.res = Array.from({ length: n }, (_, i) => f["r" + i] || "oil");
          body.hex = f.hex || p.char;
        }
        act(body);
        ui.free.hex = null;
        ui.free.from2 = null;
        break;
      }
      case "produce-clear":
        ui.produce = [];
        ui.pick = null;
        render2();
        break;
      case "factory-go":
        {
          const c = byId(FACTORY_CARDS2, p.factory);
          act({ t: "top", kind: "factory", hex: ui.fac.hex || p.char, payRes: Array.from({ length: c.cost.anyRes || 0 }, (_, i) => ui.fac["pay" + i] || ["oil", "wood"][i] || "oil") });
        }
        ;
        break;
      case "unit":
        selectUnit(ctx, v);
        break;
      case "endMove":
        ui.selUnit = null;
        ui.targets = [];
        act({ t: "endMove" });
        break;
      case "bot-skip":
        act({ t: "bottom", kind: "skip" });
        break;
      case "bot-factory":
        act({ t: "bottom", kind: "factoryMove" });
        break;
      case "bot-go": {
        const kind = BOTTOM_ORDER[p.section], b = ui.bot;
        const body = kind === "upgrade" ? { slot: b.slot, top: b.top } : kind === "deploy" ? { slot: +b.mech, hex: b.hex } : kind === "build" ? { type: b.type, hex: b.hex } : { from: b.from, bonus: b.bonus };
        act({ t: "bottom", kind, ...body });
        break;
      }
      case "objective":
        act({ t: "objective", cardId: v });
        break;
      case "endTurn":
        if (confirm("\u30BF\u30FC\u30F3\u3092\u7D42\u4E86\u3057\u307E\u3059\u304B\uFF1F")) act({ t: "endTurn" });
        break;
      case "enc-go": {
        const x = ui.encx || {};
        const opp = Object.keys(st.players).filter((u) => u !== me2);
        act({ t: "encounter", picks: ui.enc, target: x.target || opp[0], objId: x.obj || (ctx.priv?.objectives || [])[0] });
        ui.enc = [];
        ui.encx = {};
        break;
      }
      case "factory-pick":
        act({ t: "factory", cardId: v });
        break;
      case "combat-commit": {
        const pd = st.pending, maxDial = Math.min(7, p.power), units = me2 === pd.attacker ? pd.attUnits : pd.defUnits;
        const dial = Math.max(0, Math.min(maxDial, Math.floor(+ui.combat.dial || 0)));
        if (ui.combat.cards.length > units) return toast2(`\u6226\u95D8\u30AB\u30FC\u30C9\u306F${units}\u679A\u307E\u3067\u3067\u3059`);
        guard(() => net().commitCombat(pd.key, dial, ui.combat.cards)).then(() => {
          ui.combat = { dial: 0, cards: [] };
        });
        break;
      }
      case "pick": {
        const key = v;
        const hd = st.pending?.type === "free" ? st.pending.queue[0] : null;
        const okFree = (id) => {
          if (!hd) return okMine(ctx, id);
          if (hd.k === "reposition") return repoTargets(st, me2, hd.unit === "char" ? "char" : ui.free.unit || "m0", hd.mode).includes(id);
          if (hd.k === "recall") return MAP.hexes[id].terrain === "village" && Object.keys(unitsAt(st, id)).length > 0;
          if (hd.k === "moveToken") return key === "free.from2" ? !!st.hexes[id].enc : !["lake", "home", "factory"].includes(MAP.hexes[id].terrain) && !st.hexes[id].enc && !Object.keys(unitsAt(st, id)).length;
          if (hd.k === "trapPlace") return !["lake", "home"].includes(MAP.hexes[id].terrain) && !Object.keys(unitsAt(st, id)).length;
          return okMine(ctx, id);
        };
        const ok = key === "free.hex" || key === "free.from2" ? okFree : key === "produce" ? (id) => okMine(ctx, id) && !["lake", "home", "factory"].includes(MAP.hexes[id].terrain) : (id) => okMine(ctx, id);
        ui.pick = { key, ok };
        toast2("\u76E4\u9762\u306E\u9818\u571F\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u304F\u3060\u3055\u3044");
        render2();
        break;
      }
      default:
    }
  }
  function onChange(e) {
    const el = e.target.closest("[data-bind]");
    if (!el) return;
    const k = el.dataset.bind;
    if (k === "encx.target" || k === "encx.obj") {
      ui.encx = ui.encx || {};
      ui.encx[k.slice(5)] = el.value;
      return;
    }
    if (k === "carry") ui.carry = el.checked;
    if (k === "wcar") ui.wcar = +el.value;
    if (k.startsWith("via.")) {
      ui.via = ui.via || {};
      ui.via[k.slice(4)] = el.value;
    } else if (k === "sound") ui.sound = el.checked;
    else if (k === "enc") {
      const max = getCtx().st.players[getCtx().me].faction === "polania" ? 2 : 1;
      const i = +el.value;
      ui.enc = el.type === "radio" ? [i] : el.checked ? [...ui.enc, i].slice(-max) : ui.enc.filter((x) => x !== i);
      render2();
      return;
    } else if (k === "combat.card") {
      ui.combat.cards = el.checked ? [...ui.combat.cards, el.value] : ui.combat.cards.filter((x) => x !== el.value);
    } else setPath(k, el.value);
  }
  function fitMats() {
    const box = root.querySelector(".mats2");
    if (!box) return;
    const over = () => [...box.querySelectorAll(".mat, .acol")].some((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
    let f = 17;
    box.style.setProperty("--f", f);
    while (f > 7 && over()) {
      f -= 0.5;
      box.style.setProperty("--f", f);
    }
  }
  window.addEventListener("resize", () => {
    try {
      fitMats();
    } catch {
    }
  });
  const snapOf = (st) => ({
    gid: st.gid,
    stars: Object.fromEntries(Object.entries(st.players).map(([u, p]) => [u, p.stars.length])),
    mechs: Object.fromEntries(Object.entries(st.players).map(([u, p]) => [u, p.mechs.map((m) => m.hex)])),
    structs: Object.fromEntries(MAP.ids.filter((h) => st.hexes[h].structure).map((h) => [h, st.hexes[h].structure.type])),
    combat: st.lastCombat ? `${st.lastCombat.hex}.${st.turnNo}.${st.lastCombat.winner}` : "",
    traps: (st.traps || []).filter((x) => !x.armed).length,
    popUnits: 0
  });
  function overlay(inner, ms = 1700) {
    const bw = document.getElementById("boardwrap");
    if (!bw) return;
    const r = bw.getBoundingClientRect();
    const d = document.createElement("div");
    d.className = "fxwrap";
    d.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    d.innerHTML = `<svg viewBox="0 0 1024 1024">${inner}</svg>`;
    document.body.append(d);
    setTimeout(() => d.remove(), ms);
  }
  const ring = (x, y, color, delay = 0, big = 90) => `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${color}" stroke-width="5" opacity="0"><animate attributeName="r" from="10" to="${big}" begin="${delay}s" dur="0.9s" fill="freeze"/><animate attributeName="opacity" values="0;1;0" keyTimes="0;.15;1" begin="${delay}s" dur="0.9s" fill="freeze"/><animate attributeName="stroke-width" from="14" to="1" begin="${delay}s" dur="0.9s" fill="freeze"/></circle>`;
  const smoke = (x, y) => Array.from({ length: 5 }, (_, i) => `<circle cx="${x + (i - 2) * 14}" cy="${y}" r="10" fill="#9aa0a4" opacity="0"><animate attributeName="opacity" values="0;.55;0" dur="1.5s" begin="${i * 0.08}s" fill="freeze"/><animate attributeName="r" from="8" to="34" dur="1.5s" begin="${i * 0.08}s" fill="freeze"/><animate attributeName="cy" from="${y}" to="${y - 70 - i * 6}" dur="1.5s" begin="${i * 0.08}s" fill="freeze"/></circle>`).join("");
  const sparks = (x, y, n = 10) => Array.from({ length: n }, (_, i) => {
    const a = i / n * 6.283 + Math.random() * 0.5, r = 50 + Math.random() * 50;
    return `<circle cx="${x}" cy="${y}" r="3" fill="#ffb23e" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="0.8s" fill="freeze"/><animate attributeName="cx" from="${x}" to="${x + Math.cos(a) * r}" dur="0.8s" fill="freeze"/><animate attributeName="cy" from="${y}" to="${y + Math.sin(a) * r + 14}" dur="0.8s" fill="freeze"/></circle>`;
  }).join("");
  function starBurst(who) {
    const d = document.createElement("div");
    d.className = "starburst";
    const emb = Array.from({ length: 16 }, (_, i) => {
      const a = i / 16 * 6.283, r = 120 + Math.random() * 130;
      return `<i style="--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r + 40}px;animation-delay:${(Math.random() * 0.15).toFixed(2)}s"></i>`;
    }).join("");
    d.innerHTML = `${emb}<div class="plate"><img src="i-star.png" alt=""><div><b>\u661F\u3092\u7372\u5F97</b><span>${esc(who)}</span></div></div>`;
    document.body.append(d);
    setTimeout(() => d.remove(), 2300);
  }
  function fx(ctx) {
    const { st } = ctx, cur = snapOf(st), prev = ui.snap;
    ui.snap = cur;
    if (!prev || prev.gid !== cur.gid) return;
    const px = (h) => {
      const hx = MAP.hexes[h];
      return hx ? hx.px || PX(hx.q, hx.r) : [512, 512];
    };
    let inner = "";
    for (const [u, n] of Object.entries(cur.stars)) if (n > (prev.stars[u] || 0)) {
      starBurst(ctx.names(u));
      sfx("star");
    }
    for (const [u, hs] of Object.entries(cur.mechs)) if (hs.length > (prev.mechs[u] || []).length) {
      const h = hs.find((x2) => !(prev.mechs[u] || []).includes(x2)) ?? hs[hs.length - 1], [x, y] = px(h);
      inner += ring(x, y, "#c9a24a", 0, 90) + sparks(x, y, 12) + smoke(x, y);
      sfx("deploy");
    }
    for (const [h, ty] of Object.entries(cur.structs)) if (!prev.structs[h]) {
      const [x, y] = px(h);
      inner += ring(x, y, "#b5532e", 0, 80) + sparks(x, y, 8) + smoke(x, y + 10);
      sfx("build");
    }
    if (cur.combat && cur.combat !== prev.combat) {
      const [x, y] = px(st.lastCombat.hex);
      inner += ring(x, y, "#a83a2a", 0, 100) + sparks(x, y, 16);
      const bw = document.getElementById("boardwrap");
      if (bw) {
        bw.classList.add("shake");
        setTimeout(() => bw.classList.remove("shake"), 600);
      }
    }
    if (cur.traps > prev.traps) {
      const tr = (st.traps || []).filter((x) => !x.armed).pop();
      if (tr) {
        const [x, y] = px(tr.hex);
        inner += ring(x, y, "#7d6a9a", 0, 80) + smoke(x, y);
      }
    }
    if (inner) overlay(inner);
  }
  let mdr = null;
  root.addEventListener("pointerdown", (e) => {
    const h = e.target.closest?.("[data-drag]");
    if (!h) return;
    const m = h.parentElement, r = m.getBoundingClientRect();
    mdr = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, m, moved: false };
    e.preventDefault();
  });
  window.addEventListener("pointermove", (e) => {
    if (!mdr) return;
    if (Math.abs(e.clientX - mdr.x0) + Math.abs(e.clientY - mdr.y0) > 5) mdr.moved = true;
    if (mdr.moved) {
      mdr.m.style.transform = "none";
      mdr.m.style.left = `${e.clientX - mdr.dx}px`;
      mdr.m.style.top = `${e.clientY - mdr.dy}px`;
      ui.mpos = { x: e.clientX - mdr.dx, y: e.clientY - mdr.dy };
    }
  });
  window.addEventListener("pointerup", () => {
    if (!mdr) return;
    if (!mdr.moved) {
      ui.mfold = !ui.mfold;
      render2();
    }
    mdr = null;
  });
  let drag = false;
  root.addEventListener("pointerdown", (e) => {
    const u = e.target.closest?.("[data-unit]");
    const ctx = getCtx();
    if (u && ctx?.st && ctx.st.turnUid === ctx.me && ctx.st.turn.phase === "moving" && !ctx.st.pending) {
      drag = true;
      selectUnit(ctx, u.dataset.unit);
    }
  });
  window.addEventListener("pointerup", (e) => {
    if (!drag) return;
    drag = false;
    const ctx = getCtx();
    const h = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-hex]");
    if (ctx?.st && h && ui.selUnit && ui.targets.some((t) => t.to === h.dataset.hex)) onHex(ctx, h.dataset.hex);
  });
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  return { render: render2, tick };
}

// public/js/app.js
var expOf = (r) => ({ ...DEFAULT_EXP, ...r?.settings?.exp || {} });
var factionIds = (r) => Object.keys(BASE_FACTIONS).filter((f) => !BASE_FACTIONS[f].ext || expOf(r)[BASE_FACTIONS[f].ext]);
var maxPlayers = (r) => factionIds(r).length;
var $app = document.getElementById("app");
var $who = document.getElementById("who");
var esc2 = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var toast = (msg) => {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "show";
  setTimeout(() => t.className = "", 2800);
};
if (firebaseConfig.apiKey.startsWith("YOUR_")) {
  $app.innerHTML = '<div class="card"><h2>Firebase\u672A\u8A2D\u5B9A</h2><p>public/js/firebase-config.js \u306B Firebase \u306E\u8A2D\u5B9A\u5024\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044\uFF08README\u53C2\u7167\uFF09\u3002</p></div>';
  throw new Error("firebase not configured");
}
var app = initializeApp(firebaseConfig);
var TEST_MODE = new URLSearchParams(location.search).has("test");
var auth = TEST_MODE ? initializeAuth(app, { persistence: browserSessionPersistence }) : getAuth(app);
var db = getFirestore(app);
var me = null;
var unsub = null;
var room = null;
var roomId = null;
var deckData = null;
var privData = null;
var combatData = null;
var unsubs = [];
var subKey = "";
var netObj = null;
var stCache = { rev: -1, st: null };
var draftSel = { kind: "", vals: ["", "", ""] };
var NAME_KEY = "scythe_name";
var defaultName = () => TEST_MODE ? `\u30C6\u30B9\u30C8${Math.floor(Math.random() * 90 + 10)}` : load2(NAME_KEY);
var testTabUrl = () => `${location.origin}${location.pathname}?test=1${roomId ? `#${roomId}` : ""}`;
var roomRef = (id) => doc2(db, "rooms", id);
var load2 = (k) => {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
};
var save2 = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
  }
};
function newCode() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint8Array(8));
  return [...r].map((x) => A[x % A.length]).join("");
}
async function update(fn) {
  await runTransaction2(db, async (tx) => {
    const snap = await tx.get(roomRef(roomId));
    const d = snap.data();
    const patch = fn(d);
    tx.update(roomRef(roomId), { ...patch, revision: d.revision + 1 });
  });
}
async function createRoom(name) {
  const id = newCode();
  await setDoc2(roomRef(id), {
    hostUid: me.uid,
    status: "lobby",
    memberUids: [me.uid],
    members: { [me.uid]: { name } },
    submitted: {},
    draft: {},
    settings: { expansion: "base" },
    revision: 0,
    createdAt: serverTimestamp()
  });
  enter(id);
}
async function joinRoom(id, name) {
  id = id.trim().toUpperCase();
  const snap = await getDoc2(roomRef(id)).catch(() => null);
  if (!snap || !snap.exists()) return toast("\u30EB\u30FC\u30E0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  roomId = id;
  const d = snap.data();
  if (d.memberUids.includes(me.uid)) return enter(id);
  if (d.status !== "lobby") return toast("\u3059\u3067\u306B\u958B\u59CB\u3055\u308C\u3066\u3044\u307E\u3059");
  if (d.memberUids.length >= maxPlayers(d)) return toast(`\u6E80\u54E1\u3067\u3059\uFF08\u6700\u5927${maxPlayers(d)}\u4EBA\uFF09`);
  if (Object.values(d.members).some((m) => m.name === name)) return toast("\u540C\u3058\u8868\u793A\u540D\u304C\u30EB\u30FC\u30E0\u5185\u306B\u3042\u308A\u307E\u3059");
  try {
    await update((cur) => ({
      memberUids: [...cur.memberUids, me.uid],
      members: { ...cur.members, [me.uid]: { name } }
    }));
    enter(id);
  } catch (e) {
    toast("\u53C2\u52A0\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F");
    console.error(e);
  }
}
function enter(id) {
  roomId = id;
  if (unsub) unsub();
  clearSubs();
  netObj = makeNet(db, id, me.uid);
  history.replaceState(null, "", `#${id}`);
  unsub = onSnapshot(roomRef(id), (s) => {
    room = s.exists() ? s.data() : null;
    syncSubs();
    render();
  }, () => {
    toast("\u30EB\u30FC\u30E0\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093");
    leave();
  });
}
function clearSubs() {
  unsubs.forEach((f) => f());
  unsubs = [];
  deckData = privData = combatData = null;
  subKey = "";
  stCache = { rev: -1, st: null };
}
function leave() {
  if (unsub) unsub();
  clearSubs();
  unsub = null;
  room = null;
  roomId = null;
  history.replaceState(null, "", location.pathname);
  render();
}
function syncSubs() {
  if (!room || room.status !== "playing" || !room.memberUids.includes(me.uid)) return;
  if (!unsubs.length) {
    unsubs.push(onSnapshot(doc2(db, "rooms", roomId, "pub", "deck"), (s) => {
      deckData = s.data() || null;
      render();
    }, (e) => console.error(e)));
    unsubs.push(onSnapshot(doc2(db, "rooms", roomId, "private", me.uid), (s) => {
      privData = s.data() || { hand: [], objectives: [] };
      render();
    }, (e) => console.error(e)));
  }
  const st = gameState();
  const key = st?.pending?.type === "combat" ? st.pending.key : "";
  if (key !== subKey) {
    if (subKey && unsubs.length > 2) unsubs.pop()();
    combatData = null;
    subKey = key;
    if (key) unsubs.push(onSnapshot(netObj.combatRef(key), (s) => {
      combatData = s.data() || null;
      render();
    }, (e) => console.error(e)));
  }
}
function gameState() {
  if (!room?.game?.json) return null;
  if (stCache.rev !== room.revision) stCache = { rev: room.revision, st: JSON.parse(room.game.json) };
  return stCache.st;
}
var gameUI = createGameUI({
  root: $app,
  toast,
  net: () => netObj,
  getCtx: () => room && room.status === "playing" ? { room, st: gameState(), me: me.uid, names: (u) => room.members[u]?.name ?? "?", deck: deckData, priv: privData, combat: combatData } : null,
  onLeave: () => leave(),
  onRematch: () => update(() => ({ status: "lobby", draft: {}, submitted: {}, game: deleteField() })).catch((e) => {
    toast("\u30EA\u30BB\u30C3\u30C8\u3067\u304D\u307E\u305B\u3093");
    console.error(e);
  })
});
async function startGame() {
  try {
    const players = room.memberUids.map((uid) => ({ uid, faction: room.draft.factions[uid], mat: room.draft.mats[uid] }));
    const gid = [...crypto.getRandomValues(new Uint8Array(4))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const allowed = allowedCards(expOf(room));
    const factoryIds = shuffle(allowed.fac).slice(0, players.length + 1);
    const bonusTileId = shuffle(BONUS_TILES.map((b) => b.id))[0];
    const st = createGame({ players, bonusTileId, factoryIds, gid });
    await setDoc2(doc2(db, "rooms", roomId, "pub", "deck"), initialDeck(players.map((p) => ({ uid: p.uid, combatCards: BASE_FACTIONS[p.faction].combatCards, objectives: BASE_MATS[p.mat].objectives })), allowed));
    await update(() => ({ status: "playing", game: { turnUid: st.turnUid, json: JSON.stringify(st), over: false } }));
  } catch (e) {
    toast("\u958B\u59CB\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F");
    console.error(e);
  }
}
var nameOf = (uid) => esc2(room.members[uid]?.name ?? "?");
var isHost = () => room.hostUid === me.uid;
function renderHome() {
  $app.innerHTML = `
  <div class="card"><h2>\u306F\u3058\u3081\u308B</h2>
    <div class="row"><label>\u8868\u793A\u540D <input id="nm" maxlength="12" value="${esc2(defaultName())}" placeholder="\u4F8B: \u30A2\u30EB\u30D0\u30FC\u30C8"></label></div>
    <div class="row"><button id="mk">\u30EB\u30FC\u30E0\u3092\u4F5C\u308B</button></div>
    <div class="row"><input id="cd" maxlength="8" placeholder="\u30EB\u30FC\u30E0\u30B3\u30FC\u30C9" autocapitalize="characters" value="${esc2(roomId || "")}"><button class="ghost" id="jn">\u53C2\u52A0\u3059\u308B</button></div>
    <p class="mute">\u57FA\u672C\u30BB\u30C3\u30C8\u30FB1\u301C5\u4EBA\uFF08\u62E1\u5F35\u300C\u5F7C\u65B9\u3088\u308A\u306E\u4FB5\u653B\u300DON\u3067\u6700\u59277\u4EBA\uFF09\u3002\u62DB\u5F85\u306F\u30EB\u30FC\u30E0\u30B3\u30FC\u30C9\u3092\u5171\u6709\u3057\u3066\u304F\u3060\u3055\u3044\u3002${TEST_MODE ? "<br><b>\u30C6\u30B9\u30C8\u30E2\u30FC\u30C9: \u3053\u306E\u30BF\u30D6\u306F\u72EC\u7ACB\u3057\u305F\u30D7\u30EC\u30A4\u30E4\u30FC\u3067\u3059\u3002</b>" : ""}</p>
  </div>`;
  const name = () => {
    const v = document.getElementById("nm").value.trim();
    if (!v) {
      toast("\u8868\u793A\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return null;
    }
    if (!TEST_MODE) save2(NAME_KEY, v);
    return v;
  };
  document.getElementById("mk").onclick = () => {
    const n = name();
    if (n) createRoom(n).catch((e) => {
      toast("\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      console.error(e);
    });
  };
  document.getElementById("jn").onclick = () => {
    const n = name();
    const c = document.getElementById("cd").value;
    if (n && c) joinRoom(c, n);
  };
}
function members() {
  return `<ul class="plain">${room.memberUids.map((u) => `<li>${nameOf(u)} ${u === room.hostUid ? '<span class="mute">\uFF08\u30DB\u30B9\u30C8\uFF09</span>' : ""}${u === me.uid ? '<span class="mute">\uFF08\u3042\u306A\u305F\uFF09</span>' : ""}
     ${room.status.startsWith("draft") ? room.submitted?.[u] ? '<span class="ok">\u63D0\u51FA\u6E08\u307F</span>' : '<span class="mute">\u672A\u63D0\u51FA</span>' : ""}</li>`).join("")}</ul>`;
}
var EXP_ITEMS = [
  ["invaders", "\u5F7C\u65B9\u3088\u308A\u306E\u4FB5\u653B\uFF1A\u30A2\u30EB\u30D3\u30AA\u30F3\u6C0F\u65CF\u30FB\u52D8\u89E3\u7531\u5C0F\u8DEF\u5E55\u5E9C\uFF08\u30C8\u30AC\u30EF\uFF09\u3092\u8FFD\u52A0\uFF08\u6700\u59277\u4EBA\uFF09", "\u521D\u671F\u6226\u529B\u30FB\u30AB\u30FC\u30C9\u679A\u6570\u306F\u4EEE\u5024\u3002\u65D7/\u7F60\u30FB\u5404\u30E1\u30C3\u30AF\u80FD\u529B\u3092\u5B9F\u88C5\u3002"],
  ["promo", "\u30D7\u30ED\u30E2\u300C\u3055\u3089\u306A\u308B\u6226\u5834\u300D\uFF08\u906D\u904729-42\u30FB\u76EE\u768424-27\u30FB\u5DE5\u583413-18\uFF09", "\u516C\u5F0F\u672C\u6587\u306E\u7167\u5408\u304C\u672A\u5B8C\u4E86\u306E\u30AB\u30FC\u30C9\u3092\u542B\u307F\u307E\u3059\u3002"],
  ["encounters", "\u4E88\u671F\u305B\u306C\u906D\u9047\uFF08\u906D\u904743-74\uFF09", "\u4E00\u90E8\u306E\u9078\u629E\u80A2\u306F\u672A\u5B9F\u88C5\u3067\u3059\u3002"]
];
function expList() {
  const e = expOf(room);
  return EXP_ITEMS.map(([k, label, note]) => `<label class="chk"><input type="checkbox" data-exp="${k}" ${e[k] ? "checked" : ""} ${isHost() ? "" : "disabled"}> ${esc2(label)}</label><div class="mute" style="margin:-4px 0 6px 24px">${esc2(note)}</div>`).join("") + '<div class="mute">\u98A8\u5909\u308F\u308A\u306A\u6226\u4E89\uFF0F\u30D5\u30A7\u30F3\u30EA\u30B9\u8972\u6765\uFF1A\u6E96\u5099\u4E2D\uFF08\u672A\u5BFE\u5FDC\uFF09</div>';
}
function renderLobby() {
  const n = room.memberUids.length;
  $app.innerHTML = `
  <div class="card"><h2>\u30EB\u30FC\u30E0 <span class="code">${esc2(roomId)}</span></h2>${members()}
    <div class="row">${isHost() ? `<button id="go" ${n < 1 ? "disabled" : ""}>\u52E2\u529B\u30C9\u30E9\u30D5\u30C8\u3092\u59CB\u3081\u308B</button><span class="mute">1\u4EBA\u3067\u3082\u958B\u59CB\u3067\u304D\u307E\u3059\uFF08\u30C6\u30B9\u30C8\u7528\uFF09</span>` : '<span class="mute">\u30DB\u30B9\u30C8\u306E\u958B\u59CB\u3092\u5F85\u3063\u3066\u3044\u307E\u3059\u2026</span>'}
    <div class="card"><h3>\u8FFD\u52A0\u30B3\u30F3\u30C6\u30F3\u30C4\uFF08ON/OFF\uFF09</h3>${expList()}</div>
    ${n < 2 ? `<p class="mute">1\u4EBA\u3057\u304B\u3044\u307E\u305B\u3093\u3002\u540C\u3058\u30D6\u30E9\u30A6\u30B6\u306E\u5225\u30BF\u30D6\u306F\u540C\u3058\u30D7\u30EC\u30A4\u30E4\u30FC\u6271\u3044\u306B\u306A\u308B\u305F\u3081\u30011\u4EBA\u3067\u8A66\u3059\u3068\u304D\u306F\u4E0B\u306E\u30DC\u30BF\u30F3\u3067\u300C\u5225\u30D7\u30EC\u30A4\u30E4\u30FC\u7528\u30BF\u30D6\u300D\u3092\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002</p>
      <button class="ghost" id="ot">\u5225\u30D7\u30EC\u30A4\u30E4\u30FC\u7528\u30BF\u30D6\u3092\u958B\u304F\uFF08\u30C6\u30B9\u30C8\u7528\uFF09</button>` : ""}
      <button class="ghost" id="lv">\u9000\u51FA</button></div></div>`;
  document.getElementById("lv").onclick = leave;
  document.querySelectorAll("[data-exp]").forEach((el) => {
    el.onchange = () => update((d) => ({ settings: { ...d.settings, exp: { ...expOf(d), [el.dataset.exp]: el.checked } } })).catch((e) => {
      toast("\u5909\u66F4\u3067\u304D\u307E\u305B\u3093");
      console.error(e);
    });
  });
  const ot = document.getElementById("ot");
  if (ot) ot.onclick = () => window.open(testTabUrl(), "_blank");
  if (isHost()) document.getElementById("go").onclick = () => update(() => ({ status: "draft_faction", submitted: {}, draft: {} })).catch((e) => {
    toast("\u958B\u59CB\u3067\u304D\u307E\u305B\u3093");
    console.error(e);
  });
}
function renderDraft(kind) {
  const isFaction = kind === "faction";
  const cands = isFaction ? factionIds(room) : Object.keys(BASE_MATS).filter((m) => !BASE_MATS[m].ext || expOf(room)[BASE_MATS[m].ext]);
  const label = (id) => isFaction ? BASE_FACTIONS[id].name : BASE_MATS[id].name;
  const legal = (uid, c) => isFaction ? true : isLegalCombo(room.draft.factions[uid], c);
  const mine = room.submitted?.[me.uid];
  if (draftSel.kind !== kind) draftSel = { kind, vals: ["", "", ""] };
  const opts = (sel) => `<option value="">\uFF08\u306A\u3057\uFF09</option>${cands.filter((c) => legal(me.uid, c)).map((c) => `<option value="${c}" ${sel === c ? "selected" : ""}>${esc2(label(c))}</option>`).join("")}`;
  $app.innerHTML = `
  <div class="card"><h2>${isFaction ? "\u52E2\u529B" : "\u30D7\u30EC\u30A4\u30E4\u30FC\u30DE\u30C3\u30C8"}\u30C9\u30E9\u30D5\u30C8</h2>
    <p class="mute">\u7B2C1\u301C\u7B2C3\u5E0C\u671B\u3092\u540C\u6642\u306B\u63D0\u51FA\u3057\u307E\u3059\u3002\u5168\u54E1\u63D0\u51FA\u307E\u3067\u4ED6\u4EBA\u306E\u5E0C\u671B\u306F\u898B\u3048\u307E\u305B\u3093\u3002\u901A\u3089\u306A\u304B\u3063\u305F\u5834\u5408\u306F\u6B8B\u308A\u304B\u3089\u30E9\u30F3\u30C0\u30E0\u306B\u5272\u308A\u5F53\u3066\u3089\u308C\u307E\u3059\u3002</p>
    ${!isFaction ? `<p>\u3042\u306A\u305F\u306E\u52E2\u529B: <b>${esc2(BASE_FACTIONS[room.draft.factions[me.uid]].name)}</b></p>` : ""}
    ${[1, 2, 3].map((i) => `<div class="row"><label>\u7B2C${i}\u5E0C\u671B <select class="pf" data-i="${i - 1}">${opts(draftSel.vals[i - 1])}</select></label></div>`).join("")}
    <div class="row"><button id="sub" ${mine ? "disabled" : ""}>${mine ? "\u63D0\u51FA\u6E08\u307F" : "\u63D0\u51FA\u3059\u308B"}</button></div>
    ${members()}
    ${isHost() ? `<div class="row"><button id="res" ${room.memberUids.every((u) => room.submitted?.[u]) ? "" : "disabled"}>\u62BD\u9078\u3057\u3066\u78BA\u5B9A\u3059\u308B</button></div>` : ""}
  </div>`;
  document.querySelectorAll(".pf").forEach((el) => {
    el.onchange = () => {
      draftSel.vals[+el.dataset.i] = el.value;
    };
  });
  document.getElementById("sub").onclick = async () => {
    const prefs = [...document.querySelectorAll(".pf")].map((s) => s.value).filter(Boolean);
    const err = validatePrefs(prefs, cands, me.uid, legal);
    if (err) return toast(err);
    try {
      await setDoc2(doc2(db, "rooms", roomId, "drafts", me.uid), { kind, prefs, at: serverTimestamp() });
      await update((d) => ({ submitted: { ...d.submitted, [me.uid]: true } }));
    } catch (e) {
      toast("\u63D0\u51FA\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      console.error(e);
    }
  };
  if (isHost()) document.getElementById("res").onclick = async () => {
    try {
      const prefs = {};
      for (const u of room.memberUids) {
        const s = await getDoc2(doc2(db, "rooms", roomId, "drafts", u));
        prefs[u] = s.exists() && s.data().kind === kind ? s.data().prefs : [];
      }
      const { assignments, log: log2 } = resolveDraft({ players: room.memberUids, prefs, candidates: cands, legal });
      await update((d) => isFaction ? { status: "draft_mat", submitted: {}, draft: { ...d.draft, factions: assignments, factionLog: log2 } } : { status: "ready", submitted: {}, draft: { ...d.draft, mats: assignments, matLog: log2 } });
    } catch (e) {
      toast("\u78BA\u5B9A\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      console.error(e);
    }
  };
}
function renderReady() {
  const allow = room.settings?.placeholder !== false;
  const blockers = startBlockers(room.memberUids.length, void 0, { allowPlaceholder: allow });
  const notes = allow ? placeholderNotes() : [];
  $app.innerHTML = `
  <div class="card"><h2>\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u78BA\u8A8D</h2>
    <ul class="plain">${room.memberUids.map((u) => `<li>${nameOf(u)}\uFF1A${esc2(BASE_FACTIONS[room.draft.factions[u]].name)} \uFF0F ${esc2(BASE_MATS[room.draft.mats[u]].name)}</li>`).join("")}</ul></div>
  <div class="card"><h2>\u30B2\u30FC\u30E0\u958B\u59CB</h2>
    ${isHost() ? `<label class="chk"><input type="checkbox" id="ph" ${allow ? "checked" : ""}> \u4EEE\u30C7\u30FC\u30BF\u3067\u904A\u3076\uFF08\u516C\u5F0F\u30C7\u30FC\u30BF\u672A\u5165\u529B\u306E\u90E8\u5206\u3092\u4EEE\u306E\u3082\u306E\u306B\u3059\u308B\uFF09</label>` : `<p class="mute">\u4EEE\u30C7\u30FC\u30BF\u3067\u904A\u3076: ${allow ? "\u3059\u308B" : "\u3057\u306A\u3044"}</p>`}
    ${notes.length ? `<p class="mute">\u3053\u306E\u5BFE\u6226\u3067\u4F7F\u3046\u4EEE\u30C7\u30FC\u30BF:</p><ul>${notes.map((b) => `<li>${esc2(b)}</li>`).join("")}</ul>` : ""}
    ${blockers.length ? `<p class="bad">\u307E\u3060\u958B\u59CB\u3067\u304D\u307E\u305B\u3093\u3002</p><ul>${blockers.map((b) => `<li>${esc2(b)}</li>`).join("")}</ul>` : '<p class="ok">\u958B\u59CB\u3067\u304D\u307E\u3059\u3002</p>'}
    <div class="row"><button id="st" ${blockers.length || !isHost() ? "disabled" : ""}>\u30B2\u30FC\u30E0\u958B\u59CB\uFF08\u30DB\u30B9\u30C8\uFF09</button><button class="ghost" id="lv">\u9000\u51FA</button></div></div>`;
  document.getElementById("lv").onclick = leave;
  if (isHost()) {
    document.getElementById("ph").onchange = (e) => update((d) => ({ settings: { ...d.settings, placeholder: e.target.checked } })).catch(console.error);
    document.getElementById("st").onclick = startGame;
  }
}
function render() {
  document.body.classList.toggle("ingame", !!(room && room.status === "playing" && room.memberUids.includes(me?.uid)));
  $who.textContent = me ? `ID: ${me.uid.slice(0, 6)}` : "";
  if (!roomId || !room) return renderHome();
  if (!room.memberUids.includes(me.uid)) return renderHome();
  if (room.status === "lobby") return renderLobby();
  if (room.status === "draft_faction") return renderDraft("faction");
  if (room.status === "draft_mat") return renderDraft("mat");
  if (room.status === "playing") {
    gameUI.render();
    gameUI.tick();
    return;
  }
  return renderReady();
}
onAuthStateChanged(auth, (u) => {
  if (!u) {
    signInAnonymously(auth).catch(() => {
      $app.innerHTML = '<div class="card"><p class="bad">\u8A8D\u8A3C\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002Firebase\u3067\u533F\u540D\u8A8D\u8A3C\u3092\u6709\u52B9\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p></div>';
    });
    return;
  }
  me = u;
  const h = location.hash.slice(1);
  if (h) enter(h);
  else render();
});
(function slideshow() {
  const imgs = ["faction_rusviet", "faction_nordic", "faction_saxony", "faction_crimea", "faction_polania", "faction_togawa", "faction_albion", "mat_1", "mat_2", "mat_3", "mat_4", "mat_5", "mat_6", "mat_7"].map((n) => `i-${n}.jpg`);
  const el = document.createElement("div");
  el.id = "bgshow";
  el.innerHTML = "<i></i><i></i>";
  document.body.prepend(el);
  const [a, b] = el.querySelectorAll("i");
  let k = Math.floor(Math.random() * imgs.length), front = a;
  const next = () => {
    k = (k + 1) % imgs.length;
    const back = front === a ? b : a;
    back.style.backgroundImage = `url(${imgs[k]})`;
    back.classList.add("on");
    front.classList.remove("on");
    front = back;
  };
  a.style.backgroundImage = `url(${imgs[k]})`;
  a.classList.add("on");
  setInterval(next, 7e3);
})();
try {
  initBgm();
} catch (e) {
  console.error(e);
}
setInterval(() => {
  try {
    if (room?.status === "playing") gameUI.tick();
  } catch (e) {
    console.error(e);
  }
}, 2e3);
