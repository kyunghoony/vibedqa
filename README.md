# VibedQA

> AI-powered visual QA that clicks through your app like a real user. Catches what your AI couldn't.

![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-latest-2EAD33?logo=playwright)
![Gemini](https://img.shields.io/badge/Gemini-Vision_API-4285F4?logo=google)

---

## What is VibedQA?

You vibe-coded your app. It looks great... until it doesn't.

VibedQA is an autonomous QA bot that takes a URL, clicks through your entire app like a real user, and uses AI to find what's broken. No test code. No config files. Just a URL.

**What it catches:**
- 🔴 Broken pages, 404s, JS crashes
- 🟡 Layout shifts, dark mode issues, text overflow
- 🟡 Hardcoded strings (Korean in English mode, etc.)
- 🟡 Responsive breakage on mobile
- 🔵 UX anti-patterns, accessibility issues
- 🔵 CSP errors with fix suggestions

## How It Works
```
URL → Playwright crawls & clicks → AI analyzes screenshots → HTML report
```

1. **Crawl**: Playwright visits your site, discovers all clickable elements, and interacts with them like a real user — clicking buttons, filling forms, navigating links.
2. **Capture**: Screenshots at every state change. Desktop & mobile. Dark & light mode. Multiple languages.
3. **Analyze**: Gemini Vision AI reviews every screenshot for visual bugs, layout issues, and UX problems.
4. **Report**: HTML report with issues ranked by severity, screenshots attached, and specific fix suggestions.

## Quick Start

### Prerequisites
- Node.js 18+
- Gemini API Key ([get one here](https://aistudio.google.com/apikey))

### Install & Run
```bash
# Install
npm install -g vibedqa

# Set API key
export GEMINI_API_KEY=your_key_here

# Run
vibedqa --url https://your-app.com
```

Or use npx without installing:
```bash
npx vibedqa --url https://your-app.com
```

### Output
```
🚀 VibedQA v0.1.0

[09:46:01]  🌐 Loading https://your-app.com...
[09:46:02]  📋 Found 12 interactive elements
[09:46:02]  🖱  CLICKING "Get Started" button...
[09:46:03]  📸 CAPTURE: landing_to_app.png
[09:46:04]  🖱  CLICKING "Dark Mode Toggle"...
[09:46:05]  📸 CAPTURE: dark_mode.png
[09:46:10]  🔴 CONSOLE ERROR: CSP violation detected
[09:46:20]  ⚠  Hardcoded Korean text in English mode
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Pages scanned:    4
  Elements clicked: 47
  Screenshots:      86
  Issues found:     14
    🔴 Critical:    3
    🟡 Warning:     7
    🔵 Info:        4

  📄 Report: ./vibedqa-reports/your-app-20260205/report.html
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## CLI Options
```bash
vibedqa --url https://your-app.com \
  --lang ko,en \              # Languages to test
  --theme dark,light \        # Themes to test
  --viewport desktop,mobile \ # Viewports
  --depth 3 \                 # Max navigation depth
  --output ./reports \        # Report output path
  --verbose                   # Detailed logging
```

| Option | Default | Description |
|--------|---------|-------------|
| `--url` | (required) | URL to test |
| `--lang` | auto | Languages to test (comma-separated) |
| `--theme` | dark,light | Themes to test |
| `--viewport` | desktop,mobile | Viewports (desktop: 1280x720, mobile: 390x844) |
| `--depth` | 3 | Max link navigation depth |
| `--output` | ./vibedqa-reports | Report output directory |
| `--ai-model` | gemini | AI model (gemini / claude) |
| `--no-click` | false | Disable click exploration |
| `--no-input` | false | Disable form auto-fill |
| `--no-navigate` | false | Stay on current page only |
| `--max-clicks` | 50 | Max clicks per page |
| `--timeout` | 30000 | Page load timeout (ms) |
| `--verbose` | false | Verbose logging |

## Report

VibedQA generates an HTML report with:

- **Summary dashboard** — pages, clicks, screenshots, issues at a glance
- **Issues by severity** — Critical → Warning → Info
- **Each issue includes:**
  - Screenshot
  - Reproduction path (Home → Menu → Settings → 404)
  - AI analysis
  - Specific fix suggestion
- **Screenshot diff** — dark/light, ko/en layout comparison
- **Console errors** — categorized with fix suggestions
- **Full interaction log** — every click and input recorded

## Why VibedQA?

| | Traditional QA Tools | VibedQA |
|---|---|---|
| Setup | Config files, test scripts | Just a URL |
| Interaction | Screenshots only | Clicks, types, navigates |
| Analysis | Pixel diff | AI judgment + fix suggestions |
| Target user | QA engineers | Vibe coders, solo founders |
| Time to first result | Hours | Minutes |

### vs Existing Tools

- **Applitools**: Enterprise, expensive, complex → VibedQA is lightweight, free CLI
- **BackstopJS**: Needs config, no AI → VibedQA is zero-config + AI analysis
- **Cypress/Playwright tests**: Write test code → VibedQA needs no code
- **Lighthouse**: Performance/accessibility only → VibedQA does visual + interaction QA

## Built For Vibe Coders

You built your app with AI. Now QA it with AI.

VibedQA was born from the pain of building [VCReview](https://vcreview.xyz) — an AI investment committee simulator. After countless hours fixing dark mode bugs, hunting hardcoded Korean strings in English mode, and chasing layout shifts, we built the tool we wished we had.

## Tech Stack

| | |
|---|---|
| **Browser Automation** | Playwright |
| **AI Analysis** | Gemini Vision API |
| **Image Diff** | pixelmatch |
| **CLI** | commander.js |
| **Language** | TypeScript |
| **Runtime** | Node.js 18+ |

## Roadmap

- [x] v0.1 — CLI + Crawler + AI Analysis + HTML Report
- [ ] v0.2 — Dark/light, i18n, mobile variant comparison
- [ ] v0.3 — Advanced AI analysis, form auto-fill, console error fixes
- [ ] v0.4 — Web dashboard UI
- [ ] v1.0 — Public launch, npm publish, Product Hunt

## Contributing

PRs welcome. See [VIBEDQA_PLAN.md](./VIBEDQA_PLAN.md) for the full spec.

## License

MIT

---

**Built by a 2x founder turned VC who got tired of manually QA-ing vibe-coded apps.**
