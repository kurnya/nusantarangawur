/**
 * Efek suara bencana yang lebih realistis (Web Audio, tanpa berkas).
 * Dibangun di atas konteks dan bus milik reference/prototype/snd-audio-module.js tanpa mengubahnya.
 * Tiap bencana dirakit dari lapisan: gemuruh derau cokelat, siulan angin, letupan, pecahan material, dan gema.
 */

export type DisasterKey =
  | 'banjir'
  | 'rob'
  | 'tsunami'
  | 'merapi'
  | 'krakatau'
  | 'gempa'
  | 'lombok'
  | 'kebakaran'
  | 'longsor'
  | 'kering'
  | 'puting'
  | 'meteor'
  | 'meteorstorm'
  | 'petir';

interface Kit {
  ctx: BaseAudioContext;
  out: AudioNode;
  white: AudioBuffer;
  brown: AudioBuffer;
  verb: ConvolverNode;
}

interface Layer {
  buf?: 'white' | 'brown';
  type?: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  g: number;
  att?: number;
  hold?: number;
  rel?: number;
  pan?: number;
  wet?: number;
  /** goyangan amplitudo: [Hz, kedalaman 0..1] */
  am?: [number, number];
  /** goyangan frekuensi saring: [Hz, kedalaman dalam Hz] */
  fm?: [number, number];
  rate?: number;
}

const R = Math.random;
const rr = (a: number, b: number): number => a + R() * (b - a);

const kits = new WeakMap<BaseAudioContext, Kit>();

function makeBuffers(ctx: BaseAudioContext): {
  white: AudioBuffer;
  brown: AudioBuffer;
} {
  const n = Math.floor(ctx.sampleRate * 4);
  const white = ctx.createBuffer(1, n, ctx.sampleRate);
  const brown = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0);
  const b = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const x = R() * 2 - 1;
    w[i] = x;
    last = (last + 0.02 * x) / 1.02;
    b[i] = last * 3.5;
  }
  // sambung ujung supaya putaran tidak berdetak
  const f = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < f; i++) {
    const a = i / f;
    w[n - f + i] = w[n - f + i]! * (1 - a) + w[i]! * a;
    b[n - f + i] = b[n - f + i]! * (1 - a) + b[i]! * a;
  }
  return { white, brown };
}

function makeVerb(ctx: BaseAudioContext, sec: number): ConvolverNode {
  const n = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lp += (R() * 2 - 1 - lp) * (0.5 - 0.4 * t);
      d[i] = lp * Math.pow(1 - t, 2.6) * (t < 0.01 ? t / 0.01 : 1);
    }
  }
  const v = ctx.createConvolver();
  v.buffer = buf;
  return v;
}

