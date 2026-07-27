(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendCopy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ELEMENTS = Object.freeze(['목', '화', '토', '금', '수']);
  const RELATIONS = Object.freeze(['동조', '생조', '표출', '압력', '제어', '판단 보류']);
  const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff<>"'&/=`\\]/gu;

  const ELEMENT_COPY = Object.freeze({
    목: '성장과 기획, 관계를 뻗어 가는 힘',
    화: '표현과 확산, 존재를 드러내는 힘',
    토: '수용과 조율, 흐름을 현실에 정착시키는 힘',
    금: '판단과 구분, 기준을 세우고 완성하는 힘',
    수: '관찰과 탐구, 정보를 축적하고 유연하게 흐르는 힘'
  });

  const TEN_GOD_COPY = Object.freeze({
    비견: '자기 기준, 독립성, 동료와의 나란한 경쟁',
    겁재: '돌파력, 분배, 경쟁 속에서 자원을 움직이는 힘',
    식신: '꾸준한 생산, 돌봄, 기술을 결과로 만드는 힘',
    상관: '표현과 개선, 낡은 기준에 질문을 던지는 힘',
    편재: '기회 포착, 유통, 넓은 관계와 유동 자원의 감각',
    정재: '계획적인 축적, 책임, 생활 기반을 지키는 힘',
    편관: '압박을 결단과 실행력으로 바꾸는 힘',
    정관: '원칙, 책임, 제도 안에서 신뢰를 만드는 힘',
    편인: '직관, 독창적 학습, 낯선 관점을 읽는 힘',
    정인: '학습, 보호, 문서와 체계를 통해 기반을 얻는 힘',
    일간: '판단의 기준이 되는 나 자신'
  });

  const RELATION_COPY = Object.freeze({
    동조: {
      tone: '시대의 결이 내 기운과 나란히 흐릅니다.',
      work: '익숙한 강점을 선명한 역할로 세울 때 힘이 모입니다.',
      relation: '비슷한 속도의 사람과 뜻을 맞추되 관성적인 판단은 살펴보세요.',
      action: '가장 잘하는 한 가지를 골라 반복 가능한 방식으로 다듬으세요.'
    },
    생조: {
      tone: '시대의 흐름이 내 기운을 북돋우는 때입니다.',
      work: '배움과 지원을 받아 역량을 키우는 선택이 유리합니다.',
      relation: '도움을 자연스럽게 받되 고마움을 구체적인 행동으로 돌려주세요.',
      action: '혼자 밀어붙이기보다 좋은 스승과 도구를 먼저 확보하세요.'
    },
    표출: {
      tone: '내 기운이 시대의 장면을 만들어 내는 때입니다.',
      work: '아이디어를 결과물로 바꾸고 밖으로 알릴수록 흐름이 살아납니다.',
      relation: '표현은 분명하게 하되 상대가 받아들일 여백도 남겨주세요.',
      action: '생각에 머문 일을 작은 결과물 하나로 완성해 공개하세요.'
    },
    압력: {
      tone: '시대의 요구가 나를 단련하는 압력으로 다가옵니다.',
      work: '속도보다 기준과 경계를 세워 소모를 줄이는 일이 먼저입니다.',
      relation: '모든 기대에 답하려 하지 말고 가능한 범위를 차분히 알리세요.',
      action: '이번에는 하지 않을 일 하나를 정해 중요한 힘을 지키세요.'
    },
    제어: {
      tone: '내가 시대의 힘을 조율하고 방향을 잡는 때입니다.',
      work: '책임과 자원을 다루는 자리에서 원칙을 세울수록 신뢰가 쌓입니다.',
      relation: '주도권을 쥐더라도 상대의 속도와 선택을 존중해 주세요.',
      action: '결정 기준 세 가지를 적고 그 기준에 맞는 선택부터 실행하세요.'
    },
    '판단 보류': {
      tone: '비교에 필요한 정보가 부족해 시대와 개인의 관계를 판단하지 않습니다.',
      work: '필요한 명식 정보가 갖춰지기 전에는 일의 방향을 시대 흐름과 연결해 단정하지 않습니다.',
      relation: '관계 해석에 필요한 정보를 먼저 확인하고 실제 대화를 기준으로 판단하세요.',
      action: '시대 오행과 일간 정보를 확인한 뒤 다시 해석하세요.'
    }
  });

  function sanitizePlainText(value, fallback, maxLength = 160) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(UNSAFE_TEXT, '').trim();
    const limited = Array.from(cleaned).slice(0, maxLength).join('');
    return limited && /[\p{L}\p{N}]/u.test(limited) ? limited : fallback;
  }

  function normalizeScore(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  function objectOrEmpty(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function safeList(value, fallback = []) {
    if (!Array.isArray(value)) return fallback;
    return value
      .map(item => sanitizePlainText(item, '', 80))
      .filter(Boolean)
      .slice(0, 12);
  }

  function joinOr(list, fallback) {
    return list.length ? list.join(', ') : fallback;
  }

  function tenGodMeaning(value) {
    return TEN_GOD_COPY[value] || '명식과 실제 경험을 함께 보며 의미를 확인하는 자리';
  }

  function normalizePillars(profile) {
    const fallbacks = ['연주', '월주', '일주', '시주'];
    const source = Array.isArray(profile.pillars) ? profile.pillars.slice(0, 4) : [];
    return fallbacks.map((fallback, index) => {
      const pillar = objectOrEmpty(source[index]);
      return {
        label: sanitizePlainText(pillar.label, fallback, 10),
        ganji: sanitizePlainText(pillar.ganji, index === 3 ? '時未詳' : '미상', 12),
        stemTenGod: sanitizePlainText(
          pillar.stemTenGod,
          index === 2 ? '일간' : '미상',
          12
        ),
        branchTenGod: sanitizePlainText(pillar.branchTenGod, '미상', 12)
      };
    });
  }

  function normalizeElements(value) {
    const source = objectOrEmpty(value);
    return Object.fromEntries(ELEMENTS.map(element => {
      const count = Number.isFinite(source[element])
        ? Math.max(0, Math.min(8, Math.round(source[element])))
        : 0;
      return [element, count];
    }));
  }

  function normalizeTiming(value) {
    const source = objectOrEmpty(value);
    const normalizePeriod = (period, fallbackLabel) => {
      const item = objectOrEmpty(period);
      return {
        label: sanitizePlainText(item.label, fallbackLabel, 24),
        ganji: sanitizePlainText(item.ganji, '선택 전', 20),
        stemTenGod: sanitizePlainText(item.stemTenGod, '미상', 12),
        branchTenGod: sanitizePlainText(item.branchTenGod, '미상', 12),
        age: Number.isFinite(item.age) ? Math.max(0, Math.round(item.age)) : null
      };
    };
    const hour = objectOrEmpty(source.hour);
    return {
      daeun: normalizePeriod(source.daeun, '대운'),
      year: normalizePeriod(source.year, '선택 연도'),
      month: normalizePeriod(source.month, '선택 월'),
      day: normalizePeriod(source.day, '선택 일'),
      hour: {
        count: Number.isFinite(hour.count) ? Math.max(0, Math.round(hour.count)) : 12,
        focus: sanitizePlainText(hour.focus, '열두 시진의 십신을 비교해 선택합니다.', 100)
      }
    };
  }

  function section(key, hanja, title, group, source, summary, body) {
    return { key, hanja, title, group, source, summary, body };
  }

  function buildNarrative(context) {
    const source = objectOrEmpty(context);
    const era = objectOrEmpty(source.era);
    const resonance = objectOrEmpty(source.resonance);
    const provenance = objectOrEmpty(resonance.provenance);
    const profile = objectOrEmpty(source.profile);
    const dayMaster = objectOrEmpty(profile.dayMaster);
    const timing = normalizeTiming(source.timing);
    const pillars = normalizePillars(profile);
    const elements = normalizeElements(profile.elements);
    const elementRanking = ELEMENTS
      .map(element => ({ element, count: elements[element] }))
      .sort((first, second) => second.count - first.count || ELEMENTS.indexOf(first.element) - ELEMENTS.indexOf(second.element));

    const name = sanitizePlainText(source.name, '당신', 40);
    const symbol = sanitizePlainText(era.symbol, '흐름', 20);
    const eraElement = ELEMENTS.includes(era.element) ? era.element : '화';
    const yun = Number.isInteger(era.yun) && era.yun >= 1 && era.yun <= 9 ? era.yun : 9;
    const relation = RELATIONS.includes(resonance.relation)
      ? resonance.relation
      : '판단 보류';
    const score = normalizeScore(resonance.score);
    const copy = RELATION_COPY[relation];
    const isDeferred = relation === '판단 보류';

    const stem = sanitizePlainText(dayMaster.stem, '미상', 4);
    const stemKorean = sanitizePlainText(dayMaster.stemKorean, '미상', 8);
    const dayGanji = sanitizePlainText(dayMaster.ganji, '일주 미상', 12);
    const dayElement = ELEMENTS.includes(dayMaster.element) ? dayMaster.element : '화';
    const yinYang = ['양', '음'].includes(dayMaster.yinYang) ? dayMaster.yinYang : '음양 미상';
    const dominantElement = ELEMENTS.includes(profile.dominantElement)
      ? profile.dominantElement
      : elementRanking[0].element;
    const weakElements = safeList(profile.weakElements)
      .filter(element => ELEMENTS.includes(element));
    const usefulElement = ELEMENTS.includes(provenance.usefulElement)
      ? provenance.usefulElement
      : weakElements[0] || dayElement;
    const usefulRationale = sanitizePlainText(
      provenance.usefulRationale,
      `${usefulElement}을 균형을 살피는 간이 후보로 봅니다.`,
      180
    );
    const harmony = safeList(objectOrEmpty(profile.interactions).harmony);
    const tension = safeList(objectOrEmpty(profile.interactions).tension);
    const symbols = safeList(profile.symbols);
    const voidBranches = safeList(profile.voidBranches);
    const unknownTime = profile.unknownTime === true;

    const pillarLine = pillars
      .map(pillar => `${pillar.label} ${pillar.ganji} ${pillar.stemTenGod}·${pillar.branchTenGod}`)
      .join(', ');
    const elementLine = ELEMENTS.map(element => `${element} ${elements[element]}`).join(', ');
    const tenGodLine = pillars
      .map(pillar => `${pillar.label} ${pillar.stemTenGod}·${pillar.branchTenGod}`)
      .join(', ');
    const dominantTenGod = pillars
      .flatMap(pillar => [pillar.stemTenGod, pillar.branchTenGod])
      .find(value => TEN_GOD_COPY[value] && value !== '일간') || '일간';
    const ageText = timing.daeun.age === null ? '' : `${timing.daeun.age}세부터 `;

    const highlights = [
      `${yinYang} ${dayElement} ${stem}${stemKorean} 일간은 ${ELEMENT_COPY[dayElement]}을 중심축으로 삼습니다.`,
      `${dominantElement} ${elements[dominantElement]}개가 가장 두드러지고 ${usefulElement}은 균형을 살피는 간이 용신 후보입니다.`,
      isDeferred
        ? `${yun}운 ${eraElement}와 개인 명식의 관계는 정보 확인 전까지 판단을 보류합니다.`
        : `${yun}운 ${eraElement}와의 관계는 ${relation}, 창작 공명도는 ${score}점입니다.`
    ];

    return {
      heroTitle: `${symbol}의 시대에 선 ${name}`,
      heroSummary: isDeferred
        ? `${yun}운 ${eraElement}의 흐름과 개인 명식의 관계는 판단 보류입니다. 시대 오행과 일간 정보를 확인하면 공명도를 계산할 수 있습니다.`
        : `${yun}운 ${eraElement}의 흐름과 개인 명식의 관계는 ${relation}이며 공명도는 ${score}점입니다. ${copy.tone}`,
      highlights,
      sections: [
        section(
          'day-master',
          '命',
          '나를 이루는 중심',
          '명식의 뼈대',
          '명리 계산',
          `${dayGanji}, ${yinYang} ${dayElement}의 ${stem}${stemKorean}이 이 명식의 판단 기준입니다.`,
          `${ELEMENT_COPY[dayElement]} 이것을 성격의 고정된 결론으로 보지 말고, 어떤 환경에서 힘을 얻고 소모되는지 살피는 출발점으로 보세요.`
        ),
        section(
          'pillars',
          '柱',
          '네 기둥의 역할',
          '명식의 뼈대',
          '명리 계산',
          pillarLine,
          unknownTime
            ? '연주는 바깥 배경, 월주는 사회적 계절, 일주는 자신과 가까운 관계를 읽는 축입니다. 時未詳인 시주는 해석에서 제외해 추정하지 않습니다.'
            : '연주는 바깥 배경, 월주는 사회적 계절, 일주는 자신과 가까운 관계, 시주는 후반의 관심과 결과가 드러나는 자리로 함께 읽습니다.'
        ),
        section(
          'balance',
          '衡',
          '오행의 균형',
          '명식의 뼈대',
          '간이 해석',
          `${elementLine}. 가장 많은 기운은 ${dominantElement}, 보완 후보는 ${usefulElement}입니다.`,
          `${usefulRationale} 개수만으로 용신을 확정하지 않으며 계절의 세력과 조후, 실제 삶의 반응을 함께 확인해야 합니다.`
        ),
        section(
          'ten-gods',
          '神',
          '십신의 언어',
          '명식의 뼈대',
          '명리 계산',
          tenGodLine,
          `지금 두드러지는 ${dominantTenGod}은 ${tenGodMeaning(dominantTenGod)}을 뜻합니다. 십신은 좋고 나쁨보다 어떤 역할을 자주 쓰는지 보여주는 관계 언어입니다.`
        ),
        section(
          'interactions',
          '合',
          '합과 충의 구조',
          '명식의 뼈대',
          '명리 계산',
          `결합: ${joinOr(harmony, '뚜렷한 합 없음')}. 긴장: ${joinOr(tension, '뚜렷한 충·형·파·해 없음')}.`,
          '합은 자원이 모이고 관계가 이어지는 지점, 충·형·파·해는 이동과 조정이 필요한 지점으로 읽습니다. 어느 하나도 사건을 확정하지 않으며 반복되는 선택 양식을 살피는 표지입니다.'
        ),
        section(
          'symbols',
          '星',
          '신살과 공망',
          '명식의 뼈대',
          '전통 표지',
          `확인된 표지: ${joinOr(symbols, '별도 신살 없음')}. 공망 지지: ${joinOr(voidBranches, '미상')}.`,
          '신살은 원국의 중심 판단을 보조하는 전통 표지입니다. 귀인은 도움을 받는 방식, 문창은 학습과 표현, 도화는 주목과 관계의 감수성으로 참고하며 공망은 비어 있음보다 기대와 현실의 간극을 점검하는 자리로 봅니다.'
        ),
        section(
          'era',
          '時',
          '시대와 나',
          '시간의 작용',
          '창작 공명',
          isDeferred
            ? `${symbol}을 상징하는 ${yun}운의 시대 배경만 확인했습니다.`
            : `${symbol}을 상징하는 ${yun}운과 ${relation}의 관계를 이룹니다.`,
          isDeferred
            ? `${copy.tone} 시대의 기운은 배경이며 필요한 정보 없이 개인의 흐름을 단정하지 않습니다.`
            : `${copy.tone} ${eraElement}의 ${ELEMENT_COPY[eraElement]}이 사회의 배경으로 강해지지만 선택과 행동이 실제 방향을 만듭니다.`
        ),
        section(
          'daeun',
          '運',
          '대운의 계절',
          '시간의 작용',
          '명리 계산',
          `${ageText}${timing.daeun.ganji} 대운, 천간 ${timing.daeun.stemTenGod}·지지 ${timing.daeun.branchTenGod}.`,
          `${tenGodMeaning(timing.daeun.stemTenGod)}이 10년의 큰 과제로 떠오릅니다. 대운은 사건의 목록이 아니라 반복적으로 만나게 되는 역할과 환경의 계절입니다.`
        ),
        section(
          'year',
          '歲',
          '세운의 장면',
          '시간의 작용',
          '명리 계산',
          `${timing.year.label} ${timing.year.ganji}, 천간 ${timing.year.stemTenGod}·지지 ${timing.year.branchTenGod}.`,
          `${tenGodMeaning(timing.year.stemTenGod)}이 올해의 앞면에 놓입니다. 대운의 긴 흐름 안에서 올해 무엇을 시작하고 정리할지 구체화하는 장면으로 읽으세요.`
        ),
        section(
          'month',
          '月',
          '월운의 초점',
          '시간의 작용',
          '명리 계산',
          `${timing.month.label} ${timing.month.ganji}, 천간 ${timing.month.stemTenGod}·지지 ${timing.month.branchTenGod}.`,
          `${tenGodMeaning(timing.month.stemTenGod)}을 한 달의 운영 방식으로 삼아 보세요. 월운은 연운보다 짧아 일정, 대화, 지출처럼 조정 가능한 계획을 세우는 데 적합합니다.`
        ),
        section(
          'day',
          '日',
          '일운의 선택',
          '시간의 작용',
          '명리 계산',
          `${timing.day.label} ${timing.day.ganji}, 천간 ${timing.day.stemTenGod}·지지 ${timing.day.branchTenGod}.`,
          `${tenGodMeaning(timing.day.stemTenGod)}이 선택한 하루의 표면에 드러납니다. 큰 결론보다 오늘 처리할 한 가지 일과 피할 한 가지 소모를 정하는 데 활용하세요.`
        ),
        section(
          'hour',
          '刻',
          '시운의 문',
          '시간의 작용',
          '명리 계산',
          unknownTime
            ? `출생시각 미상입니다. 태어난 시주는 제외하고 선택일의 ${timing.hour.count}개 시진만 비교합니다.`
            : `태어난 시주를 포함해 선택일의 ${timing.hour.count}개 시진을 비교합니다.`,
          unknownTime
            ? `${timing.hour.focus} 출생시각을 추정해 보충하지 않으며, 시운은 일정 선택을 위한 짧은 참고로만 사용합니다.`
            : `${timing.hour.focus} 태어난 시주의 십신과 현재 시진의 십신이 겹치는 방식을 보되 실제 일정과 컨디션을 우선하세요.`
        ),
        section(
          'work',
          '業',
          '일과 역할',
          '삶의 주제',
          '창작 공명',
          copy.work,
          isDeferred
            ? '필요한 명식 정보를 확인한 뒤 일의 방식과 우선순위를 점검하는 참고 자료로 활용하세요.'
            : `${timing.year.stemTenGod}의 ${tenGodMeaning(timing.year.stemTenGod)}과 공명도 ${score}점을 함께 보면, 성패의 예언보다 어떤 역할에 힘을 배분할지 정하는 기준이 됩니다.`
        ),
        section(
          'wealth',
          '財',
          '재물과 기반',
          '삶의 주제',
          '간이 해석',
          `원국과 선택 운에서 재성은 편재·정재로 읽으며, 현재 대운의 앞면은 ${timing.daeun.stemTenGod}입니다.`,
          '편재는 기회와 유통, 정재는 계획과 축적의 언어입니다. 수입과 지출을 기록하고 감당할 범위 안에서 자원을 배분하세요. 이 해석은 투자 수익이나 손실을 예측하지 않습니다.'
        ),
        section(
          'relation',
          '情',
          '관계와 마음',
          '삶의 주제',
          '창작 공명',
          copy.relation,
          `${timing.month.stemTenGod}의 ${tenGodMeaning(timing.month.stemTenGod)}을 대화 방식에 비춰보세요. 관계의 흐름은 정해진 결론이 아니라 대화와 경계 설정에 따라 달라집니다.`
        ),
        section(
          'rhythm',
          '身',
          '몸과 리듬',
          '삶의 주제',
          '간이 해석',
          `${dominantElement}이 두드러질수록 ${usefulElement}의 생활 리듬을 의식적으로 보완해 보세요.`,
          '오행을 질병이나 체질의 진단으로 단정하지 말고 수면, 식사, 활동, 회복의 기록으로 확인하세요. 불편이 이어지면 운세보다 의료 전문가의 판단이 우선입니다.'
        ),
        section(
          'action',
          '行',
          '이번 운의 한 수',
          '삶의 주제',
          '창작 공명',
          copy.action,
          `이번 주에는 ${usefulElement}의 ${ELEMENT_COPY[usefulElement]}을 작은 행동 하나로 옮겨 기록하세요. 맞지 않는 해석은 내려놓고 실제 경험에 도움이 되는 부분만 취하면 됩니다.`
        )
      ]
    };
  }

  return Object.freeze({ buildNarrative });
});
