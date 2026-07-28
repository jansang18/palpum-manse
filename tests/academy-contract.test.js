const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const academyPath = path.join(__dirname, '..', 'academy', 'index.html');
const html = fs.readFileSync(academyPath, 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'academy', 'styles', 'academy.css'), 'utf8');
const navigation = fs.readFileSync(
  path.join(__dirname, '..', 'academy', 'scripts', 'academy-nav.js'),
  'utf8'
);

test('academy exposes every approved section and mockup disclosure', () => {
  for (const id of [
    'academyHome',
    'academyCourses',
    'academyManse',
    'academyCases',
    'academyBoard',
    'academyPlans'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /실제 결제가 발생하지 않습니다/);
  assert.match(html, /prefers-reduced-motion/);
});

test('academy shell uses readable Korean and balanced semantic section markup', () => {
  for (const label of [
    '취명선 명리학당',
    '본문으로 건너뛰기',
    '기본 만세력',
    '질문 게시판'
  ]) {
    assert.match(html, new RegExp(label));
  }

  assert.doesNotMatch(html, /�|\?{2,}/);
  for (const tag of ['a', 'h2', 'p', 'section']) {
    assert.equal(
      (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'g')) || []).length,
      (html.match(new RegExp(`</${tag}>`, 'g')) || []).length,
      `${tag} elements must have matching closing tags`
    );
  }
});

test('academy reserves space for a fixed masthead and supports skip-link focus', () => {
  assert.match(html, /<main id="academyMain" tabindex="-1">/);
  assert.match(css, /--academy-masthead-height:/);
  assert.match(css, /\.academy-masthead\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /main\s*\{[^}]*padding-top:\s*var\(--academy-masthead-height\)/s);
  assert.match(navigation, /academyMain\.focus\(\{ preventScroll: true \}\)/);
});

test('academy navigation initialization is idempotent', () => {
  assert.match(navigation, /var initialized = false;/);
  assert.match(navigation, /if \(initialized\) return;/);
  assert.match(navigation, /initialized = true;/);
});

test('academy main keeps a visible focus treatment for skip-link users', () => {
  assert.doesNotMatch(css, /#academyMain:focus\s*\{\s*outline:\s*none;/);
  assert.match(css, /#academyMain:focus-visible\s*\{[^}]*outline:/s);
});

test('academy skip-link focus marker starts below the fixed masthead', () => {
  assert.match(css, /#academyMain:focus-visible::before\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /#academyMain:focus-visible::before\s*\{[^}]*top:\s*var\(--academy-masthead-height\)/s);
  assert.match(css, /#academyMain:focus-visible::before\s*\{[^}]*pointer-events:\s*none/s);
});

test('academy includes four curriculum tracks and safely disclosed mockup dialogs', () => {
  for (const title of [
    '명리의 기초',
    '사주 원국 읽기',
    '대운·세운·월운',
    '삼원구운과 시대 해석'
  ]) {
    assert.match(html, new RegExp(title));
  }

  for (const dialogId of ['courseDialog', 'boardDialog', 'paymentDialog']) {
    assert.match(html, new RegExp(`id="${dialogId}"`));
  }

  assert.match(html, /실제 결제가 발생하지 않습니다/);
  assert.match(html, /작성 내용은 저장되지 않습니다/);
  assert.match(html, /scripts\/academy-mockups\.js/);
  assert.match(
    fs.readFileSync(path.join(__dirname, '..', 'academy', 'scripts', 'academy-mockups.js'), 'utf8'),
    /window\.AcademyMockups\s*=/
  );
});
