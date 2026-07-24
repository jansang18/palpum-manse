# 취명선 만세력 보안 모범 사례 보고서

## 요약

2026-07-24 최종 출시 차단 검토에서 확인된 백업 가져오기 DOM XSS와 제3자 JSONP 실행 경로를 제거했다. 외부 백업은 신뢰하지 않고 엄격한 스키마로 정규화하며, 파생 사주 데이터는 앱 내부 계산기로 다시 만든다. 가져온 ID는 원본과 관계없이 암호학적 UUID v4로 교체된다. 저장 화면은 `innerHTML` 대신 DOM API, `textContent`, `dataset`으로 구성한다.

온라인 인물 보강은 동적 `<script>` 실행을 완전히 제거하고, HTTPS 및 정확한 Wikipedia/Wikidata 호스트·경로 허용목록을 통과한 CORS `fetch`만 사용한다. CORS나 네트워크가 실패하면 내장 인물 목록만 유지하며 기능을 안전하게 축소한다.

## 수정 완료

### SEC-001 — High — 백업 가져오기 DOM XSS

- 위치: `index.html`의 `makeSavedElement`/`makeSavedCard`/`renderSaved` (`13518`–`13706`)
- 기존 영향: 백업 JSON의 악성 `id`가 `data-id` HTML 속성에 삽입되어 이벤트 핸들러를 실행할 수 있었다.
- 수정:
  - 저장 카드와 빈 상태를 `document.createElement`, `textContent`, `dataset`, `append`로 생성한다.
  - 사용자 제어 문자열을 HTML 파서에 전달하지 않는다.
  - 접근성 레이블도 고정 문자열로 설정한다.
- 검증: 악성 `<img onerror>`/`<svg onload>`를 포함한 실제 백업 파일을 가져와 실행 횟수 `0`, 이벤트 속성 노드 `0`을 확인한다.

### SEC-002 — High — 불충분한 가져오기 스키마 및 예측 가능한 ID

- 위치: `index.html`의 `createSecureUuid`, `normalizeImportedRecord`, `importSavedRecords` (`13804`–`13883`)
- 기존 영향: 외부 객체의 임의 필드와 ID가 저장되어 DOM 및 저장소 신뢰 경계를 우회할 수 있었다.
- 수정:
  - plain object만 허용하고 연·월·일·시·분·성별·시간모름·즐겨찾기·저장시각 타입과 범위를 검사한다.
  - 실제 달력 날짜를 검증한다.
  - 이름은 40자, 메모는 240자로 제한하고 파일은 2MB, 레코드는 500개로 제한한다.
  - 알 수 없는 필드는 폐기한다.
  - 파생 데이터는 `calcSaju`로 재계산한다.
  - 모든 가져온 ID는 `crypto.randomUUID()` 또는 `crypto.getRandomValues()` 기반 UUID v4로 교체한다.
- 검증: 유효 1개·성별이 잘못된 1개를 함께 가져와 유효 1개만 저장되고 원본 ID 및 추가 필드가 남지 않는지 확인한다.

### SEC-003 — Medium — JSONP 제3자 스크립트 실행

- 위치: `index.html`의 `ALLOWED_ENRICHMENT_HOSTS`, `validateEnrichmentUrl`, `fetchAllowedJson` (`15086`–`15123`)
- 기존 영향: Wikipedia/Wikidata 응답이 앱 출처 권한의 JavaScript로 실행되어 로컬 저장 데이터에 접근할 수 있었다.
- 수정:
  - JSONP 함수·콜백·동적 `<script>` 생성 경로를 삭제한다.
  - `https:`만 허용한다.
  - 호스트는 `ko.wikipedia.org`, `www.wikidata.org`만 허용한다.
  - 경로는 Wikipedia/Wikidata API 및 검증된 Wikidata entity JSON 경로만 허용한다.
  - `credentials: "omit"`, `redirect: "error"`, `AbortController` 타임아웃을 적용한다.
  - CORS 실패 시 호출자에서 내장 목록만 유지한다.
- 검증: 비허용 호스트가 네트워크 호출 전에 거부되고, 허용 API 실패 시 동적 스크립트 생성이 `0`인지 확인한다.

### SEC-005 — High — 가져온 이름의 궁합 설명 DOM XSS

- 위치: `index.html`의 기존 `genCompatText`와 `renderMatchResult`
- 기존 영향: 정규화된 백업 이름에 HTML 이벤트 속성이 포함되면, 궁합 설명 생성기가 이름을 `<strong>${name}</strong>` 문자열에 직접 삽입하고 결과를 `innerHTML`로 해석했다. 저장 화면에서 안전했던 값이 궁합 계산이라는 하위 기능에서 다시 실행 가능한 HTML이 되었다.
- 수정:
  - 이름을 포함하던 HTML 문자열 생성기 `genCompatText`를 제거했다.
  - 궁합 해설 자체는 앱이 관리하는 일반 텍스트로만 반환한다.
  - 두 이름은 별도의 `<strong>` 요소에 `textContent`로 넣고, 연결 문구와 해설은 `document.createTextNode`로 추가한다.
  - 정상적인 한글 이름과 `<strong>` 시각적 의미는 그대로 유지한다.
