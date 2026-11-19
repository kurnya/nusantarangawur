// Modul ini sengaja tetap bersumber dari reference/prototype agar acuan audio tidak terduplikasi.
// @ts-expect-error Modul JavaScript referensi belum memiliki deklarasi TypeScript.
import { Snd as ReferenceSnd } from '../reference/prototype/snd-audio-module.js';
import { playDisaster } from './disasterAudio';

export interface AudioSettings {
  music: number;
  sfx: number;
  amb: number;
  mute: boolean;
}

type AudioApi = typeof ReferenceSnd;

interface Bus {
  sfx: AudioNode;
}

// Efek bencana memakai sintesis yang lebih realistis; kunci lain tetap memakai tabel referensi.
const referenceFx = ReferenceSnd.fx.bind(ReferenceSnd) as (key: string) => void;
ReferenceSnd.fx = (key: string): void => {
  const bus = ReferenceSnd._bus() as Bus | null;
  const ctx = (bus?.sfx as (AudioNode & { context: BaseAudioContext }) | undefined)?.context;
  if (!bus || !ctx || ReferenceSnd.st.mute || ctx.state !== 'running') return;
  if (playDisaster(key, ctx, bus.sfx)) ReferenceSnd.duck(5200);
  else referenceFx(key);
};

export const audio = ReferenceSnd as AudioApi & {
  readonly st: AudioSettings;
};

export function startAudio(): void {
  audio.start();
}
