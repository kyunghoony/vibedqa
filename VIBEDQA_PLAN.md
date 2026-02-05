# VibedQA — 기획 문서 v1.0

> AI-powered visual QA that clicks through your app like a real user. Catches what your AI couldn't.

---

## 1. 프로젝트 개요

### 1.1 서비스 정의

| 항목 | 내용 |
|------|------|
| 서비스명 | **VibedQA** |
| 한 줄 설명 | Vibe coding으로 만든 앱을 AI가 직접 클릭하며 QA하는 자동화 도구 |
| 레포명 | `vibedqa` |
| 실행 방식 | CLI 우선 → 웹 대시보드 (Phase 2) |
| 타겟 유저 | Vibe coder, 솔로 파운더, 인디 개발자 |
| 핵심 가치 | URL 하나로, 테스트 코드 없이, AI가 앱을 자율 탐색 + 분석 + fix 제안 |

### 1.2 문제 정의

Vibe coding 시대의 QA 문제:

1. **AI가 만든 프론트엔드는 미묘하게 깨진다**
   - 레이아웃 shift, 반응형 깨짐, 다크모드에서 안 보이는 요소
   - 영어 모드인데 하드코딩된 한국어 잔존
   - CSP 에러 등 콘솔 에러
   - 클릭하면 빈 화면, 404, 크래시

2. **수동 QA는 시간이 너무 걸린다**
   - 매 배포마다 전체 화면 확인 불가능
   - 다크/라이트 × 한/영 × 데스크탑/모바일 = 조합 폭발
   - 솔로 파운더는 QA 인력이 없다

3. **기존 QA 도구는 vibe coder에게 맞지 않는다**
   - Applitools, Wopee.io: 엔터프라이즈 타겟, 비쌈
   - BackstopJS: config 파일 세팅 필요
   - Cypress/Playwright: 테스트 코드 직접 작성 필요
   - 전부 "QA 엔지니어"를 위한 도구

### 1.3 솔루션

URL 하나 넣으면:
1. **Playwright**가 실제 유저처럼 사이트를 자동 탐색 (클릭, 입력, 네비게이션)
2. 모든 상태를 **스크린샷**으로 캡쳐
3. **AI (Gemini Vision)**가 스크린샷을 분석해서 이슈 감지 + fix 제안
4. **HTML 리포트**로 정리해서 출력

### 1.4 경쟁 서비스 분석

| 서비스 | 특징 | 약점 | VibedQA 차별점 |
|--------|------|------|---------------|
| **Applitools Autonomous** | URL 자동 크롤링 + Visual AI, 40억 스크린 학습 | 엔터프라이즈 타겟, 비쌈, 복잡 | 인디/솔로용 경량, 무료 CLI |
| **Wopee.io** | URL 하나로 5분 80% 커버리지 | 비주얼 리그레션 중심, AI fix 제안 없음 | AI fix 제안 + 하드코딩 문자열 감지 |
| **BrowserStack Scanner** | 성능/접근성/링크/반응형 올인원 | 인터랙션 없음, 정적 스캔 | 실제 클릭 + 유저 플로우 탐색 |
| **BackstopJS** | 오픈소스, 스크린샷 diff | config 세팅 필요, AI 없음 | Zero-config + AI 판단 |
| **Momentic.ai** | AI 네이티브 E2E, 자연어 테스트 | 테스트 작성이 목적 | QA 자체가 목적 (코드 불필요) |
| **Katalon** | 올인원 테스트 플랫폼 | 무거움, 학습 커브 | 5분 내 결과, 학습 없음 |

**핵심 포지셔닝: 기존 도구는 "QA 엔지니어를 위한 도구". VibedQA는 "QA 엔지니어가 없는 vibe coder를 위한 도구".**

---

## 2. 기술 스택

| 영역 | 기술 | 이유 |
|------|------|------|
| Runtime | Node.js + TypeScript | 빠른 개발, Playwright 네이티브 지원 |
| 브라우저 자동화 | **Playwright** | Headless 브라우저, 멀티 뷰포트, 네트워크 인터셉트 |
| AI 분석 | **Gemini Vision API** | 멀티모달, 스크린샷 분석, 비용 효율 |
| 이미지 비교 | **pixelmatch** | 경량, 정확한 픽셀 diff |
| 리포트 | HTML (자체 템플릿) | 스크린샷 인라인, 브라우저에서 바로 열기 |
| CLI 프레임워크 | **commander.js** | 표준, 가벼움 |
| 로깅 | **chalk** + custom | 컬러 터미널 로그 |

