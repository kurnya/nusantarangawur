/** Modal info petak (klik petak di peta). Diportir dari openTile prototipe. */
import { PAWNS, SPECIAL, TILES, cityOf } from '../engine/board';
import * as C from '../engine/config';
import { buildCost, canBuild, cityPrice, fmtMoney, rentFor } from '../engine/rules';
import type { GameState, SpecialKind } from '../engine/types';
import { provColor } from '../view/util';
import { ciImg, esc, spImg, tkImg } from './dom';
import type { Hud } from './hud';

const SD: Record<SpecialKind, string> = {
  START: `Mulai dan jalan ke kanan. Lewat sini dapat gaji ${fmtMoney(C.SALARY)}.`,
  JAIL: 'Cuma mampir, atau dikurung kalau kena razia. Keluar dengan bayar denda atau dadu kembar.',
  PARK: `Ngopi gratis. Pemain yang mampir dapat ${fmtMoney(C.PARK_BONUS)}.`,
  RAZIA: 'Kena razia: langsung dikirim ke Nusakambangan.',
  NASIB: 'Ambil kartu Nasib. Peluangnya lebih sering kabar buruk.',
  BENCANA: 'Ambil kartu Bencana. Selalu ada dampak ke pemain.',
  PAJAK: `Bayar 12% dari uangmu (minimal ${fmtMoney(C.PAJAK_MIN)}).`,
};

/**
 * Tampilkan info petak. `canAct`: pemain layar ini sedang giliran dan tidak ada animasi.
 * Mengembalikan true jika pemain memilih membangun.
 */
export async function openTile(
  hud: Hud,
  s: GameState,
  i: number,
  pov: number,
  canAct: boolean,
): Promise<boolean> {
  const T = TILES[i];
  if (!T) return false;
  if (T.t === 'sp') {
    const sp = SPECIAL.find((x) => x.k === T.k)!;
    await hud.ask(
      `<h3>${spImg(T.k, 36)} ${esc(sp.label)}</h3><p style="color:var(--mute);margin:0">${esc(SD[T.k])}</p>`,
      [{ label: 'Tutup' }],
    );
    return false;
  }
  const info = cityOf(i)!;
  const pr = info.prov;
  const o = s.owners[i];
  const cp = cityPrice(pr);
  const pc = provColor(pr.hue);
  const ownerP = o ? s.players[o.p] : null;
  const owner = ownerP
    ? `<span style="display:inline-block;width:20px;height:20px;vertical-align:middle">${tkImg(ownerP.pawn)}</span> ${esc(ownerP.name)}${o && o.lv ? ' · ' + C.LV_NAMES[o.lv] : ''}`
    : 'Belum ada pemilik';
  const city = pr.cities[T.ci]!;
  let h = `<h3>${ciImg(pr.code, T.ci, 40)} ${esc(city.n)} <span class="chip" style="--rc:${pc}">${esc(pr.name)}</span></h3>
   <p style="margin:0;color:var(--mute);font-size:13px">${esc(city.t)} · Harga ${fmtMoney(cp)} · Pemilik: ${owner}</p>`;
  h += `<div class="rent">${C.LV_NAMES.map((n, k) => `<div class="${o && o.lv === k ? 'on' : ''}">${n}<b>${fmtMoney(rentFor(pr, 5, k))}</b></div>`).join('')}</div>
   <p style="margin:6px 0 0;color:var(--mute);font-size:11.5px">Sewa di atas berlaku jika satu pemain memegang kelima kota ${esc(pr.name)}. Jika baru memegang 1 kota, sewanya ${fmtMoney(rentFor(pr, 1, 0))}.</p>`;
  h += `<ul class="cl">${pr.tiles
    .map((ti, k) => {
      const c = pr.cities[k]!;
      const oo = s.owners[ti];
      const op = oo ? s.players[oo.p] : null;
      const who = op ? `${PAWNS[op.pawn]?.name ?? ''}: ${esc(op.name)}` : `kosong, ${fmtMoney(cp)}`;
      return `<li class="${ti === i ? 'built' : ''}" style="--oc:${pc}"><i>${ciImg(pr.code, k, 30)}</i><div><b>${k + 1}. ${esc(c.n)}</b><small>${esc(c.t)} · ${who}</small></div></li>`;
    })
    .join('')}</ul>`;
  const p = s.players[pov];
  const can =
    canAct &&
    !!p &&
    s.turn === pov &&
    canBuild(s, pov, i) &&
    (s.phase === 'act' || s.phase === 'roll');
  const btns: { label: string; cls?: string; dis?: boolean }[] = [{ label: 'Tutup' }];
  if (can && o) {
    const cost = buildCost(s, i, pov);
    btns.unshift({
      label: `Bangun ${C.LV_NAMES[o.lv + 1]} (${fmtMoney(cost)})`,
      cls: 'gold',
      dis: p.money < cost,
    });
  }
  const k = await hud.ask(h, btns);
  return can && k === 0;
}
