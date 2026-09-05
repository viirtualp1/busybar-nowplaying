import { inflateSync } from 'node:zlib';
import type { RgbaImage } from './image.js';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Enough of a PNG decoder for album art: 8- and 16-bit samples, every colour
 * type, no interlacing. busybar-kit already hand-rolls the encoder, so this
 * keeps the pair symmetrical instead of pulling in a decoder dependency for
 * the minority of covers that are not JPEG.
 */
export function decodePng(bytes: Buffer): RgbaImage {
  if (bytes.length < 8 || SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    throw new Error('not a PNG');
  }

  let header: Header | null = null;
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null;
  const parts: Buffer[] = [];

  for (let offset = 8; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.length) {
      break;
    }

    if (type === 'IHDR') {
      header = readHeader(bytes.subarray(start, end));
    } else if (type === 'PLTE') {
      palette = bytes.subarray(start, end);
    } else if (type === 'tRNS') {
      transparency = bytes.subarray(start, end);
    } else if (type === 'IDAT') {
      parts.push(bytes.subarray(start, end));
    } else if (type === 'IEND') {
      break;
    }

    offset = end + 4;
  }

  if (!header) {
    throw new Error('PNG has no header');
  }
  if (parts.length === 0) {
    throw new Error('PNG has no pixel data');
  }

  const raw = inflateSync(Buffer.concat(parts));
  const samples = unfilter(raw, header);

  return expand(samples, header, palette, transparency);
}

type Header = {
  width: number;
  height: number;
  depth: number;
  colorType: number;
  channels: number;
  /** Bytes per pixel in the filtered stream, at least 1 as filters require. */
  bpp: number;
  stride: number;
};

function readHeader(chunk: Buffer): Header {
  const width = chunk.readUInt32BE(0);
  const height = chunk.readUInt32BE(4);
  const depth = chunk[8] ?? 0;
  const colorType = chunk[9] ?? 0;
  const interlace = chunk[12] ?? 0;
  const channels = CHANNELS[colorType];

  if (!channels) {
    throw new Error(`unsupported PNG colour type ${colorType}`);
  }
  if (depth !== 8 && depth !== 16) {
    throw new Error(`unsupported PNG bit depth ${depth}`);
  }
  if (interlace !== 0) {
    throw new Error('interlaced PNG is not supported');
  }
  if (width <= 0 || height <= 0) {
    throw new Error('PNG has no size');
  }

  const bytesPerSample = depth / 8;
  const bpp = channels * bytesPerSample;

  return { width, height, depth, colorType, channels, bpp, stride: width * bpp };
}

function unfilter(raw: Buffer, header: Header): Buffer {
  const { stride, bpp, height } = header;
  const out = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filterOffset = y * (stride + 1);
    const filter = raw[filterOffset] ?? 0;
    const line = filterOffset + 1;
    const target = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[line + x] ?? 0;
      const left = x >= bpp ? (out[target + x - bpp] ?? 0) : 0;
      const up = y > 0 ? (out[target - stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= bpp ? (out[target - stride + x - bpp] ?? 0) : 0;

      out[target + x] = (value + reconstruct(filter, left, up, upLeft)) & 0xff;
    }
  }

  return out;
}

function reconstruct(filter: number, left: number, up: number, upLeft: number) {
  if (filter === 1) {
    return left;
  }
  if (filter === 2) {
    return up;
  }
  if (filter === 3) {
    return (left + up) >> 1;
  }
  if (filter === 4) {
    return paeth(left, up, upLeft);
  }

  return 0;
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) {
    return a;
  }

  return pb <= pc ? b : c;
}

function expand(
  samples: Buffer,
  header: Header,
  palette: Buffer | null,
  transparency: Buffer | null,
): RgbaImage {
  const { width, height, depth, colorType, channels } = header;
  const step = depth / 8;
  const data = new Uint8Array(width * height * 4);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    // 16-bit samples are read by their high byte: the panel has 16 grey levels,
    // so the low byte cannot survive the trip anyway.
    const base = pixel * channels * step;
    const at = (index: number) => samples[base + index * step] ?? 0;
    const out = pixel * 4;
    let r: number;
    let g: number;
    let b: number;
    let a = 255;

    if (colorType === 0) {
      r = g = b = at(0);
    } else if (colorType === 2) {
      r = at(0);
      g = at(1);
      b = at(2);
    } else if (colorType === 3) {
      const index = at(0);
      r = palette?.[index * 3] ?? 0;
      g = palette?.[index * 3 + 1] ?? 0;
      b = palette?.[index * 3 + 2] ?? 0;
      a = transparency?.[index] ?? 255;
    } else if (colorType === 4) {
      r = g = b = at(0);
      a = at(1);
    } else {
      r = at(0);
      g = at(1);
      b = at(2);
      a = at(3);
    }

    data[out] = r;
    data[out + 1] = g;
    data[out + 2] = b;
    data[out + 3] = a;
  }

  return { width, height, data };
}
