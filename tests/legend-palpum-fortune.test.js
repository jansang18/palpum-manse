const test = require('node:test');
const assert = require('node:assert/strict');
const {
  composePalpumFortune
} = require('../scripts/legend-palpum-fortune.js');

const RESULT_KEYS = [
  'version',
  'state',
  'headline',
  'opportunity',
  'burden',
  'preparation',
  'areas',
  'evidence',
  'tags'
];
const AREA_KEYS = ['relationship', 'career', 'money', 'health'];

function fixtureInput(overrides = {}) {
  return {
    palpum: {
      type: '신유품',
      ruler: '경금',
      accuracy: 'exact',
      candidates: ['신유품'],
      boundaryUncertain: false
    },
    saju: {
      yStem: 6,
      yBranch: 8,
      mStem: 4,
      mBranch: 10,
      dStem: 0,
      dBranch: 2,
      hStem: 2,
      hBranch: 6,
      ohaeng: [2, 2, 2, 2, 0]
    },
    daeun: { stem: 0, branch: 2 },
    annual: { year: 2026, stem: 2, branch: 6 },
    monthly: null,
    target: { year: 2026, month: null, stem: 2, branch: 6 },
    era: { yun: 9, element: '화', symbol: '빛' },
    ...overrides
  };
}

test('returns role-led sections and at least three distinct evidence layers', () => {
  const result = composePalpumFortune(fixtureInput());

  assert.deepEqual(Object.keys(result), RESULT_KEYS);
  assert.deepEqual(Object.keys(result.areas), AREA_KEYS);
  assert.equal(result.version, 'palpum-v1');
  assert.match(result.headline, /역할|기준|성과/);
  assert.ok(['발현', '전환', '조율', '축적'].includes(result.state));
  assert.equal(typeof result.opportunity, 'string');
  assert.equal(typeof result.burden, 'string');
  assert.equal(typeof result.preparation, 'string');
  assert.deepEqual(
    new Set(result.evidence.map(item => item.kind)),
    new Set(['팔품', '대운', '세운', '시대'])
  );
  assert.doesNotMatch(JSON.stringify(result), /월운/);
});

test('explicit timing layers ignore the deprecated collapsed target', () => {
  const first = composePalpumFortune(fixtureInput({
    annual: { year: 2026, stem: 6, branch: 8 },
    target: { year: 1900, month: 1, stem: 2, branch: 6 }
  }));
  const second = composePalpumFortune(fixtureInput({
    annual: { year: 2026, stem: 6, branch: 8 },
    target: { year: 2099, month: 12, stem: 0, branch: 2 }
  }));

  assert.deepEqual(first, second);
});

test('selects bounded states from ruler visibility, timing, and weak-era context', () => {
  const manifest = composePalpumFortune(fixtureInput({
    annual: { year: 2026, stem: 6, branch: 8 }
  }));
  const transition = composePalpumFortune(fixtureInput({
    annual: { year: 2026, stem: 2, branch: 6 }
  }));
  const adjust = composePalpumFortune(fixtureInput({
    annual: { year: 2026, stem: 0, branch: 2 },
    era: { yun: 9, element: '화', symbol: '빛' }
  }));
  const accumulate = composePalpumFortune(fixtureInput({
    annual: { year: 2026, stem: 0, branch: 2 },
    era: { yun: 8, element: '토', symbol: '산' }
  }));

  assert.equal(manifest.state, '발현');
  assert.equal(transition.state, '전환');
  assert.equal(adjust.state, '조율');
  assert.equal(accumulate.state, '축적');
});

test('does not call strong timing 발현 when the ruler is absent from the natal chart', () => {
  const result = composePalpumFortune(fixtureInput({
    saju: {
      yStem: 0,
      yBranch: 2,
      mStem: 2,
      mBranch: 6,
      dStem: 4,
      dBranch: 10,
      hStem: 8,
      hBranch: 11,
      ohaeng: [2, 2, 2, 0, 2]
    },
    annual: { year: 2026, stem: 6, branch: 8 },
    era: { yun: 8, element: '토', symbol: '산' }
  }));

  assert.equal(result.state, '축적');
});

