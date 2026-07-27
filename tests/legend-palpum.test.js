const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PALPUM_DEFINITIONS,
  classifyPalpum
} = require('../scripts/legend-palpum.js');

const boundaries = [
  { name: '동지', instantMs: 0 },
  { name: '입춘', instantMs: 1000 },
  { name: '춘분', instantMs: 2000 },
  { name: '입하', instantMs: 3000 },
  { name: '하지', instantMs: 4000 },
  { name: '입추', instantMs: 5000 },
  { name: '추분', instantMs: 6000 },
  { name: '입동', instantMs: 7000 },
  { name: '동지', instantMs: 8000 }
];

test('defines the eight Palpum segments and their public rulers', () => {
  assert.deepEqual(
    PALPUM_DEFINITIONS.map(({ type, startTerm, endTerm, ruler }) => ({
      type, startTerm, endTerm, ruler
    })),
    [
      { type: '자축품', startTerm: '동지', endTerm: '입춘', ruler: '계수' },
      { type: '인묘품', startTerm: '입춘', endTerm: '춘분', ruler: '갑목' },
      { type: '묘진품', startTerm: '춘분', endTerm: '입하', ruler: '을목' },
      { type: '사오품', startTerm: '입하', endTerm: '하지', ruler: '병화' },
      { type: '오미품', startTerm: '하지', endTerm: '입추', ruler: '정화' },
      { type: '신유품', startTerm: '입추', endTerm: '추분', ruler: '경금' },
      { type: '유술품', startTerm: '추분', endTerm: '입동', ruler: '신금' },
      { type: '해자품', startTerm: '입동', endTerm: '동지', ruler: '임수' }
    ]
  );
  assert.equal(Object.isFrozen(PALPUM_DEFINITIONS), true);
});

test('uses an inclusive start and exclusive end at every boundary', () => {
  assert.equal(classifyPalpum({ instantMs: 999, boundaries }).type, '자축품');
  assert.equal(classifyPalpum({ instantMs: 1000, boundaries }).type, '인묘품');
  assert.equal(classifyPalpum({ instantMs: 4999, boundaries }).type, '오미품');
  assert.equal(classifyPalpum({ instantMs: 5000, boundaries }).type, '신유품');
  assert.equal(classifyPalpum({ instantMs: 7000, boundaries }).type, '해자품');
});

test('does not guess when an unknown birth time can cross a boundary', () => {
  const result = classifyPalpum({
    instantMs: 1000,
    boundaries,
    unknownTime: true,
    possibleRange: { startMs: 500, endMs: 1499 }
  });
  assert.equal(result.boundaryUncertain, true);
  assert.deepEqual(result.candidates, ['자축품', '인묘품']);
});

test('preserves historical approximation accuracy', () => {
  assert.equal(classifyPalpum({
    instantMs: 2500,
    boundaries,
    accuracy: 'historical-approximation'
  }).accuracy, 'historical-approximation');
});
