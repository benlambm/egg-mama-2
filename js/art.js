/*
 * Egg Mama — the pictures.
 *
 * Every picture is drawn here with canvas shapes; there are no image files
 * for the game objects (only the thirteen painted backdrops in assets/bg).
 * The look follows Egg Runner 2: one warm light from the UPPER LEFT, so every
 * thing is lightest at its upper left, its true colour in the middle, darker
 * and a little cooler at its lower right, with a thin strip of light bounced
 * up from the ground just inside that lower-right edge. Outlines are a dark
 * shade of the thing's own colour; the shared ink is kept for faces.
 *
 * Drawn in game units with (0, 0) at the point where the thing touches the
 * ground, x to the right and y DOWN (up is negative y).
 *
 * Things that never change shape are painted once into a small off-screen
 * canvas and stamped at whatever size the screen calls for (with half, quarter
 * and eighth copies so far things stay smooth). Mama, the ducklings and the
 * flying enemy move every frame, so they have draw functions instead.
 *
 * Contact shadows are NOT drawn here; render.js draws them so they can follow
 * each thing and sit on the ground beneath it.
 */
(function (root) {
  'use strict';

  var INK = '#3a2618';
  var TAU = Math.PI * 2, PI = Math.PI;

  // ── drawing helpers ──────────────────────────────────────────────────
  function rr(c, x, y, w, h, r) { c.beginPath(); rrMore(c, x, y, w, h, r); }
  function rrMore(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function poly(c, pts) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
  }
  function oval(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function paint(c, fill, stroke, lw) {
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke !== null) { c.strokeStyle = stroke || INK; c.lineWidth = lw || 3; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  }
  function gradAt(c, x0, y0, x1, y1, st) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < st.length; i += 2) g.addColorStop(st[i], st[i + 1]);
    return g;
  }
  function ball(c, x, y, r, p) {
    var g = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.06, x, y, r * 1.08);
    g.addColorStop(0, p.l); g.addColorStop(0.45, p.m); g.addColorStop(0.88, p.d); g.addColorStop(1, p.d);
    return g;
  }
  function rimLight(c, path, x0, y0, x1, y1, col, w) {
    c.save(); path(); c.clip(); path();
    c.strokeStyle = gradAt(c, x0, y0, x1, y1, [0, rgba(col, 0), 0.5, rgba(col, 0), 1, rgba(col, 0.9)]);
    c.lineWidth = w || 8; c.lineJoin = 'round'; c.stroke();
    c.restore();
  }
  function gleam(c, x, y, rx, ry, rot, a) { oval(c, x, y, rx, ry, rot); paint(c, 'rgba(255,255,255,' + (a === undefined ? 0.85 : a) + ')', null); }
  function star(c, x, y, r, points) {
    c.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var a = -PI / 2 + i * PI / points, rad = i % 2 ? r * 0.45 : r;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath();
  }
  // An egg outline: rounder at the bottom, narrower at the top.
  function eggPath(c, cx, cy, rx, ry) {
    c.beginPath();
    c.moveTo(cx, cy - ry);
    c.bezierCurveTo(cx + rx * 0.74, cy - ry, cx + rx, cy - ry * 0.08, cx + rx, cy + ry * 0.28);
    c.bezierCurveTo(cx + rx, cy + ry * 0.74, cx + rx * 0.56, cy + ry, cx, cy + ry);
    c.bezierCurveTo(cx - rx * 0.56, cy + ry, cx - rx, cy + ry * 0.74, cx - rx, cy + ry * 0.28);
    c.bezierCurveTo(cx - rx, cy - ry * 0.08, cx - rx * 0.74, cy - ry, cx, cy - ry);
    c.closePath();
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function line(c, pts, color, w) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    paint(c, null, color, w);
  }

  // Colour families: l = lit, m = true colour, d = shade, b = bounced light, k = outline.
  var SHELL = { l: '#ffffff', m: '#fef9ef', d: '#d8cbe8', b: '#fff3df', k: '#6b4a7a' };
  var GOLD  = { l: '#fffbd6', m: '#ffd43b', d: '#e88a00', b: '#ffe894', k: '#8a4a00' };
  var YOLK  = { l: '#fff0a8', m: '#ffcf3a', d: '#e09a10', b: '#ffe894', k: '#9a6206' };
  var RED   = { l: '#ff9a8c', m: '#e5484d', d: '#a3223f', b: '#ee7f8e', k: '#741531' };
  var BLUE  = { l: '#8cc0ff', m: '#2f7ff0', d: '#2450b5', b: '#6fa5f5', k: '#1a3a85' };
  var GREEN = { l: '#aee486', m: '#59b34a', d: '#2b8250', b: '#8fd486', k: '#1d5a37' };
  var PURPLE= { l: '#bca2f4', m: '#8253d8', d: '#5730a5', b: '#a384ea', k: '#3b2073' };
  var ORANGE= { l: '#ffc592', m: '#f47c3c', d: '#c2452a', b: '#ffa873', k: '#8a2a16' };
  var CREAM = { l: '#fffaf0', m: '#f5e6c8', d: '#cfb3a6', b: '#f7e6cf', k: '#8a5f38' };
  var WOOD  = { l: '#f0c58a', m: '#cc9257', d: '#9a5c3a', b: '#dba873', k: '#6b3a1e' };
  var STEEL = { l: '#f6fbff', m: '#b7c6dc', d: '#7f90b3', b: '#dbe6f2', k: '#3c4868' };
  var DARK  = { l: '#8a90b8', m: '#4f5480', d: '#2f3156', b: '#6d73a0', k: '#1f2038' };

  // A shaded egg shell (used for eggs, the golden egg and Mama's body).
  function shell(c, cy, rx, ry, p, lw) {
    var path = function () { eggPath(c, 0, cy, rx, ry); };
    var g = c.createRadialGradient(-rx * 0.4, cy - ry * 0.42, ry * 0.08, 0, cy + ry * 0.08, ry * 1.22);
    g.addColorStop(0, p.l); g.addColorStop(0.42, p.m); g.addColorStop(0.86, p.d); g.addColorStop(1, p.d);
    path(); c.fillStyle = g; c.fill();
    rimLight(c, path, 0, cy - ry * 0.1, rx * 0.8, cy + ry * 0.9, p.b, rx * 0.34);
    path(); paint(c, null, p.k, lw);
    gleam(c, -rx * 0.42, cy - ry * 0.46, rx * 0.19, ry * 0.25, 0.5, 0.95);
  }

  // ── static pictures (stamped from a cache) ───────────────────────────
  // Each entry: w = width, h = height above the floor, d = room below the
  // floor line; (0, 0) is the middle of the thing's front edge on the floor.
  var PICS = {};

  PICS.egg = { w: 52, h: 62, d: 4, draw: function (c) { shell(c, -29, 21, 27, SHELL, 3); } };

  PICS.golden = { w: 96, h: 88, d: 14, draw: function (c) {
    shell(c, -30, 23, 29, GOLD, 3.5);
    c.fillStyle = '#ffffff'; c.strokeStyle = '#f0a000'; c.lineWidth = 1.4; c.lineJoin = 'round';
    star(c, 17, -56, 10, 4); c.fill(); c.stroke();
    star(c, -21, -13, 7, 4); c.fill(); c.stroke();
    star(c, 26, -24, 4.5, 4); c.fill(); c.stroke();
  } };

  PICS.shield = { w: 84, h: 92, d: 6, draw: function (c) {
    var path = function () {
      c.beginPath();
      c.moveTo(0, -84);
      c.bezierCurveTo(26, -78, 34, -66, 34, -52);
      c.bezierCurveTo(34, -26, 18, -8, 0, -2);
      c.bezierCurveTo(-18, -8, -34, -26, -34, -52);
      c.bezierCurveTo(-34, -66, -26, -78, 0, -84);
      c.closePath();
    };
    path(); c.fillStyle = ball(c, 0, -44, 40, BLUE); c.fill();
    rimLight(c, path, 0, -70, 30, -10, BLUE.b, 8);
    path(); paint(c, null, BLUE.k, 3.5);
    // a white cross so it reads as a shield, not a blob
    rr(c, -6, -62, 12, 34, 5); paint(c, 'rgba(255,255,255,0.92)', null);
    rr(c, -19, -49, 38, 12, 5); paint(c, 'rgba(255,255,255,0.92)', null);
    gleam(c, -16, -70, 5, 10, 0.4, 0.8);
  } };

  PICS.magnet = { w: 88, h: 84, d: 6, draw: function (c) {
    var path = function () {
      c.beginPath();
      c.moveTo(-30, -8);
      c.lineTo(-30, -46); c.arc(0, -46, 30, PI, 0);
      c.lineTo(30, -8); c.lineTo(14, -8); c.lineTo(14, -38); c.arc(0, -38, 16, 0, PI, true);
      c.lineTo(-14, -8); c.closePath();
    };
    path(); c.fillStyle = gradAt(c, -30, 0, 30, 0, [0, RED.l, 0.5, RED.m, 1, RED.d]); c.fill();
    path(); paint(c, null, RED.k, 3);
    // the two poles
    rr(c, -33, -14, 22, 12, 4); paint(c, STEEL.m, RED.k, 2.5);
    rr(c, 11, -14, 22, 12, 4); paint(c, STEEL.m, RED.k, 2.5);
    rr(c, -31, -15, 18, 4, 2); paint(c, STEEL.l, null);
    rr(c, 13, -15, 18, 4, 2); paint(c, STEEL.l, null);
  } };

  PICS.spring = { w: 110, h: 66, d: 6, draw: function (c) {
    // wooden base
    rr(c, -46, -14, 92, 16, 6); paint(c, gradAt(c, -46, 0, 46, 0, [0, WOOD.l, 0.5, WOOD.m, 1, WOOD.d]), WOOD.k, 3);
    // the coil
    c.beginPath();
    for (var i = 0; i <= 4; i++) {
      var yy = -16 - i * 8, xx = (i % 2 ? -1 : 1) * 26;
      if (i === 0) c.moveTo(0, yy); else c.lineTo(xx, yy - 4), c.lineTo(-xx, yy - 4);
    }
    paint(c, null, STEEL.k, 7); paint(c, null, STEEL.m, 4);
    // red pad on top
    rr(c, -34, -58, 68, 16, 8); paint(c, gradAt(c, -34, -58, 34, -42, [0, RED.l, 0.5, RED.m, 1, RED.d]), RED.k, 3);
    rr(c, -30, -61, 60, 6, 3); paint(c, 'rgba(255,255,255,0.55)', null);
  } };

  PICS.flag = { w: 76, h: 190, d: 6, draw: function (c) {
    // pole
    rr(c, -4, -184, 8, 184, 4); paint(c, gradAt(c, -4, 0, 4, 0, [0, WOOD.l, 0.5, WOOD.m, 1, WOOD.d]), WOOD.k, 2.5);
    oval(c, 0, -186, 7, 7); paint(c, ball(c, 0, -186, 7, GOLD), GOLD.k, 2.5);
    // waving pennant
    var cloth = function () {
      c.beginPath();
      c.moveTo(4, -182);
      c.bezierCurveTo(30, -186, 44, -172, 66, -176);
      c.bezierCurveTo(46, -164, 32, -158, 4, -162);
      c.closePath();
    };
    cloth(); c.fillStyle = gradAt(c, 4, -182, 66, -158, [0, RED.l, 0.5, RED.m, 1, RED.d]); c.fill();
    cloth(); paint(c, null, RED.k, 2.5);
    star(c, 34, -170, 9, 5); paint(c, '#ffffff', RED.k, 1.5);
    // base
    rr(c, -22, -10, 44, 12, 5); paint(c, gradAt(c, -22, 0, 22, 0, [0, DARK.l, 0.5, DARK.m, 1, DARK.d]), DARK.k, 2.5);
  } };

  PICS.crawler = { w: 96, h: 62, d: 6, draw: function (c) {
    // legs
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-22, -10); c.lineTo(-28, -2); c.moveTo(-8, -8); c.lineTo(-10, -1);
    c.moveTo(8, -8); c.lineTo(10, -1); c.moveTo(22, -10); c.lineTo(28, -2);
    paint(c, null, PURPLE.k, 7);
    // spiky back
    var body = function () {
      c.beginPath();
      c.moveTo(-40, -8);
      c.bezierCurveTo(-44, -34, -26, -52, 0, -52);
      c.bezierCurveTo(26, -52, 44, -34, 40, -8);
      c.closePath();
    };
    body(); c.fillStyle = ball(c, 0, -30, 42, PURPLE); c.fill();
    body(); paint(c, null, PURPLE.k, 3);
    // spikes along the top
    for (var i = -2; i <= 2; i++) {
      var x = i * 15, y = -50 + Math.abs(i) * -4;
      poly(c, [x - 7, y + 6, x, y - 12, x + 7, y + 6]);
      paint(c, DARK.m, PURPLE.k, 2);
    }
    // angry eyes (it faces right, the way it patrols)
    oval(c, 12, -34, 6.5, 7.5); paint(c, '#ffffff', PURPLE.k, 2);
    oval(c, 26, -32, 5.5, 6.5); paint(c, '#ffffff', PURPLE.k, 2);
    c.fillStyle = INK; oval(c, 14, -33, 3, 3.6); c.fill(); oval(c, 28, -31, 2.6, 3.2); c.fill();
    line(c, [8, -44, 18, -40, 30, -43], INK, 3);   // brows
    // fangs
    poly(c, [16, -18, 20, -10, 24, -18]); paint(c, '#ffffff', PURPLE.k, 1.5);
    poly(c, [26, -18, 30, -11, 33, -18]); paint(c, '#ffffff', PURPLE.k, 1.5);
  } };

  // ── things drawn fresh every frame ───────────────────────────────────
  // Mama: a big warm-white egg with a face, a hair tuft and a rosy cheek.
  // She stays upright — no rolling. o: {t, vy, invuln, mood, squash}
  function drawMama(c, o) {
    var RX = 40, RY = 47, CY = -46;
    c.save();
    if (o.squash) c.scale(1 + o.squash * 0.18, 1 - o.squash * 0.16);
    var blink = o.invuln > 0 ? (Math.sin(o.t * 0.03) > 0) : (Math.sin(o.t * 0.0016) > 0.985);
    var path = function () { eggPath(c, 0, CY, RX, RY); };
    var g = c.createRadialGradient(-RX * 0.4, CY - RY * 0.42, RY * 0.08, 0, CY + RY * 0.08, RY * 1.22);
    g.addColorStop(0, SHELL.l); g.addColorStop(0.42, SHELL.m); g.addColorStop(0.86, SHELL.d); g.addColorStop(1, SHELL.d);
    path(); c.fillStyle = g; c.fill();
    rimLight(c, path, 0, CY - RY * 0.1, RX * 0.8, CY + RY * 0.9, SHELL.b, RX * 0.34);
    path(); paint(c, null, SHELL.k, 3.5);
    gleam(c, -RX * 0.42, CY - RY * 0.46, RX * 0.2, RY * 0.26, 0.5, 0.95);
    // hair tuft
    c.beginPath(); c.moveTo(-8, CY - RY + 2);
    c.quadraticCurveTo(-14, CY - RY - 16, -4, CY - RY - 18);
    c.quadraticCurveTo(-2, CY - RY - 8, 4, CY - RY - 18);
    c.quadraticCurveTo(12, CY - RY - 14, 10, CY - RY + 2);
    c.closePath();
    paint(c, gradAt(c, -8, CY - RY - 18, 10, CY - RY + 2, [0, '#ff9ec2', 0.5, '#f06a9a', 1, '#c23a72']), '#a82e68', 2.5);
    // face (looking ahead, the way she travels)
    var ex = 8, ey = CY - 14;
    if (blink) {
      line(c, [ex - 7, ey, ex + 1, ey], INK, 3);
      line(c, [ex + 12, ey, ex + 20, ey], INK, 3);
    } else {
      c.fillStyle = INK;
      oval(c, ex - 2, ey, 4.6, 5.6); c.fill();
      oval(c, ex + 16, ey, 4.6, 5.6); c.fill();
      c.fillStyle = '#ffffff';
      oval(c, ex - 3.4, ey - 1.6, 1.6, 1.6); c.fill();
      oval(c, ex + 14.6, ey - 1.6, 1.6, 1.6); c.fill();
    }
    // rosy cheeks and a smile
    c.fillStyle = 'rgba(255,120,130,0.45)';
    oval(c, ex - 10, ey + 10, 5, 3.4); c.fill();
    oval(c, ex + 22, ey + 10, 5, 3.4); c.fill();
    var smile = o.mood === 'worried' ? [ex + 6, ey + 22, ex + 14, ey + 18] : [ex + 4, ey + 18, ex + 14, ey + 22];
    c.beginPath(); c.arc(ex + 9, ey + 16, 7, 0.15 * PI, 0.85 * PI); paint(c, null, INK, 3);
    c.restore();
  }

  // A duckling: small yellow chick with an orange beak and feet.
  // o: {t, hop (0..1 bounce phase), dir}
  function drawDuckling(c, o) {
    var bob = Math.abs(Math.sin(o.t * 0.012 + o.hop * 6.28)) * 6;
    c.save(); c.translate(0, -bob);
    rr(c, -9, -5, 8, 5.5, 2.5); paint(c, ORANGE.m, '#a8500a', 1.8);
    rr(c, 2, -5, 8, 5.5, 2.5); paint(c, ORANGE.m, '#a8500a', 1.8);
    var body = function () { oval(c, 0, -17, 15, 16); };
    body(); c.fillStyle = ball(c, 0, -17, 16, YOLK); c.fill();
    rimLight(c, body, 0, -22, 13, -6, YOLK.b, 6);
    body(); paint(c, null, YOLK.k, 2.5);
    // head bump, beak, eye
    oval(c, 6, -30, 9, 8.5); paint(c, ball(c, 6, -30, 9, YOLK), YOLK.k, 2.2);
    poly(c, [13, -31, 21, -28.5, 13, -26]); paint(c, ORANGE.m, '#a8500a', 1.5);
    c.fillStyle = INK; oval(c, 7, -32, 2.2, 2.6); c.fill();
    c.fillStyle = '#ffffff'; oval(c, 6.4, -32.8, 0.8, 0.8); c.fill();
    // little wing
    oval(c, -6, -16, 6, 4, -0.5); paint(c, rgba(YOLK.d, 0.8), YOLK.k, 1.5);
    gleam(c, -5, -24, 3, 4.5, 0.4, 0.8);
    c.restore();
  }

  // The flying enemy: a little moth/bat with flapping wings.
  function drawFlyer(c, o) {
    var flap = Math.sin(o.t * 0.02) * 0.7;
    c.save();
    // wings behind
    c.save(); c.rotate(-0.5 - flap * 0.5);
    oval(c, -16, -8, 16, 8, -0.6); paint(c, gradAt(c, -30, -14, -4, -2, [0, PURPLE.l, 1, PURPLE.d]), PURPLE.k, 2.5);
    c.restore();
    c.save(); c.rotate(0.5 + flap * 0.5);
    oval(c, 16, -8, 16, 8, 0.6); paint(c, gradAt(c, 4, -14, 30, -2, [0, PURPLE.l, 1, PURPLE.d]), PURPLE.k, 2.5);
    c.restore();
    var body = function () { oval(c, 0, 0, 17, 13); };
    body(); c.fillStyle = ball(c, 0, 0, 17, DARK); c.fill();
    body(); paint(c, null, DARK.k, 2.5);
    oval(c, -6, -4, 4, 5); paint(c, '#ff5a5a', DARK.k, 1.5);
    oval(c, 6, -4, 4, 5); paint(c, '#ff5a5a', DARK.k, 1.5);
    c.restore();
  }

  // The diver: a red moth that cruises high and tucks its wings to swoop.
  function drawDiver(c, o) {
    var diving = !!o.diving;
    var flap = diving ? 0.08 : Math.sin(o.t * 0.02) * 0.7;
    c.save();
    if (diving) c.rotate(0.65);   // nose down
    c.save(); c.rotate(-0.5 - flap * 0.5);
    oval(c, -16, -8, 16, 8, -0.6); paint(c, gradAt(c, -30, -14, -4, -2, [0, RED.l, 1, RED.d]), RED.k, 2.5);
    c.restore();
    c.save(); c.rotate(0.5 + flap * 0.5);
    oval(c, 16, -8, 16, 8, 0.6); paint(c, gradAt(c, 4, -14, 30, -2, [0, RED.l, 1, RED.d]), RED.k, 2.5);
    c.restore();
    var body = function () { oval(c, 0, 0, 17, 13); };
    body(); c.fillStyle = ball(c, 0, 0, 17, RED); c.fill();
    body(); paint(c, null, RED.k, 2.5);
    oval(c, -6, -4, 4, 5); paint(c, '#ffffff', RED.k, 1.5);
    oval(c, 6, -4, 4, 5); paint(c, '#ffffff', RED.k, 1.5);
    c.fillStyle = INK; oval(c, -5, -3, 2, 2.4); c.fill(); oval(c, 7, -3, 2, 2.4); c.fill();
    line(c, [-11, -10, -2, -7, 11, -10], INK, 2.4);   // angry brows
    c.restore();
  }

  // The hopper: a green frog-thing that springs at Mama from the ground.
  // o: {t, air (height above its floor, world units)}
  function drawHopper(c, o) {
    var air = o.air || 0;
    c.save();
    c.lineCap = 'round';
    c.beginPath();
    if (air > 4) { c.moveTo(-12, -8); c.lineTo(-19, -3); c.moveTo(12, -8); c.lineTo(19, -3); }
    else { c.moveTo(-16, -12); c.lineTo(-25, -2); c.moveTo(16, -12); c.lineTo(25, -2); }
    paint(c, null, GREEN.k, 7);
    var body = function () {
      c.beginPath();
      c.moveTo(-30, -6);
      c.bezierCurveTo(-34, -30, -18, -44, 0, -44);
      c.bezierCurveTo(18, -44, 34, -30, 30, -6);
      c.closePath();
    };
    body(); c.fillStyle = ball(c, 0, -24, 34, GREEN); c.fill();
    body(); paint(c, null, GREEN.k, 3);
    // eyes ride on top
    oval(c, -10, -46, 6, 7); paint(c, '#ffffff', GREEN.k, 2);
    oval(c, 8, -46, 6, 7); paint(c, '#ffffff', GREEN.k, 2);
    c.fillStyle = INK; oval(c, -8, -45, 2.8, 3.4); c.fill(); oval(c, 10, -45, 2.8, 3.4); c.fill();
    line(c, [-17, -55, -6, -52, 2, -55, 15, -52], INK, 2.6);
    gleam(c, -14, -36, 4, 6, 0.5, 0.8);
    c.restore();
  }

  // The beacon: a stone pillar with a brazier; lit draws a flame and glow.
  function drawBeacon(c, o) {
    var lit = !!o.lit, t = o.t || 0;
    // pillar
    rr(c, -26, -150, 52, 150, 8);
    paint(c, gradAt(c, -26, 0, 26, 0, [0, '#e8e2f2', 0.4, '#b8b2cc', 0.8, '#8a84a8', 1, '#a8a2c2']), '#4a4664', 3);
    rr(c, -34, -162, 68, 18, 7); paint(c, gradAt(c, -34, -162, 34, -144, [0, '#f2eefc', 0.6, '#c2bcd8', 1, '#948eb4']), '#4a4664', 3);
    // brazier bowl
    var bowl = function () {
      c.beginPath(); c.moveTo(-24, -162); c.lineTo(24, -162); c.lineTo(16, -138); c.lineTo(-16, -138); c.closePath();
    };
    bowl(); paint(c, gradAt(c, -24, 0, 24, 0, [0, DARK.l, 0.5, DARK.m, 1, DARK.d]), DARK.k, 3);
    if (lit) {
      var fl = 1 + Math.sin(t * 0.02) * 0.12;
      var glow = c.createRadialGradient(0, -186, 6, 0, -186, 90 * fl);
      glow.addColorStop(0, 'rgba(255,220,110,0.85)'); glow.addColorStop(0.5, 'rgba(255,180,60,0.3)'); glow.addColorStop(1, 'rgba(255,160,40,0)');
      oval(c, 0, -186, 90 * fl, 90 * fl); paint(c, glow, null);
      // flame
      var flame = function (s) {
        c.beginPath();
        c.moveTo(-10 * s, -164);
        c.bezierCurveTo(-14 * s, -186 * s, -4 * s, -196 * s, 0, -208 * s * fl);
        c.bezierCurveTo(4 * s, -196 * s, 14 * s, -186 * s, 10 * s, -164);
        c.closePath();
      };
      flame(1); paint(c, gradAt(c, 0, -208, 0, -164, [0, '#fff6c8', 0.5, '#ffc23e', 1, '#f47c3c']), '#c2452a', 2);
      flame(0.45); paint(c, '#fffbe8', null);
    } else {
      oval(c, 0, -158, 16, 6); paint(c, DARK.d, DARK.k, 2);   // cold bowl
    }
  }

  // ── stamping ─────────────────────────────────────────────────────────
  var cache = {}, cacheRes = 0;
  function sprite(name, res) {
    if (res !== cacheRes) { cache = {}; cacheRes = res; }
    var s = cache[name];
    if (s) return s;
    var p = PICS[name], pad = 5;
    var cv = document.createElement('canvas');
    cv.width = Math.ceil((p.w + pad * 2) * res / 8) * 8;
    cv.height = Math.ceil((p.h + p.d + pad * 2) * res / 8) * 8;
    var c = cv.getContext('2d');
    c.scale(res, res);
    c.translate(p.w / 2 + pad, p.h + pad);
    p.draw(c);
    s = cache[name] = { img: cv, ox: p.w / 2 + pad, oy: p.h + pad, w: cv.width / res, h: cv.height / res, res: res, small: [] };
    return s;
  }
  var SMALLEST = 3;
  function smaller(sp, n) {
    var im = sp.small[n - 1];
    if (im) return im;
    var from = n === 1 ? sp.img : smaller(sp, n - 1);
    im = document.createElement('canvas');
    im.width = from.width / 2; im.height = from.height / 2;
    im.getContext('2d').drawImage(from, 0, 0, im.width, im.height);
    sp.small[n - 1] = im;
    return im;
  }
  // Stamp `name` with its floor point at (x, y), `s` pixels per unit.
  function stamp(c, name, x, y, s, res) {
    var sp = sprite(name, res), img = sp.img;
    var m = c.getTransform ? c.getTransform() : null;
    var px = s * (m ? Math.sqrt(m.a * m.a + m.b * m.b) : (root.devicePixelRatio || 1));
    var n = 0;
    while (n < SMALLEST && px * 2 <= res) { px *= 2; n++; }
    if (n) img = smaller(sp, n);
    c.drawImage(img, x - sp.ox * s, y - sp.oy * s, sp.w * s, sp.h * s);
  }

  var api = {
    INK: INK, rr: rr, poly: poly, oval: oval, paint: paint, gradAt: gradAt, ball: ball,
    rimLight: rimLight, gleam: gleam, star: star, eggPath: eggPath, rgba: rgba, shell: shell,
    PICS: PICS, sprite: sprite, stamp: stamp,
    drawMama: drawMama, drawDuckling: drawDuckling, drawFlyer: drawFlyer, drawDiver: drawDiver,
    drawHopper: drawHopper, drawBeacon: drawBeacon,
    line: line,
    PAL: { SHELL: SHELL, GOLD: GOLD, YOLK: YOLK, RED: RED, BLUE: BLUE, GREEN: GREEN, PURPLE: PURPLE, ORANGE: ORANGE, CREAM: CREAM, WOOD: WOOD, STEEL: STEEL, DARK: DARK }
  };
  root.EM = root.EM || {};
  root.EM.art = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
