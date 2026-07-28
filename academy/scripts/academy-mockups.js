(function () {
  'use strict';

  var initialized = false;
  var activeTriggers = new Map();
  var courseDetails = {
    foundation: {
      title: '명리의 기초',
      description: '4주, 12강으로 음양오행과 천간·지지의 언어를 익히는 입문 과정입니다. 각 강의에는 짧은 복습 노트가 함께 제공되는 모습으로 구성했습니다.',
      curriculum: ['음양과 오행의 기본 문법', '천간과 지지의 계절 좌표', '첫 원국을 읽는 순서']
    },
    natal: {
      title: '사주 원국 읽기',
      description: '6주, 18강으로 네 기둥의 관계를 읽고 십성·용신의 기초 관점을 잡는 핵심 과정입니다. 실제 수강 신청이나 저장은 진행되지 않습니다.',
      curriculum: ['월령과 일간의 관계', '십성으로 관계 번역하기', '강약과 균형을 기록하는 법']
    },
    flow: {
      title: '대운·세운·월운',
      description: '5주, 15강으로 대운과 세운이 만나는 시점을 관찰하는 심화 과정입니다. 원국을 단정하지 않고 변화의 순서를 읽는 데 집중합니다.',
      curriculum: ['대운의 십 년 리듬', '세운과 월운을 겹쳐 읽기', '사건 대신 변화의 순서 기록하기']
    },
    period: {
      title: '삼원구운과 시대 해석',
      description: '3주, 9강으로 180년의 시대 순환과 9운의 분위기를 개인의 원국과 함께 바라보는 특강입니다.',
      curriculum: ['상·중·하원 180년 순환', '하원 9운의 시대 배경', '시대와 개인 명식의 거리 두기']
    }
  };
  var planDetails = {
    foundation: '기초 수강권 · 39,000원. 명리의 기초 12강과 원국 읽기 미리보기로 구성한 예시 플랜입니다.',
    full: '정규 과정 수강권 · 129,000원. 네 개 과정 54강과 사례 노트, 시대 해석 특강을 담은 예시 플랜입니다.'
  };
  var postDetails = {
    'month-day': {
      title: '월지와 일간의 관계는 어떤 순서로 읽나요?',
      content: '월지의 계절을 먼저 확인하고 일간이 그 계절에서 어떤 상태인지 살핀 뒤, 다른 글자의 도움과 제약을 차례로 기록해 보세요.',
      answer: '답변 예시 · 강약을 한 단어로 단정하기보다 계절, 뿌리, 흐름의 근거를 각각 적으면 해석이 선명해집니다.'
    },
    daeun: {
      title: '교운기는 몇 년으로 보고 준비하면 좋을까요?',
      content: '대운이 바뀌는 시점을 한 날짜로 단정하기보다 앞뒤 흐름과 실제 생활의 변화를 함께 관찰하는 학습 질문입니다.',
      answer: '답변 예시 · 전후 1~2년의 세운을 함께 비교하고 이미 시작된 변화와 새로 생긴 변화를 구분해 기록해 보세요.'
    },
    elements: {
      title: '토가 많을 때 무조건 답답하다고 해석해도 될까요?',
      content: '오행의 개수만으로 판단하지 않고 계절, 위치, 생극 관계를 함께 살피는 연습입니다.',
      answer: '답변 예시 · 같은 토라도 계절과 주변 글자에 따라 역할이 달라지므로 수량은 출발점으로만 사용합니다.'
    },
    period: {
      title: '삼원구운은 개인 풀이에서 어디까지 적용하나요?',
      content: '삼원구운은 시대의 배경으로 두고 개인 명식과 대운·세운을 대체하지 않는 관점을 확인합니다.',
      answer: '답변 예시 · 시대의 관심사와 환경을 설명하는 보조 층으로 쓰되 개인 사건을 직접 확정하지 않습니다.'
    },
    beginner: {
      title: '초보자가 첫 원국을 읽을 때 놓치기 쉬운 점',
      content: '한 글자에 매달리지 않고 월령부터 네 기둥의 관계를 순서대로 적는 방법을 나눕니다.',
      answer: '답변 예시 · 관찰, 관계, 가설의 세 칸으로 나누어 메모하면 해석과 단정을 구분하기 쉽습니다.'
    }
  };
  var selectedBoardCategory = '전체';

  function openDialog(dialog, trigger) {
    if (!dialog || dialog.open) return;
    activeTriggers.set(dialog, trigger);
    dialog.showModal();
    var closeButton = dialog.querySelector('[data-dialog-close]');
    if (closeButton) closeButton.focus();
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open) return;
    dialog.close();
  }

  function restoreTrigger(dialog) {
    var trigger = activeTriggers.get(dialog);
    activeTriggers.delete(dialog);
    if (trigger && document.contains(trigger)) trigger.focus();
  }

  function focusableControls(dialog) {
    return Array.from(dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (node) {
      var style = window.getComputedStyle(node);
      var box = node.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && box.width > 0
        && box.height > 0;
    });
  }

  function trapDialogFocus(dialog, event) {
    if (event.key !== 'Tab') return;
    var controls = focusableControls(dialog);
    if (!controls.length) {
      event.preventDefault();
      return;
    }

    var first = controls[0];
    var last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setText(parent, selector, value) {
    var node = parent.querySelector(selector);
    if (node) node.textContent = value;
  }

  function handleCourse(trigger) {
    var dialog = document.getElementById('courseDialog');
    var detail = courseDetails[trigger.dataset.courseId] || courseDetails.foundation;
    var card = trigger.closest('.academy-course-card');
    if (card) {
      card.classList.remove('is-paper-opening');
      void card.offsetWidth;
      card.classList.add('is-paper-opening');
      card.addEventListener('animationend', function () {
        card.classList.remove('is-paper-opening');
      }, { once: true });
    }
    setText(dialog, '#courseDialogTitle', detail.title);
    setText(dialog, '[data-course-description]', detail.description);
    var curriculum = dialog.querySelector('[data-course-curriculum]');
    curriculum.replaceChildren();
    detail.curriculum.forEach(function (title) {
      var item = document.createElement('li');
      item.textContent = title;
      curriculum.append(item);
    });
    setText(
      dialog,
      '.academy-dialog-note',
      '이 화면은 교육 홈페이지 목업입니다. 수강 신청이나 결제는 진행되지 않습니다.'
    );
    openDialog(dialog, trigger);
  }

  function handleBoard(trigger) {
    var dialog = document.getElementById('boardDialog');
    var writing = trigger.dataset.boardAction === 'write';
    var readView = dialog.querySelector('[data-board-read-view]');
    var writeView = dialog.querySelector('[data-board-write-view]');
    readView.hidden = writing;
    writeView.hidden = !writing;
    setText(dialog, '#boardDialogTitle', writing ? '질문을 남겨보세요' : '질문 게시글 예시');
    if (writing) {
      setText(
        writeView,
        '[data-board-description]',
        '질문을 작성하는 흐름을 체험하는 목업입니다.'
      );
      setText(
        writeView,
        '.academy-dialog-note',
        '교육용 목업입니다. 작성 내용은 저장되지 않습니다. 다른 사람에게 공개되지 않습니다.'
      );
    } else {
      var detail = postDetails[trigger.dataset.postId] || postDetails['month-day'];
      setText(readView, '[data-board-read-title]', detail.title);
      setText(readView, '[data-board-read-content]', detail.content);
      setText(readView, '[data-board-read-answer]', detail.answer);
    }
    openDialog(dialog, trigger);
  }

  function handlePlan(trigger) {
    var dialog = document.getElementById('paymentDialog');
    setText(dialog, '[data-payment-description]', planDetails[trigger.dataset.planId] || planDetails.foundation);
    setText(
      dialog,
      '.academy-dialog-note',
      '교육용 목업입니다. 결제 정보는 전송·저장되지 않습니다.'
    );
    openDialog(dialog, trigger);
  }

  function handlePillar(trigger) {
    var dialog = document.getElementById('pillarDialog');
    var label = trigger.querySelector('span').textContent.trim();
    var value = trigger.querySelector('[data-pillar-value]').textContent.trim();
    setText(dialog, '#pillarDialogTitle', `${label} ${value} 학습`);
    setText(dialog, '[data-pillar-dialog-value]', value);
    openDialog(dialog, trigger);
  }

  function filterBoard() {
    var search = document.getElementById('academyBoardSearch').value.trim().toLocaleLowerCase('ko');
    var visible = 0;
    document.querySelectorAll('.academy-board-item').forEach(function (item) {
      var categoryMatch = selectedBoardCategory === '전체'
        || item.dataset.boardCategoryName === selectedBoardCategory;
      var searchMatch = !search || item.textContent.toLocaleLowerCase('ko').includes(search);
      item.hidden = !(categoryMatch && searchMatch);
      if (!item.hidden) visible += 1;
    });
    setText(
      document,
      '#academyBoardFilterStatus',
      `${visible}개의 질문이 표시되었습니다.`
    );
  }

  function selectBoardCategory(trigger) {
    selectedBoardCategory = trigger.dataset.boardCategory;
    document.querySelectorAll('[data-board-category]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button === trigger));
    });
    filterBoard();
  }

  function bindDialog(dialog) {
    if (!dialog) return;
    dialog.addEventListener('close', function () { restoreTrigger(dialog); });
    dialog.addEventListener('keydown', function (event) { trapDialogFocus(dialog, event); });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.querySelectorAll('[data-dialog-close]').forEach(function (button) {
      button.addEventListener('click', function () { closeDialog(dialog); });
    });
  }

  function bindForms() {
    document.querySelectorAll('[data-board-form], [data-payment-form]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var note = form.querySelector('.academy-dialog-note');
        if (note) {
          note.textContent = form.hasAttribute('data-payment-form')
            ? '결제 화면 목업을 확인했습니다. 실제 결제가 발생하지 않으며 선택한 수단은 전송·저장되지 않습니다.'
            : '작성 흐름 목업을 확인했습니다. 작성 내용은 저장되지 않습니다. 다른 사람에게 공개되지 않습니다.';
        }
      });
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    ['courseDialog', 'boardDialog', 'paymentDialog', 'pillarDialog'].forEach(function (id) {
      bindDialog(document.getElementById(id));
    });
    bindForms();
    document.getElementById('academyBoardSearch').addEventListener('input', filterBoard);

    document.addEventListener('click', function (event) {
      var enrollment = event.target.closest('[data-course-enroll]');
      if (enrollment) {
        setText(
          document.getElementById('courseDialog'),
          '.academy-dialog-note',
          '수강 흐름을 확인했습니다. 이 목업에서는 신청하거나 저장하지 않습니다.'
        );
        return;
      }
      var category = event.target.closest('[data-board-category]');
      if (category) {
        selectBoardCategory(category);
        return;
      }
      var trigger = event.target.closest(
        '[data-course-id], [data-board-action], [data-plan-id], .academy-pillar-card'
      );
      if (!trigger) return;
      if (trigger.dataset.courseId) handleCourse(trigger);
      if (trigger.dataset.boardAction) handleBoard(trigger);
      if (trigger.dataset.planId) handlePlan(trigger);
      if (trigger.classList.contains('academy-pillar-card')) handlePillar(trigger);
    });
  }

  window.AcademyMockups = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
