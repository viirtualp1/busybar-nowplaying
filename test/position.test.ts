import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PositionClock, positionAt, progressOf } from '../src/media/position.js';
import type { NowPlaying } from '../src/media/types.js';

const BASE: NowPlaying = {
  trackId: 'a',
  title: 'Song',
  artist: 'Band',
  album: 'Record',
  durationMs: 200_000,
  positionMs: 10_000,
  positionAt: 1_000_000,
  rate: 1,
  playing: true,
  app: 'com.google.Chrome',
  appLabel: 'Chrome',
};

test('position runs forward from the moment it was sampled', () => {
  assert.equal(positionAt(BASE, 1_000_000), 10_000);
  assert.equal(positionAt(BASE, 1_005_000), 15_000);
});

test('a paused track sits where it was left', () => {
  const paused = { ...BASE, playing: false, rate: 0 };
  assert.equal(positionAt(paused, 1_060_000), 10_000);
});

test('position never runs past the end of the track', () => {
  assert.equal(positionAt(BASE, 2_000_000), 200_000);
  assert.equal(progressOf(BASE, 2_000_000), 1);
});

test('a report within tolerance keeps the running estimate', () => {
  const clock = new PositionClock();
  clock.update(BASE, 1_000_000);

  // A second later the backend still says 10s: it rounds, and republishes late.
  const track = clock.update({ ...BASE, positionAt: 1_001_000 }, 1_001_000);

  assert.equal(
    positionAt(track!, 1_001_000),
    11_000,
    'estimate should not be dragged back',
  );
});

test('a real seek re-anchors', () => {
  const clock = new PositionClock();
  clock.update(BASE, 1_000_000);

  const seeked = clock.update(
    { ...BASE, positionMs: 120_000, positionAt: 1_002_000 },
    1_002_000,
  );

  assert.equal(positionAt(seeked!, 1_002_000), 120_000);
});

test('pausing re-anchors even when the position barely moved', () => {
  const clock = new PositionClock();
  clock.update(BASE, 1_000_000);

  const paused = clock.update(
    { ...BASE, playing: false, rate: 0, positionMs: 10_500, positionAt: 1_000_500 },
    1_000_500,
  );

  assert.equal(positionAt(paused!, 1_090_000), 10_500);
});

test('a new track drops the old anchor', () => {
  const clock = new PositionClock();
  clock.update(BASE, 1_000_000);

  const next = clock.update(
    { ...BASE, trackId: 'b', positionMs: 0, positionAt: 1_003_000 },
    1_003_000,
  );

  assert.equal(next?.trackId, 'b');
  assert.equal(positionAt(next, 1_003_000), 0);
});

test('silence clears the clock', () => {
  const clock = new PositionClock();
  clock.update(BASE, 1_000_000);

  assert.equal(clock.update(null, 1_001_000), null);
  assert.equal(clock.current(), null);
});
