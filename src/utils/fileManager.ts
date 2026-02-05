import fs from 'fs';
import path from 'path';

export class FileManager {
  private baseDir: string;
  private screenshotDir: string;

  constructor(outputDir: string, targetUrl: string) {
    const parsed = new URL(targetUrl);
    const hostname = (parsed.hostname || parsed.pathname.split('/').pop() || 'local').replace(/\./g, '-');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    this.baseDir = path.resolve(outputDir, `${hostname}-${dateStr}-${timeStr}`);
    this.screenshotDir = path.join(this.baseDir, 'screenshots');
  }

  init(): void {
    fs.mkdirSync(this.screenshotDir, { recursive: true });
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  getScreenshotDir(): string {
    return this.screenshotDir;
  }

  screenshotPath(name: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.screenshotDir, `${safeName}.png`);
  }

  reportPath(): string {
    return path.join(this.baseDir, 'report.html');
  }

  writeReport(html: string): string {
    const p = this.reportPath();
    fs.writeFileSync(p, html, 'utf-8');
    return p;
  }

  writeJson(filename: string, data: unknown): string {
    const p = path.join(this.baseDir, filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    return p;
  }
}
