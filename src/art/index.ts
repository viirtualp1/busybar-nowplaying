import { Bitmap } from 'busybar-kit/preview';
import { autoContrast, ditherToShades, SHADES, toGreyTile } from './dither.js';
import { decodeImage } from './image.js';

/** The back panel is 160x80, so a square cover fills its left half exactly. */
export const ART_SIZE = 80;

/**
 * How many covers to keep. Small on purpose: it exists so that skipping back a
 * track does not re-upload, not to be a library.
 */
const CACHE_SIZE = 4;

export type RenderedArt = {
  /** Ready for `AssetsUpload`, already at the panel's 16 greys. */
  png: Buffer;
  bitmap: Bitmap;
};

export type ArtOptions = {
  size?: number;
  contrast?: boolean;
  shades?: number;
};

export function renderArtwork(
  bytes: Buffer,
  mime: string,
  options: ArtOptions = {},
): RenderedArt {
  const size = options.size ?? ART_SIZE;
  const decoded = decodeImage(bytes, mime);
  const tile = toGreyTile(decoded, size);
  const levelled = options.contrast === false ? tile : autoContrast(tile);
  const shades = ditherToShades(levelled, options.shades ?? SHADES);
  const bitmap = new Bitmap(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = shades[y * size + x] ?? 0;
      bitmap.set(x, y, { r: value, g: value, b: value, a: 255 });
    }
  }

  return { png: bitmap.toPng(), bitmap };
}

export type CachedArt = RenderedArt & {
  /** Asset file name on the Bar. */
  file: string;
};

/**
 * Covers keyed by track, handed out under a rotating file name.
 *
 * The name rotates because the Bar draws an image by path: writing new bytes to
 * a path an element already points at is the one case where nothing on screen
 * has changed as far as the device is concerned.
 */
export class ArtworkCache {
  private readonly entries = new Map<string, CachedArt>();
  private slot = 0;

  constructor(private readonly size = CACHE_SIZE) {}

  get(trackId: string): CachedArt | null {
    return this.entries.get(trackId) ?? null;
  }

  put(trackId: string, art: RenderedArt): CachedArt {
    const file = `art-${this.slot}.png`;
    this.slot = (this.slot + 1) % this.size;

    // Whoever held this file name loses it: two tracks pointing at one path
    // would show whichever was uploaded last.
    for (const [key, entry] of this.entries) {
      if (entry.file === file) {
        this.entries.delete(key);
      }
    }

    const cached: CachedArt = { ...art, file };
    this.entries.set(trackId, cached);

    return cached;
  }

  clear(): void {
    this.entries.clear();
    this.slot = 0;
  }
}

/** Draws one bitmap into another — the preview's stand-in for an image element. */
export function blitInto(
  target: Bitmap,
  source: Bitmap,
  offsetX: number,
  offsetY: number,
) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4;
      target.set(offsetX + x, offsetY + y, {
        r: source.data[offset] ?? 0,
        g: source.data[offset + 1] ?? 0,
        b: source.data[offset + 2] ?? 0,
        a: 255,
      });
    }
  }
}