- 하위 사용처 감사:
  - 결과·운세·유사 명식·궁합 선택/요약: 기존 `escapeHtml` 또는 DOM `textContent` 사용을 확인했다.
  - 저장 목록: DOM API와 `textContent`만 사용한다.
  - 유사 명식·궁합 선택의 레코드 ID 속성: 정규화 시 UUID로 재발급하고 출력 시에도 속성 이스케이프를 적용했다.
  - 공유 카드: Canvas `fillText`를 사용하며 이름을 HTML로 해석하지 않는다.
  - 궁합 설명: 이번 수정으로 DOM `textContent`/텍스트 노드만 사용한다.
- TDD RED: 수정 전 동일 E2E에서 궁합 계산 후 이벤트 카운터가 `1`이 되어 실제 실행 경로를 재현했다.
- 검증 GREEN: 악성 백업을 실제 파일 입력으로 가져온 뒤 저장 명반을 결과·운세·공유·유사 명식에 전달하고, 동일 명반을 궁합 A/B 양쪽에 선택해 자동 계산한다. 모든 단계에서 이벤트 실행 `0`, 공격자 노드 `0`을 확인하며 `홍길동`과 공격 문자열은 실행되지 않는 텍스트로 보존된다.

### SEC-004 — Release — Android 백업 및 브랜드

- 위치: `android/app/src/main/res/values/strings.xml` (`3`–`4`)
- 상태:
  - Android `app_name`, `title_activity_main`을 `취명선 만세력`으로 통일했다.
  - 백업 파일명을 `취명선만세력_백업_YYYYMMDD.json`으로 통일했다.
  - 기존 `android:allowBackup="false"`를 유지한다.

### REL-005 — Release — 달력 현재 연도 초기화

- 위치: `index.html`의 `calendarLocalNow`, `initializeCalendarSession`, `renderCalendar`
- 수정:
  - 달력 탭을 처음 여는 시점의 로컬 시계에서 연·월을 동적으로 가져온다.
  - 연도를 하드코딩하지 않는다.
  - 현재 연도에는 시스템 블루 `올해` 캡슐과 `aria-current="date"`를 표시한다.
  - 같은 달력 화면 세션에서 사용자가 이동한 연·월은 다른 탭을 다녀와도 유지한다.
- 검증: 테스트 전용 시계를 2034-07-15로 주입해 첫 화면이 2034년 7월인지 확인하고, 2035년 1월로 이동한 뒤 탭을 다시 열어 이동 상태가 유지되는지 확인한다.

## 방어 심층화 및 남은 고려사항

### SEC-R01 — Low — Web Storage는 비밀 저장소가 아님

명반은 기기 내 `localStorage`/Capacitor Preferences에 저장된다. XSS 경로는 차단했지만, 잠금 해제된 기기나 브라우저 프로필에 접근할 수 있는 사용자를 상대로 한 암호화 보관은 제공하지 않는다. 매우 민감한 메모를 저장하지 않도록 안내하고, 향후 필요하면 Android Keystore 기반 암호화 저장소를 별도 설계해야 한다.

### SEC-R02 — Low — 기존 템플릿용 `innerHTML`

앱에는 계산 결과와 고정 템플릿을 그리는 기존 `innerHTML` 사용이 남아 있다. 외부 백업이 연결되는 저장 카드와 궁합 해설은 DOM API로 전환했으며, 이름이 남아 있는 다른 HTML 템플릿은 `escapeHtml` 처리를 확인했다. 향후 단계적으로 DOM API 또는 Trusted Types로 이전하면 공격 표면을 더 줄일 수 있다.

### SEC-R03 — Low — CSP

현재 단일 HTML 구조와 대형 인라인 스크립트 때문에 엄격한 nonce/hash CSP 적용은 별도 구조 변경이 필요하다. 다음 보안 릴리스에서는 인라인 JavaScript를 외부 파일로 분리하고 `script-src 'self'` 기반 CSP를 적용하는 것을 권장한다.

## 검증

- 보안 집중 회귀: `TEST_GROUP=final-security` — 통과
- 가져온 필드 하위 경로 E2E: `TEST_GROUP=imported-fields-xss` — 통과
- 결정적 달력 시계 회귀: `TEST_GROUP=calendar-current-year` — 통과
- 전체 UI 회귀: `360 / 390 / 412 / 768px` — 통과
- 악성 백업 이벤트 실행: `0`
- 결과·운세·공유·유사 명식·궁합 공격자 노드: 각각 `0`
- 동적 온라인 보강 스크립트 생성: `0`
- 비허용 호스트의 실제 `fetch` 호출: `0`
- 소스/웹 `index.html`, `apple.css`, 테스트 러너 SHA-256: 각각 일치
- Android 앱 데이터 백업: 비활성 유지

이번 작업에서는 APK/AAB를 재빌드하지 않았다.
