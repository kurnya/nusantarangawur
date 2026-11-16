import './style.css';
import { LocalGame } from './game/local';
import { Presenter } from './game/presenter';
import { $, el } from './ui/dom';
import { setupFxPanel } from './ui/fxpanel';
import { Hud } from './ui/hud';
import { setupScreen } from './ui/setup';
import { openTile } from './ui/tileInfo';
import { GameView } from './view/scene';

const params = new URLSearchParams(location.search);
/** ?fast=1 melewati animasi (untuk tes) */
const fast = params.get('fast') === '1';
/** ?low=1 mode kualitas rendah */
const lowQuality = params.get('low') === '1';

let game: LocalGame | null = null;
const pov = () => game?.state?.turn ?? 0;

const hud = new Hud(fast, {
  roll: () => game?.act({ t: 'roll' }),
  buy: () => game?.act({ t: 'buy' }),
  build: (tile) => game?.act({ t: 'build', tile }),
  endTurn: () => game?.act({ t: 'endTurn' }),
  payJail: () => game?.act({ t: 'payJail' }),
});

// diisi setelah view dibuat; view memanggil getState() saat membangun petak
const ref: { presenter?: Presenter } = {};
const getState = () => ref.presenter?.disp ?? game?.state ?? null;

let view: GameView | null = null;
try {
  view = new GameView({
    stage: $('#stage'),
    getState,
    lowQuality,
    fast,
    onTileClick: (i) => {
      const s = getState();
      if (!s || !game) return;
      void openTile(hud, s, i, pov(), !game.playing).then((build) => {
        if (build) game?.act({ t: 'build', tile: i });
      });
    },
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

const presenter = new Presenter({ hud, view, fast, pov, cardWait: 'click' });
ref.presenter = presenter;
game = new LocalGame({ hud, view, presenter, weatherScale: Number(params.get('wx') ?? 1) || 1 });

if (view) {
  const v = view;
  setupFxPanel(v, hud, () => {
    const s = game?.state;
    if (!s) return null;
    const p = s.players[s.turn];
    return p ? { tile: p.pos, pid: p.id, busy: !!game?.playing } : null;
  });
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
    $('#camWeather').textContent = v.toggleWeather() ? 'Cuaca: hidup' : 'Cuaca: mati';
  };
}
$('#camLog').onclick = () => hud.toggleLog(pov());
$('#logClose').onclick = () => hud.toggleLog(pov());
$('#endGame').onclick = () => void game?.askEndGame();
hud.renderWx('cerah');

setupScreen((players) => game?.start(players));

// kait untuk tes otomatis
declare global {
  interface Window {
    __nn?: { game: LocalGame | null; view: GameView | null };
  }
}
window.__nn = { game, view };
