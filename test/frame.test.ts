import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIXTURE_TRACK } from '../src/fixtures.js';
import type { NowPlaying } from '../src/media/types.js';
import { buildFrame } from '../src/view/frame.js';
import { BACK, FRONT } from '../src/view/layout.js';

const NOW = 1_800_000_000_000;

const TRACK: NowPlaying = {
  ...FIXTURE_TRACK,
  title: 'Song',
  artist: 'Band',
  album: 'Record',
  positionAt: NOW,
  positionMs: 60_000,
  durationMs: 240_000,
};

test('nothing playing draws nothing', () => {
  const frame = buildFrame(null, { nowMs: NOW });

  assert.equal(frame.active, false);
  assert.equal(frame.frontTitle, '');
  assert.equal(frame.frontFill, 0);
});

test('the front bar is the position, in pixels', () => {
  const frame = buildFrame(TRACK, { nowMs: NOW });

  assert.equal(frame.frontFill, FRONT.width / 4, 'a quarter through');
  assert.equal(frame.backFill, BACK.grooveWidth / 4);
});

test('both faces count elapsed time, and the back also shows duration', () => {
  const frame = buildFrame(TRACK, { nowMs: NOW });

  assert.equal(frame.frontTime, '1:00');
  assert.equal(frame.backElapsed, '1:00');
  assert.equal(frame.backDuration, '4:00');
});

test('a stream with no duration counts up on the front instead', () => {
  const frame = buildFrame({ ...TRACK, durationMs: 0 }, { nowMs: NOW });

  assert.equal(frame.frontTime, '1:00');
  assert.equal(frame.backDuration, 'LIVE');
  assert.equal(frame.frontFill, 0);
});

test('text reaches the frame already ASCII and already clipped', () => {
  const frame = buildFrame(
    {
      ...TRACK,
      title: 'Всё идёт по плану',
      album: 'Оптимизм',
      appLabel: 'YouTube Music',
    },
    { nowMs: NOW },
  );

  assert.match(frame.backAlbum, /^Optimizm$/);
  assert.equal(frame.backSource, 'YouTube Music');
  assert.ok(!/[^\x20-\x7e]/.test(frame.frontTitle), 'front title is printable ASCII');
});

test('a paused track is marked paused, and keeps its position', () => {
  const frame = buildFrame(
    { ...TRACK, playing: false, rate: 0 },
    { nowMs: NOW + 30_000 },
  );

  assert.equal(frame.paused, true);
  assert.equal(frame.backElapsed, '1:00');
});

test('the cover and the LED are passed straight through', () => {
  const frame = buildFrame(TRACK, {
    nowMs: NOW,
    artFile: 'art-1.png',
    ledColor: '#2B7FFFFF',
  });

  assert.equal(frame.artFile, 'art-1.png');
  assert.equal(frame.ledColor, '#2B7FFFFF');
});
