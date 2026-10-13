import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, initializeAuth, browserSessionPersistence, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp, deleteField,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { BASE_FACTIONS, BASE_MATS, isLegalCombo } from './engine/data.js';
import { initBgm } from './bgm.js';
import { DEFAULT_EXP, allowedCards } from './engine/cards.js';
const expOf = (r) => ({ ...DEFAULT_EXP, ...(r?.settings?.exp || {}) });
const factionIds = (r) => Object.keys(BASE_FACTIONS).filter((f) => !BASE_FACTIONS[f].ext || expOf(r)[BASE_FACTIONS[f].ext]);
const maxPlayers = (r) => factionIds(r).length;
import { resolveDraft, validatePrefs, shuffle } from './engine/draft.js';
import { startBlockers, placeholderNotes } from './engine/setup.js';
import { createGame } from './engine/game.js';
import { FACTORY_CARDS, BONUS_TILES } from './engine/cards.js';
import { makeNet, initialDeck } from './net.js';
import { createGameUI } from './game-ui.js';

const $app = document.getElementById('app');
const $who = document.getElementById('who');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (msg) => { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'show'; setTimeout(() => (t.className = ''), 2800); };

if (firebaseConfig.apiKey.startsWith('YOUR_')) {
  $app.innerHTML = '<div class="card"><h2>Firebase未設定</h2><p>public/js/firebase-config.js に Firebase の設定値を入れてください（README参照）。</p></div>';
  throw new Error('firebase not configured');
}

const app = initializeApp(firebaseConfig);
// ?test=1 を付けたタブは、タブごとに別のプレイヤーIDになる（同じブラウザで2人分テストする用）
const TEST_MODE = new URLSearchParams(location.search).has('test');
const auth = TEST_MODE ? initializeAuth(app, { persistence: browserSessionPersistence }) : getAuth(app);
const db = getFirestore(app);
let me = null, unsub = null, room = null, roomId = null;
let deckData = null, privData = null, combatData = null, unsubs = [], subKey = '', netObj = null, stCache = { rev: -1, st: null };
let draftSel = { kind: '', vals: ['', '', ''] };
const NAME_KEY = 'scythe_name';
const defaultName = () => (TEST_MODE ? `テスト${Math.floor(Math.random() * 90 + 10)}` : load(NAME_KEY));
const testTabUrl = () => `${location.origin}${location.pathname}?test=1${roomId ? `#${roomId}` : ''}`;

const roomRef = (id) => doc(db, 'rooms', id);
const load = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 無視 */ } };

// 参加者が曖昧な文字を避けた8文字のルームコード
function newCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(8));
  return [...r].map((x) => A[x % A.length]).join('');
}

// revisionを+1して更新（古い画面による上書きはトランザクションとルールで拒否）
async function update(fn) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(roomId));
    const d = snap.data();
    const patch = fn(d);
    tx.update(roomRef(roomId), { ...patch, revision: d.revision + 1 });
  });
}

async function createRoom(name) {
  const id = newCode();
  await setDoc(roomRef(id), {
    hostUid: me.uid, status: 'lobby', memberUids: [me.uid], members: { [me.uid]: { name } },
    submitted: {}, draft: {}, settings: { expansion: 'base' }, revision: 0, createdAt: serverTimestamp(),
  });
  enter(id);
}

async function joinRoom(id, name) {
  id = id.trim().toUpperCase();
  const snap = await getDoc(roomRef(id)).catch(() => null);
  if (!snap || !snap.exists()) return toast('ルームが見つかりません');
  roomId = id;
  const d = snap.data();
  if (d.memberUids.includes(me.uid)) return enter(id);
  if (d.status !== 'lobby') return toast('すでに開始されています');
  if (d.memberUids.length >= maxPlayers(d)) return toast(`満員です（最大${maxPlayers(d)}人）`);
  if (Object.values(d.members).some((m) => m.name === name)) return toast('同じ表示名がルーム内にあります');
  try {
    await update((cur) => ({
      memberUids: [...cur.memberUids, me.uid], members: { ...cur.members, [me.uid]: { name } },
    }));
    enter(id);
  } catch (e) { toast('参加できませんでした'); console.error(e); }
}