---

## 3. 아키텍처

### 3.1 전체 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                │
│                    npx vibedqa --url [URL]                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: AUTONOMOUS CRAWLER (Playwright)                        │
│  ───────────────────────────────────────────────────────────────  │
│                                                                   │
│  1.1 Initial Load                                                │
│  • URL 접속 + 페이지 로드 대기                                     │
│  • 콘솔 에러 리스너 등록                                           │
│  • 네트워크 에러 리스너 등록                                       │
│                                                                   │
│  1.2 Element Discovery                                           │
│  • 클릭 가능 요소 수집 (button, a, input, select, [role=button]) │
│  • 폼 필드 수집 (input[type=text], textarea, select)             │
│  • 네비게이션 링크 수집 (<a href>)                                │
│                                                                   │
│  1.3 Interaction Loop                                            │
│  • 각 요소 클릭 → 상태 변화 대기 → 스크린샷                       │
│  • 폼 필드 입력 → 결과 확인 → 스크린샷                            │
│  • 모달/드롭다운/토글 상태 변화 감지 → 스크린샷                    │
│  • 에러 발생 시 즉시 기록                                         │
│                                                                   │
│  1.4 Navigation                                                  │
│  • 같은 도메인 링크 따라가기                                       │
│  • 방문 URL Set 관리 (중복 방지)                                  │
│  • depth 제한 (기본 3)                                            │
│  • 각 페이지에서 1.2 ~ 1.3 반복                                  │
│                                                                   │
│  1.5 Variant Capture                                             │
│  • 다크/라이트 모드 전환 캡쳐                                      │
│  • 한/영 전환 캡쳐                                                │
│  • 데스크탑/모바일 뷰포트 캡쳐                                     │
│                                                                   │
│  Output: screenshots[], console_errors[], interaction_log[]      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: AI ANALYSIS (Gemini Vision)                            │
│  ───────────────────────────────────────────────────────────────  │
│                                                                   │
│  2.1 Visual Analysis                                             │
│  • 각 스크린샷을 Gemini Vision에 전송                              │
│  • UI 깨짐, 텍스트 잘림, 요소 겹침 감지                           │
│  • 다크모드 contrast 이슈 감지                                    │
│  • 하드코딩 문자열 감지 (영어 모드에 한글 등)                      │
│  • UX 안티패턴 감지                                               │
│                                                                   │
│  2.2 Screenshot Diff                                             │
│  • 다크/라이트 모드 간 레이아웃 shift (pixelmatch)                 │
│  • 한/영 전환 시 레이아웃 shift                                   │
│  • diff 이미지 생성 (변경 부분 하이라이트)                         │
│                                                                   │
│  2.3 Console Error Analysis                                      │
│  • CSP 에러 → 원인 + fix 제안                                    │
│  • JS 에러 → 원인 추정                                           │
│  • 네트워크 에러 → 끊어진 API, 404 리소스 정리                    │
│                                                                   │
│  Output: issues[], diffs[], error_analysis[]                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: REPORT GENERATION                                      │
│  ───────────────────────────────────────────────────────────────  │
│                                                                   │
│  • 이슈 심각도 분류 (Critical / Warning / Info)                   │
│  • 각 이슈 + 스크린샷 + 재현 경로 + fix 제안                      │
│  • HTML 리포트 생성                                               │
│  • 터미널 요약 출력                                               │
│                                                                   │
│  Output: report.html, terminal summary                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Playwright 인터랙션 상세

#### 3.2.1 요소 감지 + 자동 클릭

```
감지 대상:
- button
- a[href]
- input[type=submit]
- input[type=button]
- select
- [role=button]
- [onclick]
- [tabindex]과 click handler가 있는 요소

클릭 순서:
1. 페이지 내 모든 클릭 가능 요소 수집
2. viewport 내 보이는 요소만 필터링 (isVisible)
3. 위에서 아래로, 왼쪽에서 오른쪽으로 순서대로 클릭
4. 각 클릭 후:
   - waitForLoadState('networkidle') 또는 waitForTimeout(2000)
   - DOM 변화 감지 (MutationObserver 스냅샷 비교)
   - URL 변경 감지
   - 새 모달/오버레이 감지
   - 스크린샷 촬영
5. 원래 상태로 복귀 후 다음 요소 클릭
   - 모달 열렸으면 닫기 시도 (ESC / close 버튼)
   - URL 변경되었으면 뒤로가기
```

