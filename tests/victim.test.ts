import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Pawns } from '../src/view/pawns';
import { makeVictim, type VictimKind } from '../src/view/victim';

function fakePawns(): {
  pawns: Pawns;
  g: THREE.Group;
  m: THREE.MeshBasicMaterial;
} {
  const m = new THREE.MeshBasicMaterial();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m));
  g.position.set(100, 13, 50);
  return { pawns: { list: [g], ctlMat: () => m } as unknown as Pawns, g, m };
}

const KINDS: VictimKind[] = ['flood', 'rob', 'tsunami', 'gempa', 'burn', 'dry', 'slide'];

describe('efek bencana pada bidak', () => {
  for (const kind of KINDS) {
    it(`${kind}: bidak berubah saat efek berjalan dan pulih di akhir`, () => {
      const { pawns, g, m } = fakePawns();
      const total = 4.5;
      const v = makeVictim(pawns, 0, kind, {
        total,
        dir: [1, 0],
        water: () => 20,
        hit: 2,
      });
      expect(v.ok).toBe(true);
      let moved = false;
      for (let el = 0; el < total; el += 1 / 30) {
        v.step(1 / 30, el);
        if (el > 1.5 && el < total - 1.2) {
          const changed =
            Math.hypot(g.position.x - 100, g.position.z - 50) > 4 ||
            Math.abs(g.position.y - 13) > 4 ||
            Math.abs(g.rotation.x) + Math.abs(g.rotation.z) > 0.1 ||
            Math.abs(g.scale.y - 1) > 0.05 ||
            m.color.r < 0.97 ||
            m.color.b < 0.97;
          if (changed) moved = true;
        }
      }
      expect(moved).toBe(true);
      // langkah terakhir sudah hampir pulih, lalu end() mengembalikan penuh
      v.end();
      expect(g.position.x).toBeCloseTo(100);
      expect(g.position.y).toBeCloseTo(13);
      expect(g.rotation.z).toBeCloseTo(0);
      expect(g.scale.y).toBeCloseTo(1);
      expect(m.color.getHex()).toBe(0xffffff);
      expect(g.userData.fx).toBe(false);
    });
  }

  it('tanpa bidak tidak melakukan apa pun', () => {
    const v = makeVictim({ list: [], ctlMat: () => null } as unknown as Pawns, 3, 'burn', {
      total: 3,
      dir: [0, 1],
    });
    expect(v.ok).toBe(false);
    v.step(0.1, 1);
    v.end();
  });
});