function enter(id) {
  roomId = id;
  if (unsub) unsub();
  clearSubs();
  netObj = makeNet(db, id, me.uid);
  history.replaceState(null, '', `#${id}`);
  unsub = onSnapshot(roomRef(id), (s) => { room = s.exists() ? s.data() : null; syncSubs(); render(); }, () => { toast('ルームを読み込めません'); leave(); });
}
function clearSubs() { unsubs.forEach((f) => f()); unsubs = []; deckData = privData = combatData = null; subKey = ''; stCache = { rev: -1, st: null }; }
function leave() { if (unsub) unsub(); clearSubs(); unsub = null; room = null; roomId = null; history.replaceState(null, '', location.pathname); render(); }

// 対戦中だけ、山札・自分の秘密情報・進行中の戦闘を購読する
function syncSubs() {
  if (!room || room.status !== 'playing' || !room.memberUids.includes(me.uid)) return;
  if (!unsubs.length) {
    unsubs.push(onSnapshot(doc(db, 'rooms', roomId, 'pub', 'deck'), (s) => { deckData = s.data() || null; render(); }, (e) => console.error(e)));
    unsubs.push(onSnapshot(doc(db, 'rooms', roomId, 'private', me.uid), (s) => { privData = s.data() || { hand: [], objectives: [] }; render(); }, (e) => console.error(e)));
  }
  const st = gameState();
  const key = st?.pending?.type === 'combat' ? st.pending.key : '';
  if (key !== subKey) {
    if (subKey && unsubs.length > 2) unsubs.pop()();
    combatData = null; subKey = key;
    if (key) unsubs.push(onSnapshot(netObj.combatRef(key), (s) => { combatData = s.data() || null; render(); }, (e) => console.error(e)));
  }
}
function gameState() {
  if (!room?.game?.json) return null;
  if (stCache.rev !== room.revision) stCache = { rev: room.revision, st: JSON.parse(room.game.json) };
  return stCache.st;
}

const gameUI = createGameUI({
  root: $app, toast, net: () => netObj,
  getCtx: () => (room && room.status === 'playing' ? { room, st: gameState(), me: me.uid, names: (u) => room.members[u]?.name ?? '?', deck: deckData, priv: privData, combat: combatData } : null),
  onLeave: () => leave(),
  onRematch: () => update(() => ({ status: 'lobby', draft: {}, submitted: {}, game: deleteField() })).catch((e) => { toast('リセットできません'); console.error(e); }),
});

async function startGame() {
  try {
    const players = room.memberUids.map((uid) => ({ uid, faction: room.draft.factions[uid], mat: room.draft.mats[uid] }));
    const gid = [...crypto.getRandomValues(new Uint8Array(4))].map((x) => x.toString(16).padStart(2, '0')).join('');
    const allowed = allowedCards(expOf(room));
    const factoryIds = shuffle(allowed.fac).slice(0, players.length + 1);
    const bonusTileId = shuffle(BONUS_TILES.map((b) => b.id))[0];
    const st = createGame({ players, bonusTileId, factoryIds, gid });
    await setDoc(doc(db, 'rooms', roomId, 'pub', 'deck'), initialDeck(players.map((p) => ({ uid: p.uid, combatCards: BASE_FACTIONS[p.faction].combatCards, objectives: BASE_MATS[p.mat].objectives })), allowed));
    await update(() => ({ status: 'playing', game: { turnUid: st.turnUid, json: JSON.stringify(st), over: false } }));
  } catch (e) { toast('開始できませんでした'); console.error(e); }
}

