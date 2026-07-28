(function (root) {
  'use strict';

  const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const STEM_ELEMENTS = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
  const PILLARS = [
    ['year', 'yStem', 'yBranch'],
    ['month', 'mStem', 'mBranch'],
    ['day', 'dStem', 'dBranch'],
    ['hour', 'hStem', 'hBranch']
  ];

  root.ManseryeokAdapter = root.LegendGanji;

  function requireElement(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`필수 화면 요소를 찾을 수 없습니다: ${id}`);
    return element;
  }

  function adapter() {
    const existing = root.ManseryeokAdapter;
    if (!existing || typeof existing.calculate !== 'function') {
      throw new Error('만세력 계산 도구를 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
    }
    return existing;
  }

  function buildInput(form) {
    const birth = form.elements.birth.value.replace(/\D/g, '');
    const time = form.elements.time.value.replace(/\D/g, '');
    if (!/^\d{8}$/.test(birth)) throw new Error('생년월일 8자리를 입력해 주세요.');
    if (!form.elements.unknown.checked && !/^\d{4}$/.test(time)) {
      throw new Error('태어난 시간을 4자리로 입력해 주세요.');
    }
    return {
      year: Number(birth.slice(0, 4)),
      month: Number(birth.slice(4, 6)),
      day: Number(birth.slice(6, 8)),
      hour: form.elements.unknown.checked ? 12 : Number(time.slice(0, 2)),
      minute: form.elements.unknown.checked ? 0 : Number(time.slice(2, 4)),
      calendar: form.elements.calendar.value,
      isLeapMonth: form.elements.leap.value === 'leap',
      gender: form.elements.gender.value,
      unknown: form.elements.unknown.checked,
      dayBoundary: 'midnight'
    };
  }

  function ganji(stem, branch, allowUnknown) {
    if (allowUnknown && stem === -1 && branch === -1) return '시간 미상';
    if (!Number.isInteger(stem) || stem < 0 || stem >= STEMS.length ||
        !Number.isInteger(branch) || branch < 0 || branch >= BRANCHES.length) {
      throw new RangeError(`계산 결과의 간지 인덱스가 유효하지 않습니다: ${stem}/${branch}`);
    }
    return `${STEMS[stem]}${BRANCHES[branch]}`;
  }

  function renderPillars(result) {
    const values = PILLARS.map(([name, stemKey, branchKey]) => ({
      name,
      stem: result[stemKey],
      value: ganji(result[stemKey], result[branchKey], name === 'hour')
    }));

    values.forEach(({ name, stem, value }, index) => {
      const card = document.querySelector(`[data-pillar="${name}"]`);
      card.querySelector('[data-pillar-value]').textContent = value;
      card.dataset.element = stem === -1 ? 'unknown' : STEM_ELEMENTS[stem];
      card.style.setProperty('--pillar-delay', `${index * 90}ms`);
      card.setAttribute(
        'aria-label',
        `${card.querySelector('span').textContent.trim()} ${value} 학습 설명 열기`
      );
      card.classList.remove('is-pillar-revealed');
      void card.offsetWidth;
      card.classList.add('is-pillar-revealed');
    });
    requireElement('academyPillars').hidden = false;
  }

  function renderLuck(result) {
    const flow = requireElement('academyLuckFlow');
    flow.replaceChildren();
    for (const item of result.daeun.list) {
      const card = document.createElement('div');
      const age = document.createElement('span');
      const value = document.createElement('strong');
      age.textContent = item.isInitial ? '태어난 때' : `${item.age}세`;
      value.textContent = ganji(item.stem, item.branch);
      card.append(age, value);
      flow.append(card);
    }
    flow.hidden = false;
  }

  function renderSummary(form, input) {
    const name = form.elements.name.value.trim();
    const calendar = input.calendar === 'lunar'
      ? `음력 ${input.isLeapMonth ? '윤달' : '평달'}`
      : '양력';
    requireElement('academyManseSummary').textContent =
      `${name ? `${name} 님 · ` : ''}${calendar} · ${input.unknown ? '시간 미상' : '시간 입력'}`;
  }

  function provenanceValue(result, key) {
    const values = {
      calculationMode: {
        'kasi-precise': 'KASI 절기 기반 정밀 계산',
        'kasi-solar-kst-fallback': 'KASI 절기 기반 근사 계산'
      },
      timeStandard: {
        'asia-seoul-civil': '한국 표준시 변천 반영',
        'kst-fallback': 'UTC+9(KST) 고정 근사'
      },
      dayBoundary: {
        midnight: '자정(00:00) 기준',
        jasi: '자시(23:00) 기준',
        splitJasi: '야자시 분리 기준'
      }
    };
    return values[key][result[key]] || String(result[key] || '제공되지 않음');
  }

  function renderProvenance(result) {
    const basis = result.calculationBasis || {};
    const yearMonth = basis.yearMonth === 'historical-civil-solar-terms'
      ? '당시 민간시 절기'
      : basis.yearMonth === 'kst-fallback-solar-terms'
        ? 'UTC+9 고정 절기'
        : '제공된 절기 기준';
    const dayHour = basis.dayHour === 'civil-wall-clock'
      ? '입력 시계 시각'
      : '제공된 일·시 기준';
    const values = {
      mode: provenanceValue(result, 'calculationMode'),
      'time-standard': provenanceValue(result, 'timeStandard'),
      'day-boundary': provenanceValue(result, 'dayBoundary'),
      basis: `연·월: ${yearMonth} · 일·시: ${dayHour}`
    };

    Object.entries(values).forEach(([key, value]) => {
      const node = document.querySelector(`[data-provenance="${key}"]`);
      node.textContent = value;
    });

    const historical = requireElement('academyHistoricalNotice');
    const fallback = result.timeStandard === 'kst-fallback';
    historical.textContent = fallback
      ? '1908년 4월 1일 이전 기록은 당시 전국 표준시 자료가 없어 UTC+9(KST) 고정값으로 근사 계산합니다.'
      : '';
    historical.hidden = !fallback;
  }

  function announceResult(open) {
    document.dispatchEvent(new CustomEvent('academy:manse-result', {
      detail: { open }
    }));
  }

  function calculateFromForm() {
    const form = requireElement('academyManseForm');
    const error = requireElement('academyManseError');
    const status = requireElement('academyManseStatus');
    error.hidden = true;
    error.textContent = '';
    status.textContent = '계산 중입니다.';
    announceResult(false);

    try {
      const input = buildInput(form);
      const result = adapter().calculate(input);
      renderPillars(result);
      renderLuck(result);
      renderSummary(form, input);
      renderProvenance(result);
      requireElement('academyManseResult').hidden = false;
      status.textContent = '계산이 완료되었습니다. 네 기둥 학습표가 열렸습니다.';
      announceResult(true);
    } catch (calculationError) {
      requireElement('academyManseResult').hidden = true;
      status.textContent = '';
      error.textContent = calculationError instanceof Error
        ? calculationError.message
        : '계산 중 문제가 생겼습니다. 입력값을 확인해 주세요.';
      error.hidden = false;
      announceResult(false);
    }
  }

  function init() {
    const form = document.getElementById('academyManseForm');
    if (!form || form.dataset.academyManseReady === 'true') return;
    form.dataset.academyManseReady = 'true';

    const calendar = form.elements.calendar;
    const leapField = requireElement('academyLeapField');
    const leap = form.elements.leap;
    const time = form.elements.time;
    const unknown = form.elements.unknown;

    function syncCalendar() {
      const isLunar = calendar.value === 'lunar';
      leapField.hidden = !isLunar;
      leap.disabled = !isLunar;
    }

    function syncUnknownTime() {
      time.disabled = unknown.checked;
      time.required = !unknown.checked;
    }

    calendar.addEventListener('change', syncCalendar);
    unknown.addEventListener('change', syncUnknownTime);
    form.addEventListener('submit', event => {
      event.preventDefault();
      calculateFromForm();
    });
    syncCalendar();
    syncUnknownTime();
  }

  root.AcademyManse = Object.freeze({ calculateFromForm });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
