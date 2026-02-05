export const SINGLE_SCREENSHOT_PROMPT = `You are a senior QA engineer analyzing a web application screenshot.
Identify any visual issues in this screenshot.

Check for:
1. Layout issues: elements overlapping, overflow, misalignment, broken grid
2. Text issues: truncation, unreadable text, wrong encoding, text overflow
3. Dark mode issues: low contrast, invisible elements, background/text color conflicts
4. Responsive issues: elements too small, horizontal scroll, broken layout
5. Hardcoded strings: text in wrong language (e.g. Korean in English UI, or vice versa)
6. UX anti-patterns: tiny click targets (<44px), unclear CTAs, missing labels
7. Visual bugs: broken images, missing icons, rendering artifacts
8. Error states: 404 pages, blank screens, error messages, crash screens

For each issue found, provide:
- severity: "critical" | "warning" | "info"
- category: "layout" | "text" | "darkmode" | "responsive" | "i18n" | "ux" | "error" | "interaction" | "security"
- title: brief issue title
- description: what the issue is and where it appears
- location: where on the screen (e.g. "top-right", "center", "navigation bar")
- fixSuggestion: specific developer-centric fix (CSS change, component prop, etc.)

Respond ONLY in JSON. No markdown, no backticks.
{
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "layout|text|darkmode|responsive|i18n|ux|error|interaction|security",
      "title": "...",
      "description": "...",
      "location": "...",
      "fixSuggestion": "..."
    }
  ]
}`;

export const CONSOLE_ERROR_PROMPT = `Analyze these browser console errors from a web application.

For each error:
1. Classify type: "csp" | "javascript" | "network" | "other"
2. Severity: "critical" | "warning" | "info"
3. Root cause: explain likely cause
4. Fix suggestion: specific fix (e.g. which CSP header to add, null check needed, etc.)

Errors:
{errors}

Respond ONLY in JSON:
{
  "analysis": [
    {
      "originalMessage": "...",
      "type": "csp|javascript|network|other",
      "severity": "critical|warning|info",
      "rootCause": "...",
      "fixSuggestion": "..."
    }
  ]
}`;
