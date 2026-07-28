const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const academyRoot = path.join(__dirname, '..', 'academy');
const html = fs.readFileSync(path.join(academyRoot, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(academyRoot, 'styles', 'academy.css'), 'utf8');
const motion = fs.readFileSync(
  path.join(academyRoot, 'scripts', 'academy-motion.js'),
  'utf8'
);

test('motion controller is frame-bounded and honors reduced motion', () => {
  assert.match(motion, /requestAnimationFrame/);
  assert.match(motion, /prefers-reduced-motion:\s*reduce/);
  assert.match(motion, /IntersectionObserver/);
  assert.doesNotMatch(motion, /setInterval/);
  assert.match(motion, /if \(framePending \|\| reduced \|\| document\.hidden\) return;/);
});

test('motion controller exposes an idempotent public API and pauses when hidden', () => {
  assert.match(motion, /window\.AcademyMotion\s*=\s*\{\s*init:\s*init\s*\}/);
  assert.match(motion, /if \(initialized\) return;/);
  assert.match(motion, /visibilitychange/);
  assert.match(motion, /is-motion-paused/);
});

test('each count-up node can start only once', () => {
  assert.match(motion, /if \(node\.dataset\.countStarted === 'true'\) return;/);
  assert.match(motion, /node\.dataset\.countStarted = 'true';/);
});

test('hero exposes the approved cinematic hooks without polluting accessible content', () => {
  assert.match(html, /<h1 id="academyHomeTitle"[^>]*>[\s\S]*취명선[\s\S]*명리학당[\s\S]*<\/h1>/);
  assert.equal((html.match(/data-parallax-layer/g) || []).length, 3);
  assert.equal((html.match(/class="academy-mist /g) || []).length, 2);
  assert.equal((html.match(/class="academy-orbit-node/g) || []).length, 9);
  assert.match(html, /class="academy-orbit"[^>]*aria-hidden="true"/);
  assert.match(html, /data-count="180"/);
  assert.match(html, /data-reveal/);
  assert.match(html, /기본 만세력 살펴보기/);
});

test('only mist and the nine-period orbit run continuously', () => {
  assert.match(css, /\.academy-mist\s*\{[^}]*animation:[^;}]*infinite/s);
  assert.match(css, /\.academy-orbit-ring\s*\{[^}]*animation:[^;}]*infinite/s);
  assert.equal((css.match(/\binfinite\b/g) || []).length, 2);
});

test('reduced motion fully disables parallax, rotation, ink, count-up, and reveals', () => {
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  for (const selector of [
    '.academy-mist',
    '.academy-orbit-ring',
    '[data-parallax-layer]',
    '.academy-title-ink',
    '[data-reveal]'
  ]) {
    assert.match(
      css,
      new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?:animation|transform|transition):\\s*none\\s*!important`)
    );
  }
  assert.match(motion, /if \(reduced\)\s*\{[\s\S]*revealImmediately\(\);[\s\S]*return;/);
});

test('reduced transparency receives an opaque paper fallback', () => {
  assert.match(css, /@media \(prefers-reduced-transparency:\s*reduce\)/);
  assert.match(css, /backdrop-filter:\s*none\s*!important/);
});
