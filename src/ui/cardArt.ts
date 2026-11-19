/**
 * Gambar garis (line art) untuk kartu Nasib dan Bencana. Tiap kartu punya motif sesuai temanya.
 * Semua gambar hanya goresan `currentColor`, jadi warnanya mengikuti warna kartu (lihat style CSS `.cart`).
 * Kanvas 120 x 100. Kelas `s` = goresan sekunder yang lebih tipis dan pudar.
 */

const sp = (x: number, y: number, r = 6): string =>
  `<path class="s" d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28}Z"/>`;

const coin = (x: number, y: number, r = 10): string =>
  `<circle cx="${x}" cy="${y}" r="${r}"/><circle class="s" cx="${x}" cy="${y}" r="${r * 0.66}"/><path class="s" d="M${x} ${y - r * 0.32}V${y + r * 0.32}"/>`;

const drop = (x: number, y: number, s = 1): string =>
  `<path d="M${x} ${y} q${-6 * s} ${10 * s} 0 ${14 * s} q${6 * s} ${-4 * s} 0 ${-14 * s}Z"/>`;

const cloud = (x: number, y: number, s = 1): string =>
  `<path d="M${x} ${y + 16 * s} h${52 * s} a${12 * s} ${12 * s} 0 0 0 ${-2 * s} ${-23 * s} a${16 * s} ${16 * s} 0 0 0 ${-30 * s} ${-6 * s} a${14 * s} ${14 * s} 0 0 0 ${-20 * s} ${29 * s}Z"/>`;

const spikes = (cx: number, cy: number, r1: number, r2: number, n: number): string => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    d += `M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}`;
  }
  return `<path class="s" d="${d}"/>`;
};

const wave = (y: number, x0 = 6, x1 = 114, a = 5): string => {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += 16) d += ` q4 ${-a} 8 0 q4 ${a} 8 0`;
  return `<path d="${d}"/>`;
};

const BARS = '<path class="s" d="M96 8V34M104 8V34M112 8V34M92 12h24M92 30h24"/>';
const gift = `<rect x="28" y="46" width="64" height="40" rx="3"/><path d="M22 34h76v12H22z"/><path d="M60 34v52"/><path d="M60 34C46 12 28 22 42 34M60 34C74 12 92 22 78 34"/>`;
const truck = `<path d="M10 30h58v42H10z"/><path d="M68 44h22l14 14v14H68z"/><path d="M76 50h12l8 8H76z"/><circle cx="30" cy="76" r="9"/><circle cx="88" cy="76" r="9"/>`;