function kitFor(ctx: BaseAudioContext, out: AudioNode): Kit {
  let k = kits.get(ctx);
  if (!k || k.out !== out) {
    const verb = makeVerb(ctx, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    verb.connect(wet);
    wet.connect(out);
    k = { ctx, out, ...makeBuffers(ctx), verb };
    kits.set(ctx, k);
  }
  return k;
}

function panned(k: Kit, pan: number | undefined, src: AudioNode, wet: number | undefined): void {
  let dest: AudioNode = k.out;
  if (pan && k.ctx.createStereoPanner) {
    const p = k.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(k.out);
    dest = p;
  }
  src.connect(dest);
  if (wet) {
    const w = k.ctx.createGain();
    w.gain.value = wet;
    src.connect(w);
    w.connect(k.verb);
  }
}

/** Satu lapisan derau tersaring dengan selubung serang, tahan, dan lepas. */
function layer(k: Kit, t: number, dur: number, o: Layer): void {
  const { ctx } = k;
  const s = ctx.createBufferSource();
  s.buffer = o.buf === 'white' ? k.white : k.brown;
  s.loop = true;
  s.playbackRate.value = o.rate ?? 1;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.f, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  f.Q.value = o.q ?? 0.7;
  const g = ctx.createGain();
  const att = o.att ?? 0.02;
  const rel = o.rel ?? Math.max(0.05, dur * 0.35);
  const hold = Math.max(att + 0.01, o.hold ?? dur - rel);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.g, t + att);
  g.gain.setValueAtTime(o.g, t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const mods: OscillatorNode[] = [];
  if (o.am) {
    const lfo = ctx.createOscillator();
    const d = ctx.createGain();
    lfo.frequency.value = o.am[0];
    d.gain.value = o.g * o.am[1];
    lfo.connect(d);
    d.connect(g.gain);
    mods.push(lfo);
  }
  if (o.fm) {
    const lfo = ctx.createOscillator();
    const d = ctx.createGain();
    lfo.frequency.value = o.fm[0] * 0.37 + 0.11;
    d.gain.value = o.fm[1];
    lfo.connect(d);
    d.connect(f.frequency);
    mods.push(lfo);
  }
  s.connect(f);
  f.connect(g);
  panned(k, o.pan, g, o.wet);
  s.start(t, R() * 3);
  s.stop(t + dur + 0.05);
  mods.forEach((m) => {
    m.start(t);
    m.stop(t + dur + 0.05);
  });
}

/** Dentuman bernada rendah yang turun (ledakan, benda jatuh). */
function thump(
  k: Kit,
  t: number,
  f0: number,
  f1: number,
  dur: number,
  g: number,
  pan = 0,
  wet = 0.4,
): void {
  const { ctx } = k;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur);
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.linearRampToValueAtTime(g, t + 0.008);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn);
  panned(k, pan, gn, wet);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Letupan derau singkat (retakan, batu, percik api). */
function tick(
  k: Kit,
  t: number,
  f: number,
  dur: number,
  g: number,
  o: {
    q?: number;
    type?: BiquadFilterType;
    pan?: number;
    wet?: number;
    buf?: 'white' | 'brown';
  } = {},
): void {
  layer(k, t, dur, {
    buf: o.buf ?? 'white',
    type: o.type ?? 'bandpass',
    f,
    q: o.q ?? 1.2,
    g,
    att: 0.002,
    hold: 0.004,
    rel: dur,
    pan: o.pan,
    wet: o.wet,
  });
}

/** Siulan bernada (angin dalam celah, benda jatuh) lewat osilator dan derau sempit. */
function whistle(k: Kit, t: number, dur: number, f0: number, f1: number, g: number, pan = 0): void {
  layer(k, t, dur, {
    buf: 'white',
    type: 'bandpass',
    f: f0,
    f2: f1,
    q: 18,
    g,
    att: dur * 0.1,
    rel: dur * 0.4,
    pan,
    wet: 0.3,
  });
}

/** Gemuruh guntur: beberapa ayunan acak dari derau cokelat yang disaring turun. */
function rolling(k: Kit, t: number, dur: number, g: number, pan = 0): void {
  layer(k, t, dur, {
    buf: 'brown',
    type: 'lowpass',
    f: 420,
    f2: 70,
    q: 0.6,
    g,
    att: 0.12,
    rel: dur * 0.6,
    pan,
    wet: 0.7,
  });
  const swells = 3 + Math.floor(R() * 3);
  for (let i = 0; i < swells; i++) {
    const at = t + 0.25 + (i / swells) * dur * 0.7 + R() * 0.3;
    const d = rr(0.7, 1.5);
    layer(k, at, d, {
      buf: 'brown',
      type: 'lowpass',
      f: rr(260, 520),
      f2: 80,
      q: 0.5,
      g: g * rr(0.45, 0.9),
      att: d * 0.25,
      rel: d * 0.6,
      pan: pan + rr(-0.3, 0.3),
      wet: 0.6,
    });
  }
}

/* ---------------------------- bencana ---------------------------- */