const nameOf = (uid) => esc(room.members[uid]?.name ?? '?');
const isHost = () => room.hostUid === me.uid;

function renderHome() {
  $app.innerHTML = `
  <div class="card"><h2>はじめる</h2>
    <div class="row"><label>表示名 <input id="nm" maxlength="12" value="${esc(defaultName())}" placeholder="例: アルバート"></label></div>
    <div class="row"><button id="mk">ルームを作る</button></div>
    <div class="row"><input id="cd" maxlength="8" placeholder="ルームコード" autocapitalize="characters" value="${esc(roomId || '')}"><button class="ghost" id="jn">参加する</button></div>
    <p class="mute">基本セット・2〜5人（拡張ONで最大6人）。招待はルームコードを共有してください。${TEST_MODE ? '<br><b>テストモード: このタブは独立したプレイヤーです。</b>' : ''}</p>
  </div>`;
  const name = () => { const v = document.getElementById('nm').value.trim(); if (!v) { toast('表示名を入力してください'); return null; } if (!TEST_MODE) save(NAME_KEY, v); return v; };
  document.getElementById('mk').onclick = () => { const n = name(); if (n) createRoom(n).catch((e) => { toast('作成に失敗しました'); console.error(e); }); };
  document.getElementById('jn').onclick = () => { const n = name(); const c = document.getElementById('cd').value; if (n && c) joinRoom(c, n); };
}

function members() {
  return `<ul class="plain">${room.memberUids.map((u) =>
    `<li>${nameOf(u)} ${u === room.hostUid ? '<span class="mute">（ホスト）</span>' : ''}${u === me.uid ? '<span class="mute">（あなた）</span>' : ''}
     ${room.status.startsWith('draft') ? (room.submitted?.[u] ? '<span class="ok">提出済み</span>' : '<span class="mute">未提出</span>') : ''}</li>`).join('')}</ul>`;
}

const EXP_ITEMS = [
  ['invaders', '彼方よりの侵攻：アルビオン氏族・勘解由小路幕府（トガワ）を追加（最大7人）', '初期戦力・カード枚数は仮値。旗/罠・各メック能力を実装。'],
  ['promo', 'プロモ「さらなる戦場」（遭遇29-42・目的24-27・工場13-18）', '公式本文の照合が未完了のカードを含みます。'],
  ['encounters', '予期せぬ遭遇（遭遇43-74）', '一部の選択肢は未実装です。'],
];
function expList() {
  const e = expOf(room);
  return EXP_ITEMS.map(([k, label, note]) => `<label class="chk"><input type="checkbox" data-exp="${k}" ${e[k] ? 'checked' : ''} ${isHost() ? '' : 'disabled'}> ${esc(label)}</label><div class="mute" style="margin:-4px 0 6px 24px">${esc(note)}</div>`).join('')
    + '<div class="mute">風変わりな戦争／フェンリス襲来：準備中（未対応）</div>';
}
function renderLobby() {
  const n = room.memberUids.length;
  $app.innerHTML = `
  <div class="card"><h2>ルーム <span class="code">${esc(roomId)}</span></h2>${members()}
    <div class="row">${isHost()
      ? `<button id="go" ${n < 1 ? 'disabled' : ''}>勢力ドラフトを始める</button><span class="mute">1人でも開始できます（テスト用）</span>`
      : '<span class="mute">ホストの開始を待っています…</span>'}
    <div class="card"><h3>追加コンテンツ（ON/OFF）</h3>${expList()}</div>
    ${n < 2 ? `<p class="mute">1人しかいません。同じブラウザの別タブは同じプレイヤー扱いになるため、1人で試すときは下のボタンで「別プレイヤー用タブ」を開いてください。</p>
      <button class="ghost" id="ot">別プレイヤー用タブを開く（テスト用）</button>` : ''}
      <button class="ghost" id="lv">退出</button></div></div>`;
  document.getElementById('lv').onclick = leave;
  document.querySelectorAll('[data-exp]').forEach((el) => { el.onchange = () => update((d) => ({ settings: { ...d.settings, exp: { ...expOf(d), [el.dataset.exp]: el.checked } } })).catch((e) => { toast('変更できません'); console.error(e); }); });
  const ot = document.getElementById('ot'); if (ot) ot.onclick = () => window.open(testTabUrl(), '_blank');
  if (isHost()) document.getElementById('go').onclick = () =>
    update(() => ({ status: 'draft_faction', submitted: {}, draft: {} })).catch((e) => { toast('開始できません'); console.error(e); });
}

