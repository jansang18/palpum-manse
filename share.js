/* 공유 카드 이미지 생성 (캔버스, 외부 의존성 없음) */
(function () {
  // 오행 색 (목/화/토/금/수)
  var EL = [
    { bg: '#42c184', fg: '#ffffff' }, // 목
    { bg: '#ff6b4d', fg: '#ffffff' }, // 화
    { bg: '#ffd23a', fg: '#3a2e00' }, // 토
    { bg: '#e9e3d2', fg: '#2a2a2a' }, // 금
    { bg: '#3f51c4', fg: '#ffffff' }  // 수
  ];
  var THEME = {
    bg: '#07080d',
    card: '#10131c',
    text: '#f4f1e8',
    sub: '#a6a9b4',
    gold: '#d8b56a',
    goldBright: '#f0d69a',
    goldDeep: '#a97732',
    line: 'rgba(216,181,106,0.22)'
  };

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

    // 배경
    c.fillStyle = THEME.bg; c.fillRect(0, 0, W, H);
    var g = c.createRadialGradient(W / 2, 120, 60, W / 2, 120, 760);
    g.addColorStop(0, 'rgba(216,181,106,0.22)');
    g.addColorStop(0.5, 'rgba(92,74,45,0.08)');
    g.addColorStop(1, 'rgba(7,8,13,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // 별
    for (var i = 0; i < 60; i++) {
      var sx = (i * 167.3) % W, sy = (i * 311.7) % H, sr = ((i % 3) + 1) * 0.8;
      c.globalAlpha = 0.18 + (i % 5) * 0.07;
      c.fillStyle = THEME.goldBright; c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    // 테두리
    c.strokeStyle = THEME.line; c.lineWidth = 2;
    rr(c, 24, 24, W - 48, H - 48, 36); c.stroke();

    c.textAlign = 'center';

    // 타이틀
    var tg = c.createLinearGradient(W / 2 - 240, 0, W / 2 + 240, 0);
    tg.addColorStop(0, '#fff2c8'); tg.addColorStop(0.5, THEME.goldBright); tg.addColorStop(1, THEME.goldDeep);
    c.fillStyle = tg;
    c.font = '700 60px "Batang","바탕",serif';
    c.fillText('신의 음성 만세력', W / 2, 130);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.font = '500 24px sans-serif';
    c.fillText('사주 명식', W / 2, 176);

    // 이름 + 정보
    var age = (new Date().getFullYear()) - s.year;
    c.fillStyle = THEME.text;
    c.font = '800 56px sans-serif';
    c.fillText(s.name || '이름 없음', W / 2, 300);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '500 28px sans-serif';
    c.fillText((s.gender === 'M' ? '남성' : '여성') + ' · 만 ' + age + '세', W / 2, 348);
    var dline = '양력 ' + s.year + '.' + p2(s.month) + '.' + p2(s.day) +
      (s.unknown ? ' · 시 모름' : ' · ' + p2(s.hour) + ':' + p2(s.minute));
    c.fillText(dline, W / 2, 392);

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
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.font = '700 26px sans-serif';
      c.fillText(sips[k] || '', cx, topY);
      // 라벨
      c.fillStyle = THEME.goldBright; c.font = '700 24px sans-serif';
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
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.font = '500 24px sans-serif';
    c.fillText('jansang18.github.io/sineum-manse', W / 2, H - 70);

    return cv;
  }

  function drawBlk(c, cx, y, size, idx, isStem) {
    var x = cx - size / 2;
    if (idx == null || idx < 0) {
      c.fillStyle = 'rgba(255,255,255,0.05)';
      rr(c, x, y, size, size, 22); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.font = '800 ' + Math.round(size * 0.5) + 'px sans-serif';
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
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.font = '600 24px sans-serif';
    c.fillText(t, cx, y);
  }
  function p2(n) { return ('0' + n).slice(-2); }
  function sip(i) { return (typeof i === 'number' && i >= 0 && typeof SIPSIN_KOR !== 'undefined') ? SIPSIN_KOR[i] : ''; }

  // 모달
  function showModal(cv, s) {
    var old = document.getElementById('shareCardModal');
    if (old) old.remove();
    var url = cv.toDataURL('image/png');
    var m = document.createElement('div');
    m.id = 'shareCardModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.82);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:16px;backdrop-filter:blur(4px)';
    m.innerHTML =
      '<div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#f0d69a">✧ 공유 카드 미리보기</div>' +
      '<img src="' + url + '" alt="사주 카드" style="max-width:88%;max-height:66vh;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,0.6)">' +
      '<div style="font-size:13px;color:rgba(255,255,255,0.7)">이미지를 길게 눌러 저장하거나 아래 버튼으로 공유하세요</div>' +
      '<div style="display:flex;gap:10px;width:100%;max-width:420px">' +
      '<button id="shareCardDo" style="flex:1;padding:15px;border:none;border-radius:14px;font-size:15px;font-weight:800;color:#161109;background:linear-gradient(135deg,#a97732,#d8b56a,#f0d69a);box-shadow:0 8px 24px rgba(185,135,58,0.28)">공유 / 저장</button>' +
      '<button id="shareCardClose" style="padding:15px 20px;border:1px solid rgba(255,255,255,0.2);border-radius:14px;font-size:15px;font-weight:700;color:#fff;background:rgba(255,255,255,0.06)">닫기</button>' +
      '</div>';
    document.body.appendChild(m);
    document.getElementById('shareCardClose').onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    document.getElementById('shareCardDo').onclick = function () {
      cv.toBlob(async function (blob) {
        var file = new File([blob], (s.name || 'saju') + '_사주.png', { type: 'image/png' });
        var txt = (s.name || '') + ' 사주 · 신의 음성 만세력\njansang18.github.io/sineum-manse';
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
