// 対戦画面（盤面SVG・操作パネル）。状態の判定は engine/game.js、保存は net.js。
import { produceCost } from './engine/data.js';
import { MAP, DIRS, PX } from './engine/legacy-map.js';
import {
  BASE_FACTIONS, BASE_MATS, TRAP_PENALTIES, MECH_SLOTS, ABILITY_NAMES, ABILITY_TEXT, PASSIVE, TOP_TEXT, BOTTOM_TEXT, IMPLEMENTED_ABILITIES, BOTTOM_ORDER, BOTTOM_NAMES, BOTTOM_RES,
  TOP_NAMES, STRUCT_NAMES, STRUCT_TEXT, RES_NAMES, TOP_CUBES, RECRUIT_ONETIME, topOf, structOf,
} from './engine/data.js';
import {
  controller, controlled, resTotals, canPay, canDo, producibleHexes, unitsAt, moveTargets, legalSections, objectiveHelpers, scoreOf, popTier, RuleError,
} from './engine/game.js';
import { ENCOUNTERS, OBJECTIVES, FACTORY_CARDS, BONUS_TILES, byId } from './engine/cards.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FACTION_COLOR = { rusviet: '#d62d2d', saxony: '#1c1c1f', nordic: '#2f6fd6', crimea: '#f0c419', polania: '#f2f2f2', togawa: '#8e44c9', albion: '#2e9e4f' };
const colorFor = (st, uid) => FACTION_COLOR[st.players[uid]?.faction] || '#888';
const inkOn = (c) => (c === '#f2f2f2' || c === '#f0c419' ? '#111' : '#fff');
const TERR = {
  mountain: ['#8d8d93', '山'], farm: ['#d6c26a', '農'], tundra: ['#9fb9c8', '油'], forest: ['#4f7d41', '森'],
  village: ['#c98f5e', '村'], lake: ['#3f70b3', '湖'], factory: ['#80608f', '工場'], home: ['#5a5148', '本'],
};
const SIZE = 34, SQ3 = Math.sqrt(3), K = 70 / 34; // 盤面画像上ではヘクス半径70px
const corner = (cx, cy, i) => { const a = (Math.PI / 180) * (60 * i - 30); return [cx + SIZE * Math.cos(a), cy + SIZE * Math.sin(a)]; };

