import { log } from './utils/logger.js';
import { FileManager } from './utils/fileManager.js';
import { crawl } from './crawler/index.js';
import { analyze } from './analyzer/index.js';
import { generateReport } from './reporter/index.js';
import type { ScanConfig, Report } from './types.js';

export async function runPipeline(config: ScanConfig): Promise<Report> {
  const startTime = Date.now();
  log.banner();
  log.info(`🌐 Target: ${config.url}`);
  log.info(`Settings: depth=${config.maxDepth}, click=${config.enableClick}, input=${config.enableInput}, nav=${config.enableNavigation}`);
  log.divider();

  // Setup file manager
  const fileManager = new FileManager(config.outputDir, config.url);
  fileManager.init();

  // Phase 1: Crawl
  log.info('📋 Phase 1: Autonomous crawling...');
  const crawlResult = await crawl(config, fileManager);
  log.success(
    `Crawl complete. ${crawlResult.pages.length} pages, ` +
    `${crawlResult.totalInteractions} interactions, ` +
    `${crawlResult.totalScreenshots} screenshots, ` +
    `${crawlResult.totalErrors} errors collected.`
  );
  log.divider();

  // Phase 2: AI Analysis
  log.info('🤖 Phase 2: AI analysis...');
  const analysisResult = await analyze(crawlResult, config, fileManager);
  log.success(`Analysis complete. ${analysisResult.issues.length} issues found.`);
  log.divider();

  // Phase 3: Report
  log.info('📊 Phase 3: Generating report...');
  const duration = Date.now() - startTime;

  const allInteractions = crawlResult.pages.flatMap(p => p.interactions);
  const allErrors = crawlResult.pages.flatMap(p => p.errors);
  const allScreenshots = crawlResult.pages.flatMap(p => p.screenshots);

  const report: Report = {
    url: config.url,
    scanDate: new Date().toISOString(),
    duration,
    config,
    summary: {
      pagesScanned: crawlResult.pages.length,
      elementsClicked: allInteractions.filter(i => i.action === 'click').length,
      screenshotsTaken: crawlResult.totalScreenshots,
      issuesFound: analysisResult.issues.length,
      critical: analysisResult.issues.filter(i => i.severity === 'critical').length,
      warning: analysisResult.issues.filter(i => i.severity === 'warning').length,
      info: analysisResult.issues.filter(i => i.severity === 'info').length,
      consoleErrors: allErrors.length,
    },
    issues: analysisResult.issues,
    consoleErrors: allErrors,
    interactionLog: allInteractions,
    screenshots: allScreenshots,
  };

  const reportPath = await generateReport(report, fileManager);
  log.divider();

  // Terminal summary
  log.info('');
  log.divider();
  console.log('  SUMMARY');
  log.divider();
  console.log(`  Pages scanned:    ${report.summary.pagesScanned}`);
  console.log(`  Elements clicked: ${report.summary.elementsClicked}`);
  console.log(`  Screenshots:      ${report.summary.screenshotsTaken}`);
  console.log(`  Issues found:     ${report.summary.issuesFound}`);
  console.log(`    🔴 Critical:    ${report.summary.critical}`);
  console.log(`    🟡 Warning:     ${report.summary.warning}`);
  console.log(`    🔵 Info:        ${report.summary.info}`);
  console.log(`  Console errors:   ${report.summary.consoleErrors}`);
  console.log('');
  console.log(`  📄 Full report: ${reportPath}`);
  log.divider();

  // Save raw data
  fileManager.writeJson('report-data.json', report);

  return report;
}
