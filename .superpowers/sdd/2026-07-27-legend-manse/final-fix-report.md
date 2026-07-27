# Final Fix Report

작성일: 2026-07-27 (Asia/Seoul)

## 상태

- 최종 리뷰의 HIGH 4건과 디자인 보완 3건을 모두 수정했다.
- 구현 커밋: `5c904c4d9f18ff3b9759356859708eb627f4db02`
- 비교 기준 커밋: `73a91a8bb382f1afaa09707e34d4791e31035981`
- 전체 테스트와 보안 검증을 통과했다.
- 요청에 따라 배포, 원격 push, Pages 변경은 수행하지 않았다.

## 수정 내용

### 1. 절입일의 출생 시각 미상

- 음력 입력도 먼저 양력으로 변환한 뒤 동일한 계산 엔진 옵션으로 해당 민간일의 `00:00`과 `23:59` 연주·월주를 비교한다.
- 두 결과가 다르면 정오 결과를 확정하지 않고 `LEGEND_SOLAR_TERM_TIME_REQUIRED`를 발생시킨다.
- UI는 `이 날짜에는 절입 시각이 있어 태어난 시간을 알아야 연주·월주와 대운을 확정할 수 있습니다.`를 표시하고 시간 입력으로 포커스를 옮긴다.
- 절입이 없는 일반 날짜는 이전처럼 시주만 미상으로 두고 정상 계산한다.
- 2024년 월 절입 12개 날짜 전부와 평일 대조군을 고정 회귀로 추가했다.

### 2. 역사적 Asia/Seoul 민간시

`manseryeok@2.0.0`의 공개 API와 배포 소스를 확인해 다음 옵션을 사용한다.

```js
{
  longitude: 135,
  applyEquationOfTime: false,
  applyHistoricalDst: true
}
```

- `longitude: 135`는 한국 표준 자오선과 같으므로 경도 차 보정이 0이다.
- `applyEquationOfTime: false`로 균시차 보정을 적용하지 않는다.
- `applyHistoricalDst: true`만으로 패키지의 IANA `Asia/Seoul` 표준시 변경·서머타임 표를 적용한다.
- 따라서 출생지 경도나 진태양시 보정을 기본 활성화하지 않으면서 역사적 민간시를 반영한다.

권위·구현 근거:

- 패키지: `manseryeok@2.0.0`, 저장소 `https://github.com/yhj1024/manseryeok`
- 패키지 README: KASI 분 단위 절입표, KASI 음력, IANA `Asia/Seoul`, 일 경계 세 관법 명시
- 패키지 소스: `node_modules/manseryeok/dist/time/korea-timezone.js`
- IANA time zone database 안내: `https://www.iana.org/time-zones/tz-link`

고정 회귀:

- 표준시 변경 대표 시점: 1908, 1912, 1954, 1961
- 서머타임 대표 시점: 1955, 1988
- 1955-06-06 `21:12 -> 21:13` 월주 경계
- 1988-09-07 `20:11 -> 20:12` 월주 경계
- 결과 계약: `timeStandard: "asia-seoul-civil"`, `trueSolarCorrection: false`

### 3. 궁합 새 인물의 음력 평달·윤달

- 궁합 새 인물 폼에 접근 가능한 `평달/윤달` 라디오 그룹을 추가했다.
- 음력일 때만 제어를 활성화하고 `isLeapMonth`를 계산기에 전달한다.
- 실제 윤4월인 2020년 입력은 정상 변환하며, 존재하지 않는 2024년 윤2월은 평달로 대체하지 않고 거부한다.
- 버튼 높이 44px 이상, `radiogroup`, `aria-labelledby`, 선택 상태를 브라우저 회귀로 확인했다.

### 4. 주 저장소 읽기 실패