export function createGameUI({ root, net, toast, getCtx, onLeave, onRematch }) {
  const ui = {
    selUnit: null, targets: [], carry: false, pick: null, sel: null, zoom: 1, resMode: false, objOpen: true, produce: [],
    trade: { r1: 'oil', r2: 'wood', hex: null }, conv: { a: 'oil', b: 'oil', to: 'wood', hex: null }, free: { top: 'move', kind: null, hex: null, type: 'monument', mech: 0, slot: 'upgrade', from: 'upgrade', bonus: 'power' }, bot: { top: 'move', slot: 'upgrade', mech: 0, hex: null, type: 'monument', from: 'upgrade', bonus: 'power' },
    fac: { hex: null, r1: 'oil', r2: 'wood' }, combat: { dial: 0, cards: [] }, enc: [], sound: true, lastLog: 0,
  };
  const busy = new Set();
  let audio = null;

  // ---- 効果音（WebAudio合成。ドーパミン多めのアルペジオ・キラキラ・衝撃音） ----
  // ---- 効果音：重厚なディーゼルパンク調（金属の打撃音・蒸気・低音のうなり）。マスターにコンプレッサー＋残響 ----
  let master = null;
  const chain = () => {
    if (master) return master;
    const comp = audio.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
    const conv = audio.createConvolver(), len = audio.sampleRate * 1.4, ir = audio.createBuffer(2, len, audio.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    conv.buffer = ir;
    const wet = audio.createGain(); wet.gain.value = 0.28; const dry = audio.createGain(); dry.gain.value = 0.9;
    comp.connect(dry); comp.connect(conv); conv.connect(wet); dry.connect(audio.destination); wet.connect(audio.destination);
    master = comp; return comp;
  };
  const tone = (f, at, dur, type = 'sine', vol = 0.15, slide = 0, lp = 0) => {
    const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + at; let node = o;
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, f * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (lp) { const fl = audio.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
    node.connect(g); g.connect(chain()); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const noise = (at, dur, vol = 0.2, f0 = 4000, f1 = 300, type = 'lowpass') => {
    const n = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
    const src = audio.createBufferSource(), g = audio.createGain(), fl = audio.createBiquadFilter(), t0 = audio.currentTime + at;
    src.buffer = buf; g.gain.value = vol; fl.type = type; fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    src.connect(fl); fl.connect(g); g.connect(chain()); src.start(t0);
  };
  // 金属の響き（非整数倍音を重ねる）
  const metal = (base, at, dur = 0.5, vol = 0.1) => [1, 1.504, 2.17, 2.76, 3.9].forEach((m, i) => tone(base * m, at, dur / (1 + i * 0.5), 'sine', vol / (1 + i * 0.6)));
  const thud = (at, f = 70, vol = 0.5) => { tone(f, at, 0.28, 'sine', vol, 0.35); noise(at, 0.06, vol * 0.5, 900, 120); };
  const SFX = {
    click: () => { noise(0, 0.04, 0.12, 5000, 1500, 'bandpass'); tone(160, 0, 0.06, 'square', 0.07, 0.6, 500); },
    move: () => { thud(0, 62, 0.35); thud(0.13, 55, 0.3); noise(0.05, 0.25, 0.07, 3000, 800, 'bandpass'); },
    coin: () => { metal(1100, 0, 0.35, 0.09); metal(1650, 0.07, 0.3, 0.07); thud(0, 110, 0.15); },
    build: () => { thud(0, 90, 0.55); noise(0, 0.1, 0.3, 3500, 400); metal(420, 0.02, 0.9, 0.12); thud(0.28, 85, 0.45); metal(520, 0.3, 0.8, 0.1); },
    produce: () => { noise(0, 0.5, 0.12, 1800, 4500, 'highpass'); [0, 0.12, 0.24].forEach((a) => { thud(a, 100, 0.2); metal(700, a, 0.15, 0.05); }); },
    deploy: () => { thud(0, 52, 0.7); noise(0, 0.18, 0.35, 2500, 200); thud(0.32, 48, 0.75); noise(0.32, 0.2, 0.35, 2500, 200); tone(180, 0.5, 0.7, 'sawtooth', 0.07, 2.2, 900); noise(0.55, 0.6, 0.1, 2000, 6000, 'highpass'); },
    combat: () => { noise(0, 0.5, 0.55, 3000, 80); thud(0, 42, 0.9); tone(95, 0.02, 0.6, 'sawtooth', 0.14, 0.4, 500); metal(260, 0.1, 0.8, 0.12); noise(0.4, 0.5, 0.2, 900, 90); },
    star: () => { [130.8, 196, 261.6].forEach((f, i) => tone(f, i * 0.1, 1.6, 'sawtooth', 0.1, 1, 1400)); thud(0, 55, 0.5); metal(523, 0.35, 1.4, 0.13); metal(784, 0.55, 1.3, 0.1); noise(0.3, 0.6, 0.08, 2500, 7000, 'highpass'); },
    turn: () => { metal(98, 0, 2.2, 0.2); metal(147, 0.02, 2, 0.12); thud(0, 60, 0.4); },
    end: () => { thud(0, 70, 0.4); metal(180, 0.03, 0.5, 0.07); },
  };
  const sfx = (k) => {
    if (!ui.sound) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); SFX[k]?.(); } catch { /* 無視 */ }
  };
  const beep = () => sfx('move');
  const guard = async (fn) => {
    try { await fn(); }
    catch (e) { if (e instanceof RuleError) toast(e.message); else { toast('通信に失敗しました。もう一度試してください'); console.error(e); } }
  };
  const act = (action) => guard(async () => { await net().dispatch(action); });

  // ---------------------------------------------------------------- 盤面
  const RES_OF = { mountain: 'metal', tundra: 'oil', farm: 'food', forest: 'wood' };
  function prodMode(ctx) {
    const { st, me } = ctx, p = st.players[me];
    if (st.turnUid !== me) return false;
    if (st.pending) return st.pending.type === 'free' && (st.pending.queue[0].k === 'produce');
    return st.turn.phase === 'top' && p.section != null && (p.section === 'factory' ? false : topOf(p.mat, p.section) === 'produce');
  }
  function boardSVG(ctx) {
    const { st, me } = ctx; ctx_names = ctx.names;
    const colorOf = (uid) => colorFor(st, uid);
    const tg = new Set(ui.targets.map((t) => t.to));
    let hexes = '', top = '';
    for (const id of MAP.ids) {
      const h = MAP.hexes[id], [X, Y] = h.px || PX(h.q, h.r), hs = st.hexes[id];
      const poly = [0, 1, 2, 3, 4, 5].map((i) => corner(0, 0, i).map((v) => v.toFixed(1)).join(',')).join(' ');
      const homeColor = h.home ? colorOf(Object.keys(st.players).find((u) => st.players[u].faction === h.home) || '') : null;
      const sel = ui.sel === id, isT = tg.has(id), pk = ui.pick && ui.pick.ok?.(id), ps = prodMode(ctx) && ui.produce.includes(id), pc = prodMode(ctx) && !ps && producibleHexes(st, me).includes(id);
      const hi = sel || isT || pk || ps || pc, hc = ps ? '#ffd400' : sel ? '#ffffff' : isT ? '#00f0ff' : '#7dff7d';
      const shape = h.home
        ? `<circle r="${SIZE * 0.95}" fill="#000" fill-opacity=".01" stroke="${hi ? hc : 'none'}" stroke-width="3.4"/>`
        : `<polygon points="${poly}" fill="${hi ? hc : '#000'}" fill-opacity="${ps ? 0.5 : hi ? 0.25 : 0.01}" stroke="${hi ? hc : 'none'}" stroke-width="${ps ? 6 : 3.4}" stroke-linejoin="round"/>`;
      const rIcon = ui.resMode && RES_OF[h.terrain] ? `<image href="img/${RES_OF[h.terrain]}.png" x="${-SIZE * 0.55}" y="${-SIZE * 0.55}" width="${SIZE * 1.1}" height="${SIZE * 1.1}" opacity=".95" pointer-events="none"/>`
        : ui.resMode && h.terrain === 'village' ? `<image href="img/people.png" x="${-SIZE * 0.55}" y="${-SIZE * 0.55}" width="${SIZE * 1.1}" height="${SIZE * 1.1}" opacity=".95" pointer-events="none"/>` : '';
      const dim = ui.resMode && !h.home ? `<polygon points="${poly}" fill="#000" fill-opacity=".5" pointer-events="none"/>` : '';
      hexes += `<g class="hx" data-hex="${id}" transform="translate(${X.toFixed(1)} ${Y.toFixed(1)}) scale(${K.toFixed(4)})">
        ${dim}${shape}${rIcon}${ps ? '<text y="8" text-anchor="middle" class="stp">✔</text>' : ''}${isT ? `<text y="6" text-anchor="middle" class="stp">${ui.targets.find((t) => t.to === id)?.steps ?? ''}</text>` : ''}
        ${hs.enc ? `<circle cx="18" cy="-21" r="8" fill="#e8c14a" stroke="#222"><title>遭遇トークン</title></circle><text x="18" y="-17.5" class="eb">!</text>` : ''}
        ${structMark(st, hs, colorOf, ctx)}${trapMark(st, id, colorOf, ctx)}${flagMark(st, id, colorOf, ctx)}
        ${resChips(hs, 0, 0)}
        </g>`;
      top += `<g transform="translate(${X.toFixed(1)} ${Y.toFixed(1)}) scale(${K.toFixed(4)})">${unitMarks(st, id, 0, 0, colorOf, me)}</g>`;
    }
    return `<svg viewBox="0 0 1024 1024" class="boardsvg" role="img" aria-label="盤面"><image href="img/map.jpg" width="1024" height="1024"/>${hexes}${top}</svg>`;
  }
  function structMark(st, hs, colorOf, ctx) {
    if (!hs.structure) return '';
    const c = colorOf(hs.structure.owner), n = STRUCT_NAMES[hs.structure.type];
    return `<g class="struct"><title>${n}（${esc(ctx.names(hs.structure.owner))}）</title><circle cx="-18" cy="-21" r="10" fill="${c}" stroke="#fff" stroke-width="2"/><image href="img/${hs.structure.type}.png" x="-25" y="-28" width="14" height="14"/></g>`;
  }
  function flagMark(st, id, colorOf, ctx) {
    const f = (st.flagHexes || []).find((x) => x.hex === id);
    if (!f) return '';
    return `<g class="trap"><title>旗（${esc(ctx.names(f.owner))}）</title><path d="M-27 14 L-27 -10 L-10 -4 L-27 2" fill="${colorOf(f.owner)}" stroke="#fff" stroke-width="1.8"/><line x1="-27" y1="-12" x2="-27" y2="16" stroke="#ddd" stroke-width="2"/></g>`;
  }
  function trapMark(st, id, colorOf, ctx) {
    const tr = (st.traps || []).find((x) => x.hex === id);
    if (!tr) return '';
    const c = colorOf(tr.owner), mine = tr.owner === ctx.me;
    return `<g class="trap"><title>罠（${esc(ctx.names(tr.owner))}）${tr.armed ? '武装中' : '武装解除済み'}${mine ? '：' + TRAP_PENALTIES[tr.penalty] : ''}</title><rect x="-30" y="-6" width="20" height="20" rx="4" fill="${tr.armed ? c : '#555'}" stroke="#fff" stroke-width="1.8" ${tr.armed ? '' : 'stroke-dasharray="3 2"'}/><text x="-20" y="8.5" class="ub" style="font-size:11px">罠</text></g>`;
  }
  // 資源：2種類までは個別、3種類以上は合計1つにまとめる（小さいマスでも重ならない）
  function resChips(hs) {
    const items = Object.entries(hs.res).filter(([, v]) => v > 0);
    if (!items.length) return '';
    const pill = (x, k, v, tip) => `<g transform="translate(${x} 24)"><title>${tip}</title><rect x="-13" y="-7" width="26" height="14" rx="7" fill="#000" fill-opacity=".72" stroke="#fff" stroke-opacity=".5"/><image href="img/${k}.png" width="12" height="12" x="-12" y="-6"/><text x="6" y="3.5" class="rc">×${v}</text></g>`;
    if (items.length <= 2) return items.map(([k, v], i) => pill(items.length === 1 ? 0 : i ? 14 : -14, k, v, `${RES_NAMES[k]}×${v}`)).join('');
    const tot = items.reduce((s, [, v]) => s + v, 0);
    return pill(0, items[0][0], tot, items.map(([k, v]) => `${RES_NAMES[k]}×${v}`).join(' / '));
  }
  // ユニット：4体まで個別、それ以上は持ち主ごとに「アイコン×数」にまとめる
  // 国ごとの駒画像（public/img/char_<国>.png / mech_<国>.png を置いて、国IDをここに足すと使われる）
  const UNIT_ART = { char: ['rusviet', 'nordic'], mech: ['rusviet', 'nordic'] };
  function unitMarks(st, id, cx, cy, colorOf, me) {
    const us = unitsAt(st, id), list = [];
    for (const [uid, u] of Object.entries(us)) {
      const p = st.players[uid];
      if (u.char) list.push({ uid, shape: 'c', unit: 'char', label: '将', name: 'キャラクター' });
      p.mechs.forEach((m, mi) => { if (m.hex === id) list.push({ uid, shape: 'm', unit: `m${mi}`, label: 'M', name: 'メック' }); });
      p.workers.forEach((w, wi) => { if (w === id) list.push({ uid, shape: 'w', unit: `w${wi}`, label: '', name: 'ワーカー' }); });
    }
    const dot = (e, x, y, count) => {
      const c = colorOf(e.uid), mine = e.uid === me, on = mine && ui.selUnit === e.unit;
      const data = mine && e.unit ? `data-unit="${e.unit}" class="unit"` : '';
      const art = (e.shape === 'm' && UNIT_ART.mech.includes(st.players[e.uid].faction)) || (e.shape === 'c' && UNIT_ART.char.includes(st.players[e.uid].faction));
      const ring = on ? `<circle cx="${x}" cy="${y}" r="${art ? 22 : 13}" fill="none" stroke="#00f0ff" stroke-width="3"/>` : '';
      const t = `<title>${esc(ctx_names(e.uid))}の${e.name}${count > 1 ? '×' + count : ''}</title>`;
      const txt = count > 1 ? `×${count}` : e.label;
      const fac = st.players[e.uid].faction;
      if (e.shape === 'm' && UNIT_ART.mech.includes(fac)) return `${ring}<image href="img/mech_${fac}.png" x="${x - 19}" y="${y - 19}" width="38" height="38" style="filter:drop-shadow(0 1px 2px #000)" ${data}>${t}</image>${count > 1 ? `<text x="${x + 10}" y="${y + 14}" class="ub" style="font-size:11px">×${count}</text>` : ''}`;
      if (e.shape === 'c' && UNIT_ART.char.includes(fac)) return `${ring}<image href="img/char_${fac}.png" x="${x - 19}" y="${y - 19}" width="38" height="38" style="filter:drop-shadow(0 1px 2px #000)" ${data}>${t}</image>`;
      if (e.shape === 'm') return `${ring}<rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="3" fill="${c}" stroke="${c === '#f2f2f2' ? '#444' : '#fff'}" stroke-width="1.8" ${data}>${t}</rect><text x="${x}" y="${y + 3.5}" class="ub" style="fill:${inkOn(c)}">${txt}</text>`;
      if (e.shape === 'c') return `${ring}<circle cx="${x}" cy="${y}" r="9.5" fill="${c}" stroke="${c === '#f2f2f2' ? '#444' : '#fff'}" stroke-width="1.8" ${data}>${t}</circle><text x="${x}" y="${y + 3.5}" class="ub" style="fill:${inkOn(c)}">${txt}</text>`;
      return `${ring}<circle cx="${x}" cy="${y}" r="${count > 1 ? 9 : 6.5}" fill="${c}" stroke="${c === '#f2f2f2' ? '#444' : '#fff'}" stroke-width="1.8" ${data}>${t}</circle>${count > 1 ? `<text x="${x}" y="${y + 3.5}" class="ub" style="fill:${inkOn(c)}">×${count}</text>` : ''}`;
    };
    let out = '';
    if (list.length <= 4) {
      const pos = list.length <= 3 ? list.map((_, i) => [(i - (list.length - 1) / 2) * 24, 3]) : [[-12, -5], [12, -5], [-12, 15], [12, 15]];
      list.forEach((e, i) => { out += dot(e, pos[i][0], pos[i][1], 1); });
    } else {
      const groups = [];
      for (const e of list) { const g = groups.find((x) => x.uid === e.uid && x.shape === e.shape); if (g) { g.n++; g.units.push(e.unit); } else groups.push({ ...e, units: [e.unit], n: 1 }); }
      const mv = st.turn.move;
      for (const g of groups) g.unit = g.units.find((u) => !(mv && mv.kind === 'move' && mv.moved.includes(u))) || g.units[0];
      const pos = groups.length <= 2 ? groups.map((_, i) => [(i - (groups.length - 1) / 2) * 22, 3]) : groups.map((_, i) => [(i % 3 - 1) * 20, -4 + Math.floor(i / 3) * 18]);
      groups.forEach((g, i) => { out += dot(g, pos[i][0], pos[i][1], g.n); });
    }
    return out;
  }
  let ctx_names = (u) => u;

  function stepsBar(st) {
    const ph = st.turn.phase, pd = st.pending;
    const cur = pd?.type === 'combat' ? 1 : pd ? 2 : { section: 0, top: 1, moving: 1, bottom: 2, end: 3 }[ph] ?? 0;
    const S = ['① セクション選択', '② 上段アクション', '③ 下段アクション', '④ ターン終了'];
    return `<div class="steps">${S.map((x, i) => `<span class="${i === cur ? 'now' : i < cur ? 'done' : ''}">${x}</span>`).join('')}${pd ? `<span class="pend">${{ combat: '戦闘中', trap: '罠の設置', flag: '旗の設置', encounter: '遭遇', factory: '工場カード選択', free: '無料効果' }[pd.type] || ''}</span>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- パネル
  const nm = (ctx, uid) => esc(ctx.names(uid));
  const sectionLabel = (p, s) => {
    if (s === 'factory') return `工場／移動（${esc(byId(FACTORY_CARDS, p.factory)?.name || '')}）`;
    return `${TOP_NAMES[topOf(p.mat, s)]}／${BOTTOM_NAMES[BOTTOM_ORDER[s]]}`;
  };
  const resSel = (key, val) => `<span class="rsel">${['oil', 'metal', 'wood', 'food'].map((r) => `<button type="button" class="rbtn ${r === val ? 'on' : ''}" data-act="resset" data-v="${key}|${r}" title="${RES_NAMES[r]}"><img src="img/${r}.png" alt="${RES_NAMES[r]}"></button>`).join('')}</span>`;
  const hexBtn = (label, key, cur) => `<button class="ghost sm" data-act="pick" data-v="${key}">${label}: ${cur ? esc(cur) : '選択'}</button>`;

  function topDoable(st, me, kind) {
    const p = st.players[me];
    if (kind === 'produce') return producibleHexes(st, me).length > 0;
    if (kind === 'bolster' || kind === 'trade') return canDo(st, me, kind);
    if (kind === 'factory') { const c = byId(FACTORY_CARDS, p.factory); if (!c) return false; const { card = 0, anyRes = 0, diff, ...rest } = c.cost; return p.hand >= card && canPay(st, me, rest); }
    return true;
  }
  function panelAction(ctx) {
    const { st, me } = ctx, p = st.players[me], t = st.turn;
    if (st.over) return resultPanel(ctx);
    const mine = st.turnUid === me;
    if (st.pending?.type === 'combat') return combatPanel(ctx);
    if (!mine) return '';
    if (st.pending?.type === 'encounter') return encounterPanel(ctx);
    if (st.pending?.type === 'flag') return `<div class="card"><h2>🚩 旗を設置（${esc(st.pending.hex)}）</h2><p class="mute">キャラクターのいる領土に旗を1つ置けます（残り${p.flags}個・動かせません）。終了時にその領土を支配していて、自分の本拠地に隣接していなければ、領土1つ分として数えます。</p>
      <div class="row"><button data-act="flag" data-v="1">旗を置く</button><button class="ghost" data-act="flag" data-v="">置かない</button></div></div>`;
    if (st.pending?.type === 'trap') return `<div class="card"><h2>🪤 罠を設置（${esc(st.pending.hex)}）</h2><p class="mute">キャラクターのいる領土に罠を1つ置けます（置いた罠は動かせません）。武装中の罠は、終了時にあなたの支配領土になり、相手ユニットが入ると移動が止まってペナルティを与えます。</p>
      <div class="row">${p.traps.map((x) => `<button data-act="trap" data-v="${x}">${TRAP_PENALTIES[x]}の罠</button>`).join('')}<button class="ghost" data-act="trap" data-v="">置かない</button></div></div>`;
    if (st.pending?.type === 'free') return freePanel(ctx);
    if (st.pending?.type === 'factory') {
      return `<div class="card"><h2>工場カードを選ぶ（1枚・変更不可）</h2>${st.factoryCandidates.map((id) => {
        const c = byId(FACTORY_CARDS, id); return `<div class="opt facopt"><img src="${c.img}" alt="${esc(c.name)}"><div><b>${esc(c.name)}</b><div class="mute">${esc(c.text)}</div><button data-act="factory-pick" data-v="${id}">これにする</button></div></div>`;
      }).join('')}</div>`;
    }
    if (t.phase === 'section') return '';
    const kindTop = p.section === 'factory' ? 'factory' : topOf(p.mat, p.section);
    if (t.phase === 'top' && !topDoable(st, me, kindTop)) return `<div class="card"><h2>⚠ 上段アクションを実行できません</h2><p>「${TOP_NAMES[kindTop]}」は、いまの状況（${{ produce: '生産できる領土がない、または生産コストを払えません', bolster: 'コインが足りません', trade: 'コインが足りません', factory: '工場カードのコストを払えません' }[kindTop] || '条件を満たしていません'}）では実行できません。</p>
      <div class="row"><button data-act="top-skip">上段を行わずに進む</button><button class="ghost" data-act="cancel-sec">↩ セクション選択に戻る</button></div></div>`;
    if (t.phase === 'top') return `<div class="card"><h2>上段：${TOP_NAMES[kindTop]}</h2>${topForm(ctx, kindTop)}
      <div class="row"><button class="ghost" data-act="top-skip">上段を行わない</button><button class="ghost" data-act="cancel-sec">↩ セクション選択に戻る</button></div></div>`;
    if (t.phase === 'moving') return movingPanel(ctx);
    if (t.phase === 'bottom') {
      const kb = p.section === 'factory' ? 'factoryMove' : BOTTOM_ORDER[p.section];
      return `<div class="card"><h2>下段：${kb === 'factoryMove' ? '移動（最大2回）' : BOTTOM_NAMES[kb]}</h2>${bottomForm(ctx, kb)}
        <div class="row"><button class="ghost" data-act="bot-skip">下段を行わない</button></div></div>`;
    }
    return '';
  }

  function topForm(ctx, kind) {
    const { st, me } = ctx, p = st.players[me];
    if (kind === 'move') return `<div class="row"><button data-act="move-units">ユニットを移動（最大2体・各1回）</button><button class="ghost" data-act="move-coin">代わりにコイン+1</button></div>`;
    if (kind === 'bolster') return `<p class="mute">1コイン支払い</p><div class="row"><button data-act="bolster-power">戦力+2</button><button data-act="bolster-card">戦闘カード+1</button></div>`;
    if (kind === 'trade') return `<p class="mute">1コイン支払い</p><div class="row"><button data-act="trade-pop">支持+1</button></div>
      <div class="row">資源 ${resSel('trade.r1', ui.trade.r1)} ${resSel('trade.r2', ui.trade.r2)} ${hexBtn('置く領土', 'trade.hex', ui.trade.hex)} <button data-act="trade-res">資源+2</button></div>`;
    if (kind === 'produce') { const lim = 2 + (p.up.produce || 0), cands = producibleHexes(st, me), pk = `${st.gid}.${st.log.length}`; if (ui.pf !== pk) { ui.pf = pk; ui.produce = cands.length <= lim ? [...cands] : []; } return `<p>生産コスト：${Object.entries(produceCost(p.workers.length)).map(([k, v]) => (RES_NAMES[k] || ({ pop: '支持', power: '戦力', coins: 'コイン' })[k]) + v).join('・') || 'なし'}（ワーカー${p.workers.length}人）</p><p>生産する領土を最大${lim}か所選んでください（候補が${lim}か所以下なら最初から選択済み）</p>
      <div class="chips">${producibleHexes(st, me).map((id) => `<button class="chip ${ui.produce.includes(id) ? 'on' : ''}" data-act="produce-toggle" data-v="${id}">${TERR[MAP.hexes[id].terrain][1]} ${id}</button>`).join('')}</div>
      <div class="row"><button data-act="produce-go" ${ui.produce.length ? '' : 'disabled'}>生産する</button><button class="ghost sm" data-act="produce-clear">クリア</button></div>`; }
    if (kind === 'factory') {
      const c = byId(FACTORY_CARDS, p.factory), n = c.cost.anyRes || 0;
      return `<div class="facopt"><img src="${c.img}" alt=""><div><b>${esc(c.name)}</b><div class="mute">${esc(c.text)}</div>
        ${n ? `<div class="row">支払う資源 ${Array.from({ length: n }, (_, i) => resSel(`fac.pay${i}`, ui.fac['pay' + i] || ['oil', 'wood'][i] || 'oil')).join(' ')}</div>` : ''}
        ${c.gain.worker ? `<div class="row">${hexBtn('ワーカーを置く領土', 'fac.hex', ui.fac.hex)}</div>` : ''}
        <div class="row"><button data-act="factory-go">実行</button></div></div></div>`;
    }
    return '';
  }

  const producible = (ctx) => MAP.ids.filter((id) => okMine(ctx, id) && !['lake', 'home', 'factory'].includes(MAP.hexes[id].terrain));
  const MAT_IMG = { industrial: 1, engineering: 2, patriotic: 3, mechanical: 4, agricultural: 5, militant: 6, innovative: 7 };
  const FAC_IMG = { nordic: 'nordic', crimea: 'crimea', saxony: 'saxony', polania: 'polania', rusviet: 'rusviet', togawa: 'togawa' };
  const matWrap = (ctx, inner) => `<div class="matbg" style="background-image:linear-gradient(rgba(12,10,8,.35),rgba(12,10,8,.7)),url(img/mat_${MAT_IMG[ctx.st.players[ctx.me].mat] || 1}.jpg)">${inner}</div>`;
  const stepsOf = (p, u) => (u[0] === 'w' ? 1 : 1 + (p.mechs.some((m) => MECH_SLOTS[p.faction][m.slot] === 'speed') ? 1 : 0) + (p.up.move || 0));
  function movingPanel(ctx) {
    const { st, me } = ctx, p = st.players[me], mv = st.turn.move;
    const unitName = (u) => (u === 'char' ? 'キャラクター' : u[0] === 'm' ? `メック${+u.slice(1) + 1}` : `ワーカー${+u.slice(1) + 1}`);
    const here = (u) => (u === 'char' ? p.char : u[0] === 'm' ? p.mechs[+u.slice(1)].hex : p.workers[+u.slice(1)]);
    const units = ['char', ...p.mechs.map((_, i) => `m${i}`), ...p.workers.map((_, i) => `w${i}`)];
    const done = mv.kind === 'move' ? mv.moved : [];
    return `<div class="card"><h2>移動中（あと${mv.left}体まで）</h2>
      <p class="mute">動かすユニットを選び、黄色の領土をクリック。盤面上の自分のユニットをクリックしても選べます。</p>
      <label class="chk">メックで運ぶワーカー <select data-bind="wcar">${[0,1,2,3,4,5,6,7,8].map((n) => `<option ${+ui.wcar === n ? 'selected' : ''}>${n}</option>`).join('')}</select>人（出発地→目的地）</label>
      ${ui.selUnit && ui.selUnit[0] === 'm' ? `<label class="chk">経由地で乗り降り <select data-bind="via.hex"><option value="">なし</option>${(ui.targets || []).map((c) => `<option ${ui.via?.hex === c.to ? 'selected' : ''}>${c.to}</option>`).join('')}</select> 降ろす <select data-bind="via.drop">${[0,1,2,3,4,5,6,7,8].map((n) => `<option ${+ui.via?.drop === n ? 'selected' : ''}>${n}</option>`).join('')}</select> 乗せる <select data-bind="via.take">${[0,1,2,3,4,5,6,7,8].map((n) => `<option ${+ui.via?.take === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
      <label class="chk"><input type="checkbox" data-bind="carry" ${ui.carry ? 'checked' : ''}> 出発地の資源をすべて運ぶ</label>
      <div class="units">${units.map((u) => `<button class="sm ${ui.selUnit === u ? '' : 'ghost'}" data-act="unit" data-v="${u}" ${done.includes(u) ? 'disabled' : ''}>${unitName(u)} @${here(u)}（${stepsOf(p, u)}マス）</button>`).join('')}</div>
      <div class="row"><button data-act="endMove">移動を終える</button></div></div>`;
  }

  const UP_EFFECT = { move: '移動+1マス', bolster: '戦力+1／カード+1', trade: '支持+1／資源+1', produce: '生産+1領土' };
const BON_NAME = { power: '戦力+2', coins: 'コイン+2', pop: '支持+2', card: '戦闘カード+2' };
const ONG = { upgrade: '戦力+1', deploy: 'コイン+1', build: '支持+1', enlist: '戦闘カード+1' };
  const topOpts = (p, cur) => Object.keys(TOP_CUBES).filter((t) => (p.up[t] || 0) < TOP_CUBES[t]).map((t) => `<option value="${t}" ${cur === t ? 'selected' : ''}>${TOP_NAMES[t]}：${UP_EFFECT[t]}</option>`).join('');
  const slotOpts = (p, cur) => { const m = BASE_MATS[p.mat]; return BOTTOM_ORDER.filter((s) => p.red[s] < m.lower[s][1]).map((s) => { const c = Math.max(0, m.lower[s][0] - p.red[s]); return `<option value="${s}" ${cur === s ? 'selected' : ''}>${BOTTOM_NAMES[s]}：コスト${c}→${Math.max(0, c - 1)}</option>`; }).join(''); };
  const upNote = '<p class="mute">改良：上段の強化（効果は選択肢に表示）を得て、下段のコストが1下がります。</p>';
  function bottomForm(ctx, kind) {
    const { st, me } = ctx, p = st.players[me], m = BASE_MATS[p.mat];
    if (kind === 'factoryMove') return `<p class="mute">工場セクションの下段です。<b>ユニットを最大2回</b>移動できます（別々の2体でも、同じユニットを2回でも可。1回ごとに通常の移動力ぶん進める）。</p><div class="row"><button data-act="bot-factory">移動を始める</button></div>`;
    const cost = Math.max(0, m.lower[kind][0] - p.red[kind]);
    const hint = canDo(st, me, kind) ? '' : '<p class="bad">⚠ 資源が足りません。上の「⇄ 資源交換」（2個→1個）で足りるか試せます。</p>';
    const head = hint + `<p>コスト：${RES_NAMES[BOTTOM_RES[kind]]} ${cost}（持っている${RES_NAMES[BOTTOM_RES[kind]]} ${resTotals(st, me)[BOTTOM_RES[kind]]}）／ 報酬：${m.lower[kind][2]}コイン</p>`;
    const b = ui.bot;
    if (kind === 'upgrade') {
      const opts = BOTTOM_ORDER.filter((s) => p.red[s] < m.lower[s][1]);
      return head + upNote + `<div class="row">上段から取る <select data-bind="bot.top">${topOpts(p, b.top)}</select> 下段に置く <select data-bind="bot.slot">${slotOpts(p, b.slot)}</select><button data-act="bot-go">改良する</button></div>`;
    }
    if (kind === 'deploy') {
      const free = [0, 1, 2, 3].filter((i) => !p.mechs.some((x) => x.slot === i));
      return head + `<div class="row">メック <select data-bind="bot.mech">${free.map((i) => { const a = MECH_SLOTS[p.faction][i]; return `<option value="${i}" ${+b.mech === i ? 'selected' : ''}>${ABILITY_NAMES[a]}${IMPLEMENTED_ABILITIES.includes(a) ? '' : '（効果未実装）'}</option>`; }).join('')}</select> ${hexBtn('配置領土', 'bot.hex', b.hex)}<button data-act="bot-go">配備する</button></div>`;
    }
    if (kind === 'build') {
      const free = ['monument', 'mill', 'mine', 'armory'].filter((x) => !p.structures.some((s) => s.type === x));
      return head + `<div class="row">建物 <select data-bind="bot.type">${free.map((x) => `<option value="${x}" ${b.type === x ? 'selected' : ''}>${STRUCT_NAMES[x]}</option>`).join('')}</select> ${hexBtn('建設領土', 'bot.hex', b.hex)}<button data-act="bot-go">建設する</button></div>`;
    }
    const fromFree = BOTTOM_ORDER.filter((s) => !p.recruits.some((r) => r.section === s));
    const bonFree = RECRUIT_ONETIME.filter((x) => !p.recruits.some((r) => r.bonus === x));
    const BN = { power: '戦力+2', coins: 'コイン+2', pop: '支持+2', card: '戦闘カード+2' };
    return head + `<p class="mute">徴兵：①選んだ下段に徴兵トークンを置く → 以後、<b>自分と両隣の人</b>がその下段を行うたびに<b>常時ボーナス</b>が入ります。②同時に<b>一時ボーナス</b>を今すぐ獲得（4枠は各1回）。4つ揃うと星。</p><div class="row">徴兵トークンの取得元 <select data-bind="bot.from">${fromFree.map((s) => `<option value="${s}" ${b.from === s ? 'selected' : ''}>${BOTTOM_NAMES[s]}（常時：${ONG[s]}）</option>`).join('')}</select> 一時ボーナス <select data-bind="bot.bonus">${bonFree.map((x) => `<option value="${x}" ${b.bonus === x ? 'selected' : ''}>${BN[x]}</option>`).join('')}</select><button data-act="bot-go">徴兵する</button></div>`;
  }

  function encounterPanel(ctx) {
    const { st, me } = ctx, p = st.players[me], pd = st.pending;
    if (!pd.cardId) return `<div class="card"><h2>遭遇</h2><p class="mute">遭遇カードを引いています…</p></div>`;
    const c = byId(ENCOUNTERS, pd.cardId), max = p.faction === 'polania' ? 2 : 1;
    const okOpt = (o) => !o.unsupported && canPay(st, me, o.cost);
    const none = !c.options.some(okOpt);
    return `<div class="card"><h2>遭遇 #${c.no}</h2><p class="mute">選択肢を${max === 2 ? '最大2つ（ポーラニア）' : '1つ'}選びます。</p>
      ${c.options.map((o, i) => `<label class="opt ${okOpt(o) ? '' : 'dim'}"><input type="${max === 2 ? 'checkbox' : 'radio'}" name="enc" data-bind="enc" value="${i}" ${okOpt(o) ? '' : 'disabled'} ${ui.enc.includes(i) ? 'checked' : ''}> ${esc(o.text)}${o.unsupported ? ' <span class="tag">未実装</span>' : ''}</label>`).join('')}
      <div class="row"><button data-act="enc-go" ${none || ui.enc.length ? '' : 'disabled'}>${none ? '見送る（選べる選択肢なし）' : 'この選択で解決'}</button></div></div>`;
  }
  const FREE_NAMES = { build: '建設', upgrade: '改良', deploy: '配備', enlist: '徴兵', produce: '生産', anyRes: '好きな資源' };
  function freePanel(ctx) {
    const { st, me } = ctx, p = st.players[me], pd = st.pending, head = pd.queue[0];
    const kinds = head.alt || [head.k];
    const f = ui.free, k = kinds.includes(f.kind) ? f.kind : kinds[0];
    let body = '';
    if (k === 'build') {
      const fr = ['monument', 'mill', 'mine', 'armory'].filter((x) => !p.structures.some((s) => s.type === x));
      body = `建物 <select data-bind="free.type">${fr.map((x) => `<option value="${x}" ${f.type === x ? 'selected' : ''}>${STRUCT_NAMES[x]}</option>`).join('')}</select> ${hexBtn('建設領土', 'free.hex', f.hex)}`;
    } else if (k === 'deploy') {
      const free = [0, 1, 2, 3].filter((i) => !p.mechs.some((x) => x.slot === i));
      body = `メック <select data-bind="free.mech">${free.map((i) => `<option value="${i}" ${+f.mech === i ? 'selected' : ''}>${ABILITY_NAMES[MECH_SLOTS[p.faction][i]]}</option>`).join('')}</select> ${hexBtn('配置領土', 'free.hex', f.hex)}`;
    } else if (k === 'upgrade') {
      const opts = BOTTOM_ORDER.filter((s) => p.red[s] < BASE_MATS[p.mat].lower[s][1]);
      body = upNote + `上段から取る <select data-bind="free.top">${topOpts(p, f.top)}</select> 下段に置く <select data-bind="free.slot">${slotOpts(p, f.slot)}</select>`;
    } else if (k === 'enlist') {
      const fromFree = BOTTOM_ORDER.filter((s) => !p.recruits.some((r) => r.section === s));
      const bonFree = RECRUIT_ONETIME.filter((x) => !p.recruits.some((r) => r.bonus === x));
      const BN = { power: '戦力+2', coins: 'コイン+2', pop: '支持+2', card: '戦闘カード+2' };
      body = `取得元 <select data-bind="free.from">${fromFree.map((s) => `<option value="${s}" ${f.from === s ? 'selected' : ''}>${BOTTOM_NAMES[s]}（常時：${ONG[s]}）</option>`).join('')}</select> 一時ボーナス <select data-bind="free.bonus">${bonFree.map((x) => `<option value="${x}" ${f.bonus === x ? 'selected' : ''}>${BN[x]}</option>`).join('')}</select>`;
    } else if (k === 'produce') {
      body = `<div class="chips">${producible(ctx).map((id) => `<button class="chip ${ui.produce.includes(id) ? 'on' : ''}" data-act="produce-toggle" data-v="${id}">${TERR[MAP.hexes[id].terrain][1]} ${id}</button>`).join('')}</div>`;
    } else if (k === 'anyRes') {
      body = `${Array.from({ length: head.n }, (_, i) => resSel(`free.r${i}`, f['r' + i] || 'oil')).join(' ')} ${hexBtn('置く領土', 'free.hex', f.hex)}`;
    }
    const sel = kinds.length > 1 ? `<div class="row">${kinds.map((x) => `<button class="sm ${x === k ? '' : 'ghost'}" data-act="free-kind" data-v="${x}">${FREE_NAMES[x]}</button>`).join('')}</div>` : '';
    return `<div class="card"><h2>無料効果：${kinds.map((x) => FREE_NAMES[x]).join('か')}（残り${pd.queue.length}）</h2><p class="mute">費用なしで実行します。</p>${sel}
      <div class="row">${body}<button data-act="free-go" data-v="${k}">実行</button><button class="ghost" data-act="free-skip">行わない</button></div></div>`;
  }
  const LABEL = { coins: 'コイン', power: '戦力', pop: '支持', card: '戦闘カード', oil: '油', metal: '鉄', wood: '木材', food: '食料', worker: 'ワーカー' };

  function combatPanel(ctx) {
    const { st, me, priv, combat } = ctx, pd = st.pending;
    const inFight = me === pd.attacker || me === pd.defender;
    const head = `<h2>戦闘：${nm(ctx, pd.attacker)}（攻撃）対 ${nm(ctx, pd.defender)}</h2>`;
    if (!inFight) return `<div class="card">${head}<p class="mute">戦闘の結果を待っています。</p></div>`;
    const p = st.players[me], units = me === pd.attacker ? pd.attUnits : pd.defUnits;
    const committed = !!combat?.commits?.[me];
    if (committed) return `<div class="card">${head}<p>戦力を確定しました。${combat?.commits && Object.keys(combat.commits).length >= 2 ? '公開しています…' : '相手の確定を待っています…'}</p></div>`;
    const hand = (priv?.hand || []).slice().sort((a, b) => a.value - b.value);
    const maxDial = Math.min(7, p.power);
    return `<div class="card">${head}<p class="mute">ダイヤルと戦闘カードを秘密に決め、同時に公開します。同点は攻撃側の勝ち。</p>
      <div class="row">ダイヤル（戦力${p.power}・最大${maxDial}） <select data-bind="combat.dial">${Array.from({ length: maxDial + 1 }, (_, i) => `<option value="${i}" ${+ui.combat.dial === i ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
      <p>戦闘カード（関与ユニット${units}体まで／手札${hand.length}枚）</p>
      <div class="row">${hand.map((c) => `<label class="cardchip"><input type="checkbox" data-bind="combat.card" value="${c.id}" ${ui.combat.cards.includes(c.id) ? 'checked' : ''}> ${c.value}</label>`).join('') || '<span class="mute">手札なし</span>'}</div>
      <div class="row"><button data-act="combat-commit">確定する</button></div></div>`;
  }

  function objectivePanel(ctx) {
    const { st, me, priv } = ctx, p = st.players[me];
    const list = (priv?.objectives || []).map((id) => byId(OBJECTIVES, id)).filter(Boolean);
    if (!list.length) return '';
    const h = objectiveHelpers(st, me);
    return `<p class="mute">目的カード（達成していれば宣言して星を得ます）</p>${list.map((o) => {
      const ok = o.check(p, h) && !(p.stars.includes('objective') && (p.faction !== 'saxony' || p.stars.includes('objective2')));
      return `<div class="opt"><b>${esc(o.name)}</b> <span class="mute">${esc(o.text)}</span> <button class="sm" data-act="objective" data-v="${o.id}" ${ok ? '' : 'disabled'}>宣言</button></div>`;
    }).join('')}`;
  }

  function resultPanel(ctx) {
    const { st, room, me } = ctx, r = st.result;
    return `<div class="card"><h2>ゲーム終了</h2><p>勝者：<b>${nm(ctx, r.winner)}</b></p>
      <table class="tbl"><tr><th>順位</th><th>名前</th><th>合計</th><th>コイン</th><th>星</th><th>領土</th><th>資源</th><th>建物ボーナス</th></tr>
      ${r.rows.map((x) => `<tr><td>${x.rank}</td><td>${nm(ctx, x.uid)}</td><td><b>${x.total}</b></td><td>${x.parts.coins}</td><td>${x.parts.stars}</td><td>${x.parts.territories}</td><td>${x.parts.resources}</td><td>${x.parts.structureBonus}</td></tr>`).join('')}</table>
      <div class="row">${room.hostUid === me ? '<button data-act="rematch">同じメンバーでもう一度</button>' : ''}<button class="ghost" data-act="leave">退出</button></div></div>`;
  }

  const II = (n, t) => `<img class="ri" src="img/${n}.png" title="${t}" alt="${t}">`;
  const ICO = { coins: II('coin', 'コイン'), power: II('power', '戦力'), pop: II('pop', '支持'), star: II('star', '星'), card: '<span class="ic" title="戦闘カード">🂠</span>', worker: II('people', 'ワーカー'), mech: '<span class="ic" title="メック">▣</span>' };
  const FACE = (f, n = 26) => `<img class="face" style="width:${n}px;height:${n}px" src="img/faction_${f}.jpg" alt="">`;
  const gauge = (ico, v, max, extra = '') => `<span class="gauge" title="${v} / 最大${max}">${ico}<i class="gbar ${ico === ICO.pop ? 'popbar' : ''}"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></i><b>${v}<small>/${max}</small></b>${extra ? `<small>${extra}</small>` : ''}</span>`;
  function comparePanel(ctx) {
    const { st } = ctx;
    const rows = [[ICO.pop, (p) => p.pop, 18], [ICO.power, (p) => p.power, 16], [ICO.star, (p) => p.stars.length, 6], [ICO.coins, (p) => p.coins, Math.max(10, Math.ceil(Math.max(...Object.values(st.players).map((p) => p.coins)) / 5) * 5)]];
    return `<div class="card"><h2>プレイヤー比較</h2>${st.order.map((u, i) => `<span class="legend">${FACE(st.players[u].faction, 22)}<i style="background:${colorFor(st, u)};border:1px solid #888"></i>${nm(ctx, u)}（${BASE_FACTIONS[st.players[u].faction].name}）</span>`).join('')}
      ${rows.map(([lab, f, mx]) => `<div class="cmp"><b class="cl">${lab}</b><div class="track ${lab === ICO.pop ? 'poptrack' : ''}">${lab === ICO.pop ? '<div class="tiers"><span style="width:36.1%">〜6：領土×2 星×3 資源×1</span><span style="width:33.3%">7〜12：領土×3 星×4 資源×2</span><span style="flex:1">13〜：領土×4 星×5 資源×3</span></div>' : ''}${[...Array(mx + 1).keys()].filter((i) => i % (mx > 20 ? 5 : 2) === 0).map((i) => `<s style="left:${(i / mx) * 100}%"><u>${i}</u></s>`).join('')}${st.order.map((u, i) => { const v = f(st.players[u]); return `<span class="pin" data-ink="${inkOn(colorFor(st, u))}" style="left:${Math.min(100, (v / mx) * 100)}%;top:${4 + i * 2}px;border-color:#fff;background:${colorFor(st, u)}" title="${esc(nm(ctx, u))}：${v}"><em>${v}</em></span>`; }).join('')}<small class="mx">${lab === ICO.coins ? '上限なし（現在の最大に合わせて可変）' : `最大${mx}`}</small></div>
      </div>`).join('')}</div>`;
  }

  const RESIMG = (r) => `<img class="ri" src="img/${r}.png" alt="${RES_NAMES[r]}">`;
  function prodPreview(ctx) {
    const { st, me } = ctx, p = st.players[me], out = [];
    for (const h of MAP.ids) {
      const T = MAP.hexes[h].terrain, n = p.workers.filter((w) => w === h).length;
      if (!n || controller(st, h) !== me) continue;
      const mill = p.structures.some((s) => s.type === 'mill' && s.hex === h) ? 1 : 0;
      if (T === 'village') out.push(`村${h}：ワーカー+${n + mill}`);
      else { const r = { mountain: 'metal', tundra: 'oil', farm: 'food', forest: 'wood' }[T]; if (r) out.push(`${RESIMG(r)}×${n + mill}（${h}）`); }
    }
    return out.length ? out.join(' ') : '<span class="mute">生産できる領土なし</span>';
  }

  // 国マット（16:9・国の絵が背景）
  function factionMat(ctx) {
    const { st, me } = ctx, p = st.players[me];
    const fc = p.factory ? byId(FACTORY_CARDS, p.factory) : null;
    const pick = st.turnUid === me && st.turn.phase === 'section' && !st.pending && legalSections(st, me).includes('factory');
    const fcol = fc ? `<${pick ? 'button' : 'div'} class="acol fac ${p.section === 'factory' ? 'cur' : ''} ${pick ? 'can' : ''}" ${pick ? 'data-act="section" data-v="factory"' : ''} title="${esc(fc.text)}"><img src="${fc.img}" alt=""><small>工場：${esc(fc.text)}</small></${pick ? 'button' : 'div'}>` : '';
    return `<div class="fwrap">${factionMat0(ctx)}${fcol}</div>`;
  }
  function factionMat0(ctx) {
    const { st, me, priv } = ctx, p = st.players[me], f = p.faction, F = BASE_FACTIONS[f];
    const hand = (priv?.hand || []).map((c) => c.value).sort((a, b) => a - b);
    const slots = MECH_SLOTS[f].map((a, i) => {
      const on = p.mechs.some((m) => m.slot === i);
      return `<div class="slot ${on ? 'on' : ''}"><b>${on ? '✔ ' : '□ '}${ABILITY_NAMES[a]}</b><span>${ABILITY_TEXT[a](f)}</span></div>`;
    }).join('');
    return `<div class="mat fmat" style="background-image:linear-gradient(rgba(10,8,6,.55),rgba(10,8,6,.88)),url(img/faction_${f}.jpg)">
      <div class="mh"><b>${F.name}</b> <span class="pas">固有：${PASSIVE[f][0]}</span> <span class="mute">${PASSIVE[f][1]}</span></div>
      <div class="chips2">${gauge(ICO.power, p.power, 16)}${gauge(ICO.pop, p.pop, 18, `（領土×${popTier(p.pop).terr}）`)}<span class="gauge" title="コインに上限はありません（ゲージは参加者の最大値に合わせて伸びます）">${ICO.coins}<i class="gbar"><i style="width:${Math.min(100, (p.coins / Math.max(10, ...Object.values(st.players).map((q) => q.coins))) * 100)}%"></i></i><b>${p.coins}</b></span>${gauge(ICO.star, p.stars.length, 6)}<span>${ICO.card}<b>${hand.join(',') || '-'}</b></span><span>${ICO.worker}<b>${p.workers.length}+${p.matWorkers}</b></span>${gauge(ICO.mech, p.mechs.length, 4)}${['oil','metal','wood','food'].map((r) => `<span>${RESIMG(r)}<b>${resTotals(st, me)[r]}</b></span>`).join('')}</div>
      <div class="slots">${slots}</div>
      <div class="mute small">メックを配備するとき、解放する能力を上から選べます（キャラクターと全メックに適用）。</div></div>`;
  }

  // 行動マット（16:9・マットの絵が背景）。セクション選択もここで行う
  function actionMat(ctx) {
    const { st, me } = ctx, p = st.players[me], m = BASE_MATS[p.mat];
    const pick = st.turnUid === me && st.turn.phase === 'section' && !st.pending;
    const ok = pick ? legalSections(st, me) : [];
    const ic = (x) => `<span class="g">${x}</span>`;
    const SQ = (cls, inner, title = '') => `<i class="sq ${cls}" ${title ? `title="${title}"` : ''}>${inner}</i>`;
    const coinI = II('coin', 'コイン'), powI = II('power', '戦力'), popI = II('pop', '支持');
    const GLYPH = { power: powI, card: '<b class="em">🂠</b>', move: '<b class="em">🏃</b>', coin: coinI, pop: popI, hex: '<b class="em">⬡</b>', res: '<b class="em">◐</b>' };
    // 上段の絵：基本アイコン＋改良キューブ枠（取ると強化）
    const TOPSPEC = {
      bolster: { pay: coinI, groups: [['power', 2, 1], ['card', 1, 1]] },
      move: { pay: '', groups: [['move', 2, 1], ['coin', 1, 0]] },
      produce: { pay: '', groups: [['hex', 2, 1]] },
      trade: { pay: coinI, groups: [['res', 2, 1], ['pop', 1, 1]] },
    };
    const LABEL = { bolster: '強化', move: '移動／獲得', produce: '生産', trade: '交易' };
    const topBlock = (top, s) => {
      const sp = TOPSPEC[top], up = p.up[top] || 0; let used = 0, bar = '';
      const grp = sp.groups.map(([g, n, slots]) => {
        const cells = Array.from({ length: n }, () => SQ('gain', GLYPH[g])).join('');
        const sl = Array.from({ length: Math.min(slots, Math.max(0, (TOP_CUBES[top] || 0) - used)) }, () => { const filled = used < up; used++; return SQ(`slot ${filled ? 'got' : ''}`, filled ? GLYPH[g] : '<u class="cube"></u>', filled ? '改良済み（効果発動中）' : '改良キューブ枠'); }).join('');
        return `<span class="grp">${cells}${sl}</span>`;
      }).join('<b class="sl">／</b>');
      if (top === 'produce') {
        const w = p.workers.length, cost = produceCost(w);
        bar = `<div class="pbar" title="ワーカー数に応じた生産コスト（赤枠）">${[1, 2, 3, 4, 5, 6].map((k) => `<i class="${w >= 2 * k ? 'act' : ''}">${k === 2 ? powI : k === 4 ? popI : k === 6 ? coinI : ''}</i>`).join('')}</div>`;
      }
      return `<div class="top"><div class="lbl">${LABEL[top]}</div>${sp.pay ? `<div class="row1"><small>支払</small>${SQ('pay', sp.pay)}</div>` : ''}${bar}<div class="row1">${grp}</div></div>`;
    };
    const cols = [0, 1, 2, 3].map((s) => {
      const top = topOf(p.mat, s), sk = structOf(p.mat, s), bk = BOTTOM_ORDER[s], [base, maxRed, coin] = m.lower[bk];
      const cost = Math.max(0, base - p.red[bk]), built = p.structures.some((x) => x.type === sk);
      const cur = p.section === s, rec = p.recruits.find((x) => x.section === bk);
      const ONGI = { upgrade: powI, deploy: coinI, build: popI, enlist: GLYPH.card }[bk];
      const BG = { upgrade: '⚙', deploy: '▣', build: '⌂', enlist: '🪖' }[bk];
      const pay = Array.from({ length: base }, (_, i) => (i < base - maxRed ? SQ('pay', RESIMG(BOTTOM_RES[bk])) : SQ(`pay hatch ${i - (base - maxRed) < p.red[bk] ? 'off' : ''}`, i - (base - maxRed) < p.red[bk] ? '<u class="cube"></u>' : RESIMG(BOTTOM_RES[bk])))).join('');
      return `<${pick ? 'button' : 'div'} class="acol pm ${cur ? 'cur' : ''} ${pick && ok.includes(s) ? 'can' : ''}" ${pick ? `data-act="section" data-v="${s}" ${ok.includes(s) ? '' : 'disabled'}` : ''} title="${esc(TOP_TEXT[top])}／${esc(BOTTOM_TEXT[bk])}">
        ${topBlock(top, s)}
        <div class="bld ${built ? 'built' : ''}" title="${esc(STRUCT_TEXT[sk])}"><span class="bi"><img src="img/${sk}.png" alt=""></span><small>${STRUCT_NAMES[sk]}${built ? '：発動中' : ''}</small></div>
        <div class="bot"><div class="row1"><small>支払</small>${pay}</div>
          <div class="row1 act2"><small class="nm">${BOTTOM_NAMES[bk]}</small>${SQ('gain', `<b class="em">${BG}</b>`)}${Array.from({ length: coin }, () => `<i class="cn">${coinI}</i>`).join('')}</div>
          <div class="rc"><span class="ring ${rec ? 'on' : ''}" title="${rec ? `徴兵済み：自分と両隣がこの下段を行うたび ${ONG[bk]}` : `徴兵すると、自分と両隣がこの下段を行うたび ${ONG[bk]}`}">${II('people', '徴兵')}</span><span class="ring2" title="常時ボーナス：${ONG[bk]}">${ONGI}</span></div>
          ${cost !== base ? `<small class="cst">コスト ${cost}</small>` : ''}</div></${pick ? 'button' : 'div'}>`;
    }).join('');
    return `<div class="mat amat" style="background-image:linear-gradient(rgba(10,8,6,.5),rgba(10,8,6,.85)),url(img/mat_${MAT_IMG[p.mat] || 1}.jpg)">
      <div class="mh"><b>${m.name}マット</b> <span class="mute">改良 ${p.cubes}/6 ・ 徴兵 ${p.recruits.length}/4 ・ 建物 ${p.structures.length}/4${pick ? ' ・ <b class="hint">列をクリックして今回のセクションを選ぶ</b>' : ''}</span></div>
      <div class="acols">${cols}</div></div>`;
  }

  function modalHtml(ctx) {
    const { st } = ctx;
    const inner = ui.convOpen && ctx.st.turnUid === ctx.me && !ctx.st.pending && ctx.st.turn.phase !== 'moving' ? convertPanel(ctx, true) : panelAction(ctx);
    if (!inner) return '';
    if (st.over) return `<div class="modal wide">${inner}</div>`;
    const pos = ui.mpos ? `left:${ui.mpos.x}px;top:${ui.mpos.y}px;transform:none;` : '';
    return `<div class="modal ${ui.mfold ? 'fold' : ''}" style="${pos}"><div class="mdrag" data-drag title="ドラッグで移動／クリックでたたむ">⠿ ${ui.mfold ? '▼ ひらく' : '▲ たたむ'}（ドラッグで移動）</div>${ui.mfold ? '' : matWrap(ctx, inner)}</div>`;
  }
  function objBox(ctx) {
    const { st, me, priv } = ctx, p = st.players[me];
    const list = (priv?.objectives || []).map((id) => byId(OBJECTIVES, id)).filter(Boolean);
    const bt = byId(BONUS_TILES, st.bonusTile);
    if (!ui.objOpen) return `<div class="objbox shut"><button class="ghost sm" data-act="objtoggle">目的カード ${list.length}枚 ▼</button></div>`;
    const JP = { 1: '高地の利', 11: '人口の優位', 16: '羊の群れの狼', 24: '人間の盾', 25: '忌まわしき戦争屋', 26: '多様な生産', 27: '地域基盤整備' };
    const got = p.stars.includes('objective');
    const row = (o) => { let ok = false; try { ok = !!o.check(p, objectiveHelpers(st, me)); } catch { /* 無視 */ } return `<div class="ob ${ok ? 'okc' : ''}"><b>${ok ? '✅' : '⬜'} ${esc(JP[o.no] || o.name)}</b><span><u>条件</u> ${esc(o.text)}</span><em>${ok ? '条件を満たしています（自動で星を獲得）' : '未達成'}</em></div>`; };
    return `<div class="objbox"><button class="ghost sm fold" data-act="objtoggle">▲ たたむ</button><b>目的カード</b>
      <div class="ob mute">条件を満たした時点で自動的に星1つを獲得します（操作不要・星は1枚分のみ）</div>
      ${list.length ? list.map(row).join('') : '<div class="ob mute">なし</div>'}${got ? '<div class="ob">⭐ 目的の星を獲得済み</div>' : ''}<div class="ob bt"><b>建物ボーナス</b><span>${esc(bt?.text || '')}</span></div></div>`;
  }
  function convertPanel(ctx, inModal) {
    const { st, me } = ctx;
    if (st.turnUid !== me || st.pending || st.over) return '';
    const me_p = st.players[me];
    const coer = me_p.faction === 'crimea' ? `<div class="row" style="margin-top:8px"><b>強要（クリミア）</b> 戦闘カード1枚 → ${resSel('conv.to', ui.conv.to)} ${hexBtn('置く領土', 'conv.hex', ui.conv.hex)}<button data-act="coercion" ${st.turn.coerced ? 'disabled' : ''}>${st.turn.coerced ? '使用済み（1手番1回）' : 'カードを資源にする'}</button></div>` : '';
    return `<div class="card"><h2>⇄ 資源交換</h2><p class="mute">任意の資源2個 → 任意の資源1個（自分のワーカーがいる支配領土に置く）</p>
      <div class="row">${resSel('conv.a', ui.conv.a)} ＋ ${resSel('conv.b', ui.conv.b)} → ${resSel('conv.to', ui.conv.to)} ${hexBtn('置く領土', 'conv.hex', ui.conv.hex)}<button data-act="convert">交換する</button>${inModal ? '<button class="ghost" data-act="convtoggle">閉じる</button>' : ''}</div>${coer}</div>`;
  }
  function hexPanel(ctx) {
    const { st } = ctx;
    if (!ui.sel) return `<div class="card"><h2>領土</h2><p class="mute">盤面の領土をクリックすると詳細を表示します。</p></div>`;
    const h = MAP.hexes[ui.sel], hs = st.hexes[ui.sel], us = unitsAt(st, ui.sel), c = controller(st, ui.sel);
    return `<div class="card"><h2>領土 ${ui.sel}：${TERR[h.terrain][1]}</h2>
      <div class="stats">支配: ${c ? nm(ctx, c) : 'なし'} ${hs.enc ? '／ 遭遇トークンあり' : ''} ${h.tunnel ? '／ トンネル' : ''}</div>
      <div class="stats">資源: ${Object.entries(hs.res).filter(([, v]) => v).map(([k, v]) => `${RES_NAMES[k]}${v}`).join(' ') || 'なし'} ${hs.structure ? `／ 建物: ${STRUCT_NAMES[hs.structure.type]}（${nm(ctx, hs.structure.owner)}）` : ''}</div>
      <div class="stats">ユニット: ${Object.entries(us).map(([u, x]) => `${nm(ctx, u)}(将${x.char ? 1 : 0} M${x.mechs} 工${x.workers})`).join(' ') || 'なし'}</div></div>`;
  }

  function logPanel(ctx) {
    const { st } = ctx;
    return `<div class="card"><h2>ログ</h2><div class="log">${st.log.slice(-40).reverse().map((l) => `<div><span class="mute">T${l.n}</span> ${nm(ctx, l.uid)}：${esc(l.text)}</div>`).join('')}</div></div>`;
  }

  // ---------------------------------------------------------------- 描画
  function render() {
    const ctx = getCtx();
    if (!ctx?.st) { root.innerHTML = '<p>読み込み中…</p>'; return; }
    const { st, me } = ctx;
    const tile = byId(BONUS_TILES, st.bonusTile);
    const mine = st.turnUid === me && !st.over;
    root.innerHTML = `
      <div class="turnbar ${mine ? 'mine' : ''}">${st.over ? 'ゲーム終了' : `手番：<b>${nm(ctx, st.turnUid)}</b>${mine ? '（あなた）' : ''}`} <span class="mute">ターン${st.turnNo}</span>
        <span class="tools"><button class="ghost sm" data-act="convtoggle" ${mine && !st.pending ? '' : 'disabled'} title="自分の手番中のみ">⇄ 資源交換</button><button class="ghost sm ${ui.resMode ? 'on' : ''}" data-act="resmode">${ui.resMode ? '通常マップに戻す' : '取れる資源を表示'}</button>${mine ? `<button class="endbtn" data-act="endTurn" ${st.pending ? 'disabled' : ''}>ターン終了</button>` : ''}<button class="ghost sm" data-act="zoom-">−</button><button class="ghost sm" data-act="zoom+">＋</button>
        <label class="chk"><input type="checkbox" data-bind="sound" ${ui.sound ? 'checked' : ''}> 効果音</label></span></div>
      ${st.over ? '' : stepsBar(st)}
      <div class="game"><div class="boardwrap" id="boardwrap">${boardSVG(ctx)}${objBox(ctx)}</div>
      <div class="mats2">${st.over ? '' : `${factionMat(ctx)}${actionMat(ctx)}`}</div></div>
      <div class="below">${convertPanel(ctx)}${comparePanel(ctx)}${hexPanel(ctx)}${logPanel(ctx)}</div>${modalHtml(ctx)}`;
    root.querySelectorAll('select[data-bind]').forEach((el) => setPath(el.dataset.bind, el.value));
    fitMats();
    try { fx(ctx); } catch (e) { console.error(e); }
    if (st.log.length !== ui.lastLog) {
      if (ui.lastLog) {
        const last = st.log[st.log.length - 1], x = last.text;
        sfx(/星/.test(x) ? 'star' : /戦闘|退却/.test(x) ? 'combat' : /建設|配備|改良|徴兵|工場/.test(x) ? 'build' : /生産/.test(x) ? 'produce' : /コイン|資源|獲得|遭遇/.test(x) ? 'coin' : /移動/.test(x) ? 'move' : /終了/.test(x) ? 'end' : 'click');
      }
      if (ui.lastTurn !== st.turnUid) { if (ui.lastTurn && st.turnUid === me) sfx('turn'); ui.lastTurn = st.turnUid; }
      ui.lastLog = st.log.length;
    }
  }

  // 実行できない・選択の余地がない処理は自動で進める
  const tried = new Set();
  function autoAction(ctx) {
    const { st, me, priv } = ctx, p = st.players[me], pd = st.pending, t = st.turn;
    const once = (key, a) => (tried.has(key) ? null : (tried.add(key), a));
    const sig = `${st.gid}.${st.log.length}`;
    if (pd?.type === 'free') {
      const h = pd.queue[0], kinds = h.alt || [h.k];
      if (!kinds.some((k) => canDo(st, me, k, true))) return once(`fs${sig}`, { t: 'free', skip: true });
      return null;
    }
    if (pd?.type === 'encounter' && pd.cardId) {
      const c = byId(ENCOUNTERS, pd.cardId);
      return c.options.some((o) => !o.unsupported && canPay(st, me, o.cost)) ? null : once(`en${sig}`, { t: 'encounter', picks: [] });
    }
    if (pd) return null;
    if (t.phase === 'section') {
      const anyUnit = (u) => moveTargets(st, me, u).length > 0;
      const can = legalSections(st, me).some((sec) => {
        const kind = sec === 'factory' ? 'factory' : topOf(p.mat, sec);
        const topOk = kind === 'move' ? ['char', ...p.mechs.map((_, i) => `m${i}`), ...p.workers.map((_, i) => `w${i}`)].some(anyUnit) : kind === 'factory' ? true : canDo(st, me, kind);
        return topOk || (sec !== 'factory' && canDo(st, me, BOTTOM_ORDER[sec], false, true));
      });
      if (!can) return once(`ae${sig}`, { t: 'endTurn' });
    }
    if (t.phase !== 'moving') {
      const free = !p.stars.includes('objective') || (p.faction === 'saxony' && !p.stars.includes('objective2'));
      if (free && p.objs > 0) for (const id of priv?.objectives || []) {
        const c = byId(OBJECTIVES, id);
        if (c && c.check(p, objectiveHelpers(st, me))) return once(`ob${id}${sig}`, { t: 'objective', cardId: id });
      }
    }
    if (t.phase === 'end') return once(`ee${sig}`, { t: 'endTurn' });
    if (t.phase === 'top') {
      const kind = p.section === 'factory' ? 'factory' : topOf(p.mat, p.section);
    }
    if (t.phase === 'moving' && t.move) {
      const units = ['char', ...p.mechs.map((_, i) => `m${i}`), ...p.workers.map((_, i) => `w${i}`)].filter((u) => !(t.move.kind === 'move' && t.move.moved.includes(u)));
      if (!units.some((u) => moveTargets(st, me, u).length)) return once(`mv${sig}`, { t: 'endMove' });
    }
    if (t.phase === 'bottom' && p.section !== 'factory') {
      if (!canDo(st, me, BOTTOM_ORDER[p.section], false, true)) return once(`bt${sig}`, { t: 'bottom', kind: 'skip' });
    }
    return null;
  }

  // ---------------------------------------------------------------- 自動処理（スナップショットごとに呼ぶ）
  async function tick() {
    const ctx = getCtx();
    if (!ctx?.st) return;
    const { st, me, deck, combat } = ctx;
    if (deck && ((deck.grants?.[me] || 0) > 0 || (deck.objGrants?.[me] || 0) > 0) && !busy.has('claim')) {
      busy.add('claim'); await guard(() => net().claim()); busy.delete('claim');
    }
    if (st.turnUid === me && !st.over && !busy.has('auto')) {
      const a = autoAction(ctx);
      if (a) { busy.add('auto'); if (a.t === 'bottom' && a.kind === 'skip') toast('下段アクションを実行できないためスキップしました'); await guard(() => net().dispatch(a)); busy.delete('auto'); return; }
    }
    const pd = st.pending;
    if (pd?.type === 'encounter' && !pd.cardId && st.turnUid === me && !busy.has('enc')) {
      busy.add('enc'); await guard(() => net().drawEncounter()); busy.delete('enc');
    }
    if (pd?.type === 'combat' && (me === pd.attacker || me === pd.defender)) {
      const both = combat?.commits && Object.keys(combat.commits).length >= 2;
      if (both && !combat.reveals?.[me] && !busy.has(`rv${pd.key}`)) {
        busy.add(`rv${pd.key}`);
        try { await guard(() => net().revealCombat(pd.key)); } finally { setTimeout(() => busy.delete(`rv${pd.key}`), 1500); }
      }
      if (me === pd.attacker && combat?.reveals && Object.keys(combat.reveals).length >= 2 && !busy.has(`rs${pd.key}`)) {
        busy.add(`rs${pd.key}`);
        try {
          const a = await net().verifyReveal(pd.key, pd.attacker, combat), d = await net().verifyReveal(pd.key, pd.defender, combat);
          if (!a || !d) toast('戦力の公開内容が確定時と一致しません');
          else await guard(() => net().dispatch({ t: 'combat', att: a, def: d }));
        } finally { setTimeout(() => busy.delete(`rs${pd.key}`), 1500); } // 失敗しても自動で再試行する
      }
    }
  }

  // ---------------------------------------------------------------- 入力
  const setPath = (path, val) => { const [a, b] = path.split('.'); if (b) ui[a][b] = val; else ui[a] = val; };

  function selectUnit(ctx, unit) {
    const { st, me } = ctx, mv = st.turn.move;
    if (!mv) return;
    if (mv.kind === 'move' && mv.moved.includes(unit)) return toast('そのユニットはすでに動かしました');
    ui.selUnit = unit; ui.pick = null;
    const allow = undefined;
    ui.targets = moveTargets(st, me, unit, allow);
    render();
  }

  function onHex(ctx, id) {
    const { st, me } = ctx;
    if (ui.pick && st.turn.phase === 'moving' && !st.pending) ui.pick = null;
    if (!ui.pick && prodMode(ctx) && producibleHexes(st, me).includes(id)) {
      const lim = 2 + (st.players[me].up.produce || 0);
      ui.produce = ui.produce.includes(id) ? ui.produce.filter((x) => x !== id) : [...ui.produce, id].slice(-lim); render(); return;
    }
    if (ui.pick) {
      const { key } = ui.pick;
      if (!ui.pick.ok(id)) { toast('そこは選べません'); return; }
      if (key === 'produce') { if (!ui.produce.includes(id)) ui.produce = [...ui.produce, id].slice(-2); else ui.produce = ui.produce.filter((x) => x !== id); }
      else if (key === 'trade.hex') ui.trade.hex = id;
      else if (key === 'fac.hex') ui.fac.hex = id;
      else if (key === 'bot.hex') ui.bot.hex = id;
      else if (key === 'free.hex') ui.free.hex = id;
      else if (key === 'conv.hex') ui.conv.hex = id;
      if (key !== 'produce') ui.pick = null;
      render(); return;
    }
    if (st.turn.phase === 'moving' && ui.selUnit && ui.targets.some((t) => t.to === id)) {
      const unit = ui.selUnit;
      let carry;
      if (ui.carry) { const from = st.turn.move && (unit === 'char' ? st.players[me].char : unit[0] === 'm' ? st.players[me].mechs[+unit.slice(1)].hex : st.players[me].workers[+unit.slice(1)]); carry = { ...st.hexes[from].res }; }
      ui.selUnit = null; ui.targets = [];
      const workers = unit[0] === 'm' ? +ui.wcar || 0 : 0; ui.wcar = 0;
      const via = unit[0] === 'm' && ui.via?.hex ? [{ hex: ui.via.hex, drop: +ui.via.drop || 0, take: +ui.via.take || 0 }] : undefined; ui.via = null;
      act({ t: 'move', unit, to: id, carry, workers, via });
      return;
    }
    ui.sel = id; render();
  }

  const okMine = (ctx, id) => controller(ctx.st, id) === ctx.me && ctx.st.players[ctx.me].workers.includes(id);

  function onClick(e) {
    const ctx = getCtx(); if (!ctx?.st) return;
    const { st, me } = ctx;
    const unitEl = e.target.closest('[data-unit]');
    if (unitEl && st.turn.phase === 'moving' && st.turnUid === me && !st.pending) { selectUnit(ctx, unitEl.dataset.unit); return; }
    const btn = e.target.closest('[data-act]');
    if (btn) { if (!/section|endTurn/.test(btn.dataset.act)) sfx('click'); handleAct(ctx, btn.dataset.act, btn.dataset.v); return; }
    const hx = e.target.closest('[data-hex]');
    if (hx) onHex(ctx, hx.dataset.hex);
  }

  function handleAct(ctx, a, v) {
    const { st, me } = ctx, p = st.players[me];
    switch (a) {
      case 'objtoggle': ui.objOpen = !ui.objOpen; render(); break;
      case 'resmode': ui.resMode = !ui.resMode; render(); break;
      case 'zoom+': ui.zoom = Math.min(2.4, ui.zoom + 0.2); render(); break;
      case 'zoom-': ui.zoom = Math.max(0.6, ui.zoom - 0.2); render(); break;
      case 'leave': onLeave(); break;
      case 'rematch': onRematch(); break;
      case 'section': act({ t: 'section', section: v === 'factory' ? 'factory' : +v }); break;
      case 'cancel-sec': act({ t: 'cancelSection' }); break;
      case 'top-skip': act({ t: 'top', kind: 'skip' }); break;
      case 'move-units': act({ t: 'top', kind: 'move', mode: 'units' }); break;
      case 'move-coin': act({ t: 'top', kind: 'move', mode: 'coin' }); break;
      case 'bolster-power': act({ t: 'top', kind: 'bolster', mode: 'power' }); break;
      case 'bolster-card': act({ t: 'top', kind: 'bolster', mode: 'card' }); break;
      case 'trade-pop': act({ t: 'top', kind: 'trade', mode: 'pop' }); break;
      case 'flag': act(v ? { t: 'flag' } : { t: 'flag', skip: true }); break;
      case 'trap': act(v ? { t: 'trap', penalty: v } : { t: 'trap', skip: true }); break;
      case 'resset': { const [k, r] = v.split('|'); setPath(k, r); render(); break; }
      case 'coercion':
        if (!ui.conv.hex) return toast('置く領土を選んでください');
        act({ t: 'coercion', res: ui.conv.to, hex: ui.conv.hex }); break;
      case 'convtoggle': if (st.turnUid !== me) return toast('資源交換は自分の手番中だけです'); ui.convOpen = !ui.convOpen; render(); break;
      case 'convert':
        if (!ui.conv.hex) return toast('置く領土を選んでください');
        act({ t: 'convert', give: [ui.conv.a, ui.conv.b], to: ui.conv.to, hex: ui.conv.hex }); break;
      case 'trade-res':
        if (!ui.trade.hex) return toast('資源を置く領土を選んでください');
        act({ t: 'top', kind: 'trade', mode: 'res', res: [{ type: ui.trade.r1, hex: ui.trade.hex }, { type: ui.trade.r2, hex: ui.trade.hex }] }); break;
      case 'produce-go': act({ t: 'top', kind: 'produce', hexes: ui.produce }); ui.produce = []; ui.pick = null; break;
      case 'produce-toggle': ui.produce = ui.produce.includes(v) ? ui.produce.filter((x) => x !== v) : [...ui.produce, v].slice(-(2 + (st.players[me].up.produce || 0))); render(); break;
      case 'free-kind': ui.free.kind = v; render(); break;
      case 'free-skip': ui.produce = []; act({ t: 'free', skip: true }); break;
      case 'free-go': {
        const f = ui.free, body = { t: 'free', kind: v };
        if (v === 'build') Object.assign(body, { type: f.type, hex: f.hex });
        else if (v === 'deploy') Object.assign(body, { slot: +f.mech, hex: f.hex });
        else if (v === 'upgrade') Object.assign(body, { slot: f.slot, top: f.top });
        else if (v === 'enlist') Object.assign(body, { from: f.from, bonus: f.bonus });
        else if (v === 'produce') { body.hexes = ui.produce; ui.produce = []; }
        else if (v === 'anyRes') { const n = st.pending.queue[0].n; body.res = Array.from({ length: n }, (_, i) => f['r' + i] || 'oil'); body.hex = f.hex || p.char; }
        act(body); ui.free.hex = null; break;
      }
      case 'produce-clear': ui.produce = []; ui.pick = null; render(); break;
      case 'factory-go': { const c = byId(FACTORY_CARDS, p.factory); act({ t: 'top', kind: 'factory', hex: ui.fac.hex || p.char, payRes: Array.from({ length: c.cost.anyRes || 0 }, (_, i) => ui.fac['pay' + i] || ['oil', 'wood'][i] || 'oil') }); }; break;
      case 'unit': selectUnit(ctx, v); break;
      case 'endMove': ui.selUnit = null; ui.targets = []; act({ t: 'endMove' }); break;
      case 'bot-skip': act({ t: 'bottom', kind: 'skip' }); break;
      case 'bot-factory': act({ t: 'bottom', kind: 'factoryMove' }); break;
      case 'bot-go': {
        const kind = BOTTOM_ORDER[p.section], b = ui.bot;
        const body = kind === 'upgrade' ? { slot: b.slot, top: b.top } : kind === 'deploy' ? { slot: +b.mech, hex: b.hex } : kind === 'build' ? { type: b.type, hex: b.hex } : { from: b.from, bonus: b.bonus };
        act({ t: 'bottom', kind, ...body }); break;
      }
      case 'objective': act({ t: 'objective', cardId: v }); break;
      case 'endTurn': if (confirm('ターンを終了しますか？')) act({ t: 'endTurn' }); break;
      case 'enc-go': act({ t: 'encounter', picks: ui.enc }); ui.enc = []; break;
      case 'factory-pick': act({ t: 'factory', cardId: v }); break;
      case 'combat-commit': {
        const pd = st.pending, maxDial = Math.min(7, p.power), units = me === pd.attacker ? pd.attUnits : pd.defUnits;
        const dial = Math.max(0, Math.min(maxDial, Math.floor(+ui.combat.dial || 0)));
        if (ui.combat.cards.length > units) return toast(`戦闘カードは${units}枚までです`);
        guard(() => net().commitCombat(pd.key, dial, ui.combat.cards)).then(() => { ui.combat = { dial: 0, cards: [] }; });
        break;
      }
      case 'pick': {
        const key = v;
        const ok = key === 'produce' ? (id) => okMine(ctx, id) && !['lake', 'home', 'factory'].includes(MAP.hexes[id].terrain)
          : (id) => okMine(ctx, id);
        ui.pick = { key, ok }; toast('盤面の領土をクリックしてください'); render(); break;
      }
      default:
    }
  }

  function onChange(e) {
    const el = e.target.closest('[data-bind]'); if (!el) return;
    const k = el.dataset.bind;
    if (k === 'carry') ui.carry = el.checked;
    if (k === 'wcar') ui.wcar = +el.value;
    if (k.startsWith('via.')) { ui.via = ui.via || {}; ui.via[k.slice(4)] = el.value; }
    else if (k === 'sound') ui.sound = el.checked;
    else if (k === 'enc') {
      const max = (getCtx().st.players[getCtx().me].faction === 'polania') ? 2 : 1;
      const i = +el.value;
      ui.enc = el.type === 'radio' ? [i] : el.checked ? [...ui.enc, i].slice(-max) : ui.enc.filter((x) => x !== i);
      render(); return;
    } else if (k === 'combat.card') {
      ui.combat.cards = el.checked ? [...ui.combat.cards, el.value] : ui.combat.cards.filter((x) => x !== el.value);
    } else setPath(k, el.value);
  }

  // 画面サイズに合わせてマットの文字サイズを自動調整（はみ出しが無くなる最大サイズ）
  function fitMats() {
    const box = root.querySelector('.mats2'); if (!box) return;
    const over = () => [...box.querySelectorAll('.mat, .acol')].some((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
    let f = 17; box.style.setProperty('--f', f);
    while (f > 7 && over()) { f -= 0.5; box.style.setProperty('--f', f); }
  }
  window.addEventListener('resize', () => { try { fitMats(); } catch { /* 無視 */ } });
  // ---------------------------------------------------------------- 演出（星・メック配備・建設・戦闘・罠）
  const snapOf = (st) => ({
    gid: st.gid, stars: Object.fromEntries(Object.entries(st.players).map(([u, p]) => [u, p.stars.length])),
    mechs: Object.fromEntries(Object.entries(st.players).map(([u, p]) => [u, p.mechs.map((m) => m.hex)])),
    structs: Object.fromEntries(MAP.ids.filter((h) => st.hexes[h].structure).map((h) => [h, st.hexes[h].structure.type])),
    combat: st.lastCombat ? `${st.lastCombat.hex}.${st.turnNo}.${st.lastCombat.winner}` : '',
    traps: (st.traps || []).filter((x) => !x.armed).length, popUnits: 0,
  });
  function overlay(inner, ms = 1700) {
    const bw = document.getElementById('boardwrap'); if (!bw) return;
    const r = bw.getBoundingClientRect();
    const d = document.createElement('div'); d.className = 'fxwrap';
    d.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    d.innerHTML = `<svg viewBox="0 0 1024 1024">${inner}</svg>`;
    document.body.append(d); setTimeout(() => d.remove(), ms);
  }
  const ring = (x, y, color, delay = 0, big = 90) => `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${color}" stroke-width="5" opacity="0"><animate attributeName="r" from="10" to="${big}" begin="${delay}s" dur="0.9s" fill="freeze"/><animate attributeName="opacity" values="0;1;0" keyTimes="0;.15;1" begin="${delay}s" dur="0.9s" fill="freeze"/><animate attributeName="stroke-width" from="14" to="1" begin="${delay}s" dur="0.9s" fill="freeze"/></circle>`;
  // ディーゼルパンク調：蒸気（灰色の煙）と火花（橙の粒）、真鍮・錆色のリング
  const smoke = (x, y) => Array.from({ length: 5 }, (_, i) => `<circle cx="${x + (i - 2) * 14}" cy="${y}" r="10" fill="#9aa0a4" opacity="0"><animate attributeName="opacity" values="0;.55;0" dur="1.5s" begin="${i * 0.08}s" fill="freeze"/><animate attributeName="r" from="8" to="34" dur="1.5s" begin="${i * 0.08}s" fill="freeze"/><animate attributeName="cy" from="${y}" to="${y - 70 - i * 6}" dur="1.5s" begin="${i * 0.08}s" fill="freeze"/></circle>`).join('');
  const sparks = (x, y, n = 10) => Array.from({ length: n }, (_, i) => { const a = (i / n) * 6.283 + Math.random() * 0.5, r = 50 + Math.random() * 50; return `<circle cx="${x}" cy="${y}" r="3" fill="#ffb23e" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="0.8s" fill="freeze"/><animate attributeName="cx" from="${x}" to="${x + Math.cos(a) * r}" dur="0.8s" fill="freeze"/><animate attributeName="cy" from="${y}" to="${y + Math.sin(a) * r + 14}" dur="0.8s" fill="freeze"/></circle>`; }).join('');
  function starBurst(who) {
    const d = document.createElement('div'); d.className = 'starburst';
    const emb = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * 6.283, r = 120 + Math.random() * 130; return `<i style="--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r + 40}px;animation-delay:${(Math.random() * 0.15).toFixed(2)}s"></i>`; }).join('');
    d.innerHTML = `${emb}<div class="plate"><img src="img/star.png" alt=""><div><b>星を獲得</b><span>${esc(who)}</span></div></div>`;
    document.body.append(d); setTimeout(() => d.remove(), 2300);
  }
  function fx(ctx) {
    const { st } = ctx, cur = snapOf(st), prev = ui.snap;
    ui.snap = cur;
    if (!prev || prev.gid !== cur.gid) return;
    const px = (h) => { const hx = MAP.hexes[h]; return hx ? (hx.px || PX(hx.q, hx.r)) : [512, 512]; };
    let inner = '';
    for (const [u, n] of Object.entries(cur.stars)) if (n > (prev.stars[u] || 0)) { starBurst(ctx.names(u)); sfx('star'); }
    for (const [u, hs] of Object.entries(cur.mechs)) if (hs.length > (prev.mechs[u] || []).length) {
      const h = hs.find((x) => !(prev.mechs[u] || []).includes(x)) ?? hs[hs.length - 1], [x, y] = px(h);
      inner += ring(x, y, '#c9a24a', 0, 90) + sparks(x, y, 12) + smoke(x, y); sfx('deploy');
    }
    for (const [h, ty] of Object.entries(cur.structs)) if (!prev.structs[h]) { const [x, y] = px(h); inner += ring(x, y, '#b5532e', 0, 80) + sparks(x, y, 8) + smoke(x, y + 10); sfx('build'); }
    if (cur.combat && cur.combat !== prev.combat) {
      const [x, y] = px(st.lastCombat.hex); inner += ring(x, y, '#a83a2a', 0, 100) + sparks(x, y, 16);
      const bw = document.getElementById('boardwrap'); if (bw) { bw.classList.add('shake'); setTimeout(() => bw.classList.remove('shake'), 600); }
    }
    if (cur.traps > prev.traps) { const tr = (st.traps || []).filter((x) => !x.armed).pop(); if (tr) { const [x, y] = px(tr.hex); inner += ring(x, y, '#7d6a9a', 0, 80) + smoke(x, y); } }
    if (inner) overlay(inner);
  }
  let mdr = null;
  root.addEventListener('pointerdown', (e) => {
    const h = e.target.closest?.('[data-drag]'); if (!h) return;
    const m = h.parentElement, r = m.getBoundingClientRect(); mdr = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, m, moved: false };
    e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (!mdr) return;
    if (Math.abs(e.clientX - mdr.x0) + Math.abs(e.clientY - mdr.y0) > 5) mdr.moved = true;
    if (mdr.moved) { mdr.m.style.transform = 'none'; mdr.m.style.left = `${e.clientX - mdr.dx}px`; mdr.m.style.top = `${e.clientY - mdr.dy}px`; ui.mpos = { x: e.clientX - mdr.dx, y: e.clientY - mdr.dy }; }
  });
  window.addEventListener('pointerup', () => { if (!mdr) return; if (!mdr.moved) { ui.mfold = !ui.mfold; render(); } mdr = null; });
  let drag = false;
  root.addEventListener('pointerdown', (e) => {
    const u = e.target.closest?.('[data-unit]'); const ctx = getCtx();
    if (u && ctx?.st && ctx.st.turnUid === ctx.me && ctx.st.turn.phase === 'moving' && !ctx.st.pending) { drag = true; selectUnit(ctx, u.dataset.unit); }
  });
  window.addEventListener('pointerup', (e) => {
    if (!drag) return; drag = false;
    const ctx = getCtx(); const h = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-hex]');
    if (ctx?.st && h && ui.selUnit && ui.targets.some((t) => t.to === h.dataset.hex)) onHex(ctx, h.dataset.hex);
  });
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);

  return { render, tick };
}
