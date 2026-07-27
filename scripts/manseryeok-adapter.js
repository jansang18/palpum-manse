(function (root, factory) {
  const api = factory(root.Manseryeok);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendGanji = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (browserEngine) {
  const stems = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const branches = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

  function indexPillar(pillar) {
    const stem = stems.indexOf(pillar.heavenlyStem);
    const branch = branches.indexOf(pillar.earthlyBranch);
    if (stem < 0 || branch < 0) {
      throw new RangeError('정밀 계산 엔진이 알 수 없는 간지를 반환했습니다.');
    }
    return { stem, branch };
  }

  function mapSolar(date) {
    return { y: date.year, m: date.month, d: date.day };
  }

  function mapLunar(date) {
    if (!date) return null;
    return {
      y: date.year,
      m: date.month,
      d: date.day,
      isLeap: Boolean(date.isLeapMonth)
    };
  }

  function validatePreciseYear(engine, input) {
    const maxYear = input.calendar === 'lunar' ? engine.LUNAR_MAX_YEAR : 2300;
    if (!Number.isInteger(input.year) || input.year < 1800 || input.year > maxYear) {
      throw new RangeError(`연도(year)는 1800~${maxYear} 정수여야 합니다: ${input.year}`);
    }
  }

  function convertedDates(engine, input) {
    if (input.calendar === 'lunar') {
      const solar = engine.lunarToSolar(
        input.year,
        input.month,
        input.day,
        input.isLeapMonth
      );
      return {
        solar: mapSolar(solar),
        lunar: mapLunar({
          year: input.year,
          month: input.month,
          day: input.day,
          isLeapMonth: input.isLeapMonth
        })
      };
    }

    let lunar = null;
    try {
      lunar = mapLunar(engine.solarToLunar(input.year, input.month, input.day));
    } catch (error) {
      // Solar-term data extends beyond the lunar conversion table.
      if (input.year <= engine.LUNAR_MAX_YEAR) throw error;
    }
    return {
      solar: mapSolar(input),
      lunar
    };
  }

  function mapDaeun(result, monthPillar) {
    const month = indexPillar(monthPillar);
    const luck = result.luckPillars;
    const initial = {
      age: 0,
      stem: month.stem,
      branch: month.branch,
      isInitial: true
    };
    if (!luck) {
      return { num: 0, forward: true, list: [initial] };
    }
    return {
      num: luck.startAge,
      forward: luck.forward,
      startYears: luck.startYears,
      startMonths: luck.startMonths,
      startDays: luck.startDays,
      list: [
        initial,
        ...luck.pillars.map(item => {
          const pillar = indexPillar(item.pillar);
          return { age: item.age, stem: pillar.stem, branch: pillar.branch };
        })
      ]
    };
  }

  function createAdapter(engine) {
    if (!engine || typeof engine.calculateFourPillars !== 'function' ||
        typeof engine.lunarToSolar !== 'function' ||
        typeof engine.solarToLunar !== 'function') {
      throw new TypeError('manseryeok 2.0.0 계산 엔진이 필요합니다.');
    }

    function calculate(input) {
      validatePreciseYear(engine, input);
      if (input.calendar === 'lunar' && typeof input.isLeapMonth !== 'boolean') {
        throw new TypeError('음력은 평달 또는 윤달을 선택해야 합니다 (isLeapMonth).');
      }
      const dates = convertedDates(engine, input);
      const result = engine.calculateFourPillars({
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.unknown ? 12 : input.hour,
        minute: input.unknown ? 0 : input.minute,
        isLunar: input.calendar === 'lunar',
        isLeapMonth: input.calendar === 'lunar' ? input.isLeapMonth : false,
        dayBoundary: input.dayBoundary || 'midnight',
        gender: input.gender === 'M' ? 'male' : 'female'
      });
      const y = indexPillar(result.year);
      const m = indexPillar(result.month);
      const d = indexPillar(result.day);
      const h = input.unknown
        ? { stem: -1, branch: -1 }
        : indexPillar(result.hour);

      return {
        year: dates.solar.y,
        month: dates.solar.m,
        day: dates.solar.d,
        solar: dates.solar,
        lunar: dates.lunar,
        yStem: y.stem,
        yBranch: y.branch,
        mStem: m.stem,
        mBranch: m.branch,
        dStem: d.stem,
        dBranch: d.branch,
        hStem: h.stem,
        hBranch: h.branch,
        daeun: mapDaeun(result, result.month),
        calculationMode: 'kasi-precise',
        engineResult: result
      };
    }

    return Object.freeze({ calculate });
  }

  const api = { createAdapter };
  if (browserEngine) api.calculate = createAdapter(browserEngine).calculate;
  return Object.freeze(api);
});
