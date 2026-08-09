import { describe, expect, it } from 'vitest';
import { pickDominantVibrantColor } from './logo-color-extraction';

/** Builds a flat RGBA pixel array by repeating one [r,g,b,a] pixel `count` times. */
function solidPixels(r: number, g: number, b: number, a: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(r, g, b, a);
  return out;
}

describe('pickDominantVibrantColor', () => {
  it('picks the most frequent vibrant color over a less-frequent one', () => {
    const pixels = [
      ...solidPixels(198, 241, 53, 255, 100), // Athlete volt green, majority
      ...solidPixels(83, 58, 253, 255, 20), // some purple, minority
    ];
    const result = pickDominantVibrantColor(pixels);
    expect(result).toBe('#c6f135');
  });

  it('ignores transparent pixels entirely', () => {
    const pixels = [
      ...solidPixels(83, 58, 253, 0, 500), // fully transparent — majority by count, must be ignored
      ...solidPixels(198, 241, 53, 255, 10),
    ];
    const result = pickDominantVibrantColor(pixels);
    expect(result).toBe('#c6f135');
  });

  it('ignores near-black, near-white, and gray pixels (logo background/outline)', () => {
    const pixels = [
      ...solidPixels(255, 255, 255, 255, 1000), // white background, majority
      ...solidPixels(0, 0, 0, 255, 500), // black outline
      ...solidPixels(128, 128, 128, 255, 200), // gray shading
      ...solidPixels(198, 241, 53, 255, 50), // the actual logo color, minority by count
    ];
    const result = pickDominantVibrantColor(pixels);
    expect(result).toBe('#c6f135');
  });

  it('returns null when no vibrant pixel exists (pure black-and-white logo)', () => {
    const pixels = [
      ...solidPixels(255, 255, 255, 255, 500),
      ...solidPixels(0, 0, 0, 255, 500),
      ...solidPixels(128, 128, 128, 255, 100),
    ];
    expect(pickDominantVibrantColor(pixels)).toBeNull();
  });

  it('returns null for an empty pixel array', () => {
    expect(pickDominantVibrantColor([])).toBeNull();
  });

  it('averages pixels within the same quantization bucket rather than just picking one', () => {
    // Two nearly-identical shades of the same general color, close enough
    // to land in one bucket (32-wide per channel) — result should be their
    // average, not either individual shade verbatim.
    const pixels = [
      ...solidPixels(190, 235, 50, 255, 50),
      ...solidPixels(192, 237, 52, 255, 50),
    ];
    const result = pickDominantVibrantColor(pixels);
    expect(result).toBe('#bfec33'); // average of (190,235,50) and (192,237,52) = (191,236,51)
  });
});