function petir(k: Kit, t: number, pan = 0, dist = 0): void {
  const near = 1 - dist;
  // sambaran: retakan lebar, lalu derak pendek berurutan
  tick(k, t, 3400, 0.09, 0.32 * near + 0.05, { q: 0.4, type: 'highpass', pan });
  tick(k, t + 0.012, 1500, 0.2, 0.3 * near + 0.05, { q: 0.5, pan });
  for (let i = 0; i < 5; i++)
    tick(k, t + 0.05 + i * rr(0.03, 0.09), rr(700, 2600), rr(0.03, 0.09), 0.14 * near, {
      q: 0.9,
      pan,
    });
  thump(k, t + 0.03, 90, 38, 0.5, 0.3 * near + 0.05, pan, 0.6);
  rolling(k, t + 0.1 + dist * 0.5, 3.4 + dist, 0.34 * near + 0.08, pan);
}

function merapi(k: Kit, t: number, scale = 1): void {
  // geram sebelum meletus
  layer(k, t, 3.0, {
    buf: 'brown',
    type: 'lowpass',
    f: 110,
    f2: 190,
    q: 0.7,
    g: 0.22 * scale,
    att: 0.7,
    hold: 1.2,
    am: [9, 0.35],
    wet: 0.2,
  });
  thump(k, t, 46, 32, 1.2, 0.1 * scale, 0, 0.3);
  // letusan utama
  const b = t + 0.45;
  thump(k, b, 78, 24, 2.0, 0.34 * scale, 0, 0.5);
  thump(k, b + 0.05, 52, 22, 2.8, 0.26 * scale, 0, 0.5);
  layer(k, b, 1.2, {
    buf: 'white',
    type: 'lowpass',
    f: 2600,
    f2: 220,
    q: 0.5,
    g: 0.34 * scale,
    att: 0.006,
    rel: 1.1,
    wet: 0.5,
  });
  layer(k, b, 5.2, {
    buf: 'brown',
    type: 'lowpass',
    f: 380,
    f2: 100,
    q: 0.6,
    g: 0.38 * scale,
    att: 0.1,
    hold: 1.6,
    wet: 0.5,
  });
  // raungan kolom abu yang naik
  layer(k, b + 0.1, 4.6, {
    buf: 'brown',
    type: 'bandpass',
    f: 220,
    f2: 520,
    q: 0.8,
    g: 0.2 * scale,
    att: 0.9,
    hold: 2.4,
    am: [3.2, 0.3],
    fm: [4, 70],
    wet: 0.4,
  });
  // desis gas dan abu halus
  layer(k, b + 0.2, 4.2, {
    buf: 'white',
    type: 'bandpass',
    f: 1500,
    f2: 700,
    q: 0.6,
    g: 0.07 * scale,
    att: 0.6,
    hold: 1.8,
  });
  // batuan jatuh (dentuman dan retakan acak)
  for (let i = 0; i < 16; i++) {
    const at = b + 0.9 + R() * 3.6;
    const p = rr(-0.8, 0.8);
    thump(k, at, rr(70, 150), 40, rr(0.12, 0.3), rr(0.07, 0.18) * scale, p, 0.4);
    tick(k, at, rr(400, 1400), rr(0.05, 0.12), rr(0.05, 0.1) * scale, {
      pan: p,
      q: 0.8,
    });
  }
  // kilat vulkanik
  petir(k, b + 1.4, rr(-0.4, 0.4), 0.35);
  petir(k, b + 2.7, rr(-0.5, 0.5), 0.5);
}

