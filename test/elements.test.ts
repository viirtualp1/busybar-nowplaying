import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backElements, frontElements } from '../src/bar/elements.js';
import { FIXTURE_TRACK } from '../src/fixtures.js';
import { buildFrame, IDLE_FRAME } from '../src/view/frame.js';
import { BACK, FRONT } from '../src/view/layout.js';

const NOW = 1_800_000_000_000;

const ids = (frame: Parameters<typeof frontElements>[0]) =>
  frontElements(frame).map((element) => element.id);

test('the volume takes the front strip without adding or dropping a slot', () => {
  const track = buildFrame(FIXTURE_TRACK, { nowMs: NOW });
  const volume = buildFrame(FIXTURE_TRACK, {
    nowMs: NOW,
    volume: { value: 50, direction: 'up' },
  });

  assert.deepEqual(ids(volume), ids(track), 'same ids means nothing is left behind');
});

test('the volume bar is the volume, in pixels', () => {
  const frame = buildFrame(FIXTURE_TRACK, {
    nowMs: NOW,
    volume: { value: 50, direction: 'up' },
  });
  const [bar] = frontElements(frame);

  assert.equal(bar?.type, 'rectangle');
  assert.equal(bar?.type === 'rectangle' && bar.width, FRONT.width / 2);
});

test('a volume that cannot be read shows its direction instead of a number', () => {
  const frame = buildFrame(FIXTURE_TRACK, {
    nowMs: NOW,
    volume: { value: null, direction: 'down' },
  });
  const elements = frontElements(frame);
  const title = elements.find((element) => element.id === 'title');
  const label = elements.find((element) => element.id === 'artist');

  assert.equal(title?.type === 'text' && title.text, 'VOL');
  assert.equal(label?.type === 'text' && label.text, 'DOWN');
});

test('the knob shows up even with nothing playing', () => {
  const frame = buildFrame(null, { nowMs: NOW, volume: { value: 30, direction: 'up' } });

  assert.equal(frame.active, false);
  assert.deepEqual(frame.volume, { value: 30, direction: 'up' });
  assert.equal(buildFrame(null, { nowMs: NOW }), IDLE_FRAME, 'and is absent otherwise');
});

test('back elapsed and duration sit in their own slots, not one shared box', () => {
  const frame = buildFrame(FIXTURE_TRACK, { nowMs: NOW });
  const elapsed = backElements(frame).find((element) => element.id === 'back-elapsed');
  const duration = backElements(frame).find((element) => element.id === 'back-duration');

  assert.equal(elapsed?.type === 'text' && elapsed.width, BACK.timeWidth);
  assert.equal(duration?.type === 'text' && duration.width, BACK.timeWidth);
  assert.ok(
    elapsed &&
      duration &&
      elapsed.type === 'text' &&
      duration.type === 'text' &&
      elapsed.x + elapsed.width <= duration.x - duration.width,
    'the two clocks must not share pixels',
  );
});
