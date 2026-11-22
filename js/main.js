/*
 * Egg Mama — the game loop, controls and menus.
 *
 * Ties the pieces together: reads swipes and keys, advances the engine,
 * draws with the renderer, plays sounds, saves at checkpoint flags / chapter
 * transitions / the beacon, and runs the title, pause, results, beacon,
 * journal, how-to and rotate screens over the scene.
 *
 * Modes: title → playing ⇄ paused → over | beacon; rotating interrupts play
 * in portrait and waits for the player to resume (VIEW-4).
 */
(function () {
  'use strict';
  var EM = window.EM, T = EM.TUNING, audio = EM.audio, LEVELS = EM.levels;

  function $(id) { return document.getElementById(id); }
  var canvas = $('game');
  var renderer = EM.createRenderer(canvas);

  var storage = null;
  try { storage = window.localStorage; storage.getItem('x'); } catch (e) { storage = null; }
  var progress = EM.progress.createProgress(storage);
  var settings = progress.settings();
  audio.setSound(settings.sound); audio.setMusic(settings.music);

  var mode = 'title';
  var game = null;              // the engine game being played
  var demo = null;              // the quiet Meadow run behind the title
  var captions = [];            // queue of {title, sub, t0, dur} — chapter cue, then narration lines
  var shakeAt = 0;
  var overlay = null;           // 'confirm' | 'journal' | 'how' | null
  var overlayFrom = null;
  var resultsAt = 0;
  var pendingOverAt = 0;
  var RESULTS_GUARD_MS = 500;
  var lastFrame = 0;
  var fingers = {};
  var snapCam = true;

  var screens = {
    title: $('title'), pause: $('pause'), over: $('over'), beacon: $('beacon'),
    confirm: $('confirm'), journal: $('journal'), how: $('how'), rotate: $('rotate')
  };
  function show(name) {
    for (var k in screens) screens[k].hidden = (k !== name);
    $('pauseBtn').hidden = !(name === null && (mode === 'playing'));
    fitCards();
    var a = document.activeElement;
    if (a && a !== document.body && a.blur && !a.getClientRects().length) a.blur();
  }

  // A menu card too tall for the screen is drawn a little smaller first, so
  // every button is reachable without scrolling (landscape phones are short).
  var CARD_SMALLEST = 0.78;
  function fitCards() {
    var cards = document.querySelectorAll('.screen:not([hidden]) > .card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i], size = 1;
      card.style.zoom = '';
      for (var tries = 0; tries < 3 && size > CARD_SMALLEST && card.scrollHeight > card.clientHeight + 1; tries++) {
        size = Math.max(CARD_SMALLEST, size * card.clientHeight / card.scrollHeight - 0.01);
        card.style.zoom = size;
      }
    }
  }

  function cues() { return progress.save().cues; }

  // ── title ────────────────────────────────────────────────────────────
  function drawTitleMama() {
    var cv = $('titleMama'), c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.translate(cv.width / 2, cv.height - 18);
    c.scale(cv.height / 190, cv.height / 190);
    c.fillStyle = 'rgba(60,38,20,0.18)';
    c.beginPath(); c.ellipse(0, 2, 44, 9, 0, 0, 6.283); c.fill();
    EM.art.drawMama(c, { t: 0, vy: 0, invuln: 0, squash: 0, mood: 'happy' });
    c.restore();
  }

  function makeDemo() {
    return EM.engine.createGame({ chapterIndex: 0, circuit: 1, seed: 20261122 });
  }

  function refreshTitle() {
    var has = progress.hasSave();
    $('continueBtn').hidden = !has;
    $('startOverBtn').hidden = !has;
    $('playBtn').hidden = has;
    $('playBtn').textContent = 'Begin the Journey';
    refreshSwitches();
  }
  function showTitle() {
    mode = 'title';
    audio.stopMusic();
    demo = makeDemo();
    renderer.fx.clear();
    captions.length = 0;
    refreshTitle();
    show('title');
    drawTitleMama();
  }

  function refreshSwitches() {
    settings = progress.settings();
    [['soundBtn', 'sound', 'Sound'], ['pauseSoundBtn', 'sound', 'Sound'],
     ['musicBtn', 'music', 'Music'], ['pauseMusicBtn', 'music', 'Music']].forEach(function (b) {
      $(b[0]).textContent = b[2] + ': ' + (settings[b[1]] ? 'On' : 'Off');
      $(b[0]).setAttribute('aria-pressed', String(settings[b[1]]));
    });
  }
  function toggle(name) {
    audio.unlock();
    progress.setSwitch(name, !progress.settings()[name]);
    settings = progress.settings();
    audio.setSound(settings.sound); audio.setMusic(settings.music);
    if (mode === 'playing' && settings.music && settings.sound && !audio.musicPlaying()) {
      audio.startMusic(game.level.ch.music, false);
    }
    audio.sfx('click');
    refreshSwitches();
  }

  // ── starting and chaining chapters ───────────────────────────────────
  function begin(chapterIndex, circuit, seed, carry) {
    game = EM.engine.createGame({ chapterIndex: chapterIndex, circuit: circuit, seed: seed, carry: carry });
    var ch = game.level.ch;
    if (cues().indexOf(ch.id) < 0) progress.addCue(ch.id);
    renderer.fx.clear();
    snapCam = true;
    // chapter cue first, then the chapter's narration lines one by one
    captions = [{ title: 'Chapter ' + ch.num + ' · ' + ch.name, sub: ch.cue, t0: 0, dur: 3600 }];
    (ch.narr || []).forEach(function (line) { captions.push({ title: null, sub: line, t0: 0, dur: 3800 }); });
    progress.record(game.serialize(), cues());      // save at the chapter transition (SAVE-1)
    mode = 'playing';
    pendingOverAt = 0;
    show(null);
    audio.unlock(); audio.wake();
    audio.sfx('start');
    audio.startMusic(ch.music, true);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function startFromSave() {
    var s = progress.save();
    begin(s.chapter, s.circuit, s.seed, { x: s.x, y: s.y, eggs: s.eggs, score: s.score, flock: s.flock, shield: s.shield });
  }
  function beginFresh() {
    begin(0, 1, (Math.random() * 4294967296) >>> 0, null);
  }
  function retryCheckpoint() {
    var s = progress.save();
    audio.sfx('click');
    begin(s.chapter, s.circuit, s.seed, { x: s.x, y: s.y, eggs: s.eggs, score: s.score, flock: s.flock, shield: s.shield });
  }
  function nextChapter() {
    var S = game.S, lv = game.level;
    var next = lv.chapterIndex + 1;
    if (next >= LEVELS.CHAPTERS.length) return;   // chapter 13 ends at the beacon instead
    begin(next, lv.circuit, (Math.random() * 4294967296) >>> 0,
      { x: T.START_X, eggs: S.eggs, score: S.score, flock: S.flock, shield: S.shield });
  }

  // ── pause / resume / rotate ──────────────────────────────────────────
  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused';
    fingers = {};
    audio.stopMusic();
    audio.sleep();
    refreshPauseStats();
    refreshSwitches();
    show('pause');
    $('resumeBtn').focus();
  }
  function resume() {
    if (mode !== 'paused') return;
    mode = 'playing';
    audio.unlock(); audio.wake();
    audio.startMusic(game.level.ch.music, false);
    lastFrame = 0;
    show(null);
  }
  function refreshPauseStats() {
    var S = game.S, ch = game.level.ch;
    $('pauseStats').textContent = 'Chapter ' + ch.num + ' · ' + ch.name + ' (circuit ' + game.level.circuit + ') — ' +
      S.eggs + ' eggs · ' + Math.round(S.score) + ' pts · ' + S.flock + ' duckling' + (S.flock === 1 ? '' : 's') +
      (S.shield > 0 ? ' · shield' : '');
  }
  function statHtml(pairs) {
    return pairs.map(function (p) {
      return '<div class="stat"><span class="label">' + p[0] + '</span><span class="value">' + p[1] + '</span></div>';
    }).join('');
  }

  var OVER_LINES = {
    fall: 'Mama tumbled into the pit with no ducklings left to catch her.',
    enemy: 'A critter got Mama — no ducklings left to help.',
    spikes: 'The spikes were too much, and no duckling was left.'
  };
  function showOver() {
    var S = game.S, ch = game.level.ch;
    mode = 'over';
    audio.stopMusic();
    audio.sfx('over');
    $('overH').textContent = S.cause === 'fall' ? 'Into the pit!' : S.cause === 'spikes' ? 'Ouch!' : 'Nipped!';
    $('overLine').textContent = OVER_LINES[S.cause] || OVER_LINES.enemy;
    $('overStats').innerHTML = statHtml([
      ['Chapter', ch.num + ' · ' + ch.name], ['Eggs', S.eggs],
      ['Score', Math.round(S.score)], ['Ducklings', S.flock]
    ]);
    resultsAt = performance.now();
    show('over');
  }

  function showBeacon() {
    var S = game.S, lv = game.level;
    mode = 'beacon';
    audio.stopMusic();
    audio.sfx('beacon');
    audio.startMusic({ bpm: lv.ch.music.bpm, root: lv.ch.music.root, minor: lv.ch.music.minor,
      intensity: 1, full: true, leadWave: lv.ch.music.leadWave, stabWave: lv.ch.music.stabWave }, true);
    progress.record(game.serialize(), cues());      // save at the summit beacon (SAVE-1)
    $('beaconStats').innerHTML = statHtml([
      ['Eggs recovered', S.eggs], ['Score', Math.round(S.score)],
      ['Ducklings', S.flock], ['Circuits', lv.circuit]
    ]);
    resultsAt = performance.now();
    show('beacon');
  }
  function keepGoing() {
    var S = game.S, lv = game.level;
    audio.sfx('click');
    begin(0, lv.circuit + 1, (Math.random() * 4294967296) >>> 0,
      { x: T.START_X, eggs: S.eggs, score: S.score, flock: S.flock, shield: S.shield });
  }

  // ── events from the engine → sound, sparkles, saves ──────────────────
  function react(events) {
    var S = game.S, fx = renderer.fx;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      switch (e.type) {
        case 'jump': audio.sfx('jump'); break;
        case 'land': audio.sfx('land', { hard: e.hard }); fx.land(e.x, e.y); break;
        case 'egg':
          audio.sfx('egg', { streak: e.streak });
          fx.egg(e.x, e.y, false);
          fx.popup('+' + T.EGG_POINTS, '#fff6e0', 22, e.x, e.y + 30);
          break;
        case 'golden':
          audio.sfx('golden');
          fx.egg(e.x, e.y, true);
          fx.popup('+' + T.GOLDEN_POINTS, '#ffd43b', 26, e.x, e.y + 30);
          break;
        case 'hatch':
          audio.sfx('hatch');                       // loud and clear over the music (AUDIO-2)
          fx.hatch(e.x, e.y);
          fx.popup('A duckling hatches!', '#ffe9a8', 30, e.x, e.y + 46);
          if (navigator.vibrate) { try { navigator.vibrate(40); } catch (err) { } }
          break;
        case 'shield': audio.sfx('shield'); fx.popup('Shield!', '#8cc0ff', 26, e.x, e.y + 40); break;
        case 'magnet': audio.sfx('magnet'); fx.popup('Egg magnet!', '#ff9a8c', 26, e.x, e.y + 40); break;
        case 'stomp': audio.sfx('stomp'); fx.poof(e.x, e.y + 30); fx.popup('+' + T.STOMP_POINTS, '#c8b8ff', 24, e.x, e.y + 60); break;
        case 'spring': audio.sfx('spring'); break;
        case 'creak': audio.sfx('creak'); break;
        case 'crack': audio.sfx('crack'); fx.poof(e.x, e.y + 10); break;
        case 'ducklingLost':
          audio.sfx('ducklingLost'); fx.poof(e.x, e.y + 40);
          fx.popup('A duckling went back to the nest', '#ff9a8c', 24, e.x, e.y + 60);
          shakeAt = performance.now();
          if (navigator.vibrate) { try { navigator.vibrate(70); } catch (err) { } }
          break;
        case 'shieldHit':
          audio.sfx('shieldHit'); fx.popup('The shield took the hit!', '#8cc0ff', 24, e.x, e.y + 60);
          shakeAt = performance.now();
          if (navigator.vibrate) { try { navigator.vibrate(60); } catch (err) { } }
          break;
        case 'fall':
          audio.sfx('fall');
          fx.popup(e.savedBy === 'shield' ? 'The shield broke — back to the flag!' : 'Back to the checkpoint!', '#fff6e0', 24, e.x, e.y + 80);
          break;
        case 'checkpoint':
          audio.sfx('checkpoint');
          fx.popup('Checkpoint', '#a8e878', 26, e.x, e.y + 120);
          progress.record(game.serialize(), cues());   // autosave (SAVE-1)
          break;
        case 'over':
          shakeAt = performance.now();
          if (navigator.vibrate) { try { navigator.vibrate([80, 60, 120]); } catch (err) { } }
          pendingOverAt = performance.now() + 850;
          break;
        case 'chapterEnd': nextChapter(); break;
        case 'beacon': setTimeout(showBeacon, 1100); break;
      }
    }
  }

  // ── the loop ─────────────────────────────────────────────────────────
  var reducedMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(reducedMQ && reducedMQ.matches); }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
    lastFrame = now;
    fitIfChanged();

    var cap = null;
    var cur = captions[0];
    if (cur) {
      if (!cur.t0) cur.t0 = now;
      var ct = now - cur.t0;
      if (ct >= cur.dur) captions.shift();   // fully shown (faded out) — next line
      else {
        var alpha = ct < 400 ? ct / 400 : ct > cur.dur - 700 ? Math.max(0, (cur.dur - ct) / 700) : 1;
        cap = { title: cur.title, sub: cur.sub, alpha: alpha };
      }
    }
    var shake = shakeAt ? Math.max(0, 1 - (now - shakeAt) / 450) : 0;

    if (mode === 'playing') {
      game.update(dt);
      react(game.drain());
      audio.setPace(game.S.x / game.level.L);
      if (pendingOverAt && now >= pendingOverAt) { pendingOverAt = 0; showOver(); }
    } else if (mode === 'title') {
      demo.update(dt * 0.55);
      demo.drain();
      if (demo.S.chapterDone) demo = makeDemo();
    }

    var active = mode === 'playing' || mode === 'title' ? (mode === 'playing' ? game : demo) : game;
    if (active) {
      renderer.draw(active, now, {
        snap: snapCam, frozen: mode !== 'playing' && mode !== 'title',
        reduced: reducedMotion(), shake: shake, caption: cap
      });
      snapCam = false;
    }
  }

  // ── controls ─────────────────────────────────────────────────────────
  function act(cmd) {
    if (mode !== 'playing') return;
    game.input(cmd);
  }

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (overlay === 'confirm') {
      if (k === 'Escape') { closeOverlay(); e.preventDefault(); }
      else if (k === 'Tab') {
        (document.activeElement === $('confirmNo') ? $('confirmYes') : $('confirmNo')).focus();
        e.preventDefault();
      }
      return;
    }
    if (overlay) {
      if (k === 'Escape') { closeOverlay(); e.preventDefault(); }
      return;
    }
    audio.unlock();
    if (mode === 'playing') {
      var cmd = (k === 'ArrowLeft' || k === 'a' || k === 'A') ? 'left'
              : (k === 'ArrowRight' || k === 'd' || k === 'D') ? 'right'
              : (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') ? 'jump' : null;
      if (cmd) { if (cmd !== 'jump' || !e.repeat) act(cmd); }
      else if (k === 'Escape' || k === 'p' || k === 'P') pause();
      else if (k === 'm' || k === 'M') toggle('sound');
      else return;
      e.preventDefault();
      return;
    }
    if (mode === 'paused' && (k === 'Escape' || k === 'p' || k === 'P')) { resume(); e.preventDefault(); return; }
    if ((k === 'm' || k === 'M')) { toggle('sound'); e.preventDefault(); return; }
    var onButton = e.target && e.target.tagName === 'BUTTON';
    if ((k === 'Enter' || k === ' ') && !onButton && !e.repeat) {
      if (mode === 'title') { if (progress.hasSave()) startFromSave(); else beginFresh(); }
      else if (mode === 'paused') resume();
      else if (mode === 'over' && performance.now() - resultsAt > RESULTS_GUARD_MS) retryCheckpoint();
      else if (mode === 'beacon' && performance.now() - resultsAt > RESULTS_GUARD_MS) keepGoing();
      e.preventDefault();
    }
  });

  // Swipes: one swipe is one action, fired as soon as the finger has travelled
  // far enough; every finger is followed on its own.
  function swipeSize() { return Math.max(18, Math.min(34, Math.min(window.innerWidth, window.innerHeight) * 0.05)); }
  canvas.addEventListener('pointerdown', function (e) {
    audio.unlock();
    fingers[e.pointerId] = { x: e.clientX, y: e.clientY, used: false };
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { } }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    var f = fingers[e.pointerId];
    if (!f || f.used) return;
    var dx = e.clientX - f.x, dy = e.clientY - f.y, need = swipeSize();
    if (Math.abs(dx) < need && Math.abs(dy) < need) return;
    f.used = true;
    if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right');
    else if (dy < 0) act('jump');
    e.preventDefault();
  });
  function endTouch(e) { delete fingers[e.pointerId]; }
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  // ── buttons ──────────────────────────────────────────────────────────
  function press(id, fn) { $(id).addEventListener('click', function () { audio.unlock(); fn(); }); }
  press('playBtn', beginFresh);
  press('continueBtn', startFromSave);
  press('pauseBtn', pause);
  press('resumeBtn', resume);
  press('retryBtn', retryCheckpoint);
  press('retryBtn2', retryCheckpoint);
  press('quitBtn', function () { audio.sfx('click'); showTitle(); });
  press('overHomeBtn', function () { audio.sfx('click'); showTitle(); });
  press('beaconHomeBtn', function () { audio.sfx('click'); showTitle(); });
  press('keepGoingBtn', keepGoing);
  press('soundBtn', function () { toggle('sound'); });
  press('pauseSoundBtn', function () { toggle('sound'); });
  press('musicBtn', function () { toggle('music'); });
  press('pauseMusicBtn', function () { toggle('music'); });
  press('howBtn', function () { openOverlay('how', 'title'); });
  press('pauseHowBtn', function () { openOverlay('how', 'pause'); });
  press('howClose', closeOverlay);
  press('journalBtn', function () { openOverlay('journal', 'pause'); });
  press('journalClose', closeOverlay);
  press('rotateResumeBtn', function () {
    if (mode !== 'rotating') return;
    mode = 'playing';
    show(null);
    audio.unlock(); audio.wake();
    audio.startMusic(game.level.ch.music, false);
    lastFrame = 0;
  });

  // Start Over with "Are you sure?" (SAVE-2). Cancel preserves the save.
  press('startOverBtn', function () {
    audio.sfx('click');
    openOverlay('confirm', 'title');
    $('confirmNo').focus();
  });
  press('confirmNo', function () { audio.sfx('click'); closeOverlay(); });
  press('confirmYes', function () {
    progress.startOver();
    closeOverlay();
    audio.sfx('ducklingLost');
    showTitle();
    $('playBtn').focus();
  });

  function openOverlay(name, from) {
    overlay = name; overlayFrom = from;
    if (name === 'journal') buildJournal();
    show(name);
  }
  function closeOverlay() {
    overlay = null;
    if (overlayFrom === 'pause' && mode === 'paused') show('pause');
    else if (overlayFrom === 'title' || mode === 'title') show('title');
    else show(mode === 'paused' ? 'pause' : null);
    overlayFrom = null;
  }

  function buildJournal() {
    var list = $('journalList');
    list.textContent = '';
    var seen = cues();
    // allUnlocked is a testing switch (?all in the URL or EM.debug.unlockAll()):
    // every chapter in the journal can be jumped to directly.
    var all = progress.settings().allUnlocked === true;
    LEVELS.CHAPTERS.forEach(function (ch, i) {
      var li = document.createElement('li');
      var unlocked = all || seen.indexOf(ch.id) >= 0;
      if (!unlocked) li.className = 'unseen';
      var nm = document.createElement('span'); nm.className = 'ch-name';
      nm.textContent = ch.num + ' · ' + ch.name;
      var cue = document.createElement('span'); cue.className = 'ch-cue';
      cue.textContent = seen.indexOf(ch.id) >= 0 ? ch.cue : (unlocked ? 'Uncharted — tap to scout it.' : 'Not yet found on the trail…');
      li.appendChild(nm); li.appendChild(cue);
      if (unlocked) {
        li.classList.add('open');
        li.setAttribute('role', 'button');
        li.tabIndex = 0;
        li.addEventListener('click', function () { jumpToChapter(i); });
        li.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); jumpToChapter(i); } });
      }
      list.appendChild(li);
    });
  }

  function jumpToChapter(i) {
    audio.unlock(); audio.sfx('click');
    closeOverlay();
    begin(i, 1, (Math.random() * 4294967296) >>> 0, null);
  }

  // ── rotation (VIEW-4) ────────────────────────────────────────────────
  function isPortrait() { return canvas.clientHeight > canvas.clientWidth * 1.05; }
  function checkOrientation() {
    if (mode === 'playing' && isPortrait()) {
      mode = 'rotating';
      fingers = {};
      audio.stopMusic();
      audio.sleep();
      $('rotateResumeBtn').disabled = true;
      show('rotate');
    } else if (mode === 'rotating') {
      if (isPortrait()) { $('rotateResumeBtn').disabled = true; show('rotate'); }
      else { $('rotateResumeBtn').disabled = false; show('rotate'); }  // the player chooses when to resume
    }
  }

  // ── pause when the player switches away; stay paused until they return ─
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { pause(); audio.sleep(); }
    else {
      audio.wake();
      if (mode !== 'paused' && mode !== 'rotating') audio.wake();
    }
  });
  window.addEventListener('blur', function () { if (mode === 'playing') pause(); });
  window.addEventListener('pagehide', function () { if (mode === 'playing') pause(); });

  // ── refit on resize / turn / sharpness change ────────────────────────
  var fitW = 0, fitH = 0, fitDpr = 0;
  function refit() {
    renderer.resize();
    fitCards();
    checkOrientation();
    fitW = canvas.clientWidth; fitH = canvas.clientHeight; fitDpr = window.devicePixelRatio;
  }
  function fitIfChanged() {
    if (canvas.clientWidth !== fitW || canvas.clientHeight !== fitH || window.devicePixelRatio !== fitDpr) refit();
  }
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', function () { setTimeout(refit, 60); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);

  // ── offline play ─────────────────────────────────────────────────────
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      try { navigator.serviceWorker.register('sw.js').catch(function () { /* still playable online */ }); }
      catch (e) { /* still playable online */ }
    });
  }

  EM.backdrops.loadAll();

  // Testing hook: open the game with ?all (or #all) in the URL to unlock every
  // chapter in the Trail Journal.
  if (/[?&#]all\b/.test(location.search + location.hash)) progress.setSwitch('allUnlocked', true);

  // For developer tools and the browser checks.
  window.EM.debug = {
    mode: function () { return mode; },
    game: function () { return game; },
    demo: function () { return demo; },
    progress: progress,
    begin: begin, startFromSave: startFromSave, beginFresh: beginFresh,
    pause: pause, resume: resume, renderer: renderer,
    unlockAll: function () { progress.setSwitch('allUnlocked', true); settings = progress.settings(); }
  };

  showTitle();
  requestAnimationFrame(frame);
})();
