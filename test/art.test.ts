import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtworkCache, renderArtwork, ART_SIZE } from '../src/art/index.js';
import { autoContrast, ditherToShades, SHADES, toGreyTile } from '../src/art/dither.js';
import { decodeImage } from '../src/art/image.js';
import { decodePng } from '../src/art/png.js';
import { fixtureArtwork } from '../src/fixtures.js';

const STEP = 255 / (SHADES - 1);

test('the PNG decoder reads what kit’s encoder wrote', () => {
  const image = decodePng(fixtureArtwork(64));

  assert.equal(image.width, 64);
  assert.equal(image.height, 64);
  assert.equal(image.data.length, 64 * 64 * 4);
  // Top-left of the fixture is the dark end of the ramp, bottom-left the light.
  assert.ok((image.data[0] ?? 0) < (image.data[63 * 64 * 4] ?? 0));
});

test('decoding dispatches on the magic bytes, not the claimed mime', () => {
  const png = fixtureArtwork(32);
  const image = decodeImage(png, 'image/jpeg');

  assert.equal(image.width, 32);
});

test('a cover comes out square at the panel size', () => {
  const { bitmap } = renderArtwork(fixtureArtwork(300), 'image/png');

  assert.equal(bitmap.width, ART_SIZE);
  assert.equal(bitmap.height, ART_SIZE);
});

test('every pixel lands exactly on one of the panel’s 16 greys', () => {
  const { bitmap } = renderArtwork(fixtureArtwork(300), 'image/png');

  for (let index = 0; index < bitmap.data.length; index += 4) {
    const value = bitmap.data[index] ?? 0;
    assert.equal(bitmap.data[index + 1], value, 'grey means r=g=b');
    assert.equal(
      Math.abs(value - Math.round(value / STEP) * STEP) < 0.001,
      true,
      `${value} is not one of the 16 levels`,
    );
  }
});

test('a non-square cover is cropped from the middle, not squashed', () => {
  const wide = { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4) };
  // Left half black, right half white; a centre crop keeps one of each.
  for (let pixel = 0; pixel < 8; pixel += 1) {
    const value = pixel % 4 >= 2 ? 255 : 0;
    wide.data.set([value, value, value, 255], pixel * 4);
  }

  const tile = toGreyTile(wide, 2);

  assert.ok((tile.values[0] ?? 0) < 128, 'left stays dark');
  assert.ok((tile.values[1] ?? 0) > 128, 'right stays light');
});

test('a flat dark cover is stretched into the usable range', () => {
  const size = 8;
  const values = Float64Array.from(
    { length: size * size },
    (_, index) => 10 + (index % 8) * 6,
  );
  const stretched = autoContrast({ size, values });

  assert.ok(Math.max(...stretched.values) > 200, 'the light end reaches the top');
  assert.ok(Math.min(...stretched.values) < 20, 'the dark end reaches the bottom');
});

test('a genuinely flat image is left alone rather than amplified into noise', () => {
  const size = 4;
  const values = new Float64Array(size * size).fill(120);
  const untouched = autoContrast({ size, values });

  assert.deepEqual([...untouched.values], [...values]);
});

test('dithering keeps the average brightness it was given', () => {
  const size = 32;
  const values = new Float64Array(size * size).fill(100);
  const dithered = ditherToShades({ size, values });
  const average = dithered.reduce((total, value) => total + value, 0) / dithered.length;

  // 100 sits between two levels, so the error diffusion has to mix them.
  assert.ok(Math.abs(average - 100) < 4, `average drifted to ${average}`);
  assert.ok(new Set(dithered).size > 1, 'a flat mid-grey should not snap to one level');
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
