(function () {
  'use strict';

  var TOP_TAB_SELECTOR = '.tab[data-tab]';
  var PRIMARY_SELECTOR = '[data-legend-primary-nav]';
  var SAJU_SELECTOR = '[data-legend-saju-nav]';
  var MORE_ITEM_SELECTOR = '[data-legend-more-nav]';
  var SECONDARY_ITEM_SELECTOR = '[data-legend-secondary-nav]';
  var MENU_ITEM_SELECTOR = SECONDARY_ITEM_SELECTOR + ', ' + MORE_ITEM_SELECTOR;
  var FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  var destinationHistory = [];
  var evidenceOpener = null;
  var moreAnimation = null;
  var moreGeneration = 0;

  function all(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function reducedMotion() {
    return !!(window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function currentDestination() {
    var activeView = document.querySelector('.view.active');
    return activeView && activeView.id.indexOf('view-') === 0
      ? activeView.id.slice(5)
      : 'input';
  }

  function groupDestination(tabName) {
    return tabName === 'input' || tabName === 'result' || tabName === 'legend'
      ? 'legend'
      : tabName;
  }

  function renderDestination(tabName) {
    if (tabName === 'calendar') {
      if (typeof window.initializeCalendarSession === 'function') {
        window.initializeCalendarSession();
      }
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
    }
    if (tabName === 'saved' && typeof window.renderSaved === 'function') {
      window.renderSaved();
    }
    if (tabName === 'result' && typeof window.renderResult === 'function') {
      window.renderResult();
    }
    if (tabName === 'fortune' && typeof window.renderFortune === 'function') {
      window.renderFortune();
    }
    if (tabName === 'match' && typeof window.renderMatch === 'function') {
      window.renderMatch();
    }
    if (tabName === 'legend' && typeof window.renderLegend === 'function') {
      var saju = typeof window.getCurrentSaju === 'function'
        ? window.getCurrentSaju()
        : null;
      window.renderLegend(saju);
      enhanceEvidenceDialogs();
    }
  }

  function syncDestination(tabName) {
    var selectedTab = null;
    var groupName = groupDestination(tabName);
    all(TOP_TAB_SELECTOR).forEach(function (tab) {
      var selected = tab.dataset.tab === groupName;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) selectedTab = tab;
    });
    if (!selectedTab) return false;
    if (groupName === 'legend') {
      selectedTab.setAttribute('aria-controls', 'view-' + tabName);
    }

    all('.view').forEach(function (view) {
      var selected = view.id === 'view-' + tabName;
      view.classList.toggle('active', selected);
      view.hidden = !selected;
    });
    var hasSaju = typeof window.hasCurrentSaju === 'function'
      && window.hasCurrentSaju();
    var sajuNav = document.getElementById('legendSajuNav');
    if (sajuNav) sajuNav.hidden = groupName !== 'legend';
    all(SAJU_SELECTOR).forEach(function (button) {
      var selected = button.dataset.tab === tabName;
      button.classList.toggle('active', selected);
      button.disabled = button.dataset.tab === 'result' && !hasSaju;
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    all(PRIMARY_SELECTOR).forEach(function (button) {
      var selected = button.dataset.tab === groupName;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    var moreButton = document.getElementById('legendMoreButton');
    if (moreButton) {
      var secondary = false;
      moreButton.classList.toggle('active', secondary);
      if (secondary) moreButton.setAttribute('aria-current', 'page');
      else moreButton.removeAttribute('aria-current');
    }

    var bottomBar = document.getElementById('bottomBar');
    if (bottomBar) {
      bottomBar.style.display = tabName === 'result' && hasSaju ? 'flex' : 'none';
    }
    renderDestination(tabName);
    document.dispatchEvent(new CustomEvent('legenddestinationchange', {
      detail: { tab: tabName }
    }));
    return true;
  }

  function focusDestination(tabName) {
    var mobile = window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches;
    var groupName = groupDestination(tabName);
    var target = mobile
      ? document.querySelector(PRIMARY_SELECTOR + '[data-tab="' + groupName + '"]')
      : document.querySelector(TOP_TAB_SELECTOR + '[data-tab="' + groupName + '"]');
    if (!target) {
      target = document.querySelector(SAJU_SELECTOR + '[data-tab="' + tabName + '"]');
    }
    if (target) target.focus();
  }

  window.activateLegendDestination = function activateLegendDestination(tabName, options) {
    var settings = options || {};
    if (tabName === 'result'
      && typeof window.hasCurrentSaju === 'function'
      && !window.hasCurrentSaju()) {
      tabName = 'input';
    }
    var target = document.getElementById('view-' + String(tabName));
    if (!target) return false;

    var current = currentDestination();
    if (current !== tabName && settings.history !== false) {
      destinationHistory.push(current);
      if (destinationHistory.length > 24) destinationHistory.shift();
    }
    if (current !== tabName) window.closeLegendMoreMenu({ restoreFocus: false });
    if (!syncDestination(tabName)) return false;
    if (current !== tabName && settings.scroll !== false) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    if (settings.focus) focusDestination(tabName);
    return true;
  };

  window.restorePreviousLegendDestination = function restorePreviousLegendDestination() {
    var current = currentDestination();
    var previous = null;
    while (destinationHistory.length && !previous) {
      var candidate = destinationHistory.pop();
      if (candidate !== current) previous = candidate;
    }
    if (!previous) {
      if (current === 'legend') return false;
      previous = 'legend';
    }
    return window.activateLegendDestination(previous, {
      history: false,
      focus: false
    });
  };

  function pressFeedback(button) {
    function release() {
      button.classList.remove('is-pressed');
    }
    button.addEventListener('pointerdown', function () {
      button.classList.add('is-pressed');
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  }

  function bindDestinationControls() {
    all(TOP_TAB_SELECTOR).forEach(function (tab) {
      pressFeedback(tab);
      tab.addEventListener('click', function () {
        window.activateLegendDestination(tab.dataset.tab);
      });
      tab.addEventListener('keydown', function (event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        var tabs = all(TOP_TAB_SELECTOR);
        var current = tabs.indexOf(tab);
        var next = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length)
              % tabs.length;
        window.activateLegendDestination(tabs[next].dataset.tab, { focus: true });
      });
    });
    all(PRIMARY_SELECTOR).forEach(function (button) {
      pressFeedback(button);
      button.addEventListener('click', function () {
        window.activateLegendDestination(button.dataset.tab);
      });
    });
    all(SAJU_SELECTOR).forEach(function (button) {
      pressFeedback(button);
      button.addEventListener('click', function () {
        if (!button.disabled) window.activateLegendDestination(button.dataset.tab);
      });
    });
  }

  function menuElements() {
    return {
      button: document.getElementById('legendMoreButton'),
      menu: document.getElementById('legendMoreMenu')
    };
  }

  function stopMenuAnimation(menu) {
    if (!moreAnimation) return;
    try { moreAnimation.commitStyles(); } catch (error) {}
    moreAnimation.cancel();
    moreAnimation = null;
    menu.style.opacity = '';
    menu.style.transform = '';
  }

  function animateMenu(menu, opening, done, fromHidden) {
    var operation = ++moreGeneration;
    var reduce = reducedMotion();
    var style = getComputedStyle(menu);
    var currentOpacity = Number.parseFloat(style.opacity);
    var currentTransform = style.transform === 'none' ? 'none' : style.transform;
    stopMenuAnimation(menu);

    var start = {
      opacity: Number.isFinite(currentOpacity) ? currentOpacity : opening ? 0 : 1,
      transform: reduce ? 'none' : currentTransform
    };
    if (opening && fromHidden) {
      start.opacity = 0;
      start.transform = reduce ? 'none' : 'translateY(-0.35rem) scale(0.96)';
    }
    var end = opening
      ? { opacity: 1, transform: 'none' }
      : {
          opacity: 0,
          transform: reduce ? 'none' : 'translateY(-0.35rem) scale(0.96)'
        };

    if (typeof menu.animate !== 'function') {
      done(operation);
      return;
    }
    moreAnimation = menu.animate([start, end], {
      duration: reduce ? 100 : opening ? 180 : 150,
      easing: opening
        ? 'cubic-bezier(.2,.7,.2,1)'
        : 'cubic-bezier(.23,1,.32,1)',
      fill: 'both'
    });
    moreAnimation.finished.catch(function () {}).then(function () {
      if (operation !== moreGeneration) return;
      moreAnimation.cancel();
      moreAnimation = null;
      done(operation);
    });
  }

  function positionMoreMenu(button, menu) {
    var trigger = button.getBoundingClientRect();
    var panel = menu.getBoundingClientRect();
    var gutter = 8;
    var left = Math.min(
      window.innerWidth - panel.width - gutter,
      Math.max(gutter, trigger.right - panel.width)
    );
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(trigger.bottom + 8) + 'px';
    menu.style.transformOrigin = Math.round(trigger.right - left) + 'px 0';
  }

  window.openLegendMoreMenu = function openLegendMoreMenu() {
    var elements = menuElements();
    if (!elements.button || !elements.menu) return false;
    if (elements.button.getAttribute('aria-expanded') === 'true') return true;
    window.closeLegendEvidence();
    var wasHidden = elements.menu.hidden;
    elements.menu.hidden = false;
    elements.menu.classList.add('is-open');
    elements.button.setAttribute('aria-expanded', 'true');
    positionMoreMenu(elements.button, elements.menu);
    animateMenu(elements.menu, true, function () {
      elements.menu.style.opacity = '';
      elements.menu.style.transform = '';
    }, wasHidden);
    var first = elements.menu.querySelector(MENU_ITEM_SELECTOR);
    if (first) first.focus();
    return true;
  };

  window.closeLegendMoreMenu = function closeLegendMoreMenu(options) {
    var settings = options || {};
    var elements = menuElements();
    if (!elements.button || !elements.menu) return false;
    if (elements.button.getAttribute('aria-expanded') !== 'true') return false;
    elements.button.setAttribute('aria-expanded', 'false');
    elements.menu.classList.remove('is-open');
    animateMenu(elements.menu, false, function () {
      elements.menu.hidden = true;
      elements.menu.style.opacity = '';
      elements.menu.style.transform = '';
    });
    if (settings.restoreFocus !== false) elements.button.focus();
    return true;
  };

  function evidenceDialog() {
    return document.getElementById('legendEvidenceModal')
      || document.querySelector('[data-legend-evidence-dialog]');
  }

  function focusableIn(element) {
    if (!element) return [];
    return Array.prototype.slice.call(element.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(function (node) {
        var style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
  }

  function restoreEvidenceFocus() {
    if (evidenceOpener && evidenceOpener.isConnected
      && typeof evidenceOpener.focus === 'function') {
      evidenceOpener.focus();
    }
    evidenceOpener = null;
  }

  function enhanceEvidenceDialog(dialog) {
    if (!dialog || dialog.dataset.legendNavigationReady === 'true') return;
    dialog.dataset.legendNavigationReady = 'true';
    dialog.id = 'legendEvidenceModal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;
    all('[data-legend-evidence]').forEach(function (trigger) {
      trigger.setAttribute('aria-controls', dialog.id);
    });
    var closeButton = dialog.querySelector('.legend-dialog-close');
    if (closeButton) closeButton.dataset.legendEvidenceClose = '';
    dialog.addEventListener('close', restoreEvidenceFocus);
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      window.closeLegendEvidence();
    });
  }

  function enhanceEvidenceDialogs() {
    all('[data-legend-evidence-dialog]').forEach(enhanceEvidenceDialog);
  }

  window.openLegendEvidence = function openLegendEvidence(data) {
    var details = data || {};
    var dialog = details.dialog || evidenceDialog();
    if (!dialog) return false;
    enhanceEvidenceDialog(dialog);
    window.closeLegendMoreMenu({ restoreFocus: false });
    evidenceOpener = details.opener || document.activeElement;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    var focusables = focusableIn(dialog);
    var title = dialog.querySelector('#legendEvidenceTitle');
    var focusDialogStart = function () {
      (title || focusables[0] || dialog).focus({ preventScroll: true });
      dialog.scrollTop = 0;
    };
    focusDialogStart();
    requestAnimationFrame(focusDialogStart);
    return true;
  };

  window.closeLegendEvidence = function closeLegendEvidence() {
    var dialog = evidenceDialog();
    if (!dialog || !dialog.open) return false;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      restoreEvidenceFocus();
    }
    return true;
  };

  function handleEvidenceKeydown(event, dialog) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.closeLegendEvidence();
      return;
    }
    if (event.key !== 'Tab') return;
    var focusables = focusableIn(dialog);
    if (!focusables.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (document.activeElement === dialog.querySelector('#legendEvidenceTitle')) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (!dialog.contains(document.activeElement)
      || (event.shiftKey && document.activeElement === first)
      || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  function bindMoreMenu() {
    var elements = menuElements();
    if (!elements.button || !elements.menu) return;
    pressFeedback(elements.button);
    all(MENU_ITEM_SELECTOR).forEach(pressFeedback);
    elements.button.addEventListener('click', function () {
      if (elements.button.getAttribute('aria-expanded') === 'true') {
        window.closeLegendMoreMenu();
      } else {
        window.openLegendMoreMenu();
      }
    });
    elements.menu.addEventListener('keydown', function (event) {
      var items = all(MENU_ITEM_SELECTOR);
      var current = items.indexOf(document.activeElement);
      var next = null;
      if (event.key === 'ArrowDown') next = (current + 1) % items.length;
      if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = items.length - 1;
      if (next === null) return;
      event.preventDefault();
      items[next].focus();
    });
  }

  document.addEventListener('click', function (event) {
    var evidenceTrigger = event.target.closest('[data-legend-evidence]');
    if (evidenceTrigger) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.openLegendEvidence({ opener: evidenceTrigger });
      return;
    }
    var moreItem = event.target.closest(MENU_ITEM_SELECTOR);
    if (moreItem) {
      event.preventDefault();
      event.stopImmediatePropagation();
      var tab = moreItem.dataset.tab;
      window.closeLegendMoreMenu({ restoreFocus: false });
      if (tab === 'about') {
        var button = document.getElementById('legendMoreButton');
        if (button) button.focus();
        if (typeof window.openAppModal === 'function') {
          window.openAppModal(document.getElementById('aboutModal'));
        }
      } else {
        window.activateLegendDestination(tab, { focus: true });
      }
      return;
    }
    var elements = menuElements();
    if (elements.menu && !elements.menu.hidden
      && !elements.menu.contains(event.target)
      && event.target !== elements.button) {
      window.closeLegendMoreMenu({ restoreFocus: false });
    }
  }, true);

  document.addEventListener('keydown', function (event) {
    var dialog = evidenceDialog();
    if (dialog && dialog.open) {
      handleEvidenceKeydown(event, dialog);
      return;
    }
    if (event.key === 'Escape' && window.closeLegendMoreMenu()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('resize', function () {
    var elements = menuElements();
    if (elements.button && elements.menu && !elements.menu.hidden) {
      positionMoreMenu(elements.button, elements.menu);
    }
  });

  new MutationObserver(enhanceEvidenceDialogs).observe(document.getElementById('view-legend'), {
    childList: true,
    subtree: true
  });

  bindDestinationControls();
  bindMoreMenu();
  enhanceEvidenceDialogs();
  syncDestination(currentDestination());
}());
