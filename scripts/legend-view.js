(function (root) {
  'use strict';

  const LAYER_KEYS = Object.freeze([
    'cycle',
    'yun',
    'natal',
    'daeun',
    'seun',
    'month',
    'day',
    'hour'
  ]);
  const EVIDENCE_LABELS = Object.freeze({
    useful: '용신 후보와 시대',
    day: '일간과 시대',
    balance: '오행 균형 보완',
    daeun: '대운과 시대',
    short: '단기 운과 시대'
  });

  function element(tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function appendText(parent, tagName, className, text) {
    const node = element(tagName, className, text);
    parent.appendChild(node);
    return node;
  }

  function ganji(stem, branch) {
    if (!Number.isInteger(stem) || !Number.isInteger(branch) || stem < 0 || branch < 0) {
      return '미상';
    }
    return `${STEM[stem]}${BRANCH[branch]} · ${STEM_KOR[stem]}${BRANCH_KOR[branch]}`;
  }

  function formatDate(year, month, day) {
    return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
  }

  function selectionFor(saju) {
    const now = new Date();
    const daeun = Number.isInteger(selectedDaeun) ? saju.daeun.list[selectedDaeun] : null;
    const year = Number.isInteger(selectedSeun) ? selectedSeun : now.getFullYear();
    const month = selectedWoon && selectedWoon.y === year
      ? selectedWoon.m
      : now.getMonth() + 1;
    const selectedDateMatches = selectedLegendDay
      && selectedLegendDay.y === year
      && selectedLegendDay.m === month;
    const todayMatches = now.getFullYear() === year && now.getMonth() + 1 === month;
    const day = selectedDateMatches
      ? selectedLegendDay.d
      : todayMatches ? now.getDate() : 1;
    const yearPillar = yearGanji(year);
    const monthPillar = getWoonMonth(year, month);
    const dayPillar = dayGanji(toJD(year, month, day));

    return { daeun, year, month, day, yearPillar, monthPillar, dayPillar };
  }

  function getHourlyFortunes(year, month, day, dayStem) {
    const natalDayStem = currentSaju && Number.isInteger(currentSaju.dStem)
      ? currentSaju.dStem
      : dayStem;

    return BRANCH.map((branch, branchIndex) => {
      const stem = getHourStem(dayStem, branchIndex);
      return {
        year,
        month,
        day,
        branchIndex,
        branch,
        startHour: branchIndex === 0 ? 23 : branchIndex * 2 - 1,
        stem,
        sipsin: getSipsin(natalDayStem, stem)
      };
    });
  }

  function resonanceFor(saju, era, selection) {
    const yongsin = getYongsin(saju);
    return root.LegendResonance.calculateResonance({
      eraElement: era.element,
      dayElement: EL_KOR[STEM_EL[saju.dStem]],
      usefulElement: EL_KOR[yongsin.yongsin],
      elements: Object.fromEntries(EL_KOR.map((name, index) => [name, saju.ohaeng[index]])),
      daeunElement: selection.daeun ? EL_KOR[STEM_EL[selection.daeun.stem]] : null,
      shortElement: EL_KOR[STEM_EL[selection.dayPillar.stem]]
    });
  }

  function layerCard(layer) {
    const article = element('article', 'legend-layer');
    article.dataset.timeLayer = layer.key;
    appendText(article, 'div', 'legend-layer-kicker', layer.kicker);
    appendText(article, 'h3', 'legend-layer-title', layer.title);
    appendText(article, 'div', 'legend-layer-value', layer.value);
    appendText(article, 'p', 'legend-layer-detail', layer.detail);
    return article;
  }

  function hourLayer(selection, hours) {
    const article = layerCard({
      key: 'hour',
      kicker: '2 HOURS',
      title: '시운 · 하루의 열두 문',
      value: formatDate(selection.year, selection.month, selection.day),
      detail: '출생시각과 별개로 선택한 날의 12시진을 모두 펼칩니다.'
    });
    article.dataset.selectedDate = `${selection.year}-${selection.month}-${selection.day}`;
    const list = element('div', 'legend-hour-list');
    list.setAttribute('aria-label', '선택한 날의 열두 시진');

    hours.forEach(hour => {
      const item = element('div', 'legend-hour-item');
      item.dataset.hourBranch = String(hour.branchIndex);
      item.setAttribute('role', 'listitem');
      const endHour = (hour.startHour + 1) % 24;
      appendText(
        item,
        'span',
        'legend-hour-time',
        `${String(hour.startHour).padStart(2, '0')}–${String(endHour).padStart(2, '0')}시`
      );
      appendText(item, 'strong', 'legend-hour-ganji', `${STEM[hour.stem]}${hour.branch}`);
      appendText(item, 'span', 'legend-hour-sipsin', SIPSIN_KOR[hour.sipsin] || '관계 미상');
      list.appendChild(item);
    });
    article.appendChild(list);
    return article;
  }

  function evidenceDialog(resonance) {
    const dialog = element('dialog', 'legend-evidence-dialog');
    dialog.dataset.legendEvidenceDialog = '';
    dialog.setAttribute('aria-labelledby', 'legendEvidenceTitle');

    const inner = element('div', 'legend-dialog-inner');
    const title = appendText(inner, 'h2', '', '공명도 계산 근거');
    title.id = 'legendEvidenceTitle';
    appendText(
      inner,
      'p',
      'legend-dialog-intro',
      '다섯 항목의 점수와 판단 이유를 모두 공개합니다. 공명도는 선택을 돕는 참고 지표입니다.'
    );

    Object.entries(resonance.parts).forEach(([key, part]) => {
      const row = element('section', 'legend-evidence-part');
      row.dataset.legendEvidencePart = key;
      appendText(row, 'strong', '', EVIDENCE_LABELS[key] || key);
      appendText(row, 'span', '', `${part.score} / ${part.max}`);
      appendText(row, 'p', '', part.reason);
      inner.appendChild(row);
    });

    const close = appendText(inner, 'button', 'legend-dialog-close', '확인');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    dialog.appendChild(inner);
    return dialog;
  }

  function heroCard(narrative, resonance, dialog) {
    const hero = element('header', 'legend-hero');
    hero.dataset.legendHero = '';
    appendText(hero, 'div', 'legend-eyebrow', '취명선 전설 해석 · 시대의 하늘');
    appendText(hero, 'h2', '', narrative.heroTitle);
    appendText(hero, 'p', 'legend-hero-summary', narrative.heroSummary);

    const row = element('div', 'legend-score-row');
    const score = element('div', 'legend-score');
    appendText(score, 'span', '', '공명도');
    appendText(score, 'strong', '', resonance.score);
    appendText(score, 'span', '', '/ 100');
    row.appendChild(score);

    const evidence = appendText(row, 'button', 'legend-evidence-button', '계산 근거 보기');
    evidence.type = 'button';
    evidence.dataset.legendEvidence = '';
    evidence.setAttribute('aria-haspopup', 'dialog');
    evidence.setAttribute('aria-controls', 'legendEvidenceTitle');
    evidence.addEventListener('click', () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
    hero.appendChild(row);
    return hero;
  }

  function narrativeGrid(narrative) {
    const grid = element('section', 'legend-narrative');
    grid.setAttribute('aria-label', '취명선 전설 해석');
    narrative.sections.forEach(section => {
      const article = element('article', 'legend-story');
      appendText(article, 'div', 'legend-story-mark', section.hanja);
      appendText(article, 'h3', '', section.title);
      appendText(article, 'p', 'legend-story-summary', section.summary);
      appendText(article, 'p', 'legend-story-body', section.body);
      grid.appendChild(article);
    });
    return grid;
  }

  function emptyView(mount) {
    const empty = element('section', 'legend-empty');
    appendText(empty, 'h2', '', '먼저 사주를 펼쳐주세요');
    appendText(empty, 'p', '', '원국을 세우면 180년 시대부터 오늘의 2시간 시운까지 한 흐름으로 이어집니다.');
    mount.replaceChildren(empty);
  }

  function renderLegend(saju) {
    const mount = document.getElementById('legendContent');
    if (!mount) return;
    if (!saju) {
      emptyView(mount);
      return;
    }
    if (!root.LegendEra || !root.LegendResonance || !root.LegendCopy) {
      const error = element('section', 'legend-empty');
      appendText(error, 'h2', '', '전설 해석을 불러오지 못했습니다');
      appendText(error, 'p', '', '페이지를 새로고침한 뒤 다시 시도해주세요.');
      mount.replaceChildren(error);
      return;
    }

    const selection = selectionFor(saju);
    const era = root.LegendEra.getLegendEra(selection.year);
    const resonance = resonanceFor(saju, era, selection);
    const narrative = root.LegendCopy.buildNarrative({
      name: saju.name,
      era,
      resonance
    });
    const hours = getHourlyFortunes(
      selection.year,
      selection.month,
      selection.day,
      selection.dayPillar.stem
    );
    const dialog = evidenceDialog(resonance);
    const shell = element('div', 'legend-shell');
    const timeline = element('section', 'legend-timeline');
    timeline.setAttribute('aria-label', '여덟 겹 시간 흐름');

    const daeunValue = selection.daeun
      ? ganji(selection.daeun.stem, selection.daeun.branch)
      : '선택 전';
    const daeunDetail = selection.daeun
      ? `${selection.daeun.age}세부터 흐르는 개인의 10년 배경`
      : '원국에서 대운을 선택하면 시대와의 관계를 함께 계산합니다.';
    const natalValue = [
      ganji(saju.yStem, saju.yBranch).split(' · ')[0],
      ganji(saju.mStem, saju.mBranch).split(' · ')[0],
      ganji(saju.dStem, saju.dBranch).split(' · ')[0],
      saju.unknown ? '時未詳' : ganji(saju.hStem, saju.hBranch).split(' · ')[0]
    ].join(' · ');

    const layers = [
      {
        key: 'cycle',
        kicker: '180 YEARS',
        title: '삼원 전체 순환',
        value: `${era.cycleStart}–${era.cycleEnd}`,
        detail: `${era.yuan}부터 하원까지 이어지는 가장 큰 시대의 호흡입니다.`
      },
      {
        key: 'yun',
        kicker: '20 YEARS',
        title: `${era.yuan} ${era.yun}운`,
        value: `${era.hanja} · ${era.symbol} · ${era.element}`,
        detail: `${era.yunStart}–${era.yunEnd}년, 현재 선택 연도 기준 ${Math.round(era.progress * 100)}% 지점`
      },
      {
        key: 'natal',
        kicker: 'NATAL',
        title: '원국 · 태어난 구조',
        value: natalValue,
        detail: saju.unknown
          ? `${saju.year}년생 · 시각 미상, 시주는 원국 판단에서 제외합니다.`
          : `${saju.year}년생 · ${BRANCH_KOR[saju.hBranch]}시까지 반영한 네 기둥입니다.`
      },
      {
        key: 'daeun',
        kicker: '10 YEARS',
        title: '대운 · 개인의 계절',
        value: daeunValue,
        detail: daeunDetail
      },
      {
        key: 'seun',
        kicker: '1 YEAR',
        title: '세운 · 올해의 장면',
        value: `${selection.year} · ${ganji(selection.yearPillar.stem, selection.yearPillar.branch)}`,
        detail: selectedSeun ? '원국에서 선택한 세운입니다.' : '선택 전에는 현재 연도를 기준으로 봅니다.'
      },
      {
        key: 'month',
        kicker: '1 MONTH',
        title: '월운 · 변화의 결',
        value: `${selection.month}월 · ${ganji(selection.monthPillar.stem, selection.monthPillar.branch)}`,
        detail: selectedWoon ? '원국에서 선택한 월운입니다.' : '선택 전에는 현재 월을 기준으로 봅니다.'
      },
      {
        key: 'day',
        kicker: '1 DAY',
        title: '일운 · 선택한 하루',
        value: `${formatDate(selection.year, selection.month, selection.day)} · ${ganji(selection.dayPillar.stem, selection.dayPillar.branch)}`,
        detail: selectedLegendDay ? '일운 달력에서 선택한 날짜입니다.' : '날짜를 고르지 않으면 해당 월의 오늘 또는 1일을 기준으로 봅니다.'
      }
    ];

    layers.forEach(layer => timeline.appendChild(layerCard(layer)));
    timeline.appendChild(hourLayer(selection, hours));
    if (timeline.children.length !== LAYER_KEYS.length) {
      throw new Error('전설 시간층은 정확히 여덟 개여야 합니다.');
    }

    shell.appendChild(heroCard(narrative, resonance, dialog));
    shell.appendChild(timeline);
    shell.appendChild(narrativeGrid(narrative));
    shell.appendChild(dialog);
    mount.replaceChildren(shell);
  }

  root.getHourlyFortunes = getHourlyFortunes;
  root.renderLegend = renderLegend;
})(typeof globalThis !== 'undefined' ? globalThis : window);
