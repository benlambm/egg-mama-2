/*
 * Fairness by construction: for every chapter and seed, prove there is a
 * jump-only path from the start to the exit. Nodes are platforms; an edge
 * p→q exists when a jump taken from some point of p at cruise speed lands
 * on q (the arc solved exactly), or when q is a low step (STEP_UP) off p's
 * edge. Lifts count as bridging their pit (they swing through every position).
 * If the exit is reachable, a player can always get through; hazards may cost
 * ducklings but never block the route.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tuning.js');
const LEVELS = require('../js/levels.js');

function airTime(dy) {   // seconds to land on a top dy above take-off, descending
  const disc = T.JUMP_SPEED * T.JUMP_SPEED - 2 * T.GRAVITY * dy;
  if (disc < 0) return null;
  return (T.JUMP_SPEED + Math.sqrt(disc)) / T.GRAVITY;
}

// can a jump from somewhere on p land on q?
function canJump(p, q) {
  const dy = q.y - p.y;
  const t = airTime(dy);
  if (t === null) return false;
  // landing x grows monotonically with take-off x; check the span of xl
  const xl0 = p.x0 + T.CRUISE * t, xl1 = p.x1 + T.CRUISE * t;
  return xl0 <= q.x1 + 22 && xl1 >= q.x0 - 22;
}

function reachable(lv) {
  const plats = lv.platforms.filter(p => p.type !== 'lift');
  const lifts = lv.platforms.filter(p => p.type === 'lift');
  // node list: platforms + a virtual exit node at L
  const nodes = plats.map((p, i) => ({ i, p }));
  const exit = { i: nodes.length, p: { x0: lv.L, x1: lv.L + 200, y: 0, type: 'ground' } };
  nodes.push(exit);
  const adj = nodes.map(() => []);
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b || b.p.x0 < a.p.x1 - 30) continue;
      if (canJump(a.p, b.p)) { adj[a.i].push(b.i); continue; }
      // step-up: low ledge starting at/before a's end
      if (b.p.y > a.p.y && b.p.y - a.p.y <= T.STEP_UP && b.p.x0 <= a.p.x1 + 34) adj[a.i].push(b.i);
    }
    // via a lift: jump onto the lift's sweep, then from the lift onward
    for (const lf of lifts) {
      // the lift's reachable footprint: x sweep for a horizontal lift,
      // x span × y sweep for a vertical one
      const footX = lf.axis === 'x'
        ? { x0: lf.from - 22, x1: lf.to + (lf.w || 0) + 22 }
        : { x0: lf.x0 - 22, x1: lf.x1 + 22 };
      const ys = lf.axis === 'y' ? [Math.min(lf.from, lf.to), Math.max(lf.from, lf.to)] : [lf.y];
      const canBoard = ys.some(y => canJump(a.p, { x0: footX.x0, x1: footX.x1, y }));
      if (!canBoard) continue;
      for (const b of nodes) {
        if (b.p.x0 < footX.x0 - 30) continue;
        const fromLift = ys.some(y => canJump({ x0: lf.axis === 'x' ? lf.from : lf.x0, x1: lf.axis === 'x' ? lf.to + (lf.w || 0) : lf.x1, y }, b.p));
        if (fromLift) adj[a.i].push(b.i);
      }
    }
  }
  // BFS from the platform under the start
  const start = nodes.find(n => n.p.x0 - 24 <= T.START_X && n.p.x1 + 24 >= T.START_X) || nodes[0];
  const seen = new Set([start.i]);
  const queue = [start.i];
  while (queue.length) {
    const u = queue.shift();
    for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); queue.push(v); }
  }
  return seen.has(exit.i);
}

test('every chapter is jump-reachable from start to exit (39 runs)', () => {
  for (let ci = 0; ci < 13; ci++) {
    for (const seed of [7, 1234, 987654, 42 + ci, 20261122, 31337]) {
      const lv = LEVELS.generate(ci, 1, seed);
      assert.ok(reachable(lv), 'ch' + (ci + 1) + ' seed ' + seed + ' has an unreachable exit');
    }
  }
});

test('every checkpoint flag sits on reachable ground', () => {
  for (let ci = 0; ci < 13; ci++) {
    const lv = LEVELS.generate(ci, 1, 7 + ci);
    for (const cp of lv.objects.filter(o => o.type === 'checkpoint')) {
      const under = lv.platforms.some(p => p.type !== 'lift' && cp.x >= p.x0 - 24 && cp.x <= p.x1 + 24);
      assert.ok(under, 'ch' + (ci + 1) + ' checkpoint at ' + Math.round(cp.x) + ' has ground beneath it');
    }
  }
});