test('same-element opposite-polarity presence cannot satisfy the exact-ruler gate', () => {
  const result = composePalpumFortune(fixtureInput({
    saju: {
      yStem: 7,
      yBranch: 1,
      mStem: 4,
      mBranch: 10,
      dStem: 0,
      dBranch: 7,
      hStem: 2,
      hBranch: 0,
      ohaeng: [2, 2, 2, 2, 0]
    },
    annual: { year: 2026, stem: 6, branch: 8 },
    era: { yun: 8, element: '토', symbol: '산' }
  }));
  const palpumEvidence = result.evidence.find(item => item.kind === '팔품');

  assert.notEqual(result.state, '발현');
  assert.match(palpumEvidence.detail, /당령 흔적은 0곳/);
  assert.match(palpumEvidence.detail, /같은 오행.*2/);
});

test('a ruler in a secondary hidden stem satisfies the exact-ruler gate once', () => {
  const result = composePalpumFortune(fixtureInput({
    saju: {
      yStem: 0,
      yBranch: 9,
      mStem: 2,
      mBranch: 0,
      dStem: 4,
      dBranch: 7,
      hStem: 8,
      hBranch: 11,
      ohaeng: [2, 1, 2, 1, 2]
    },
    annual: { year: 2026, stem: 6, branch: 8 },
    era: { yun: 8, element: '토', symbol: '산' }
  }));
  const palpumEvidence = result.evidence.find(item => item.kind === '팔품');

  assert.equal(result.state, '발현');
  assert.match(palpumEvidence.detail, /당령 흔적은 1곳/);
});

test('a ruler in a residual hidden stem satisfies the exact-ruler gate once', () => {
  const result = composePalpumFortune(fixtureInput({
    saju: {
      yStem: 0,
      yBranch: 5,
      mStem: 2,
      mBranch: 0,
      dStem: 4,
      dBranch: 7,
      hStem: 8,
      hBranch: 11,
      ohaeng: [2, 2, 2, 1, 1]
    },
    annual: { year: 2026, stem: 6, branch: 8 },
    era: { yun: 8, element: '토', symbol: '산' }
  }));
  const palpumEvidence = result.evidence.find(item => item.kind === '팔품');

  assert.equal(result.state, '발현');
  assert.match(palpumEvidence.detail, /당령 흔적은 1곳/);
});

for (const layer of [
  { input: 'daeun', kind: '대운' },
  { input: 'annual', kind: '세운' },
  { input: 'monthly', kind: '월운' }
]) {
  test(`changing only ${layer.kind} changes its evidence and bounded state`, () => {
    const neutral = { stem: 0, branch: 2 };
    const supportive = { stem: 6, branch: 8 };
    const burdensome = { stem: 2, branch: 6 };
    const base = {
      daeun: neutral,
      annual: { year: 2026, ...neutral },
      monthly: layer.input === 'monthly' ? { year: 2026, month: 8, ...neutral } : null,
      era: { yun: 8, element: '토', symbol: '산' }
    };
    const withLayer = pillar => composePalpumFortune(fixtureInput({
      ...base,
      [layer.input]: layer.input === 'annual'
        ? { year: 2026, ...pillar }
        : layer.input === 'monthly'
          ? { year: 2026, month: 8, ...pillar }
          : pillar
    }));
    const supported = withLayer(supportive);
    const burdened = withLayer(burdensome);
    const supportedEvidence = supported.evidence.find(item => item.kind === layer.kind);
    const burdenedEvidence = burdened.evidence.find(item => item.kind === layer.kind);

    assert.equal(supported.state, '발현');
    assert.equal(burdened.state, '전환');
    assert.notEqual(supportedEvidence.detail, burdenedEvidence.detail);
    assert.match(supportedEvidence.detail, /관계 신호 2/);
    assert.match(burdenedEvidence.detail, /관계 신호 -2/);
  });
}

