import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toAscii } from '../src/view/ascii.js';

test('Cyrillic is transliterated rather than dropped', () => {
  assert.equal(toAscii('Гражданская оборона'), 'Grazhdanskaya oborona');
  assert.equal(toAscii('Всё идёт по плану'), 'Vsyo idyot po planu');
  assert.equal(toAscii('ЩУКА'), 'SHCHUKA', 'a run of capitals stays shouting');
  assert.equal(toAscii('Щука'), 'Shchuka');
  assert.equal(toAscii('Май'), 'May', 'й must not decompose into a bare и');
});

test('accents lose their marks and keep their letters', () => {
  assert.equal(toAscii('Björk'), 'Bjork');
  assert.equal(toAscii('Sigur Rós'), 'Sigur Ros');
  assert.equal(toAscii('Beyoncé'), 'Beyonce');
});

test('typographic punctuation becomes something the font has', () => {
  assert.equal(toAscii('Bad — Guy'), 'Bad - Guy');
  assert.equal(toAscii('Don’t'), "Don't");
  assert.equal(toAscii('Untitled…'), 'Untitled...');
});

test('scripts with no ASCII spelling leave a word break behind', () => {
  assert.equal(toAscii('米津玄師 Lemon'), 'Lemon');
  assert.equal(toAscii('Song 🎵 Two'), 'Song Two');
});

test('plain ASCII is left exactly alone', () => {
  assert.equal(toAscii('Everything In Its Right Place'), 'Everything In Its Right Place');
});
