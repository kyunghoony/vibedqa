import fs from 'fs';
import type { ScanConfig, Viewport } from './types.js';

export const DEFAULT_VIEWPORTS: Record<string, Viewport> = {
  desktop: { name: 'desktop', width: 1280, height: 720 },
  mobile: { name: 'mobile', width: 390, height: 844 },
};

export const DEFAULT_CONFIG: ScanConfig = {
  url: '',
  languages: ['auto'],
  themes: ['light'],
  viewports: [DEFAULT_VIEWPORTS.desktop],
  maxDepth: 3,
  maxClicksPerPage: 50,
  timeout: 30000,
  enableClick: true,
  enableInput: true,
  enableNavigation: true,
  outputDir: './vibedqa-reports',
  aiModel: 'gemini',
  verbose: false,
};

export const FORM_TEST_DATA: Record<string, string> = {
  text: 'VibedQA Test Input',
  email: 'test@vibedqa.com',
  password: 'TestPass123!',
  number: '42',
  url: 'https://example.com',
  tel: '+1234567890',
  search: 'VibedQA test search',
  textarea: 'This is a test input from VibedQA automated QA bot.',
};

export const CLICKABLE_SELECTORS = [
  'button',
  'a[href]',
  'input[type="submit"]',
  'input[type="button"]',
  'select',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="link"]',
  '[onclick]',
].join(', ');

export const INPUT_SELECTORS = [
  'input[type="text"]',
  'input[type="email"]',
  'input[type="password"]',
  'input[type="number"]',
  'input[type="url"]',
  'input[type="tel"]',
  'input[type="search"]',
  'input:not([type])',
  'textarea',
  'select',
].join(', ');

/** Detect Chromium binary path */
export function detectChromiumPath(): string | undefined {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];

  for (const p of candidates) {
    if (p) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}
