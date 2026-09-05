import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseDataUrl,
  pickSession,
  toNowPlaying,
  type WinSession,
} from '../src/media/windows.js';

const CHROME: WinSession = {
  id: 'chrome',
  sourceAppUserModelId: 'chrome.exe',
  sourceAppDisplayName: 'Google Chrome',
  title: 'Song',
  artist: 'Band',
  albumTitle: 'Record',
  playbackStatus: 'playing',
  timeline: { positionMs: 78_200, durationMs: 213_440 },
};

const SPOTIFY: WinSession = {
  id: 'spotify',
  sourceAppUserModelId: 'Spotify.exe',
  title: 'Other',
  artist: 'Someone',
  playbackStatus: 'paused',
};

test('the session that is playing wins', () => {
  assert.equal(pickSession([SPOTIFY, CHROME], '')?.id, 'chrome');
});

test('a paused session still counts when nothing is playing', () => {
  assert.equal(pickSession([SPOTIFY], '')?.id, 'spotify');
});

test('sessions with no metadata are ignored', () => {
  const empty: WinSession = {
    id: 'ghost',
    sourceAppUserModelId: 'ghost.exe',
    playbackStatus: 'playing',
  };

  assert.equal(pickSession([empty], ''), null);
});

test('the app filter matches the AUMID or the friendly name', () => {
  assert.equal(pickSession([SPOTIFY, CHROME], 'spotify')?.id, 'spotify');
  assert.equal(pickSession([SPOTIFY, CHROME], 'google')?.id, 'chrome');
  assert.equal(pickSession([SPOTIFY, CHROME], 'firefox'), null);
});

test('SMTC timeline maps straight through, in milliseconds', () => {
  const track = toNowPlaying(CHROME, 1_700_000);

  assert.equal(track?.positionMs, 78_200);
  assert.equal(track?.durationMs, 213_440);
  assert.equal(track?.positionAt, 1_700_000, 'sampled when the snapshot arrived');
  assert.equal(track?.playing, true);
  assert.equal(track?.appLabel, 'Google Chrome');
});

test('a missing timeline is zero, not NaN', () => {
  const track = toNowPlaying(SPOTIFY, 1_700_000);

  assert.equal(track?.durationMs, 0);
  assert.equal(track?.positionMs, 0);
  assert.equal(track?.playing, false);
  assert.equal(track?.rate, 0);
});

test('the same song is the same track id on either platform', () => {
  const windows = toNowPlaying(CHROME, 1_700_000);

  assert.equal(windows?.trackId, 'song\nband\nrecord');
});

test('thumbnails arrive as data URLs', () => {
  const artwork = parseDataUrl('data:image/jpeg;base64,/9j/4AAQ');

  assert.equal(artwork?.mime, 'image/jpeg');
  assert.deepEqual(artwork?.bytes, Buffer.from('/9j/4AAQ', 'base64'));
  assert.equal(parseDataUrl(''), null);
  assert.equal(parseDataUrl('https://example.com/cover.jpg'), null);
});
