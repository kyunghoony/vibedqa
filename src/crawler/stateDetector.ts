import type { Page } from 'playwright';
import type { StateChange } from '../types.js';
import { log } from '../utils/logger.js';

export class StateDetector {
  /**
   * Take a DOM snapshot for comparison.
   * Returns a hash-like string (element count + text length + key element counts).
   */
  async snapshot(page: Page): Promise<string> {
    try {
      return await page.evaluate(() => {
        const body = document.body;
        if (!body) return 'empty';
        const elementCount = document.querySelectorAll('*').length;
        const textLength = body.innerText?.trim().length ?? 0;

        // Count only VISIBLE modals/overlays
        let visibleModals = 0;
        const modalCandidates = document.querySelectorAll(
          '[role="dialog"], .modal, [aria-modal="true"], .overlay, .modal-overlay'
        );
        modalCandidates.forEach((el) => {
          const s = window.getComputedStyle(el);
          if (s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') {
            visibleModals++;
          }
        });

        const visibleInputs = document.querySelectorAll(
          'input:not([type="hidden"]), textarea, select'
        ).length;
        return `el:${elementCount}|txt:${textLength}|modal:${visibleModals}|inputs:${visibleInputs}`;
      });
    } catch {
      return 'error';
    }
  }

  /**
   * Detect what changed between before and after states.
   */
  async detectChanges(
    page: Page,
    beforeUrl: string,
    beforeSnapshot: string,
  ): Promise<StateChange[]> {
    const changes: StateChange[] = [];
    const afterUrl = page.url();
    const afterSnapshot = await this.snapshot(page);
    const now = new Date().toISOString();

    // URL change
    if (afterUrl !== beforeUrl) {
      changes.push({
        type: 'url',
        description: `URL changed: ${beforeUrl} → ${afterUrl}`,
        beforeUrl,
        afterUrl,
        timestamp: now,
      });
      log.stateChange(`URL changed to ${afterUrl}`);
    }

    // Parse snapshots
    const beforeParts = this.parseSnapshot(beforeSnapshot);
    const afterParts = this.parseSnapshot(afterSnapshot);

    // Modal appeared
    if (afterParts.modal > beforeParts.modal) {
      changes.push({
        type: 'modal',
        description: `Modal/dialog appeared (${afterParts.modal} detected)`,
        beforeUrl,
        afterUrl,
        timestamp: now,
      });
      log.stateChange('Modal/dialog appeared');
    }

    // DOM changed significantly
    const elementDiff = Math.abs(afterParts.elements - beforeParts.elements);
    const textDiff = Math.abs(afterParts.textLength - beforeParts.textLength);
    if (elementDiff > 0 || textDiff > 0) {
      changes.push({
        type: 'dom',
        description: `DOM changed: elements ${beforeParts.elements}→${afterParts.elements}, text ${beforeParts.textLength}→${afterParts.textLength}`,
        beforeUrl,
        afterUrl,
        timestamp: now,
      });
      if (changes.length === 1) {
        log.stateChange('DOM content changed');
      }
    }

    // Empty page detection
    if (afterParts.textLength === 0 && afterParts.elements < 10) {
      changes.push({
        type: 'empty',
        description: 'Page appears empty (no text content)',
        beforeUrl,
        afterUrl,
        timestamp: now,
      });
      log.warn('Page appears empty after interaction');
    }

    return changes;
  }

  /**
   * Wait for page to stabilize after an interaction.
   */
  async waitForStable(page: Page, timeoutMs = 3000): Promise<void> {
    try {
      // Wait for network to settle
      await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs });

      // Brief wait for JS to finish rendering
      await page.waitForTimeout(500);

      // Check for loading indicators and wait for them to disappear
      const hasLoader = await page.evaluate(() => {
        const loaders = document.querySelectorAll(
          '.loading, .spinner, [role="progressbar"], .skeleton, [aria-busy="true"]'
        );
        return loaders.length > 0;
      });

