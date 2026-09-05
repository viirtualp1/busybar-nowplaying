import { ditherToPanel } from 'busybar-kit/image';
import type { Bitmap } from 'busybar-kit/preview';
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
};

/**
 * Decode here, dither in the kit: the panel's 16 greys are a property of the
 * device, but which image decoder to pay for is this app's own choice.
 */
export function renderArtwork(
  bytes: Buffer,
  mime: string,
  options: ArtOptions = {},
): RenderedArt {
  const decoded = decodeImage(bytes, mime);
  const bitmap = ditherToPanel(decoded, {
    size: options.size ?? ART_SIZE,
    ...(options.contrast === undefined ? {} : { contrast: options.contrast }),
  });

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
