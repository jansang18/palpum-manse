const test = require('node:test');
const assert = require('node:assert/strict');
const { buildNarrative } = require('../scripts/legend-copy.js');

const EXPECTED_SECTIONS = [
  ['day-master', '命', '나를 이루는 중심'],
  ['pillars', '柱', '네 기둥의 역할'],
  ['balance', '衡', '오행의 균형'],
  ['ten-gods', '神', '십신의 언어'],
  ['interactions', '合', '합과 충의 구조'],
  ['symbols', '星', '신살과 공망'],
  ['era', '時', '시대와 나'],
  ['daeun', '運', '대운의 계절'],
  ['year', '歲', '세운의 장면'],
  ['month', '月', '월운의 초점'],
  ['day', '日', '일운의 선택'],
  ['hour', '刻', '시운의 문'],
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
    ...result.highlights,
    ...result.sections.flatMap((section) => Object.values(section))
  ];
}

function richContext(overrides = {}) {
  return {
    name: '홍길동',
    era: { yun: 9, element: '화', symbol: '빛' },
    resonance: {
      relation: '생조',
      score: 78,
      provenance: {
        usefulElement: '목',
        supportCount: 3,
        drainCount: 5,
        usefulRationale: '일간을 돕는 목을 간이 후보로 삼았습니다.'
      }
    },
    profile: {
      dayMaster: {
        ganji: '丁酉',
        stem: '丁',
        stemKorean: '정',
        branch: '酉',
        element: '화',
        yinYang: '음'
      },
      pillars: [
        { label: '연주', ganji: '癸酉', stemTenGod: '편관', branchTenGod: '편재' },
        { label: '월주', ganji: '乙卯', stemTenGod: '편인', branchTenGod: '편인' },
        { label: '일주', ganji: '丁酉', stemTenGod: '일간', branchTenGod: '편재' },
        { label: '시주', ganji: '甲辰', stemTenGod: '정인', branchTenGod: '상관' }
      ],
      elements: { 목: 2, 화: 1, 토: 1, 금: 3, 수: 1 },
      dominantElement: '금',
      weakElements: ['화', '토', '수'],
      interactions: {
        harmony: ['연·일 육합'],
        tension: ['월·일 충']
      },
      symbols: ['천을귀인', '문창귀인', '도화'],
      voidBranches: ['寅', '卯'],
      unknownTime: false
    },
    timing: {
      daeun: { ganji: '庚申', age: 27, stemTenGod: '정재', branchTenGod: '정재' },
      year: { label: '2026년', ganji: '丙午', stemTenGod: '겁재', branchTenGod: '비견' },
      month: { label: '7월', ganji: '乙未', stemTenGod: '편인', branchTenGod: '식신' },
      day: { label: '2026.07.27', ganji: '壬寅', stemTenGod: '정관', branchTenGod: '정인' },
      hour: { count: 12, focus: '12개 시진을 비교해 선택합니다.' }
    },
    ...overrides
  };
}

test('builds seventeen grouped data-bound sections without HTML', () => {
  const result = buildNarrative({
    ...richContext(),
    name: '<img src=x onerror=alert(1)>'
  });

  assert.match(result.heroTitle, /빛의 시대/);
  assert.equal(result.sections.length, 17);
  assert.equal(result.highlights.length, 3);
  assert.deepEqual(
    result.sections.map(({ key, hanja, title }) => [key, hanja, title]),
    EXPECTED_SECTIONS
  );
  assert.deepEqual([...new Set(result.sections.map(section => section.group))], [
    '명식의 뼈대',
    '시간의 작용',
    '삶의 주제'
  ]);
  assert.deepEqual([...new Set(result.sections.map(section => section.source))], [
    '명리 계산',
    '간이 해석',
    '전통 표지',
    '창작 공명'
  ]);
  const copy = allStrings(result).join(' ');
  assert.match(copy, /丁酉/);
  assert.match(copy, /금 3/);
  assert.match(copy, /편관/);
  assert.match(copy, /월·일 충/);
  assert.match(copy, /천을귀인/);
  assert.match(copy, /庚申/);
  assert.match(copy, /2026\.07\.27/);
  assert.ok(result.sections.every((section) => (
    Object.values(section).every((value) => typeof value === 'string')
    && section.summary.length > 0
    && section.body.length > 0
  )));
  assert.equal(allStrings(result).some((value) => /[<>"'&/=`]/.test(value)), false);
});

test('removes control characters and HTML delimiters and caps names at 40 characters', () => {
  const result = buildNarrative({
    ...richContext(),
    name: `가<>&"'\/=\`\u0000\u001f\u007f나${'다'.repeat(50)}`,
    resonance: { relation: '동조', score: 100 }
  });
  const renderedName = result.heroTitle.replace('빛의 시대에 선 ', '');

  assert.equal(renderedName, `가나${'다'.repeat(38)}`);
  assert.equal(Array.from(renderedName).length, 40);
  assert.equal(/[<>"'&/=`\u0000-\u001f\u007f-\u009f]/.test(renderedName), false);
});

test('uses 당신 for blank or punctuation-only names and preserves real Korean and Latin names', () => {
  const context = richContext({ resonance: { relation: '동조', score: 80 } });

  for (const name of ['', '   ', '???', '... !', '···', '()[]{}']) {
    assert.equal(
      buildNarrative({ ...context, name }).heroTitle,
      '빛의 시대에 선 당신'
    );
  }

  for (const name of ['홍길동', 'Jane Doe', 'A-민']) {
    assert.equal(
      buildNarrative({ ...context, name }).heroTitle,
      `빛의 시대에 선 ${name}`
    );
  }
});

test('preserves a deferred relation without claiming alignment', () => {
  for (const resonance of [
    { relation: '판단 보류', score: 0 },
    {}
  ]) {
    const result = buildNarrative({
      ...richContext(),
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
    assert.equal(result.highlights.length, 3);
    assert.equal(result.sections.length, 17);
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

test('does not invent an hour pillar when birth time is unknown', () => {
  const context = richContext();
  context.profile.unknownTime = true;
  context.profile.pillars[3] = {
    label: '시주',
    ganji: '時未詳',
    stemTenGod: '미상',
    branchTenGod: '미상'
  };

  const result = buildNarrative(context);
  const hourCopy = result.sections.find(section => section.key === 'hour');
  const pillarCopy = result.sections.find(section => section.key === 'pillars');

  assert.match(`${hourCopy.summary} ${hourCopy.body}`, /출생시각 미상/);
  assert.match(`${pillarCopy.summary} ${pillarCopy.body}`, /時未詳/);
  assert.doesNotMatch(`${hourCopy.summary} ${hourCopy.body}`, /태어난 시주의 십신/);
});