#### 3.2.2 폼 입력

```
감지 대상:
- input[type=text]
- input[type=email]
- input[type=password]
- input[type=number]
- input[type=url]
- textarea
- select
- input[type=file]

입력 전략:
- text: "VibedQA Test Input"
- email: "test@vibedqa.com"
- password: "TestPass123!"
- number: "42"
- url: "https://example.com"
- textarea: "This is a test input from VibedQA automated QA bot."
- select: 첫 번째 non-disabled 옵션 선택
- file: 테스트용 더미 파일 (PDF, 이미지)

입력 후:
- submit 버튼 있으면 클릭
- 결과 화면 스크린샷
- 에러 메시지 캡쳐
```

#### 3.2.3 네비게이션

```
규칙:
- 같은 도메인 링크만 따라감 (외부 링크는 무시, 존재 여부만 기록)
- 방문한 URL은 Set으로 관리 (중복 방지)
- depth 제한: 기본 3 (CLI 옵션으로 조절 가능)
- SPA 라우팅 지원: hashchange, popstate 감지
- # 앵커 링크는 같은 페이지이므로 스크롤 위치만 변경 후 캡쳐

탐색 알고리즘:
1. 시작 URL 접속
2. 페이지 내 모든 <a href> 수집
3. 같은 도메인 + 미방문 URL 필터링
4. 각 URL 방문 → 인터랙션 루프 실행
5. 새 페이지에서 발견된 링크 큐에 추가
6. depth 제한까지 반복 (BFS)
```

#### 3.2.4 상태 변화 감지

```
감지 방법:
- DOM 변화: page.evaluate로 MutationObserver 또는 DOM 스냅샷 비교
- URL 변화: page.url() 비교
- 모달 감지: [role=dialog], .modal, [aria-modal=true] 등 새로 나타난 요소
- 로딩 상태: 스피너/로딩 인디케이터 감지 → 사라질 때까지 대기
- 빈 화면: document.body.innerText.trim().length === 0

각 상태 변화마다:
- 타임스탬프 기록
- 스크린샷 촬영
- 어떤 액션으로 인한 변화인지 기록
- 에러 여부 확인
```

#### 3.2.5 에러 수집

```
리스너 등록 (페이지 로드 전):
- page.on('console', msg => ...) → console.error 수집
- page.on('pageerror', error => ...) → JS 크래시 수집
- page.on('response', response => ...) → 4xx, 5xx 응답 수집
- page.on('requestfailed', request => ...) → 네트워크 실패 수집

분류:
- CSP 위반: "Content Security Policy" 포함 메시지
- JS 에러: TypeError, ReferenceError, SyntaxError 등
- 네트워크: 404, 500, CORS, timeout
- 기타: 나머지 console.error

각 에러에 기록:
- 메시지
- 발생 URL
- 발생 시점의 액션 (어떤 클릭/입력 후 발생했는지)
- 스택 트레이스 (가능한 경우)
```

### 3.3 AI 분석 상세

#### 3.3.1 Gemini Vision 프롬프트 설계

```
[단일 스크린샷 분석]
System: You are a senior QA engineer analyzing a web application screenshot.
Identify any visual issues in this screenshot.

Check for:
1. Layout issues: elements overlapping, overflow, misalignment
2. Text issues: truncation, unreadable text, wrong encoding
3. Dark mode issues: low contrast, invisible elements, background/text color conflicts
4. Responsive issues: elements too small, horizontal scroll, broken grid
5. Hardcoded strings: text in wrong language (e.g. Korean text in English mode)
6. UX anti-patterns: tiny click targets, unclear CTAs, accessibility issues
7. Visual bugs: broken images, missing icons, rendering artifacts

For each issue found, provide:
- severity: "critical" | "warning" | "info"
- description: what the issue is
- location: where on the screen (top-left, center, etc.)
- fix_suggestion: specific code-level fix recommendation

Respond in JSON format.
```

```
[다크/라이트 모드 비교]
System: Compare these two screenshots of the same page.
The first is light mode, the second is dark mode.

Check for:
1. Elements visible in light but invisible in dark (or vice versa)
2. Text with insufficient contrast in either mode
3. Layout differences between modes (should be identical except colors)
4. Missing dark mode styles (elements still showing light mode colors)
5. Images/icons not adapted for dark mode

Respond in JSON format.
```

