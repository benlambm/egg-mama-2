/*
 * Egg Mama — fitting the side-view world to a landscape screen.
 *
 * The world is fitted so a VIEW_FIT[0] × VIEW_FIT[1] window just holds it;
 * a wider phone shows more valley ahead, never a different game. The camera
 * follows Mama horizontally only — a normal jump keeps the horizon steady
 * (VIEW-2) — and the ground line always sits at GROUND_AT of the screen.
 * No browser code here, so the checks can test any screen size.
 */
(function (root) {
  'use strict';

  var BASE = (typeof module !== 'undefined' && module.exports)
    ? require('./tuning.js') : root.EM.TUNING;

  function layout(w, h, T) {
    T = T || BASE;
    if (!(w >= 1 && w < Infinity)) w = 1;
    if (!(h >= 1 && h < Infinity)) h = 1;
    var sp = Math.min(w / T.VIEW_FIT[0], h / T.VIEW_FIT[1]);   // pixels per unit
    return {
      w: w, h: h, sp: sp,
      groundY: h * T.GROUND_AT,          // screen y of the world ground line
      mamaX: w * T.MAMA_AT,              // screen x Mama is kept at
      seeAhead: T.SEE_AHEAD
    };
  }

  // World (x along the route, y up) to screen pixels. camX is the world x at
  // the LEFT edge of the screen; the renderer keeps Mama at L.mamaX by
  // setting camX = S.x - L.mamaX / sp. Returns the scale too.
  function project(L, camX, x, y) {
    return { x: (x - camX) * L.sp, y: L.groundY - y * L.sp, s: L.sp };
  }

  var api = { layout: layout, project: project };
  root.EM = root.EM || {};
  root.EM.view = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
