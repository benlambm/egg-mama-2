/*
 * Egg Mama — sound.
 *
 * Every sound is made in code with the Web Audio API; there are no sound
 * files. Browsers only allow sound after the player has touched something,
 * so unlock() is called from the first tap or key press.
 *
 * Two parts: short effects (SOUNDS), and the tune (createMusic), a small
 * step sequencer. Meadow's phrase is a short hummable motif; each landscape
 * transposes it, changes chords, tempo, instruments and drum intensity, and
 * the beacon brings the phrase back in its fullest arrangement. Every
 * arrangement is an exact 8-bar loop, so it sustains a whole chapter and
 * loops cleanly.
 *
 * Pause or background the game and the music stops; resuming starts exactly
 * one stream. Mute is kept in settings and persists across reloads.
 */
(function (root) {
  'use strict';

  var T = (root.EM && root.EM.TUNING) || {};
  var ac = null, master = null, musicGain = null, music = null, noiseBuf = null;
  var soundOn = true, musicOn = true, musicTimer = null, pace = 0;
  var asleep = false;
  var MAIN_VOLUME = 0.9;

  function musicVolume() { return T.MUSIC_VOLUME === undefined ? 0.42 : T.MUSIC_VOLUME; }
  function quietly(promise) { if (promise && promise.catch) promise.catch(function () { /* next tap tries again */ }); }

  function unlock() {
    if (!ac) {
      var Ctor = root.AudioContext || root.webkitAudioContext;
      if (!Ctor) return;
      try {
        ac = new Ctor();
        master = ac.createGain(); master.gain.value = MAIN_VOLUME; master.connect(ac.destination);
        musicGain = ac.createGain(); musicGain.gain.value = musicVolume(); musicGain.connect(master);
      } catch (e) { ac = null; return; }
    }
    wake();
  }
  function wake() {
    if (!ac || !ac.resume || ac.state === 'closed') return;
    if (ac.state === 'running' && !asleep) return;
    asleep = false;
    try { quietly(ac.resume()); } catch (e) { /* stay silent */ }
  }
  function sleep() {
    if (!ac || !ac.suspend || ac.state === 'closed') return;
    asleep = true;
    try { quietly(ac.suspend()); } catch (e) { /* nothing to pause */ }
  }

  function noiseBuffer(ctx) {
    var buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── sound effects ────────────────────────────────────────────────────
  function tone(type, f0, f1, dur, vol, when, dest) {
    if (!ac) return;
    var t = ac.currentTime + (when || 0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, when, lowpass) {
    if (!ac) return;
    if (!noiseBuf) noiseBuf = noiseBuffer(ac);
    var t = ac.currentTime + (when || 0);
    var src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = noiseBuf;
    g.gain.setValueAtTime(vol, t);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    if (lowpass) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; src.connect(f); f.connect(g); }
    else src.connect(g);
    g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  var SOUNDS = {
    click: function () { tone('square', 520, 780, 0.06, 0.07); },
    start: function () { tone('triangle', 392, 392, 0.1, 0.16); tone('triangle', 523, 523, 0.1, 0.16, 0.1); tone('triangle', 659, 659, 0.16, 0.16, 0.2); tone('triangle', 784, 784, 0.22, 0.18, 0.3); },
    jump: function () { tone('sine', 280, 620, 0.16, 0.2); },
    land: function (o) { noise(0.08, (o && o.hard) ? 0.22 : 0.1, 0, 900); },
    step: function () { tone('square', 700, 880, 0.04, 0.045); },
    // an ordinary egg rings; each in a streak a little higher
    egg: function (o) { var f = 880 * Math.pow(1.122, Math.min(7, (o && o.streak || 1) - 1)); tone('sine', f, f * 1.5, 0.14, 0.17); },
    // a golden hatch must be audible over the busiest music (AUDIO-2)
    hatch: function () {
      [1047, 1319, 1568, 2093].forEach(function (f, i) { tone('square', f, f, 0.11, 0.2, i * 0.055); });
      tone('sine', 2637, 3136, 0.4, 0.22, 0.24);
      noise(0.3, 0.1, 0, 6000);
    },
    golden: function () { [1047, 1319, 1568].forEach(function (f, i) { tone('sine', f, f * 1.01, 0.12, 0.16, i * 0.07); }); },
    ducklingLost: function () { tone('triangle', 700, 240, 0.34, 0.2); tone('sine', 500, 180, 0.3, 0.12, 0.05); noise(0.12, 0.12, 0, 1200); },
    hit: function () { noise(0.14, 0.4); tone('sawtooth', 380, 110, 0.26, 0.18); },
    shieldHit: function () { tone('sine', 1200, 500, 0.18, 0.2); noise(0.1, 0.25, 0, 4000); },
    shield: function () { [880, 1108, 1319].forEach(function (f, i) { tone('sine', f, f, 0.1, 0.15, i * 0.06); }); },
    magnet: function () { tone('square', 300, 900, 0.12, 0.12); tone('square', 450, 1350, 0.12, 0.1, 0.1); },
    stomp: function () { tone('sine', 500, 140, 0.14, 0.24); noise(0.06, 0.2, 0, 2000); },
    spring: function () { tone('sine', 200, 900, 0.2, 0.22); tone('square', 600, 1200, 0.1, 0.08, 0.12); },
    creak: function () { tone('sawtooth', 140, 90, 0.12, 0.1); },
    crack: function () { noise(0.2, 0.4, 0, 1400); tone('square', 220, 60, 0.18, 0.16); },
    checkpoint: function () { tone('sine', 784, 784, 0.12, 0.18); tone('sine', 1047, 1047, 0.24, 0.18, 0.12); },
    fall: function () { tone('sine', 600, 120, 0.4, 0.16); noise(0.25, 0.16, 0.1, 900); },
    beacon: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone('triangle', f, f, 0.5, 0.2, i * 0.12); });
      [1319, 1568, 2093].forEach(function (f, i) { tone('sine', f, f, 0.7, 0.14, 0.5 + i * 0.12); });
      noise(0.6, 0.08, 0.4, 7000);
    },
    over: function () {
      noise(0.22, 0.4); tone('sawtooth', 400, 90, 0.35, 0.18);
      [392, 330, 262].forEach(function (f, i) { tone('sine', f, f * 0.94, 0.32, 0.18, 0.4 + i * 0.26); });
    }
  };

  function sfx(name, o) {
    if (!soundOn || !ac || ac.state !== 'running') return;
    try { if (SOUNDS[name]) SOUNDS[name](o); } catch (e) { /* play on in silence */ }
  }

  // ── the tune ─────────────────────────────────────────────────────────
  // A step sequencer: 16 sixteenth steps to a bar, 8 bars to the loop.
  // The Meadow phrase (MOTIF), transposed to each landscape's root.
  var MOTIF = [
    { 0: 72, 3: 76, 6: 79, 8: 81, 11: 79, 14: 76 },
    { 0: 77, 4: 76, 8: 74, 12: 72 },
    { 0: 76, 3: 79, 6: 81, 8: 84, 11: 81, 14: 79 },
    { 0: 77, 4: 79, 8: 76, 12: 74 },
    { 0: 72, 3: 76, 6: 79, 8: 81, 11: 84, 14: 81 },
    { 0: 79, 3: 77, 6: 76, 10: 74, 12: 72 },
    { 0: 74, 4: 77, 8: 79, 12: 76 },
    { 0: 72, 6: 74, 10: 76, 13: 72 }
  ];
  var PROG_MAJOR = { roots: [0, 0, -3, -3, 5, 5, 7, 7], minor: [0, 0, 1, 1, 0, 0, 0, 0] };
  var PROG_MINOR = { roots: [0, 0, -7, -7, -4, -4, -5, -5], minor: [1, 1, 1, 1, 0, 0, 0, 0] };
  var BASS = [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 0, null, 7, 12];

  function hz(note) { return 440 * Math.pow(2, (note - 69) / 12); }

  // Build the band for one chapter's music config on ctx, out = destination.
  function createMusic(ctx, out, song) {
    var squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -16; squash.ratio.value = 5; squash.attack.value = 0.004; squash.release.value = 0.16;
    squash.connect(out);
    var drums = ctx.createGain(); drums.connect(squash);
    var pump = ctx.createGain(); pump.connect(squash);
    function filter(type, freq, q, dest) {
      var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(dest); return f;
    }
    var bassBus = filter('lowpass', 640, 6, pump);
    var stabBus = filter('lowpass', 2400, 1, pump);
    var leadBus = filter('lowpass', 5200, 0.7, pump);
    var hatBus = filter('highpass', 7000, 0.7, drums);
    var clapBus = filter('bandpass', 1700, 0.9, drums);
    var echo = ctx.createDelay(1), echoBack = ctx.createGain(), echoOut = ctx.createGain();
    echoBack.gain.value = 0.3; echoOut.gain.value = 0.4;
    leadBus.connect(echo); echo.connect(echoBack); echoBack.connect(echo); echo.connect(echoOut); echoOut.connect(pump);
    var hiss = noiseBuffer(ctx);

    var root0 = song.root, minor = !!song.minor, inten = song.intensity === undefined ? 0.6 : song.intensity;
    var prog = minor ? PROG_MINOR : PROG_MAJOR;
    var leadWave = song.leadWave || 'square', stabWave = song.stabWave || 'sawtooth';
    var linedUp = [];

    function note(type, freq, t, dur, vol, dest, slideTo) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + dur + 0.02);
      linedUp.push({ at: t, out: g });
    }
    function burst(dest, t, dur, vol) {
      var s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = hiss;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(g); g.connect(dest);
      s.start(t, (t * 7.3) % 0.8); s.stop(t + dur + 0.02);
      linedUp.push({ at: t, out: g });
    }
    function hush() {
      var now = ctx.currentTime;
      for (var i = 0; i < linedUp.length; i++) if (linedUp[i].at > now) linedUp[i].out.disconnect();
      linedUp.length = 0;
      pump.gain.cancelScheduledValues(now);
      pump.gain.setTargetAtTime(1, now, 0.03);
    }
    function kick(t, vol) {
      note('sine', 150, t, 0.22, vol, drums, 42);
      pump.gain.cancelScheduledValues(t);
      pump.gain.setValueAtTime(0.45, t);
      pump.gain.linearRampToValueAtTime(1, t + 0.18);
    }

    // Play everything on sixteenth step `n` at time `t`; `len` = step seconds.
    function play(n, t, len) {
      var step = n % 16, bar = Math.floor(n / 16) % 8;
      var full = bar >= 2, breath = bar >= 6 && !song.full;   // bars 6-7 breathe unless the full arrangement
      if (step % 2) t += len * 0.15;                          // swing
      while (linedUp.length && linedUp[0].at <= ctx.currentTime) linedUp.shift();
      echo.delayTime.setValueAtTime(len * 3, t);
      var root = root0 + prog.roots[bar];
      var tones = prog.minor[bar] ? [0, 3, 7, 12] : [0, 4, 7, 12];

      if (inten > 0.25 && full && step % 4 === 0) kick(t, 0.55);
      if (inten > 0.45 && full && (step === 4 || step === 12)) burst(clapBus, t, 0.14, 0.34);
      if (inten > 0.35 && step % 4 === 2) burst(hatBus, t, 0.09, 0.14);
      else if (inten > 0.7 && step % 2) burst(hatBus, t, 0.03, 0.07);

      var b = BASS[step];
      if (b !== null && (full || bar < 2)) note('sawtooth', hz(root - 12 + b), t, len * 1.7, 0.3, bassBus);
      if (inten > 0.5 && full && step % 4 === 2) {
        for (var i = 0; i < 3; i++) note(stabWave, hz(root + 12 + tones[i]), t, 0.14, 0.05, stabBus);
      }
      var m = MOTIF[bar][step];
      if (m && (full || breath)) {
        note(leadWave, hz(m + (root0 - 60)), t, len * 2.4, breath ? 0.075 : 0.1, leadBus);
      }
      if (song.full && step % 2 === 0) {   // the fuller beacon arrangement adds an arp
        note('triangle', hz(root + 24 + tones[(step / 2) % 4 | 0]), t, len * 0.8, 0.045, stabBus);
      }
    }
    return { play: play, hush: hush };
  }

  var nextNoteAt = 0, stepNo = 0, songDef = null, stepLen = 0.12;
  function schedule() {
    if (!ac || ac.state !== 'running' || !music) return;
    if (nextNoteAt < ac.currentTime) nextNoteAt = ac.currentTime + 0.06;
    while (nextNoteAt < ac.currentTime + 0.3) {
      var bpm = songDef.bpm * (1 + 0.06 * pace);
      stepLen = 60 / bpm / 4;
      music.play(stepNo, nextNoteAt, stepLen);
      nextNoteAt += stepLen; stepNo++;
    }
  }
  // song: a chapter's music config (from levels.js). fromTheTop restarts the
  // 8-bar loop (a new chapter or a new journey); otherwise it carries on.
  function startMusic(song, fromTheTop) {
    stopMusic();
    if (!musicOn || !soundOn || !ac || !song) return;
    songDef = song;
    if (!music || music._song !== song) {
      try { music = createMusic(ac, musicGain, song); music._song = song; }
      catch (e) { music = null; return; }
    }
    if (fromTheTop) stepNo = 0;
    else stepNo -= stepNo % 16;
    nextNoteAt = 0;
    musicGain.gain.cancelScheduledValues(ac.currentTime);
    musicGain.gain.setTargetAtTime(musicVolume(), ac.currentTime, 0.02);
    musicTimer = setInterval(schedule, 70);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (music) music.hush();
    if (ac && musicGain) {
      musicGain.gain.cancelScheduledValues(ac.currentTime);
      musicGain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.03);
    }
  }

  root.EM = root.EM || {};
  root.EM.audio = {
    unlock: unlock, sfx: sfx, startMusic: startMusic, stopMusic: stopMusic,
    setSound: function (on) { soundOn = !!on; if (!on) stopMusic(); },
    setMusic: function (on) { musicOn = !!on; if (!on) stopMusic(); },
    setPace: function (p) { pace = clamp01(p); },
    sleep: sleep, wake: wake,
    createMusic: createMusic, mainVolume: MAIN_VOLUME,
    musicPlaying: function () { return !!musicTimer; }
  };
  function clamp01(p) { return Math.max(0, Math.min(1, p || 0)); }
})(typeof self !== 'undefined' ? self : globalThis);