```
[한/영 비교]
System: Compare these two screenshots. First is Korean, second is English.

Check for:
1. Hardcoded Korean text remaining in English version
2. Hardcoded English text remaining in Korean version
3. Layout shift caused by different text lengths
4. Truncated text in either language
5. Untranslated UI elements (buttons, labels, tooltips)

Respond in JSON format.
```

```
[모바일/데스크탑 비교]
System: Compare desktop (1280x720) and mobile (390x844) screenshots.

Check for:
1. Elements overflowing mobile viewport
2. Text too small to read on mobile
3. Touch targets smaller than 44x44px
4. Horizontal scrolling on mobile
5. Hidden elements that should be visible (or vice versa)
6. Navigation usability on mobile

Respond in JSON format.
```

#### 3.3.2 콘솔 에러 분석 프롬프트

```
System: Analyze these browser console errors from a web application.

For each error:
1. Classify: CSP | JavaScript | Network | Other
2. Severity: critical | warning | info
3. Root cause: explain likely cause
4. Fix suggestion: specific fix (e.g. which CSP header to add)

Errors:
{errors_json}

Respond in JSON format.
```

### 3.4 리포트 구조

#### 3.4.1 HTML 리포트

```
📊 VibedQA Report
═══════════════════

[Header]
- URL
- 스캔 날짜/시간
- 소요 시간
- 설정 (viewport, theme, lang)

[Summary Dashboard]
┌──────────┬──────────┬──────────┬──────────┐
│ Pages    │ Clicks   │ Screenshots │ Issues │
│ 12       │ 47       │ 86          │ 14     │
├──────────┼──────────┼──────────┼──────────┤
│ 🔴 3     │ 🟡 7     │ 🔵 4     │          │
└──────────┴──────────┴──────────┴──────────┘

[Critical Issues]
#1: 404 on /settings page
├─ 스크린샷: [클릭하면 확대]
├─ 재현 경로: Home → Menu → Settings → 404
├─ 콘솔 에러: "GET /api/settings 404"
├─ AI 분석: "Settings API endpoint missing"
└─ Fix 제안: "Add /api/settings route handler"

[Warnings]
#2: Layout shift on StageProgress
├─ 스크린샷: [before / after 토글]
├─ Diff 이미지: [변경 부분 하이라이트]
├─ 발생 조건: "검토중" 텍스트 나타날 때
└─ Fix 제안: "Set fixed height on container..."

[Info / Suggestions]
#3: Dark mode contrast issue on footer
├─ 스크린샷: [dark mode]
└─ Fix 제안: "Change text color from #666 to #999..."

[Console Errors]
┌─────────┬───────────────────────────────┬─────────────┐
│ Type    │ Message                       │ Fix         │
├─────────┼───────────────────────────────┼─────────────┤
│ CSP     │ Refused to load script...     │ Add to CSP  │
│ JS      │ TypeError: cannot read...     │ Null check  │
│ Network │ GET /api/xxx 404              │ Add route   │
└─────────┴───────────────────────────────┴─────────────┘

[Screenshot Gallery]
- 페이지별 / 상태별 썸네일 그리드
- 클릭하면 원본 크기 확대
- 다크/라이트, 한/영 필터 토글

[Interaction Log]
- 전체 클릭/입력 타임라인
- 각 액션의 결과 (성공/에러)
```

---

## 4. CLI 인터페이스

### 4.1 사용법

```bash
# 기본 실행 (전체 기본값)
npx vibedqa --url https://vcreview.xyz

# 전체 옵션
npx vibedqa \
  --url https://vcreview.xyz \
  --lang ko,en \
  --theme dark,light \
  --viewport desktop,mobile \
  --depth 3 \
  --output ./reports \
  --ai-model gemini \
  --no-click \
  --verbose

# 특정 페이지만
npx vibedqa --url https://vcreview.xyz/en --no-navigate

# 인터랙션 없이 스크린샷만
npx vibedqa --url https://vcreview.xyz --no-click --no-input
```

