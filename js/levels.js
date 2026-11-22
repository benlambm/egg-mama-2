/*
 * Egg Mama — the thirteen landscapes and the route generator.
 *
 * Pure logic: no drawing, no browser code, so the checks in /tests can walk
 * every chapter in Node. A chapter is generated from a seed, so the same seed
 * always gives the same route (which is what saved games rely on).
 *
 * A route is a list of platforms and objects with absolute x positions; y is
 * height above the chapter's ground line (y up). Pits are simply stretches
 * with no platform. Chapter 13 ends at a beacon instead of an exit.
 */
(function (root) {
  'use strict';

  var T = (typeof module !== 'undefined' && module.exports)
    ? require('./tuning.js') : root.EM.TUNING;

  // ── seeded random ────────────────────────────────────────────────────
  function rngMake(seed) {
    var h = { seed: seed >>> 0 };
    return {
      next: function () {
        h.seed = (h.seed + 0x6D2B79F5) >>> 0;
        var t = h.seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      between: function (a, b) { return a + this.next() * (b - a); },
      int: function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); },
      pick: function (arr) { return arr[Math.floor(this.next() * arr.length)]; }
    };
  }

  // ── palettes and chapters ────────────────────────────────────────────
  // Palette: top = walking surface, trim = its lit edge, side = the earth
  // below, sideD = its shade, ink = outlines, pit = colour of a pit's depths
  // (null = plain darkness), overlay = full-screen mood drawn over the
  // painted backdrop.
  var CHAPTERS = [
    { id: 'meadow', num: 1, name: 'Meadow', bg: 'meadow.webp',
      cue: 'The storm scattered my clutch across the valley. Roll on, Mama — the first golden egg rests on safe ground ahead.',
      sec: [60, 90], water: null, overlay: null,
      palette: { top: '#7ec850', trim: '#a8e878', side: '#8a5a33', sideD: '#5f3a1e', ink: '#3f2712', pit: '#3a2a18' },
      music: { bpm: 112, root: 60, minor: false, intensity: 0.5, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 46, gap: 34, stairs: 20 },
      opener: [['goldenGround'], ['gapArc', 240]],
      closing: [['gapArc', 280]] },
    { id: 'clover-mill', num: 2, name: 'Clover Mill', bg: 'clover-mill.webp',
      cue: 'A fox patrols the mill path. Time your jump into the second egg trail, and keep moving.',
      sec: [60, 90], water: null, overlay: null,
      palette: { top: '#8fbf5a', trim: '#b8e07e', side: '#9a6a3a', sideD: '#6b4423', ink: '#43290f', pit: '#3a2a18' },
      music: { bpm: 116, root: 60, minor: false, intensity: 0.55, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 38, gap: 22, enemy: 22, stairs: 10, pickup: 8 },
      opener: [['enemy', 560], ['eggRow', 5]],
      closing: [['enemy', 520], ['gapArc', 260]] },
    { id: 'reedwater', num: 3, name: 'Reedwater', bg: 'reedwater.webp',
      cue: 'The lower path is flooded. Spot the next stepping ledge before you leave the one you are on.',
      sec: [60, 90], water: '#3f7fae', overlay: null,
      palette: { top: '#6fae7c', trim: '#9ed4a8', side: '#7a6a4a', sideD: '#54462e', ink: '#33291a', pit: '#2e5d80' },
      music: { bpm: 104, root: 62, minor: false, intensity: 0.5, leadWave: 'triangle', stabWave: 'triangle' },
      weights: { flat: 30, gap: 18, ledges: 34, enemy: 10, pickup: 8 },
      opener: [['ledges', 3, true]],
      closing: [['ledges', 4, true]] },
    { id: 'orchard-heights', num: 4, name: 'Orchard Heights', bg: 'orchard.webp',
      cue: 'A spring will toss you into the branches for a golden egg. Steer back down onto the lower path.',
      sec: [60, 90], water: null, overlay: null,
      palette: { top: '#86cf5a', trim: '#b2e886', side: '#8a5f36', sideD: '#5f3f22', ink: '#3d2812', pit: '#3a2a18' },
      music: { bpm: 120, root: 65, minor: false, intensity: 0.6, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 34, gap: 18, spring: 22, stairs: 16, enemy: 10 },
      opener: [['spring', true]],
      closing: [['spring', true], ['gapArc', 240]] },
    { id: 'amber-quarry', num: 5, name: 'Amber Quarry', bg: 'amber-quarry.webp',
      cue: 'The ledges here are cracked. Jump again before they give way — do not stand and think.',
      sec: [90, 120], water: null, overlay: null,
      palette: { top: '#b08954', trim: '#d8b47e', side: '#8a6a42', sideD: '#5f4526', ink: '#3a2a14', pit: '#33241a' },
      music: { bpm: 118, root: 57, minor: true, intensity: 0.6, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 26, gap: 16, crumble: 26, spikes: 12, enemy: 12, pickup: 8 },
      opener: [['crumble', 2]],
      closing: [['crumble', 3], ['gapArc', 240]] },
    { id: 'fogwood', num: 6, name: 'Fogwood', bg: 'fogwood.webp',
      cue: 'Something flies through the mist. Read its path, and keep the landing in sight.',
      sec: [90, 120], water: null, overlay: 'fog',
      palette: { top: '#7ba05b', trim: '#a8cc86', side: '#6a5f42', sideD: '#4a4230', ink: '#2e2818', pit: '#2c2618' },
      music: { bpm: 96, root: 57, minor: true, intensity: 0.5, leadWave: 'sine', stabWave: 'sine' },
      weights: { flat: 28, gap: 16, flyer: 26, ledges: 12, spikes: 10, enemy: 8 },
      opener: [['flyer', 620]],
      closing: [['flyer', 560], ['gapArc', 260]] },
    { id: 'ember-canyon', num: 7, name: 'Ember Canyon', bg: 'canyon.webp',
      cue: 'Lava below, spikes ahead. Chain the gap and the spike crossing with room to recover between.',
      sec: [90, 120], water: '#ff7a2a', overlay: 'warm',
      palette: { top: '#c07a4a', trim: '#e0a06a', side: '#96522e', sideD: '#653619', ink: '#38200e', pit: '#a03010' },
      music: { bpm: 126, root: 55, minor: true, intensity: 0.7, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 22, gap: 20, spikes: 24, enemy: 14, crumble: 10, flyer: 10 },
      opener: [['gapSpikes']],
      closing: [['gapSpikes'], ['gapArc', 260]] },
    { id: 'glass-coast', num: 8, name: 'Glass Coast', bg: 'glass-coast.webp',
      cue: 'Board the moving lift and time your exit onto the coastal ledge. The sea is not soft.',
      sec: [90, 120], water: '#3f8fb8', overlay: null,
      palette: { top: '#e8d8a0', trim: '#f8ecc0', side: '#c0a878', sideD: '#8a744e', ink: '#4a3c22', pit: '#2e6a90' },
      music: { bpm: 122, root: 60, minor: false, intensity: 0.65, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 26, gap: 14, lift: 30, ledges: 14, enemy: 8, pickup: 8 },
      opener: [['liftX']],
      closing: [['liftX'], ['gapArc', 240]] },
    { id: 'lantern-caverns', num: 9, name: 'Lantern Caverns', bg: 'lantern-caverns.webp',
      cue: 'Carry the lantern light: lift to the crumbling ledge, and leave it before it falls.',
      sec: [90, 120], water: null, overlay: 'dark',
      palette: { top: '#6a6a8a', trim: '#9494b2', side: '#4a4a64', sideD: '#32324a', ink: '#1e1e30', pit: '#14141f' },
      music: { bpm: 92, root: 52, minor: true, intensity: 0.55, leadWave: 'triangle', stabWave: 'triangle' },
      weights: { flat: 24, gap: 14, lift: 20, crumble: 22, spikes: 10, flyer: 10 },
      opener: [['liftY'], ['crumble', 1]],
      closing: [['liftY'], ['crumble', 2], ['gapArc', 240]] },
    { id: 'frostline', num: 10, name: 'Frostline', bg: 'frostline.webp',
      cue: 'The ice will not stop for you. Anticipate the long stopping distance and line up successive jumps.',
      sec: [120, 150], water: null, overlay: 'cold',
      palette: { top: '#bfe6f5', trim: '#e8f6fd', side: '#8fb8cc', sideD: '#5f8298', ink: '#2e4a5c', pit: '#24384a' },
      music: { bpm: 110, root: 62, minor: false, intensity: 0.6, leadWave: 'sine', stabWave: 'triangle' },
      weights: { flat: 22, ice: 26, gap: 20, spikes: 12, enemy: 10, flyer: 10 },
      opener: [['ice'], ['gapArc', 240], ['gapArc', 260]],
      closing: [['ice'], ['gapArc', 280], ['gapArc', 280]] },
    { id: 'moonridge', num: 11, name: 'Moonridge', bg: 'ridge.webp',
      cue: 'Under the moon, read the patrol and choose where to land from the moving platform.',
      sec: [120, 150], water: null, overlay: 'night',
      palette: { top: '#7a7a9a', trim: '#a8a8c4', side: '#565670', sideD: '#3a3a52', ink: '#22223a', pit: '#181828' },
      music: { bpm: 114, root: 57, minor: true, intensity: 0.7, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 20, gap: 16, lift: 20, enemy: 20, flyer: 14, spikes: 10 },
      opener: [['enemy', 520], ['liftX']],
      closing: [['liftX'], ['enemy', 560], ['gapArc', 260]] },
    { id: 'dawnbridge', num: 12, name: 'Dawnbridge', bg: 'dawnbridge.webp',
      cue: 'The bridge is broken into spans. From each safe approach, name the next two landings.',
      sec: [120, 150], water: '#4a6a8a', overlay: null,
      palette: { top: '#d8cfa8', trim: '#f0e8c8', side: '#b0a480', sideD: '#7a7050', ink: '#443c28', pit: '#33506a' },
      music: { bpm: 120, root: 60, minor: false, intensity: 0.75, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 20, broken: 34, gap: 16, enemy: 14, lift: 8, spikes: 8 },
      opener: [['broken', 4]],
      closing: [['broken', 5], ['gapArc', 260]] },
    { id: 'beacon-summit', num: 13, name: 'Beacon Summit', bg: 'beacon-summit.webp',
      cue: 'The last climb. Springs, lifts and timed jumps — light the beacon and the flock can find its way home.',
      sec: [120, 150], water: null, overlay: 'dawn',
      palette: { top: '#eef4f8', trim: '#ffffff', side: '#b8c8d8', sideD: '#8298ac', ink: '#3c5064', pit: '#2c3e4e' },
      music: { bpm: 128, root: 60, minor: false, intensity: 0.9, leadWave: 'square', stabWave: 'sawtooth' },
      weights: { flat: 16, gap: 16, spring: 18, lift: 20, crumble: 12, enemy: 10, spikes: 8 },
      opener: [['spring', true], ['liftX']],
      closing: [['spring', false], ['liftX'], ['gapArc', 280], ['beacon']] }
  ];

  // ── the generator ────────────────────────────────────────────────────
  // Everything a piece may place goes through `api`, which also tracks the
  // current x so pieces chain without overlapping.
  function generate(chapterIndex, circuit, seed) {
    var ch = CHAPTERS[chapterIndex];
    var rng = rngMake((seed >>> 0) ^ Math.imul(circuit + 1, 7919) ^ Math.imul(chapterIndex + 1, 104729));
    var d = Math.min(1, chapterIndex / 12 + (circuit - 1) * 0.12);   // difficulty 0..1
    var platforms = [], objects = [];
    var api = {
      x: 0, ch: ch,
      ground: function (x0, x1, y, type) {
        platforms.push({ type: type || 'ground', x0: x0, x1: x1, y: y || 0, alive: true, standT: 0 });
      },
      egg: function (x, y, golden) { objects.push({ type: 'egg', x: x, y: y, golden: !!golden, taken: false }); },
      eggsRow: function (x0, n, y) {
        for (var i = 0; i < n; i++) api.egg(x0 + i * T.EGG_SPACING, y === undefined ? 46 : y, false);
      },
      eggArc: function (x0, x1, h) {           // a trail of eggs over a pit
        var n = Math.max(3, Math.round((x1 - x0) / T.EGG_SPACING));
        for (var i = 0; i <= n; i++) {
          var p = i / n, xx = x0 + (x1 - x0) * p;
          api.egg(xx, 60 + Math.sin(p * Math.PI) * (h || 190), false);
        }
      },
      spikes: function (x, w, y) { objects.push({ type: 'spikes', x: x, w: w, y: y || 0 }); },
      enemy: function (x0, x1, y) {
        objects.push({ type: 'enemy', kind: 'crawl', x0: x0, x1: x1, y: y || 0,
          speed: T.ENEMY_SPEED * (1 + d * 0.7), x: (x0 + x1) / 2, dir: rng.next() < 0.5 ? -1 : 1, alive: true });
      },
      flyer: function (cx, w, y) {
        objects.push({ type: 'enemy', kind: 'fly', cx: cx, cy: y || T.FLYER_Y, rx: w / 2 || T.FLYER_RX,
          ry: T.FLYER_RY, speed: T.FLYER_SPEED * (1 + d * 0.5), phase: rng.next() * 6.283, alive: true });
      },
      spring: function (x, y) { objects.push({ type: 'spring', x: x, y: y || 0 }); },
      pickup: function (kind, x, y) { objects.push({ type: 'pickup', kind: kind, x: x, y: y || 52, taken: false }); },
      checkpoint: function (x, y) { objects.push({ type: 'checkpoint', x: x, y: y || 0, passed: false }); },
      liftX: function (x0, x1, y, w) {
        platforms.push({ type: 'lift', axis: 'x', x0: x0, x1: x1, y: y || 10, w: w || 170,
          from: x0, to: x1 - (w || 170), period: (x1 - x0) / 0.09, phase: rng.next() * 6.283, alive: true, standT: 0 });
      },
      liftY: function (x, y0, y1, w) {
        platforms.push({ type: 'lift', axis: 'y', x0: x, x1: x + (w || 170), y: y0,
          from: y0, to: y1, period: (y1 - y0) / 0.00045 / 1000 * 1000, phase: rng.next() * 6.283, alive: true, standT: 0 });
      },
      crumble: function (x0, x1, y) { platforms.push({ type: 'crumble', x0: x0, x1: x1, y: y || 0, alive: true, standT: 0 }); },
      beacon: function (x, y) { objects.push({ type: 'beacon', x: x, y: y || 0, lit: false }); }
    };

    var goldenPlaced = 0;
    function golden(x, y) { api.egg(x, y, true); goldenPlaced++; }

    // ── pieces; each leaves safe landing ground after itself ───────────
    var PIECES = {
      flat: function () {
        var w = rng.between(340, 720);
        api.ground(api.x, api.x + w);
        if (rng.next() < 0.55) api.eggsRow(api.x + 90 + rng.next() * 60, rng.int(3, 5));
        api.x += w;
      },
      gap: function (w) {
        var pit = w || rng.between(170, T.MAX_GAP);
        api.x += pit;
        var land = rng.between(300, 460);
        api.ground(api.x, api.x + land);
        if (rng.next() < 0.6) api.eggArc(api.x - pit + 20, api.x - 20, 170);
        api.x += land;
      },
      gapArc: function (w) { PIECES.gap(w || 260); },
      stairs: function () {
        var n = rng.int(2, 3 + Math.round(d)), w = rng.between(150, 210);
        var rise = Math.min(rng.between(90, 115), 380 / n);   // cap the top so it stays in view
        var span = n * (w + 30) + 320;
        api.ground(api.x, api.x + span);                       // safe ground under the whole staircase
        for (var i = 0; i < n; i++) api.ground(api.x + 30 + i * (w + 30), api.x + 30 + i * (w + 30) + w, (i + 1) * rise, 'ledge');
        golden(api.x + 30 + (n - 1) * (w + 30) + w / 2, n * rise + 70);
        api.x += span;
      },
      ledges: function (n, overWater) {
        var w = rng.between(170, 230), pit = rng.between(130, 190);
        for (var i = 0; i < (n || 3); i++) {
          api.ground(api.x, api.x + w, rng.between(30, 60) * (i % 2 ? -1 : 1) + 35, 'ledge');
          api.x += w + pit;
        }
        var land = 320; api.ground(api.x, api.x + land); api.x += land;
      },
      spikes: function (w) {
        var pre = 250, sw = w || rng.between(110, 190), land = 340;
        api.ground(api.x, api.x + pre + sw + land);
        api.spikes(api.x + pre + sw / 2, sw);
        api.x += pre + sw + land;
      },
      gapSpikes: function () {                     // the Ember Canyon chain
        PIECES.gap(240);
        var pre = 200, sw = rng.between(130, 190), land = 400;
        api.ground(api.x, api.x + pre + sw + land);
        api.spikes(api.x + pre + sw / 2, sw);
        api.x += pre + sw + land;
      },
      enemy: function (w) {
        var ww = w || rng.between(520, 780);
        api.ground(api.x, api.x + ww);
        api.enemy(api.x + 140, api.x + ww - 200);
        api.x += ww;
      },
      eggRow: function (n) { api.eggsRow(api.x + 100, n || 4); },
      spring: function (hasGolden) {
        api.ground(api.x, api.x + 320);
        api.spring(api.x + 130);
        var hx = api.x + 470, hw = 240, hy = 310;
        api.ground(api.x + 330, api.x + 330 + 40, 0);   // small step into the pit
        api.ground(hx, hx + hw, hy, 'ledge');
        if (hasGolden !== false) golden(hx + hw / 2, hy + 64);
        else api.eggsRow(hx + 40, 3, hy + 50);
        api.x = hx + hw + 190;                        // drop from the ledge
        var land = 360; api.ground(api.x, api.x + land); api.x += land;
      },
      crumble: function (n) {
        var count = n || rng.int(1, 2);
        api.x += 30;
        for (var i = 0; i < count; i++) {
          var w = rng.between(150, 200);
          api.crumble(api.x, api.x + w);
          api.x += w + rng.between(50, 90);
        }
        var land = 360; api.ground(api.x, api.x + land); api.x += land;
      },
      liftX: function () {
        var pit = rng.between(320, 440);
        api.liftX(api.x + 20, api.x + pit - 20, 10, 240);
        api.x += pit;
        var land = 360; api.ground(api.x, api.x + land); api.x += land;
        if (rng.next() < 0.5) api.eggArc(api.x - pit + 30, api.x - 30, 150);
      },
      liftY: function () {
        var pit = rng.between(360, 440);
        api.liftY(api.x + pit / 2 - 85, -150, 130, 170);
        api.ground(api.x + pit, api.x + pit + 280, 150, 'ledge');
        api.x += pit + 280 + 170;                     // drop back to ground
        var land = 340; api.ground(api.x, api.x + land); api.x += land;
      },
      ice: function () {
        var w = rng.between(380, 560);
        api.ground(api.x, api.x + w, 0, 'ice');
        api.x += w;
      },
      flyer: function (w) {
        var ww = w || rng.between(560, 800);
        api.ground(api.x, api.x + ww);
        api.flyer(api.x + ww / 2, Math.max(120, ww / 2 - 60), rng.between(150, 230));
        if (rng.next() < 0.5) api.eggsRow(api.x + 80, 3);
        api.x += ww;
      },
      broken: function (n) {
        // spans pitched about one jump apart, so each hop lands on the next
        var count = n || rng.int(3, 4 + Math.round(d * 2));
        for (var i = 0; i < count; i++) {
          var w = rng.between(150, 190);
          api.ground(api.x, api.x + w, rng.between(20, 70), 'crumble');   // broken spans crumble
          api.x += w + rng.between(190, 260);
        }
        var land = 340; api.ground(api.x, api.x + land); api.x += land;
      },
      pickup: function () {
        var w = rng.between(300, 460);
        api.ground(api.x, api.x + w);
        api.pickup(rng.next() < 0.5 ? 'shield' : 'magnet', api.x + w / 2);
        api.x += w;
      },
      goldenGround: function () {
        var w = 620;
        api.ground(api.x, api.x + w);
        golden(api.x + w * 0.62, 48);
        api.x += w;
      },
      checkpoint: function () {
        var w = 300;
        api.ground(api.x, api.x + w);
        api.checkpoint(api.x + w / 2);
        api.x += w;
      },
      beacon: function () {
        var w = 420;
        api.ground(api.x, api.x + w);
        api.beacon(api.x + w * 0.7);
        api.x += w;
      }
    };

    // Hard pieces get a checkpoint flag on safe ground before them.
    var HARD = { enemy: 1, liftX: 1, liftY: 1, broken: 1, crumble: 1, gapSpikes: 1, flyer: 1, spikes: 1, spring: 1 };

    function runSeq(seq) {
      for (var i = 0; i < seq.length; i++) {
        var step = seq[i];
        var name = step[0], args = step.slice(1);
        if (HARD[name] && api.x > T.START_X + 200) PIECES.checkpoint();
        PIECES[name].apply(null, args);
      }
    }

    // ── build the chapter ───────────────────────────────────────────────
    var target = (ch.sec[0] + ch.sec[1]) / 2 * T.CRUISE;
    api.ground(0, T.INTRO_FLAT);
    api.checkpoint(T.START_X);
    api.x = T.INTRO_FLAT;
    runSeq(ch.opener);

    var lastPiece = '', sinceCp = 0, nextCpMs = rng.between(T.CHECKPOINT_EVERY_MS[0], T.CHECKPOINT_EVERY_MS[1]);
    var closingLen = 1500;
    while (api.x < target - closingLen) {
      // weighted pick, no immediate repeats
      var keys = Object.keys(ch.weights), total = 0, k;
      for (k = 0; k < keys.length; k++) total += ch.weights[keys[k]];
      var r = rng.next() * total, pick = keys[0];
      for (k = 0; k < keys.length; k++) { r -= ch.weights[keys[k]]; if (r <= 0) { pick = keys[k]; break; } }
      if (pick === lastPiece) pick = keys[Math.floor(rng.next() * keys.length)];
      if (pick === 'lift') pick = rng.next() < 0.5 ? 'liftX' : 'liftY';
      lastPiece = pick;
      var before = api.x;
      // a flag on safe ground before every demanding sequence, and at least
      // every quiet stretch (LEVEL-2)
      if (api.x > T.START_X + 400 && (HARD[pick] || sinceCp > nextCpMs)) {
        PIECES.checkpoint();
        sinceCp = 0;
        nextCpMs = rng.between(T.CHECKPOINT_EVERY_MS[0], T.CHECKPOINT_EVERY_MS[1]);
      }
      PIECES[pick]();
      sinceCp += (api.x - before) / T.CRUISE * 1000;
    }
    runSeq(ch.closing);

    // guarantee at least two golden eggs per chapter
    while (goldenPlaced < 2) golden(api.x - 600 - goldenPlaced * 200, 50);

    var L = api.x + 260;
    api.ground(api.x, L + 200);
    return { ch: ch, chapterIndex: chapterIndex, circuit: circuit, seed: seed >>> 0,
             L: L, platforms: platforms, objects: objects };
  }

  var api = { CHAPTERS: CHAPTERS, generate: generate, rngMake: rngMake };
  root.EM = root.EM || {};
  root.EM.levels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
