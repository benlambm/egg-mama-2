/*
 * Shared helpers for the checks: a seeded bot that plays a chapter with the
 * real rules, the way a player would (jump at gaps, hazards and lifts).
 */
'use strict';
const T = require('../js/tuning.js');
const LEVELS = require('../js/levels.js');
const ENGINE = require('../js/engine.js');

function supportAt(game, x, yMax) {
  // any alive platform whose span covers x and whose top is at/below yMax
  return coverAt(game, x, -1e9, yMax);
}

// any alive platform whose span covers x with top in [yLo, yHi]
function coverAt(game, x, yLo, yHi) {
  for (const p of game.level.platforms) {
    if (!p.alive) continue;
    const s = game.span(p);
    if (x >= s.x0 - 6 && x <= s.x1 + 6 && s.y >= yLo && s.y <= yHi) return Object.assign({ type: p.type }, s);
  }
  return null;
}
function coverIn(game, x0, x1, yLo, yHi) {
  for (let x = x0; x <= x1; x += 30) {
    const s = coverAt(game, x, yLo, yHi);
    if (s) return s;
  }
  return null;
}

function hazardAhead(game, x, y) {
  // nearest spike or enemy roughly on Mama's level, ahead of x
  let best = null;
  for (const o of game.level.objects) {
    if (o.type === 'spikes') {
      const d = o.x - o.w / 2 - x;
      if (d > -20 && Math.abs(o.y - y) < 90 && (!best || d < best.d)) best = { d, o };
    } else if (o.type === 'enemy' && o.alive) {
      const ep = game.enemyPos(o);
      const d = ep.x - x;
      if (d > -30 && d < 400 && Math.abs(ep.y - y) < 170 && (!best || d < best.d)) best = { d, o };
    }
  }
  return best;
}

function liftNear(game, x, y) {
  for (const p of game.level.platforms) {
    if (p.type !== 'lift' || !p.alive) continue;
    const s = game.span(p);
    const cx = (s.x0 + s.x1) / 2;
    if (cx > x + 30 && cx < x + 360 && Math.abs(s.y - y) < 130) return s;
  }
  return null;
}

// Where would a jump from (S.x, S.y) at the current speed land? Solves the
// arc exactly and returns the nearest platform whose top is crossed on the
// way down within the platform's span. Lifts are skipped unless asked.
function jumpLanding(game, S, allowLifts, includeCurrent) {
  const g = T.GRAVITY, v0 = T.JUMP_SPEED;
  let best = null;
  for (const p of game.level.platforms) {
    if (!p.alive || (p === S.onGround && !includeCurrent)) continue;
    if (p.type === 'lift' && !allowLifts) continue;
    const s = game.span(p);
    const dy = s.y - S.y;
    if (dy > v0 * v0 / (2 * g) || dy < -400) continue;   // deep drops are fine (falls are safe)
    const disc = v0 * v0 - 2 * g * dy;
    if (disc < 0) continue;
    const t = (v0 + Math.sqrt(disc)) / g;          // descending branch
    const xl = S.x + S.vx * t;
    const tol = p.type === 'lift' ? 70 : 22;       // lifts swing; aim mid-slab
    if (xl >= s.x0 - tol && xl <= s.x1 + tol && (!best || xl < best.xl)) best = { xl, s, p };
  }
  return best;
}