### 4.2 CLI 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--url` | (필수) | 테스트할 사이트 URL |
| `--lang` | auto | 테스트할 언어 (ko,en,ja 등) |
| `--theme` | dark,light | 테스트할 테마 |
| `--viewport` | desktop,mobile | 뷰포트 (desktop: 1280x720, mobile: 390x844) |
| `--depth` | 3 | 최대 링크 탐색 depth |
| `--output` | ./vibedqa-reports | 리포트 저장 경로 |
| `--ai-model` | gemini | AI 모델 선택 (gemini / claude) |
| `--no-click` | false | 클릭 탐색 비활성화 |
| `--no-input` | false | 폼 입력 비활성화 |
| `--no-navigate` | false | 링크 따라가기 비활성화 (현재 페이지만) |
| `--verbose` | false | 상세 로그 출력 |
| `--timeout` | 30000 | 페이지 로드 타임아웃 (ms) |
| `--max-clicks` | 50 | 페이지당 최대 클릭 수 |

### 4.3 터미널 출력 예시

```
🚀 VibedQA v0.1.0

[09:46:01]  🌐 Loading https://vcreview.xyz...
[09:46:02]  📋 Found 12 interactive elements
[09:46:02]  🖱  CLICKING "시작하기" button...
[09:46:03]  📸 CAPTURE: landing_to_app_transition.png
[09:46:03]  ▶ State Transition: URL changed to /app
[09:46:04]  🖱  CLICKING "다크모드 토글"...
[09:46:04]  🎨 Theme changed to dark
[09:46:05]  📸 CAPTURE: dark_mode_app.png
[09:46:05]  ⌨  TYPING test data into "Deal Memo" textarea...
[09:46:06]  📸 CAPTURE: form_filled.png
[09:46:07]  🖱  CLICKING "분석 시작" button...
[09:46:08]  ⏳ Loading state detected, waiting...
[09:46:15]  📸 CAPTURE: analysis_progress.png
[09:46:16]  🔴 CONSOLE ERROR: Refused to load script (CSP)
[09:46:20]  🔗 NAVIGATING to /en...
[09:46:21]  📸 CAPTURE: english_mode.png
[09:46:21]  ⚠  Possible hardcoded Korean text detected

[09:47:00]  ✅ Crawl complete. 4 pages, 47 clicks, 86 screenshots.
[09:47:01]  🤖 Running AI analysis...
[09:47:30]  📊 Report generated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Pages scanned:    4
  Elements clicked: 47
  Screenshots:      86
  Issues found:     14
    🔴 Critical:    3
    🟡 Warning:     7
    🔵 Info:        4
  Console errors:   5

  📄 Full report: ./vibedqa-reports/vcreview-xyz-20260205/report.html
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. 프로젝트 구조

```
vibedqa/
├── src/
│   ├── index.ts                 # 엔트리포인트
│   ├── cli.ts                   # CLI 파싱 (commander.js)
│   ├── config.ts                # 설정 타입 + 기본값
│   │
│   ├── crawler/                 # Phase 1: 브라우저 자동화
│   │   ├── index.ts             # 크롤러 메인 오케스트레이터
│   │   ├── explorer.ts          # 페이지 탐색 + 링크 수집 (BFS)
│   │   ├── interactor.ts        # 클릭 + 폼 입력 인터랙션
│   │   ├── screenshotter.ts     # 스크린샷 촬영 + 관리
│   │   ├── stateDetector.ts     # DOM/URL/모달 상태 변화 감지
│   │   ├── errorCollector.ts    # 콘솔/네트워크 에러 수집
│   │   └── variantCapture.ts    # 다크/라이트, 한/영, 뷰포트 전환
│   │
│   ├── analyzer/                # Phase 2: AI 분석
│   │   ├── index.ts             # 분석 메인 오케스트레이터
│   │   ├── vision.ts            # Gemini Vision API 호출
│   │   ├── diff.ts              # pixelmatch 스크린샷 비교
│   │   ├── consoleAnalyzer.ts   # 콘솔 에러 AI 분석
│   │   └── prompts.ts           # AI 프롬프트 템플릿
│   │
│   ├── reporter/                # Phase 3: 리포트 생성
│   │   ├── index.ts             # 리포트 메인
│   │   ├── html.ts              # HTML 리포트 생성
│   │   ├── terminal.ts          # 터미널 요약 출력
│   │   └── template.html        # HTML 리포트 템플릿
│   │
│   ├── types.ts                 # 전체 TypeScript 타입
│   └── utils/
│       ├── logger.ts            # 컬러 로깅 (chalk)
│       └── fileManager.ts       # 스크린샷/리포트 파일 관리
│
├── test-fixtures/               # 테스트용 더미 파일
│   ├── sample.pdf
│   └── sample.png
│
├── package.json
├── tsconfig.json
├── README.md
└── .env.example
```

---

## 6. 데이터 모델

### 6.1 핵심 타입

```typescript
// 스캔 설정
interface ScanConfig {
  url: string;
  languages: string[];         // ['ko', 'en']
  themes: string[];            // ['dark', 'light']
  viewports: Viewport[];       // [{name: 'desktop', width: 1280, height: 720}]
  maxDepth: number;
  maxClicksPerPage: number;
  timeout: number;
  enableClick: boolean;
  enableInput: boolean;
  enableNavigation: boolean;
}

