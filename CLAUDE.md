# CLAUDE.md - VibedQA

> Claude Code가 프로젝트 컨텍스트를 빠르게 이해하도록 돕는 파일

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | **VibedQA** |
| 한 줄 설명 | AI-powered visual QA that clicks through your app like a real user |
| URL | (TBD) |
| 실행 방식 | CLI 우선 (`npx vibedqa --url [URL]`) |
| 타겟 유저 | Vibe coder, 솔로 파운더, 인디 개발자 |

**핵심 원칙: 스크린샷만 찍는 도구가 아니다. Playwright가 실제 유저처럼 클릭/입력/네비게이션하는 자율 QA 봇이다.**

## 기술 스택

| 영역 | 기술 |
|------|------|
| Runtime | Node.js + TypeScript |
| 브라우저 자동화 | Playwright |
| AI 분석 | Gemini Vision API |
| 이미지 비교 | pixelmatch |
| CLI | commander.js |
| 로깅 | chalk |
| 리포트 | HTML (자체 템플릿) |
```bash
npm run dev   # 개발 모드
npm run build # 빌드
npx vibedqa --url https://vcreview.xyz  # 실행
```

## 아키텍처: 3단계 파이프라인
```
Input (URL) → Crawler (Playwright) → Analyzer (Gemini Vision) → Reporter (HTML)
               (탐색+클릭+캡쳐)       (AI 분석+diff)              (리포트 생성)
```

| 단계 | 역할 | 핵심 파일 |
|------|------|----------|
| 1. Crawler | 페이지 탐색, 요소 클릭, 폼 입력, 스크린샷, 에러 수집 | `crawler/*.ts` |
| 2. Analyzer | Gemini Vision 분석, pixelmatch diff, 콘솔 에러 분석 | `analyzer/*.ts` |
| 3. Reporter | HTML 리포트 생성, 터미널 요약 | `reporter/*.ts` |

## 프로젝트 구조
```
src/
├── index.ts                 # 엔트리포인트
├── cli.ts                   # CLI 파싱 (commander.js)
├── config.ts                # 설정 타입 + 기본값
│
├── crawler/                 # Phase 1: 브라우저 자동화
│   ├── index.ts             # 크롤러 오케스트레이터
│   ├── explorer.ts          # 페이지 탐색 + 링크 수집 (BFS)
│   ├── interactor.ts        # 클릭 + 폼 입력
│   ├── screenshotter.ts     # 스크린샷 촬영
│   ├── stateDetector.ts     # 상태 변화 감지
│   ├── errorCollector.ts    # 콘솔/네트워크 에러 수집
│   └── variantCapture.ts    # 다크/라이트, 한/영 전환
│
├── analyzer/                # Phase 2: AI 분석
│   ├── index.ts             # 분석 오케스트레이터
│   ├── vision.ts            # Gemini Vision API
│   ├── diff.ts              # pixelmatch 비교
│   ├── consoleAnalyzer.ts   # 에러 분석
│   └── prompts.ts           # AI 프롬프트 템플릿
│
├── reporter/                # Phase 3: 리포트
│   ├── index.ts
│   ├── html.ts              # HTML 리포트
│   ├── terminal.ts          # 터미널 출력
│   └── template.html        # 리포트 템플릿
│
├── types.ts                 # TypeScript 타입
└── utils/
    ├── logger.ts            # chalk 로깅
    └── fileManager.ts       # 파일 관리
```

## 자주 수정하는 파일

| 작업 | 파일 |
|------|------|
| 크롤링 로직 | `crawler/explorer.ts`, `crawler/interactor.ts` |
| AI 프롬프트 튜닝 | `analyzer/prompts.ts` |
| 리포트 UI | `reporter/html.ts`, `reporter/template.html` |
| CLI 옵션 추가 | `cli.ts` |
| 타입 변경 | `types.ts` |

## 코딩 컨벤션

### 네이밍
- 파일: `camelCase.ts`
- 타입/인터페이스: `PascalCase`
- 함수/변수: `camelCase`
- 상수: `UPPER_SNAKE_CASE`

### Git
- 커밋 메시지 영어, 간결하게
- `feat:` / `fix:` / `refactor:` / `docs:` / `chore:` 프리픽스

---

## Playwright 베스트 프랙티스

