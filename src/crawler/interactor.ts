import type { Page, Locator } from 'playwright';
import type { ScanConfig, InteractionLog, DiscoveredElement } from '../types.js';
import { CLICKABLE_SELECTORS, INPUT_SELECTORS, FORM_TEST_DATA } from '../config.js';
import { Screenshotter } from './screenshotter.js';
import { StateDetector } from './stateDetector.js';
import { ErrorCollector } from './errorCollector.js';
import { log } from '../utils/logger.js';

export class Interactor {
  private interactions: InteractionLog[] = [];

  constructor(
    private config: ScanConfig,
    private screenshotter: Screenshotter,
    private stateDetector: StateDetector,
    private errorCollector: ErrorCollector,
  ) {}

  /**
   * Discover all interactive elements on the current page.
   * Uses CSS selectors first, then scans for cursor:pointer elements
   * to catch custom clickable divs, icons, images, etc.
   */
  async discoverElements(page: Page): Promise<DiscoveredElement[]> {
    const viewportSize = page.viewportSize() || { width: 1280, height: 720 };

    const elements = await page.evaluate(
      ({ clickSel, inputSel, vpHeight }) => {
        const allSelectors = `${clickSel}, ${inputSel}`;
        const results: Array<{
          selector: string;
          tag: string;
          type: string;
          text: string;
          href?: string;
          isVisible: boolean;
          boundingBox?: { x: number; y: number; width: number; height: number };
        }> = [];
        const seen = new Set<string>();
        const processedEls = new WeakSet<Element>();

        function isElVisible(htmlEl: HTMLElement, rect: DOMRect): boolean {
          const style = window.getComputedStyle(htmlEl);
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top < vpHeight + 200
          );
        }

        function extractInfo(htmlEl: HTMLElement) {
          const rect = htmlEl.getBoundingClientRect();
          const tag = htmlEl.tagName.toLowerCase();
          const type =
            htmlEl.getAttribute('type') ||
            htmlEl.getAttribute('role') ||
            tag;
          const text = (
            htmlEl.textContent?.trim() ||
            htmlEl.getAttribute('aria-label') ||
            htmlEl.getAttribute('placeholder') ||
            htmlEl.getAttribute('title') ||
            htmlEl.getAttribute('name') ||
            htmlEl.getAttribute('alt') ||
            ''
          ).slice(0, 80);
          const href = htmlEl.getAttribute('href') || undefined;
          const id = htmlEl.id ? `#${htmlEl.id}` : '';
          return { rect, tag, type, text, href, id };
        }

        function addElement(
          htmlEl: HTMLElement,
          selectorOverride?: string,
        ): void {
          if (processedEls.has(htmlEl)) return;
          processedEls.add(htmlEl);

          const { rect, tag, type, text, href, id } = extractInfo(htmlEl);
          const isVisible = isElVisible(htmlEl, rect);

          const dedup = `${tag}|${type}|${text}|${Math.round(rect.top)}`;
          if (seen.has(dedup)) return;
          seen.add(dedup);

          results.push({
            selector: selectorOverride || (id ? `${tag}${id}` : `${tag}`),
            tag,
            type,
            text,
            href,
            isVisible,
            boundingBox:
              rect.width > 0
                ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                : undefined,
          });
        }

        // Phase 1: Standard selector-based discovery
        const nodeList = document.querySelectorAll(allSelectors);
        nodeList.forEach((el) => addElement(el as HTMLElement));

        // Phase 2: cursor:pointer elements (catches custom clickable divs, icons, etc.)
        // Scan common interactive tags plus elements likely to be clickable
        const cursorCandidateTags = ['div', 'span', 'img', 'svg', 'li', 'label', 'figure', 'picture', 'i'];
        for (const candidateTag of cursorCandidateTags) {
          const candidates = document.querySelectorAll(candidateTag);
          candidates.forEach((el) => {
            if (processedEls.has(el)) return;
            const htmlEl = el as HTMLElement;
            const style = window.getComputedStyle(htmlEl);
            if (style.cursor !== 'pointer') return;

            const rect = htmlEl.getBoundingClientRect();
            // Skip tiny invisible elements and huge container divs
            if (rect.width < 8 || rect.height < 8) return;
            if (rect.width > vpHeight * 2 && rect.height > vpHeight * 2) return;

            addElement(htmlEl, htmlEl.id ? `${candidateTag}#${htmlEl.id}` : candidateTag);
          });
        }

        // Phase 3: img/svg inside anchors or buttons that weren't caught
        const mediaEls = document.querySelectorAll('img, svg');
        mediaEls.forEach((el) => {
          if (processedEls.has(el)) return;
          const parent = el.closest('a, button, [role="button"], [onclick]');
          if (parent && !processedEls.has(parent)) {
            addElement(parent as HTMLElement);
          }
        });

        // Sort: top-to-bottom, left-to-right
        results.sort((a, b) => {
          if (!a.boundingBox || !b.boundingBox) return 0;
          const dy = a.boundingBox.y - b.boundingBox.y;
          if (Math.abs(dy) > 20) return dy;
          return a.boundingBox.x - b.boundingBox.x;
        });

        return results;
      },
      {
        clickSel: CLICKABLE_SELECTORS,
        inputSel: INPUT_SELECTORS,
        vpHeight: viewportSize.height,
      },
    );

