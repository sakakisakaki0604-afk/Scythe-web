import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { BASE_FACTIONS, BASE_MATS, isLegalCombo } from './engine/data.js';
import { resolveDraft, validatePrefs } from './engine/draft.js';
import { startBlockers } from './engine/setup.js';

const $app = document.getElementById('app');
const $who = document.getElementById('who');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (msg) => { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'show'; setTimeout(() => (t.className = ''), 2800); };

if (firebaseConfig.apiKey.startsWith('YOUR_')) {
  $app.innerHTML = '<div class="card"><h2>Firebase未設定</h2><p>public/js/firebase-config.js に Firebase の設定値を入れてください（README参照）。</p></div>';
  throw new Error('firebase not configured');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let me = null, unsub = null, room = null, roomId = null;
const NAME_KEY = 'scythe_name';

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
  if (d.memberUids.length >= 5) return toast('満員です（基本セットは最大5人）');
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
  history.replaceState(null, '', `#${id}`);
  unsub = onSnapshot(roomRef(id), (s) => { room = s.exists() ? s.data() : null; render(); }, () => { toast('ルームを読み込めません'); leave(); });
}
function leave() { if (unsub) unsub(); unsub = null; room = null; roomId = null; history.replaceState(null, '', location.pathname); render(); }

const nameOf = (uid) => esc(room.members[uid]?.name ?? '?');
const isHost = () => room.hostUid === me.uid;

function renderHome() {
  $app.innerHTML = `
  <div class="card"><h2>はじめる</h2>
    <div class="row"><label>表示名 <input id="nm" maxlength="12" value="${esc(load(NAME_KEY))}" placeholder="例: アルバート"></label></div>
    <div class="row"><button id="mk">ルームを作る</button></div>
    <div class="row"><input id="cd" maxlength="8" placeholder="ルームコード" autocapitalize="characters"><button class="ghost" id="jn">参加する</button></div>
    <p class="mute">基本セット・2〜5人。招待はルームコードを共有してください。</p>
  </div>`;
  const name = () => { const v = document.getElementById('nm').value.trim(); if (!v) { toast('表示名を入力してください'); return null; } save(NAME_KEY, v); return v; };
  document.getElementById('mk').onclick = () => { const n = name(); if (n) createRoom(n).catch((e) => { toast('作成に失敗しました'); console.error(e); }); };
  document.getElementById('jn').onclick = () => { const n = name(); const c = document.getElementById('cd').value; if (n && c) joinRoom(c, n); };
}

function members() {
  return `<ul class="plain">${room.memberUids.map((u) =>
    `<li>${nameOf(u)} ${u === room.hostUid ? '<span class="mute">（ホスト）</span>' : ''}${u === me.uid ? '<span class="mute">（あなた）</span>' : ''}
     ${room.status.startsWith('draft') ? (room.submitted?.[u] ? '<span class="ok">提出済み</span>' : '<span class="mute">未提出</span>') : ''}</li>`).join('')}</ul>`;
}

function renderLobby() {
  const n = room.memberUids.length;
  $app.innerHTML = `
  <div class="card"><h2>ルーム <span class="code">${esc(roomId)}</span></h2>${members()}
    <div class="row">${isHost()
      ? `<button id="go" ${n < 2 ? 'disabled' : ''}>勢力ドラフトを始める</button>${n < 2 ? '<span class="mute">2人以上で開始できます</span>' : ''}`
      : '<span class="mute">ホストの開始を待っています…</span>'}
      <button class="ghost" id="lv">退出</button></div></div>`;
  document.getElementById('lv').onclick = leave;
  if (isHost()) document.getElementById('go').onclick = () =>
    update(() => ({ status: 'draft_faction', submitted: {}, draft: {} })).catch((e) => { toast('開始できません'); console.error(e); });
}

function renderDraft(kind) {
  const isFaction = kind === 'faction';
  const cands = Object.keys(isFaction ? BASE_FACTIONS : BASE_MATS);
  const label = (id) => (isFaction ? BASE_FACTIONS[id].name : BASE_MATS[id].name);
  const legal = (uid, c) => (isFaction ? true : isLegalCombo(room.draft.factions[uid], c));
  const mine = room.submitted?.[me.uid];
  const opts = (sel) => `<option value="">（なし）</option>${cands.filter((c) => legal(me.uid, c)).map((c) => `<option value="${c}" ${sel === c ? 'selected' : ''}>${esc(label(c))}</option>`).join('')}`;
  $app.innerHTML = `
  <div class="card"><h2>${isFaction ? '勢力' : 'プレイヤーマット'}ドラフト</h2>
    <p class="mute">第1〜第3希望を同時に提出します。全員提出まで他人の希望は見えません。通らなかった場合は残りからランダムに割り当てられます。</p>
    ${!isFaction ? `<p>あなたの勢力: <b>${esc(BASE_FACTIONS[room.draft.factions[me.uid]].name)}</b></p>` : ''}
    ${[1, 2, 3].map((i) => `<div class="row"><label>第${i}希望 <select class="pf">${opts('')}</select></label></div>`).join('')}
    <div class="row"><button id="sub" ${mine ? 'disabled' : ''}>${mine ? '提出済み' : '提出する'}</button></div>
    ${members()}
    ${isHost() ? `<div class="row"><button id="res" ${room.memberUids.every((u) => room.submitted?.[u]) ? '' : 'disabled'}>抽選して確定する</button></div>` : ''}
  </div>`;
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
  const blockers = startBlockers(room.memberUids.length);
  $app.innerHTML = `
  <div class="card"><h2>セットアップ確認</h2>
    <ul class="plain">${room.memberUids.map((u) => `<li>${nameOf(u)}：${esc(BASE_FACTIONS[room.draft.factions[u]].name)} ／ ${esc(BASE_MATS[room.draft.mats[u]].name)}</li>`).join('')}</ul></div>
  <div class="card"><h2>ゲーム開始の可否</h2>
    ${blockers.length ? `<p class="bad">まだ開始できません。次のデータが未入力です。</p><ul>${blockers.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      <p class="mute">カード面とマップは公式資料と照合したデータだけを使うため、入力が完了するまで盤面は開きません。</p>` : '<p class="ok">開始できます。</p>'}
    <div class="row"><button id="st" ${blockers.length || !isHost() ? 'disabled' : ''}>ゲーム開始（ホスト）</button><button class="ghost" id="lv">退出</button></div></div>`;
  document.getElementById('lv').onclick = leave;
}

function render() {
  $who.textContent = me ? `ID: ${me.uid.slice(0, 6)}` : '';
  if (!roomId || !room) return renderHome();
  if (!room.memberUids.includes(me.uid)) return renderHome();
  if (room.status === 'lobby') return renderLobby();
  if (room.status === 'draft_faction') return renderDraft('faction');
  if (room.status === 'draft_mat') return renderDraft('mat');
  return renderReady();
}

onAuthStateChanged(auth, (u) => {
  if (!u) { signInAnonymously(auth).catch(() => { $app.innerHTML = '<div class="card"><p class="bad">認証に失敗しました。Firebaseで匿名認証を有効にしてください。</p></div>'; }); return; }
  me = u;
  const h = location.hash.slice(1);
  if (h) enter(h); else render();
});
