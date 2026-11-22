/*
 * Egg Mama — drawing a frame.
 *
 * This file only LOOKS at a game; it never changes the rules. Order each
 * frame: painted backdrop, pits and water, platforms, objects, contact
 * shadows, Mama and the duckling trail, then sparkles, pop-up words and the
 * chapter caption on top.
 *
 * Kept fast on phones: very large or very sharp screens are drawn with fewer
 * pixels than they have (MAX_PIXELS / MAX_DETAIL), and static pictures come
 * from the stamped cache in art.js.
 *
 * Light comes from the upper left, so contact shadows fall a little right.
 */
(function (root) {
  'use strict';
  var EM = root.EM, T = EM.TUNING, A = EM.art, V = EM.view;

  var TAU = Math.PI * 2;
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function hash(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }

  function createRenderer(canvas) {
    var c = canvas.getContext('2d');
    var L = null, dpr = 1;
    var camX = 0, snapped = false;
    var shadowBlob = null, glowBlob = null;
    var lastLand = -1e9;
    var particles = [], popups = [];
    var MAX_PARTICLES = 220;

    var reduced = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function reducedMotion() { return !!(reduced && reduced.matches); }

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      var sharp = root.devicePixelRatio || 1;
      L = V.layout(w, h);
      dpr = Math.max(0.5, Math.min(sharp, 2, Math.sqrt(T.MAX_PIXELS / Math.max(1, w * h)), T.MAX_DETAIL / L.sp));
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    }

    function makeBlob(inner, mid) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      var cc = cv.getContext('2d');
      var g = cc.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, inner); g.addColorStop(0.55, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
      cc.fillStyle = g; cc.fillRect(0, 0, 64, 64);
      return cv;
    }

    // ── fx (sparkles, poofs, pop-up words) ─────────────────────────────
    var fx = {
      clear: function () { particles.length = 0; popups.length = 0; },
      egg: function (x, y, golden) {
        spawn(x, y, golden ? 'goldSpark' : 'spark', golden ? 14 : 8);
      },
      hatch: function (x, y) { spawn(x, y, 'poof', 16); spawn(x, y, 'goldSpark', 12); },
      poof: function (x, y) { spawn(x, y, 'poof', 12); },
      land: function (x, y) { lastLand = performance.now(); spawn(x, y - 4, 'dust', 6); },
      popup: function (text, color, size, x, y) { popups.push({ text: text, color: color, size: size || 26, x: x, y: y, ttl: 1100 }); },
      burst: function (x, y, color, n) { spawn(x, y, 'spark', n || 10, color); }
    };
    function spawn(x, y, type, n, color) {
      if (particles.length > MAX_PARTICLES) return;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * TAU, sp = 60 + Math.random() * 220;
        particles.push({ type: type, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
          ttl: 500 + Math.random() * 500, age: 0, color: color || (type === 'goldSpark' ? '#ffd43b' : type === 'poof' ? '#ffffff' : '#fff6c8') });
      }
    }

    // ── platforms ──────────────────────────────────────────────────────
    // The caller has translated to the platform's top-left in screen px and
    // scaled by sp, so everything here is in WORLD units and line widths are
    // world-unit strokes (the scale turns them into pixels).
    function drawPlatform(p) {
      var shakeX = 0;
      if (p.type === 'crumble' && p.standT > T.CRUMBLE_WARN_MS && p.alive) shakeX = reducedMotion() ? 0 : Math.sin(p.standT * 0.09) * 5;
      var pal = fx._pal;
      var x0 = 0, x1 = p.w, y = 0;
      var depth = (p.type === 'ground' || p.type === 'ice') ? 900 : 64;
      var c0 = c;
      var g = c0.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, pal.side); g.addColorStop(0.25, pal.side); g.addColorStop(0.85, pal.sideD); g.addColorStop(1, pal.sideD);
      // body
      c0.save();
      if (shakeX) c0.translate(shakeX, 0);
      c0.beginPath();
      var r = Math.min(14, (x1 - x0) / 2);
      c0.moveTo(x0, y + depth);
      c0.lineTo(x0, y + r);
      c0.quadraticCurveTo(x0, y, x0 + r, y);
      c0.lineTo(x1 - r, y);
      c0.quadraticCurveTo(x1, y, x1, y + r);
      c0.lineTo(x1, y + depth);
      c0.closePath();
      c0.fillStyle = g; c0.fill();
      c0.strokeStyle = pal.ink; c0.lineWidth = Math.max(1.2, 3); c0.lineJoin = 'round'; c0.stroke();
      // lit top strip
      var th = (p.type === 'ground' || p.type === 'ice') ? 18 : 14;
      c0.save();
      c0.beginPath();
      c0.moveTo(x0, y + th);
      c0.lineTo(x0, y + r); c0.quadraticCurveTo(x0, y, x0 + r, y);
      c0.lineTo(x1 - r, y); c0.quadraticCurveTo(x1, y, x1, y + r);
      c0.lineTo(x1, y + th); c0.closePath();
      var gt = c0.createLinearGradient(x0, y, x1, y);
      gt.addColorStop(0, pal.trim); gt.addColorStop(0.5, pal.top); gt.addColorStop(1, pal.top);
      c0.fillStyle = gt; c0.fill();
      c0.strokeStyle = pal.ink; c0.lineWidth = Math.max(1, 2.4); c0.stroke();
      c0.restore();
      // type details
      if (p.type === 'ice') {
        c0.strokeStyle = 'rgba(255,255,255,0.75)'; c0.lineWidth = Math.max(1, 2); c0.lineCap = 'round';
        for (var i = 0; i < 3; i++) {
          var yy = y + 7 + i * 5;
          c0.beginPath();
          c0.moveTo(x0 + 8 + hash(p.x0, i) * 20, yy);
          c0.lineTo(x0 + (x1 - x0) * (0.3 + hash(p.x0 + 1, i) * 0.5), yy + 2);
          c0.stroke();
        }
      } else if (p.type === 'crumble' && p.alive) {
        c0.strokeStyle = 'rgba(40,24,12,0.55)'; c0.lineWidth = Math.max(1, 2); c0.lineCap = 'round';
        var n = Math.max(2, Math.floor((x1 - x0) / 60));
        for (i = 0; i < n; i++) {
          var cx = x0 + (i + 0.5) * (x1 - x0) / n + (hash(p.x0, i) - 0.5) * 14;
          c0.beginPath(); c0.moveTo(cx, y + 3); c0.lineTo(cx + (hash(i, p.x0) - 0.5) * 18, y + th + 6 + hash(i, 3) * 14); c0.stroke();
        }
      } else if (p.type === 'lift') {
        // ropes for a vertical lift, rails for a horizontal one
        c0.strokeStyle = 'rgba(50,32,16,0.7)'; c0.lineWidth = Math.max(1.5, 4);
        if (p.axis === 'y') {
          c0.beginPath(); c0.moveTo(x0 + 12, y + 40); c0.lineTo(x0 + 12, y - 320); c0.moveTo(x1 - 12, y + 40); c0.lineTo(x1 - 12, y - 320); c0.stroke();
        } else {
          c0.beginPath(); c0.moveTo(x0 - 40, y + 26); c0.lineTo(x1 + 40, y + 26); c0.stroke();
        }
      }
      c0.restore();
    }

    // Adjacent ground/ice slabs at the same height merge into one land mass,
    // so piece seams do not draw as fake cracks — only real pits get edges.
    // (Generated left to right; lifts/crumble/ledges pass through untouched.)
    function drawList(level) {
      if (level._drawList) return level._drawList;
      var out = [], i, p, last;
      var seam = T.MAMA_R * 1.4 + 8;      // wider than this and Mama can fall in
      for (i = 0; i < level.platforms.length; i++) {
        p = level.platforms[i];
        last = out[out.length - 1];
        if (last && (last.type === 'ground' || last.type === 'ice') &&
            (p.type === 'ground' || p.type === 'ice') &&
            Math.abs(p.y - last.y) < 1 && p.x0 >= last.x0 && p.x0 - last.x1 <= seam) {
          last.x1 = Math.max(last.x1, p.x1);
          if (p.type === 'ice') last.type = 'ice';
        } else if (p.type === 'ground' || p.type === 'ice') {
          out.push({ type: p.type, x0: p.x0, x1: p.x1, y: p.y, alive: true, standT: 0 });
        } else {
          out.push(p);
        }
      }
      level._drawList = out;
      return out;
    }

    // ── the frame ──────────────────────────────────────────────────────
    // opts: {now, camTarget, snap, caption, reduced, shake, pal}
    var frozenNow = 0;
    function draw(game, now, opts) {
      if (!L) resize();
      opts = opts || {};
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      var S = game.S, level = game.level, ch = level.ch;
      var sp = L.sp;
      // While paused the scene stands perfectly still: all time-based motion
      // reads a frozen clock.
      if (opts.frozen) { if (!frozenNow) frozenNow = now; now = frozenNow; }
      else frozenNow = 0;

      // camera: follow Mama horizontally, keep the horizon steady
      var target = S.x - L.mamaX / sp;
      if (opts.snap || !snapped) { camX = target; snapped = true; }
      else if (!opts.frozen) {
        var k = opts.reduced ? 1 : Math.min(1, 0.12);
        camX += (target - camX) * k;
      }

      // shake (off for reduced motion)
      var shX = 0, shY = 0;
      if (opts.shake > 0 && !opts.reduced) { shX = Math.sin(now * 0.09) * 5 * opts.shake; shY = Math.cos(now * 0.11) * 4 * opts.shake; }
      c.save();
      c.translate(shX, shY);

      EM.backdrops.draw(c, L, camX, ch, now);

      var pal = ch.palette;
      fx._pal = pal;
      var x0w = camX - 260, x1w = camX + L.w / sp + 260;

      // pits: water or darkness between land masses. Any gap wider than the
      // edge-grab margin is one Mama can fall into, so it must read as a pit.
      var plats = drawList(level);
      var seam = T.MAMA_R * 1.4 + 8;
      for (var i = 0; i < plats.length; i++) {
        var p = plats[i];
        if (p.type !== 'ground' && p.type !== 'ice' && p.type !== 'crumble') continue;
        if (p.x1 < x0w || p.x0 > x1w) continue;
        // find the next ground-level platform to the right
        var nx = Infinity;
        for (var j = 0; j < plats.length; j++) {
          var q = plats[j];
          if ((q.type === 'ground' || q.type === 'ice') && q.x0 > p.x1 + 1 && q.x0 < nx) nx = q.x0;
        }
        if (nx === Infinity) continue;
        if (nx - p.x1 < seam) continue;   // narrower than Mama's edge grab: solid-looking seam, not a pit
        var a = V.project(L, camX, p.x1, 0), b = V.project(L, camX, nx, 0);
        if (ch.water) {
          var wy = V.project(L, camX, 0, -58).y;
          var bot = L.h + 40;
          var wg = c.createLinearGradient(0, wy, 0, bot);
          wg.addColorStop(0, A.rgba(ch.water, 0.9)); wg.addColorStop(1, A.rgba('#12283a', 0.95));
          c.fillStyle = wg;
          c.beginPath();
          c.moveTo(a.x, wy);
          for (var wx = a.x; wx <= b.x; wx += 14) c.lineTo(wx, wy + Math.sin(wx * 0.05 + now * 0.003) * 3);
          c.lineTo(b.x, wy); c.lineTo(b.x, bot); c.lineTo(a.x, bot); c.closePath(); c.fill();
        } else {
          var dg = c.createLinearGradient(0, L.groundY, 0, L.h + 40);
          dg.addColorStop(0, A.rgba(pal.pit || '#1c1408', 0.9)); dg.addColorStop(1, '#000000');
          c.fillStyle = dg; c.fillRect(a.x, L.groundY, b.x - a.x, L.h - L.groundY + 40);
        }
      }

      // platforms (far to near is just left to right; all flat here)
      for (i = 0; i < plats.length; i++) {
        p = plats[i];
        if (!p.alive) continue;
        var span = game.span(p);
        if (span.x1 < x0w || span.x0 > x1w) continue;
        var pa = V.project(L, camX, span.x0, span.y);
        c.save();
        c.translate(pa.x, pa.y);
        c.scale(sp, sp);   // draw in world units so the mass ends exactly at span.x1
        drawPlatform({ type: p.type, x0: span.x0, x1: span.x1, w: span.x1 - span.x0, y: 0, standT: p.standT || 0, axis: p.axis });
        c.restore();
      }

      // objects
      var objs = level.objects;
      for (i = 0; i < objs.length; i++) {
        var o = objs[i];
        if (o.x < x0w - 100 || o.x > x1w + 100) continue;
        if (o.type === 'egg' && !o.taken) {
          var bob = opts.reduced ? 0 : Math.sin(now * 0.004 + o.x * 0.05) * 5;
          var pe = V.project(L, camX, o.x, o.y - 28 + bob);
          if (o.golden) {
            var gl = 60 * sp * (1 + Math.sin(now * 0.005 + o.x) * 0.08);
            if (!glowBlob) glowBlob = makeBlob('rgba(255,224,90,0.9)', 'rgba(255,200,60,0.35)');
            c.drawImage(glowBlob, pe.x - gl, pe.y - gl * 0.9, gl * 2, gl * 1.8);
            A.stamp(c, 'golden', pe.x, pe.y, sp, 2.5);
          } else {
            A.stamp(c, 'egg', pe.x, pe.y, sp, 2.5);
          }
        } else if (o.type === 'pickup' && !o.taken) {
          var bob2 = opts.reduced ? 0 : Math.sin(now * 0.004 + o.x) * 6;
          var pp = V.project(L, camX, o.x, o.y - 40 + bob2);
          A.stamp(c, o.kind, pp.x, pp.y, sp, 2.5);
        } else if (o.type === 'spring') {
          var ps = V.project(L, camX, o.x, o.y);
          A.stamp(c, 'spring', ps.x, ps.y, sp, 2.5);
        } else if (o.type === 'spikes') {
          var s1 = V.project(L, camX, o.x - o.w / 2, o.y);
          var s2 = V.project(L, camX, o.x + o.w / 2, o.y);
          var n = Math.max(2, Math.round((s2.x - s1.x) / (26 * sp)));
          var sg = c.createLinearGradient(0, s1.y - T.SPIKE_H * sp, 0, s1.y);
          sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.5, '#b7c6dc'); sg.addColorStop(1, '#7f90b3');
          c.beginPath();
          for (var si = 0; si < n; si++) {
            var bx = s1.x + (si + 0.5) * (s2.x - s1.x) / n;
            var hw = (s2.x - s1.x) / n / 2 - 1;
            c.moveTo(bx - hw, s1.y); c.lineTo(bx, s1.y - T.SPIKE_H * sp); c.lineTo(bx + hw, s1.y);
          }
          c.closePath();
          c.fillStyle = sg; c.fill();
          c.strokeStyle = '#3c4868'; c.lineWidth = Math.max(1, 2.4 * sp); c.lineJoin = 'round'; c.stroke();
          c.fillStyle = '#2f3156'; c.fillRect(s1.x - 2, s1.y - 4, s2.x - s1.x + 4, 5);
        } else if (o.type === 'enemy' && o.alive) {
          var ep = game.enemyPos(o);
          var shadowY = groundAt(game, ep.x, ep.y);
          var shd = V.project(L, camX, ep.x, shadowY);
          drawShadow(shd.x, shd.y, (o.kind === 'fly' ? 40 : 46) * sp, 10 * sp, ep.y - shadowY);
          var eo = V.project(L, camX, ep.x, ep.y);
          if (o.kind === 'fly') {
            c.save(); c.translate(eo.x, eo.y - T.FLYER_H * sp / 2); A.drawFlyer(c, { t: now }); c.restore();
          } else {
            c.save(); c.translate(eo.x, eo.y); if (o.dir < 0) c.scale(-1, 1);
            var legBob = opts.reduced ? 0 : Math.sin(now * 0.02 + o.x) * 2;
            c.translate(0, legBob * sp * 0.2);
            A.stamp(c, 'crawler', 0, 0, sp, 2.5);
            c.restore();
          }
        } else if (o.type === 'checkpoint') {
          var pf = V.project(L, camX, o.x, o.y);
          A.stamp(c, 'flag', pf.x, pf.y, sp, 2.5);
          if (o.passed && !opts.reduced) {
            var gl2 = 40 * sp + Math.sin(now * 0.006) * 8 * sp;
            if (!glowBlob) glowBlob = makeBlob('rgba(255,240,180,0.9)', 'rgba(255,220,120,0.3)');
            c.drawImage(glowBlob, pf.x - gl2, pf.y - 190 * sp - gl2, gl2 * 2, gl2 * 2);
          }
        } else if (o.type === 'beacon') {
          var pb2 = V.project(L, camX, o.x, o.y);
          c.save(); c.translate(pb2.x, pb2.y); c.scale(sp, sp);
          A.drawBeacon(c, { lit: o.lit, t: now });
          c.restore();
        }
      }

      // Mama's shadow (helps judge where she will land, ART-1)
      var gy = groundAt(game, S.x, S.y);
      var sm = V.project(L, camX, S.x, S.y);
      drawShadow(sm.x, V.project(L, camX, S.x, gy).y, T.MAMA_R * 1.5 * sp, 11 * sp, S.y - gy);
      // ducklings first (they trail behind), each with its own shadow
      for (i = 0; i < S.flock; i++) {
        var hx = duckPos(game, i);
        if (!hx) continue;
        var dp = V.project(L, camX, hx.x, hx.y);
        var dgy = groundAt(game, hx.x, hx.y);
        drawShadow(dp.x, V.project(L, camX, hx.x, dgy).y, 22 * sp, 7 * sp, hx.y - dgy);
        c.save(); c.translate(dp.x, dp.y);
        c.scale(sp, sp);
        A.drawDuckling(c, { t: now, hop: i * 0.63 });
        c.restore();
      }
      // Mama herself (drawn fresh every frame; she stays upright — no rolling)
      var squash = clamp(1 - (now - lastLand) / 160, 0, 1);
      c.save(); c.translate(sm.x, sm.y); c.scale(sp, sp);
      A.drawMama(c, { t: now, vy: S.vy, invuln: S.invuln, squash: S.onGround ? squash * 0.6 : 0, mood: S.invuln > 0 ? 'worried' : 'happy' });
      c.restore();
      // shield bubble
      if (S.shield > 0) {
        if (!glowBlob) glowBlob = makeBlob('rgba(140,190,255,0.55)', 'rgba(90,140,255,0.2)');
        var r = 62 * sp * (1 + Math.sin(now * 0.005) * 0.04);
        c.drawImage(glowBlob, sm.x - r, sm.y - 52 * sp - r, r * 2, r * 2);
      }
      // magnet aura
      if (S.magnetT > 0) {
        c.strokeStyle = 'rgba(229,72,77,' + (0.25 + 0.15 * Math.sin(now * 0.01)) + ')';
        c.lineWidth = Math.max(2, 5 * sp);
        c.beginPath(); c.arc(sm.x, sm.y - 46 * sp, T.MAGNET_RADIUS * sp * (0.96 + 0.04 * Math.sin(now * 0.008)), 0, TAU); c.stroke();
      }

      // particles and popups (world space)
      for (i = particles.length - 1; i >= 0; i--) {
        var pt = particles[i];
        if (!opts.frozen) {
          pt.age += 16.7;
          pt.x += pt.vx * 0.0167; pt.y += pt.vy * 0.0167; pt.vy += 500 * 0.0167;
        }
        if (pt.age > pt.ttl) { particles.splice(i, 1); continue; }
        var pp2 = V.project(L, camX, pt.x, pt.y);
        var al = 1 - pt.age / pt.ttl;
        if (pt.type === 'poof') {
          if (!shadowBlob) shadowBlob = makeBlob('rgba(255,255,255,0.9)', 'rgba(240,240,250,0.4)');
          var rr2 = (8 + pt.age * 0.05) * sp;
          c.globalAlpha = al * 0.8;
          c.drawImage(shadowBlob, pp2.x - rr2, pp2.y - rr2, rr2 * 2, rr2 * 2);
          c.globalAlpha = 1;
        } else {
          c.globalAlpha = al;
          A.star(c, pp2.x, pp2.y, (pt.type === 'goldSpark' ? 7 : 5) * sp * (0.6 + al * 0.6), 4);
          c.fillStyle = pt.color; c.fill();
          c.globalAlpha = 1;
        }
      }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (i = popups.length - 1; i >= 0; i--) {
        var pu = popups[i];
        if (!opts.frozen) pu.ttl -= 16.7;
        if (pu.ttl <= 0) { popups.splice(i, 1); continue; }
        var pu2 = V.project(L, camX, pu.x, pu.y + (1100 - pu.ttl) * 0.06);
        var fs = pu.size * sp * 1.4;
        c.font = '900 ' + fs + 'px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';
        c.lineWidth = fs * 0.22; c.strokeStyle = 'rgba(43,26,16,0.9)'; c.lineJoin = 'round';
        c.globalAlpha = clamp(pu.ttl / 300, 0, 1);
        c.strokeText(pu.text, pu2.x, pu2.y);
        c.fillStyle = pu.color; c.fillText(pu.text, pu2.x, pu2.y);
        c.globalAlpha = 1;
      }

      // chapter caption (drawn in the world layer: it never moves the playfield)
      if (opts.caption && opts.caption.alpha > 0) {
        var cap = opts.caption;
        c.globalAlpha = clamp(cap.alpha, 0, 1);
        var cy2 = L.h * 0.24;
        c.font = '900 ' + Math.round(L.h * 0.075) + 'px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = Math.round(L.h * 0.014); c.strokeStyle = 'rgba(43,26,16,0.92)'; c.lineJoin = 'round';
        c.strokeText(cap.title, L.w / 2, cy2);
        c.fillStyle = '#fff6e0'; c.fillText(cap.title, L.w / 2, cy2);
        if (cap.sub) {
          c.font = '700 ' + Math.round(L.h * 0.032) + 'px ui-rounded, system-ui, sans-serif';
          c.lineWidth = Math.round(L.h * 0.008);
          c.strokeText(cap.sub, L.w / 2, cy2 + L.h * 0.075);
          c.fillStyle = '#ffe9a8'; c.fillText(cap.sub, L.w / 2, cy2 + L.h * 0.075);
        }
        c.globalAlpha = 1;
      }

      c.restore();
    }

    function groundAt(game, x, y) {
      var best = 0;
      var plats = game.level.platforms;
      for (var i = 0; i < plats.length; i++) {
        var p = plats[i];
        if (!p.alive) continue;
        var span = game.span(p);
        if (x >= span.x0 - 6 && x <= span.x1 + 6 && span.y <= y + 2 && span.y >= best) best = span.y;
      }
      return best;
    }

    function drawShadow(x, y, rx, ry, height) {
      if (!shadowBlob) shadowBlob = makeBlob('rgba(30,18,8,0.5)', 'rgba(30,18,8,0.22)');
      var k = clamp(1 - height / 900, 0.35, 1);
      c.globalAlpha = 0.85 * k;
      c.drawImage(shadowBlob, x - rx * k + 4, y - ry * k, rx * 2 * k, ry * 2 * k);
      c.globalAlpha = 1;
    }

    function duckPos(game, i) {
      var S = game.S, target = S.x - (i + 1) * T.TRAIL_GAP;
      var h = game.hist;
      for (var k = h.length - 1; k >= 0; k--) {
        if (h[k].x <= target + 2) return h[k];
      }
      return h.length ? h[0] : null;
    }

    resize();
    return { resize: resize, draw: draw, fx: fx, layout: function () { return L; },
             camX: function () { return camX; }, snap: function (x) { camX = x; snapped = true; } };
  }

  root.EM = root.EM || {};
  root.EM.createRenderer = createRenderer;
})(typeof self !== 'undefined' ? self : globalThis);
