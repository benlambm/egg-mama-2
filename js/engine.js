/*
 * Egg Mama — the rules of a chapter run.
 *
 * Pure logic: no drawing, no sound, no browser code, so the checks in /tests
 * can play whole chapters in Node. Mama rolls forward on her own; the player
 * swipes (or presses keys) to jump, brake/back up, or push ahead. Eggs are
 * collected by touch, golden eggs hatch ducklings, and ducklings are extra
 * lives: a shield absorbs the next hit first, otherwise a hit uses one
 * duckling. A fall is survivable while Mama has a shield or a duckling and
 * returns her to the latest checkpoint.
 *
 * A game is one chapter of one circuit. main.js chains chapters; the save is
 * the serialize() of the latest checkpoint.
 */
(function (root) {
  'use strict';

  var isNode = (typeof module !== 'undefined' && module.exports);
  var T = isNode ? require('./tuning.js') : root.EM.TUNING;
  var LEVELS = isNode ? require('./levels.js') : root.EM.levels;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Where a lift platform is at time t (ms). Ping-pong via cosine, so it
  // slows at each end — which is what makes boarding and leaving readable.
  function liftPos(p, t) {
    var a = p.phase + t * T.LIFT_OMEGA;
    var f = 0.5 - 0.5 * Math.cos(a);         // 0..1..0
    return p.from + (p.to - p.from) * f;
  }
  function platformSpan(p, t) {
    if (p.type === 'lift') {
      if (p.axis === 'x') return { x0: liftPos(p, t), x1: liftPos(p, t) + p.w, y: p.y };
      return { x0: p.x0, x1: p.x1, y: liftPos(p, t) };
    }
    return { x0: p.x0, x1: p.x1, y: p.y };
  }
  function enemyPos(e, t) {
    if (e.kind === 'fly') {
      var a = e.phase + t * e.speed;
      return { x: e.cx + Math.cos(a) * e.rx, y: e.cy + Math.sin(a) * e.ry };
    }
    return { x: e.x, y: e.y };
  }

  // carry: {x, eggs, score, flock, shield} — where a Continue or a chapter
  // transition resumes from.
  function createGame(opts) {
    opts = opts || {};
    var level = LEVELS.generate(opts.chapterIndex || 0, opts.circuit || 1, opts.seed === undefined ? 1 : opts.seed);
    var carry = opts.carry || {};
    var startX = carry.x || T.START_X;
    var startY = 0;
    for (var pi = 0; pi < level.platforms.length; pi++) {
      var pp = level.platforms[pi];
      if (startX >= pp.x0 - 4 && startX <= pp.x1 + 4 && pp.y >= startY) startY = pp.y;
    }

    var S = {
      t: 0, x: startX, y: startY, vx: T.CRUISE * 0.6, vy: 0,
      onGround: null, coyote: 0, buffer: 0,
      boostT: 0, brakeT: 0, invuln: 0, magnetT: 0,
      shield: carry.shield || 0,
      eggs: carry.eggs || 0, score: carry.score || 0, scoreF: 0, flock: carry.flock || 0,
      cpX: startX, cpY: startY,
      over: false, cause: null, chapterDone: false, beacon: false,
      streak: 0, events: []
    };
    var hist = [];          // {t, x, y} — the ducklings copy this trail
    var acc = 0;

    // Highest alive platform top at x, at or below maxY (0 = the chapter floor).
    function groundYAt(lv, x, maxY) {
      var best = 0, i, p;
      for (i = 0; i < lv.platforms.length; i++) {
        p = lv.platforms[i];
        if (!p.alive) continue;
        if (x >= p.x0 - 4 && x <= p.x1 + 4 && p.y <= maxY + 60 && p.y >= best) best = p.y;
      }
      return best;
    }

    function emit(e) { S.events.push(e); }

    function hit(cause) {
      if (S.invuln > 0 || S.over) return;
      if (S.shield > 0) {
        S.shield--; S.invuln = T.RECOVER_MS;
        emit({ type: 'shieldHit', cause: cause, x: S.x, y: S.y });
      } else if (S.flock > 0) {
        S.flock--; S.invuln = T.RECOVER_MS;
        emit({ type: 'ducklingLost', cause: cause, x: S.x, y: S.y });
      } else {
        S.over = true; S.cause = cause;
        emit({ type: 'over', cause: cause, x: S.x, y: S.y });
      }
    }

    function respawn() {
      S.x = S.cpX; S.y = S.cpY + 4; S.vx = T.CRUISE * 0.6; S.vy = 0;
      S.onGround = null; S.coyote = 0; S.buffer = 0; S.invuln = T.RECOVER_MS * 1.5;
      hist.length = 0;
    }

    function fall() {
      if (S.over) return;
      if (S.shield > 0) {
        S.shield--; respawn();
        emit({ type: 'fall', savedBy: 'shield', x: S.cpX, y: S.cpY });
      } else if (S.flock > 0) {
        S.flock--; respawn();
        emit({ type: 'fall', savedBy: 'duckling', x: S.cpX, y: S.cpY });
      } else {
        S.over = true; S.cause = 'fall';
        emit({ type: 'over', cause: 'fall', x: S.x, y: S.y });
      }
    }

    function step(dt) {
      if (S.over) { S.t += dt; return; }
      S.t += dt;
      var i, p;

      // lift platforms move with the clock (paused game = still lifts)
      for (i = 0; i < level.platforms.length; i++) {
        p = level.platforms[i];
        if (p.type === 'lift') { p.cx0 = platformSpan(p, S.t).x0; p.cy = platformSpan(p, S.t).y; }
      }

      // timers
      S.boostT = Math.max(0, S.boostT - dt);
      S.brakeT = Math.max(0, S.brakeT - dt);
      S.invuln = Math.max(0, S.invuln - dt);
      S.magnetT = Math.max(0, S.magnetT - dt);
      S.coyote = Math.max(0, S.coyote - dt);
      S.buffer = Math.max(0, S.buffer - dt);

      // riding a lift carries Mama with it
      if (S.onGround && S.onGround.type === 'lift') {
        var p0 = platformSpan(S.onGround, S.t - dt), p1 = platformSpan(S.onGround, S.t);
        S.x += p1.x0 - p0.x0; S.y += p1.y - p0.y;
      }

      // steering: gentle roll by default; swipes push or brake, then expire
      var target = T.CRUISE;
      if (S.boostT > 0) target = T.BOOST_SPEED;
      else if (S.brakeT > 0) target = T.BRAKE_SPEED;
      var ice = S.onGround && S.onGround.type === 'ice';
      var accel = ice ? T.ICE_ACCEL : (S.onGround ? T.ACCEL : T.ACCEL * 0.55);
      var dv = clamp(target - S.vx, -accel * dt / 1000, accel * dt / 1000);
      S.vx += dv;

      // physics
      var prevX = S.x, prevY = S.y;
      S.vy -= T.GRAVITY * dt / 1000;
      S.x += S.vx * dt / 1000;
      S.y += S.vy * dt / 1000;
      S.scoreF += Math.max(0, S.x - prevX) / T.UNITS_PER_POINT;
      if (S.scoreF >= 1) { var whole = Math.floor(S.scoreF); S.score += whole; S.scoreF -= whole; }

      // landing on the highest platform whose top we crossed from above
      if (S.vy <= 0) {
        var best = null, bs = null;
        for (i = 0; i < level.platforms.length; i++) {
          p = level.platforms[i];
          if (!p.alive) continue;
          var sp = platformSpan(p, S.t);
          if (S.x < sp.x0 - T.MAMA_R * 0.7 || S.x > sp.x1 + T.MAMA_R * 0.7) continue;
          // normal landing: crossed the top from above. While rolling, a low
          // ledge (within STEP_UP) is stepped onto instead of fallen past.
          var normal = prevY >= sp.y - 0.5 && S.y <= sp.y;
          var stepUp = S.onGround && sp.y > prevY && sp.y - prevY <= T.STEP_UP && S.y <= sp.y;
          if (normal || stepUp) {
            if (!best || sp.y > bs.y) { best = p; bs = sp; }
          }
        }
        if (best) {
          if (!S.onGround && S.vy < -1050) emit({ type: 'land', hard: true, x: S.x, y: bs.y });
          else if (!S.onGround) emit({ type: 'land', hard: false, x: S.x, y: bs.y });
          S.y = bs.y; S.vy = 0; S.onGround = best; S.coyote = T.COYOTE_MS;
          if (best.type === 'crumble') best.standT = 0;
          // springs launch
          for (i = 0; i < level.objects.length; i++) {
            var o = level.objects[i];
            if (o.type === 'spring' && Math.abs(S.x - o.x) < 46 && Math.abs(S.y - o.y) < 12) {
              S.vy = T.SPRING_SPEED; S.onGround = null; S.coyote = 0;
              emit({ type: 'spring', x: o.x, y: o.y });
            }
          }
        } else if (S.onGround) {
          S.onGround = null; S.coyote = T.COYOTE_MS;   // rolled off an edge
        }
      }

      // buffered jump (slightly early press fires on landing)
      if (S.buffer > 0 && (S.onGround || S.coyote > 0)) {
        S.vy = T.JUMP_SPEED; S.onGround = null; S.coyote = 0; S.buffer = 0;
        emit({ type: 'jump', x: S.x, y: S.y });
      }

      // crumbling ledges give way while stood on
      if (S.onGround && S.onGround.type === 'crumble' && S.onGround.alive) {
        var cp = S.onGround;
        cp.standT += dt;
        if (cp.standT > T.CRUMBLE_TOTAL_MS) {
          cp.alive = false; S.onGround = null; S.coyote = 0;
          emit({ type: 'crack', x: (cp.x0 + cp.x1) / 2, y: cp.y });
        } else if (cp.standT > T.CRUMBLE_WARN_MS && !cp.warned) {
          cp.warned = true;
          emit({ type: 'creak', x: (cp.x0 + cp.x1) / 2, y: cp.y });
        }
      }

      // hazards
      if (S.invuln <= 0) {
        for (i = 0; i < level.objects.length; i++) {
          var ob = level.objects[i];
          if (ob.type === 'spikes') {
            if (Math.abs(S.x - ob.x) < ob.w / 2 + T.MAMA_R * 0.55 &&
                S.y < ob.y + T.SPIKE_HIT_H && S.y > ob.y - 60) { hit('spikes'); break; }
          } else if (ob.type === 'enemy' && ob.alive) {
            var ep = enemyPos(ob, S.t);
            var hw = ob.kind === 'fly' ? T.FLYER_HALF_W : T.ENEMY_HALF_W;
            var eh = ob.kind === 'fly' ? T.FLYER_H : T.ENEMY_H;
            var overlap = Math.abs(S.x - ep.x) < hw + T.MAMA_R * 0.8 &&
                          S.y < ep.y + eh && S.y + T.MAMA_H > ep.y + 6;
            if (overlap) {
              var stomp = S.vy < 0 && prevY >= ep.y + eh - 10 && S.y <= ep.y + eh + 10;
              if (stomp) {
                ob.alive = false; S.vy = T.STOMP_BOUNCE; S.score += T.STOMP_POINTS;
                emit({ type: 'stomp', x: ep.x, y: ep.y });
              } else { hit('enemy'); break; }
            }
          }
        }
      }
      // crawlers patrol
      for (i = 0; i < level.objects.length; i++) {
        var e = level.objects[i];
        if (e.type === 'enemy' && e.kind === 'crawl' && e.alive) {
          e.x += e.dir * e.speed * dt / 1000;
          if (e.x < e.x0 + T.ENEMY_HALF_W) { e.x = e.x0 + T.ENEMY_HALF_W; e.dir = 1; }
          if (e.x > e.x1 - T.ENEMY_HALF_W) { e.x = e.x1 - T.ENEMY_HALF_W; e.dir = -1; }
        }
      }

      // eggs (the magnet pulls them in first)
      var midY = S.y + T.MAMA_H * 0.55;
      for (i = 0; i < level.objects.length; i++) {
        var g = level.objects[i];
        if (g.type === 'egg' && !g.taken) {
          var dx = S.x - g.x, dy = midY - g.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (S.magnetT > 0 && dist < T.MAGNET_RADIUS && dist > 1) {
            g.x += dx * 0.14; g.y += dy * 0.14;
            dx = S.x - g.x; dy = midY - g.y; dist = Math.sqrt(dx * dx + dy * dy);
          }
          if (dist < T.EGG_REACH) {
            g.taken = true; S.eggs++;
            if (g.golden) {
              S.score += T.GOLDEN_POINTS;
              if (S.flock < T.MAX_FLOCK) { S.flock++; emit({ type: 'hatch', x: g.x, y: g.y }); }
              else emit({ type: 'golden', x: g.x, y: g.y });
            } else {
              S.streak++; S.score += T.EGG_POINTS;
              emit({ type: 'egg', streak: S.streak, x: g.x, y: g.y });
            }
          }
        } else if (g.type === 'pickup' && !g.taken) {
          var dx2 = S.x - g.x, dy2 = midY - g.y;
          if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < T.EGG_REACH + 8) {
            g.taken = true;
            if (g.kind === 'shield') { S.shield = T.SHIELD_HITS; emit({ type: 'shield', x: g.x, y: g.y }); }
            else { S.magnetT = T.MAGNET_MS; emit({ type: 'magnet', x: g.x, y: g.y }); }
          }
        } else if (g.type === 'checkpoint' && !g.passed && S.x >= g.x) {
          g.passed = true;
          if (g.x >= S.cpX) { S.cpX = g.x; S.cpY = g.y + 2; }   // never move the save backwards
          emit({ type: 'checkpoint', x: g.x, y: g.y });
        } else if (g.type === 'beacon' && !g.lit && S.x >= g.x - T.MAMA_R) {
          g.lit = true; S.beacon = true;
          emit({ type: 'beacon', x: g.x, y: g.y });
        }
      }

      // pit
      if (S.y < T.KILL_Y) fall();

      // chapter end
      if (!S.chapterDone && !S.beacon && S.x >= level.L) {
        S.chapterDone = true;
        emit({ type: 'chapterEnd', x: S.x });
      }

      hist.push({ t: S.t, x: S.x, y: S.y });
      if (hist.length > 900) hist.shift();
    }

    return {
      S: S, level: level, hist: hist,
      update: function (dtMs) {
        acc += clamp(dtMs, 0, 1000);
        while (acc >= T.STEP_MS) { step(T.STEP_MS); acc -= T.STEP_MS; }
      },
      input: function (cmd) {
        if (S.over) return;
        if (cmd === 'jump') S.buffer = T.JUMP_BUFFER_MS;
        else if (cmd === 'left') { S.brakeT = T.BRAKE_MS; S.boostT = 0; }
        else if (cmd === 'right') { S.boostT = T.BOOST_MS; S.brakeT = 0; }
      },
      drain: function () { var e = S.events; S.events = []; return e; },
      serialize: function () {
        return { v: 2, chapter: level.chapterIndex, circuit: level.circuit, seed: level.seed,
                 x: S.cpX, y: S.cpY, eggs: S.eggs, score: Math.round(S.score),
                 flock: S.flock, shield: S.shield, beaconLit: !!S.beacon };
      },
      enemyPos: function (e) { return enemyPos(e, S.t); },
      span: function (p) { return platformSpan(p, S.t); }
    };
  }

  var api = { createGame: createGame, liftPos: liftPos, platformSpan: platformSpan, enemyPos: enemyPos };
  root.EM = root.EM || {};
  root.EM.engine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
