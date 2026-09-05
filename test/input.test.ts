import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeInputEvents } from '../src/bar/input.js';

/**
 * Frames are built here the way the device builds them, so the decoder is
 * tested against the wire format rather than against itself.
 */
function varint(value: number): number[] {
  const out: number[] = [];
  let rest = value;
  while (rest > 0x7f) {
    out.push((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  out.push(rest);

  return out;
}

function zigzag(value: number) {
  return value < 0 ? -value * 2 - 1 : value * 2;
}

function field(number: number, wire: number) {
  return varint((number << 3) | wire);
}

function message(number: number, body: number[]) {
  return [...field(number, 2), ...varint(body.length), ...body];
}

function scalar(number: number, value: number) {
  return [...field(number, 0), ...varint(value)];
}

/** State { updates: [ StateUpdate { input: InputEvent } ] } */
function frame(...inputs: number[][]) {
  const updates = inputs.flatMap((input) => message(2, message(11, input)));

  return new Uint8Array(updates);
}

const button = (which: number, action: number) =>
  message(1, [...scalar(1, which), ...scalar(2, action)]);
const encoder = (delta: number) => message(3, [...field(1, 0), ...varint(zigzag(delta))]);
const switched = (position: number) => message(2, scalar(1, position));

test('the big button arrives as a start press', () => {
  const events = decodeInputEvents(frame(button(2, 0)));

  assert.deepEqual(events, [{ kind: 'button', button: 'start', action: 'press' }]);
});

test('a release is not mistaken for a press', () => {
  const [event] = decodeInputEvents(frame(button(2, 1)));

  assert.equal(event?.kind === 'button' && event.action, 'release');
});

test('proto3 leaves zero-valued fields off the wire, and they are the defaults', () => {
  // An OK press writes neither field: OK is 0 and PRESS is 0.
  const events = decodeInputEvents(frame(message(1, [])));

  assert.deepEqual(events, [{ kind: 'button', button: 'ok', action: 'press' }]);
});

test('the knob turns both ways', () => {
  assert.deepEqual(decodeInputEvents(frame(encoder(3))), [{ kind: 'encoder', delta: 3 }]);
  assert.deepEqual(decodeInputEvents(frame(encoder(-2))), [
    { kind: 'encoder', delta: -2 },
  ]);
});

test('the switch position comes through by name', () => {
  assert.deepEqual(decodeInputEvents(frame(switched(3))), [
    { kind: 'switch', position: 'apps' },
  ]);
});

test('one frame can carry several updates', () => {
  const events = decodeInputEvents(frame(button(2, 0), encoder(1), button(2, 1)));

  assert.equal(events.length, 3);
  assert.equal(events[1]?.kind, 'encoder');
});

test('everything else in a frame is stepped over', () => {
  // A timestamp (fixed64), a brightness update, and an input, in that order.
  const bytes = new Uint8Array([
    ...field(1, 1),
    ...[1, 2, 3, 4, 5, 6, 7, 8],
    ...message(2, message(3, scalar(1, 40))),
    ...message(2, message(11, button(2, 0))),
  ]);

  assert.deepEqual(decodeInputEvents(bytes), [
    { kind: 'button', button: 'start', action: 'press' },
  ]);
});

test('a frame with no input at all yields nothing', () => {
  const bytes = new Uint8Array(message(2, message(3, scalar(1, 40))));

  assert.deepEqual(decodeInputEvents(bytes), []);
});

test('a truncated frame does not hang or throw', () => {
  const full = frame(button(2, 0));

  for (let length = 0; length < full.length; length += 1) {
    assert.doesNotThrow(() => decodeInputEvents(full.subarray(0, length)));
  }
});
