/* 뒤로가기 처리: 모달 닫기 → 입력탭 이동 → 홈에서 앱 종료 (웹은 History 폴백) */
(function () {
  function closeTopOverlay() {
    if (typeof window.closeTopAppOverlay === 'function') return window.closeTopAppOverlay();
    var share = document.getElementById('shareCardModal');
    if (share) {
      if (typeof window.closeShareCardModal === 'function') return window.closeShareCardModal();
      share.remove();
      return true;
    }
    if (typeof window.closeTopAppModal === 'function') return window.closeTopAppModal();
    var modals = document.querySelectorAll('.modal-bg.active');
    if (modals.length) { modals[modals.length - 1].classList.remove('active'); return true; }
    return false;
  }
  function goHomeIfNeeded() {
    var t = document.querySelector('.tab.active');
    if (t && t.getAttribute('data-tab') !== 'input') {
      var home = document.querySelector('.tab[data-tab="input"]');
      if (home) { home.click(); return true; }
    }
    return false;
  }
  function handleBack() {
    if (closeTopOverlay()) return true;
    if (goHomeIfNeeded()) return true;
    return false;
  }
  window.handleAppBack = handleBack;

  function setupNative(App) {
    App.addListener('backButton', function () {
      if (!handleBack()) {
        try { App.exitApp(); } catch (e) {}
      }
    });
  }

  function setupWeb() {
    try { history.pushState(null, ''); } catch (e) {}
    window.addEventListener('popstate', function () {
      if (handleBack()) { try { history.pushState(null, ''); } catch (e) {} }
      else { try { history.back(); } catch (e) {} }
    });
  }

  var Cap = window.Capacitor;
  var native = Cap && Cap.isNativePlatform && Cap.isNativePlatform();
  if (native) {
    // App 플러그인 준비될 때까지 잠깐 대기 후 등록
    var tries = 0;
    (function reg() {
      var App = Cap.Plugins && Cap.Plugins.App;
      if (App && App.addListener) { setupNative(App); return; }
      if (tries++ < 20) { setTimeout(reg, 100); return; }
      setupWeb(); // 폴백
    })();
  } else {
    setupWeb();
  }
})();
