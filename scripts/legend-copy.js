(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendCopy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ELEMENTS = Object.freeze(['목', '화', '토', '금', '수']);
  const RELATIONS = Object.freeze(['동조', '생조', '표출', '압력', '제어', '판단 보류']);
  const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff<>"'&/=`\\]/gu;

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

  function sanitizePlainText(value, fallback, maxLength) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(UNSAFE_TEXT, '').trim();
    const limited = Array.from(cleaned).slice(0, maxLength).join('');
    return limited || fallback;
  }

  function normalizeScore(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  function buildNarrative(context) {
    const source = context && typeof context === 'object' && !Array.isArray(context)
      ? context
      : {};
    const era = source.era && typeof source.era === 'object' && !Array.isArray(source.era)
      ? source.era
      : {};
    const resonance = source.resonance
      && typeof source.resonance === 'object'
      && !Array.isArray(source.resonance)
      ? source.resonance
      : {};

    const name = sanitizePlainText(source.name, '당신', 40);
    const symbol = sanitizePlainText(era.symbol, '흐름', 20);
    const element = ELEMENTS.includes(era.element) ? era.element : '화';
    const yun = Number.isInteger(era.yun) && era.yun >= 1 && era.yun <= 9 ? era.yun : 9;
    const relation = RELATIONS.includes(resonance.relation)
      ? resonance.relation
      : '판단 보류';
    const score = normalizeScore(resonance.score);
    const copy = RELATION_COPY[relation];
    const isDeferred = relation === '판단 보류';

    return {
      heroTitle: `${symbol}의 시대에 선 ${name}`,
      heroSummary: isDeferred
        ? `${yun}운 ${element}의 흐름과 개인 명식의 관계는 판단 보류입니다. 시대 오행과 일간 정보를 확인하면 공명도를 계산할 수 있습니다.`
        : `${yun}운 ${element}의 흐름과 개인 명식의 관계는 ${relation}이며 공명도는 ${score}점입니다. ${copy.tone}`,
      sections: [
        {
          key: 'era',
          hanja: '時',
          title: '시대와 나',
          summary: isDeferred
            ? `${symbol}을 상징하는 ${yun}운의 시대 배경만 확인했습니다.`
            : `${symbol}을 상징하는 ${yun}운과 ${relation}의 관계를 이룹니다.`,
          body: isDeferred
            ? `${copy.tone} 시대의 기운은 배경이며 필요한 정보 없이 개인의 흐름을 단정하지 않습니다.`
            : `${copy.tone} 시대의 기운은 배경이며 선택과 행동이 실제 방향을 만듭니다.`
        },
        {
          key: 'work',
          hanja: '業',
          title: '일과 역할',
          summary: copy.work,
          body: isDeferred
            ? '필요한 명식 정보를 확인한 뒤 일의 방식과 우선순위를 점검하는 참고 자료로 활용하세요.'
            : `지금은 공명도 ${score}점을 성패의 예언으로 보기보다 일의 방식과 우선순위를 점검하는 기준으로 활용할 때입니다.`
        },
        {
          key: 'wealth',
          hanja: '財',
          title: '재물과 기반',
          summary: '큰 결과보다 오래 유지할 수 있는 기반을 먼저 살펴보세요.',
          body: '수입과 지출의 흐름을 기록하고 감당할 수 있는 범위 안에서 자원을 배분하면 변화 속에서도 중심을 지킬 수 있습니다.'
        },
        {
          key: 'relation',
          hanja: '情',
          title: '관계와 마음',
          summary: copy.relation,
          body: '관계의 흐름은 정해진 결론이 아니라 대화와 경계 설정에 따라 달라집니다. 중요한 말일수록 서두르지 말고 확인해 주세요.'
        },
        {
          key: 'rhythm',
          hanja: '身',
          title: '몸과 리듬',
          summary: '활동과 회복의 간격을 일정하게 만드는 것이 운의 바탕입니다.',
          body: '몸의 신호를 운세로 단정하지 말고 수면과 식사와 휴식의 리듬을 관찰하세요. 불편이 이어지면 전문가의 도움을 받는 것이 우선입니다.'
        },
        {
          key: 'action',
          hanja: '行',
          title: '이번 운의 한 수',
          summary: copy.action,
          body: '작은 실행을 기록하고 한 주 뒤 결과를 돌아보세요. 맞지 않는 해석은 내려놓고 실제 경험에 도움이 되는 부분만 취하면 됩니다.'
        }
      ]
    };
  }

  return Object.freeze({ buildNarrative });
});
