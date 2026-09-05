import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHADES } from 'busybar-kit/image';
import { ART_SIZE, ArtworkCache, renderArtwork } from '../src/art/index.js';
import { decodeImage } from '../src/art/image.js';
import { decodePng } from '../src/art/png.js';
import { fixtureArtwork } from '../src/fixtures.js';

const STEP = 255 / (SHADES - 1);

// The crop, the linear-light downscale and the error diffusion live in
// busybar-kit and are tested there. What is this app's own is the decoding in
// front of them, and the cache and file naming behind them.

test('the PNG decoder reads what kit’s encoder wrote', () => {
  const image = decodePng(fixtureArtwork(64));

  assert.equal(image.width, 64);
  assert.equal(image.height, 64);
  assert.equal(image.data.length, 64 * 64 * 4);
  // Top-left of the fixture is the dark end of the ramp, bottom-left the light.
  assert.ok((image.data[0] ?? 0) < (image.data[63 * 64 * 4] ?? 0));
});

test('decoding dispatches on the magic bytes, not the claimed mime', () => {
  const image = decodeImage(fixtureArtwork(32), 'image/jpeg');

  assert.equal(image.width, 32);
});

test('an empty payload is a clear error, not a crash deep in a decoder', () => {
  assert.throws(() => decodeImage(Buffer.alloc(0), 'image/jpeg'), /empty/);
});

test('a cover comes out square, at the panel size, on the panel’s levels', () => {
  const { bitmap, png } = renderArtwork(fixtureArtwork(300), 'image/png');

  assert.equal(bitmap.width, ART_SIZE);
  assert.equal(bitmap.height, ART_SIZE);
  assert.ok(png.length > 0, 'and encoded ready for upload');

  for (let index = 0; index < bitmap.data.length; index += 4) {
    const value = bitmap.data[index] ?? 0;
    assert.ok(
      Math.abs(value - Math.round(value / STEP) * STEP) < 0.001,
      `${value} is not one of the ${SHADES} levels`,
    );
  }
});

test('the cache hands out a rotating file name and forgets what it overwrites', () => {
  const cache = new ArtworkCache(2);
  const art = renderArtwork(fixtureArtwork(16), 'image/png', { size: 8 });

  const first = cache.put('a', art);
  const second = cache.put('b', art);
  assert.notEqual(first.file, second.file, 'a new track must not reuse a live path');

  const third = cache.put('c', art);
  assert.equal(third.file, first.file, 'names rotate');
  assert.equal(cache.get('a'), null, 'the track that lost its file is dropped');
  assert.equal(cache.get('b')?.file, second.file);
});
