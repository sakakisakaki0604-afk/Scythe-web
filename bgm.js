// BGM（YouTube埋め込み）。トラックリストの開始時刻へシークして曲を選べる。既定は先頭から順に通し再生。
const VIDEO = 'M3Gz4ih2HNE';
export const TRACKS = [
  ['turning the tables', 0], ['The Destiny Reverser', 79], ['The Lights of Revival', 303], ['Heartbeat of Reversal', 482], ['will to stand up', 657],
  ['Revived fighting spirit', 767], ['Counterattack of Heaven\'s Fate', 875], ['furious attack', 1049], ['Overture of Counterattack', 1121],
  ['the recovery of lost ground', 1280], ['Rebellion out of Despair', 1422], ['Inversion melody', 1501], ['Capsizing Fate', 1588], ['Beyond Adversity', 1648],
  ['Overturned winners and losers', 1830], ['Reverse of light', 1993], ['Turn of Revenge', 2108], ['Reversal to Hope', 2232], ['Backwash to Victory', 2402],
  ['whirlwind of victory', 2573], ['Striking Back from Ruin', 2695], ['Last counter', 2813], ['Rebuilding Destiny', 2982], ['The Last Counterattack', 3177],
  ['reversal blow', 3426], ['Aftermath of Victory', 3762], ['continue walking', 3840],
];
const KEY = 'scythe_bgm';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* 無視 */ } };

export function initBgm() {
  const cfg = { on: false, vol: 40, ...load() };
  let player = null, ready = false, cur = 0, timer = null;
  const box = document.createElement('div'); box.id = 'bgm';
  box.innerHTML = `<button id="bgmT" class="ghost sm" title="BGM">♪ BGM</button>
    <div id="bgmP" hidden>
      <div class="row"><button id="bgmPlay" class="sm">▶ 再生</button><button id="bgmPrev" class="ghost sm">⏮</button><button id="bgmNext" class="ghost sm">⏭</button></div>
      <select id="bgmSel">${TRACKS.map((t, i) => `<option value="${i}">${i + 1}. ${t[0]}</option>`).join('')}</select>
      <label class="mute">音量 <input id="bgmVol" type="range" min="0" max="100" value="${cfg.vol}"></label>
      <div class="mute" id="bgmNow"></div><div id="bgmYT"></div>
    </div>`;
  document.body.append(box);
  const $ = (id) => box.querySelector('#' + id);
  const now = () => { $('bgmNow').textContent = `♪ ${cur + 1}. ${TRACKS[cur][0]}`; $('bgmSel').value = String(cur); };
  const trackAt = (s) => { let i = 0; TRACKS.forEach((t, k) => { if (s >= t[1]) i = k; }); return i; };
  function create() {
    if (player) return;
    const mk = () => { player = new window.YT.Player('bgmYT', { height: '90', width: '160', videoId: VIDEO, playerVars: { controls: 0, rel: 0, playsinline: 1 }, events: {
      onReady: () => { ready = true; player.setVolume(cfg.vol); },
      onStateChange: (e) => { $('bgmPlay').textContent = e.data === 1 ? '⏸ 停止' : '▶ 再生'; },
    } }); };
    if (window.YT?.Player) mk(); else { window.onYouTubeIframeAPIReady = mk; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.append(s); }
    timer = setInterval(() => { if (ready && player.getPlayerState?.() === 1) { const i = trackAt(player.getCurrentTime()); if (i !== cur) { cur = i; now(); } } }, 1000);
  }
  const play = (i) => { create(); const go = () => { if (i != null) { cur = i; player.seekTo(TRACKS[i][1], true); } player.playVideo(); cfg.on = true; save(cfg); now(); }; if (ready) go(); else { const w = setInterval(() => { if (ready) { clearInterval(w); go(); } }, 200); } };
  $('bgmT').onclick = () => { $('bgmP').hidden = !$('bgmP').hidden; };
  $('bgmPlay').onclick = () => { if (ready && player.getPlayerState() === 1) { player.pauseVideo(); cfg.on = false; save(cfg); } else play(); };
  $('bgmSel').onchange = (e) => play(+e.target.value);
  $('bgmPrev').onclick = () => play((cur + TRACKS.length - 1) % TRACKS.length);
  $('bgmNext').onclick = () => play((cur + 1) % TRACKS.length);
  $('bgmVol').oninput = (e) => { cfg.vol = +e.target.value; save(cfg); if (ready) player.setVolume(cfg.vol); };
  now();
  // ブラウザの自動再生制限のため、前回ONなら最初のクリックで再生を始める
  if (cfg.on) window.addEventListener('pointerdown', () => play(), { once: true });
}
