import type { RgbaImage } from './image.js';

/** What the back panel can actually show. Matches busybar-kit's preview. */
export const SHADES = 16;

/** Ignore this share of the darkest and lightest pixels when stretching. */
const CLIP_SHARE = 0.02;

/** Below this spread the picture is genuinely flat; stretching only adds noise. */
const MIN_RANGE = 24;

const TO_LINEAR = buildLinearTable();

export type GreyTile = {
  size: number;
  /** One perceptual grey per pixel, 0..255, still unquantised. */
  values: Float64Array;
};

/**
 * Centre-crops to a square and box-filters down to `size`, averaging in linear
 * light. Averaging the gamma-encoded bytes instead is the usual reason a
 * downscaled cover comes out muddier than the original.
 */
export function toGreyTile(image: RgbaImage, size: number): GreyTile {
  const side = Math.min(image.width, image.height);
  const offsetX = Math.floor((image.width - side) / 2);
  const offsetY = Math.floor((image.height - side) / 2);
  const values = new Float64Array(size * size);

  // The box is worked out inside the crop and only then moved onto the image;
  // mixing the two makes every box a little wider than it should be, which
  // smears the whole picture towards the bottom right.
  for (let y = 0; y < size; y += 1) {
    const startY = Math.floor((y * side) / size);
    const endY = Math.max(startY + 1, Math.floor(((y + 1) * side) / size));

    for (let x = 0; x < size; x += 1) {
      const startX = Math.floor((x * side) / size);
      const endX = Math.max(startX + 1, Math.floor(((x + 1) * side) / size));
      values[y * size + x] = boxLuminance(
        image,
        offsetX + startX,
        offsetY + startY,
        offsetX + endX,
        offsetY + endY,
      );
    }
  }

  return { size, values };
}

/**
 * Pulls the histogram out to the full range. Sixteen levels is little enough
 * that a cover mastered dark otherwise lands on four of them and reads as a
 * grey smudge.
 */
export function autoContrast(tile: GreyTile): GreyTile {
  const sorted = Float64Array.from(tile.values).sort();
  const count = sorted.length;
  if (count === 0) {
    return tile;
  }

  const low = sorted[Math.floor(count * CLIP_SHARE)] ?? 0;
  const high = sorted[Math.min(count - 1, Math.ceil(count * (1 - CLIP_SHARE)))] ?? 255;
  const range = high - low;
  if (range < MIN_RANGE) {
    return tile;
  }

  const values = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const value = ((tile.values[index] ?? 0) - low) / range;
    values[index] = Math.min(255, Math.max(0, value * 255));
  }

  return { size: tile.size, values };
}

/**
 * Floyd–Steinberg on a serpentine scan, quantised to the panel's own levels.
 *
 * Dithering here rather than letting the device do it is the whole point: the
 * Bar quantises to its 16 greys on upload, and a plain nearest-level mapping
 * turns gradients into bands. Pixels that already sit exactly on a level
 * survive that mapping untouched.
 */
export function ditherToShades(tile: GreyTile, shades = SHADES): Uint8Array {
  const { size } = tile;
  const step = 255 / (shades - 1);
  const working = Float64Array.from(tile.values);
  const out = new Uint8Array(size * size);

  for (let y = 0; y < size; y += 1) {
    const leftToRight = y % 2 === 0;

    for (let index = 0; index < size; index += 1) {
      const x = leftToRight ? index : size - 1 - index;
      const at = y * size + x;
      const wanted = working[at] ?? 0;
      const quantised = Math.round(Math.min(255, Math.max(0, wanted)) / step) * step;
      out[at] = Math.round(quantised);

      const error = wanted - quantised;
      const ahead = leftToRight ? 1 : -1;
      spread(working, size, x + ahead, y, error * (7 / 16));
      spread(working, size, x - ahead, y + 1, error * (3 / 16));
      spread(working, size, x, y + 1, error * (5 / 16));
      spread(working, size, x + ahead, y + 1, error * (1 / 16));
    }
  }

  return out;
}

function spread(values: Float64Array, size: number, x: number, y: number, error: number) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }
  const at = y * size + x;
  values[at] = (values[at] ?? 0) + error;
}

function boxLuminance(
  image: RgbaImage,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let y = fromY; y < toY; y += 1) {
    for (let x = fromX; x < toX; x += 1) {
      const offset = (y * image.width + x) * 4;
      // Composite over black: covers are opaque, and a stray alpha channel
      // should darken rather than blow out to white.
      const alpha = (image.data[offset + 3] ?? 255) / 255;
      red += (TO_LINEAR[image.data[offset] ?? 0] ?? 0) * alpha;
      green += (TO_LINEAR[image.data[offset + 1] ?? 0] ?? 0) * alpha;
      blue += (TO_LINEAR[image.data[offset + 2] ?? 0] ?? 0) * alpha;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / count;

  return linearToSrgb(luminance) * 255;
}

function buildLinearTable() {
  const table = new Float64Array(256);
  for (let value = 0; value < 256; value += 1) {
    const channel = value / 255;
    table[value] =
      channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  }

  return table;
}

function linearToSrgb(value: number) {
  const clamped = Math.min(1, Math.max(0, value));

  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}
