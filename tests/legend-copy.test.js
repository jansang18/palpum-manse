const test = require('node:test');
const assert = require('node:assert/strict');
const { buildNarrative } = require('../scripts/legend-copy.js');

const EXPECTED_SECTIONS = [
  ['era', '時', '시대와 나'],
  ['work', '業', '일과 역할'],
  ['wealth', '財', '재물과 기반'],
  ['relation', '情', '관계와 마음'],
  ['rhythm', '身', '몸과 리듬'],
  ['action', '行', '이번 운의 한 수']
];

function allStrings(result) {
  return [
    result.heroTitle,
    result.heroSummary,
    ...result.sections.flatMap((section) => Object.values(section))
  ];
}

test('builds six structured plain-string sections without HTML', () => {
  const result = buildNarrative({
    name: '<img src=x onerror=alert(1)>',
    era: { yun: 9, element: '화', symbol: '빛' },
    resonance: { relation: '생조', score: 78 }
  });

  assert.match(result.heroTitle, /빛의 시대/);
  assert.equal(result.sections.length, 6);
  assert.deepEqual(
    result.sections.map(({ key, hanja, title }) => [key, hanja, title]),
    EXPECTED_SECTIONS
  );
  assert.ok(result.sections.every((section) => (
    Object.values(section).every((value) => typeof value === 'string')
    && section.summary.length > 0
    && section.body.length > 0
  )));
  assert.equal(allStrings(result).some((value) => /[<>"'&/=`]/.test(value)), false);
});

test('removes control characters and HTML delimiters and caps names at 40 characters', () => {
  const result = buildNarrative({
    name: `가<>&"'\/=\`\u0000\u001f\u007f나${'다'.repeat(50)}`,
    era: { yun: 9, element: '화', symbol: '빛' },
    resonance: { relation: '동조', score: 100 }
  });
  const renderedName = result.heroTitle.replace('빛의 시대에 선 ', '');

  assert.equal(renderedName, `가나${'다'.repeat(38)}`);
  assert.equal(Array.from(renderedName).length, 40);
  assert.equal(/[<>"'&/=`\u0000-\u001f\u007f-\u009f]/.test(renderedName), false);
});

test('preserves a deferred relation without claiming alignment', () => {
  for (const resonance of [
    { relation: '판단 보류', score: 0 },
    {}
  ]) {
    const result = buildNarrative({
      name: '홍길동',
      era: { yun: 9, element: '화', symbol: '빛' },
      resonance
    });
    const copy = allStrings(result).join(' ');

    assert.match(result.heroSummary, /관계는 판단 보류/);
    assert.match(copy, /정보/);
    assert.doesNotMatch(copy, /동조|나란히 흐릅니다|관계를 이룹니다/);
    assert.doesNotMatch(copy, /공명도(?:는)? \d+점/);
  }
});

test('returns safe defaults for malformed or missing context', () => {
  for (const context of [
    undefined,
    null,
    {},
    {
      name: { toString: () => '<script>' },
      era: { yun: Number.NaN, element: '<화>', symbol: '<빛>' },
      resonance: { relation: '<제어>', score: Number.NaN }
    }
  ]) {
    const result = buildNarrative(context);
    assert.equal(typeof result.heroTitle, 'string');
    assert.equal(typeof result.heroSummary, 'string');
    assert.equal(result.sections.length, 6);
    assert.equal(
      allStrings(result).some((value) => /undefined|NaN|[<>"'&/=`]/.test(value)),
      false
    );
    assert.deepEqual(
      result.sections.map(({ key, hanja, title }) => [key, hanja, title]),
      EXPECTED_SECTIONS
    );
  }
});
