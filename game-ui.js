// 対戦画面（盤面SVG・操作パネル）。状態の判定は engine/game.js、保存は net.js。
import { MAP, DIRS, PX } from './legacy-map.js';
import {
  BASE_FACTIONS, BASE_MATS, MECH_SLOTS, ABILITY_NAMES, ABILITY_TEXT, PASSIVE, TOP_TEXT, BOTTOM_TEXT, IMPLEMENTED_ABILITIES, BOTTOM_ORDER, BOTTOM_NAMES, BOTTOM_RES,
  TOP_NAMES, STRUCT_NAMES, STRUCT_TEXT, RES_NAMES, TOP_CUBES, RECRUIT_ONETIME, topOf, structOf,
} from './data.js';
import {
  controller, controlled, resTotals, canPay, canDo, producibleHexes, unitsAt, moveTargets, legalSections, objectiveHelpers, scoreOf, RuleError,
} from './game.js';
import { ENCOUNTERS, OBJECTIVES, FACTORY_CARDS, BONUS_TILES, byId } from './cards.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#d9534f', '#4a90d9', '#e0b43a', '#5cb85c', '#b36bd1'];
const TERR = {
  mountain: ['#8d8d93', '山'], farm: ['#d6c26a', '農'], tundra: ['#9fb9c8', '油'], forest: ['#4f7d41', '森'],
  village: ['#c98f5e', '村'], lake: ['#3f70b3', '湖'], factory: ['#80608f', '工場'], home: ['#5a5148', '本'],
};
const SIZE = 34, SQ3 = Math.sqrt(3), K = 70 / 34; // 盤面画像上ではヘクス半径70px
const corner = (cx, cy, i) => { const a = (Math.PI / 180) * (60 * i - 30); return [cx + SIZE * Math.cos(a), cy + SIZE * Math.sin(a)]; };