    const visibleCount = elements.filter((e) => e.isVisible).length;
    log.info(`📋 Found ${elements.length} interactive elements (${visibleCount} visible)`);
    if (this.config.verbose) {
      const cursorPointerCount = elements.filter(
        (e) => ['div', 'span', 'img', 'svg', 'li', 'label', 'figure', 'picture', 'i'].includes(e.tag),
      ).length;
      log.verbose(`  ├─ Selector-matched: ${elements.length - cursorPointerCount}`);
      log.verbose(`  └─ cursor:pointer detected: ${cursorPointerCount}`);
    }
    return elements;
  }

  /**
   * Run the full interaction loop: click every clickable element,
   * fill form fields, capture state changes.
   */
  async interactWithPage(page: Page): Promise<InteractionLog[]> {
    this.interactions = [];
    const elements = await this.discoverElements(page);
    const visibleElements = elements.filter((e) => e.isVisible);

    // Separate clickables from inputs
    const inputTags = new Set(['input', 'textarea', 'select']);
    const clickables = visibleElements.filter((e) => !inputTags.has(e.tag));
    const inputs = visibleElements.filter(
      (e) =>
        e.tag === 'input' ||
        e.tag === 'textarea' ||
        e.tag === 'select',
    );

    // Phase A: Fill forms first (if enabled)
    if (this.config.enableInput && inputs.length > 0) {
      await this.fillForms(page, inputs);
    }

    // Phase B: Click elements (if enabled)
    if (this.config.enableClick) {
      const maxClicks = Math.min(clickables.length, this.config.maxClicksPerPage);
      let clickCount = 0;

      for (const element of clickables) {
        if (clickCount >= maxClicks) {
          log.verbose(`Reached max clicks (${maxClicks}), stopping`);
          break;
        }

        // Skip external links — only interact within the target domain
        if (element.tag === 'a' && element.href) {
          if (this.isExternalLink(element.href, page.url())) {
            log.verbose(`Skipping external link: ${element.text} → ${element.href}`);
            continue;
          }
          // Skip same-domain navigation links — explorer handles those via BFS
          if (this.isNavigationLink(element.href, page.url())) {
            log.verbose(`Skipping nav link: ${element.text} → ${element.href}`);
            continue;
          }
        }

        await this.clickElement(page, element);
        clickCount++;
      }
    }

    return this.interactions;
  }

  /**
   * Click a single element and handle the aftermath.
   */
  private async clickElement(page: Page, element: DiscoveredElement): Promise<void> {
    const label = element.text || element.type || element.tag;
    log.click(label);
    this.errorCollector.setCurrentAction(`click: ${label}`);

    const beforeUrl = page.url();
    const beforeSnapshot = await this.stateDetector.snapshot(page);

    try {
      // Find the element using the best available strategy
      const locator = await this.resolveLocator(page, element);
      if (!locator) {
        this.logInteraction('click', label, element.selector, beforeUrl, 'no_change', 'Element not found');
        return;
      }

      // Check visibility one more time
      const visible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
      if (!visible) {
        log.verbose(`Element "${label}" no longer visible, skipping`);
        this.logInteraction('click', label, element.selector, beforeUrl, 'no_change', 'Not visible');
        return;
      }

      // Scroll into view if needed
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});

      // Click with timeout
      await locator.click({ timeout: 5000 });

      // Wait for page to stabilize
      await this.stateDetector.waitForStable(page);

      // Detect what changed
      const changes = await this.stateDetector.detectChanges(page, beforeUrl, beforeSnapshot);

      // Always capture screenshot after click (the whole point of VibedQA)
      const screenshot = await this.screenshotter.capture(
        page,
        `after_click_${label.replace(/\W+/g, '_').slice(0, 30)}`,
      );

      if (changes.length > 0) {
        this.logInteraction('click', label, element.selector, page.url(), 'success', undefined, screenshot.path);
        // Try to restore state
        await this.restoreState(page, beforeUrl, changes);
      } else {
        this.logInteraction('click', label, element.selector, beforeUrl, 'success', undefined, screenshot.path);
        log.verbose(`Click on "${label}" — no major state change detected`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.verbose(`Click failed on "${label}": ${msg.slice(0, 80)}`);
      this.logInteraction('click', label, element.selector, beforeUrl, 'error', msg);

      // Try to recover if navigation happened
      if (page.url() !== beforeUrl) {
        await this.safeGoBack(page, beforeUrl);
      }
    }
  }

  /**
   * Fill form inputs with test data.
   */
  private async fillForms(page: Page, inputs: DiscoveredElement[]): Promise<void> {
    for (const input of inputs) {
      try {
        const locator = await this.resolveLocator(page, input);
        if (!locator) continue;

        const visible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
        if (!visible) continue;

        const inputType = input.type || 'text';
        const label = input.text || inputType;

        if (input.tag === 'select') {
          // Select first non-disabled option
          await this.fillSelect(locator, label, page.url());
        } else {
          // Text input
          const testValue = FORM_TEST_DATA[inputType] || FORM_TEST_DATA.text;
          log.input(label);
          this.errorCollector.setCurrentAction(`input: ${label}`);

          await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
          await locator.fill(testValue, { timeout: 3000 });
          this.logInteraction('input', label, input.selector, page.url(), 'success');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.verbose(`Input failed on "${input.text}": ${msg.slice(0, 60)}`);
      }
    }

    // Take screenshot of filled form
    const formInputs = inputs.filter((i) => i.tag !== 'select');
    if (formInputs.length > 0) {
      await this.screenshotter.capture(page, 'form_filled');
    }
  }

  private async fillSelect(locator: Locator, label: string, url: string): Promise<void> {
    try {
      const options = await locator.locator('option:not([disabled])').all();
      if (options.length > 1) {
        // Select second option (first is usually placeholder)
        const value = await options[1].getAttribute('value');
        if (value !== null) {
          await locator.selectOption(value, { timeout: 3000 });
          log.input(`${label} (select)`);
          this.logInteraction('input', `${label} (select)`, '', url, 'success');
        }
      }
    } catch {
      // Ignore select errors
    }
  }

  /**
   * Resolve a DiscoveredElement to a Playwright Locator.
   * Uses multiple strategies to find the element reliably.
   */
  private async resolveLocator(page: Page, element: DiscoveredElement): Promise<Locator | null> {
    // Strategy 1: By ID if available
    if (element.selector.includes('#')) {
      const idMatch = element.selector.match(/#([\w-]+)/);
      if (idMatch) {
        const loc = page.locator(`#${idMatch[1]}`);
        if (await loc.count() > 0) return loc.first();
      }
    }

    // Strategy 2: By role + exact name (most robust for buttons/links)
    if (element.text) {
      const trimmedText = element.text.trim();
      if (trimmedText.length > 0 && trimmedText.length < 60) {
        const roleMap: Record<string, string> = {
          button: 'button',
          submit: 'button',
          a: 'link',
          link: 'link',
          tab: 'tab',
          menuitem: 'menuitem',
          option: 'option',
        };
        const role = roleMap[element.type] || roleMap[element.tag];
        if (role) {
          const exact = page.getByRole(role as any, { name: trimmedText, exact: true });
          if (await exact.count() === 1) return exact;
          const fuzzy = page.getByRole(role as any, { name: trimmedText, exact: false });
          if (await fuzzy.count() > 0) return fuzzy.first();
        }
      }
    }

    // Strategy 3: By text content on specific tag
    if (element.text && element.text.length > 1 && element.text.length < 60) {
      const loc = page.locator(element.tag).filter({ hasText: element.text });
      const count = await loc.count();
      if (count === 1) return loc;
      if (count > 1) return loc.first();
    }

    // Strategy 4: By bounding box position (find element at known coordinates)
    if (element.boundingBox) {
      const { x, y } = element.boundingBox;
      try {
        const all = await page.locator(`${element.tag}:visible`).all();
        for (const candidate of all) {
          const box = await candidate.boundingBox();
          if (box && Math.abs(box.x - x) < 15 && Math.abs(box.y - y) < 15) {
            return candidate;
          }
        }
      } catch {
        // Fall through
      }
    }

    // Strategy 5: Generic tag-based text search
    try {
      const all = await page.locator(`${element.tag}:visible`).all();
      for (const loc of all) {
        const text = await loc.textContent().catch(() => '');
        if (text && element.text && text.trim() === element.text.trim()) {
          return loc;
        }
      }
    } catch {
      // Fall through
    }

    return null;
  }

  /**
   * Try to restore the page to its previous state after an interaction.
   */
  private async restoreState(
    page: Page,
    originalUrl: string,
    changes: Array<{ type: string }>,
  ): Promise<void> {
    const hasUrlChange = changes.some((c) => c.type === 'url');
    const hasModal = changes.some((c) => c.type === 'modal');

    if (hasModal) {
      // Try to close modal
      await this.stateDetector.tryDismissModal(page);
    }

    if (hasUrlChange && page.url() !== originalUrl) {
      // Go back to original URL
      await this.safeGoBack(page, originalUrl);
    }
  }

  private async safeGoBack(page: Page, targetUrl: string): Promise<void> {
    try {
      await page.goBack({ timeout: 5000 });
      await this.stateDetector.waitForStable(page);

      // Verify we're back
      if (page.url() !== targetUrl) {
        await page.goto(targetUrl, { timeout: this.config.timeout, waitUntil: 'domcontentloaded' });
        await this.stateDetector.waitForStable(page);
      }
    } catch {
      // Last resort: navigate directly
      try {
        await page.goto(targetUrl, { timeout: this.config.timeout, waitUntil: 'domcontentloaded' });
      } catch {
        log.warn(`Could not restore page to ${targetUrl}`);
      }
    }
  }

  private isExternalLink(href: string, currentUrl: string): boolean {
    try {
      const resolved = new URL(href, currentUrl);
      const baseHostname = new URL(this.config.url).hostname;
      // Compare hostnames case-insensitively
      return resolved.hostname.toLowerCase() !== baseHostname.toLowerCase();
    } catch {
      return true; // If we can't parse it, treat as external (skip)
    }
  }

  private isNavigationLink(href: string, currentUrl: string): boolean {
    try {
      const resolved = new URL(href, currentUrl);
      const current = new URL(currentUrl);
      // It's a navigation link if it goes to a different path on the same domain
      return (
        resolved.hostname === current.hostname &&
        resolved.pathname !== current.pathname
      );
    } catch {
      return false;
    }
  }

  private logInteraction(
    action: InteractionLog['action'],
    target: string,
    selector: string,
    url: string,
    result: InteractionLog['result'],
    error?: string,
    screenshotPath?: string,
  ): void {
    this.interactions.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      selector,
      url,
      result,
      error,
      screenshotPath,
    });
  }

  getInteractions(): InteractionLog[] {
    return [...this.interactions];
  }
}
