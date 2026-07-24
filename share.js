/* 공유 카드 이미지 생성 (캔버스, 외부 의존성 없음) */
(function () {
  // 오행 색 (목/화/토/금/수)
  var EL = [
    { bg: '#ddf6e8', fg: '#237a4b' }, // 목
    { bg: '#ffe3df', fg: '#b84438' }, // 화
    { bg: '#fff1c7', fg: '#7a6200' }, // 토
    { bg: '#eceff4', fg: '#505b6b' }, // 금
    { bg: '#e2e7ff', fg: '#4054a3' }  // 수
  ];
  var THEME = {
    bg: '#f2f2f7',
    card: '#ffffff',
    inset: '#f7f7fa',
    text: '#1c1c1e',
    sub: '#636366',
    tertiary: '#8e8e93',
    accent: '#007aff',
    accentSoft: '#e7f2ff',
    line: 'rgba(60,60,67,0.16)'
  };
  var shareCardOpener = null;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard(s) {
    var W = 1080, H = 1350;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');

    // Apple light canvas and grouped card.
    c.fillStyle = THEME.bg; c.fillRect(0, 0, W, H);
    c.fillStyle = THEME.card;
    rr(c, 24, 24, W - 48, H - 48, 40); c.fill();
    c.strokeStyle = THEME.line; c.lineWidth = 2;
    rr(c, 24, 24, W - 48, H - 48, 36); c.stroke();

    c.textAlign = 'center';

    // Product title.
    c.fillStyle = THEME.accentSoft;
    rr(c, W / 2 - 118, 72, 236, 48, 24); c.fill();
    c.fillStyle = THEME.accent;
    c.font = '700 24px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    c.fillText('사주 명식', W / 2, 104);
    c.fillStyle = THEME.text;
    c.font = '800 58px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    c.fillText('취명선 만세력', W / 2, 184);

    // 이름 + 정보
    var age = (new Date().getFullYear()) - s.year;
    c.fillStyle = THEME.text;
    c.font = '800 54px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    c.fillText(s.name || '이름 없음', W / 2, 292);
    c.fillStyle = THEME.sub;
    c.font = '500 27px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    c.fillText((s.gender === 'M' ? '남성' : '여성') + ' · 만 ' + age + '세', W / 2, 340);
    var dline = '양력 ' + s.year + '.' + p2(s.month) + '.' + p2(s.day) +
      (s.unknown ? ' · 시 모름' : ' · ' + p2(s.hour) + ':' + p2(s.minute));
    c.fillText(dline, W / 2, 382);

    c.fillStyle = THEME.inset;
    rr(c, 54, 430, W - 108, 720, 30); c.fill();

    // 사주 4기둥
    var labels = ['시주', '일주', '월주', '년주'];
    var stems = [s.hStem, s.dStem, s.mStem, s.yStem];
    var brs = [s.hBranch, s.dBranch, s.mBranch, s.yBranch];
    var sips = [
      s.unknown ? '' : sip(s.sipsin && s.sipsin.hour),
      '일간',
      sip(s.sipsin && s.sipsin.month),
      sip(s.sipsin && s.sipsin.year)
    ];
    var pad = 80, areaW = W - pad * 2, colW = areaW / 4, blk = Math.min(colW - 22, 168);
    var topY = 500;
    for (var k = 0; k < 4; k++) {
      var cx = pad + colW * k + colW / 2;
      // 십신
      c.fillStyle = THEME.sub; c.font = '700 26px sans-serif';
      c.fillText(sips[k] || '', cx, topY);
      // 라벨
      c.fillStyle = THEME.accent; c.font = '700 24px sans-serif';
      c.fillText(labels[k], cx, topY + 38);

      var unknown = (k === 0 && s.unknown);
      var by = topY + 60;
      drawBlk(c, cx, by, blk, unknown ? null : stems[k], true);
      drawKor(c, cx, by + blk + 30, unknown ? '' : (STEM_KOR[stems[k]]));
      var by2 = by + blk + 52;
      drawBlk(c, cx, by2, blk, unknown ? null : brs[k], false);
      drawKor(c, cx, by2 + blk + 30, unknown ? '' : (BRANCH_KOR[brs[k]]));
    }

    // 푸터
    c.fillStyle = THEME.tertiary; c.font = '500 23px sans-serif';
    c.fillText('취명선 만세력 · jansang18.github.io/sineum-manse', W / 2, H - 72);

    return cv;
  }

  function drawBlk(c, cx, y, size, idx, isStem) {
    var x = cx - size / 2;
    if (idx == null || idx < 0) {
      c.fillStyle = '#ececf0';
      rr(c, x, y, size, size, 22); c.fill();
      c.fillStyle = THEME.tertiary; c.font = '800 ' + Math.round(size * 0.5) + 'px sans-serif';
      c.textBaseline = 'middle'; c.fillText('?', cx, y + size / 2 + 2); c.textBaseline = 'alphabetic';
      return;
    }
    var el = isStem ? STEM_EL[idx] : BRANCH_EL[idx];
    var col = EL[el];
    c.fillStyle = col.bg;
    rr(c, x, y, size, size, 22); c.fill();
    c.fillStyle = col.fg;
    c.font = '900 ' + Math.round(size * 0.62) + 'px "Batang","바탕",serif';
    c.textBaseline = 'middle';
    c.fillText(isStem ? STEM[idx] : BRANCH[idx], cx, y + size / 2 + size * 0.04);
    c.textBaseline = 'alphabetic';
  }
  function drawKor(c, cx, y, t) {
    if (!t) return;
    c.fillStyle = THEME.sub; c.font = '600 24px sans-serif';
    c.fillText(t, cx, y);
  }
  function p2(n) { return ('0' + n).slice(-2); }
  function sip(i) { return (typeof i === 'number' && i >= 0 && typeof SIPSIN_KOR !== 'undefined') ? SIPSIN_KOR[i] : ''; }

  function closeShareCardModal() {
    var modal = document.getElementById('shareCardModal');
    if (!modal) return false;
    modal.remove();
    if (typeof window.refreshAppOverlayAccessibility === 'function') window.refreshAppOverlayAccessibility();
    if (document.querySelector('.modal-bg.active')) {
      if (typeof window.focusTopAppOverlay === 'function') window.focusTopAppOverlay();
    } else if (shareCardOpener && shareCardOpener.isConnected && typeof shareCardOpener.focus === 'function') {
      try { shareCardOpener.focus({ preventScroll: true }); }
      catch (e) { shareCardOpener.focus(); }
    }
    shareCardOpener = null;
    return true;
  }

  window.closeShareCardModal = closeShareCardModal;

  // 모달
  function showModal(cv, s) {
    var old = document.getElementById('shareCardModal');
    var opener = old ? shareCardOpener : document.activeElement;
    if (old) old.remove();
    shareCardOpener = opener;
    var url = cv.toDataURL('image/png');
    var m = document.createElement('div');
    m.id = 'shareCardModal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-labelledby', 'shareCardTitle');
    m.setAttribute('tabindex', '-1');
    m.className = 'share-card-overlay';
    m.innerHTML =
      '<div class="share-card-sheet">' +
      '<div id="shareCardTitle" class="share-card-title">공유 카드 미리보기</div>' +
      '<img class="share-card-preview" src="' + url + '" alt="사주 카드">' +
      '<div class="share-card-help">이미지를 길게 눌러 저장하거나 아래 버튼으로 공유하세요</div>' +
      '<div class="share-card-actions">' +
      '<button id="shareCardDo">공유 / 저장</button>' +
      '<button id="shareCardClose">닫기</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(m);
    if (typeof window.refreshAppOverlayAccessibility === 'function') window.refreshAppOverlayAccessibility();
    if (typeof window.focusTopAppOverlay === 'function') requestAnimationFrame(window.focusTopAppOverlay);
    document.getElementById('shareCardClose').onclick = closeShareCardModal;
    m.onclick = function (e) { if (e.target === m) closeShareCardModal(); };
    document.getElementById('shareCardDo').onclick = function () {
      cv.toBlob(async function (blob) {
        var file = new File([blob], (s.name || '사주') + '_취명선_만세력.png', { type: 'image/png' });
        var txt = (s.name || '') + ' 사주 · 취명선 만세력\njansang18.github.io/sineum-manse';
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: txt });
            return;
          }
        } catch (e) {}
        // 폴백: 다운로드
        var a = document.createElement('a');
        a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      }, 'image/png');
    };
  }

  window.shareCard = function (s) {
    if (!s) return;
    try { showModal(drawCard(s), s); }
    catch (e) { alert('카드 생성 중 오류: ' + e.message); }
  };
})();
