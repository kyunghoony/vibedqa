import type { Page } from 'playwright';
import type { ConsoleError, ConsoleErrorType } from '../types.js';
import { log } from '../utils/logger.js';

export class ErrorCollector {
  private errors: ConsoleError[] = [];
  private currentAction = '';

  setCurrentAction(action: string): void {
    this.currentAction = action;
  }

  attach(page: Page): void {
    // Console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const errorType = this.classifyError(text);
        this.errors.push({
          type: errorType,
          message: text,
          url: page.url(),
          timestamp: new Date().toISOString(),
          triggerAction: this.currentAction || undefined,
        });
        log.error(`CONSOLE ERROR: ${text.slice(0, 120)}`);
      }
    });

    // Uncaught JS errors
    page.on('pageerror', (error) => {
      this.errors.push({
        type: 'javascript',
        message: error.message,
        url: page.url(),
        timestamp: new Date().toISOString(),
        triggerAction: this.currentAction || undefined,
        stackTrace: error.stack,
      });
      log.error(`JS CRASH: ${error.message.slice(0, 120)}`);
    });

    // HTTP errors (4xx, 5xx) — skip noise URLs
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        const responseUrl = response.url();
        if (this.isNoiseUrl(responseUrl)) {
          log.verbose(`Skipping noise HTTP ${status}: ${responseUrl}`);
          return;
        }
        this.errors.push({
          type: 'network',
          message: `${response.request().method()} ${responseUrl} ${status}`,
          url: page.url(),
          timestamp: new Date().toISOString(),
          triggerAction: this.currentAction || undefined,
          statusCode: status,
        });
        if (status >= 500) {
          log.error(`HTTP ${status}: ${responseUrl}`);
        } else {
          log.verbose(`HTTP ${status}: ${responseUrl}`);
        }
      }
    });

    // Failed requests — skip noise URLs
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      if (failure) {
        const requestUrl = request.url();
        if (this.isNoiseUrl(requestUrl)) {
          log.verbose(`Skipping noise request failure: ${requestUrl}`);
          return;
        }
        this.errors.push({
          type: 'network',
          message: `Request failed: ${requestUrl} - ${failure.errorText}`,
          url: page.url(),
          timestamp: new Date().toISOString(),
          triggerAction: this.currentAction || undefined,
        });
        log.verbose(`Request failed: ${requestUrl}`);
      }
    });
  }

  /**
   * Check if a URL is a known noise source that should be excluded from error reports.
   */
  private isNoiseUrl(url: string): boolean {
    const noisePatterns = [
      /cdn-cgi\/rum/i,         // Cloudflare RUM beacon
      /cdn-cgi\/trace/i,       // Cloudflare trace
      /\.woff2?(\?|$)/i,       // WOFF/WOFF2 web fonts
      /\.ttf(\?|$)/i,          // TrueType fonts
      /\.eot(\?|$)/i,          // Embedded OpenType fonts
      /\.otf(\?|$)/i,          // OpenType fonts
      /fonts\.googleapis/i,    // Google Fonts API
      /fonts\.gstatic/i,       // Google Fonts CDN
      /\/favicon\.ico/i,       // Favicon
    ];
    return noisePatterns.some(pattern => pattern.test(url));
  }

  private classifyError(message: string): ConsoleErrorType {
    const lower = message.toLowerCase();
    if (lower.includes('content security policy') || lower.includes('csp')) {
      return 'csp';
    }
    if (
      lower.includes('typeerror') ||
      lower.includes('referenceerror') ||
      lower.includes('syntaxerror') ||
      lower.includes('rangeerror')
    ) {
      return 'javascript';
    }
    if (
      lower.includes('404') ||
      lower.includes('500') ||
      lower.includes('cors') ||
      lower.includes('net::') ||
      lower.includes('failed to fetch')
    ) {
      return 'network';
    }
    return 'other';
  }

  getErrors(): ConsoleError[] {
    return [...this.errors];
  }

  clear(): void {
    this.errors = [];
  }
}
