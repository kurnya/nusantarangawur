// Modul ini sengaja tetap bersumber dari reference/prototype agar acuan audio tidak terduplikasi.
// @ts-expect-error Modul JavaScript referensi belum memiliki deklarasi TypeScript.
import { Snd as ReferenceSnd } from '../reference/prototype/snd-audio-module.js';

export interface AudioSettings {
  music: number;
  sfx: number;
  amb: number;
  mute: boolean;
}

type AudioApi = typeof ReferenceSnd;

export const audio = ReferenceSnd as AudioApi & {
  readonly st: AudioSettings;
};

export function startAudio(): void {
  audio.start();
}