// 인터랙션 로그
interface InteractionLog {
  timestamp: string;
  action: 'click' | 'input' | 'navigate' | 'theme_switch' | 'lang_switch';
  target: string;              // 요소 설명 ("시작하기 button", "Deal Memo textarea")
  selector: string;            // CSS selector
  url: string;                 // 현재 URL
  result: 'success' | 'error' | 'no_change';
  screenshotPath?: string;
  error?: string;
}

// 스크린샷 메타데이터
interface Screenshot {
  path: string;
  url: string;
  viewport: string;            // 'desktop' | 'mobile'
  theme: string;               // 'dark' | 'light'
  language: string;            // 'ko' | 'en'
  state: string;               // 'initial' | 'after_click_button_1' | ...
  timestamp: string;
}

// 콘솔 에러
interface ConsoleError {
  type: 'csp' | 'javascript' | 'network' | 'other';
  message: string;
  url: string;
  timestamp: string;
  triggerAction?: string;      // 어떤 액션 후 발생했는지
  stackTrace?: string;
}

// AI 분석 결과
interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'layout' | 'text' | 'darkmode' | 'responsive' | 'i18n' | 'ux' | 'error';
  title: string;
  description: string;
  screenshotPath: string;
  diffImagePath?: string;
  location: string;            // "top-left", "center" 등
  reproducePath: InteractionLog[];  // 재현 경로
  fixSuggestion: string;
}

// 최종 리포트
interface Report {
  url: string;
  scanDate: string;
  duration: number;            // ms
  config: ScanConfig;
  summary: {
    pagesScanned: number;
    elementsClicked: number;
    screenshotsTaken: number;
    issuesFound: number;
    critical: number;
    warning: number;
    info: number;
    consoleErrors: number;
  };
  issues: Issue[];
  consoleErrors: ConsoleError[];
  interactionLog: InteractionLog[];
  screenshots: Screenshot[];
}
```

---

## 7. 이슈 심각도 기준

| 심각도 | 기준 | 예시 |
|--------|------|------|
| 🔴 **Critical** | 기능 불가, 크래시, 데이터 손실 | 404 페이지, 빈 화면, JS 크래시, 클릭 무반응, 폼 제출 실패 |
| 🟡 **Warning** | 시각적 문제, UX 저하 | 레이아웃 shift, 다크모드 contrast, 텍스트 잘림, 하드코딩 문자열, overflow |
| 🔵 **Info** | 개선 제안, 베스트 프랙티스 | 작은 클릭 타겟, 접근성 개선, 로딩 속도, UX 제안 |

---

## 8. 환경변수

```bash
# 필수
GEMINI_API_KEY=your_gemini_api_key