function puting(k: Kit): void {
  const t = k.ctx.currentTime + 0.02;
  // raungan putaran: derau cokelat rendah berdenyut seirama putaran corong
  layer(k, t, 5.4, {
    buf: 'brown',
    type: 'lowpass',
    f: 160,
    f2: 260,
    q: 0.8,
    g: 0.42,
    att: 1.8,
    hold: 3.6,
    am: [5.5, 0.28],
    wet: 0.2,
  });
  layer(k, t, 5.6, {
    buf: 'brown',
    type: 'bandpass',
    f: 260,
    f2: 480,
    q: 1.4,
    g: 0.26,
    att: 1.6,
    hold: 3.6,
    am: [2.6, 0.3],
    fm: [3, 80],
    wet: 0.3,
  });
  // lolongan angin bernada, bergeser naik dan turun
  layer(k, t, 5.2, {
    buf: 'white',
    type: 'bandpass',
    f: 520,
    f2: 1100,
    q: 5,
    g: 0.1,
    att: 1.4,
    hold: 3.2,
    fm: [2.2, 260],
    am: [1.1, 0.45],
    pan: -0.3,
    wet: 0.35,
  });
  layer(k, t + 0.3, 4.8, {
    buf: 'white',
    type: 'bandpass',
    f: 880,
    f2: 520,
    q: 6,
    g: 0.07,
    att: 1.4,
    hold: 2.8,
    fm: [1.7, 300],
    am: [1.6, 0.5],
    pan: 0.3,
    wet: 0.35,
  });
  layer(k, t, 5.0, {
    buf: 'white',
    type: 'bandpass',
    f: 1800,
    f2: 3000,
    q: 0.9,
    g: 0.05,
    att: 1.5,
    hold: 2.8,
    am: [7, 0.3],
  });
  // serpihan menghantam dan kayu patah, makin ramai saat corong mendekat
  for (let i = 0; i < 48; i++) {
    const u = R();
    const at = t + 0.9 + u * 3.6;
    const w = Math.sin(Math.min(1, u * 1.1) * Math.PI * 0.9) + 0.25;
    const p = rr(-0.9, 0.9);
    tick(k, at, rr(500, 3200), rr(0.03, 0.1), 0.06 * w, { pan: p, q: 1.5 });
    if (R() < 0.35) thump(k, at, rr(110, 260), 70, rr(0.06, 0.14), 0.06 * w, p, 0.3);
  }
  for (let i = 0; i < 4; i++) {
    const at = t + 1.8 + R() * 2.4;
    tick(k, at, rr(700, 1200), 0.07, 0.12, { q: 3 });
    tick(k, at + 0.05, rr(300, 520), 0.16, 0.1, { q: 2, buf: 'brown' });
  }
  // petir di dalam awan induk
  rolling(k, t + 1.5, 3.6, 0.2, -0.2);
}

function gempa(k: Kit, long = false): void {
  const t = k.ctx.currentTime + 0.02;
  const D = long ? 5.4 : 4.4;
  // dentum awal lalu getaran rendah yang tidak beraturan
  thump(k, t, 60, 28, 1.4, 0.3, 0, 0.3);
  layer(k, t, D, {
    buf: 'brown',
    type: 'lowpass',
    f: 95,
    f2: 140,
    q: 0.7,
    g: 0.5,
    att: 0.5,
    hold: D * 0.6,
    am: [7.3, 0.4],
    wet: 0.15,
  });
  layer(k, t, D, {
    buf: 'brown',
    type: 'lowpass',
    f: 190,
    f2: 120,
    q: 0.6,
    g: 0.3,
    att: 0.9,
    hold: D * 0.55,
    am: [13, 0.45],
    wet: 0.2,
  });
  // gemeretak struktur
  layer(k, t + 0.6, D - 1, {
    buf: 'white',
    type: 'bandpass',
    f: 220,
    f2: 140,
    q: 8,
    g: 0.04,
    att: 0.8,
    hold: D * 0.5,
    fm: [3, 60],
    am: [4, 0.8],
    wet: 0.3,
  });
  // barang bergetar
  for (let i = 0; i < 70; i++) {
    const u = R();
    const at = t + 0.3 + u * (D - 0.8);
    const amp = (1 - Math.abs(u - 0.4) * 1.1) * 0.5 + 0.2;
    const p = rr(-0.9, 0.9);
    tick(k, at, rr(600, 3000), rr(0.015, 0.05), 0.07 * amp, { q: 3, pan: p });
    if (R() < 0.3) thump(k, at, rr(180, 420), 120, 0.05, 0.05 * amp, p, 0.2);
  }
  // dentuman benturan besar
  for (let i = 0; i < (long ? 6 : 4); i++) {
    const at = t + 0.9 + R() * (D - 1.8);
    thump(k, at, rr(70, 110), 40, 0.3, 0.2, rr(-0.5, 0.5), 0.4);
    tick(k, at, rr(300, 800), 0.18, 0.12, { q: 0.8, buf: 'brown' });
  }
  if (long) {
    // runtuhan bangunan
    for (let i = 0; i < 30; i++) {
      const at = t + 2.2 + R() * 3;
      tick(k, at, rr(300, 1800), rr(0.04, 0.12), 0.1, {
        q: 0.9,
        pan: rr(-0.8, 0.8),
      });
      if (R() < 0.4) thump(k, at, rr(90, 200), 55, rr(0.08, 0.2), 0.1, rr(-0.8, 0.8));
    }
    layer(k, t + 2.2, 3, {
      buf: 'brown',
      type: 'lowpass',
      f: 420,
      f2: 100,
      q: 0.5,
      g: 0.22,
      att: 0.2,
      wet: 0.4,
    });
  }
}

