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
  var manseForm = null;
  var manseFocused = false;
  var manseResultOpen = false;
  var motionQuery = null;
  var seasonStage = null;
  var seasonScenes = [];
  var seasonControls = [];
  var seasonStatus = null;
  var seasonToggle = null;
  var seasonIndex = 0;
  var seasonTimer = null;
  var slideshowHovered = false;
  var slideshowFocused = false;
  var slideshowUserPaused = false;
  var SEASON_DELAY = 8200;

  function clearSlideshowTimer() {
    if (seasonTimer === null) return;
    window.clearTimeout(seasonTimer);
    seasonTimer = null;
  }

  function activateSeason(nextIndex) {
    if (!seasonScenes.length || !seasonStage) return;
    seasonIndex = (nextIndex + seasonScenes.length) % seasonScenes.length;

    seasonScenes.forEach(function (scene, index) {
      var active = index === seasonIndex;
      scene.classList.toggle('is-active', active);
      scene.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    seasonStage.dataset.seasonIndex = String(seasonIndex);
    if (seasonStatus) {
      seasonStatus.textContent = seasonScenes[seasonIndex].dataset.season
        + ' 수묵 장면 · ' + (seasonIndex + 1) + ' / ' + seasonScenes.length;
    }
  }

  function updateSeasonToggle() {
    if (!seasonToggle) return;
    seasonToggle.setAttribute('aria-pressed', slideshowUserPaused ? 'true' : 'false');
    seasonToggle.setAttribute(
      'aria-label',
      slideshowUserPaused ? '계절 장면 재생' : '계절 장면 일시정지'
    );
    var icon = seasonToggle.querySelector('[data-season-toggle-icon]');
    if (icon) icon.textContent = slideshowUserPaused ? '▶' : 'Ⅱ';
  }

  function slideshowShouldPause() {
    return reduced
      || document.hidden
      || slideshowHovered
      || slideshowFocused
      || slideshowUserPaused
      || manseFocused
      || manseResultOpen;
  }

  function syncSlideshow() {
    if (!seasonStage) return;
    clearSlideshowTimer();
    seasonControls.forEach(function (control) {
      control.disabled = reduced;
    });

    if (reduced) {
      activateSeason(0);
      seasonStage.dataset.state = 'reduced';
      updateSeasonToggle();
      return;
    }

    var paused = slideshowShouldPause();
    seasonStage.dataset.state = paused ? 'paused' : 'running';
    updateSeasonToggle();
    if (paused) return;

    seasonTimer = window.setTimeout(function () {
      activateSeason(seasonIndex + 1);
      syncSlideshow();
    }, SEASON_DELAY);
  }

  function handleSeasonPrevious() {
    activateSeason(seasonIndex - 1);
    syncSlideshow();
  }

  function handleSeasonNext() {
    activateSeason(seasonIndex + 1);
    syncSlideshow();
  }

  function handleSeasonToggle() {
    slideshowUserPaused = !slideshowUserPaused;
    syncSlideshow();
  }

  function handleSlideshowHover(event) {
    slideshowHovered = event.type === 'mouseenter';
    syncSlideshow();
  }

  function handleSlideshowFocus(event) {
    slideshowFocused = event.type === 'focusin'
      || Boolean(event.relatedTarget && seasonStage.contains(event.relatedTarget));
    syncSlideshow();
  }

  function initSlideshow() {
    seasonStage = document.getElementById('academySeasonStage');
    if (!seasonStage) return;
    seasonScenes = Array.prototype.slice.call(
      document.querySelectorAll('.academy-season-scene')
    );
    seasonControls = Array.prototype.slice.call(
      document.querySelectorAll('.academy-season-controls button')
    );
    seasonStatus = document.getElementById('academySeasonStatus');
    seasonToggle = document.getElementById('academySeasonToggle');

    var previous = document.getElementById('academySeasonPrevious');
    var next = document.getElementById('academySeasonNext');
    if (previous) previous.addEventListener('click', handleSeasonPrevious);
    if (next) next.addEventListener('click', handleSeasonNext);
    if (seasonToggle) seasonToggle.addEventListener('click', handleSeasonToggle);
    seasonStage.addEventListener('mouseenter', handleSlideshowHover);
    seasonStage.addEventListener('mouseleave', handleSlideshowHover);
    seasonStage.addEventListener('focusin', handleSlideshowFocus);
    seasonStage.addEventListener('focusout', handleSlideshowFocus);
    activateSeason(0);
  }

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
      syncSlideshow();
      return;
    }
    if (!reduced) attachInput();
    scheduleFrame();
    syncSlideshow();
  }

  function syncManseEngagement() {
    document.body.classList.toggle(
      'is-manse-engaged',
      manseFocused || manseResultOpen
    );
    syncSlideshow();
  }

  function handleManseFocus(event) {
    manseFocused = event.type === 'focusin'
      || Boolean(event.relatedTarget && manseForm.contains(event.relatedTarget));
    syncManseEngagement();
  }

  function handleManseResult(event) {
    manseResultOpen = Boolean(event.detail && event.detail.open);
    syncManseEngagement();
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
      activateSeason(0);
      syncSlideshow();
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
    manseForm = document.getElementById('academyManseForm');
    root.classList.add('academy-motion-ready');
    motionQuery = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };
    reduced = motionQuery.matches;
    initSlideshow();

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('academy:manse-result', handleManseResult);
    if (manseForm) {
      manseForm.addEventListener('focusin', handleManseFocus);
      manseForm.addEventListener('focusout', handleManseFocus);
    }
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', applyPreference);
    }

    if (reduced) {
      root.classList.add('is-reduced-motion');
      activateSeason(0);
      syncSlideshow();
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