### Locator 우선순위
```typescript
// ✅ 권장 (순서대로)
page.getByRole('button', { name: '시작하기' })
page.getByText('분석 시작')
page.getByTestId('submit-button')
page.locator('button.primary')

// ❌ 비권장
page.locator('#btn-123')  // brittle
page.locator('div > div > button')  // brittle
```

### 대기 전략
```typescript
// ✅ 권장: 특정 조건 대기
await page.waitForSelector('.result-panel');
await page.waitForURL('**/results');
await locator.waitFor({ state: 'visible' });

// ⚠️ 주의: networkidle은 느리고 불안정
await page.waitForLoadState('networkidle');

// ❌ 금지: 하드코딩 대기
await page.waitForTimeout(3000);  // 최후의 수단으로만
```

### 클릭 전 체크
```typescript
// ✅ 항상 visible 확인 후 클릭
const btn = page.locator('button');
if (await btn.isVisible()) {
  await btn.click();
}

// ✅ 뷰포트 안에 있는지 확인
const box = await btn.boundingBox();
if (box && box.y >= 0 && box.y < viewportHeight) {
  await btn.click();
}
```

### 이벤트 리스너
```typescript
// ✅ 페이지 로드 전에 등록
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', error => crashes.push(error.message));
page.on('response', res => {
  if (res.status() >= 400) httpErrors.push({ url: res.url(), status: res.status() });
});

// 리스너 등록 후 페이지 이동
await page.goto(url);
```

### 스크린샷
```typescript
// ✅ 전체 페이지 캡쳐
await page.screenshot({ path: 'full.png', fullPage: true });

// ✅ 특정 요소만
await locator.screenshot({ path: 'element.png' });

// ✅ 모바일 에뮬레이션
const iPhone = devices['iPhone 14'];
const context = await browser.newContext({ ...iPhone });
```

### 새 탭 / 팝업 처리
```typescript
// ✅ 새 탭 감지
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target=_blank]')
]);
await newPage.waitForLoadState();
```

### page.evaluate 주의
```typescript
// ❌ 외부 변수 직접 참조 불가
const selector = '.my-class';
await page.evaluate(() => {
  document.querySelector(selector);  // ReferenceError
});

// ✅ 파라미터로 전달
await page.evaluate((sel) => {
  document.querySelector(sel);
}, selector);
```

---

## Gemini Vision API 규칙

### 이미지 전송
```typescript
// ✅ base64 인코딩
const imageBuffer = fs.readFileSync('screenshot.png');
const base64 = imageBuffer.toString('base64');

const response = await model.generateContent([
  { inlineData: { mimeType: 'image/png', data: base64 } },
  { text: prompt }
]);
```

### 비교 분석
```typescript
// ✅ 여러 이미지 동시 전송 (다크/라이트 비교 등)
const response = await model.generateContent([
  { inlineData: { mimeType: 'image/png', data: lightModeBase64 } },
  { inlineData: { mimeType: 'image/png', data: darkModeBase64 } },
  { text: "Compare these two screenshots..." }
]);
```

### JSON 응답
```typescript
// ✅ 프롬프트에 명시
const prompt = `
Analyze this screenshot. Respond ONLY in JSON, no markdown, no backticks.
{
  "issues": [
    { "severity": "critical|warning|info", "title": "...", "description": "...", "fix": "..." }
  ]
}`;

// ✅ 파싱 시 안전하게
const text = response.text().replace(/```json|```/g, '').trim();
const parsed = JSON.parse(text);
```

### Rate Limit
- 배치 처리: 스크린샷 여러 장을 순차 전송, 각 호출 사이 1초 딜레이
- 에러 시 retry: 3회까지, exponential backoff

---

## 주의사항

### 크롤링 Edge Cases
- 인증 필요한 페이지: v0.2에서 쿠키/토큰 옵션 추가 예정
- 무한 스크롤: 스크롤 횟수 제한 (기본 5회)
- iframe: 기본 무시
- CAPTCHA: 감지 시 스킵 + 리포트 기록
- SPA: hashchange, popstate 감지 필요

### API 비용
- Gemini Vision: 스크린샷 장당 비용 추적
- 불필요한 API 호출 최소화 (유사 스크린샷 중복 제거)

---

## 참조 문서

| 문서 | 내용 |
|------|------|
| VIBEDQA_PLAN.md | 전체 기획 문서 (상세 스펙) |
| AGENTS.md | 코딩 에이전트용 컨텍스트 인덱스 |
