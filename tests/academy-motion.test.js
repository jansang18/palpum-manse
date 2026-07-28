const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const academyRoot = path.join(__dirname, '..', 'academy');
const html = fs.readFileSync(path.join(academyRoot, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(academyRoot, 'styles', 'academy.css'), 'utf8');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
);
const motion = fs.readFileSync(
  path.join(academyRoot, 'scripts', 'academy-motion.js'),
  'utf8'
);
const mockups = fs.readFileSync(
  path.join(academyRoot, 'scripts', 'academy-mockups.js'),
  'utf8'
);
const manse = fs.readFileSync(
  path.join(academyRoot, 'scripts', 'academy-manse.js'),
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

test('reenabling motion while the document is hidden restores the paused state', () => {
  const bodyClasses = new Set();
  let preferenceHandler = null;
  const classList = set => ({
    add: value => set.add(value),
    toggle: (value, enabled) => {
      if (enabled) set.add(value);
      else set.delete(value);
    }
  });
  const query = {
    matches: true,
    addEventListener: (type, handler) => {
      if (type === 'change') preferenceHandler = handler;
    }
  };
  const rootClasses = new Set();
  const root = {
    classList: classList(rootClasses),
    style: { setProperty() {} }
  };
  const hero = { style: { setProperty() {} } };
  const documentStub = {
    readyState: 'complete',
    hidden: true,
    documentElement: root,
    body: { classList: classList(bodyClasses) },
    addEventListener() {},
    getElementById: id => id === 'academyHome' ? hero : null,
    querySelectorAll: () => []
  };
  class IntersectionObserverStub {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
  const windowStub = {
    AcademyMotion: null,
    IntersectionObserver: IntersectionObserverStub,
    innerHeight: 800,
    innerWidth: 1280,
    matchMedia: () => query,
    addEventListener() {},
    removeEventListener() {},
    scrollY: 0
  };

  vm.runInNewContext(motion, {
    document: documentStub,
    IntersectionObserver: IntersectionObserverStub,
    Math,
    Number,
    requestAnimationFrame() {},
    window: windowStub
  });

  assert.equal(typeof preferenceHandler, 'function');
  preferenceHandler({ matches: false });
  assert.equal(bodyClasses.has('is-motion-paused'), true);
});

test('each count-up node can start only once', () => {
  assert.match(motion, /if \(node\.dataset\.countStarted === 'true'\) return;/);
  assert.match(motion, /node\.dataset\.countStarted = 'true';/);
});

test('hero exposes the approved cinematic hooks without polluting accessible content', () => {
  assert.match(html, /<h1 id="academyHomeTitle"[^>]*>[\s\S]*취명선[\s\S]*명리학당[\s\S]*<\/h1>/);
  assert.equal((html.match(/class="academy-season-scene/g) || []).length, 4);
  assert.equal((html.match(/data-parallax-layer/g) || []).length, 4);
  assert.equal((html.match(/class="academy-mist /g) || []).length, 2);
  assert.doesNotMatch(html, /academy-orbit|academy-orbit-node|academy-orbit-core/);
  assert.match(html, /data-count="180"/);
  assert.match(html, /data-reveal/);
  assert.match(html, />내 사주 펼쳐보기<\/a>/);
  assert.match(html, /class="academy-scroll-guide"/);
  assert.match(html, /class="academy-hero-seal"[^>]*data-seal-stamp/);
});

test('academy requests only modules that are now implemented', () => {
  assert.match(html, /academy-manse\.js/);
  assert.match(html, /academy-mockups\.js/);
});

test('high-frequency parallax properties are scoped to the academy hero', () => {
  const rootRule = css.match(/:root\s*\{([^}]*)\}/s)?.[1] || '';
  const heroRule = css.match(/\.academy-home\s*\{([^}]*)\}/s)?.[1] || '';
  for (const property of ['--pointer-x', '--pointer-y', '--scroll-depth']) {
    assert.doesNotMatch(rootRule, new RegExp(property));
    assert.match(heroRule, new RegExp(`${property}:\\s*0`));
    assert.match(motion, new RegExp(`hero\\.style\\.setProperty\\('${property}'`));
    assert.doesNotMatch(motion, new RegExp(`root\\.style\\.setProperty\\('${property}'`));
  }
});

test('normal npm test gate keeps existing suites and adds academy browser regression', () => {
  assert.equal(packageJson.scripts['test:core'], 'node --test tests/*.test.js');
  assert.equal(packageJson.scripts['test:ui'], 'node tests/ui-regression.js');
  assert.equal(packageJson.scripts['test:academy-ui'], 'node tests/academy-ui.js');
  assert.match(packageJson.scripts['test:academy-manse'], /academy-manse/);
  assert.match(packageJson.scripts['test:academy-dialogs'], /academy-dialogs/);
  assert.match(packageJson.scripts.test, /npm run test:core/);
  assert.match(packageJson.scripts.test, /npm run test:ui/);
  assert.match(packageJson.scripts.test, /npm run test:academy-ui/);
  assert.match(packageJson.scripts.test, /npm run test:academy-manse/);
  assert.match(packageJson.scripts.test, /npm run test:academy-dialogs/);
});

test('only mist runs infinitely while seasonal drift completes within each scene', () => {
  assert.match(css, /\.academy-mist\s*\{[^}]*animation:[^;}]*infinite/s);
  assert.match(
    css,
    /\.academy-season-scene\.is-active\s+img\s*\{[^}]*animation:\s*academy-season-drift[^;}]*both/s
  );
  assert.equal((css.match(/\binfinite\b/g) || []).length, 1);
  assert.doesNotMatch(motion, /setInterval/);
  assert.match(motion, /setTimeout/);
});

test('approved one-shot motion hooks cover seal, course, pillar, and dialog paper', () => {
  assert.match(css, /\.academy-hero-seal\s*\{[^}]*animation:\s*academy-seal-stamp/s);
  assert.match(css, /\.academy-course-card\.is-paper-opening\s*\{[^}]*animation:\s*academy-paper-unfold/s);
  assert.match(css, /\.academy-pillar-card\.is-pillar-revealed\s*\{[^}]*animation:\s*academy-pillar-drop/s);
  assert.match(css, /\.academy-pillar-card\.is-pillar-revealed::after\s*\{[^}]*animation:\s*academy-ink-bloom/s);
  assert.match(css, /\.academy-dialog\[open\]\s+\.academy-dialog-paper\s*\{[^}]*animation:\s*academy-dialog-open/s);
  assert.match(mockups, /is-paper-opening/);
  assert.match(manse, /is-pillar-revealed/);
});

test('Manseryeok focus and open results pause decorative continuous motion', () => {
  assert.match(motion, /focusin/);
  assert.match(motion, /focusout/);
  assert.match(motion, /academy:manse-result/);
  assert.match(motion, /is-manse-engaged/);
  assert.match(
    css,
    /\.is-manse-engaged\s+\.academy-mist[\s\S]*animation-play-state:\s*paused/
  );
  assert.match(
    css,
    /\.is-manse-engaged\s+\.academy-season-scene\.is-active\s+img[\s\S]*animation-play-state:\s*paused/
  );
  assert.match(motion, /slideshowHovered/);
  assert.match(motion, /slideshowFocused/);
  assert.match(motion, /document\.hidden/);
  assert.match(motion, /syncSlideshow/);
});

test('reduced motion fixes the first seasonal scene and disables all motion', () => {
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  for (const selector of [
    '.academy-mist',
    '.academy-season-scene',
    '.academy-season-scene img',
    '[data-parallax-layer]',
    '.academy-title-ink',
    '.academy-hero-seal',
    '.academy-scroll-guide',
    '.academy-course-card.is-paper-opening',
    '.academy-pillar-card.is-pillar-revealed',
    '.academy-pillar-card.is-pillar-revealed::after',
    '.academy-dialog[open] .academy-dialog-paper',
    '[data-reveal]'
  ]) {
    assert.match(
      css,
      new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?:animation|transform|transition):\\s*none\\s*!important`)
    );
  }
  assert.match(motion, /if \(reduced\)\s*\{[\s\S]*activateSeason\(0/);
  assert.match(motion, /seasonControls\.forEach[\s\S]*control\.disabled = reduced/);
});

test('reduced transparency receives an opaque paper fallback', () => {
  assert.match(css, /@media \(prefers-reduced-transparency:\s*reduce\)/);
  assert.match(css, /backdrop-filter:\s*none\s*!important/);
});
