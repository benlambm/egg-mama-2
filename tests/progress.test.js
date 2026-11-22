/*
 * What the device remembers: save round-trips, two-tab sync, Start Over with
 * cancel preserving the save, settings persistence, and carrying over a
 * legacy GitHub Pages save (SAVE-2).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PROGRESS = require('../js/progress.js');

function fakeStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m
  };
}

test('record / hasSave / save round-trip', () => {
  const st = fakeStorage();
  const p = PROGRESS.createProgress(st);
  assert.equal(p.hasSave(), false);
  p.record({ v: 2, chapter: 3, circuit: 1, seed: 99, x: 5000, y: 0, eggs: 12, score: 800, flock: 2, shield: 1, beaconLit: false }, ['meadow', 'clover-mill']);
  assert.equal(p.hasSave(), true);
  const s = p.save();
  assert.equal(s.chapter, 3);
  assert.equal(s.eggs, 12);
  assert.equal(s.flock, 2);
  assert.deepEqual(s.cues, ['meadow', 'clover-mill']);
  // a fresh progress object on the same storage sees it too
  const p2 = PROGRESS.createProgress(st);
  assert.equal(p2.save().seed, 99);
  assert.equal(p2.hasSave(), true);
});

test('damaged saves fall back to fresh values, never crash', () => {
  const st = fakeStorage({ [PROGRESS.KEY]: '{not json', [PROGRESS.KEY_SETTINGS]: '{"sound":false}' });
  const p = PROGRESS.createProgress(st);
  const s = p.save();
  assert.equal(s.chapter, 0);
  assert.equal(s.eggs, 0);
  assert.equal(p.settings().sound, false);
  p.record({ v: 2, chapter: 99, circuit: -4, seed: -1, x: 1e12, y: NaN, eggs: -5, score: 'x', flock: 99, shield: 9 }, ['nope']);
  const s2 = p.save();
  assert.ok(s2.chapter <= 12 && s2.circuit >= 1 && s2.flock <= 5 && s2.shield <= 1);
  assert.deepEqual(s2.cues, ['nope']);
});

test('Start Over replaces the journey but keeps settings; cancel keeps the save', () => {
  const st = fakeStorage();
  const p = PROGRESS.createProgress(st);
  p.setSwitch('music', false);
  p.record({ v: 2, chapter: 6, circuit: 2, seed: 5, x: 900, y: 0, eggs: 30, score: 2000, flock: 4, shield: 0, beaconLit: true }, ['meadow']);
  // cancel = simply not calling startOver
  assert.equal(p.save().eggs, 30);
  p.startOver();
  const s = p.save();
  assert.equal(s.eggs, 0);
  assert.equal(s.flock, 0);
  assert.equal(s.chapter, 0);
  assert.equal(s.beaconLit, false);
  assert.equal(p.settings().music, false, 'settings survive Start Over');
  assert.equal(p.hasSave(), false);
});

test('a legacy GitHub Pages save is carried over when no v2 save exists', () => {
  const st = fakeStorage({
    'egg-mama.save.v1': JSON.stringify({ chapter: 4, circuit: 1, seed: 321, checkpointX: 2600, eggs: 21, score: 1500, ducklings: 3, beacon: false })
  });
  const p = PROGRESS.createProgress(st);
  const s = p.save();
  assert.equal(s.chapter, 4);
  assert.equal(s.seed, 321);
  assert.equal(s.x, 2600);
  assert.equal(s.eggs, 21);
  assert.equal(s.flock, 3);
  assert.equal(p.hasSave(), true);
});

test('two tabs: a save made in one is picked up by the other', () => {
  const st = fakeStorage();
  const a = PROGRESS.createProgress(st);
  const b = PROGRESS.createProgress(st);
  a.record({ v: 2, chapter: 2, circuit: 1, seed: 8, x: 100, y: 0, eggs: 5, score: 50, flock: 0, shield: 0 }, []);
  assert.equal(b.save().eggs, 5, 'the other tab sees the new save on next read');
  b.startOver();
  assert.equal(a.save().eggs, 0);
});
