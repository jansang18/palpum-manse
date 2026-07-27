/* Back order: evidence -> more -> share/forms -> previous destination. */
(function () {
  'use strict';

  function closeEvidenceDialog() {
    return typeof window.closeLegendEvidence === 'function'
      && window.closeLegendEvidence();
  }

  function closeMoreMenu() {
    return typeof window.closeLegendMoreMenu === 'function'
      && window.closeLegendMoreMenu();
  }

  function closeExistingOverlay() {
    if (typeof window.closeTopAppOverlay === 'function') {
      return window.closeTopAppOverlay();
    }
    var share = document.getElementById('shareCardModal');
    if (share) {
      if (typeof window.closeShareCardModal === 'function') {
        return window.closeShareCardModal();
      }
      share.remove();
      return true;
    }
    if (typeof window.closeTopAppModal === 'function') {
      return window.closeTopAppModal();
    }
    var modals = document.querySelectorAll('.modal-bg.active');
    if (!modals.length) return false;
    modals[modals.length - 1].classList.remove('active');
    return true;
  }

  function restorePreviousDestination() {
    if (typeof window.restorePreviousLegendDestination === 'function') {
      return window.restorePreviousLegendDestination();
    }
    var active = document.querySelector('.tab.active');
    if (!active || active.dataset.tab === 'input') return false;
    var home = document.querySelector('.tab[data-tab="input"]');
    if (!home) return false;
    home.click();
    return true;
  }

  function handleBack() {
    if (closeEvidenceDialog()) return true;
    if (closeMoreMenu()) return true;
    if (closeExistingOverlay()) return true;
    if (restorePreviousDestination()) return true;
    return false;
  }

  window.handleAppBack = handleBack;

  function setupNative(App) {
    App.addListener('backButton', function () {
      if (!handleBack()) {
        try { App.exitApp(); } catch (error) {}
      }
    });
  }

  function setupWeb() {
    try { history.pushState(null, ''); } catch (error) {}
    window.addEventListener('popstate', function () {
      if (handleBack()) {
        try { history.pushState(null, ''); } catch (error) {}
      } else {
        try { history.back(); } catch (error) {}
      }
    });
  }

  var Capacitor = window.Capacitor;
  var native = Capacitor
    && Capacitor.isNativePlatform
    && Capacitor.isNativePlatform();
  if (native) {
    var attempts = 0;
    (function registerNativeBack() {
      var App = Capacitor.Plugins && Capacitor.Plugins.App;
      if (App && App.addListener) {
        setupNative(App);
        return;
      }
      if (attempts++ < 20) {
        setTimeout(registerNativeBack, 100);
        return;
      }
      setupWeb();
    }());
  } else {
    setupWeb();
  }
}());
