(function () {
  'use strict';

  var initialized = false;

  function reducedMotion() {
    return !!(window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function focusMain(event) {
    var academyMain = document.getElementById('academyMain');
    if (!academyMain) return;
    event.preventDefault();
    academyMain.focus({ preventScroll: true });
    academyMain.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    document.querySelectorAll('[data-academy-target]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var target = document.getElementById(link.dataset.academyTarget);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
      });
    });

    var skipLink = document.querySelector('.academy-skip-link');
    if (skipLink) skipLink.addEventListener('click', focusMain);
  }

  window.AcademyNav = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
