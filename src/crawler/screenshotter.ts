import type { Page } from 'playwright';
import type { Screenshot } from '../types.js';
import type { FileManager } from '../utils/fileManager.js';
import { log } from '../utils/logger.js';

export class Screenshotter {
  private screenshots: Screenshot[] = [];
  private counter = 0;

  constructor(
    private fileManager: FileManager,
    private viewport: string = 'desktop',
    private theme: string = 'light',
    private language: string = 'auto',
  ) {}

  async capture(
    page: Page,
    state: string,
    options: { fullPage?: boolean } = {},
  ): Promise<Screenshot> {
    this.counter++;
    const name = `${String(this.counter).padStart(3, '0')}_${state}`;
    const filePath = this.fileManager.screenshotPath(name);

    await page.screenshot({
      path: filePath,
      fullPage: options.fullPage ?? true,
    });

    const screenshot: Screenshot = {
      path: filePath,
      url: page.url(),
      viewport: this.viewport,
      theme: this.theme,
      language: this.language,
      state,
      timestamp: new Date().toISOString(),
    };

    this.screenshots.push(screenshot);
    log.capture(name + '.png');
    return screenshot;
  }

  getScreenshots(): Screenshot[] {
    return [...this.screenshots];
  }

  getCount(): number {
    return this.counter;
  }
}