// Play one chapter with the real engine. Returns {game, events, ticks}.
// opts: {flock, shield, maxMs, seed, chapterIndex, circuit, carry}
function playChapter(opts) {
  opts = opts || {};
  const god = !!opts.god;
  const chapterIndex = opts.chapterIndex || 0;
  const game = ENGINE.createGame({
    chapterIndex, circuit: opts.circuit || 1, seed: opts.seed === undefined ? 1 : opts.seed,
    carry: { x: opts.carryX || 0, eggs: 0, score: 0, flock: opts.flock || 0, shield: opts.shield || 0 }
  });
  const maxMs = opts.maxMs || 400000;
  const events = [];
  let lastJump = -1e9, tick = 0, attempt = 0;
  while (game.S.t < maxMs && !game.S.over && !game.S.chapterDone && !game.S.beacon) {
    game.update(50);           // 50 ms per decision
    tick++;
    const S = game.S;
    for (const e of game.drain()) { events.push(e); if (e.type === 'fall') attempt++;
      if (god && (e.type === 'fall' || e.type === 'ducklingLost' || e.type === 'shieldHit')) { game.S.flock = 5; game.S.shield = 1; game.S.invuln = 1500; } }
    if (S.over || S.chapterDone || S.beacon) break;

    const onG = S.onGround;
    const hz = hazardAhead(game, S.x, S.y);
    const APEX = T.JUMP_SPEED * T.JUMP_SPEED / (2 * T.GRAVITY);   // ≈396
    const JD = T.JUMP_DIST;                                      // ≈380

    if (!onG) continue;

    if (onG.type === 'crumble' && onG.standT > 60) {
      // jump off a cracking ledge before it gives way
      if (jumpLanding(game, S) && S.t - lastJump > 120) { game.input('jump'); lastJump = S.t; }
      continue;
    }
    if (onG.type === 'lift') {
      // hop off toward real ground as soon as a jump from here lands on it
      const best = jumpLanding(game, S, false);
      if (best && best.xl > S.x + 60 && S.t - lastJump > 120) { game.input('jump'); lastJump = S.t; }
      continue;
    }
    // a hazard on my level: jump when the arc would land clear of it
    if (hz && hz.d > 30 && hz.d < 340 + attempt * 40 && S.t - lastJump > 150) {
      if (hz.o.kind === 'fly') {
        // a flyer: only jump when it is right on top of us (stomp); otherwise
        // hold back and let it pass
        if (hz.d < 110) { game.input('jump'); lastJump = S.t; }
        else if (hz.d < 300) game.input('left');
        continue;
      }
      const hzEnd = hz.o.type === 'spikes' ? hz.o.x + hz.o.w / 2 : hz.o.x + 60;
      const best = jumpLanding(game, S, true, true);
      if (best && best.xl > hzEnd + 20) { game.input('jump'); lastJump = S.t; continue; }
    }
    const span = game.span(onG);
    // a ledge that needs a real jump UP is ahead: take off now — waiting
    // until the edge makes the arc overshoot a narrow high ledge
    const climb = coverIn(game, span.x1 + 10, span.x1 + 480, S.y + T.STEP_UP + 1, 1e9);
    if (climb && S.t - lastJump > 150) {
      const best0 = jumpLanding(game, S, true, true);
      if (best0 && best0.s.y >= climb.y - 1 && best0.xl > span.x1 - 60) { game.input('jump'); lastJump = S.t; continue; }
    }
    // an edge is coming within one jump: jump as soon as the arc lands past it
    // (each retry after a fall tries a little earlier, to vary the take-off)
    if (span.x1 - S.x < JD + attempt * 30 && S.t - lastJump > 80) {
      const best = jumpLanding(game, S, true);
      if (best && best.xl > span.x1 - 30 - attempt * 10) { game.input('jump'); lastJump = S.t; continue; }
      // no static landing: if a lift is swinging in the pit, hold at the edge
      // until the lift is close enough to catch
      if (span.x1 - S.x < 200 && !jumpLanding(game, S, false)) {
        const lift = game.level.platforms.find(p => {
          if (p.type !== 'lift' || !p.alive) return false;
          const s = game.span(p);
          const cx = (s.x0 + s.x1) / 2;
          return cx > span.x1 - 60 && cx < S.x + 460 && Math.abs(s.y - S.y) < 200;
        });
        if (lift) {
          const s = game.span(lift), cx = (s.x0 + s.x1) / 2;
          if (span.x1 - S.x < 90 && cx - S.x > 40 && cx - S.x < 360 && S.t - lastJump > 80) { game.input('jump'); lastJump = S.t; }
          else game.input('left');
        }
      }
    }
  }
  for (const e of game.drain()) events.push(e);
  return { game, events, ticks: tick };
}

module.exports = { playChapter, supportAt, coverAt, hazardAhead, jumpLanding, T, LEVELS, ENGINE };
