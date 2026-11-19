import './style.css';
import './ui-friendly.css';
import './dice.css';
import { audio, startAudio } from './audio';
import type { GameState } from './engine/types';
import { LocalGame } from './game/local';
import type { OnlineGame } from './game/online';
import { Presenter } from './game/presenter';
import type { ClientIntent } from './net/protocol';
import { codeFromHash, isRoomCode, normalizeCode } from './net/room';
import { $, el } from './ui/dom';
import { AssetPanel } from './ui/assets';
import { setupFxPanel } from './ui/fxpanel';
import { Hud } from './ui/hud';
import { hideMenu, savedName, showMenu } from './ui/lobby';
import { setupScreen } from './ui/setup';
import { openTile } from './ui/tileInfo';
import {
  loadGraphicsPrefs,
  resolveFps,
  resolveQuality,
  saveGraphicsPrefs,
  type FpsPref,
  type QualityPref,
} from './view/quality';
import { MOBILE_QUERY } from './view/camera';
import { GameView } from './view/scene';

const params = new URLSearchParams(location.search);
/** ?fast=1 melewati animasi (untuk tes) */
const fast = params.get('fast') === '1';
/** ?low=1 paksa kualitas rendah; selain itu pilihan pemain (bawaan otomatis) */
const graphicsPrefs = loadGraphicsPrefs();
const quality = resolveQuality(graphicsPrefs.quality, params.get('low') === '1');
/** ?dev=1 menampilkan alat pengembang (panel Uji animasi) */
const dev = params.get('dev') === '1';
/** ?net=tab: transport antar tab (tes/pengembangan); bawaan PeerJS */
const netTab = params.get('net') === 'tab';
const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Permainan yang sedang aktif: satu perangkat atau online. */
interface ActiveGame {
  readonly state: GameState | null;
  readonly playing: boolean;
  act(i: ClientIntent): void;
  askEndGame(): Promise<void>;
}

let game: ActiveGame | null = null;
let online: OnlineGame | null = null;
/** id pemain pemilik layar: online = pemain ini, satu perangkat = pemain yang sedang giliran */
const pov = () => (online ? (online.me ?? 0) : (game?.state?.turn ?? 0));

const hud = new Hud(
  fast,
  {
    roll: () => {
      startAudio();
      audio.play('dice');
      game?.act({ t: 'roll' });
    },
    buy: () => {
      startAudio();
      audio.play('buy');
      game?.act({ t: 'buy' });
    },
    build: (tile) => {
      startAudio();
      audio.play('build');
      game?.act({ t: 'build', tile });
    },
    endTurn: () => {
      startAudio();
      audio.play('turn');
      game?.act({ t: 'endTurn' });
    },
    payJail: () => {
      startAudio();
      audio.play('spend');
      game?.act({ t: 'payJail' });
    },
    assets: () => assetPanel.toggle(),
  },
  reducedMotion,
);

/* pilihan dadu: satu perangkat = per pemain (disimpan di perangkat), online = diumumkan lewat Host */
const DICE_LS = 'ng_dice_hotseat';
const diceHot: Record<number, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem(DICE_LS) || '{}') as Record<number, number>;
  } catch {
    return {};
  }
})();
hud.diceApi = {
  skin: (pid) => (online ? online.diceOf(pid) : (diceHot[pid] ?? pid % 8)),
  pick: (pid, k) => {
    if (online) online.setDice(k);
    else {
      diceHot[pid] = k;
      try {
        localStorage.setItem(DICE_LS, JSON.stringify(diceHot));
      } catch {
        /* penyimpanan tidak tersedia */
      }
    }
  },
};

// diisi setelah view dibuat; view memanggil getState() saat membangun petak
const ref: { presenter?: Presenter } = {};
const assetPanel = new AssetPanel({
  state: () => game?.state ?? null,
  pov,
  act: (i) => game?.act(i),
  // mode satu perangkat: aksi menunggu animasi selesai; online: kapan saja
  blocked: () => (!online && game?.playing ? 'Tunggu animasi selesai.' : null),
});
const getState = () => ref.presenter?.disp ?? game?.state ?? null;

function onTile(i: number): void {
  const s = getState();
  if (!s || !game) return;
  void openTile(hud, s, i, pov(), !game.playing).then((build) => {
    if (build) game?.act({ t: 'build', tile: i });
  });
}

