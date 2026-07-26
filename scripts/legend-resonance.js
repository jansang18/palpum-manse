(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendResonance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ELEMENTS = Object.freeze(['목', '화', '토', '금', '수']);
  const GENERATES = Object.freeze({
    목: '화',
    화: '토',
    토: '금',
    금: '수',
    수: '목'
  });
  const CONTROLS = Object.freeze({
    목: '토',
    토: '수',
    수: '화',
    화: '금',
    금: '목'
  });
  const RELATION_RATIOS = Object.freeze({
    동조: 1,
    생조: 0.9,
    표출: 0.75,
    압력: 0.35,
    제어: 0.55
  });

  function normalizeElement(value) {
    return ELEMENTS.includes(value) ? value : null;
  }

  function relationToEra(personalElement, eraElement) {
    if (!personalElement || !eraElement) return null;
    if (personalElement === eraElement) return '동조';
    if (GENERATES[eraElement] === personalElement) return '생조';
    if (GENERATES[personalElement] === eraElement) return '표출';
    if (CONTROLS[eraElement] === personalElement) return '압력';
    if (CONTROLS[personalElement] === eraElement) return '제어';
    return null;
  }

  function clampScore(value, max) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(max, Math.max(0, Math.round(value)));
  }

  function withParticle(word, withFinal, withoutFinal) {
    const code = word.charCodeAt(word.length - 1);
    const hasFinal = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
    return `${word}${hasFinal ? withFinal : withoutFinal}`;
  }

  function relationScore(personalElement, eraElement, max) {
    const relation = relationToEra(personalElement, eraElement);
    if (!relation) return 0;
    return clampScore(max * RELATION_RATIOS[relation], max);
  }

  function makeRelationPart(label, personalElement, eraElement, max) {
    const relation = relationToEra(personalElement, eraElement);
    if (!relation) {
      return {
        score: 0,
        max,
        reason: `${label} 정보가 없어 이 항목은 반영하지 않았습니다.`
      };
    }
    return {
      score: relationScore(personalElement, eraElement, max),
      max,
      reason: `${label} ${withParticle(personalElement, '과', '와')} 시대 오행 ${eraElement}의 관계는 ${relation}입니다.`
    };
  }

  function normalizeCount(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }

  function makeBalancePart(elements, eraElement) {
    const max = 20;
    if (!eraElement || !elements || typeof elements !== 'object' || Array.isArray(elements)) {
      return {
        score: 0,
        max,
        reason: '오행 분포 정보가 없어 균형 보완도를 반영하지 않았습니다.'
      };
    }

    const counts = Object.fromEntries(
      ELEMENTS.map((element) => [element, normalizeCount(elements[element])])
    );
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total <= 0) {
      return {
        score: 0,
        max,
        reason: '유효한 오행 수치가 없어 균형 보완도를 반영하지 않았습니다.'
      };
    }

    const ideal = total / ELEMENTS.length;
    const eraCount = counts[eraElement];
    const complement = Math.min(1, Math.max(0, (ideal * 2 - eraCount) / (ideal * 2)));
    const score = clampScore(max * complement, max);
    return {
      score,
      max,
      reason: `시대 오행 ${withParticle(eraElement, '은', '는')} 명식의 ${eraCount}개 분포를 기준으로 균형 보완도 ${score}점을 얻었습니다.`
    };
  }

  function calculateResonance(context) {
    const source = context && typeof context === 'object' && !Array.isArray(context)
      ? context
      : {};
    const eraElement = normalizeElement(source.eraElement);
    const dayElement = normalizeElement(source.dayElement);
    const usefulElement = normalizeElement(source.usefulElement);
    const daeunElement = normalizeElement(source.daeunElement);
    const shortElement = normalizeElement(source.shortElement);
    const relation = relationToEra(dayElement, eraElement) || '동조';

    const parts = {
      useful: makeRelationPart('용신 후보', usefulElement, eraElement, 35),
      day: makeRelationPart('일간', dayElement, eraElement, 25),
      balance: makeBalancePart(source.elements, eraElement),
      daeun: makeRelationPart('대운', daeunElement, eraElement, 15),
      short: makeRelationPart('단기 운', shortElement, eraElement, 5)
    };
    const score = clampScore(
      Object.values(parts).reduce((sum, part) => sum + part.score, 0),
      100
    );

    return { relation, score, parts };
  }

  return Object.freeze({ calculateResonance });
});