function tsunami(k: Kit): void {
  const t = k.ctx.currentTime + 0.02;
  // air surut dan raungan jauh yang membesar
  layer(k, t, 2.4, {
    buf: 'brown',
    type: 'lowpass',
    f: 130,
    f2: 380,
    q: 0.6,
    g: 0.2,
    att: 1.8,
    hold: 1.8,
  });
  layer(k, t, 7, {
    buf: 'brown',
    type: 'lowpass',
    f: 150,
    f2: 700,
    q: 0.5,
    g: 0.46,
    att: 3.0,
    hold: 3.4,
    am: [0.8, 0.2],
    wet: 0.3,
  });
  // hantaman gelombang
  const h = t + 3.0;
  thump(k, h, 68, 26, 1.6, 0.3, 0, 0.5);
  layer(k, h, 3.8, {
    buf: 'white',
    type: 'bandpass',
    f: 1700,
    f2: 380,
    q: 0.5,
    g: 0.34,
    att: 0.25,
    hold: 0.8,
    wet: 0.5,
  });
  layer(k, h, 5.0, {
    buf: 'brown',
    type: 'lowpass',
    f: 900,
    f2: 160,
    q: 0.5,
    g: 0.38,
    att: 0.3,
    hold: 1.4,
    wet: 0.5,
  });
  // puing dan kayu terbawa arus, lalu air bergolak
  for (let i = 0; i < 30; i++) {
    const at = h + 0.2 + R() * 4;
    const p = rr(-0.9, 0.9);
    tick(k, at, rr(250, 1400), rr(0.05, 0.14), 0.06, {
      q: 0.8,
      pan: p,
      buf: R() < 0.5 ? 'brown' : 'white',
    });
    if (R() < 0.3) thump(k, at, rr(90, 200), 60, 0.1, 0.1, p, 0.3);
  }
  gurgle(k, h + 0.6, 4, 0.5);
}

