# Task 2 보고서 — Apple Theme Foundation

완료 범위:

- `apple.css` 최종 레이어를 `app/www`와 `app/web`에 byte-identical로 추가했다.
- `polish.css`, `luxury.css` 뒤에 `apple.css`를 로드하고 표시 이름과 HTML `<title>`을 `취명선 만세력`으로 변경했다.
- Apple light/dark semantic tokens와 승인된 오행 pastel tokens, 시스템 폰트, 모노크롬 로고, 투명 top bar, system-blue six-tab capsule을 구현했다.
- 금색 유산 효과는 primary action, input border/focus, 선택 luck glow에서만 Apple layer로 중화했다. 기존 `polish.css`와 `luxury.css`는 수정하지 않았다.
- `apple-design` 검사는 theme별로 입력 뷰를 선택해 header/tab/form geometry를 검사한 뒤 계산 결과의 pillar/luck geometry를 검사하도록 결정적으로 분리했다.

검증:

- `$env:TEST_GROUP='apple-design'; node ui-regression.js` → `UI regression PASS: 390`
- `node ui-regression.js` → `UI regression PASS: 360, 390, 412, 768`
- SHA-256 일치 확인: `www/index.html` = `web/index.html`, `www/apple.css` = `web/apple.css`, `ui-regression.js` = `web/tests/ui-regression.js`
- `git diff --check` 통과.

우려 사항:

- 없음. Task 2 범위를 넘어 card, pillar, luck의 전면 재스타일링은 하지 않았다.
