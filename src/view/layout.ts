import {
  BACK as DEVICE_BACK,
  FRONT as DEVICE_FRONT,
  fittingChars,
} from 'busybar-kit/device';
import { ART_SIZE } from '../art/index.js';

/**
 * The front strip is two rows of small text over a bar that *is* the progress.
 *
 * At 72 pixels a three-minute track advances one pixel every two and a half
 * seconds, which is too slow to read as motion — so the bar carries the shape
 * of the track and the elapsed time carries the ticking.
 */
const TIME_WIDTH = 24;

export const FRONT = {
  ...DEVICE_FRONT,
  titleY: 2,
  bottomY: 10,
  /** The bold volume reading, sitting across both rows. */
  volumeY: 3,
  /** Text starts at x=1 and keeps a pixel on the right, so 2 off the width. */
  titleWidth: DEVICE_FRONT.width - 2,
  timeWidth: TIME_WIDTH,
  /** Bottom row: artist on the left, elapsed time hard right. */
  artistWidth: DEVICE_FRONT.width - TIME_WIDTH - 3,
} as const;

/**
 * The back panel is the cover plus a caption: 80x80 of album art, and the
 * remaining 76 pixels for who is playing and how far in.
 */
export const BACK = {
  ...DEVICE_BACK,
  artX: 0,
  artY: 0,
  artSize: ART_SIZE,
  panelX: ART_SIZE + 4,
  panelWidth: DEVICE_BACK.width - ART_SIZE - 4,
  /** Same idea as the front: keep the last glyph off the bezel. */
  textWidth: DEVICE_BACK.width - ART_SIZE - 8,
  titleY: 6,
  artistY: 18,
  albumY: 30,
  grooveY: 52,
  grooveHeight: 5,
  grooveWidth: DEVICE_BACK.width - ART_SIZE - 8,
  timesY: 62,
  timesHeight: 9,
  timeWidth: TIME_WIDTH,
  sourceY: 72,
} as const;

export const FRONT_CHARS = {
  title: fittingChars(FRONT.titleWidth, 4),
  artist: fittingChars(FRONT.artistWidth, 4),
} as const;

export const BACK_CHARS = {
  panel: fittingChars(BACK.textWidth, 4),
} as const;

/** Width of the filled part of a bar, in whole pixels. */
export function fillPixels(progress: number, width: number) {
  return Math.round(Math.min(1, Math.max(0, progress)) * width);
}
