import fs from 'fs';
import path from 'path';
import type { Report } from '../types.js';

export function generateHtmlReport(report: Report): string {
  const criticalIssues = report.issues.filter((i) => i.severity === 'critical');
  const warningIssues = report.issues.filter((i) => i.severity === 'warning');
  const infoIssues = report.issues.filter((i) => i.severity === 'info');

  const durationStr = (report.duration / 1000).toFixed(1) + 's';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VibedQA Report — ${escapeHtml(report.url)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e0e0e0; line-height: 1.6; }
  .container { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
  h1 { font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #a855f7, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
  .meta { color: #888; font-size: 0.85rem; margin-bottom: 32px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 48px; }
  .stat { background: #111118; border: 1px solid #222; border-radius: 16px; padding: 20px; text-align: center; }
  .stat-value { font-size: 2rem; font-weight: 800; }
  .stat-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #888; margin-top: 4px; }
  .critical .stat-value { color: #ef4444; }
  .warning .stat-value { color: #f59e0b; }
  .info .stat-value { color: #3b82f6; }
  .pages .stat-value { color: #a855f7; }
  h2 { font-size: 1.3rem; font-weight: 700; margin: 40px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #222; }
  .issue { background: #111118; border: 1px solid #222; border-radius: 16px; padding: 24px; margin-bottom: 16px; }
  .issue-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .badge { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 10px; border-radius: 6px; }
  .badge-critical { background: #ef4444; color: white; }
  .badge-warning { background: #f59e0b; color: black; }
  .badge-info { background: #3b82f6; color: white; }
  .badge-cat { background: #1e1e2e; color: #a855f7; border: 1px solid #333; }
  .issue-title { font-weight: 700; font-size: 1.05rem; }
  .issue-desc { color: #aaa; margin-bottom: 12px; font-size: 0.9rem; }
  .issue-fix { background: #0d0d15; border: 1px solid #2a2040; border-radius: 10px; padding: 14px; font-size: 0.85rem; color: #c084fc; }
  .issue-fix-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #7c3aed; margin-bottom: 6px; }
  .issue-location { font-size: 0.75rem; color: #666; margin-top: 8px; }
  .screenshot-link { color: #a855f7; text-decoration: none; font-size: 0.8rem; }
  .screenshot-link:hover { text-decoration: underline; }
  .error-table { width: 100%; border-collapse: collapse; }
  .error-table th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #888; padding: 8px 12px; border-bottom: 1px solid #222; }
  .error-table td { padding: 10px 12px; border-bottom: 1px solid #1a1a1a; font-size: 0.85rem; font-family: monospace; word-break: break-all; }
  .error-table tr:hover { background: #111118; }
  .type-csp { color: #f59e0b; }
  .type-javascript { color: #ef4444; }
  .type-network { color: #3b82f6; }
  .type-other { color: #888; }
  .interaction-log { font-family: monospace; font-size: 0.75rem; background: #111118; border-radius: 12px; padding: 16px; max-height: 400px; overflow-y: auto; }
  .interaction-log .entry { padding: 3px 0; color: #aaa; }
  .interaction-log .success { color: #22c55e; }
  .interaction-log .error { color: #ef4444; }
  .footer { margin-top: 60px; text-align: center; color: #444; font-size: 0.75rem; }
  .img-thumb { max-width: 100%; border-radius: 8px; border: 1px solid #222; margin-top: 12px; cursor: pointer; transition: transform 0.2s; }
  .img-thumb:hover { transform: scale(1.02); }
</style>
</head>
<body>
<div class="container">
  <h1>VibedQA Report</h1>
  <p class="meta">
    Target: <strong>${escapeHtml(report.url)}</strong> &nbsp;|&nbsp;
    Scanned: ${new Date(report.scanDate).toLocaleString()} &nbsp;|&nbsp;
    Duration: ${durationStr}
  </p>

  <div class="summary">
    <div class="stat pages"><div class="stat-value">${report.summary.pagesScanned}</div><div class="stat-label">Pages</div></div>
    <div class="stat"><div class="stat-value">${report.summary.elementsClicked}</div><div class="stat-label">Clicks</div></div>
    <div class="stat"><div class="stat-value">${report.summary.screenshotsTaken}</div><div class="stat-label">Screenshots</div></div>
    <div class="stat critical"><div class="stat-value">${report.summary.critical}</div><div class="stat-label">Critical</div></div>
    <div class="stat warning"><div class="stat-value">${report.summary.warning}</div><div class="stat-label">Warnings</div></div>
    <div class="stat info"><div class="stat-value">${report.summary.info}</div><div class="stat-label">Info</div></div>
  </div>

  ${criticalIssues.length > 0 ? `<h2>Critical Issues</h2>${criticalIssues.map((i) => issueCard(i, report)).join('')}` : ''}
  ${warningIssues.length > 0 ? `<h2>Warnings</h2>${warningIssues.map((i) => issueCard(i, report)).join('')}` : ''}
  ${infoIssues.length > 0 ? `<h2>Info / Suggestions</h2>${infoIssues.map((i) => issueCard(i, report)).join('')}` : ''}

  ${report.consoleErrors.length > 0 ? `
  <h2>Console Errors (${report.consoleErrors.length})</h2>
  <table class="error-table">
    <thead><tr><th>Type</th><th>Message</th><th>URL</th></tr></thead>
    <tbody>
      ${report.consoleErrors.map((e) => `
        <tr>
          <td><span class="type-${e.type}">${escapeHtml(e.type)}</span></td>
          <td>${escapeHtml(e.message.slice(0, 200))}</td>
          <td style="font-size:0.75rem;color:#666">${escapeHtml(e.url)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${report.interactionLog.length > 0 ? `
  <h2>Interaction Log</h2>
  <div class="interaction-log">
    ${report.interactionLog.map((i) => `
      <div class="entry ${i.result}">
        [${new Date(i.timestamp).toLocaleTimeString()}]
        ${escapeHtml(i.action.toUpperCase())} "${escapeHtml(i.target)}"
        → ${i.result}${i.error ? ` (${escapeHtml(i.error.slice(0, 80))})` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by VibedQA v0.1.0 — AI-powered visual QA</p>
  </div>
</div>
</body>
</html>`;
}

function issueCard(issue: Report['issues'][0], report: Report): string {
  const screenshotRelPath = issue.screenshotPath
    ? path.relative(path.dirname('report.html'), issue.screenshotPath)
    : '';

  return `
  <div class="issue">
    <div class="issue-header">
      <span class="badge badge-${issue.severity}">${issue.severity}</span>
      <span class="badge badge-cat">${issue.category}</span>
      <span class="issue-title">${escapeHtml(issue.title)}</span>
    </div>
    <p class="issue-desc">${escapeHtml(issue.description)}</p>
    ${issue.fixSuggestion ? `
    <div class="issue-fix">
      <div class="issue-fix-label">Fix Suggestion</div>
      ${escapeHtml(issue.fixSuggestion)}
    </div>
    ` : ''}
    <div class="issue-location">Location: ${escapeHtml(issue.location)}</div>
    ${screenshotRelPath ? `<img class="img-thumb" src="${screenshotRelPath}" alt="Screenshot" loading="lazy">` : ''}
  </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