# 선택 (추후)
CLAUDE_API_KEY=your_claude_api_key     # Claude Vision 사용 시
VIBEDQA_OUTPUT_DIR=./vibedqa-reports   # 기본 출력 경로
```

---

## 9. 개발 로드맵

### v0.1 — MVP (1주)

**목표: URL 넣으면 클릭하고 스크린샷 찍고 AI가 분석하는 기본 파이프라인**

| 우선순위 | 태스크 | 파일 |
|----------|--------|------|
| P0 | CLI 기본 구조 (commander.js) | cli.ts |
| P0 | Playwright 크롤러 — 페이지 로드 + 스크린샷 | crawler/explorer.ts, screenshotter.ts |
| P0 | 클릭 가능 요소 자동 순회 | crawler/interactor.ts |
| P0 | 콘솔 에러 수집 | crawler/errorCollector.ts |
| P0 | Gemini Vision 단일 스크린샷 분석 | analyzer/vision.ts |
| P0 | HTML 리포트 기본 출력 | reporter/html.ts |
| P1 | 터미널 요약 출력 | reporter/terminal.ts |
| P1 | 링크 네비게이션 (BFS, depth 제한) | crawler/explorer.ts |

### v0.2 — Variant Capture (3일)

**목표: 다크/라이트, 한/영, 모바일/데스크탑 비교**

| 우선순위 | 태스크 |
|----------|--------|
| P0 | 다크/라이트 모드 전환 캡쳐 |
| P0 | 한/영 전환 캡쳐 |
| P0 | 모바일 뷰포트 캡쳐 |
| P0 | pixelmatch diff 이미지 생성 |
| P1 | AI 비교 분석 (다크/라이트, 한/영, 반응형) |

### v0.3 — Advanced Analysis (3일)

**목표: 더 정확한 AI 분석 + 더 나은 리포트**

| 우선순위 | 태스크 |
|----------|--------|
| P0 | 콘솔 에러 AI 분석 + fix 제안 |
| P0 | 하드코딩 문자열 감지 고도화 |
| P1 | 리포트 UI 개선 (필터링, 갤러리, diff 토글) |
| P1 | 폼 자동 입력 |
| P2 | 재현 경로 기록 + 리포트 포함 |

### v0.4 — 웹 대시보드 (1주)

**목표: CLI 대신 브라우저에서 사용**

| 우선순위 | 태스크 |
|----------|--------|
| P0 | 웹 UI — URL 입력 + 실시간 로그 |
| P0 | 리포트 뷰어 |
| P1 | 히스토리 (이전 스캔 결과 비교) |
| P2 | CI/CD 연동 (GitHub Actions) |

### v1.0 — 공개 런칭

| 태스크 |
|--------|
| npm publish |
| Product Hunt 런칭 |
| 문서 정비 + 예제 |
| 랜딩페이지 |

---

## 10. 주의사항 / Edge Cases

### 10.1 크롤링

- **인증 필요한 페이지**: 로그인 후 쿠키/토큰 세팅 옵션 필요 (v0.2+)
- **무한 스크롤**: 스크롤 횟수 제한 설정
- **iframe**: 기본은 무시, 옵션으로 진입 가능
- **팝업/새 탭**: 새 탭 열리면 감지 후 해당 탭도 탐색
- **Rate limiting**: 클릭 간 딜레이 (기본 1초) 설정 가능
- **CAPTCHA**: 감지 시 스킵 + 리포트에 기록

### 10.2 AI 분석

- **API 비용**: 스크린샷 100장 기준 Gemini Vision 비용 추정 필요
- **Rate limiting**: Gemini API 호출 제한 고려, 배치 처리
- **False positive**: AI가 정상인 것을 이슈로 잡을 수 있음 → 심각도 분류로 완화
- **False negative**: AI가 놓칠 수 있음 → pixelmatch diff로 보완

### 10.3 리포트

- **스크린샷 용량**: 100장+ 될 수 있음 → 압축 + 썸네일
- **HTML 리포트 크기**: 스크린샷 인라인 시 MB 단위 → base64 대신 파일 참조
- **리포트 비교**: v0.4에서 이전/현재 리포트 diff 기능

---

## 11. 성공 지표

### 11.1 제품 지표

| 지표 | 목표 |
|------|------|
| 스캔 시간 | 10페이지 기준 5분 이내 |
| 이슈 감지 정확도 | False positive 20% 이하 |
| 리포트 유용성 | fix 제안 중 50% 이상 실제 적용 가능 |

### 11.2 비즈니스 지표 (v1.0+)

| 지표 | 목표 |
|------|------|
| GitHub stars | 런칭 1주 100+ |
| npm weekly downloads | 런칭 1달 500+ |
| PH upvotes | Top 10 |

---

## 12. 요약

VibedQA는 **"URL 하나로 앱 전체를 AI가 QA해주는 도구"**다.

기존 QA 도구와의 핵심 차이 3가지:
1. **Zero-config**: 테스트 코드 없이 URL만 넣으면 끝
2. **Autonomous interaction**: 스크린샷만 찍는 게 아니라 실제 클릭/입력
3. **AI fix suggestion**: 이슈 감지 + 구체적 수정 방법까지 제안

타겟: QA 엔지니어가 없는 vibe coder, 솔로 파운더, 인디 개발자
