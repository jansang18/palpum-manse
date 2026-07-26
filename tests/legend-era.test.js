const test = require('node:test');
const assert = require('node:assert/strict');
const { getLegendEra } = require('../scripts/legend-era.js');

test('maps the current lower yuan ninth period with the exact public fields', () => {
  assert.deepEqual(
    getLegendEra(2024),
    {
      cycle: 1,
      cycleStart: 1864,
      cycleEnd: 2043,
      yuan: '하원',
      yun: 9,
      yunStart: 2024,
      yunEnd: 2043,
      trigram: '리',
      hanja: '離',
      element: '화',
      symbol: '빛',
      progress: 0.025
    }
  );
});

test('changes period at the 2023 to 2024 boundary', () => {
  assert.equal(getLegendEra(2023).yun, 8);
  assert.equal(getLegendEra(2024).yun, 9);
});

test('starts a new 180-year cycle after 2043', () => {
  assert.deepEqual(
    {
      yun: getLegendEra(2043).yun,
      cycle: getLegendEra(2043).cycle,
      cycleEnd: getLegendEra(2043).cycleEnd
    },
    { yun: 9, cycle: 1, cycleEnd: 2043 }
  );
  assert.deepEqual(
    {
      yun: getLegendEra(2044).yun,
      cycle: getLegendEra(2044).cycle,
      cycleStart: getLegendEra(2044).cycleStart
    },
    { yun: 1, cycle: 2, cycleStart: 2044 }
  );
});

test('repeats safely before the 1864 anchor', () => {
  assert.deepEqual(
    {
      cycle: getLegendEra(1684).cycle,
      cycleStart: getLegendEra(1684).cycleStart,
      yun: getLegendEra(1684).yun
    },
    { cycle: 0, cycleStart: 1684, yun: 1 }
  );
  assert.deepEqual(
    {
      cycle: getLegendEra(1863).cycle,
      cycleEnd: getLegendEra(1863).cycleEnd,
      yun: getLegendEra(1863).yun
    },
    { cycle: 0, cycleEnd: 1863, yun: 9 }
  );
});

test('uses floor division for cycles earlier than the previous cycle', () => {
  assert.deepEqual(
    {
      cycle: getLegendEra(1683).cycle,
      cycleStart: getLegendEra(1683).cycleStart,
      cycleEnd: getLegendEra(1683).cycleEnd,
      yun: getLegendEra(1683).yun
    },
    { cycle: -1, cycleStart: 1504, cycleEnd: 1683, yun: 9 }
  );
});

test('rounds period progress to three decimals and keeps it clamped', () => {
  const startsAndEnds = [1504, 1683, 1684, 1863, 1864, 2023, 2024, 2043, 2044, 2223];
  const progressValues = startsAndEnds.map((year) => getLegendEra(year).progress);

  assert.equal(getLegendEra(2024).progress, 0.025);
  assert.equal(getLegendEra(2043).progress, 0.975);
  assert.ok(progressValues.every((progress) => progress >= 0 && progress <= 1));
  assert.ok(progressValues.every((progress) => {
    return Number.isInteger(progress * 1000);
  }));
});
