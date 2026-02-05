import { chromium } from 'playwright';
import type { ScanConfig, CrawlResult, PageCrawlResult } from '../types.js';
import type { FileManager } from '../utils/fileManager.js';
import { detectChromiumPath } from '../config.js';
import { log } from '../utils/logger.js';
import { Explorer } from './explorer.js';
import { Interactor } from './interactor.js';
import { Screenshotter } from './screenshotter.js';
import { StateDetector } from './stateDetector.js';
import { ErrorCollector } from './errorCollector.js';

export async function crawl(config: ScanConfig, fileManager: FileManager): Promise<CrawlResult> {
  const startTime = Date.now();
  const pages: PageCrawlResult[] = [];

  // Launch browser
  const chromiumPath = config.chromiumPath || detectChromiumPath();
  const launchOptions: Record<string, unknown> = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (chromiumPath) {
    launchOptions.executablePath = chromiumPath;
    log.verbose(`Using Chromium: ${chromiumPath}`);
  }

  const browser = await chromium.launch(launchOptions);

  try {
    for (const viewport of config.viewports) {
      log.info(`📐 Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent: 'VibedQA/0.1.0 (Autonomous QA Bot)',
        ignoreHTTPSErrors: true,
      });

      // Initialize components
      const explorer = new Explorer(config);
      explorer.init(config.url);

      const screenshotter = new Screenshotter(
        fileManager,
        viewport.name,
        'light',
        config.languages[0] || 'auto',
      );
      const stateDetector = new StateDetector();
      const errorCollector = new ErrorCollector();

      // BFS crawl loop
      let entry = explorer.next();
      while (entry) {
        const { url, depth } = entry;
        log.navigate(url);
        log.verbose(`Depth: ${depth}/${config.maxDepth}`);

        const pageResult = await crawlPage(
          context,
          url,
          depth,
          config,
          screenshotter,
          stateDetector,
          errorCollector,
          explorer,
        );

        if (pageResult) {
          pages.push(pageResult);
        }

        entry = explorer.next();
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const duration = Date.now() - startTime;

  return {
    pages,
    totalScreenshots: pages.reduce((acc, p) => acc + p.screenshots.length, 0),
    totalInteractions: pages.reduce((acc, p) => acc + p.interactions.length, 0),
    totalErrors: pages.reduce((acc, p) => acc + p.errors.length, 0),
    duration,
  };
}

async function crawlPage(
  context: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>>,
  url: string,
  depth: number,
  config: ScanConfig,
  screenshotter: Screenshotter,
  stateDetector: StateDetector,
  errorCollector: ErrorCollector,
  explorer: Explorer,
): Promise<PageCrawlResult | null> {
  const page = await context.newPage();

  try {
    // Attach error collector before navigation
    errorCollector.clear();
    errorCollector.attach(page);
    errorCollector.setCurrentAction('page_load');

    // Navigate
    await page.goto(url, {
      timeout: config.timeout,
      waitUntil: 'domcontentloaded',
    });

    // Wait for page to stabilize
    await stateDetector.waitForStable(page);

    // Initial screenshot
    const pageName = new URL(url).pathname.replace(/\//g, '_') || '_root';
    await screenshotter.capture(page, `initial${pageName}`);

    // Discover links for BFS
    const discoveredLinks = await explorer.discoverLinks(page, depth);

    // Run interactions
    const interactor = new Interactor(config, screenshotter, stateDetector, errorCollector);
    const interactions = await interactor.interactWithPage(page);

    const result: PageCrawlResult = {
      url,
      depth,
      screenshots: screenshotter.getScreenshots().filter(
        (s) => s.url === url || s.state.includes(pageName),
      ),
      interactions,
      errors: errorCollector.getErrors(),
      discoveredLinks,
      elementsFound: interactions.length,
      elementsClicked: interactions.filter((i) => i.action === 'click').length,
    };

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Failed to crawl ${url}: ${msg.slice(0, 100)}`);
    return {
      url,
      depth,
      screenshots: [],
      interactions: [],
      errors: [
        {
          type: 'other',
          message: `Page load failed: ${msg}`,
          url,
          timestamp: new Date().toISOString(),
        },
      ],
      discoveredLinks: [],
      elementsFound: 0,
      elementsClicked: 0,
    };
  } finally {
    await page.close();
  }
}