- 주 저장소 `list` 실패, 목록 안 개별 `get` 실패, 직접 `get` 실패를 모두 `LEGEND_STORAGE_UNAVAILABLE`로 전파한다.
- 실패를 빈 목록이나 누락된 레코드로 변환하지 않는다.
- UI는 기존 저장 명반 화면을 유지하고 저장소 상태를 확인할 수 없다는 알림을 표시한다.
- 주 저장소 읽기가 성공한 경우에만 최신 폴백 레코드 병합 동작을 유지한다.

### 5. 디자인·설명·접근성

- 입력 화면의 `고급 계산 설정`에서 `midnight`, `jasi`, `splitJasi`를 선택할 수 있다.
- 기본값은 `midnight`이며 선택은 `legend-saju:day-boundary`에 저장하고 다시 불러온다.
- 결과·전설 근거에서 `명리 계산 · KASI`, `간이 용신 후보`, `취명선 창작 규칙`을 분리 표시한다.
- 용신 표현은 모두 `간이 용신 후보`로 바꾸고 오행 후보 선정 이유와 지지·소모 수치를 공개한다.
- iPhone 높이에서 근거 모달이 하단 버튼으로 자동 스크롤되던 문제를 실패 테스트로 재현했다. 제목을 초기 포커스로 지정하고 `scrollTop = 0`을 보장해 제목과 KASI 근거부터 보이게 수정했다.
- 일 경계 버튼과 음력 선택 버튼은 44px 이상 터치 영역, 키보드 포커스, 모달 포커스 복귀·순환을 유지한다.

## 테스트 우선 증빙

- 각 최종 리뷰 계약을 먼저 테스트에 추가해 기존 구현에서 실패를 확인했다.
- 저장소 주 읽기 실패는 기존 코드가 빈 목록·`null`로 축소해 실패했다.
- 절입일 시각 미상, 역사 민간시, 궁합 윤달, 고급 일 경계, 출처 표시는 구현 전 실패했다.
- 스크린샷 검토에서 발견한 근거 모달은 수정 전 `scrollTop = 209`로 실패했고 수정 후 `0`과 제목 포커스로 통과했다.

최종 실행:

```text
npm test
core: 65 passed, 0 failed, 0 skipped
UI regression PASS: 360, 390, 412, 768, 1220
duration: 105.4s
```

추가 검증:

- `node --test tests/ganji-fixtures.test.js tests/final-fix-contracts.test.js tests/pwa-isolation.test.js`: 48개 통과
- `npm run build:vendor`: 통과, 생성 번들 diff 없음
- `npm audit`: 취약점 0건
- `npm audit --omit=dev`: 취약점 0건
- `git diff --check`: 통과
- 새 변경분의 `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `eval`, `new Function`, `document.write`: 추가 0건
- `git fsck --connectivity-only`: 통과

## 스크린샷

- `screenshots/final-fix-390-advanced.png`: iPhone 폭 고급 일 경계 설정
- `screenshots/final-fix-390-evidence.png`: iPhone 폭 근거 모달 초기 위치와 출처 구분
- `screenshots/final-fix-1220-evidence.png`: 데스크톱 근거 모달

스크린샷은 SDD 로컬 증빙 디렉터리의 기존 ignore 정책을 유지하며, 아래 해시로 캡처 결과를 고정한다.

## SHA-256

```text
scripts/vendor/manseryeok.browser.js
D44E8786C84779A17C06C7790717FAD414B3A0AB20DA77240C26F2DC8B968350

package-lock.json
A14028C8B64223C272DD8E0B2D2BEFC1D9478B0883588FAA07F2A2030995794B

screenshots/final-fix-390-advanced.png
D03ABAB144D5AB0C960A05E2C06D62360341B09B35CCE97EC5EF56CEE4281D52

screenshots/final-fix-390-evidence.png
3B46F0D64FD9E3A29E0E392415F99156D6F6ED2D53E8D4AA0D6DB8A892AFCA8B

screenshots/final-fix-1220-evidence.png
68C9B070EE220EA654917C03EFEE9AB31F4D3D6FFEC865F467136405D6137482
```

## 배포

배포하지 않았다. 원격 저장소, GitHub Pages, 서비스 운영 상태를 변경하지 않았다.