test('changing only the era changes context evidence but not a strong timing state', () => {
  const strongTiming = {
    annual: { year: 2026, stem: 6, branch: 8 }
  };
  const fireEra = composePalpumFortune(fixtureInput({
    ...strongTiming,
    era: { yun: 9, element: '화', symbol: '빛' }
  }));
  const waterEra = composePalpumFortune(fixtureInput({
    ...strongTiming,
    era: { yun: 1, element: '수', symbol: '심연' }
  }));
  const fireEvidence = fireEra.evidence.find(item => item.kind === '시대');
  const waterEvidence = waterEra.evidence.find(item => item.kind === '시대');

  assert.equal(fireEra.state, '발현');
  assert.equal(fireEra.state, waterEra.state);
  assert.notEqual(fireEvidence.detail, waterEvidence.detail);
  assert.match(fireEvidence.detail, /시대 배경/);
  assert.match(waterEvidence.detail, /시대 배경/);
});

test('uses shared language and asks for birth time at an uncertain Palpum boundary', () => {
  const result = composePalpumFortune(fixtureInput({
    palpum: {
      type: '자축품',
      ruler: '계수',
      accuracy: 'exact',
      candidates: ['자축품', '인묘품'],
      boundaryUncertain: true
    }
  }));
  const palpumEvidence = result.evidence.find(item => item.kind === '팔품');

  assert.deepEqual(Object.keys(result), RESULT_KEYS);
  assert.deepEqual(Object.keys(result.areas), AREA_KEYS);
  assert.equal(result.state, '축적');
  assert.match(result.headline, /팔품 경계.*공통 역할/);
  assert.doesNotMatch(result.headline, /자축품의|인묘품의/);
  assert.equal(palpumEvidence.label, '자축품 · 인묘품 후보');
  assert.match(palpumEvidence.detail, /출생 시각.*확인/);
  assert.doesNotMatch(JSON.stringify(result), /당령 계수/);
  assert.doesNotMatch(JSON.stringify(result), /대운/);
  assert.ok(result.tags.includes('자축품'));
  assert.ok(result.tags.includes('인묘품'));
});

test('discloses historical approximation without presenting it as exact', () => {
  const result = composePalpumFortune(fixtureInput({
    palpum: {
      type: '신유품',
      ruler: '경금',
      accuracy: 'historical-approximation',
      candidates: ['신유품'],
      boundaryUncertain: false
    }
  }));

  assert.match(JSON.stringify(result), /역사 범위 근사/);
});

test('provides distinct creative observations for every Palpum', () => {
  const palpums = [
    ['자축품', '계수'],
    ['인묘품', '갑목'],
    ['묘진품', '을목'],
    ['사오품', '병화'],
    ['오미품', '정화'],
    ['신유품', '경금'],
    ['유술품', '신금'],
    ['해자품', '임수']
  ];
  const results = palpums.map(([type, ruler]) => composePalpumFortune(fixtureInput({
    palpum: {
      type,
      ruler,
      accuracy: 'exact',
      candidates: [type],
      boundaryUncertain: false
    }
  })));

  assert.equal(new Set(results.map(result => result.opportunity)).size, 8);
  for (const result of results) {
    assert.deepEqual(Object.keys(result.areas), AREA_KEYS);
    assert.ok(Object.values(result.areas).every(value => (
      typeof value === 'string' && value.length > 0
    )));
    assert.ok(result.tags.includes('취명선 창작 해석'));
    assert.ok(result.tags.includes('비공식 해석'));
  }
});

test('is deterministic, immutable, and does not mutate its input', () => {
  const input = fixtureInput();
  const before = structuredClone(input);
  const first = composePalpumFortune(input);
  const second = composePalpumFortune(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.areas), true);
  assert.equal(Object.isFrozen(first.evidence), true);
  assert.equal(Object.isFrozen(first.tags), true);
});
