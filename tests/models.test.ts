import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../src/view/models';
import { fitModel } from '../src/view/pawns';

/** glTF sintetis: satu segitiga setinggi 2 unit, tergeser jauh dari pusat. */
function syntheticGltf(): string {
  const pos = new Float32Array([10, 5, 3, 12, 5, 3, 11, 7, 4]);
  const b64 = Buffer.from(pos.buffer).toString('base64');
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [10, 5, 3],
        max: [12, 7, 4],
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36, uri: `data:application/octet-stream;base64,${b64}` }],
  });
}

function parse(json: string): Promise<THREE.Object3D> {
  return new Promise((res, rej) => new GLTFLoader().parse(json, '', (g) => res(g.scene), rej));
}

describe('kait model GLB', () => {
  it('fitModel menskalakan ke tinggi target dan meletakkan di tanah, terpusat', async () => {
    const scene = await parse(syntheticGltf());
    const mats: { m: THREE.Material; b: THREE.Color }[] = [];
    const g = fitModel(scene, 104, mats as never);
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    expect(bb.max.y - bb.min.y).toBeCloseTo(104, 3);
    expect(bb.min.y).toBeCloseTo(0, 3);
    expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(0, 3);
    expect((bb.min.z + bb.max.z) / 2).toBeCloseTo(0, 3);
    // material dikloning dan didaftarkan untuk efek gosong
    expect(mats.length).toBe(1);
  });

  it('model asli tidak berubah setelah fitModel (dikloning)', async () => {
    const scene = await parse(syntheticGltf());
    const before = new THREE.Box3().setFromObject(scene);
    fitModel(scene, 50, []);
    const after = new THREE.Box3().setFromObject(scene);
    expect(after.equals(before)).toBe(true);
  });

  it('manifest hanya menerima kunci dan nama file yang sah', () => {
    expect(
      parseManifest({
        pawn0: 'pawn0.glb',
        ship3: 'kapal/ship3.gltf',
        pawn9: 'x.glb',
        evil: 'x.glb',
        pawn1: '../../rahasia.glb',
        pawn2: 'javascript:alert(1)',
        ship4: 42,
      }),
    ).toEqual({ pawn0: 'pawn0.glb', ship3: 'kapal/ship3.gltf' });
    expect(parseManifest(null)).toEqual({});
    expect(parseManifest([1, 2])).toEqual({});
  });
});