export function createGameUI({ root, net, toast, getCtx, onLeave, onRematch }) {
  const ui = {
    selUnit: null, targets: [], carry: false, pick: null, sel: null, zoom: 1, resMode: false, objOpen: true, produce: [],
    trade: { r1: 'oil', r2: 'wood', hex: null }, free: { top: 'move', kind: null, hex: null, type: 'monument', mech: 0, slot: 'upgrade', from: 'upgrade', bonus: 'power' }, bot: { top: 'move', slot: 'upgrade', mech: 0, hex: null, type: 'monument', from: 'upgrade', bonus: 'power' },
    fac: { hex: null, r1: 'oil', r2: 'wood' }, combat: { dial: 0, cards: [] }, enc: [], sound: true, lastLog: 0,
  };
  const busy = new Set();
  let audio = null;

  // ---- 効果音（WebAudio合成。ドーパミン多めのアルペジオ・キラキラ・衝撃音） ----
  const tone = (f, at, dur, type = 'triangle', vol = 0.09, slide = 0) => {
    const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const noise = (at, dur, vol = 0.12) => {
    const n = audio.sampleRate * dur, buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audio.createBufferSource(), g = audio.createGain(); src.buffer = buf; g.gain.value = vol; src.connect(g); g.connect(audio.destination); src.start(audio.currentTime + at);
  };
  const N = { C5: 523, E5: 659, G5: 784, C6: 1047, E6: 1319, G6: 1568, C7: 2093 };
  const SFX = {
    click: () => tone(1200, 0, 0.05, 'square', 0.04),
    move: () => { tone(380, 0, 0.09, 'triangle', 0.1, 1.8); tone(760, 0.07, 0.08, 'sine', 0.06); },
    coin: () => [N.E6, N.G6, N.C7].forEach((f, i) => tone(f, i * 0.055, 0.14, 'sine', 0.09)),
    build: () => { tone(160, 0, 0.12, 'square', 0.08, 0.6); noise(0, 0.08, 0.1); [N.C5, N.G5, N.C6].forEach((f, i) => tone(f, 0.1 + i * 0.07, 0.2, 'triangle', 0.09)); },
    produce: () => [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => tone(f, i * 0.05, 0.16, 'triangle', 0.08)),
    combat: () => { noise(0, 0.25, 0.22); tone(110, 0, 0.35, 'sawtooth', 0.14, 0.4); tone(70, 0.05, 0.4, 'square', 0.1, 0.5); },
    star: () => { [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6, N.C7].forEach((f, i) => tone(f, i * 0.07, 0.35, 'triangle', 0.1)); tone(N.C6, 0.5, 0.7, 'sine', 0.1); },
    turn: () => { tone(N.G5, 0, 0.18, 'sine', 0.1); tone(N.C6, 0.12, 0.3, 'sine', 0.11); tone(N.E6, 0.26, 0.4, 'sine', 0.1); },
    end: () => { tone(N.C6, 0, 0.1, 'triangle', 0.08); tone(N.G5, 0.08, 0.16, 'triangle', 0.08); },
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
  function boardSVG(ctx) {
    const { st, me } = ctx; ctx_names = ctx.names;
    const colorOf = (uid) => COLORS[st.order.indexOf(uid)] || '#888';
    const tg = new Set(ui.targets.map((t) => t.to));
    let hexes = '', top = '';
    for (const id of MAP.ids) {
      const h = MAP.hexes[id], [X, Y] = h.px || PX(h.q, h.r), hs = st.hexes[id];
      const poly = [0, 1, 2, 3, 4, 5].map((i) => corner(0, 0, i).map((v) => v.toFixed(1)).join(',')).join(' ');
      const homeColor = h.home ? colorOf(Object.keys(st.players).find((u) => st.players[u].faction === h.home) || '') : null;
      const sel = ui.sel === id, isT = tg.has(id), pk = ui.pick && ui.pick.ok?.(id);
      const hi = sel || isT || pk, hc = sel ? '#ffffff' : isT ? '#00f0ff' : '#7dff7d';
      const shape = h.home
        ? `<circle r="${SIZE * 0.95}" fill="#000" fill-opacity=".01" stroke="${hi ? hc : 'none'}" stroke-width="3.4"/>`
        : `<polygon points="${poly}" fill="${hi ? hc : '#000'}" fill-opacity="${hi ? 0.25 : 0.01}" stroke="${hi ? hc : 'none'}" stroke-width="3.4" stroke-linejoin="round"/>`;
      const rIcon = ui.resMode && RES_OF[h.terrain] ? `<image href="${RES_OF[h.terrain]}.png" x="${-SIZE * 0.55}" y="${-SIZE * 0.55}" width="${SIZE * 1.1}" height="${SIZE * 1.1}" opacity=".95" pointer-events="none"/>`
        : ui.resMode && h.terrain === 'village' ? `<image href="people.png" x="${-SIZE * 0.55}" y="${-SIZE * 0.55}" width="${SIZE * 1.1}" height="${SIZE * 1.1}" opacity=".95" pointer-events="none"/>` : '';
      const dim = ui.resMode && !h.home ? `<polygon points="${poly}" fill="#000" fill-opacity=".5" pointer-events="none"/>` : '';
      hexes += `<g class="hx" data-hex="${id}" transform="translate(${X.toFixed(1)} ${Y.toFixed(1)}) scale(${K.toFixed(4)})">
        ${dim}${shape}${rIcon}${isT ? `<text y="6" text-anchor="middle" class="stp">${ui.targets.find((t) => t.to === id)?.steps ?? ''}</text>` : ''}
        ${hs.enc ? `<circle cx="${SIZE * 0.7}" cy="${-SIZE * 0.8}" r="8" fill="#e8c14a" stroke="#222"><title>遭遇トークン</title></circle><text x="${SIZE * 0.7}" y="${-SIZE * 0.8 + 4}" class="eb">!</text>` : ''}
        ${structMark(st, hs, colorOf, ctx)}
        ${resChips(hs, 0, 0)}
        </g>`;
      top += `<g transform="translate(${X.toFixed(1)} ${Y.toFixed(1)}) scale(${K.toFixed(4)})">${unitMarks(st, id, 0, 0, colorOf, me)}</g>`;
    }
    return `<svg viewBox="0 0 1024 1024" class="boardsvg" role="img" aria-label="盤面"><image href="map.jpg" width="1024" height="1024"/>${hexes}${top}</svg>`;
  }
  function structMark(st, hs, colorOf, ctx) {
    if (!hs.structure) return '';
    const c = colorOf(hs.structure.owner), n = STRUCT_NAMES[hs.structure.type];
    return `<g class="struct"><title>${n}（${esc(ctx.names(hs.structure.owner))}）</title><circle cx="${-SIZE * 0.7}" cy="${-SIZE * 0.8}" r="12" fill="${c}" stroke="#fff" stroke-width="2.5"/><image href="${hs.structure.type}.png" x="${-SIZE * 0.7 - 9}" y="${-SIZE * 0.8 - 9}" width="18" height="18"/></g>`;
  }
  function resChips(hs, cx, cy) {
    const items = Object.entries(hs.res).filter(([, v]) => v > 0), w = 27, x0 = cx - (items.length * w) / 2 + 2;
    return items.map(([k, v], i) => `<g transform="translate(${x0 + i * w} ${cy + SIZE * 0.78})"><rect x="-2" y="-9" width="${w - 2}" height="18" rx="9" fill="#000" fill-opacity=".62"/><image href="${k}.png" width="15" height="15" x="0" y="-7.5"/><text x="16" y="4" class="rc">${v}</text></g>`).join('');
  }
  function unitMarks(st, id, cx, cy, colorOf, me) {
    const us = unitsAt(st, id); let i = 0, out = '';
    for (const [uid, u] of Object.entries(us)) {
      const c = colorOf(uid), mine = uid === me;
      const mk = (shape, unit, label, name) => {
        const x = cx - 21 + (i % 3) * 21, y = cy - 8 + Math.floor(i / 3) * 21; i++;
        const on = mine && ui.selUnit === unit;
        const data = mine ? `data-unit="${unit}" class="unit"` : '';
        const ring = on ? `<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#00f0ff" stroke-width="3.5"/><circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 3"/>` : '';
        const t = `<title>${esc(ctx_names(uid))}の${name}</title>`;
        if (shape === 'c') return `${ring}<circle cx="${x}" cy="${y}" r="11" fill="${c}" stroke="#fff" stroke-width="2" ${data}>${t}</circle><text x="${x}" y="${y + 4.5}" class="ub">${label}</text>`;
        if (shape === 'm') return `${ring}<rect x="${x - 10}" y="${y - 10}" width="20" height="20" rx="3" fill="${c}" stroke="#fff" stroke-width="2" ${data}>${t}</rect><text x="${x}" y="${y + 4.5}" class="ub">${label}</text>`;
        return `${ring}<circle cx="${x}" cy="${y}" r="7" fill="${c}" stroke="#fff" stroke-width="2" ${data}>${t}</circle>`;
      };
      if (u.char) out += mk('c', 'char', '将', 'キャラクター');
      const p = st.players[uid];
      p.mechs.forEach((m, mi) => { if (m.hex === id) out += mk('m', `m${mi}`, 'M', 'メック'); });
      p.workers.forEach((w, wi) => { if (w === id) out += mk('w', `w${wi}`, '', 'ワーカー'); });
    }
    return out;
  }
  let ctx_names = (u) => u;

  function stepsBar(st) {
    const ph = st.turn.phase, pd = st.pending;
    const cur = pd?.type === 'combat' ? 1 : pd ? 2 : { section: 0, top: 1, moving: 1, bottom: 2, end: 3 }[ph] ?? 0;
    const S = ['① セクション選択', '② 上段アクション', '③ 下段アクション', '④ ターン終了'];
    return `<div class="steps">${S.map((x, i) => `<span class="${i === cur ? 'now' : i < cur ? 'done' : ''}">${x}</span>`).join('')}${pd ? `<span class="pend">${{ combat: '戦闘中', encounter: '遭遇', factory: '工場カード選択', free: '無料効果' }[pd.type] || ''}</span>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- パネル
  const nm = (ctx, uid) => esc(ctx.names(uid));
  const sectionLabel = (p, s) => {
    if (s === 'factory') return `工場／移動（${esc(byId(FACTORY_CARDS, p.factory)?.name || '')}）`;
    return `${TOP_NAMES[topOf(p.mat, s)]}／${BOTTOM_NAMES[BOTTOM_ORDER[s]]}`;
  };
  const resSel = (key, val) => `<select data-bind="${key}">${['oil', 'metal', 'wood', 'food'].map((r) => `<option value="${r}" ${r === val ? 'selected' : ''}>${RES_NAMES[r]}</option>`).join('')}</select>`;
  const hexBtn = (label, key, cur) => `<button class="ghost sm" data-act="pick" data-v="${key}">${label}: ${cur ? esc(cur) : '選択'}</button>`;

  function panelAction(ctx) {
    const { st, me } = ctx, p = st.players[me], t = st.turn;
    if (st.over) return resultPanel(ctx);
    const mine = st.turnUid === me;
    if (st.pending?.type === 'combat') return combatPanel(ctx);
    if (!mine) return '';
    if (st.pending?.type === 'encounter') return encounterPanel(ctx);
    if (st.pending?.type === 'free') return freePanel(ctx);
    if (st.pending?.type === 'factory') {
      return `<div class="card"><h2>工場カードを選ぶ（1枚・変更不可）</h2>${st.factoryCandidates.map((id) => {
        const c = byId(FACTORY_CARDS, id); return `<div class="opt facopt"><img src="${c.img}" alt="${esc(c.name)}"><div><b>${esc(c.name)}</b><div class="mute">${esc(c.text)}</div><button data-act="factory-pick" data-v="${id}">これにする</button></div></div>`;
      }).join('')}</div>`;
    }
    if (t.phase === 'section') return '';
    const kindTop = p.section === 'factory' ? 'factory' : topOf(p.mat, p.section);
    if (t.phase === 'top') return `<div class="card"><h2>上段：${TOP_NAMES[kindTop]}</h2>${topForm(ctx, kindTop)}
      <div class="row"><button class="ghost" data-act="top-skip">上段を行わない</button><button class="ghost" data-act="cancel-sec">↩ セクション選択に戻る</button></div></div>`;
    if (t.phase === 'moving') return movingPanel(ctx);
    if (t.phase === 'bottom') {
      const kb = p.section === 'factory' ? 'factoryMove' : BOTTOM_ORDER[p.section];
      return `<div class="card"><h2>下段：${kb === 'factoryMove' ? '移動（1ユニット・最大2回）' : BOTTOM_NAMES[kb]}</h2>${bottomForm(ctx, kb)}
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
    if (kind === 'produce') { const lim = 2 + (p.up.produce || 0); return `<p>生産する領土を最大${lim}か所選んでください（候補が${lim}か所以下なら自動で生産します）</p>
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
  const matWrap = (ctx, inner) => `<div class="matbg" style="background-image:linear-gradient(rgba(12,10,8,.35),rgba(12,10,8,.7)),url(mat_${MAT_IMG[ctx.st.players[ctx.me].mat] || 1}.jpg)">${inner}</div>`;
  const stepsOf = (p, u) => (u[0] === 'w' ? 1 : 1 + (p.mechs.some((m) => MECH_SLOTS[p.faction][m.slot] === 'speed') ? 1 : 0) + (p.up.move || 0));
  function movingPanel(ctx) {
    const { st, me } = ctx, p = st.players[me], mv = st.turn.move;
    const unitName = (u) => (u === 'char' ? 'キャラクター' : u[0] === 'm' ? `メック${+u.slice(1) + 1}` : `ワーカー${+u.slice(1) + 1}`);
    const here = (u) => (u === 'char' ? p.char : u[0] === 'm' ? p.mechs[+u.slice(1)].hex : p.workers[+u.slice(1)]);
    const units = ['char', ...p.mechs.map((_, i) => `m${i}`), ...p.workers.map((_, i) => `w${i}`)];
    const done = mv.kind === 'move' ? mv.moved : [];
    return `<div class="card"><h2>移動中（あと${mv.left}体まで）</h2>
      <p class="mute">動かすユニットを選び、黄色の領土をクリック。盤面上の自分のユニットをクリックしても選べます。</p>
      <label class="chk"><input type="checkbox" data-bind="carry" ${ui.carry ? 'checked' : ''}> 出発地の資源をすべて運ぶ</label>
      <div class="units">${units.map((u) => `<button class="sm ${ui.selUnit === u ? '' : 'ghost'}" data-act="unit" data-v="${u}" ${done.includes(u) ? 'disabled' : ''}>${unitName(u)} @${here(u)}（${stepsOf(p, u)}マス）</button>`).join('')}</div>
      <div class="row"><button data-act="endMove">移動を終える</button></div></div>`;
  }

  const topOpts = (p, cur) => Object.keys(TOP_CUBES).filter((t) => (p.up[t] || 0) < TOP_CUBES[t]).map((t) => `<option value="${t}" ${cur === t ? 'selected' : ''}>${TOP_NAMES[t]}の強化</option>`).join('');
  function bottomForm(ctx, kind) {
    const { st, me } = ctx, p = st.players[me], m = BASE_MATS[p.mat];
    if (kind === 'factoryMove') return `<div class="row"><button data-act="bot-factory">移動を始める</button></div>`;
    const cost = Math.max(0, m.lower[kind][0] - p.red[kind]);
    const head = `<p>コスト：${RES_NAMES[BOTTOM_RES[kind]]} ${cost}（持っている${RES_NAMES[BOTTOM_RES[kind]]} ${resTotals(st, me)[BOTTOM_RES[kind]]}）／ 報酬：${m.lower[kind][2]}コイン</p>`;
    const b = ui.bot;
    if (kind === 'upgrade') {
      const opts = BOTTOM_ORDER.filter((s) => p.red[s] < m.lower[s][1]);
      return head + `<div class="row">上段から取る <select data-bind="bot.top">${topOpts(p, b.top)}</select> 下段に置く <select data-bind="bot.slot">${opts.map((s) => `<option value="${s}" ${b.slot === s ? 'selected' : ''}>${BOTTOM_NAMES[s]}のコスト-1</option>`).join('')}</select><button data-act="bot-go">改良する</button></div>`;
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
    return head + `<div class="row">徴兵トークンの取得元 <select data-bind="bot.from">${fromFree.map((s) => `<option value="${s}" ${b.from === s ? 'selected' : ''}>${BOTTOM_NAMES[s]}</option>`).join('')}</select> 一時ボーナス <select data-bind="bot.bonus">${bonFree.map((x) => `<option value="${x}" ${b.bonus === x ? 'selected' : ''}>${BN[x]}</option>`).join('')}</select><button data-act="bot-go">徴兵する</button></div>`;
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
      body = `上段から取る <select data-bind="free.top">${topOpts(p, f.top)}</select> 下段に置く <select data-bind="free.slot">${opts.map((s) => `<option value="${s}" ${f.slot === s ? 'selected' : ''}>${BOTTOM_NAMES[s]}のコスト-1</option>`).join('')}</select>`;
    } else if (k === 'enlist') {
      const fromFree = BOTTOM_ORDER.filter((s) => !p.recruits.some((r) => r.section === s));
      const bonFree = RECRUIT_ONETIME.filter((x) => !p.recruits.some((r) => r.bonus === x));
      const BN = { power: '戦力+2', coins: 'コイン+2', pop: '支持+2', card: '戦闘カード+2' };
      body = `取得元 <select data-bind="free.from">${fromFree.map((s) => `<option value="${s}" ${f.from === s ? 'selected' : ''}>${BOTTOM_NAMES[s]}</option>`).join('')}</select> 一時ボーナス <select data-bind="free.bonus">${bonFree.map((x) => `<option value="${x}" ${f.bonus === x ? 'selected' : ''}>${BN[x]}</option>`).join('')}</select>`;
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

  const II = (n, t) => `<img class="ri" src="${n}.png" title="${t}" alt="${t}">`;
  const ICO = { coins: II('coin', 'コイン'), power: II('power', '戦力'), pop: II('pop', '支持'), star: II('star', '星'), card: '<span class="ic" title="戦闘カード">🂠</span>', worker: II('people', 'ワーカー'), mech: '<span class="ic" title="メック">▣</span>' };
  const FACE = (f, n = 26) => `<img class="face" style="width:${n}px;height:${n}px" src="faction_${f}.jpg" alt="">`;
  function comparePanel(ctx) {
    const { st } = ctx;
    const rows = [[ICO.pop, (p) => p.pop, 18], [ICO.power, (p) => p.power, 16], [ICO.star, (p) => p.stars.length, 6], [ICO.coins, (p) => p.coins, Math.max(20, ...Object.values(st.players).map((p) => p.coins))]];
    return `<div class="card"><h2>プレイヤー比較</h2>${st.order.map((u, i) => `<span class="legend">${FACE(st.players[u].faction, 22)}<i style="background:${COLORS[i]}"></i>${nm(ctx, u)}（${BASE_FACTIONS[st.players[u].faction].name}）</span>`).join('')}
      ${rows.map(([lab, f, mx]) => `<div class="cmp"><b class="cl">${lab}</b>${st.order.map((u, i) => { const v = f(st.players[u]); return `<div class="bar"><span class="fill" style="width:${Math.max(3, (v / mx) * 100)}%;background:${COLORS[i]}"></span><span class="val">${FACE(st.players[u].faction, 18)} ${v}</span></div>`; }).join('')}</div>`).join('')}</div>`;
  }

  const RESIMG = (r) => `<img class="ri" src="${r}.png" alt="${RES_NAMES[r]}">`;
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
    return `<div class="mat fmat" style="background-image:linear-gradient(rgba(10,8,6,.55),rgba(10,8,6,.88)),url(faction_${f}.jpg)">
      <div class="mh"><b>${F.name}</b> <span class="pas">固有：${PASSIVE[f][0]}</span> <span class="mute">${PASSIVE[f][1]}</span></div>
      <div class="chips2"><span>${ICO.power}<b>${p.power}</b></span><span>${ICO.pop}<b>${p.pop}</b></span><span>${ICO.coins}<b>${p.coins}</b></span><span>${ICO.star}<b>${p.stars.length}/6</b></span><span>${ICO.card}<b>${hand.join(',') || '-'}</b></span><span>${ICO.worker}<b>${p.workers.length}+${p.matWorkers}</b></span><span>${ICO.mech}<b>${p.mechs.length}/4</b></span>${['oil','metal','wood','food'].map((r) => `<span>${RESIMG(r)}<b>${resTotals(st, me)[r]}</b></span>`).join('')}</div>
      <div class="slots">${slots}</div>
      <div class="mute small">メックを配備するとき、解放する能力を上から選べます（キャラクターと全メックに適用）。</div></div>`;
  }

  // 行動マット（16:9・マットの絵が背景）。セクション選択もここで行う
  function actionMat(ctx) {
    const { st, me } = ctx, p = st.players[me], m = BASE_MATS[p.mat];
    const pick = st.turnUid === me && st.turn.phase === 'section' && !st.pending;
    const ok = pick ? legalSections(st, me) : [];
    const cols = [0, 1, 2, 3].map((s) => {
      const top = topOf(p.mat, s), sk = structOf(p.mat, s), bk = BOTTOM_ORDER[s], [base, maxRed, coin] = m.lower[bk];
      const cost = Math.max(0, base - p.red[bk]), built = p.structures.some((x) => x.type === sk);
      const cur = p.section === s;
      return `<${pick ? 'button' : 'div'} class="acol ${cur ? 'cur' : ''} ${pick && ok.includes(s) ? 'can' : ''}" ${pick ? `data-act="section" data-v="${s}" ${ok.includes(s) ? '' : 'disabled'}` : ''}>
        <div class="at"><b>${TOP_NAMES[top]}</b><span class="cubes" title="上段の改良キューブ（取ると強化）">${top === 'move' || TOP_CUBES[top] ? Array.from({ length: TOP_CUBES[top] || 0 }, (_, i) => `<i class="cube ${i < (p.up[top] || 0) ? 'gone' : ''}"></i>`).join('') : ''}${p.up[top] ? `<em>強化+${p.up[top]}</em>` : ''}</span><small>${TOP_TEXT[top]}</small>${top === 'produce' ? `<small class="pv">${prodPreview(ctx)}</small>` : ''}</div>
        <div class="as ${built ? 'built' : ''}"><img class="ri" src="${sk}.png" alt="">${STRUCT_NAMES[sk]}${built ? '（建設済・効果発動中）' : '（未建設）'}<small>${STRUCT_TEXT[sk]}</small></div>
        <div class="ab"><b>${BOTTOM_NAMES[bk]}</b><small>${BOTTOM_TEXT[bk]}</small>
          <span class="cost">${RESIMG(BOTTOM_RES[bk])}×${cost}${p.red[bk] ? ` <i>(基本${base}−${p.red[bk]})</i>` : ''}</span>
          <span class="cubes" title="下段のキューブ枠（埋めるとコスト-1）">${Array.from({ length: maxRed }, (_, i) => `<i class="cube slot ${i < p.red[bk] ? 'fill' : ''}"></i>`).join('')}</span><small>報酬 ${ICO.coins}${coin}</small></div></${pick ? 'button' : 'div'}>`;
    }).join('');
    return `<div class="mat amat" style="background-image:linear-gradient(rgba(10,8,6,.5),rgba(10,8,6,.85)),url(mat_${MAT_IMG[p.mat] || 1}.jpg)">
      <div class="mh"><b>${m.name}マット</b> <span class="mute">改良 ${p.cubes}/6 ・ 徴兵 ${p.recruits.length}/4 ・ 建物 ${p.structures.length}/4${pick ? ' ・ <b class="hint">列をクリックして今回のセクションを選ぶ</b>' : ''}</span></div>
      <div class="acols">${cols}</div></div>`;
  }

  function modalHtml(ctx) {
    const { st } = ctx;
    const inner = panelAction(ctx);
    if (!inner) return '';
    if (st.over) return `<div class="modal wide">${inner}</div>`;
    return `<div class="modal">${matWrap(ctx, inner)}</div>`;
  }
  function objBox(ctx) {
    const { st, me, priv } = ctx, p = st.players[me];
    const list = (priv?.objectives || []).map((id) => byId(OBJECTIVES, id)).filter(Boolean);
    const bt = byId(BONUS_TILES, st.bonusTile);
    if (!ui.objOpen) return `<div class="objbox shut"><button class="ghost sm" data-act="objtoggle">目的カード ${list.length}枚 ▼</button></div>`;
    return `<div class="objbox"><button class="ghost sm fold" data-act="objtoggle">▲ たたむ</button><b>目的カード</b>${list.length ? list.map((o) => `<div class="ob"><b>${esc(o.name)}</b><span>${esc(o.text)}</span></div>`).join('') : '<div class="ob mute">なし</div>'}${p.stars.includes('objective') ? '<div class="ob">★ 目的の星を獲得済み</div>' : ''}<div class="ob bt"><b>建物ボーナス</b><span>${esc(bt?.text || '')}</span></div></div>`;
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
        <span class="tools"><button class="ghost sm ${ui.resMode ? 'on' : ''}" data-act="resmode">${ui.resMode ? '通常マップに戻す' : '取れる資源を表示'}</button>${mine ? `<button class="endbtn" data-act="endTurn" ${st.pending ? 'disabled' : ''}>ターン終了</button>` : ''}<button class="ghost sm" data-act="zoom-">−</button><button class="ghost sm" data-act="zoom+">＋</button>
        <label class="chk"><input type="checkbox" data-bind="sound" ${ui.sound ? 'checked' : ''}> 効果音</label></span></div>
      ${st.over ? '' : stepsBar(st)}
      <div class="game"><div class="boardwrap" id="boardwrap">${boardSVG(ctx)}${objBox(ctx)}</div>
      <div class="mats2">${st.over ? '' : `${factionMat(ctx)}${actionMat(ctx)}`}</div></div>
      <div class="below">${comparePanel(ctx)}${hexPanel(ctx)}${logPanel(ctx)}</div>${modalHtml(ctx)}`;
    root.querySelectorAll('select[data-bind]').forEach((el) => setPath(el.dataset.bind, el.value));
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
      if (h.k === 'produce') { const ph = producibleHexes(st, me); return ph.length <= 2 + (p.up.produce || 0) ? once(`fp${sig}`, { t: 'free', kind: 'produce', hexes: ph }) : null; }
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
        return topOk || (sec !== 'factory' && canDo(st, me, BOTTOM_ORDER[sec]));
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
    if (t.phase === 'top') {
      const kind = p.section === 'factory' ? 'factory' : topOf(p.mat, p.section);
      if (kind === 'produce') { const ph = producibleHexes(st, me); if (!ph.length) return once(`pr${sig}`, { t: 'top', kind: 'skip' }); return ph.length <= 2 + (p.up.produce || 0) ? once(`pr${sig}`, { t: 'top', kind: 'produce', hexes: ph }) : null; }
      if ((kind === 'bolster' || kind === 'trade') && !canDo(st, me, kind)) return once(`ts${sig}`, { t: 'top', kind: 'skip' });
      if (kind === 'factory') { const c = byId(FACTORY_CARDS, p.factory), { card = 0, anyRes = 0, diff, ...rest } = c.cost; if (p.hand < card || !canPay(st, me, rest)) return once(`fk${sig}`, { t: 'top', kind: 'skip' }); }
    }
    if (t.phase === 'moving' && t.move) {
      const units = ['char', ...p.mechs.map((_, i) => `m${i}`), ...p.workers.map((_, i) => `w${i}`)].filter((u) => !(t.move.kind === 'move' && t.move.moved.includes(u)));
      if (!units.some((u) => moveTargets(st, me, u).length)) return once(`mv${sig}`, { t: 'endMove' });
    }
    if (t.phase === 'bottom' && p.section !== 'factory') {
      if (!canDo(st, me, BOTTOM_ORDER[p.section])) return once(`bt${sig}`, { t: 'bottom', kind: 'skip' });
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
      if (a) { busy.add('auto'); await guard(() => net().dispatch(a)); busy.delete('auto'); return; }
    }
    const pd = st.pending;
    if (pd?.type === 'encounter' && !pd.cardId && st.turnUid === me && !busy.has('enc')) {
      busy.add('enc'); await guard(() => net().drawEncounter()); busy.delete('enc');
    }
    if (pd?.type === 'combat' && (me === pd.attacker || me === pd.defender)) {
      const both = combat?.commits && Object.keys(combat.commits).length >= 2;
      if (both && !combat.reveals?.[me] && !busy.has(`rv${pd.key}`)) {
        busy.add(`rv${pd.key}`); await guard(() => net().revealCombat(pd.key));
      }
      if (me === pd.attacker && combat?.reveals && Object.keys(combat.reveals).length >= 2 && !busy.has(`rs${pd.key}`)) {
        busy.add(`rs${pd.key}`);
        const a = await net().verifyReveal(pd.key, pd.attacker, combat), d = await net().verifyReveal(pd.key, pd.defender, combat);
        if (!a || !d) { toast('戦力の公開内容が確定時と一致しません'); busy.delete(`rs${pd.key}`); return; }
        await guard(() => net().dispatch({ t: 'combat', att: a, def: d }));
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
    const allow = mv.kind === 'factoryMove' ? (mv.idx === 0 && unit[0] !== 'w' && st.players[me].mechs.some((m) => MECH_SLOTS[st.players[me].faction][m.slot] === 'speed') ? 2 : 1) : undefined;
    ui.targets = moveTargets(st, me, unit, allow);
    render();
  }

  function onHex(ctx, id) {
    const { st, me } = ctx;
    if (ui.pick && st.turn.phase === 'moving' && !st.pending) ui.pick = null;
    if (ui.pick) {
      const { key } = ui.pick;
      if (!ui.pick.ok(id)) { toast('そこは選べません'); return; }
      if (key === 'produce') { if (!ui.produce.includes(id)) ui.produce = [...ui.produce, id].slice(-2); else ui.produce = ui.produce.filter((x) => x !== id); }
      else if (key === 'trade.hex') ui.trade.hex = id;
      else if (key === 'fac.hex') ui.fac.hex = id;
      else if (key === 'bot.hex') ui.bot.hex = id;
      else if (key === 'free.hex') ui.free.hex = id;
      if (key !== 'produce') ui.pick = null;
      render(); return;
    }
    if (st.turn.phase === 'moving' && ui.selUnit && ui.targets.some((t) => t.to === id)) {
      const unit = ui.selUnit;
      let carry;
      if (ui.carry) { const from = st.turn.move && (unit === 'char' ? st.players[me].char : unit[0] === 'm' ? st.players[me].mechs[+unit.slice(1)].hex : st.players[me].workers[+unit.slice(1)]); carry = { ...st.hexes[from].res }; }
      ui.selUnit = null; ui.targets = [];
      act({ t: 'move', unit, to: id, carry });
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
