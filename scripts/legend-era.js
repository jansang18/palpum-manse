(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendEra = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const anchor = 1864;
  const cycleYears = 180;
  const periodYears = 20;
  const periodData = [
    ['상원', 1, '감', '坎', '수', '심연'],
    ['상원', 2, '곤', '坤', '토', '대지'],
    ['상원', 3, '진', '震', '목', '천둥'],
    ['중원', 4, '손', '巽', '목', '바람'],
    ['중원', 5, '중궁', '中', '토', '중심'],
    ['중원', 6, '건', '乾', '금', '하늘'],
    ['하원', 7, '태', '兌', '금', '호수'],
    ['하원', 8, '간', '艮', '토', '산'],
    ['하원', 9, '리', '離', '화', '빛']
  ];

  function getLegendEra(year) {
    const cycleOffset = Math.floor((year - anchor) / cycleYears);
    const cycleStart = anchor + cycleOffset * cycleYears;
    const cycleEnd = cycleStart + cycleYears - 1;
    const yearInCycle = year - cycleStart;
    const periodIndex = Math.floor(yearInCycle / periodYears);
    const [yuan, yun, trigram, hanja, element, symbol] = periodData[periodIndex];
    const yunStart = cycleStart + periodIndex * periodYears;
    const yunEnd = yunStart + periodYears - 1;
    const rawProgress = (year - yunStart + 0.5) / periodYears;
    const progress = Math.round(
      Math.min(1, Math.max(0, rawProgress)) * 1000
    ) / 1000;

    return {
      cycle: cycleOffset + 1,
      cycleStart,
      cycleEnd,
      yuan,
      yun,
      yunStart,
      yunEnd,
      trigram,
      hanja,
      element,
      symbol,
      progress
    };
  }

  return Object.freeze({ getLegendEra });
});
