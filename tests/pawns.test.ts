import { describe, expect, it } from 'vitest';
import { PAWNS } from '../src/engine/board';
import { N_PAWNS } from '../src/engine/config';
import { parseManifest } from '../src/view/models';

describe('karakter bidak', () => {
  it('jumlah profesi sama dengan N_PAWNS dan namanya unik', () => {
    expect(PAWNS.length).toBe(N_PAWNS);
    expect(new Set(PAWNS.map((p) => p.name)).size).toBe(N_PAWNS);
  });
  it('manifest model menerima pawn0..pawn15', () => {
    const m = parseManifest({ pawn15: 'a.glb', pawn16: 'b.glb', ship7: 's.glb' });
    expect(Object.keys(m).sort()).toEqual(['pawn15', 'ship7']);
  });
});
