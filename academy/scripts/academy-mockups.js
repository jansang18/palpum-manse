(function () {
  'use strict';

  var initialized = false;
  var activeTriggers = new Map();
  var courseDetails = {
    foundation: {
      title: '명리의 기초',
      description: '4주, 12강으로 음양오행과 천간·지지의 언어를 익히는 입문 과정입니다. 각 강의에는 짧은 복습 노트가 함께 제공되는 모습으로 구성했습니다.'
    },
    natal: {
      title: '사주 원국 읽기',
      description: '6주, 18강으로 네 기둥의 관계를 읽고 십성·용신의 기초 관점을 잡는 핵심 과정입니다. 실제 수강 신청이나 저장은 진행되지 않습니다.'
    },
    flow: {
      title: '대운·세운·월운',
      description: '5주, 15강으로 대운과 세운이 만나는 시점을 관찰하는 심화 과정입니다. 원국을 단정하지 않고 변화의 순서를 읽는 데 집중합니다.'
    },
    period: {
      title: '삼원구운과 시대 해석',
      description: '3주, 9강으로 180년의 시대 순환과 9운의 분위기를 개인의 원국과 함께 바라보는 특강입니다.'
    }
  };
  var planDetails = {
    foundation: '기초 수강권 · 39,000원. 명리의 기초 12강과 원국 읽기 미리보기로 구성한 예시 플랜입니다.',
    full: '정규 과정 수강권 · 129,000원. 네 개 과정 54강과 사례 노트, 시대 해석 특강을 담은 예시 플랜입니다.'
  };

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

  function setText(parent, selector, value) {
    var node = parent.querySelector(selector);
    if (node) node.textContent = value;
  }

  function handleCourse(trigger) {
    var dialog = document.getElementById('courseDialog');
    var detail = courseDetails[trigger.dataset.courseId] || courseDetails.foundation;
    setText(dialog, '#courseDialogTitle', detail.title);
    setText(dialog, '[data-course-description]', detail.description);
    openDialog(dialog, trigger);
  }

  function handleBoard(trigger) {
    var dialog = document.getElementById('boardDialog');
    var writing = trigger.dataset.boardAction === 'write';
    setText(dialog, '#boardDialogTitle', writing ? '질문을 남겨보세요' : '질문 게시글 예시');
    setText(
      dialog,
      '[data-board-description]',
      writing
        ? '질문을 작성하는 흐름을 체험하는 목업입니다.'
        : '게시글과 답변이 이어지는 모습을 보여주는 예시 화면입니다.'
    );
    openDialog(dialog, trigger);
  }

  function handlePlan(trigger) {
    var dialog = document.getElementById('paymentDialog');
    setText(dialog, '[data-payment-description]', planDetails[trigger.dataset.planId] || planDetails.foundation);
    openDialog(dialog, trigger);
  }

  function bindDialog(dialog) {
    if (!dialog) return;
    dialog.addEventListener('close', function () { restoreTrigger(dialog); });
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
            ? '결제 화면 목업을 확인했습니다. 실제 결제가 발생하지 않으며 입력한 정보는 전송·저장되지 않습니다.'
            : '작성 흐름 목업을 확인했습니다. 작성 내용은 저장되지 않습니다. 다른 사람에게 공개되지 않습니다.';
        }
      });
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    ['courseDialog', 'boardDialog', 'paymentDialog'].forEach(function (id) {
      bindDialog(document.getElementById(id));
    });
    bindForms();

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-course-id], [data-board-action], [data-plan-id]');
      if (!trigger) return;
      if (trigger.dataset.courseId) handleCourse(trigger);
      if (trigger.dataset.boardAction) handleBoard(trigger);
      if (trigger.dataset.planId) handlePlan(trigger);
    });
  }

  window.AcademyMockups = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
