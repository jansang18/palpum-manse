(function () {
  'use strict';

  function reducedMotion() {
    return !!(window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function init() {
    document.querySelectorAll('[data-academy-target]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var target = document.getElementById(link.dataset.academyTarget);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
      });
    });
  }

  window.AcademyNav = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
