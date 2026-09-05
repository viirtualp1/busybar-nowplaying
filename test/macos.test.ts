import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArtwork, parseNowPlaying, parseTimestamp } from '../src/media/macos.js';

const NOW = 1_800_000_000_000;

test('an idle machine reports nothing', () => {
  const idle = JSON.stringify({ title: null, artist: null, elapsedTime: null });

  assert.equal(parseNowPlaying(idle, NOW), null);
});

test('seconds from the CLI become milliseconds', () => {
  const track = parseNowPlaying(
    JSON.stringify({
      title: 'Song',
      artist: 'Band',
      album: 'Record',
      duration: 213.44,
      elapsedTime: 78.2,
      playbackRate: 1,
      timestamp: NOW / 1000,
      bundleIdentifier: 'com.google.Chrome',
    }),
    NOW,
  );

  assert.equal(track?.durationMs, 213_440);
  assert.equal(track?.positionMs, 78_200);
  assert.equal(track?.positionAt, NOW);
  assert.equal(track?.playing, true);
  assert.equal(track?.appLabel, 'Chrome');
});

test('a zero playback rate is a paused track, not a stopped one', () => {
  const track = parseNowPlaying(
    JSON.stringify({ title: 'Song', artist: 'Band', playbackRate: 0 }),
    NOW,
  );

  assert.equal(track?.playing, false);
  assert.equal(track?.rate, 0);
});

test('a track with only a title is still a track', () => {
  const track = parseNowPlaying(JSON.stringify({ title: 'Podcast', artist: null }), NOW);

  assert.equal(track?.title, 'Podcast');
  assert.equal(track?.artist, '');
});

test('garbage on stdout is not a crash', () => {
  assert.equal(parseNowPlaying('not json', NOW), null);
  assert.equal(parseNowPlaying('', NOW), null);
});

test('timestamps arrive in whichever unit MediaRemote felt like', () => {
  assert.equal(parseTimestamp(NOW / 1000, NOW), NOW, 'epoch seconds');
  assert.equal(parseTimestamp(NOW - 4000, NOW), NOW - 4000, 'epoch milliseconds');
  assert.equal(
    parseTimestamp(new Date(NOW - 2000).toISOString(), NOW),
    NOW - 2000,
    'ISO string',
  );
});

test('an unreadable timestamp falls back to now, not to 1970', () => {
  assert.equal(parseTimestamp(null, NOW), NOW);
  assert.equal(parseTimestamp('whenever', NOW), NOW);
  assert.equal(parseTimestamp(42, NOW), NOW, 'too small to be an epoch');
  assert.equal(parseTimestamp(NOW + 60_000, NOW), NOW, 'the future is a misread');
  assert.equal(parseTimestamp(NOW - 48 * 3600 * 1000, NOW), NOW, 'too stale to be real');
});

test('artwork comes back decoded, with a default mime', () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const artwork = parseArtwork(
    JSON.stringify({ artworkData: bytes.toString('base64'), artworkMIMEType: null }),
  );

  assert.deepEqual(artwork?.bytes, bytes);
  assert.equal(artwork?.mime, 'image/jpeg');
  assert.equal(parseArtwork(JSON.stringify({ artworkData: null })), null);
});
