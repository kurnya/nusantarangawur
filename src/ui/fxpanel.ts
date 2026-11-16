/** Panel "Uji animasi": memutar animasi Bencana dan mengganti tampilan cuaca tanpa mengubah aturan. */
import * as C from '../engine/config';
import type { WeatherKey } from '../engine/types';
import type { GameView } from '../view/scene';
import { $, el } from './dom';
import type { Hud } from './hud';

const LB: [string, string][] = [
  ['banjir', '🌊 Banjir'],
  ['rob', '🌧️ Banjir rob'],
  ['merapi', '🌋 Gunung meletus'],
  ['gempa', '🏚️ Gempa bumi'],
  ['tsunami', '🌊 Tsunami'],
  ['kebakaran', '🔥 Kebakaran hutan'],
  ['longsor', '⛰️ Tanah longsor'],
  ['kering', '🏜️ Kekeringan'],
  ['puting', '🌪️ Puting beliung'],
  ['meteor', '☄️ Meteor'],
  ['meteorstorm', '☄️ Hujan meteor'],
  ['petir', '⚡ Petir menyambar bidak'],
];

export function setupFxPanel(
  view: GameView,
  hud: Hud,
  target: () => { tile: number; pid: number; busy: boolean } | null,
): void {
  const stage = $('#stage');
  const pn = el(
    'div',
    'fxpanel',
    '<h4>Periksa animasi bencana</h4><small>Pilih satu, animasinya main di petak pemain yang sedang jalan. Tidak mengubah uang atau posisi.</small>',
  );
  let busy = false;
  const btns: HTMLButtonElement[] = [];
  LB.forEach(([k, t]) => {
    const b = el('button');
    b.textContent = t;
    b.onclick = async () => {
      const tg = target();
      if (busy || !tg || tg.busy) return;
      busy = true;
      btns.forEach((x) => (x.disabled = true));
      pn.style.opacity = '0';
      pn.style.pointerEvents = 'none';
      try {
        await view.play(k, tg.tile, tg.pid);
      } finally {
        busy = false;
        btns.forEach((x) => (x.disabled = false));
        pn.style.opacity = '';
        pn.style.pointerEvents = '';
      }
    };
    btns.push(b);
    pn.appendChild(b);
  });
  const wr = el(
    'div',
    'wxrow',
    '<small>Ganti tampilan cuaca (hanya tampilan, aturan tidak berubah)</small>',
  );
  (Object.keys(C.WEATHER) as WeatherKey[]).forEach((k) => {
    const b = el('button');
    b.textContent = C.WEATHER[k].name;
    b.onclick = () => {
      view.setWeather(k);
      hud.renderWx(k, true);
    };
    wr.appendChild(b);
  });
  pn.appendChild(wr);
  stage.appendChild(pn);
  $('#camFx').onclick = () => pn.classList.toggle('open');
}
