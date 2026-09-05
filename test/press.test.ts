import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOUBLE_PRESS_MS, DoublePress } from '../src/domain/press.js';

test('one press falls due once its window closes', () => {
  const press = new DoublePress();

  assert.equal(press.press(1000), null, 'nothing fires while a second may follow');
  assert.equal(press.due(1000 + DOUBLE_PRESS_MS), null, 'not yet');
  assert.equal(press.due(1000 + DOUBLE_PRESS_MS + 1), 'single');
  assert.equal(press.due(9000), null, 'and only once');
});

test('two presses inside the window are a double, and no single follows', () => {
  const press = new DoublePress();

  press.press(1000);
  assert.equal(press.press(1200), 'double');
  assert.equal(press.due(5000), null, 'the pending single was consumed');
});

test('two slow presses are two singles', () => {
  const press = new DoublePress();

  press.press(1000);
  assert.equal(press.due(1000 + DOUBLE_PRESS_MS + 1), 'single');
  assert.equal(press.press(2000), null);
  assert.equal(press.due(2000 + DOUBLE_PRESS_MS + 1), 'single');
});

test('a third quick press starts a new pair rather than firing again', () => {
  const press = new DoublePress();

  press.press(1000);
  assert.equal(press.press(1100), 'double');
  assert.equal(press.press(1200), null, 'this one is now waiting on a partner');
  assert.equal(press.press(1300), 'double');
});

test('reset drops a press that was still waiting', () => {
  const press = new DoublePress();

  press.press(1000);
  press.reset();

  assert.equal(press.due(5000), null);
});
