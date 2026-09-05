import { Bitmap } from 'busybar-kit/preview';
import type { NowPlaying } from './media/types.js';

/**
 * A stand-in for a cover, drawn rather than checked in: a vertical gradient
 * with a few discs on it, which is exactly the content that shows whether the
 * dithering works — flat ramps band, hard edges do not.
 *
 * It goes through kit's PNG encoder on the way out, so anything reading it
 * also exercises this app's PNG decoder.
 */
export function fixtureArtwork(size = 300): Buffer {
  const bitmap = new Bitmap(size, size);

  for (let y = 0; y < size; y += 1) {
    const ramp = Math.round((y / (size - 1)) * 210) + 20;
    for (let x = 0; x < size; x += 1) {
      const tint = Math.round((x / (size - 1)) * 40);
      bitmap.set(x, y, { r: ramp, g: Math.max(0, ramp - tint), b: 255 - ramp, a: 255 });
    }
  }

  disc(bitmap, size * 0.34, size * 0.38, size * 0.22, { r: 245, g: 245, b: 235, a: 255 });
  disc(bitmap, size * 0.68, size * 0.62, size * 0.26, { r: 20, g: 18, b: 26, a: 255 });
  disc(bitmap, size * 0.68, size * 0.62, size * 0.06, { r: 235, g: 200, b: 90, a: 255 });

  return bitmap.toPng();
}

export const FIXTURE_TRACK: NowPlaying = {
  trackId: 'fixture',
  title: 'Гражданская оборона — Всё идёт по плану',
  artist: 'Гражданская оборона',
  album: 'Всё идёт по плану',
  durationMs: 213_000,
  positionMs: 78_000,
  positionAt: 0,
  rate: 1,
  playing: true,
  app: 'com.google.Chrome',
  appLabel: 'YouTube Music',
};

function disc(
  bitmap: Bitmap,
  centerX: number,
  centerY: number,
  radius: number,
  color: { r: number; g: number; b: number; a: number },
) {
  const from = Math.floor(Math.min(centerX, centerY) - radius) - 1;
  const to = Math.ceil(Math.max(centerX, centerY) + radius) + 1;

  for (let y = from; y <= to; y += 1) {
    for (let x = from; x <= to; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) {
        bitmap.set(x, y, color);
      }
    }
  }
}
