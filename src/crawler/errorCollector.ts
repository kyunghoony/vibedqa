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

    // HTTP errors (4xx, 5xx)
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        this.errors.push({
          type: 'network',
          message: `${response.request().method()} ${response.url()} ${status}`,
          url: page.url(),
          timestamp: new Date().toISOString(),
          triggerAction: this.currentAction || undefined,
          statusCode: status,
        });
        if (status >= 500) {
          log.error(`HTTP ${status}: ${response.url()}`);
        } else {
          log.verbose(`HTTP ${status}: ${response.url()}`);
        }
      }
    });

    // Failed requests
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      if (failure) {
        this.errors.push({
          type: 'network',
          message: `Request failed: ${request.url()} - ${failure.errorText}`,
          url: page.url(),
          timestamp: new Date().toISOString(),
          triggerAction: this.currentAction || undefined,
        });
        log.verbose(`Request failed: ${request.url()}`);
      }
    });
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
