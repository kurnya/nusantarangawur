// Ekstrak data statis dari reference/prototype/index.html ke src/engine/data/*.json
// Jalankan: node scripts/extract-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync('reference/prototype/index.html', 'utf8');
const cut = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`marker tidak ketemu: ${from} / ${to}`);
  return src.slice(a, b);
};
const dataSrc = cut('const REG={', '/* ---- aset gambar');
const fxSrc = cut('const FXMAP=', 'View.fxKeys=').trim().replace(/;$/, '');

const D = new Function(
  `${dataSrc}; return {REG,RAW,PROV,PORDER,GAPS,SPECIAL,TILES,NASIB_BAD,NASIB_GOOD,BENCANA,TOK};`,
)();
const FXMAP = new Function(`${fxSrc}; return FXMAP;`)();
const fxKey = (x) => FXMAP.find((r) => r[0].test(x))?.[1] ?? null;

const out = 'src/engine/data';
mkdirSync(out, { recursive: true });
const w = (name, obj) => writeFileSync(`${out}/${name}.json`, JSON.stringify(obj, null, 1) + '\n');

w(
  'regions',
  Object.entries(D.REG).map(([code, r]) => ({ code, name: r.n, color: r.c })),
);
w(
  'provinces',
  D.PORDER.map((code) => {
    const p = D.PROV[code];
    return {
      code,
      idx: p.idx,
      name: p.name,
      reg: p.reg,
      price: p.price,
      hue: p.hue,
      cities: p.cities.map((c) => ({ n: c.n, e: c.e, t: c.t })),
    };
  }),
);
w(
  'tiles',
  D.TILES.map((T) => (T.t === 'sp' ? { t: 'sp', k: T.k } : { t: 'city', p: T.p.code, ci: T.ci })),
);
w(
  'special',
  Object.entries(D.SPECIAL).map(([k, s]) => ({ k, label: s.lb, emoji: s.ic })),
);
w(
  'pawns',
  D.TOK.map(([emoji, name, color]) => ({ emoji, name, color })),
);
const card = (kind) => (c, i) => ({ id: `${kind}-${i}`, x: c.x, e: c.e, em: c.em, fx: fxKey(c.x) });
w('cards', {
  nasibBad: D.NASIB_BAD.map(card('nb')),
  nasibGood: D.NASIB_GOOD.map(card('ng')),
  bencana: D.BENCANA.map(card('bc')),
});
console.log('tiles', D.TILES.length, 'provinsi', D.PORDER.length);
