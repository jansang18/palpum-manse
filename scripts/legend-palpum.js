(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendPalpum = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PALPUM_DEFINITIONS = Object.freeze([
    Object.freeze({ type: '자축품', startTerm: '동지', endTerm: '입춘', ruler: '계수' }),
    Object.freeze({ type: '인묘품', startTerm: '입춘', endTerm: '춘분', ruler: '갑목' }),
    Object.freeze({ type: '묘진품', startTerm: '춘분', endTerm: '입하', ruler: '을목' }),
    Object.freeze({ type: '사오품', startTerm: '입하', endTerm: '하지', ruler: '병화' }),
    Object.freeze({ type: '오미품', startTerm: '하지', endTerm: '입추', ruler: '정화' }),
    Object.freeze({ type: '신유품', startTerm: '입추', endTerm: '추분', ruler: '경금' }),
    Object.freeze({ type: '유술품', startTerm: '추분', endTerm: '입동', ruler: '신금' }),
    Object.freeze({ type: '해자품', startTerm: '입동', endTerm: '동지', ruler: '임수' })
  ]);

  function definitionAt(instantMs, boundaries) {
    const active = boundaries
      .filter(boundary => boundary.instantMs <= instantMs)
      .at(-1);
    const definition = PALPUM_DEFINITIONS.find(item => item.startTerm === active?.name);
    if (!definition) throw new RangeError('birth instant is outside supplied boundaries');
    return definition;
  }

  function classifyPalpum(input) {
    if (!Number.isFinite(input.instantMs)) {
      throw new TypeError('instantMs must be finite');
    }
    const definition = definitionAt(input.instantMs, input.boundaries);
    const candidateInstants = [input.instantMs];
    if (input.possibleRange) {
      candidateInstants.push(input.possibleRange.startMs, input.possibleRange.endMs);
    }
    const candidates = Object.freeze(
      candidateInstants
        .sort((left, right) => left - right)
        .map(instantMs => definitionAt(instantMs, input.boundaries))
        .filter((item, index, items) => items.findIndex(candidate => candidate.type === item.type) === index)
        .map(item => item.type)
    );
    return Object.freeze({
      type: definition.type,
      ruler: definition.ruler,
      startTerm: definition.startTerm,
      endTerm: definition.endTerm,
      accuracy: input.accuracy || 'exact',
      candidates,
      boundaryUncertain: candidates.length > 1
    });
  }

  return Object.freeze({ PALPUM_DEFINITIONS, classifyPalpum });
});
