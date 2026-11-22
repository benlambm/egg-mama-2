/*
 * Egg Mama — every tuning number, in one place.
 *
 * Change a number here, reload, and the game plays differently. The checks in
 * /tests describe limits that keep the journey fair (for example, that a gap
 * is never wider than one jump at the gentle cruise speed), and they say so
 * if a number breaks one.
 *
 * Units: distance "units" (Mama is about 92 units tall), time milliseconds
 * (names ending _MS), speed units per second.
 */
(function (root) {
  'use strict';

  var TUNING = {

    // ── PACE ────────────────────────────────────────────────────────────
    CRUISE: 360,             // Mama's gentle forward roll, units per second
    BOOST_SPEED: 590,        // swipe right: push ahead
    BOOST_MS: 850,           // how long a push lasts
    BRAKE_SPEED: -70,        // swipe left: brake and briefly back up
    BRAKE_MS: 680,           // how long a brake lasts
    ACCEL: 3200,             // how fast Mama answers a steering swipe (u/s²)
    ICE_ACCEL: 420,          // on ice the answer is much lazier (Frostline)

    // ── JUMP ────────────────────────────────────────────────────────────
    // Air time = 2 * JUMP_SPEED / GRAVITY (1056 ms here); distance at cruise
    // = CRUISE * air time ≈ 380 units; height ≈ 396 units (about 4 Mamas).
    GRAVITY: 2840,
    JUMP_SPEED: 1560,
    COYOTE_MS: 110,          // grace interval after leaving an edge
    JUMP_BUFFER_MS: 140,     // a slightly early jump still fires on landing
    STOMP_BOUNCE: 760,       // bounce off a stomped enemy
    STEP_UP: 72,             // Mama steps up onto low ledges while rolling

    // ── MAMA ────────────────────────────────────────────────────────────
    MAMA_R: 34,              // half-width of her body (hit box)
    MAMA_H: 92,              // height
    KILL_Y: -230,            // below this she has fallen into the pit
    RECOVER_MS: 1600,        // recovery window after a survivable hit

    // ── FLOCK ───────────────────────────────────────────────────────────
    MAX_FLOCK: 5,            // most ducklings that can follow
    EGG_POINTS: 25,          // an ordinary egg
    GOLDEN_POINTS: 100,      // a golden egg (also hatches while flock < 5)
    STOMP_POINTS: 50,
    UNITS_PER_POINT: 10,     // one point per this many units travelled
    EGG_REACH: 56,           // how close Mama's middle must pass to take an egg
    MAGNET_RADIUS: 430,      // egg magnet pull
    MAGNET_MS: 8000,
    SHIELD_HITS: 1,          // a shield absorbs this many hits

    // ── TERRAIN ─────────────────────────────────────────────────────────
    MAX_GAP: 300,            // never wider than one jump at cruise (≈380)
    CRUMBLE_WARN_MS: 420,    // a cracked ledge shakes this long…
    CRUMBLE_TOTAL_MS: 950,   // …then gives way
    LIFT_OMEGA: 0.0005,      // lifts swing with S.t: angle = t * LIFT_OMEGA (rad/ms)
    SPRING_SPEED: 1900,      // a spring's launch (higher than a jump)
    ENEMY_HALF_W: 38,        // crawling enemy hit box
    ENEMY_H: 56,
    FLYER_HALF_W: 34,        // flying enemy hit box
    FLYER_H: 30,
    SPIKE_H: 46,             // spike height
    SPIKE_HIT_H: 30,         // a touch lower than this is safe (landing on top)
    ENEMY_SPEED: 120,        // patrolling crawler, u/s (rises with chapter)
    FLYER_SPEED: 0.0016,     // flying enemy, radians per ms
    FLYER_RX: 190,           // its path's half-width
    FLYER_RY: 70,            // its path's half-height
    FLYER_Y: 190,            // path centre above the ground
    // hopper: a ground enemy that leaps at Mama when she comes close
    HOPPER_TRIGGER: 340,     // she is this close and it springs
    HOPPER_HOP_VY: 980,      // launch speed (a bit over half a jump)
    HOPPER_VX: 320,          // horizontal speed mid-hop, toward Mama
    // diver: a flyer that cruises high and swoops down when Mama is below it
    DIVER_CY: 250,           // cruise height
    DIVER_SPEED: 130,        // horizontal patrol, u/s
    DIVER_TRIGGER: 400,      // swoop when Mama is this close horizontally
    DIVER_DIVE_V: 620,       // swoop speed, u/s
    DIVER_MIN_Y: 46,         // swoop target height (right at Mama's face)
    DIVER_RISE_V: 260,       // climb back up after a swoop

    // ── CHAPTERS ────────────────────────────────────────────────────────
    START_X: 140,            // where Mama begins (a checkpoint stands here)
    INTRO_FLAT: 720,         // safe opening ground in every chapter
    CHECKPOINT_EVERY_MS: [12000, 20000],  // quiet stretch between flags
    EGG_SPACING: 92,

    // ── THE VIEW (landscape; same world on every screen size) ───────────
    // The world is fitted so a VIEW_FIT[0] × VIEW_FIT[1] window just holds it;
    // a wider screen shows more valley ahead, never a different game.
    VIEW_FIT: [1500, 844],
    MAMA_AT: 0.36,           // Mama stands this far from the left edge
    GROUND_AT: 0.80,         // the ground line, as a share of screen height
    SEE_AHEAD: 1500,         // things appear this far ahead of Mama
    DESPAWN_BEHIND: 500,
    BG_PARALLAX: 0.32,       // the painted backdrop slides slower than the world
    MAX_PIXELS: 2300000,     // cap on real pixels drawn (sharp screens go softer)
    MAX_DETAIL: 2.5,         // most real pixels per world unit at Mama

    // ── FLOCK TRAIL (looks only) ────────────────────────────────────────
    TRAIL_GAP: 74,           // distance between ducklings in the line
    TRAIL_DELAY_MS: 120,     // each one copies Mama this much later

    // ── MUSIC ───────────────────────────────────────────────────────────
    MUSIC_VOLUME: 0.42,
    STEP_MS: 1000 / 120      // the rules tick 120 times a second
  };

  TUNING.JUMP_AIR_MS = 2 * TUNING.JUMP_SPEED / TUNING.GRAVITY * 1000;
  TUNING.JUMP_DIST = TUNING.CRUISE * TUNING.JUMP_SPEED * 2 / TUNING.GRAVITY; // ≈380

  root.EM = root.EM || {};
  root.EM.TUNING = TUNING;
  if (typeof module !== 'undefined' && module.exports) module.exports = TUNING;
})(typeof self !== 'undefined' ? self : globalThis);
