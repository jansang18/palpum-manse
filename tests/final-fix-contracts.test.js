const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const legendView = fs.readFileSync('scripts/legend-view.js', 'utf8');

test('advanced input exposes and persists all three day-boundary conventions', () => {
  assert.match(html, /<details[^>]+id="advancedCalculationSettings"/);
  assert.match(html, /id="segDayBoundary"[^>]+role="radiogroup"/);
  for (const value of ['midnight', 'jasi', 'splitJasi']) {
    assert.match(html, new RegExp(`data-val=["']${value}["']`));
  }
  assert.match(html, /palpum-manse:day-boundary/);
  assert.match(html, /dayBoundary:\s*getSelectedDayBoundary\(\)/);
  assert.match(
    html,
    /const\s+dayBoundary\s*=\s*input\.dayBoundary\s*===\s*undefined\s*\?\s*['"]midnight['"]\s*:\s*input\.dayBoundary/
  );
});

test('match lunar form exposes an accessible normal-or-leap choice and forwards it', () => {
  assert.match(html, /id="mnfLunarMonthTypeField"[^>]*hidden/);
  assert.match(html, /id="mnfLeapMonth"[^>]+role="radiogroup"/);
  assert.match(html, /aria-labelledby="mnfLeapMonthLabel"/);
  assert.match(html, /const\s+isLeapMonth\s*=\s*calendar\s*===\s*['"]lunar['"]/);
  assert.match(
    html,
    /calcSaju\(\{[^}]*calendar,[^}]*isLeapMonth,[^}]*gender,[^}]*unknown/s
  );
});

test('result and legend evidence distinguish KASI facts, heuristic interpretation, and creative rules', () => {
  for (const label of ['명리 계산 · KASI', '간이 용신 후보', '취명선 창작 규칙']) {
    assert.match(`${html}\n${legendView}`, new RegExp(label));
  }
  assert.match(legendView, /legend-evidence-kind/);
  assert.match(legendView, /support.*drain|supportCount.*drainCount/s);
});

test('public copy names the heuristic useful-element method instead of presenting it as settled yongsin', () => {
  assert.doesNotMatch(html, />용신 조화</);
  assert.doesNotMatch(html, /내 용신\(/);
  assert.match(html, /간이 용신 후보/);
});
