import { rgbToHex } from './color-utils';

const BUCKET_SIZE = 32; // quantization step per channel — groups near-identical pixels together

/**
 * Given raw RGBA pixel data (as produced by canvas getImageData), picks a
 * suggested brand color: the most common non-transparent, non-neutral
 * (not near-black/white/gray) color, so a logo's actual background/outline
 * doesn't win over its real accent color. Pure function — no canvas/DOM
 * dependency — so it's unit-testable with synthetic pixel arrays.
 *
 * Returns null if no sufficiently vibrant pixel was found (e.g. a purely
 * black-and-white logo) — callers should fall back to the default Athlete
 * accent in that case, not force a muddy color onto the team.
 */
export function pickDominantVibrantColor(pixels: Uint8ClampedArray | number[]): string | null {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 128) continue; // transparent — logo background, not the logo itself

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max - min;

    // Skip near-black, near-white, and low-saturation (gray) pixels — these
    // are almost always background/outline/shading, not the brand color.
    if (max < 30 || min > 230 || saturation < 25) continue;

    const bucketKey = [r, g, b].map((c) => Math.round(c / BUCKET_SIZE) * BUCKET_SIZE).join(',');
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.count += 1;
      existing.r += r;
      existing.g += g;
      existing.b += b;
    } else {
      buckets.set(bucketKey, { count: 1, r, g, b });
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) return null;

  return rgbToHex(best.r / best.count, best.g / best.count, best.b / best.count);
}

/**
 * Loads an image file into an off-screen canvas, downsamples it for
 * performance, and extracts a suggested brand color from its pixels. Runs
 * entirely client-side — the image never leaves the browser for this.
 */
export async function extractDominantColorFromImage(file: File): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not load image'));
      el.src = objectUrl;
    });

    // Downscale to a small canvas — dominant-color extraction doesn't need
    // full resolution, and this keeps pixel-scanning fast even for a large
    // upload.
    const SIZE = 64;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
    return pickDominantVibrantColor(data);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