function renderDraft(kind) {
  const isFaction = kind === 'faction';
  const cands = isFaction ? factionIds(room) : Object.keys(BASE_MATS);
  const label = (id) => (isFaction ? BASE_FACTIONS[id].name : BASE_MATS[id].name);
  const legal = (uid, c) => (isFaction ? true : isLegalCombo(room.draft.factions[uid], c));
  const mine = room.submitted?.[me.uid];
  if (draftSel.kind !== kind) draftSel = { kind, vals: ['', '', ''] };
  const opts = (sel) => `<option value="">（なし）</option>${cands.filter((c) => legal(me.uid, c)).map((c) => `<option value="${c}" ${sel === c ? 'selected' : ''}>${esc(label(c))}</option>`).join('')}`;
  $app.innerHTML = `
  <div class="card"><h2>${isFaction ? '勢力' : 'プレイヤーマット'}ドラフト</h2>
    <p class="mute">第1〜第3希望を同時に提出します。全員提出まで他人の希望は見えません。通らなかった場合は残りからランダムに割り当てられます。</p>
    ${!isFaction ? `<p>あなたの勢力: <b>${esc(BASE_FACTIONS[room.draft.factions[me.uid]].name)}</b></p>` : ''}
    ${[1, 2, 3].map((i) => `<div class="row"><label>第${i}希望 <select class="pf" data-i="${i - 1}">${opts(draftSel.vals[i - 1])}</select></label></div>`).join('')}
    <div class="row"><button id="sub" ${mine ? 'disabled' : ''}>${mine ? '提出済み' : '提出する'}</button></div>
    ${members()}
    ${isHost() ? `<div class="row"><button id="res" ${room.memberUids.every((u) => room.submitted?.[u]) ? '' : 'disabled'}>抽選して確定する</button></div>` : ''}
  </div>`;
  document.querySelectorAll('.pf').forEach((el) => { el.onchange = () => { draftSel.vals[+el.dataset.i] = el.value; }; });
  document.getElementById('sub').onclick = async () => {
    const prefs = [...document.querySelectorAll('.pf')].map((s) => s.value).filter(Boolean);
    const err = validatePrefs(prefs, cands, me.uid, legal);
    if (err) return toast(err);
    try {
      await setDoc(doc(db, 'rooms', roomId, 'drafts', me.uid), { kind, prefs, at: serverTimestamp() });
      await update((d) => ({ submitted: { ...d.submitted, [me.uid]: true } }));
    } catch (e) { toast('提出に失敗しました'); console.error(e); }
  };
  if (isHost()) document.getElementById('res').onclick = async () => {
    try {
      const prefs = {};
      for (const u of room.memberUids) {
        const s = await getDoc(doc(db, 'rooms', roomId, 'drafts', u));
        prefs[u] = s.exists() && s.data().kind === kind ? s.data().prefs : [];
      }
      const { assignments, log } = resolveDraft({ players: room.memberUids, prefs, candidates: cands, legal });
      await update((d) => (isFaction
        ? { status: 'draft_mat', submitted: {}, draft: { ...d.draft, factions: assignments, factionLog: log } }
        : { status: 'ready', submitted: {}, draft: { ...d.draft, mats: assignments, matLog: log } }));
    } catch (e) { toast('確定に失敗しました'); console.error(e); }
  };
}