function gurgle(k: Kit, t: number, dur: number, amt: number): void {
  const { ctx } = k;
  for (let i = 0; i < 26 * amt + 6; i++) {
    const at = t + R() * dur;
    const f = rr(180, 520);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * rr(1.6, 2.6), at + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(rr(0.02, 0.05) * amt + 0.01, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    o.connect(g);
    panned(k, rr(-0.8, 0.8), g, 0.25);
    o.start(at);
    o.stop(at + 0.12);
  }
}

function banjir(k: Kit, light: boolean): void {
  const t = k.ctx.currentTime + 0.02;
  const a = light ? 0.55 : 1;
  const D = light ? 4.2 : 5.2;
  // arus deras: derau merah muda bergelombang pelan
  layer(k, t, D, {
    buf: 'white',
    type: 'bandpass',
    f: 700,
    f2: 520,
    q: 0.45,
    g: 0.15 * a,
    att: 1.0,
    hold: D * 0.6,
    am: [0.7, 0.3],
    fm: [0.6, 160],
    wet: 0.2,
  });
  layer(k, t, D, {
    buf: 'brown',
    type: 'lowpass',
    f: 420,
    f2: 300,
    q: 0.5,
    g: 0.34 * a,
    att: 1.2,
    hold: D * 0.6,
    am: [1.3, 0.25],
    wet: 0.2,
  });
  layer(k, t + 0.2, D - 0.4, {
    buf: 'white',
    type: 'highpass',
    f: 3500,
    q: 0.4,
    g: 0.04 * a,
    att: 1.4,
    hold: D * 0.55,
  });
  // gelembung dan percikan
  gurgle(k, t + 0.5, D - 1, light ? 0.5 : 1);
  for (let i = 0; i < (light ? 8 : 16); i++) {
    const at = t + 0.6 + R() * (D - 1.2);
    tick(k, at, rr(1200, 2800), rr(0.06, 0.16), 0.05 * a, {
      q: 0.8,
      pan: rr(-0.8, 0.8),
      wet: 0.3,
    });
  }
  if (!light) {
    // benda hanyut menabrak
    for (let i = 0; i < 6; i++)
      thump(k, t + 1 + R() * 3.5, rr(110, 220), 70, 0.12, 0.1, rr(-0.7, 0.7));
  } else {
    // ombak kecil menghempas pantai berulang
    for (let i = 0; i < 4; i++) {
      const at = t + i * 1.0;
      layer(k, at, 1.0, {
        buf: 'white',
        type: 'bandpass',
        f: 500,
        f2: 1600,
        q: 0.5,
        g: 0.1,
        att: 0.5,
        rel: 0.5,
        wet: 0.3,
      });
    }
  }
}

function kebakaran(k: Kit): void {
  const t = k.ctx.currentTime + 0.02;
  const D = 5.2;
  // raungan api yang menyedot udara
  layer(k, t, D, {
    buf: 'brown',
    type: 'lowpass',
    f: 380,
    f2: 560,
    q: 0.7,
    g: 0.3,
    att: 0.9,
    hold: 3.2,
    am: [2.1, 0.35],
    fm: [1.8, 120],
    wet: 0.2,
  });
  layer(k, t, D, {
    buf: 'white',
    type: 'bandpass',
    f: 1100,
    f2: 1700,
    q: 0.6,
    g: 0.09,
    att: 0.9,
    hold: 3.0,
    am: [5.2, 0.5],
    fm: [3, 400],
  });
  layer(k, t + 0.1, D - 0.2, {
    buf: 'white',
    type: 'highpass',
    f: 4200,
    q: 0.5,
    g: 0.025,
    att: 1,
    hold: 3,
  });
  // letupan kayu terbakar: padat dan acak
  for (let i = 0; i < 150; i++) {
    const u = R();
    const at = t + 0.1 + u * (D - 0.5);
    const env = 0.35 + 0.65 * Math.sin(Math.min(1, u * 1.15) * Math.PI);
    const big = R() < 0.1;
    tick(
      k,
      at,
      rr(1500, 6000),
      big ? rr(0.03, 0.06) : rr(0.006, 0.025),
      (big ? 0.14 : rr(0.03, 0.08)) * env,
      { q: rr(0.8, 3), pan: rr(-0.9, 0.9) },
    );
    if (big) thump(k, at, rr(160, 320), 90, 0.07, 0.07 * env, rr(-0.6, 0.6), 0.2);
  }
  // sambaran api tiba-tiba
  for (let i = 0; i < 3; i++) {
    const at = t + 0.8 + R() * 3.4;
    layer(k, at, 0.9, {
      buf: 'white',
      type: 'bandpass',
      f: 500,
      f2: 1400,
      q: 0.5,
      g: 0.13,
      att: 0.15,
      rel: 0.7,
      wet: 0.2,
    });
  }
}

function longsor(k: Kit): void {
  const t = k.ctx.currentTime + 0.02;
  const D = 5.2;
  // gemuruh tanah yang bergerak
  layer(k, t, D, {
    buf: 'brown',
    type: 'lowpass',
    f: 150,
    f2: 260,
    q: 0.7,
    g: 0.45,
    att: 0.8,
    hold: 2.8,
    am: [6, 0.3],
    wet: 0.2,
  });
  layer(k, t + 0.2, D - 0.4, {
    buf: 'brown',
    type: 'bandpass',
    f: 320,
    f2: 160,
    q: 0.8,
    g: 0.3,
    att: 0.6,
    hold: 2.5,
    am: [3.7, 0.4],
  });
  layer(k, t + 0.3, D - 0.8, {
    buf: 'white',
    type: 'bandpass',
    f: 1100,
    f2: 400,
    q: 0.6,
    g: 0.07,
    att: 0.5,
    hold: 2.2,
  });
  // batu menggelinding: padat di awal lalu jarang
  for (let i = 0; i < 70; i++) {
    const u = Math.pow(R(), 1.5);
    const at = t + 0.2 + u * (D - 0.6);
    const amp = 1 - u * 0.6;
    const p = rr(-0.9, 0.9);
    thump(k, at, rr(70, 200), 40, rr(0.07, 0.22), rr(0.05, 0.16) * amp, p, 0.3);
    tick(k, at, rr(350, 2200), rr(0.03, 0.1), rr(0.05, 0.1) * amp, {
      q: 0.9,
      pan: p,
    });
  }
  // timpaan besar di ujung
  thump(k, t + 3.4, 65, 30, 1.0, 0.28, 0, 0.5);
  layer(k, t + 3.4, 1.8, {
    buf: 'brown',
    type: 'lowpass',
    f: 600,
    f2: 140,
    q: 0.5,
    g: 0.3,
    att: 0.01,
    rel: 1.6,
    wet: 0.5,
  });
}

function kering(k: Kit): void {
  const t = k.ctx.currentTime + 0.02;
  const D = 5.0;
  // angin panas yang kering berembus
  layer(k, t, D, {
    buf: 'white',
    type: 'bandpass',
    f: 600,
    f2: 900,
    q: 0.9,
    g: 0.1,
    att: 1.4,
    hold: 2.8,
    am: [0.45, 0.5],
    fm: [0.5, 220],
    wet: 0.2,
  });
  layer(k, t, D, {
    buf: 'brown',
    type: 'lowpass',
    f: 220,
    f2: 330,
    q: 0.5,
    g: 0.16,
    att: 1.6,
    hold: 2.6,
    am: [0.3, 0.4],
  });
  // butir pasir tertiup
  layer(k, t + 0.5, D - 1, {
    buf: 'white',
    type: 'highpass',
    f: 4800,
    q: 0.5,
    g: 0.035,
    att: 1.2,
    hold: 2.4,
    am: [3.8, 0.8],
    pan: 0.2,
  });
  // tanah merekah dan gemeretak kering
  for (let i = 0; i < 14; i++) {
    const at = t + 0.8 + R() * 3.6;
    const p = rr(-0.8, 0.8);
    tick(k, at, rr(1800, 4200), rr(0.01, 0.03), 0.09, { q: 2.5, pan: p });
    if (R() < 0.4) tick(k, at + 0.02, rr(600, 1200), 0.05, 0.06, { q: 2, pan: p });
  }
  // dengung panas yang jauh
  layer(k, t, D, {
    buf: 'white',
    type: 'bandpass',
    f: 196,
    q: 14,
    g: 0.012,
    att: 1.6,
    hold: 2.6,
    am: [0.2, 0.6],
  });
}

function meteor(k: Kit, t: number, pan = 0, size = 1): void {
  // desing jatuh: siulan turun disusul derau udara terbelah
  whistle(k, t, 1.3, 3200, 380, 0.07 * size, pan);
  layer(k, t, 1.3, {
    buf: 'white',
    type: 'bandpass',
    f: 2400,
    f2: 260,
    q: 0.7,
    g: 0.16 * size,
    att: 0.5,
    hold: 0.9,
    pan,
    wet: 0.3,
  });
  layer(k, t + 0.3, 1.0, {
    buf: 'brown',
    type: 'lowpass',
    f: 140,
    f2: 300,
    q: 0.7,
    g: 0.14 * size,
    att: 0.6,
    hold: 0.6,
    pan,
  });
  // hantaman
  const h = t + 1.2;
  tick(k, h, 2400, 0.12, 0.3 * size, { q: 0.4, pan, type: 'highpass' });
  thump(k, h, 90, 24, 1.8, 0.4 * size, pan, 0.5);
  layer(k, h, 2.4, {
    buf: 'brown',
    type: 'lowpass',
    f: 700,
    f2: 100,
    q: 0.5,
    g: 0.34 * size,
    att: 0.01,
    rel: 2.2,
    pan,
    wet: 0.5,
  });
  for (let i = 0; i < 12; i++) {
    const at = h + 0.1 + R() * 1.8;
    tick(k, at, rr(500, 2400), rr(0.03, 0.09), 0.07 * size, {
      q: 1,
      pan: pan + rr(-0.4, 0.4),
    });
    if (R() < 0.4) thump(k, at, rr(110, 220), 70, 0.1, 0.07 * size, pan + rr(-0.4, 0.4));
  }
}

function meteorstorm(k: Kit): void {
  const t = k.ctx.currentTime + 0.02;
  const n = 7;
  for (let i = 0; i < n; i++) meteor(k, t + i * 0.55 + R() * 0.3, rr(-0.8, 0.8), rr(0.45, 0.8));
  layer(k, t + 0.5, 5.4, {
    buf: 'brown',
    type: 'lowpass',
    f: 120,
    f2: 170,
    q: 0.7,
    g: 0.2,
    att: 1.2,
    hold: 3,
    am: [4, 0.3],
  });
}

/** Memutar efek suara bencana. Mengembalikan false bila kuncinya tidak ditangani modul ini. */
export function playDisaster(key: string, ctx: BaseAudioContext, out: AudioNode): boolean {
  const k = kitFor(ctx, out);
  switch (key) {
    case 'banjir':
      banjir(k, false);
      return true;
    case 'rob':
      banjir(k, true);
      return true;
    case 'tsunami':
      tsunami(k);
      return true;
    case 'merapi':
      merapi(k, k.ctx.currentTime + 0.02, 1);
      return true;
    case 'krakatau':
      merapi(k, k.ctx.currentTime + 0.02, 1.25);
      return true;
    case 'gempa':
      gempa(k, false);
      return true;
    case 'lombok':
      gempa(k, true);
      return true;
    case 'kebakaran':
      kebakaran(k);
      return true;
    case 'longsor':
      longsor(k);
      return true;
    case 'kering':
      kering(k);
      return true;
    case 'puting':
      puting(k);
      return true;
    case 'meteor':
      meteor(k, k.ctx.currentTime + 0.02);
      return true;
    case 'meteorstorm':
      meteorstorm(k);
      return true;
    case 'petir':
      petir(k, k.ctx.currentTime + 0.02);
      return true;
    default:
      return false;
  }
}

/** Membuat kit audio setelah gestur pengguna, tanpa mengeluarkan suara. */
export function warmDisasterAudio(ctx: BaseAudioContext, out: AudioNode): void {
  // Hanya membangun reverb dan buffer derau; suara bencana pertama tetap murni milik pemain.
  kitFor(ctx, out);
}
