# Result Width and Brand Font Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결과 하단 버튼 바를 원국 카드 폭에 맞추고 상단 브랜드 두 단어의 폰트를 통일하며 8자 한자 박스를 20% 확대·중앙 정렬한다.

**Architecture:** 기존 CSS를 수정하지 않고 최종 `apple.css` 캐스케이드에 작은 오버라이드를 추가한다. 실제 브라우저 계산값과 사각형 폭을 `ui-regression.js`에서 측정한다.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Puppeteer UI regression

## Global Constraints

- 라이트·다크 테마 모두 같은 레이아웃을 사용한다.
- 모바일 가로 넘침을 만들지 않는다.
- `app/www`와 `app/web` 미러는 바이트 단위로 동일해야 한다.

---

### Task 1: 폭과 타이포그래피 계약

**Files:**
- Modify: `app/ui-regression.js`
- Modify: `app/web/tests/ui-regression.js`
- Modify: `app/www/apple.css`
- Modify: `app/web/apple.css`

**Interfaces:**
- Consumes: `.bottom-bar`, `.oguk-card`, `.brand-main`, `.title-sub`
- Produces: 데스크톱 카드 폭 정렬과 동일 브랜드 타이포그래피

- [ ] **Step 1: 실패하는 테스트 작성**

1220px 결과 화면에서 하단 바와 원국 카드 폭 차이를 1px 이하로 검사하고, 브랜드 두 span의 계산된 폰트 속성이 같은지 검사한다. 한자 박스는 83~85px, 정사각형 오차 1px 이하, 실제 글리프 세로 중심 오차 2px 이하를 검사한다.

- [ ] **Step 2: RED 확인**

Run: `$env:TEST_GROUP='result-width-brand'; node ui-regression.js`

Expected: 현재 하단 바 폭 또는 브랜드 폰트 계약 실패.

- [ ] **Step 3: 최소 CSS 구현**

`apple.css`에 `.bottom-bar` 최대 폭, `.brand-main` 타이포그래피, `.pillars-4` 및 `.pillar-block` 크기·중앙 정렬 최종 오버라이드를 추가한다.

- [ ] **Step 4: GREEN 및 전체 회귀 확인**

Run: `$env:TEST_GROUP='result-width-brand'; node ui-regression.js`

Run: `node ui-regression.js`

Expected: 집중 테스트와 전체 테스트 모두 PASS.

- [ ] **Step 5: 미러·배포·산출물 확인**

두 런타임 미러의 해시를 비교하고 GitHub Pages를 배포한 뒤 보호 APK/AAB를 재빌드한다.
