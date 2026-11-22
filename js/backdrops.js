/*
 * Egg Mama — the thirteen painted backdrops and the mood over them.
 *
 * Each chapter's background (assets/bg/*.webp, 1672×941 landscape paintings)
 * is drawn cover-fit and slides at BG_PARALLAX of the world speed, wrapping
 * sideways, so the world scrolls over a still-feeling painted valley while
 * the scenery stays crisp to the edges (VIEW-1/VIEW-2). A per-chapter mood
 * (fog, night, cavern dark, dawn…) is layered on top, plus a soft haze at the
 * ground line to seat the platforms in the picture.
 */
(function (root) {
  'use strict';

  var T = (typeof module !== 'undefined' && module.exports) ? require('./tuning.js') : root.EM.TUNING;
  var images = {};       // file name → Image (or null while loading)
  var blob = null;       // soft round blob for fog puffs and glows

  function loadAll(onOne) {
    var names = ['meadow', 'clover-mill', 'reedwater', 'orchard', 'amber-quarry', 'fogwood',
      'canyon', 'glass-coast', 'lantern-caverns', 'frostline', 'ridge', 'dawnbridge', 'beacon-summit'];
    names.forEach(function (n) {
      var img = new Image();
      img.onload = function () { images[n + '.webp'] = img; if (onOne) onOne(n); };
      img.onerror = function () { images[n + '.webp'] = null; };
      img.src = 'assets/bg/' + n + '.webp';
    });
  }
  function get(name) { return images[name] || null; }

  function makeBlob() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    return cv;
  }

  function hash(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }

  // Draw the backdrop for chapter `ch` with camera at camX (world units) on a
  // canvas already sized to the screen (L = view.layout).
  function draw(c, L, camX, ch, t) {
    var w = L.w, h = L.h;
    var img = get(ch.bg);
    if (img) {
      var k = Math.max(w / img.width, h / img.height);
      var dw = img.width * k, dh = img.height * k;
      var offX = -(((camX * L.sp * T.BG_PARALLAX) % dw) + dw) % dw;
      var offY = (h - dh) / 2;
      var tile = 0;
      for (var x = offX - dw; x < w + dw; x += dw, tile++) {
        if (tile % 2 === 0) {
          c.drawImage(img, x, offY, dw, dh);
        } else {
          // mirror odd tiles so each wrap seam meets its own edge, not a hard cut
          c.save();
          c.translate(x + dw, offY);
          c.scale(-1, 1);
          c.drawImage(img, 0, 0, dw, dh);
          c.restore();
        }
      }
    } else {
      // while the picture loads (or offline first paint): a calm gradient
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#bfe0f0'); g.addColorStop(0.7, '#e8f0d8'); g.addColorStop(1, ch.palette.side);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }

    if (!blob) blob = makeBlob();
    var i, x, y, s;

    // per-chapter mood
    switch (ch.overlay) {
      case 'fog': {
        c.fillStyle = 'rgba(226,232,224,0.34)'; c.fillRect(0, 0, w, h);
        for (i = 0; i < 9; i++) {
          var fx = hash(i, 3) * (w + 500) - 250 + Math.sin(t * 0.00006 + i * 2.1) * 60 - (camX * L.sp * 0.5 % (w + 500) + (w + 500)) % (w + 500) + 250;
          x = ((fx % (w + 500)) + (w + 500)) % (w + 500) - 250;
          y = h * (0.25 + hash(i, 7) * 0.55);
          s = (180 + hash(i, 11) * 260) * (L.sp / 1.2 + 0.4);
          c.globalAlpha = 0.16 + hash(i, 13) * 0.2;
          c.drawImage(blob, x - s / 2, y - s / 4, s, s / 2);
        }
        c.globalAlpha = 1;
        break;
      }
      case 'dark': {   // Lantern Caverns
        c.fillStyle = 'rgba(10,10,26,0.42)'; c.fillRect(0, 0, w, h);
        for (i = 0; i < 5; i++) {
          x = hash(i, 5) * w + Math.sin(t * 0.0004 + i) * 12 - (camX * L.sp * 0.8 % w + w) % w * 0 + 0;
          x = ((hash(i, 5) * (w + 300) - camX * L.sp * 0.8) % (w + 300) + (w + 300)) % (w + 300) - 150;
          y = h * (0.3 + hash(i, 9) * 0.4);
          s = 120 + hash(i, 2) * 160;
          var g2 = c.createRadialGradient(x, y, 2, x, y, s);
          g2.addColorStop(0, 'rgba(255,214,120,0.5)'); g2.addColorStop(1, 'rgba(255,190,80,0)');
          c.fillStyle = g2; c.beginPath(); c.arc(x, y, s, 0, 6.284); c.fill();
        }
        break;
      }
      case 'night': {  // Moonridge
        c.fillStyle = 'rgba(16,18,44,0.4)'; c.fillRect(0, 0, w, h);
        for (i = 0; i < 40; i++) {
          x = (hash(i, 21) * w - camX * L.sp * 0.18 % w + w) % w;
          y = hash(i, 23) * h * 0.6;
          var tw = 0.5 + 0.5 * Math.sin(t * 0.002 + i * 1.7);
          c.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.6 * tw * hash(i, 29)) + ')';
          c.fillRect(x, y, 2, 2);
        }
        break;
      }
      case 'cold': {
        c.fillStyle = 'rgba(210,235,250,0.18)'; c.fillRect(0, 0, w, h);
        break;
      }
      case 'warm': {   // Ember Canyon
        var g3 = c.createRadialGradient(w / 2, h, h * 0.2, w / 2, h, h * 1.3);
        g3.addColorStop(0, 'rgba(255,120,40,0.16)'); g3.addColorStop(1, 'rgba(120,20,10,0)');
        c.fillStyle = g3; c.fillRect(0, 0, w, h);
        break;
      }
      case 'dawn': {   // Beacon Summit
        var g4 = c.createLinearGradient(0, 0, 0, h);
        g4.addColorStop(0, 'rgba(255,190,150,0.20)'); g4.addColorStop(0.6, 'rgba(255,220,170,0.08)'); g4.addColorStop(1, 'rgba(255,220,170,0)');
        c.fillStyle = g4; c.fillRect(0, 0, w, h);
        break;
      }
    }

    // haze along the ground line so platforms sit in the scene
    var gy = L.groundY;
    var hz = c.createLinearGradient(0, gy - h * 0.16, 0, h);
    hz.addColorStop(0, 'rgba(255,255,255,0)');
    hz.addColorStop(1, 'rgba(30,20,10,0.28)');
    c.fillStyle = hz; c.fillRect(0, gy - h * 0.16, w, h - gy + h * 0.16);
  }

  root.EM = root.EM || {};
  root.EM.backdrops = { loadAll: loadAll, get: get, draw: draw };
})(typeof self !== 'undefined' ? self : globalThis);
