/**
 * Kait model 3D opsional: jika public/assets/models/manifest.json ada, misalnya
 * {"pawn0":"pawn0.glb","ship3":"ship3.glb"}, model GLB menggantikan model prosedural.
 * Kunci: pawn0..pawn7 (karakter bidak), ship0..ship7 (jenis kapal).
 */
import type * as THREE from 'three';
import { assetUrl } from '../assetUrl';

export type ModelManifest = Record<string, string>;

/** Validasi isi manifest: hanya kunci pawnN/shipN dan nama file .glb/.gltf relatif tanpa "..". */
export function parseManifest(raw: unknown): ModelManifest {
  const out: ModelManifest = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^(pawn|ship)[0-7]$/.test(k)) continue;
    if (typeof v !== 'string' || !/^[\w./-]+\.(glb|gltf)$/i.test(v) || v.includes('..')) continue;
    out[k] = v;
  }
  return out;
}

export async function loadModels(
  onModel: (key: string, scene: THREE.Object3D) => void,
): Promise<void> {
  let man: ModelManifest;
  try {
    const r = await fetch(assetUrl('models/manifest.json'));
    if (!r.ok) return;
    man = parseManifest(await r.json());
  } catch {
    return;
  }
  const keys = Object.keys(man);
  if (!keys.length) return;
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const L = new GLTFLoader();
  keys.forEach((k) =>
    L.load(
      assetUrl(`models/${man[k]}`),
      (gl) => onModel(k, gl.scene),
      undefined,
      () => {
        /* model gagal dimuat: tetap pakai model bawaan */
      },
    ),
  );
}
