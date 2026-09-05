import jpeg from 'jpeg-js';
import { decodePng } from './png.js';

export type RgbaImage = {
  width: number;
  height: number;
  /** Row-major RGBA, 8 bits per channel. */
  data: Uint8Array;
};

/** Covers are JPEG nine times out of ten; the magic bytes settle the rest. */
export function decodeImage(bytes: Buffer, mime = ''): RgbaImage {
  if (bytes.length < 4) {
    throw new Error('artwork is empty');
  }

  if (isJpeg(bytes) || (!isPng(bytes) && /jpe?g/i.test(mime))) {
    const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });

    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }

  return decodePng(bytes);
}

function isJpeg(bytes: Buffer) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Buffer) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}