let view: GameView | null = null;
try {
  view = new GameView({
    stage: $('#stage'),
    getState,
    quality,
    fps: resolveFps(graphicsPrefs.fps, quality),
    dynamicResolution: graphicsPrefs.quality === 'auto' && params.get('low') !== '1',
    fast,
    reducedMotion,
    onTileClick: (i) => onTile(i),
  });
} catch (err) {
  console.error(err);
  $('#stage').appendChild(
    el(
      'div',
      'nogl',
      'Browser ini tidak mendukung WebGL. Coba browser lain atau aktifkan akselerasi grafis.',
    ),
  );
}

const presenter = new Presenter({
  hud,
  view,
  fast,
  pov,
  me: () => (online ? online.me : null),
  waitNote: () => online?.waitNote(),
});
ref.presenter = presenter;

if (view) {
  const v = view;
  if (dev)
    setupFxPanel(v, hud, () => {
      const s = game?.state;
      if (!s) return null;
      const p = s.players[s.turn];
      return p ? { tile: p.pos, pid: p.id, busy: !!game?.playing } : null;
    });
  if (!dev) $('#camFx').hidden = true;
  $('#camFocus').onclick = () => {
    const s = getState();
    const p = s?.players[s.turn];
    if (p) v.focusPawn(p.pos);
  };
  $('#camMap').onclick = () => v.overview();
  $('#camTilt').onclick = () => v.toggleTilt();
  $('#camL').onclick = () => v.rotate(-1);
  $('#camR').onclick = () => v.rotate(1);
  $('#camIn').onclick = () => v.zoom(1 / 1.25);
  $('#camOut').onclick = () => v.zoom(1.25);
  $('#camWeather').onclick = () => {
    // mode online: hanya Host, berlaku untuk semua layar
    if (online) {
      online.toggleWeather();
      return;
    }
    $('#camWeather').textContent = v.toggleWeather() ? 'Cuaca: hidup' : 'Cuaca: mati';
  };
}
/* ---------- mode HP: papan penuh layar, tombol kamera dilipat ke menu ---------- */
const mobMq = window.matchMedia?.(MOBILE_QUERY);
const applyMob = () => document.documentElement.classList.toggle('mob', !!mobMq?.matches);
mobMq?.addEventListener?.('change', applyMob);
applyMob();
const camPanel = $('#camMenuPanel');
const mobMenu = $('#mobMenu');
const setMenu = (open: boolean) => {
  camPanel.classList.toggle('open', open);
  mobMenu.setAttribute('aria-expanded', String(open));
};
mobMenu.onclick = () => setMenu(!camPanel.classList.contains('open'));
// tombol zoom/putar tetap membiarkan menu terbuka; lainnya menutupnya
camPanel.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b && !['camL', 'camR', 'camIn', 'camOut'].includes(b.id)) setMenu(false);
});
/* menu "Lainnya" (desktop dan tablet): fitur jarang dipakai dilipat agar toolbar tidak padat */
const camMore = $('#camMore');
const morePanel = $('#camMorePanel');
const setMore = (open: boolean) => {
  morePanel.classList.toggle('open', open);
  camMore.setAttribute('aria-expanded', String(open));
};
camMore.onclick = () => setMore(!morePanel.classList.contains('open'));
morePanel.addEventListener('click', () => setMore(false));
document.addEventListener('pointerdown', (e) => {
  if (!morePanel.contains(e.target as Node) && e.target !== camMore) setMore(false);
});
/* pintasan keyboard: Spasi = lempar dadu, Esc = tutup menu kecil */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    setMore(false);
    return;
  }
  if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (document.activeElement?.tagName ?? '').toLowerCase();
  if (['input', 'select', 'textarea', 'button', 'summary', 'a'].includes(tag)) return;
  if (document.querySelector('.overlay:not(.hidden)')) return;
  const go = document.querySelector<HTMLButtonElement>('#acts .btn.pri:not(:disabled)');
  if (go) {
    e.preventDefault();
    go.click();
  }
});
$('#mobFocus').onclick = () => $('#camFocus').click();
$('#mobAssets').onclick = () => $('#camAssets').click();

$('#camLog').onclick = () => hud.toggleLog(pov());
$('#camAssets').onclick = () => assetPanel.toggle();
$('#logClose').onclick = () => hud.toggleLog(pov());
$('#endGame').onclick = () => void game?.askEndGame();

