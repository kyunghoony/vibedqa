import type { Page } from 'playwright';
import type { ScanConfig } from '../types.js';
import { log } from '../utils/logger.js';

export class Explorer {
  private visitedUrls = new Set<string>();
  private queue: Array<{ url: string; depth: number }> = [];

  constructor(private config: ScanConfig) {}

  /**
   * Initialize with the starting URL.
   */
  init(startUrl: string): void {
    const normalized = this.normalizeUrl(startUrl);
    this.visitedUrls.add(normalized);
    this.queue.push({ url: normalized, depth: 0 });
  }

  /**
   * Get the next URL to visit from the queue.
   */
  next(): { url: string; depth: number } | null {
    return this.queue.shift() || null;
  }

  /**
   * Discover links on the current page and add new ones to the queue.
   */
  async discoverLinks(page: Page, currentDepth: number): Promise<string[]> {
    if (!this.config.enableNavigation) return [];
    if (currentDepth >= this.config.maxDepth) return [];

    const currentUrl = page.url();
    const baseHostname = new URL(this.config.url).hostname;

    const links = await page.evaluate(
      ({ baseHost }) => {
        const anchors = document.querySelectorAll('a[href]');
        const hrefs: string[] = [];
        anchors.forEach((a) => {
          const href = (a as HTMLAnchorElement).href;
          if (href) hrefs.push(href);
        });
        return hrefs;
      },
      { baseHost: baseHostname },
    );

    const newLinks: string[] = [];

    for (const link of links) {
      try {
        const url = new URL(link, currentUrl);

        // Same domain only
        if (url.hostname !== baseHostname) continue;

        // Skip non-HTTP
        if (!url.protocol.startsWith('http')) continue;

        // Skip anchor-only links
        if (url.pathname === new URL(currentUrl).pathname && url.hash) continue;

        // Skip common non-page resources
        if (/\.(pdf|zip|png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/i.test(url.pathname)) continue;

        // Skip common auth/external paths
        if (/\/(logout|signout|auth\/|oauth\/)/i.test(url.pathname)) continue;

        const normalized = this.normalizeUrl(url.toString());

        if (!this.visitedUrls.has(normalized)) {
          this.visitedUrls.add(normalized);
          this.queue.push({ url: normalized, depth: currentDepth + 1 });
          newLinks.push(normalized);
          log.verbose(`Discovered: ${normalized} (depth ${currentDepth + 1})`);
        }
      } catch {
        // Invalid URL — skip
      }
    }

    if (newLinks.length > 0) {
      log.info(`🔗 Discovered ${newLinks.length} new links (depth ${currentDepth + 1})`);
    }

    return newLinks;
  }

  /**
   * Normalize URL for dedup (remove trailing slash, hash, sort params).
   */
  private normalizeUrl(urlStr: string): string {
    try {
      const url = new URL(urlStr);
      // Remove hash
      url.hash = '';
      // Remove trailing slash (except root)
      if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
      }
      // Sort search params
      url.searchParams.sort();
      return url.toString();
    } catch {
      return urlStr;
    }
  }

  hasMore(): boolean {
    return this.queue.length > 0;
  }

  getVisitedCount(): number {
    return this.visitedUrls.size;
  }

  getVisitedUrls(): string[] {
    return [...this.visitedUrls];
  }
}
