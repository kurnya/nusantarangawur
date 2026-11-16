import { describe, expect, it } from 'vitest';
import { assetUrl } from '../src/assetUrl';

describe('assetUrl', () => {
  it('root base', () => expect(assetUrl('ppl/p0.webp', '/')).toBe('/assets/ppl/p0.webp'));
  it('sub-path base', () =>
    expect(assetUrl('ppl/p0.webp', '/nusantara-ngawur/')).toBe(
      '/nusantara-ngawur/assets/ppl/p0.webp',
    ));
  it('base tanpa slash akhir', () =>
    expect(assetUrl('/x.webp', '/repo')).toBe('/repo/assets/x.webp'));
});
