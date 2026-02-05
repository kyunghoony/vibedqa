import type { CrawlResult, ScanConfig, AnalysisResult, Issue } from '../types.js';
import type { FileManager } from '../utils/fileManager.js';
import { analyzeScreenshot } from './vision.js';
import { log } from '../utils/logger.js';

const AI_CALL_DELAY_MS = 1000;
const MAX_SCREENSHOTS_TO_ANALYZE = 30;

export async function analyze(
  crawlResult: CrawlResult,
  config: ScanConfig,
  _fileManager: FileManager,
): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log.warn('GEMINI_API_KEY not set — skipping AI analysis');
    return { issues: [], screenshotsAnalyzed: 0, errorsAnalyzed: 0 };
  }

  const allIssues: Issue[] = [];
  let screenshotsAnalyzed = 0;

  // Collect unique screenshots (dedup by path)
  const screenshots = crawlResult.pages
    .flatMap((p) => p.screenshots)
    .filter((s, i, arr) => arr.findIndex((x) => x.path === s.path) === i)
    .slice(0, MAX_SCREENSHOTS_TO_ANALYZE);

  log.info(`Analyzing ${screenshots.length} screenshots with Gemini Vision...`);

  for (const screenshot of screenshots) {
    const context = `URL: ${screenshot.url}, State: ${screenshot.state}, Viewport: ${screenshot.viewport}`;
    log.verbose(`Analyzing: ${screenshot.state}`);

    const issues = await analyzeScreenshot(screenshot.path, context);

    for (const issue of issues) {
      issue.screenshotPath = screenshot.path;
    }

    allIssues.push(...issues);
    screenshotsAnalyzed++;

    // Rate limiting
    if (screenshotsAnalyzed < screenshots.length) {
      await new Promise((r) => setTimeout(r, AI_CALL_DELAY_MS));
    }
  }

  // Analyze console errors from crawl results
  const allErrors = crawlResult.pages.flatMap((p) => p.errors);
  const errorsAnalyzed = allErrors.length;

  // Convert significant console errors to issues
  for (const error of allErrors) {
    if (error.type === 'javascript' || (error.type === 'network' && (error.statusCode ?? 0) >= 500)) {
      allIssues.push({
        id: `console-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        severity: error.type === 'javascript' ? 'critical' : 'warning',
        category: 'error',
        title: error.type === 'javascript' ? 'JavaScript Error' : `HTTP ${error.statusCode} Error`,
        description: error.message.slice(0, 200),
        screenshotPath: '',
        location: `Page: ${error.url}`,
        fixSuggestion: error.type === 'javascript'
          ? 'Check the stack trace and add proper error handling or null checks.'
          : 'Verify the server endpoint is running and responding correctly.',
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  allIssues.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return {
    issues: allIssues,
    screenshotsAnalyzed,
    errorsAnalyzed,
  };
}
