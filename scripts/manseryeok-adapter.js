(function (root, factory) {
  const api = factory(root.Manseryeok);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendGanji = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (browserEngine) {
  const stems = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const branches = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const KOREA_CIVIL_TIME = Object.freeze({
    // 135° with EoT off applies only the package's historical civil offset table.
    longitude: 135,
    applyEquationOfTime: false,
    applyHistoricalDst: true
  });

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

  function engineBirthInput(input, dates, hour, minute, historicalCivilTime) {
    const birthInput = {
      year: dates.solar.y,
      month: dates.solar.m,
      day: dates.solar.d,
      hour,
      minute,
      isLunar: false,
      isLeapMonth: false,
      dayBoundary: input.dayBoundary || 'midnight',
      gender: input.gender === 'M' ? 'male' : 'female'
    };
    if (historicalCivilTime) birthInput.trueSolarTime = KOREA_CIVIL_TIME;
    return birthInput;
  }

  function calculateForWallTime(engine, input, dates, hour, minute) {
    const historicalResult = engine.calculateFourPillars(
      engineBirthInput(input, dates, hour, minute, true)
    );
    const wallClockResult = engine.calculateFourPillars(
      engineBirthInput(input, dates, hour, minute, false)
    );
    return {
      year: historicalResult.year,
      month: historicalResult.month,
      day: wallClockResult.day,
      hour: wallClockResult.hour,
      luckPillars: historicalResult.luckPillars
    };
  }

  function decisivePillarHead(result) {
    return [
      result.year.heavenlyStem,
      result.year.earthlyBranch,
      result.month.heavenlyStem,
      result.month.earthlyBranch,
      result.day.heavenlyStem,
      result.day.earthlyBranch
    ].join(':');
  }

  function assertKnownTimeIsNotRequired(engine, input, dates) {
    if (!input.unknown) return;
    const candidates = [
      calculateForWallTime(engine, input, dates, 0, 0),
      calculateForWallTime(engine, input, dates, 12, 0),
      calculateForWallTime(engine, input, dates, 22, 59),
      calculateForWallTime(engine, input, dates, 23, 30),
      calculateForWallTime(engine, input, dates, 23, 59)
    ];
    const first = decisivePillarHead(candidates[0]);
    if (candidates.every(result => decisivePillarHead(result) === first)) return;

    const error = new Error(
      '이 날짜는 절입 시각이나 자시 일 경계에 따라 연주·월주 또는 일주가 달라질 수 있어 태어난 시간을 알아야 명식을 확정할 수 있습니다.'
    );
    error.name = 'LegendSolarTermTimeRequiredError';
    error.code = 'LEGEND_SOLAR_TERM_TIME_REQUIRED';
    throw error;
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
      assertKnownTimeIsNotRequired(engine, input, dates);
      const result = calculateForWallTime(
        engine,
        input,
        dates,
        input.unknown ? 12 : input.hour,
        input.unknown ? 0 : input.minute
      );
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
        calculationMode: dates.solar.y < 1908 ||
          (dates.solar.y === 1908 && (dates.solar.m < 4 ||
            (dates.solar.m === 4 && dates.solar.d < 1)))
          ? 'kasi-solar-kst-fallback'
          : 'kasi-precise',
        dayBoundary: input.dayBoundary || 'midnight',
        timeStandard: dates.solar.y < 1908 ||
          (dates.solar.y === 1908 && (dates.solar.m < 4 ||
            (dates.solar.m === 4 && dates.solar.d < 1)))
          ? 'kst-fallback'
          : 'asia-seoul-civil',
        trueSolarCorrection: false,
        calculationBasis: Object.freeze({
          yearMonth: 'historical-civil-solar-terms',
          dayHour: 'civil-wall-clock'
        })
      };
    }

    return Object.freeze({ calculate });
  }

  const api = { createAdapter };
  if (browserEngine) api.calculate = createAdapter(browserEngine).calculate;
  return Object.freeze(api);
});
