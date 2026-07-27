(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendPalpumFortune = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function freezeCopy(record) {
    return Object.freeze({
      ...record,
      areas: Object.freeze({ ...record.areas })
    });
  }

  const PALPUM_COPY = Object.freeze({
    자축품: freezeCopy({
      scene: '한겨울 땅속에서 다음 움직임을 준비하는 물길',
      role: '흩어진 단서를 조용히 모아 다음 시작의 바탕을 만드는 역할',
      opportunity: '서두르지 않고 정보와 사람을 연결할 때 새 선택지가 보입니다.',
      burden: '생각을 오래 품기만 하면 결정할 시점을 놓칠 수 있습니다.',
      preparation: '확인할 사실과 아직 모르는 부분을 나누어 작은 첫걸음을 정하세요.',
      areas: {
        relationship: '말보다 경청을 앞세우되 필요한 마음은 제때 표현하세요.',
        career: '조사, 설계, 준비처럼 보이지 않는 기반 작업에서 강점이 드러납니다.',
        money: '큰 결정보다 현금 흐름과 반복 지출을 먼저 점검하세요.',
        health: '수면과 회복 시간을 일정하게 지키며 생활 리듬을 관찰하세요.'
      }
    }),
    인묘품: freezeCopy({
      scene: '얼어 있던 땅을 밀어 올리며 방향을 세우는 새순',
      role: '멈춘 장면에 첫 방향을 제시하고 움직임을 시작하는 역할',
      opportunity: '불분명한 일에 첫 기준과 순서를 제안할 때 길이 열립니다.',
      burden: '속도가 앞서면 주변의 준비 상태를 놓치기 쉽습니다.',
      preparation: '시작 조건과 중단 조건을 함께 적어 추진력을 안전하게 쓰세요.',
      areas: {
        relationship: '먼저 손을 내밀되 상대가 선택할 시간을 남겨 두세요.',
        career: '신규 과제와 초기 기획에서 주도성을 분명히 보여 주세요.',
        money: '성장 기대만 보지 말고 시작 비용의 상한을 정하세요.',
        health: '활동량을 갑자기 늘리기보다 몸의 반응에 맞춰 단계적으로 조절하세요.'
      }
    }),
    묘진품: freezeCopy({
      scene: '가지와 잎이 서로 자리를 나누며 넓어지는 봄의 뜰',
      role: '관계와 자원을 엮어 성장을 지속 가능한 모양으로 다듬는 역할',
      opportunity: '서로 다른 강점을 연결하고 운영 방식을 정리할 때 성과가 커집니다.',
      burden: '모두를 배려하다가 자신의 기준이 흐려질 수 있습니다.',
      preparation: '양보할 것과 지킬 것을 미리 구분해 협업의 경계를 세우세요.',
      areas: {
        relationship: '친절한 조율과 분명한 경계를 함께 보여 주세요.',
        career: '협업 구조, 고객 경험, 세부 운영을 다듬는 일에 집중하세요.',
        money: '작은 수입과 지출을 묶어 장기적으로 유지할 구조를 만드세요.',
        health: '일정 사이에 짧은 휴식을 배치해 긴장을 누적시키지 마세요.'
      }
    }),
    사오품: freezeCopy({
      scene: '한낮의 빛이 사물의 윤곽을 또렷하게 드러내는 장면',
      role: '핵심을 밖으로 밝히고 사람들이 움직일 명분을 만드는 역할',
      opportunity: '메시지와 목표를 분명히 보여 줄수록 참여와 반응이 모입니다.',
      burden: '주목과 속도가 커지면 소모와 과장이 함께 커질 수 있습니다.',
      preparation: '보여 줄 한 가지와 끝까지 책임질 범위를 먼저 정하세요.',
      areas: {
        relationship: '따뜻하게 표현하되 상대의 반응을 결론처럼 단정하지 마세요.',
        career: '발표, 설득, 공개 결과물처럼 가시성이 필요한 일에 힘을 모으세요.',
        money: '분위기에 따른 지출을 줄이고 공개 활동의 비용을 따로 관리하세요.',
        health: '과열된 일정 뒤에는 의도적인 휴식과 수분 섭취 시간을 두세요.'
      }
    }),
    오미품: freezeCopy({
      scene: '강한 햇빛 뒤에 온도와 결실을 세심하게 돌보는 여름의 손길',
      role: '사람과 결과물의 온도를 살피며 완성도를 안정시키는 역할',
      opportunity: '세심한 돌봄과 품질 관리가 신뢰와 재방문으로 이어집니다.',
      burden: '책임을 혼자 떠안으면 친절이 피로로 바뀔 수 있습니다.',
      preparation: '도울 범위와 넘겨줄 일을 구분해 오래 갈 리듬을 만드세요.',
      areas: {
        relationship: '돌봄을 주고받는 균형을 확인하며 부탁을 구체적으로 말하세요.',
        career: '품질, 교육, 후속 관리처럼 신뢰를 축적하는 역할에 집중하세요.',
        money: '생활의 안정성을 높이는 지출과 감정적인 소비를 구분하세요.',
        health: '식사와 휴식 시간을 미루지 말고 피로의 변화를 기록하세요.'
      }
    }),
    신유품: freezeCopy({
      scene: '결실을 거두기 위해 날을 세우고 기준을 고르는 초가을',
      role: '복잡한 장면에서 기준을 세우고 성과가 남을 선택을 하는 역할',
      opportunity: '우선순위와 품질 기준을 분명히 할수록 결과가 또렷해집니다.',
      burden: '판단이 날카로워지면 과정의 사정과 사람의 마음을 놓칠 수 있습니다.',
      preparation: '결정 기준을 공개하고 수정 가능한 여지를 한 칸 남겨 두세요.',
      areas: {
        relationship: '평가보다 관찰을 먼저 말해 대화의 문을 열어 두세요.',
        career: '검토, 결정, 정리처럼 결과의 기준을 세우는 일에 강점을 쓰세요.',
        money: '수익 약속보다 계약 조건과 손실 한도를 먼저 확인하세요.',
        health: '긴장과 피로가 쌓이지 않도록 작업 사이에 몸을 풀어 주세요.'
      }
    }),
    유술품: freezeCopy({
      scene: '수확한 것을 골라 오래 남길 모양으로 정제하는 가을의 공방',
      role: '차이를 세밀하게 살피고 결과의 완성도와 신뢰를 높이는 역할',
      opportunity: '마감, 교정, 재협상처럼 작은 차이가 큰 신뢰를 만드는 일에 유리합니다.',
      burden: '완벽을 기다리면 마무리와 공유가 늦어질 수 있습니다.',
      preparation: '완료 기준과 검토 횟수를 정해 정교함을 실제 결과로 남기세요.',
      areas: {
        relationship: '세심한 관찰을 지적보다 구체적인 요청으로 바꾸어 말하세요.',
        career: '편집, 검증, 품질 보증처럼 마지막 차이를 만드는 역할이 돋보입니다.',
        money: '계약과 정산의 세부 항목을 확인하고 기록을 정리하세요.',
        health: '반복 작업 중 자세와 눈의 피로를 자주 확인하세요.'
      }
    }),
    해자품: freezeCopy({
      scene: '밤의 넓은 물이 여러 길을 품고 다음 순환으로 흐르는 장면',
      role: '막힌 경계를 넘어 정보와 가능성의 새 통로를 찾는 역할',
      opportunity: '낯선 분야와 사람 사이를 오가며 새로운 흐름을 발견할 수 있습니다.',
      burden: '가능성을 넓히기만 하면 집중할 곳과 마감이 흐려질 수 있습니다.',
      preparation: '탐색 시간과 결정 시간을 나누고 돌아올 기준점을 정하세요.',
      areas: {
        relationship: '상대의 깊이를 존중하되 추측보다 질문으로 확인하세요.',
        career: '연구, 이동, 연결처럼 경계를 넘는 과제에서 시야를 활용하세요.',
        money: '새 기회를 시험할 예산을 전체 생활 자금과 분리하세요.',
        health: '활동과 휴식의 시간이 흔들리지 않도록 일상의 기준점을 만드세요.'
      }
    })
  });

  const UNCERTAIN_COPY = freezeCopy({
    opportunity: '두 후보에 공통된 준비와 관찰을 먼저 적용하면 성급한 단정을 피할 수 있습니다.',
    burden: '출생 시각을 확인하기 전 한 후보의 역할만 사실처럼 받아들이지 마세요.',
    preparation: '가족 기록과 출생 서류에서 시각을 확인한 뒤 팔품을 다시 판정하세요.',
    areas: {
      relationship: '후보 해석보다 실제 대화와 반복되는 관계 경험을 우선하세요.',
      career: '공통으로 필요한 준비를 실행하되 역할의 방향은 확정하지 마세요.',
      money: '후보에 따른 전망보다 현재의 수입, 지출, 감당 범위를 확인하세요.',
      health: '팔품 후보를 건강 판단에 사용하지 말고 생활 기록을 참고하세요.'
    }
  });

  const STEM_ELEMENTS = Object.freeze([
    '목', '목', '화', '화', '토', '토', '금', '금', '수', '수'
  ]);
  const BRANCH_ELEMENTS = Object.freeze([
    '수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'
  ]);
  const BRANCH_MAIN_STEMS = Object.freeze([9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8]);
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
    화: '금',
    토: '수',
    금: '목',
    수: '화'
  });
  const RULERS = Object.freeze({
    갑목: Object.freeze({ stem: 0, element: '목' }),
    을목: Object.freeze({ stem: 1, element: '목' }),
    병화: Object.freeze({ stem: 2, element: '화' }),
    정화: Object.freeze({ stem: 3, element: '화' }),
    경금: Object.freeze({ stem: 6, element: '금' }),
    신금: Object.freeze({ stem: 7, element: '금' }),
    임수: Object.freeze({ stem: 8, element: '수' }),
    계수: Object.freeze({ stem: 9, element: '수' })
  });

  function rulerInfo(ruler) {
    const info = RULERS[ruler];
    if (!info) throw new RangeError('unknown Palpum ruler');
    return info;
  }

  function countRulerPresence(saju, ruler) {
    const info = rulerInfo(ruler);
    const chart = saju && typeof saju === 'object' ? saju : {};
    const stemCount = ['yStem', 'mStem', 'dStem', 'hStem']
      .filter(key => chart[key] === info.stem)
      .length;
    const branchCount = ['yBranch', 'mBranch', 'dBranch', 'hBranch']
      .filter(key => BRANCH_MAIN_STEMS[chart[key]] === info.stem)
      .length;
    const directCount = stemCount + branchCount;

    if (directCount > 0) return directCount;
    const elementIndex = ELEMENTS.indexOf(info.element);
    const ohaengCount = Array.isArray(chart.ohaeng) ? chart.ohaeng[elementIndex] : 0;
    return Number.isFinite(ohaengCount) && ohaengCount > 0 ? ohaengCount : 0;
  }

  function relationContribution(rulerElement, observedElement) {
    if (!ELEMENTS.includes(observedElement)) return 0;
    if (observedElement === rulerElement || GENERATES[observedElement] === rulerElement) {
      return 1;
    }
    if (
      GENERATES[rulerElement] === observedElement ||
      CONTROLS[observedElement] === rulerElement
    ) {
      return -1;
    }
    return 0;
  }

  function relationScore(ruler, pillar) {
    const info = rulerInfo(ruler);
    const period = pillar && typeof pillar === 'object' ? pillar : {};
    return relationContribution(info.element, STEM_ELEMENTS[period.stem]) +
      relationContribution(info.element, BRANCH_ELEMENTS[period.branch]);
  }

  function eraRelationScore(ruler, era) {
    const info = rulerInfo(ruler);
    const context = era && typeof era === 'object' ? era : {};
    return relationContribution(info.element, context.element);
  }

  function selectState(signal) {
    if (signal.timingSupport >= 2 && signal.rulerVisible > 0) return '발현';
    if (signal.timingSupport <= -2) return '전환';
    if (signal.eraPressure < 0) return '조율';
    return '축적';
  }

  function headlineFor(type, state) {
    const headlines = {
      발현: `${type}의 역할이 성과로 드러나는 시기`,
      전환: `${type}의 기준을 바꾸어 새 역할로 옮기는 시기`,
      조율: `${type}의 역할과 주변 속도를 조율하는 시기`,
      축적: `${type}의 역할을 위한 기반을 축적하는 시기`
    };
    return headlines[state];
  }

  function targetLabel(target) {
    return target.month ? `${target.year}년 ${target.month}월` : `${target.year}년`;
  }

  function eraEvidence(era, eraPressure) {
    return Object.freeze({
      kind: '시대',
      label: `${era.yun}운 · ${era.symbol}`,
      detail: `${era.element} 기운의 시대 배경 관계는 ${eraPressure}이며 개인 판정을 대신하지 않습니다.`
    });
  }

  function composeUncertainFortune(input) {
    const candidates = Array.from(new Set(input.palpum.candidates))
      .filter(type => PALPUM_COPY[type]);
    const accuracyDetail = input.palpum.accuracy === 'historical-approximation'
      ? ' 역사 범위 근사 계산도 함께 적용되었습니다.'
      : '';

    return Object.freeze({
      version: 'palpum-v1',
      state: '축적',
      headline: '팔품 경계에서 공통 역할을 먼저 살피는 시기',
      opportunity: UNCERTAIN_COPY.opportunity,
      burden: UNCERTAIN_COPY.burden,
      preparation: UNCERTAIN_COPY.preparation,
      areas: UNCERTAIN_COPY.areas,
      evidence: Object.freeze([
        Object.freeze({
          kind: '팔품',
          label: `${candidates.join(' · ')} 후보`,
          detail: `출생 시각을 확인해야 두 후보 중 하나를 판정할 수 있어 단일 팔품을 확정하지 않습니다.${accuracyDetail}`
        }),
        Object.freeze({
          kind: '시기',
          label: targetLabel(input.target),
          detail: '출생 팔품을 확인한 뒤 선택 운과 대운의 관계를 비교합니다.'
        }),
        Object.freeze({
          kind: '시대',
          label: `${input.era.yun}운 · ${input.era.symbol}`,
          detail: `${input.era.element} 기운은 후보를 대신 고르지 않는 시대 배경입니다.`
        })
      ]),
      tags: Object.freeze([
        ...candidates,
        '팔품 경계 가능성',
        ...(input.palpum.accuracy === 'historical-approximation' ? ['역사 범위 근사'] : []),
        '취명선 창작 해석',
        '비공식 해석'
      ])
    });
  }

  function composePalpumFortune(input) {
    if (input.palpum.boundaryUncertain === true) {
      return composeUncertainFortune(input);
    }
    const copy = PALPUM_COPY[input.palpum.type];
    if (!copy) throw new RangeError('unknown Palpum type');
    const signal = Object.freeze({
      rulerVisible: countRulerPresence(input.saju, input.palpum.ruler),
      timingSupport: relationScore(input.palpum.ruler, input.target),
      daeunSupport: relationScore(input.palpum.ruler, input.daeun),
      eraPressure: eraRelationScore(input.palpum.ruler, input.era)
    });
    const state = selectState(signal);

    return Object.freeze({
      version: 'palpum-v1',
      state,
      headline: headlineFor(input.palpum.type, state),
      opportunity: copy.opportunity,
      burden: copy.burden,
      preparation: copy.preparation,
      areas: copy.areas,
      evidence: Object.freeze([
        Object.freeze({
          kind: '팔품',
          label: `${input.palpum.type} · 당령 ${input.palpum.ruler}${
            input.palpum.accuracy === 'historical-approximation' ? ' · 역사 범위 근사' : ''
          }`,
          detail: `${copy.scene}. ${copy.role}로 읽으며, 원국의 당령 흔적은 ${signal.rulerVisible}곳입니다.`
        }),
        Object.freeze({
          kind: '시기',
          label: targetLabel(input.target),
          detail: `선택 운 관계 ${signal.timingSupport}, 대운 관계 ${signal.daeunSupport}의 범위가 정해진 신호를 함께 봅니다.`
        }),
        eraEvidence(input.era, signal.eraPressure)
      ]),
      tags: Object.freeze([
        input.palpum.type,
        state,
        `${input.era.yun}운`,
        ...(input.palpum.accuracy === 'historical-approximation' ? ['역사 범위 근사'] : []),
        '취명선 창작 해석',
        '비공식 해석'
      ])
    });
  }

  return Object.freeze({ composePalpumFortune });
});
