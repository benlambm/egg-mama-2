/*
 * The rules, played by a bot: every chapter must be clearable at the gentle
 * cruise with touch-style inputs, the flock rules must behave (shield first,
 * then ducklings, falls return to the checkpoint), and a run must be
 * deterministic for a seed (saved games rely on it).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { playChapter, T, LEVELS, ENGINE } = require('./helpers.js');

function run(g, ms) { for (let t = 0; t < ms; t += 50) { g.update(50); g.drain(); } }

test('all 13 chapters are generated with sane lengths and fair gaps', () => {
  for (let ci = 0; ci < 13; ci++) {
    const lv = LEVELS.generate(ci, 1, 42 + ci);
    const ch = LEVELS.CHAPTERS[ci];
    const expectMin = ch.sec[0] * T.CRUISE * 0.8, expectMax = ch.sec[1] * T.CRUISE * 1.6;
    assert.ok(lv.L > expectMin && lv.L < expectMax, ch.id + ' length ' + lv.L);
    assert.ok(lv.platforms.length > 10, ch.id + ' has platforms');
    assert.ok(lv.objects.some(o => o.type === 'checkpoint'), ch.id + ' has checkpoints');
    assert.ok(lv.objects.filter(o => o.type === 'egg' && o.golden).length >= 2, ch.id + ' has golden eggs');
    // pits wider than one jump must be bridged by a lift or a crumbling ledge
    const spans = lv.platforms.filter(p => p.y >= -100 && p.type !== 'lift')
      .map(p => [p.x0, p.x1]).sort((a, b) => a[0] - b[0]);
    let x = 0;
    for (const [a, b] of spans) {
      if (a > x + 60) {
        const w = a - x;
        if (w > T.MAX_GAP + 40) {
          const bridged = lv.platforms.some(p =>
            (p.type === 'lift' || p.type === 'crumble') && p.x0 < a - 20 && p.x1 > x + 20);
          assert.ok(bridged, ch.id + ' pit ' + Math.round(w) + ' wide at ' + Math.round(x) + ' is bridged');
        }
      }
      x = Math.max(x, b);
    }
  }
});

test('a bot can traverse every chapter (hits survivable, route never blocks)', () => {
  // With ducklings refilled after each hit (god mode), the bot must finish at
  // least one of three seeds per chapter — falls and hits cost lives but never
  // make the route impossible. Full jump-reachability of every seed is proven
  // separately in reach.test.js.
  for (let ci = 0; ci < 13; ci++) {
    let finished = 0, eggs = 0, cps = 0;
    for (const seed of [7, 1234, 987654]) {
      const r = playChapter({ chapterIndex: ci, seed, flock: 5, shield: 1, god: true, maxMs: 500000 });
      const S = r.game.S;
      if (!S.over && (S.chapterDone || S.beacon)) finished++;
      eggs += S.eggs;
      if (r.events.some(e => e.type === 'checkpoint')) cps++;
    }
    assert.ok(finished >= 1, `ch${ci + 1}: bot finished ${finished}/3 seeds`);
    assert.ok(eggs > 0, `ch${ci + 1} collected eggs`);
    assert.ok(cps >= 1, `ch${ci + 1} hit a checkpoint`);
  }
});

test('a careful player (finite lives) finishes most early chapters cleanly', () => {
  let finished = 0;
  for (let ci = 0; ci < 5; ci++) {
    const r = playChapter({ chapterIndex: ci, seed: 7, flock: 5, shield: 1, maxMs: 420000 });
    const S = r.game.S;
    if (!S.over && (S.chapterDone || S.beacon)) finished++;
  }
  assert.ok(finished >= 4, `finite-lives bot finished ${finished}/5 early chapters`);
});

test('chapter 1 hatches the first golden egg on safe ground', () => {
  const r = playChapter({ chapterIndex: 0, seed: 7, flock: 0, maxMs: 90000 });
  assert.ok(r.events.some(e => e.type === 'hatch'), 'a duckling hatched in Meadow');
});

test('determinism: same seed, same route and same events', () => {
  const a = playChapter({ chapterIndex: 4, seed: 555, flock: 5, maxMs: 30000 });
  const b = playChapter({ chapterIndex: 4, seed: 555, flock: 5, maxMs: 30000 });
  assert.equal(a.game.level.L, b.game.level.L);
  assert.equal(a.game.level.platforms.length, b.game.level.platforms.length);
  assert.deepEqual(a.events.map(e => e.type), b.events.map(e => e.type));
  assert.equal(a.game.S.x, b.game.S.x);
});

test('flock rules: shield absorbs first, then a duckling, then the attempt ends', () => {
  const g = ENGINE.createGame({ chapterIndex: 0, circuit: 1, seed: 3, carry: { flock: 1, shield: 1 } });
  const spike = { type: 'spikes', x: g.S.x + 30, w: 100, y: 0 };
  g.level.objects.push(spike);
  g.update(50);
  let ev = g.drain();
  assert.ok(ev.some(e => e.type === 'shieldHit'), 'shield took the hit first');
  assert.equal(g.S.shield, 0);
  assert.equal(g.S.flock, 1);
  g.S.invuln = 0; spike.x = g.S.x + 30;
  g.update(50);
  ev = g.drain();
  assert.ok(ev.some(e => e.type === 'ducklingLost'), 'duckling lost on second hit');
  assert.equal(g.S.flock, 0);
  g.S.invuln = 0; spike.x = g.S.x + 30;
  g.update(50);
  ev = g.drain();
  assert.ok(ev.some(e => e.type === 'over'), 'over with no shield or ducklings');
  assert.ok(g.S.over);
});

test('a survivable fall returns Mama to the latest checkpoint', () => {
  const g = ENGINE.createGame({ chapterIndex: 0, circuit: 1, seed: 3, carry: { flock: 2 } });
  // walk to the first checkpoint flag and pass it
  const cp = g.level.objects.find(o => o.type === 'checkpoint' && o.x > T.START_X + 100);
  assert.ok(cp, 'a checkpoint exists beyond the start');
  g.S.x = cp.x - 5;
  g.update(50);
  const ev0 = g.drain();
  assert.ok(ev0.some(e => e.type === 'checkpoint'), 'checkpoint event fired');
  const cpX = g.S.cpX;
  assert.ok(cpX >= cp.x, 'saved position advanced to the flag');
  // now fall into a pit
  g.S.y = T.KILL_Y - 10;
  g.update(50);
  const ev = g.drain();
  assert.ok(ev.some(e => e.type === 'fall'), 'fall event');
  assert.equal(g.S.flock, 1, 'the fall used one duckling');
  assert.ok(Math.abs(g.S.x - cpX) < 90, 'respawned at the checkpoint');
  assert.ok(g.S.invuln > 0, 'recovery window after the fall');
  // with nothing left, a fall ends the attempt
  g.S.flock = 0; g.S.shield = 0; g.S.invuln = 0;
  g.S.y = T.KILL_Y - 10;
  g.update(50);
  assert.ok(g.drain().some(e => e.type === 'over' && e.cause === 'fall'));
});

test('eggs: ordinary eggs score, golden eggs hatch up to five ducklings', () => {
  const g = ENGINE.createGame({ chapterIndex: 0, circuit: 1, seed: 3, carry: { flock: 4 } });
  const egg = g.level.objects.find(o => o.type === 'egg' && !o.golden);
  const gold = g.level.objects.find(o => o.type === 'egg' && o.golden);
  g.S.x = egg.x; g.S.y = egg.y - T.MAMA_H * 0.55;
  g.update(16); g.drain();
  assert.equal(g.S.eggs, 1);
  g.S.x = gold.x; g.S.y = gold.y - T.MAMA_H * 0.55;
  g.update(16);
  const ev = g.drain();
  assert.ok(ev.some(e => e.type === 'hatch'));
  assert.equal(g.S.flock, 5, 'hatched to five');
  const gold2 = { type: 'egg', x: g.S.x + 10, y: g.S.y + T.MAMA_H * 0.55, golden: true, taken: false };
  g.level.objects.push(gold2);
  g.update(16);
  const ev2 = g.drain();
  assert.ok(ev2.some(e => e.type === 'golden'), 'sixth golden still awards eggs and points');
  assert.equal(g.S.flock, 5, 'flock stays at five');
  assert.ok(g.S.eggs >= 2);
});

test('steering: brake backs up briefly, boost pushes, then the gentle roll returns', () => {
  const g = ENGINE.createGame({ chapterIndex: 0, circuit: 1, seed: 3 });
  run(g, 400);
  const cruise = g.S.vx;
  g.input('right');
  run(g, 300);
  assert.ok(g.S.vx > cruise + 100, 'boost pushes ahead');
  run(g, T.BOOST_MS);
  assert.ok(Math.abs(g.S.vx - T.CRUISE) < 30, 'back to cruise after the push expires');
  g.input('left');
  run(g, 300);
  assert.ok(g.S.vx < cruise - 100, 'brake slows and backs up');
  run(g, T.BRAKE_MS + 150);
  assert.ok(Math.abs(g.S.vx - T.CRUISE) < 30, 'back to the gentle roll');
});

test('jump buffering and coyote time make jumps forgiving', () => {
  const g = ENGINE.createGame({ chapterIndex: 0, circuit: 1, seed: 3 });
  run(g, 200);
  g.input('jump');
  g.update(16);
  assert.ok(g.drain().some(e => e.type === 'jump'), 'jump fires');
  // land again, then roll off the edge of the intro flat
  let guard = 0;
  while (!g.S.onGround && guard++ < 200) run(g, 50);
  assert.ok(g.S.onGround, 'landed');
  guard = 0;
  while (g.S.onGround && guard++ < 400) run(g, 50);
  assert.ok(!g.S.onGround, 'rolled off an edge');
  assert.ok(g.S.coyote > 0, 'coyote time after leaving an edge');
  g.input('jump');
  g.update(16);
  assert.ok(g.drain().some(e => e.type === 'jump'), 'buffered jump fires within the grace interval');
});

test('serialize() produces the save shape Continue restores', () => {
  const g = ENGINE.createGame({ chapterIndex: 5, circuit: 2, seed: 77, carry: { x: 1200, eggs: 9, score: 400, flock: 3, shield: 1 } });
  run(g, 500);
  const s = g.serialize();
  assert.equal(s.v, 2);
  assert.equal(s.chapter, 5);
  assert.equal(s.circuit, 2);
  assert.equal(s.seed, 77);
  assert.equal(s.flock, 3);
  assert.ok(s.shield === 0 || s.shield === 1);
  assert.ok(s.x >= 0 && Number.isFinite(s.x));
  const g2 = ENGINE.createGame({ chapterIndex: s.chapter, circuit: s.circuit, seed: s.seed, carry: s });
  assert.equal(g2.level.L, g.level.L);
  assert.ok(Math.abs(g2.S.x - s.x) < 0.01);
  assert.ok(g2.S.y >= 0);
});
