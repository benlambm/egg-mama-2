/*
 * Egg Mama — what the device remembers.
 *
 * Two keys in localStorage: the journey save (chapter, circuit, route seed,
 * checkpoint position, eggs, score, flock, shield, journal cues, beacon) and
 * the settings (sound, music). If storage is unavailable the game still plays;
 * it just forgets when closed.
 *
 * A returning player who already has a save on the published GitHub Pages
 * game keeps it: if no v2 save exists but a legacy egg-mama save does, its
 * journey is carried over (SAVE-2).
 */
(function (root) {
  'use strict';

  var KEY = 'egg-mama-2.save.v2';
  var KEY_SETTINGS = 'egg-mama-2.settings.v1';
  // Older releases of the game published from the same web address; their
  // saves are read (best effort) but never written.
  var LEGACY_KEYS = ['egg-mama.save.v1', 'egg-mama-save', 'eggMamaSave'];
  var MAX_SCORE = 1e9, MAX_EGGS = 1e7;

  function freshSave() {
    return { v: 2, chapter: 0, circuit: 1, seed: 1, x: 0, y: 0, eggs: 0, score: 0,
             flock: 0, shield: 0, cues: [], beaconLit: false };
  }
  function freshSettings() { return { sound: true, music: true }; }

  function num(v, lo, hi, dflt) {
    return (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi) ? v : dflt;
  }

  // Tolerant parse: anything that does not make sense keeps its fresh value.
  function parseSave(raw) {
    var d = freshSave();
    try {
      var s = raw ? JSON.parse(raw) : null;
      if (!s || typeof s !== 'object') return d;
      d.chapter = Math.floor(num(s.chapter, 0, 12, 0));
      d.circuit = Math.floor(num(s.circuit, 1, 99, 1));
      d.seed = num(s.seed, 0, 4294967295, 1) >>> 0;
      d.x = num(s.x, 0, 1e9, 0);
      d.y = num(s.y, -1000, 1000, 0);
      d.eggs = Math.floor(num(s.eggs, 0, MAX_EGGS, 0));
      d.score = Math.floor(num(s.score, 0, MAX_SCORE, 0));
      d.flock = Math.floor(num(s.flock !== undefined ? s.flock : s.ducklings, 0, 5, 0));
      d.shield = Math.floor(num(s.shield, 0, 1, 0));
      if (Array.isArray(s.cues)) d.cues = s.cues.filter(function (c) { return typeof c === 'string'; }).slice(0, 64);
      d.beaconLit = s.beaconLit === true;
    } catch (e) { d = freshSave(); }
    return d;
  }

  // Map a legacy (GitHub Pages) save onto the v2 shape, best effort.
  function parseLegacy(raw) {
    var d = null;
    try {
      var s = raw ? JSON.parse(raw) : null;
      if (!s || typeof s !== 'object') return null;
      d = freshSave();
      d.chapter = Math.floor(num(s.chapter !== undefined ? s.chapter : s.chapterIndex, 0, 12, 0));
      d.circuit = Math.floor(num(s.circuit, 1, 99, 1));
      d.seed = num(s.seed, 1, 4294967295, 1) >>> 0;
      d.x = num(s.x !== undefined ? s.x : s.checkpointX, 0, 1e9, 0);
      d.eggs = Math.floor(num(s.eggs, 0, MAX_EGGS, 0));
      d.score = Math.floor(num(s.score, 0, MAX_SCORE, 0));
      d.flock = Math.floor(num(s.flock !== undefined ? s.flock : s.ducklings, 0, 5, 0));
      d.shield = Math.floor(num(s.shield, 0, 1, 0));
      d.beaconLit = s.beaconLit === true || s.beacon === true;
    } catch (e) { return null; }
    return d;
  }

  function parseSettings(raw) {
    var d = freshSettings();
    try {
      var s = raw ? JSON.parse(raw) : null;
      if (s && typeof s === 'object') {
        if (s.sound === false) d.sound = false;
        if (s.music === false) d.music = false;
      }
    } catch (e) { d = freshSettings(); }
    return d;
  }

  // storage: something with getItem/setItem/removeItem (localStorage).
  function createProgress(storage) {
    var save = freshSave(), settings = freshSettings();
    var lastSeenSave = null, lastSeenSet = null;

    function read(key) {
      try {
        var raw = storage ? storage.getItem(key) : undefined;
        return (typeof raw === 'string' || raw === null) ? raw : undefined;
      } catch (e) { return undefined; }
    }
    function write(key, text) {
      try { if (storage) storage.setItem(key, text); } catch (e) { /* play on without saving */ }
    }

    function load() {
      var raw = read(KEY);
      if (raw) {
        save = parseSave(raw);
      } else {
        // No v2 save yet: carry over a legacy GitHub Pages save, if any.
        for (var i = 0; i < LEGACY_KEYS.length; i++) {
          var old = read(LEGACY_KEYS[i]);
          if (old) { var migrated = parseLegacy(old); if (migrated) { save = migrated; break; } }
        }
      }
      lastSeenSave = raw === undefined ? null : raw;
      var rs = read(KEY_SETTINGS);
      settings = parseSettings(rs);
      lastSeenSet = rs === undefined ? null : rs;
      return save;
    }

    // Two tabs: pick up what the other saved so neither wipes the other out.
    function sync() {
      var changed = false;
      var raw = read(KEY);
      if (raw !== undefined && raw !== lastSeenSave) { save = parseSave(raw); lastSeenSave = raw; changed = true; }
      var rs = read(KEY_SETTINGS);
      if (rs !== undefined && rs !== lastSeenSet) { settings = parseSettings(rs); lastSeenSet = rs; changed = true; }
      return changed;
    }

    function persistSave() {
      write(KEY, JSON.stringify(save));
      var now = read(KEY);
      if (now !== undefined) lastSeenSave = now;
    }
    function persistSettings() {
      write(KEY_SETTINGS, JSON.stringify(settings));
      var now = read(KEY_SETTINGS);
      if (now !== undefined) lastSeenSet = now;
    }

    load();
    return {
      save: function () { sync(); return save; },
      hasSave: function () { sync(); return save.eggs > 0 || save.score > 0 || save.x > 0 || save.chapter > 0 || save.beaconLit; },
      settings: function () { sync(); return settings; },
      // Called by the game at every checkpoint flag, chapter transition and
      // the beacon. `data` is engine.serialize() plus journal cues.
      record: function (data, cues) {
        sync();
        save = parseSave(JSON.stringify(data));
        if (Array.isArray(cues)) save.cues = cues.slice(0, 64);
        persistSave();
      },
      addCue: function (id) {
        sync();
        if (save.cues.indexOf(id) < 0) { save.cues.push(id); save.cues = save.cues.slice(0, 64); persistSave(); }
      },
      setSwitch: function (name, on) {
        sync();
        settings[name] = !!on;
        persistSettings();
      },
      // Start Over: replace the journey with a fresh one. Cancel never calls
      // this. Settings are kept (they are preferences, not progress).
      startOver: function () {
        sync();
        save = freshSave();
        try { if (storage) storage.removeItem(KEY); } catch (e) { /* nothing to erase */ }
        persistSave();
      }
    };
  }

  var api = { createProgress: createProgress, KEY: KEY, KEY_SETTINGS: KEY_SETTINGS, LEGACY_KEYS: LEGACY_KEYS };
  root.EM = root.EM || {};
  root.EM.progress = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
