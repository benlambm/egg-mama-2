/*
 * The shell of the app: the offline worker's file list matches what is on
 * disk, the manifest is a landscape PWA, index.html only references files
 * that exist, and the view keeps a full jump on screen on phone sizes.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const VIEW = require('../js/view.js');
const T = require('../js/tuning.js');

const ROOT = path.join(__dirname, '..');

function swFiles() {
  const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const sandbox = { self: {}, caches: {}, Request: function () { }, console };
  vm.createContext(sandbox);
  // pull PREFIX/VERSION/FILES out of the file without running listeners
  const m = src.match(/const FILES = \[([\s\S]*?)\];/);
  assert.ok(m, 'sw.js has a FILES list');
  const files = eval('[' + m[1] + ']');
  const v = src.match(/const VERSION = PREFIX \+ '([^']+)'/);
  const p = src.match(/const PREFIX = '([^']+)'/);
  return { files, version: v[1], prefix: p[1] };
}

test('sw.js FILES match the files on disk', () => {
  const { files, prefix, version } = swFiles();
  assert.ok(prefix.startsWith('egg-mama-2-') && version.length > 0);
  for (const f of files) {
    if (f === './') continue;
    assert.ok(fs.existsSync(path.join(ROOT, f)), 'cached file exists: ' + f);
  }
  // every shipped game file is in the list (so offline play is complete)
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '.git' ? [] : walk(p);
    return [path.relative(ROOT, p)];
  });
  const skip = /^(tests|tools|docs)\//;
  const onDisk = walk(ROOT).filter(f => !skip.test(f) && !f.endsWith('.md') && f !== 'package.json' && f !== 'sw.js');
  for (const f of onDisk) assert.ok(files.includes('./' + f), 'sw.js caches ' + f);
});

test('manifest is a landscape PWA with icons that exist', () => {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.equal(man.orientation, 'landscape');
  assert.ok(man.display === 'fullscreen' || man.display_override.includes('fullscreen'));
  assert.equal(man.start_url, './index.html');
  for (const ic of man.icons) assert.ok(fs.existsSync(path.join(ROOT, ic.src)), ic.src);
});

test('index.html references only files that exist and loads the scripts in order', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]);
  for (const r of refs) {
    if (/^https?:/.test(r)) continue;
    assert.ok(fs.existsSync(path.join(ROOT, r)), 'exists: ' + r);
  }
  for (const js of ['tuning', 'levels', 'engine', 'progress', 'view', 'art', 'backdrops', 'audio', 'render', 'main']) {
    assert.ok(html.includes('js/' + js + '.js'), 'loads js/' + js + '.js');
  }
  assert.ok(html.includes('viewport-fit=cover'));
  assert.ok(html.includes('user-scalable=no'));
});

test('the view keeps Mama, a full jump and the landing on screen in landscape', () => {
  for (const [w, h] of [[844, 390], [740, 360], [932, 430], [1280, 720], [1920, 1080], [667, 375]]) {
    const L = VIEW.layout(w, h, T);
    const jumpTop = T.JUMP_SPEED * T.JUMP_SPEED / (2 * T.GRAVITY) + T.MAMA_H; // apex + body
    const topScreen = L.groundY - jumpTop * L.sp;
    assert.ok(topScreen > 0, `jump fits at ${w}x${h} (top ${topScreen.toFixed(0)})`);
    assert.ok(L.mamaX > 0 && L.mamaX < w);
    assert.ok(L.groundY < h && L.groundY > h * 0.5);
    // things appear at the same distance ahead on every screen size
    assert.equal(L.seeAhead, T.SEE_AHEAD);
  }
});

test('every chapter backdrop file exists and is referenced by exactly one chapter', () => {
  const LEVELS = require('../js/levels.js');
  const used = new Set();
  for (const ch of LEVELS.CHAPTERS) {
    assert.ok(fs.existsSync(path.join(ROOT, 'assets/bg', ch.bg)), ch.bg);
    assert.ok(!used.has(ch.bg));
    used.add(ch.bg);
  }
  assert.equal(used.size, 13);
});