const ART: Record<string, string> = {
  /* ---------- nasib buruk ---------- */
  tilang: `<path d="M46 82 60 20 74 82z"/><path d="M40 82h40"/><path d="M52 58h16M55 40h10"/><path d="M88 28h18v36H88z"/><path class="s" d="M92 36h10M92 44h10M92 52h6"/>${sp(26, 30)}`,
  tv: `<rect x="16" y="26" width="88" height="52" rx="6"/><rect class="s" x="23" y="33" width="74" height="38" rx="3"/><path d="M52 26 40 12M68 26 82 12"/><path d="M52 52v-8l14 4z"/><path d="M40 88h40M60 78v10"/>`,
  box: `<path d="M60 18 98 36v34L60 88 22 70V36z"/><path d="M22 36l38 18 38-18M60 54v34"/><path class="s" d="M41 27l38 18M82 46v14"/><path d="M50 20c0-12 20-12 20 0" class="s"/>`,
  ayam: `<ellipse cx="56" cy="62" rx="26" ry="18"/><circle cx="86" cy="40" r="11"/><path d="M96 40l10 4-10 4"/><path d="M82 29q4-10 8 0 4-7 6 3"/><circle cx="88" cy="38" r="1.6"/><path d="M32 58q-14-12-6-26 8 10 14 22"/><path d="M50 80v12M62 80v12M44 92h12M56 92h12"/><path class="s" d="M44 62q10 8 22-2"/>`,
  ban: `<circle cx="60" cy="50" r="34"/><circle cx="60" cy="50" r="14"/><path class="s" d="M60 16v20M60 64v20M26 50h20M74 50h20M36 26l14 14M70 60l14 14M84 26 70 40M50 60 36 74"/><path d="M96 80q8 6 14 0M100 90q6 4 10 0" class="s"/>`,
  cart: `<path d="M12 22h14l12 44h54l10-30H32"/><circle cx="46" cy="80" r="6"/><circle cx="88" cy="80" r="6"/><path class="s" d="M50 46l14 14M64 46 50 60M76 44h14"/>${sp(98, 16)}`,
  sofa: `<path d="M24 54V40q0-10 10-10h52q10 0 10 10v14"/><path d="M12 56q0-8 8-6 6 2 6 8v14h68V58q0-6 6-8 8-2 8 6v22H12z"/><path d="M26 82v8M94 82v8"/><path class="s" d="M44 40l10 10M54 36l10 14M64 36l10 14"/>`,
  atm: `<rect x="30" y="14" width="60" height="72" rx="6"/><rect class="s" x="38" y="22" width="44" height="24" rx="2"/><path d="M42 58h36"/><path class="s" d="M42 68h4M52 68h4M62 68h4M72 68h4M42 76h4M52 76h4M62 76h4M72 76h4"/><path d="M96 56h10M96 64h10" class="s"/>`,
  book: `<path d="M60 26C48 18 30 18 14 24v54c16-6 34-6 46 2 12-8 30-8 46-2V24c-16-6-34-6-46 2z"/><path d="M60 26v54"/><path class="s" d="M24 36c8-2 16-2 26 2M24 48c8-2 16-2 26 2M70 38c10-4 18-4 26-2M70 50c10-4 18-4 26-2"/>`,
  phone: `<rect x="34" y="8" width="52" height="84" rx="8"/><path d="M54 16h12"/><circle cx="60" cy="82" r="3"/><path d="M50 24 60 42 50 54 64 72" /><path class="s" d="M60 42l10-8M50 54l-8 4M64 72l8 4"/><path class="s" d="M14 88q6-6 12 0 6 6 12 0M82 88q6-6 12 0 6 6 12 0"/>`,
  family: `<circle cx="60" cy="32" r="10"/><path d="M42 80q0-26 18-26t18 26z"/><circle cx="28" cy="44" r="7"/><path d="M16 80q0-20 12-20t12 20z"/><circle cx="92" cy="44" r="7"/><path d="M80 80q0-20 12-20t12 20z"/><path d="M10 88h100" class="s"/>${coin(60, 12, 5)}`,
  coffee: `<path d="M26 44h50v22q0 16-25 16T26 66z"/><path d="M76 50h8q10 0 10 9t-10 9h-8"/><path d="M14 86h74" class="s"/><path class="s" d="M40 34q-6-8 0-14M52 34q-6-8 0-14M64 34q-6-8 0-14"/><path d="M100 28l8 8M108 28l-8 8" class="s"/>`,
  detective: `<circle cx="50" cy="44" r="26"/><circle class="s" cx="50" cy="44" r="19"/><path d="M69 63l26 26" stroke-width="6"/><path class="s" d="M44 36q0-8 8-8t8 8q0 6-8 8v4M52 56v1"/><path d="M82 20q10-6 20 0M86 12q6-6 14 0" class="s"/>`,
  laptop: `<rect x="26" y="20" width="68" height="46" rx="4"/><path d="M14 78h92l-8-12H22z"/><path class="s" d="M54 32l12 20M66 32 54 52"/><path d="M50 84h20" class="s"/>`,
  cake: `<rect x="24" y="58" width="72" height="28" rx="3"/><path d="M24 70q9 7 18 0t18 0 18 0 18 0"/><path d="M32 58V44h56v14"/><path d="M44 44V32M60 44V30M76 44V32"/><path class="s" d="M44 28q-3-5 0-8 3 3 0 8zM60 26q-3-5 0-8 3 3 0 8zM76 28q-3-5 0-8 3 3 0 8z"/>${sp(14, 40, 4)}${sp(106, 40, 4)}`,
  house: `<path d="M16 52 58 18l42 34"/><path d="M26 46v42h64V46"/><path d="M50 88V64h16v24"/><path d="M100 36V10M92 18l8-8 8 8"/><path class="s" d="M34 56h10v10H34zM72 56h10v10H72z"/>`,
  gift,
  glasses: `<circle cx="36" cy="56" r="19"/><circle cx="84" cy="56" r="19"/><path d="M55 52q5-6 10 0"/><path d="M18 52 8 42M102 52l10-10"/><path class="s" d="M28 44l8 12-6 10M76 50l8 8"/>${sp(100, 22, 5)}`,
  wrench: `<path d="M26 90 64 52"/><path d="M64 52C54 42 54 24 70 18l-4 12 10 6 12-4c2 14-10 26-24 20z" transform="translate(0 0)"/><circle class="s" cx="28" cy="30" r="9"/><circle class="s" cx="28" cy="30" r="15" stroke-dasharray="4 5"/><path class="s" d="M84 68l16 16"/>`,
  faucet: `<path d="M24 34h40q18 0 18 18v6"/><path d="M72 58h22"/><path d="M36 34V22M26 22h20"/>${drop(82, 68)}${drop(94, 78, 0.8)}${drop(82, 86, 0.7)}<path class="s" d="M24 34v-6M14 90h92"/>`,
  parking: `<rect x="26" y="12" width="68" height="56" rx="6"/><path d="M50 56V26h16q10 0 10 10t-10 10H50"/><path d="M60 68v24M46 92h28"/><path class="s" d="M100 70l8 8M108 70l-8 8"/>`,
  gas: `<path d="M40 30h40q8 0 8 10v42q0 8-8 8H40q-8 0-8-8V40q0-10 8-10z"/><path d="M50 30V20h20v10"/><path d="M32 54h56"/><path class="s" d="M60 80c-12-10-4-20-2-30 6 8 14 16 2 30z"/><path d="M98 28l8-8M98 40h10" class="s"/>`,
  wallet: `<path d="M18 34h78v52H18z"/><path d="M18 34 30 20h60l6 14"/><rect x="72" y="50" width="28" height="18" rx="3"/><circle cx="84" cy="59" r="3.5"/><path class="s" d="M104 22q6-8 12 0M10 22l6 6M14 18l6 6"/>`,
  watch: `<circle cx="60" cy="50" r="24"/><circle class="s" cx="60" cy="50" r="19"/><path d="M60 50V36M60 50h12"/><path d="M50 26l4-16h12l4 16M50 74l4 16h12l4-16"/><path d="M84 50h7" class="s"/>`,
  receipt: `<path d="M30 10h60v80l-8-6-8 6-8-6-8 6-8-6-8 6-6-5z"/><path class="s" d="M42 26h36M42 40h36M42 54h22"/><circle cx="76" cy="62" r="9"/><path d="M72 66l8-8"/>`,
  fridge: `<rect x="32" y="8" width="56" height="84" rx="6"/><path d="M32 38h56M42 20v10M42 48v16"/><path class="s" d="M60 58v22M51 63l18 12M69 63 51 75"/><path class="s" d="M96 40q6 6 0 12M98 56q6 6 0 12"/>`,
  card: `<rect x="12" y="24" width="96" height="54" rx="8"/><path d="M12 38h96M12 46h96"/><rect class="s" x="22" y="56" width="18" height="12" rx="2"/><path class="s" d="M54 62h8M68 62h8M82 62h8"/>${sp(100, 14, 5)}`,
  ticket: `<path d="M12 28h96v16a8 8 0 0 0 0 16v16H12V60a8 8 0 0 0 0-16z"/><path class="s" d="M78 30v8M78 44v8M78 58v8M78 72v4"/><path d="M42 40l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z"/><path class="s" d="M86 42h14M86 52h14"/>`,
  noodlepack: `<path d="M36 18l8 8 8-8 8 8 8-8 8 8 6-8v62H30V26z"/><path class="s" d="M42 42q9-8 18 0t18 0M42 56q9-8 18 0t18 0"/><path d="M98 20l10-6M98 30h12" class="s"/><path d="M20 90h80" class="s"/>`,
  bank: `<path d="M10 38 60 12l50 26z"/><path d="M26 48v30M44 48v30M76 48v30M94 48v30"/><path d="M16 78h88M8 90h104"/><circle class="s" cx="60" cy="30" r="5"/>`,
  truckFence: `${truck.replace(/translate/g, 'translate')}<path class="s" d="M10 88h96"/><path d="M2 40v30M10 36v34" class="s"/><path class="s" d="M94 24l8-8M100 30l10-4"/>`,
  alarm: `<circle cx="60" cy="54" r="28"/><path d="M60 54V36M60 54l12 8"/><path d="M34 22q-14 0-16 14M86 22q14 0 16 14"/><path d="M42 84l-8 10M78 84l8 10"/><path class="s" d="M60 10v6M10 54h6M104 54h6"/>`,
  umbrella: `<path d="M14 56Q14 18 60 18t46 38"/><path d="M14 56q10-10 23 0t23 0 23 0 23 0"/><path d="M60 56v26q0 10-10 8"/><path class="s" d="M44 20 38 56M76 20l6 36"/><path class="s" d="M22 76l-4 10M96 70l-4 10M104 84l-4 8"/>`,
  gamepad: `<path d="M28 40q-12 0-15 18l-3 20q-1 10 10 6l17-16h46l17 16q11 4 10-6l-3-20q-3-18-15-18z"/><path d="M36 52v12M30 58h12"/><circle cx="84" cy="52" r="3.5"/><circle cx="94" cy="60" r="3.5"/><path class="s" d="M52 52h4M64 52h4"/><rect class="s" x="50" y="14" width="20" height="16" rx="3"/><path class="s" d="M54 14v-4q0-6 6-6t6 6v4"/>`,
  tent: `<path d="M10 56 60 14l50 42"/><path d="M22 56v32h76V56"/><path d="M44 88V68q16-18 32 0v20"/><path d="M60 14V4l12 5-12 5"/><path class="s" d="M10 56q12 10 25 0t25 0 25 0 25 0"/>`,
  tooth: `<path d="M36 24c8-8 16 0 24 0s16-8 24 0c12 8 6 30 0 42-4 12-4 24-12 24s-8-24-12-24-4 24-12 24-8-12-12-24c-6-12-12-34 0-42z"/><path class="s" d="M44 34q4-4 10-2"/>${sp(96, 24, 6)}${sp(22, 40, 4)}`,
  mailbox: `<path d="M24 70V44q0-20 28-20h20q24 0 24 24v22z"/><path d="M60 70v22M46 92h28"/><path d="M38 48h34"/><path d="M96 30h12v16"/><path class="s" d="M34 58h28"/>`,
  broom: `<path d="M90 8 54 62"/><path d="M44 58l24 14-14 20-28-12z"/><path class="s" d="M34 72l12 8M42 64l12 8M52 74l-6 10"/><path class="s" d="M84 78q6-6 12 0M92 90q6-4 10 0"/>`,
  ewallet: `<rect x="40" y="8" width="40" height="84" rx="7"/><path class="s" d="M52 16h16"/><path d="M60 30a14 14 0 1 1-13 10"/><path d="M44 36l4 6 6-4"/><path d="M60 50v10M56 54h8" class="s"/><path class="s" d="M98 40q8 6 0 14"/>`,
  durian: `<circle cx="60" cy="56" r="26"/>${spikes(60, 56, 26, 38, 14)}<path d="M60 30q4-12 14-14M60 30q-6-8-16-8"/>`,
  ricecooker: `<path d="M22 44q0-16 38-16t38 16v36q0 8-8 8H30q-8 0-8-8z"/><path d="M22 52h76"/><path d="M54 28v-8h12v8"/><circle cx="60" cy="72" r="8"/><path class="s" d="M60 10v-4M44 12l-4-4M76 12l4-4M30 20l-6-2M90 20l6-2"/>`,
  printer: `<path d="M20 40h80v32H20z"/><path d="M34 40V14h52v26"/><path d="M34 64h52v26H34z"/><path class="s" d="M42 72h36M42 80h36M44 24h32"/><circle class="s" cx="90" cy="50" r="2.5"/>`,
  wifi: `<path d="M22 46Q60 12 98 46"/><path d="M34 58q26-22 52 0"/><path d="M47 70q13-10 26 0"/><circle cx="60" cy="82" r="3.5"/><path class="s" d="M92 64l14 14M106 64 92 78"/>`,
  dinner: `<circle cx="60" cy="52" r="26"/><circle class="s" cx="60" cy="52" r="17"/><path d="M14 18v22q0 8 7 8t7-8V18M21 48v42"/><path d="M104 18q-14 14-4 38v34"/>`,
  washer: `<rect x="24" y="8" width="72" height="84" rx="6"/><path d="M24 28h72"/><circle cx="60" cy="60" r="22"/><path class="s" d="M46 62q7-8 14 0t14 0"/><circle class="s" cx="36" cy="18" r="3"/><path class="s" d="M52 18h26"/>${drop(10, 70, 0.8)}${drop(108, 80, 0.8)}`,
  shoe: `<path d="M12 62V42l24-6 14 14 22 4q28 4 34 20v8H12z"/><path d="M12 80h96"/><path class="s" d="M38 42l6-8M46 48l6-8M54 52l6-8"/><path d="M12 70h96" class="s"/>`,
  bulb: `<path d="M60 12c-20 0-30 18-22 34 6 10 8 16 8 24h28c0-8 2-14 8-24 8-16-2-34-22-34z"/><path d="M48 78h24M50 86h20"/><path d="M52 50l8-10 8 10"/><path class="s" d="M60 4V0M22 20l-6-4M98 20l6-4M12 44H6M108 44h6"/>`,
  taxi: `<path d="M10 70V54l16-18h50l22 18h12v16z"/><circle cx="34" cy="72" r="9"/><circle cx="88" cy="72" r="9"/><path d="M46 36V26h20v10"/><path class="s" d="M30 54l10-14h20v14zM66 54V40h8l14 14z"/><path class="s" d="M54 30h4"/>`,
  roadwork: `<path d="M12 36h96v20H12z"/><path class="s" d="M28 36 18 56M48 36 38 56M68 36 58 56M88 36 78 56M108 36 98 56"/><path d="M26 56v34M94 56v34"/><circle class="s" cx="26" cy="26" r="5"/><circle class="s" cx="94" cy="26" r="5"/>`,
  map: `<path d="M12 26l30-10 36 10 30-10v58l-30 10-36-10-30 10z"/><path d="M42 16v58M78 26v58"/><path class="s" stroke-dasharray="4 5" d="M24 62q24-36 40-4t34-26"/><path d="M92 20c-6 0-10 4-10 9 0 7 10 15 10 15s10-8 10-15c0-5-4-9-10-9z" class="s"/>`,
  scooter: `<circle cx="28" cy="72" r="12"/><circle cx="94" cy="72" r="12"/><path d="M28 72h22l8-18h20l16 18"/><path d="M72 54l-4-22h16"/><path d="M42 54h20"/><circle cx="50" cy="28" r="9"/><path class="s" d="M20 14h28M28 8l-8 6 8 6"/>`,
  train: `<path d="M32 12h56q8 0 8 8v56H24V20q0-8 8-8z"/><path d="M32 26h56v24H32z"/><circle cx="40" cy="64" r="4"/><circle cx="80" cy="64" r="4"/><path d="M24 76 14 90M96 76l10 14M14 90h92"/><path class="s" d="M48 12V6h24v6"/>`,
  flag: `<path d="M26 92V10"/><path d="M26 14h60l-12 14 12 14H26"/><path class="s" d="M36 24h34M36 34h28"/><path class="s" d="M96 70q6-6 12 0M92 84q6-6 12 0M100 62l2-8"/>`,
  sandal: `<path d="M50 8c20 0 28 20 26 48-2 26-10 36-24 34-14-2-18-14-16-34 2-22 4-48 14-48z"/><path d="M44 32l8 26 14-24"/><path class="s" d="M52 58l4 14M100 40l8 8M108 40l-8 8"/>`,
  signpost: `<path d="M58 94V10"/><path d="M58 20h34l10 10-10 10H58z"/><path d="M58 50H28L18 60l10 10h30z"/><path class="s" d="M68 30h18M30 60q4-5 8 0t8 0"/><path class="s" d="M44 94h28"/>`,
  bus: `<rect x="12" y="20" width="96" height="52" rx="8"/><path d="M12 54h96"/><path class="s" d="M22 30h22v16H22zM50 30h20v16H50zM76 30h22v16H76z"/><circle cx="34" cy="76" r="9"/><circle cx="86" cy="76" r="9"/>`,
  pothole: `<path d="M34 92 48 12M86 92 72 12"/><path class="s" d="M60 18v8M60 34v10M60 52v10"/><ellipse cx="60" cy="72" rx="22" ry="9"/><path class="s" d="M44 68l-10-8M76 68l10-8M60 80v8"/>`,
  ferry: `<path d="M12 60h96l-14 22H28z"/><path d="M34 60V42h52v18"/><path d="M42 48h12v8H42zM66 48h12v8H66z" class="s"/><path d="M58 42V28h12v14"/><path d="M64 28V18l12 4-12 4" class="s"/>${wave(92, 8, 112, 4)}`,
  sleep: `<path d="M64 14a36 36 0 1 0 30 52 30 30 0 0 1-30-52z"/><path d="M84 18h14l-14 16h14M102 38h10l-10 12h10" class="s"/><path class="s" d="M10 88h60"/>`,

  candle: `<path d="M50 40h20v48H50z"/><path d="M60 14q-12 14 0 24 12-10 0-24z"/><path d="M60 36v4M54 52v10M66 56v8"/><path d="M38 88h44"/><path class="s" d="M32 26l-8-4M88 26l8-4M26 50h-8M94 50h8"/>`,
  chat: `<path d="M12 14h58q6 0 6 6v26q0 6-6 6H40L24 64V52h-6q-6 0-6-6z"/><path d="M46 40h54q6 0 6 6v24q0 6-6 6h-8v14L76 76H52q-6 0-6-6z"/><path class="s" d="M22 26h38M22 36h24M58 52h38M58 62h26"/>`,
  basket: `<path d="M12 46h96L98 88H22z"/><path d="M32 46Q60 0 88 46"/><path class="s" d="M28 60h64M32 74h56M46 46l2 42M60 46v42M74 46l-2 42"/><path d="M96 20l8-8M104 28h8" class="s"/>`,
  menu: `<path d="M30 8h50q6 0 6 6v72q0 6-6 6H30q-6 0-6-6V14q0-6 6-6z"/><path class="s" d="M36 24h38M36 36h30M36 48h34M36 60h24"/><circle cx="90" cy="74" r="14"/><path d="M90 66v8l6 4"/><path d="M98 20l8 6M98 32l10 2" class="s"/>`,
  tissue: `<path d="M22 56h62v30H22z"/><path d="M36 56Q40 30 52 40q8-18 16 4 12-8 10 12"/><path d="M92 40h18M92 52h14M92 64h18"/><path class="s" d="M14 30l6 6M28 20l2 8M10 44h8"/>`,
  key: `<circle cx="34" cy="46" r="20"/><circle class="s" cx="34" cy="46" r="7"/><path d="M54 46h50M88 46v14M98 46v10"/><path class="s" d="M16 80q10 8 24 0M70 24l8-8M80 30h10"/>`,
  station: `<path d="M18 18h84v26H18z"/><path class="s" d="M28 28h40M28 36h24"/><path d="M40 44v44M80 44v44"/><path d="M8 92h104"/><path class="s" d="M84 28h10M84 36h6"/><path d="M92 62h12l-12 14h12M106 52h8l-8 10h8" class="s"/>`,
  nosignal: `<path d="M26 82V72M42 82V60M58 82V48M74 82V36M90 82V24"/><path d="M14 14 106 92"/><path class="s" d="M10 90h104"/>`,
  chili: `<path d="M40 28C72 24 98 42 100 80 82 72 62 66 46 54 36 46 32 34 40 28z"/><path d="M40 28Q34 16 22 18"/><path class="s" d="M30 66q-6-8 0-14M20 74q-8-10 0-20M14 52l-8-4M12 40l-8 2"/>`,
  ferris: `<circle cx="60" cy="44" r="32"/><circle cx="60" cy="44" r="5"/><path class="s" d="M60 12v64M28 44h64M37 21l46 46M83 21 37 67"/><path d="M60 44 36 92M60 44l24 48M24 92h72"/><circle cx="60" cy="12" r="4"/><circle cx="92" cy="44" r="4"/><circle cx="60" cy="76" r="4"/><circle cx="28" cy="44" r="4"/>`,
  motorbike: `<circle cx="26" cy="72" r="13"/><circle cx="94" cy="72" r="13"/><path d="M26 72 48 48h26l20 24"/><path d="M52 44h20M76 48l8-18h12"/><path class="s" d="M10 54q-8-6 0-14M2 62q-8-8 0-18"/>`,
  carfuel: `<path d="M6 76V64l12-18h34l16 18h8v12z"/><circle cx="22" cy="78" r="7"/><circle cx="58" cy="78" r="7"/><path d="M84 28h24v60H84z"/><rect class="s" x="89" y="34" width="14" height="12" rx="2"/><path d="M108 40q8 0 8 14v12"/><path class="s" d="M88 88h24"/>`,
  badge: `<path d="M60 8 98 22v30q0 24-38 40Q22 76 22 52V22z"/><path d="M60 32l6 12 13 2-10 9 3 13-12-7-12 7 3-13-10-9 13-2z"/>`,
  pill: `<path d="M28 70 68 30a14 14 0 0 1 20 20L48 90a14 14 0 0 1-20-20z"/><path d="M42 44l20 20"/><circle cx="96" cy="76" r="10"/><path class="s" d="M88 76h16M24 24h12M30 18v12"/>`,
  tub: `<path d="M14 56h92v10q0 20-20 20H34q-20 0-20-20z"/><path d="M22 56V28q0-8 10-8h12"/><path d="M26 86l-4 6M94 86l4 6"/><circle class="s" cx="76" cy="46" r="5"/><circle class="s" cx="90" cy="38" r="4"/><path class="s" d="M98 18l6 6M104 12v8"/>`,
  parcel: `<path d="M44 20 74 34v30L44 80 14 64V34z"/><path d="M14 34l30 14 30-14M44 48v32"/><path d="M88 22q0-10 10-10t10 10q0 8-10 10v6M98 50v1" />`,
  clothes: `<path d="M8 22h104"/><path d="M42 26 26 38l8 12 8-6v34h36V44l8 6 8-12L78 26Q60 38 42 26z"/><path d="M44 18v10M76 18v10"/><path class="s" d="M96 62v14l10-4zM12 66l12 4-8 8z"/>`,
  siren: `<path d="M38 58V44q0-22 22-22t22 22v14"/><path d="M28 58h64v14H28z"/><path d="M24 82h72"/><path class="s" d="M60 12V4M30 22l-6-6M90 22l6-6M18 42H8M102 42h10"/>`,
  ambulance: `<path d="M8 74V34h62v40"/><path d="M70 46h20l16 14v14H70z"/><circle cx="30" cy="76" r="8"/><circle cx="90" cy="76" r="8"/><path d="M38 42v22M27 53h22"/><path class="s" d="M76 50h12l8 8H76z"/>`,
  stopsign: `<path d="M42 10h36l24 24v32L78 90H42L18 66V34z"/><path d="M36 44h48M36 56h34"/><path class="s" d="M52 28h16"/>`,
  /* ---------- nasib baik ---------- */
  popper: `<path d="M14 92 38 40l30 28z"/><path d="M28 70l10 8M22 82l8 6" class="s"/><path d="M44 34 58 12M52 46l30-12M60 56l34 2"/><circle class="s" cx="86" cy="18" r="3"/><circle class="s" cx="100" cy="44" r="3"/>${sp(70, 22, 5)}${sp(100, 72, 6)}`,
  jeans: `<path d="M32 12h56v40l-8 40H62L60 56l-2 36H40l-8-40z"/><path d="M44 26h32v14q-16 12-32 0z"/><path class="s" d="M32 24h56"/>${coin(98, 22, 8)}${sp(18, 30, 5)}`,
  banknote: `<rect x="12" y="28" width="96" height="46" rx="5"/><circle cx="60" cy="51" r="13"/><path class="s" d="M60 44v14M55 48q5-4 10 0M55 54q5 4 10 0"/><circle class="s" cx="24" cy="40" r="3"/><circle class="s" cx="96" cy="62" r="3"/><path d="M100 18V6M94 12l6-6 6 6" class="s"/>`,
  cupcake: `<path d="M32 52l6 36h44l6-36z"/><path class="s" d="M46 54l3 32M60 54v32M74 54l-3 32"/><path d="M30 52q0-24 30-26t30 26z"/><circle cx="60" cy="16" r="5"/><path d="M60 11q4-6 10-6"/>`,
  egg: `<path d="M60 10c24 0 34 32 30 52-4 20-16 30-30 30S34 82 30 62C26 42 36 10 60 10z"/><path d="M34 54l9-7 9 7 8-7 9 7 9-7"/>${sp(60, 74, 6)}${sp(98, 20, 5)}${sp(20, 30, 4)}`,
  cashback: `<rect x="34" y="8" width="44" height="84" rx="7"/><path class="s" d="M46 16h20"/><path d="M96 38a28 28 0 1 0 4 22"/><path d="M100 28v12H88"/>${coin(56, 52, 12)}`,
  sawah: `<circle cx="90" cy="22" r="10"/>${spikes(90, 22, 14, 20, 8)}<path d="M8 66q26-14 52-2t52-8M8 80q26-14 52-2t52-8M8 94q26-14 52-2t52-8"/><path d="M30 60V34M30 42q-8-2-10-10M30 46q8-2 10-10M54 62V36M54 44q-8-2-10-10M54 48q8-2 10-10"/>`,
  medal: `<circle cx="60" cy="62" r="24"/><path d="M60 46l5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1z"/><path d="M42 8l10 30M78 8 68 38M42 8h36" class="s"/>`,
  handshake: `<path d="M8 62 36 42l26 12 24-12 26 20"/><path d="M36 42l12-6h24l14 6"/><path d="M46 60l10 8M56 56l12 10M68 52l10 12"/><path class="s" d="M8 62v14l14 4M112 62v14l-14 4"/>${coin(60, 16, 8)}`,
  dadu: `<path d="M60 12 96 30v38L60 88 24 68V30z"/><path d="M24 30l36 18 36-18M60 48v40"/><circle cx="60" cy="30" r="2.5"/><circle cx="48" cy="25" r="2.5"/><circle cx="72" cy="35" r="2.5"/><circle class="s" cx="40" cy="58" r="2.5"/><circle class="s" cx="40" cy="48" r="2.5"/><circle class="s" cx="80" cy="64" r="2.5"/>`,
  harta: `<path d="M20 52v34h80V52"/><path d="M20 52q0-28 40-28t40 28z"/><path d="M20 52h80"/><rect x="52" y="50" width="16" height="16" rx="2"/><circle cx="60" cy="58" r="2.5"/>${coin(32, 14, 7)}${coin(88, 12, 7)}${sp(60, 12, 5)}`,
  jalan: `<path d="M44 14 14 92M76 14l30 78"/><path d="M60 20v12M60 44v14M60 70v20"/><path class="s" d="M38 52l10-6M82 52l-10-6"/><path d="M96 24l10 6-10 6M82 24l10 6-10 6" class="s"/>`,
  truckRamah: `${truck}<path class="s" d="M92 22c-4-6-12-2-8 4l8 8 8-8c4-6-4-10-8-4z"/><path d="M10 90h96" class="s"/>`,
  lampuHijau: `<rect x="40" y="6" width="40" height="88" rx="10"/><circle cx="60" cy="26" r="9"/><circle cx="60" cy="50" r="9"/><circle cx="60" cy="74" r="9"/><path d="M55 74l4 4 7-8"/><path class="s" d="M80 20h12M80 50h12M28 50H40"/>`,
  tol: `<path d="M14 40h44v50H14z"/><path d="M14 40l8-12h28l8 12"/><path d="M58 56 106 24"/><path d="M58 56h-8"/><path d="M70 74h30v16H70z"/><path class="s" d="M76 80h18M76 86h12"/>${sp(28, 62, 5)}`,
  voucher: `<path d="M12 50 42 18h58v64H42z"/><circle cx="50" cy="50" r="5"/><path d="M70 62 88 38"/><circle cx="72" cy="42" r="4"/><circle cx="86" cy="58" r="4"/><path class="s" d="M60 28h30"/>${sp(106, 14, 5)}`,
  bata: `<path d="M12 24h96v18H12zM12 42h96v18H12zM12 60h96v18H12z"/><path d="M36 24v18M72 24v18M24 42v18M60 42v18M96 42v18M36 60v18M72 60v18"/><path class="s" d="M12 90h96"/>${sp(100, 12, 5)}`,
  gulungan: `<path d="M28 20h64v54q0 10-10 10H42q-10 0-10-10V32"/><path d="M28 20q-12 0-12 10t14 10"/><path class="s" d="M44 40h34M44 52h34M44 64h20"/><circle cx="82" cy="72" r="9"/><path class="s" d="M78 72l3 3 6-7"/>`,
  rendang: `<path d="M12 62h96q-6 22-48 22T12 62z"/><circle cx="42" cy="52" r="11"/><circle cx="66" cy="48" r="13"/><circle cx="88" cy="55" r="9"/><path class="s" d="M38 50q4-4 8 0M62 46q5-5 10 0"/><path class="s" d="M40 34q-6-8 0-14M60 30q-6-8 0-14M80 34q-6-8 0-14"/>`,

  /* ---------- bencana ---------- */
  banjir: `<path d="M24 52 58 22l34 30"/><path d="M34 48v22M82 48v22"/><path d="M52 70V56h12v14" class="s"/>${wave(66, 6, 114, 5)}${wave(80, 6, 114, 5)}${wave(94, 6, 114, 5)}<path class="s" d="M20 14l-4 8M40 8l-4 8M80 12l-4 8M100 20l-4 8"/>`,
  rob: `${cloud(30, 20, 1)}<path class="s" d="M36 46l-4 12M52 46l-4 12M68 46l-4 12M84 46l-4 12"/>${wave(72, 6, 114, 5)}${wave(86, 6, 114, 5)}<path d="M22 72v-14M98 72V58M16 58h12M92 58h12" class="s"/><path class="s" d="M104 14a12 12 0 1 0 8 18 9 9 0 0 1-8-18z"/>`,
  merapi: `<path d="M10 92 44 40h32l34 52z"/><path d="M44 40q16 8 32 0"/><path class="s" d="M56 50v18M64 50v26M72 50l6 16"/><path d="M48 32q-12-10-2-18 2-10 14-6 12-6 20 4 12 2 8 12 6 8-4 14"/><circle class="s" cx="30" cy="22" r="3"/><circle class="s" cx="94" cy="26" r="3"/><circle class="s" cx="22" cy="40" r="2.5"/><circle class="s" cx="102" cy="44" r="2.5"/>`,
  gempa: `<path d="M40 44 60 24l20 20v28H40z"/><path d="M54 72V58h12v14" class="s"/><path class="s" d="M26 36q-8 14 0 28M14 28q-12 22 0 44M94 36q8 14 0 28M106 28q12 22 0 44"/><path d="M8 84h36l6 8 6-14 6 14 6-10h42"/><path class="s" d="M62 78l-6 14"/>`,
  tsunami: `<path d="M8 88C14 50 42 18 80 20c20 2 26 20 14 26-8 4-16-2-12-8"/><path d="M20 88c6-26 24-44 44-48" class="s"/><path d="M8 88h104"/><circle class="s" cx="98" cy="54" r="3"/><circle class="s" cx="108" cy="42" r="2.5"/><circle class="s" cx="104" cy="68" r="3"/>${wave(96, 8, 112, 4)}`,
  kebakaran: `<path d="M12 90 26 54l14 36zM24 90l14-30 14 30z"/><path d="M92 90 106 54l14 36z" class="s"/><path d="M60 92C34 82 42 56 56 44c0 12 10 12 6-8 20 14 30 40 12 56z"/><path class="s" d="M60 88c-10-6-6-18 0-24 2 8 10 12 0 24z"/><circle class="s" cx="30" cy="30" r="2.5"/><circle class="s" cx="92" cy="26" r="2.5"/><circle class="s" cx="84" cy="44" r="2"/>`,
  longsor: `<path d="M8 28 112 76"/><circle cx="34" cy="38" r="9"/><circle cx="58" cy="50" r="11"/><circle cx="84" cy="62" r="8"/><circle cx="102" cy="74" r="5"/><path class="s" d="M16 44l24 12M30 58l26 12M52 68l20 10"/><path d="M8 92h104"/><path class="s" d="M70 28l6-14 6 14z"/>`,
  kering: `<circle cx="84" cy="24" r="12"/>${spikes(84, 24, 16, 24, 10)}<path d="M8 64h104V92H8z"/><path d="M26 64l8 12-8 16M60 64l-6 14 12 14M92 64l-8 12 12 16"/><path class="s" d="M34 76h22M66 78h18"/><path d="M26 64V36M26 48l-10-10M26 42l10-8"/>`,
  puting: `<path d="M18 18q42 12 84 0"/><path d="M26 30q34 10 68 0" /><path d="M36 42q24 8 48 0"/><path d="M44 54q16 6 32 0"/><path d="M50 66q10 4 20 0"/><path d="M56 78q4 3 8 0M60 78v14"/><path class="s" d="M12 40h14M96 28h14M104 56h8M10 64h20"/><path class="s" d="M88 74l8-4 4 8zM16 82l8-2-2 8z"/>`,
  meteor: `<circle cx="86" cy="32" r="16"/><path class="s" d="M80 28q4-4 8 0M90 38q3 0 4-3"/><path d="M74 44 18 88M86 50 40 92M70 24 20 58"/><path d="M8 94q12-8 24 0M96 90q8-6 16 0" class="s"/>${sp(20, 24, 5)}${sp(104, 70, 5)}`,
  meteorstorm: `<path d="M78 20 52 46M92 32 66 58M58 12 38 34"/><circle cx="76" cy="18" r="6"/><circle cx="92" cy="30" r="6"/><circle cx="58" cy="10" r="5"/><path d="M14 92V70h12v22M30 92V56h14v36M48 92V76h12v16M68 92V62h12l4 10v20M88 92V72h14v20"/><path d="M8 92h104"/>${sp(16, 24, 4)}${sp(104, 54, 4)}`,
  petir: `<path d="M68 6 34 54h26L48 94 90 40H64L76 6z"/><path class="s" d="M24 20q10-8 20 0M84 66q8-6 16 0M100 20l8-8M104 34h8"/>${sp(20, 70, 5)}`,
};

