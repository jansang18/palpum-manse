const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateResonance } = require('../scripts/legend-resonance.js');

test('returns a transparent five-part score', () => {
  const result = calculateResonance({
    eraElement: '화',
    dayElement: '목',
    usefulElement: '화',
    elements: { 목: 3, 화: 0, 토: 2, 금: 2, 수: 1 },
    daeunElement: '목',
    shortElement: '토'
  });

  assert.equal(result.relation, '표출');
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(result.parts).map(([key, part]) => [key, part.max])
    ),
    { useful: 35, day: 25, balance: 20, daeun: 15, short: 5 }
  );
  assert.equal(
    result.score,
    Object.values(result.parts).reduce((sum, part) => sum + part.score, 0)
  );
  assert.match(result.parts.useful.reason, /용신 후보/);
  assert.ok(
    Object.values(result.parts).every((part) => (
      Number.isFinite(part.score)
      && part.score >= 0
      && part.score <= part.max
      && typeof part.reason === 'string'
      && part.reason.length > 0
    ))
  );
});

test('classifies all five element relations from the person toward the era', () => {
  const relationForDayElement = (dayElement) => calculateResonance({
    eraElement: '화',
    dayElement,
    usefulElement: '수',
    elements: { 목: 1, 화: 1, 토: 1, 금: 1, 수: 1 }
  }).relation;

  assert.equal(relationForDayElement('화'), '동조');
  assert.equal(relationForDayElement('토'), '생조');
  assert.equal(relationForDayElement('목'), '표출');
  assert.equal(relationForDayElement('금'), '압력');
  assert.equal(relationForDayElement('수'), '제어');
});

test('gives the declared deterministic score for a fully aligned context', () => {
  const result = calculateResonance({
    eraElement: '화',
    dayElement: '화',
    usefulElement: '화',
    elements: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 8 },
    daeunElement: '화',
    shortElement: '화'
  });

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(result.parts).map(([key, part]) => [key, part.score])
    ),
    { useful: 35, day: 25, balance: 20, daeun: 15, short: 5 }
  );
  assert.equal(result.score, 100);
});

test('uses natural Korean particles in score reasons', () => {
  const result = calculateResonance({
    eraElement: '화',
    dayElement: '목',
    usefulElement: '화',
    elements: { 목: 3, 화: 0, 토: 2, 금: 2, 수: 1 },
    daeunElement: '목',
    shortElement: '토'
  });

  assert.match(result.parts.useful.reason, /화와 시대 오행 화의/);
  assert.match(result.parts.day.reason, /목과 시대 오행 화의/);
  assert.match(result.parts.balance.reason, /시대 오행 화는/);
  assert.match(result.parts.short.reason, /토와 시대 오행 화의/);
});

test('defers the relation and identifies each missing required input', () => {
  const missingEra = calculateResonance({
    dayElement: '목',
    usefulElement: '화',
    elements: { 목: 1, 화: 1, 토: 1, 금: 1, 수: 1 },
    daeunElement: '목',
    shortElement: '토'
  });
  assert.equal(missingEra.relation, '판단 보류');
  assert.match(missingEra.parts.useful.reason, /시대 오행 정보가 없어/);
  assert.match(missingEra.parts.day.reason, /시대 오행 정보가 없어/);
  assert.match(missingEra.parts.balance.reason, /시대 오행 정보가 없어/);
  assert.match(missingEra.parts.daeun.reason, /시대 오행 정보가 없어/);
  assert.match(missingEra.parts.short.reason, /시대 오행 정보가 없어/);
  assert.ok(Object.values(missingEra.parts).every((part) => !part.reason.includes('동조')));

  const missingDay = calculateResonance({
    eraElement: '화',
    usefulElement: '화',
    elements: { 목: 1, 화: 1, 토: 1, 금: 1, 수: 1 },
    daeunElement: '목',
    shortElement: '토'
  });
  assert.equal(missingDay.relation, '판단 보류');
  assert.match(missingDay.parts.day.reason, /일간 정보가 없어/);
  assert.match(missingDay.parts.useful.reason, /관계는 동조/);

  const missingBoth = calculateResonance({});
  assert.equal(missingBoth.relation, '판단 보류');
  assert.match(missingBoth.parts.day.reason, /시대 오행과 일간 정보가 없어/);
  assert.match(missingBoth.parts.balance.reason, /시대 오행과 오행 분포 정보가 없어/);
});

test('clamps malformed and missing context to finite scores', () => {
  for (const context of [
    undefined,
    null,
    {},
    {
      eraElement: '<화>',
      dayElement: 7,
      usefulElement: null,
      elements: { 목: -10, 화: Number.NaN, 토: Infinity, 금: '많음', 수: 999 },
      daeunElement: {},
      shortElement: []
    }
  ]) {
    const result = calculateResonance(context);
    assert.equal(Object.keys(result.parts).length, 5);
    assert.ok(Number.isFinite(result.score));
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.equal(
      result.score,
      Object.values(result.parts).reduce((sum, part) => sum + part.score, 0)
    );
    assert.ok(
      Object.values(result.parts).every((part) => (
        Number.isFinite(part.score)
        && part.score >= 0
        && part.score <= part.max
        && !part.reason.includes('NaN')
        && !part.reason.includes('undefined')
      ))
    );
  }
});