const graphicsPanel = $('#graphicsPanel');
const gQuality = $('#gQuality') as HTMLSelectElement;
const gFps = $('#gFps') as HTMLSelectElement;
const gApply = $('#gApply');
const gSfx = $('#gSfx') as HTMLInputElement;
const gAmb = $('#gAmb') as HTMLInputElement;
const gMute = $('#gMute') as HTMLInputElement;
gQuality.value = graphicsPrefs.quality;
gFps.value = graphicsPrefs.fps;
gSfx.value = String(audio.st.sfx);
gAmb.value = String(audio.st.amb);
gMute.checked = audio.st.mute;
$('#camSettings').onclick = () => graphicsPanel.classList.toggle('open');
gApply.onclick = () => {
  const next = {
    quality: gQuality.value as QualityPref,
    fps: gFps.value as FpsPref,
  };
  saveGraphicsPrefs(next);
  const q = resolveQuality(next.quality, params.get('low') === '1');
  view?.setGraphics(
    q,
    resolveFps(next.fps, q),
    next.quality === 'auto' && params.get('low') !== '1',
  );
  startAudio();
  audio.vol('sfx', Number(gSfx.value));
  audio.vol('amb', Number(gAmb.value));
  audio.mute(gMute.checked);
  graphicsPanel.classList.remove('open');
  hud.toast('Pengaturan grafik diterapkan');
};

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  if (!document.documentElement.requestFullscreen) return;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // iOS Safari tidak menyediakan Fullscreen API untuk halaman biasa.
  }
}

function updateFullscreenButton(): void {
  const button = $('#camFullscreen');
  button.textContent = document.fullscreenElement ? 'Keluar layar penuh' : 'Layar penuh';
  button.title = document.fullscreenElement
    ? 'Keluar dari layar penuh'
    : 'Gunakan layar penuh (iPhone: tambahkan ke Home Screen)';
}

$('#camFullscreen').onclick = () => void toggleFullscreen();
document.addEventListener('fullscreenchange', updateFullscreenButton);
updateFullscreenButton();
hud.renderWx('cerah');

/* ---------- mode ---------- */

function startLocal(): void {
  startAudio();
  $('#endGame').hidden = false;
  void toggleFullscreen();
  hideMenu();
  const local = new LocalGame({
    hud,
    view,
    presenter,
    weatherScale: Number(params.get('wx') ?? 1) || 1,
  });
  game = local;
  $('#setup').classList.remove('hidden');
  setupScreen((players) => local.start(players));
}

/** Modul online (PeerJS, zod) dimuat hanya saat dibutuhkan supaya mode satu perangkat ringan. */
async function makeOnline(): Promise<OnlineGame> {
  const [{ OnlineGame }, transport] = await Promise.all([
    import('./game/online'),
    netTab
      ? import('./net/bc').then((m) => new m.TabTransport())
      : import('./net/peer').then((m) => new m.PeerTransport(params.get('relay') === '1')),
  ]);
  const o = new OnlineGame({ hud, view, presenter, transport, toMenu });
  online = o;
  game = o;
  return o;
}

function toMenu(error?: string, code?: string): void {
  online = null;
  game = null;
  history.replaceState(null, '', location.pathname + location.search);
  showMenu(menuActions, { error, code });
}

const menuActions = {
  create: (name: string) => {
    startAudio();
    void toggleFullscreen();
    void makeOnline().then((o) => o.create(name));
  },
  join: (name: string, code: string) => {
    startAudio();
    void toggleFullscreen();
    void makeOnline().then((o) => o.join(name, code));
  },
  local: startLocal,
};

const hostMatch = /^#\/host\/([A-Za-z0-9]{5})$/.exec(location.hash);
const joinCode = codeFromHash(location.hash);
if (params.get('mode') === 'local') startLocal();
else if (hostMatch && isRoomCode(normalizeCode(hostMatch[1]!)))
  void makeOnline().then((o) => o.resumeHost(normalizeCode(hostMatch[1]!), savedName()));
else if (joinCode) void makeOnline().then((o) => o.join(savedName() || 'Pemain', joinCode));
else showMenu(menuActions);

// kait untuk tes otomatis
declare global {
  interface Window {
    __nn?: {
      readonly game: ActiveGame | null;
      readonly online: OnlineGame | null;
      view: GameView | null;
      hud: Hud;
      presenter: Presenter;
      openTile: (i: number) => void;
    };
  }
}
window.__nn = {
  get game() {
    return game;
  },
  get online() {
    return online;
  },
  view,
  hud,
  presenter,
  openTile: onTile,
};