function renderReady() {
  const allow = room.settings?.placeholder !== false;
  const blockers = startBlockers(room.memberUids.length, undefined, { allowPlaceholder: allow });
  const notes = allow ? placeholderNotes() : [];
  $app.innerHTML = `
  <div class="card"><h2>セットアップ確認</h2>
    <ul class="plain">${room.memberUids.map((u) => `<li>${nameOf(u)}：${esc(BASE_FACTIONS[room.draft.factions[u]].name)} ／ ${esc(BASE_MATS[room.draft.mats[u]].name)}</li>`).join('')}</ul></div>
  <div class="card"><h2>ゲーム開始</h2>
    ${isHost() ? `<label class="chk"><input type="checkbox" id="ph" ${allow ? 'checked' : ''}> 仮データで遊ぶ（公式データ未入力の部分を仮のものにする）</label>` : `<p class="mute">仮データで遊ぶ: ${allow ? 'する' : 'しない'}</p>`}
    ${notes.length ? `<p class="mute">この対戦で使う仮データ:</p><ul>${notes.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    ${blockers.length ? `<p class="bad">まだ開始できません。</p><ul>${blockers.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '<p class="ok">開始できます。</p>'}
    <div class="row"><button id="st" ${blockers.length || !isHost() ? 'disabled' : ''}>ゲーム開始（ホスト）</button><button class="ghost" id="lv">退出</button></div></div>`;
  document.getElementById('lv').onclick = leave;
  if (isHost()) {
    document.getElementById('ph').onchange = (e) => update((d) => ({ settings: { ...d.settings, placeholder: e.target.checked } })).catch(console.error);
    document.getElementById('st').onclick = startGame;
  }
}

function render() {
  document.body.classList.toggle('ingame', !!(room && room.status === 'playing' && room.memberUids.includes(me?.uid)));
  $who.textContent = me ? `ID: ${me.uid.slice(0, 6)}` : '';
  if (!roomId || !room) return renderHome();
  if (!room.memberUids.includes(me.uid)) return renderHome();
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'draft_faction') return renderDraft('faction');
  if (room.status === 'draft_mat') return renderDraft('mat');
  if (room.status === 'playing') { gameUI.render(); gameUI.tick(); return; }
  return renderReady();
}

onAuthStateChanged(auth, (u) => {
  if (!u) { signInAnonymously(auth).catch(() => { $app.innerHTML = '<div class="card"><p class="bad">認証に失敗しました。Firebaseで匿名認証を有効にしてください。</p></div>'; }); return; }
  me = u;
  const h = location.hash.slice(1);
  if (h) enter(h); else render();
});

// ---- ホーム画面の背景スライドショー（国マット・行動マットの画像） ----
(function slideshow() {
  const imgs = ['faction_rusviet', 'faction_nordic', 'faction_saxony', 'faction_crimea', 'faction_polania', 'faction_togawa', 'faction_albion', 'mat_1', 'mat_2', 'mat_3', 'mat_4', 'mat_5', 'mat_6', 'mat_7'].map((n) => `img/${n}.jpg`);
  const el = document.createElement('div'); el.id = 'bgshow';
  el.innerHTML = '<i></i><i></i>'; document.body.prepend(el);
  const [a, b] = el.querySelectorAll('i'); let k = Math.floor(Math.random() * imgs.length), front = a;
  const next = () => { k = (k + 1) % imgs.length; const back = front === a ? b : a; back.style.backgroundImage = `url(${imgs[k]})`; back.classList.add('on'); front.classList.remove('on'); front = back; };
  a.style.backgroundImage = `url(${imgs[k]})`; a.classList.add('on');
  setInterval(next, 7000);
})();
try { initBgm(); } catch (e) { console.error(e); }
setInterval(() => { try { if (room?.status === 'playing') gameUI.tick(); } catch (e) { console.error(e); } }, 2000); // 取りこぼし防止（戦闘の公開など）
