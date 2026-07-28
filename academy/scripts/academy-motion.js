(function () {
  'use strict';

  var initialized = false;
  var framePending = false;
  var reduced = false;
  var pointerX = 0;
  var pointerY = 0;
  var scrollY = 0;
  var observer = null;
  var inputAttached = false;
  var root = document.documentElement;
  var hero = null;
  var motionQuery = null;

  function countTarget(node) {
    return Number.parseInt(node.dataset.count, 10) || 0;
  }

  function finishCount(node) {
    node.textContent = String(countTarget(node));
    node.dataset.countComplete = 'true';
  }

  function revealImmediately() {
    document.querySelectorAll('[data-reveal]').forEach(function (node) {
      node.classList.add('is-revealed');
    });
    document.querySelectorAll('[data-count]').forEach(finishCount);
  }

  function animateCount(node) {
    if (node.dataset.countStarted === 'true') return;
    node.dataset.countStarted = 'true';

    var target = countTarget(node);
    var startedAt = 0;
    var duration = 1100;

    function tick(timestamp) {
      if (reduced) {
        finishCount(node);
        return;
      }
      if (!startedAt) startedAt = timestamp;
      var progress = Math.min((timestamp - startedAt) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(target * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        finishCount(node);
      }
    }

    requestAnimationFrame(tick);
  }

  function observeReveals() {
    if (observer) observer.disconnect();

    if (!('IntersectionObserver' in window)) {
      revealImmediately();
      return;
    }

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        entry.target.querySelectorAll('[data-count]').forEach(animateCount);
        if (entry.target.matches('[data-count]')) animateCount(entry.target);
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.12
    });

    document.querySelectorAll('[data-reveal], [data-count]').forEach(function (node) {
      observer.observe(node);
    });
  }

  function scheduleFrame() {
    if (framePending || reduced || document.hidden) return;
    if (!hero) return;
    framePending = true;
    requestAnimationFrame(function () {
      framePending = false;
      hero.style.setProperty('--pointer-x', pointerX.toFixed(3));
      hero.style.setProperty('--pointer-y', pointerY.toFixed(3));
      hero.style.setProperty(
        '--scroll-depth',
        Math.min(scrollY / Math.max(window.innerHeight, 1), 3).toFixed(3)
      );
    });
  }

  function handlePointer(event) {
    pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
    pointerY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    scheduleFrame();
  }

  function handleScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    scheduleFrame();
  }

  function attachInput() {
    if (inputAttached || reduced) return;
    inputAttached = true;
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  function detachInput() {
    if (!inputAttached) return;
    inputAttached = false;
    window.removeEventListener('pointermove', handlePointer);
    window.removeEventListener('scroll', handleScroll);
  }

  function handleVisibility() {
    document.body.classList.toggle('is-motion-paused', document.hidden);
    if (document.hidden) {
      detachInput();
      return;
    }
    if (!reduced) attachInput();
    scheduleFrame();
  }

  function applyPreference(event) {
    reduced = event.matches;
    root.classList.toggle('is-reduced-motion', reduced);

    if (reduced) {
      detachInput();
      if (observer) observer.disconnect();
      hero.style.setProperty('--pointer-x', '0');
      hero.style.setProperty('--pointer-y', '0');
      hero.style.setProperty('--scroll-depth', '0');
      revealImmediately();
      return;
    }

    attachInput();
    observeReveals();
    handleVisibility();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    hero = document.getElementById('academyHome');
    root.classList.add('academy-motion-ready');
    motionQuery = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };
    reduced = motionQuery.matches;

    document.addEventListener('visibilitychange', handleVisibility);
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', applyPreference);
    }

    if (reduced) {
      root.classList.add('is-reduced-motion');
      revealImmediately();
      return;
    }

    attachInput();
    observeReveals();
    handleVisibility();
  }

  window.AcademyMotion = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