/** id kartu -> motif */
const MAP: Record<string, string> = {};
[
  'tilang',
  'tv',
  'box',
  'ayam',
  'ban',
  'cart',
  'sofa',
  'atm',
  'book',
  'phone',
  'family',
  'coffee',
  'detective',
  'laptop',
  'cake',
  'house',
  'gift',
  'glasses',
  'wrench',
  'faucet',
  'parking',
  'gas',
  'wallet',
  'watch',
  'receipt',
  'fridge',
  'card',
  'ticket',
  'noodlepack',
  'bank',
  'truckFence',
  'alarm',
  'umbrella',
  'gamepad',
  'tent',
  'tooth',
  'mailbox',
  'broom',
  'ewallet',
  'durian',
  'ricecooker',
  'printer',
  'noodle',
  'wifi',
  'dinner',
  'washer',
  'shoe',
  'bulb',
  'taxi',
  'roadwork',
  'map',
  'scooter',
  'train',
  'flag',
  'sandal',
  'signpost',
  'bus',
  'pothole',
  'ferry',
  'sleep',
  'candle',
  'chat',
  'basket',
  'menu',
  'tissue',
  'key',
  'station',
  'nosignal',
  'chili',
  'ferris',
  'motorbike',
  'carfuel',
  'badge',
  'pill',
  'tub',
  'parcel',
  'clothes',
  'siren',
  'ambulance',
  'stopsign',
].forEach((k, i) => (MAP[`nb-${i}`] = k));
[
  'popper',
  'jeans',
  'banknote',
  'cupcake',
  'egg',
  'gift',
  'cashback',
  'sawah',
  'medal',
  'handshake',
  'dadu',
  'harta',
  'jalan',
  'truckRamah',
  'lampuHijau',
  'tol',
  'voucher',
  'bata',
  'gulungan',
  'rendang',
].forEach((k, i) => (MAP[`ng-${i}`] = k));
[
  'banjir',
  'rob',
  'merapi',
  'gempa',
  'tsunami',
  'kebakaran',
  'longsor',
  'kering',
  'puting',
  'meteor',
  'meteorstorm',
  'petir',
].forEach((k, i) => (MAP[`bc-${i}`] = k));
// kartu penjara (nb-75..79): tambahkan jeruji di pojok
for (let i = 75; i <= 79; i++) {
  const k = MAP[`nb-${i}`]!;
  const jk = `${k}Jail`;
  ART[jk] = ART[k]! + '%BARS%';
  MAP[`nb-${i}`] = jk;
}
// mie ayam (nb-42) memakai mangkuk
ART.noodle = `<path d="M16 54h88q0 30-44 30T16 54z"/><path d="M26 54q8-14 17 0t17 0 17 0"/><path d="M70 10 98 50M82 8l24 38"/><path class="s" d="M36 40q-6-8 0-14M50 38q-6-8 0-14"/><path class="s" d="M34 92h52"/>`;
// musibah cuaca (HazardHit)
MAP['hz-banjir'] = 'banjir';
MAP['hz-petir'] = 'petir';
MAP['hz-api'] = 'kebakaran';

/** Motif bawaan bila id tidak dikenal. */
const FALLBACK: Record<string, string> = { NASIB: 'gift', BENCANA: 'puting' };

/** SVG gambar garis untuk kartu `id`. `cls` = kelas CSS tambahan (ukuran). */
export function cardArt(id: string, kind: 'NASIB' | 'BENCANA' = 'NASIB', cls = ''): string {
  const key = MAP[id] ?? FALLBACK[kind]!;
  const body = (ART[key] ?? ART[FALLBACK[kind]!]!).replace('%BARS%', BARS);
  return `<svg class="cart ${cls}" data-art="${key}" viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** Semua kunci motif (untuk tes dan galeri). */
export const ART_KEYS = Object.keys(ART);
export const ART_MAP = MAP;
