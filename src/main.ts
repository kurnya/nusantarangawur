import './style.css';
import type { GameState } from './engine/types';
import { LocalGame } from './game/local';
import type { OnlineGame } from './game/online';
import { Presenter } from './game/presenter';
import type { ClientIntent } from './net/protocol';
import { codeFromHash, isRoomCode, normalizeCode } from './net/room';
import { $, el } from './ui/dom';
import { setupFxPanel } from './ui/fxpanel';
import { Hud } from './ui/hud';
import { hideMenu, savedName, showMenu } from './ui/lobby';
import { setupScreen } from './ui/setup';
import { openTile } from './ui/tileInfo';
import { loadQualityPref, resolveQuality } from './view/quality';
import { GameView } from './view/scene';

const params = new URLSearchParams(location.search);
/** ?fast=1 melewati animasi (untuk tes) */
const fast = params.get('fast') === '1';
/** ?low=1 paksa kualitas rendah; selain itu pilihan pemain (bawaan otomatis) */
const qualityPref = loadQualityPref();
const quality = resolveQuality(qualityPref, params.get('low') === '1');
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
    roll: () => game?.act({ t: 'roll' }),
    buy: () => game?.act({ t: 'buy' }),
    build: (tile) => game?.act({ t: 'build', tile }),
    endTurn: () => game?.act({ t: 'endTurn' }),
    payJail: () => game?.act({ t: 'payJail' }),
  },
  reducedMotion,
);

// diisi setelah view dibuat; view memanggil getState() saat membangun petak
const ref: { presenter?: Presenter } = {};
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
    dynamicResolution: qualityPref === 'auto' && params.get('low') !== '1',
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
$('#camLog').onclick = () => hud.toggleLog(pov());
$('#logClose').onclick = () => hud.toggleLog(pov());
$('#endGame').onclick = () => void game?.askEndGame();
hud.renderWx('cerah');

/* ---------- mode ---------- */

function startLocal(): void {
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
  create: (name: string) => void makeOnline().then((o) => o.create(name)),
  join: (name: string, code: string) => void makeOnline().then((o) => o.join(name, code)),
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