      if (hasLoader) {
        log.verbose('Loading indicator detected, waiting...');
        try {
          await page.waitForFunction(
            () => {
              const loaders = document.querySelectorAll(
                '.loading, .spinner, [role="progressbar"], .skeleton, [aria-busy="true"]'
              );
              return loaders.length === 0;
            },
            { timeout: 5000 },
          );
        } catch {
          // Timeout waiting for loader — proceed anyway
        }
      }
    } catch {
      // domcontentloaded timeout — proceed
    }
  }

  /**
   * Try to dismiss any open modal/overlay.
   */
  async tryDismissModal(page: Page): Promise<boolean> {
    try {
      // Try ESC key first
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      // Check if modal/overlay is still visible
      const modalState = await page.evaluate(() => {
        const dialogs = document.querySelectorAll(
          '[role="dialog"], .modal, [aria-modal="true"], .modal-overlay, .overlay'
        );
        for (let i = 0; i < dialogs.length; i++) {
          const el = dialogs[i] as HTMLElement;
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            return { visible: true };
          }
        }
        return { visible: false };
      });

      if (!modalState.visible) return true;

      // Strategy A: Use Playwright role-based locators for close/cancel buttons
      const roleLocators = [
        page.getByRole('button', { name: 'Close', exact: false }),
        page.getByRole('button', { name: 'Cancel', exact: false }),
        page.getByRole('button', { name: 'Dismiss', exact: false }),
        page.getByRole('button', { name: 'X', exact: true }),
      ];

      for (const btn of roleLocators) {
        try {
          if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
            await btn.click({ timeout: 2000 });
            await page.waitForTimeout(400);
            log.verbose('Modal dismissed via role-based close button');
            return true;
          }
        } catch {
          continue;
        }
      }

      // Strategy B: CSS selectors for close buttons
      const closeSelectors = [
        '[role="dialog"] button[aria-label]',
        '[role="dialog"] button',
        '[aria-modal="true"] button',
        '.modal button.close',
        '.modal .close-button',
        '.modal-close',
        '[data-dismiss="modal"]',
      ];

      for (const sel of closeSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
            await btn.click({ timeout: 2000 });
            await page.waitForTimeout(400);
            log.verbose('Modal dismissed via CSS close button');
            return true;
          }
        } catch {
          continue;
        }
      }

      // Last resort: force-hide all modal/overlay elements via JS
      try {
        await page.evaluate(() => {
          const overlays = document.querySelectorAll(
            '[role="dialog"], .modal, [aria-modal="true"], .modal-overlay, .overlay'
          );
          overlays.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
          // Also hide any fixed/absolute positioned overlays covering the viewport
          document.querySelectorAll('*').forEach((el) => {
            const s = window.getComputedStyle(el);
            if (
              (s.position === 'fixed' || s.position === 'absolute') &&
              s.zIndex !== 'auto' && parseInt(s.zIndex) > 50 &&
              (el as HTMLElement).offsetWidth > window.innerWidth * 0.5 &&
              (el as HTMLElement).offsetHeight > window.innerHeight * 0.5
            ) {
              (el as HTMLElement).style.display = 'none';
            }
          });
        });
        await page.waitForTimeout(300);
        log.verbose('Modal force-hidden via JS');
        return true;
      } catch {
        // ignore
      }

      return false;
    } catch {
      return false;
    }
  }

  private parseSnapshot(snap: string): {
    elements: number;
    textLength: number;
    modal: number;
    inputs: number;
  } {
    const defaults = { elements: 0, textLength: 0, modal: 0, inputs: 0 };
    if (!snap || snap === 'empty' || snap === 'error') return defaults;

    const parts = snap.split('|');
    for (const part of parts) {
      const [key, val] = part.split(':');
      const num = parseInt(val, 10) || 0;
      if (key === 'el') defaults.elements = num;
      else if (key === 'txt') defaults.textLength = num;
      else if (key === 'modal') defaults.modal = num;
      else if (key === 'inputs') defaults.inputs = num;
    }
    return defaults;
  }
}
