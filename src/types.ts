// ============================================================
// VibedQA Core Types
// ============================================================

export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export interface ScanConfig {
  url: string;
  languages: string[];
  themes: string[];
  viewports: Viewport[];
  maxDepth: number;
  maxClicksPerPage: number;
  timeout: number;
  enableClick: boolean;
  enableInput: boolean;
  enableNavigation: boolean;
  outputDir: string;
  aiModel: string;
  verbose: boolean;
  chromiumPath?: string;
}

// --- Crawler types ---

export type InteractionAction =
  | 'click'
  | 'input'
  | 'navigate'
  | 'theme_switch'
  | 'lang_switch'
  | 'scroll'
  | 'page_load';

export interface InteractionLog {
  timestamp: string;
  action: InteractionAction;
  target: string;
  selector: string;
  url: string;
  result: 'success' | 'error' | 'no_change';
  screenshotPath?: string;
  error?: string;
}

export interface Screenshot {
  path: string;
  url: string;
  viewport: string;
  theme: string;
  language: string;
  state: string;
  timestamp: string;
}

export type ConsoleErrorType = 'csp' | 'javascript' | 'network' | 'other';

export interface ConsoleError {
  type: ConsoleErrorType;
  message: string;
  url: string;
  timestamp: string;
  triggerAction?: string;
  stackTrace?: string;
  statusCode?: number;
}

export interface StateChange {
  type: 'dom' | 'url' | 'modal' | 'loading' | 'empty';
  description: string;
  beforeUrl: string;
  afterUrl: string;
  timestamp: string;
}

export interface DiscoveredElement {
  selector: string;
  tag: string;
  type: string;
  text: string;
  href?: string;
  isVisible: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface PageCrawlResult {
  url: string;
  depth: number;
  screenshots: Screenshot[];
  interactions: InteractionLog[];
  errors: ConsoleError[];
  discoveredLinks: string[];
  elementsFound: number;
  elementsClicked: number;
}

export interface CrawlResult {
  pages: PageCrawlResult[];
  totalScreenshots: number;
  totalInteractions: number;
  totalErrors: number;
  duration: number;
}

// --- Analyzer types ---

export type IssueSeverity = 'critical' | 'warning' | 'info';
export type IssueCategory =
  | 'layout'
  | 'text'
  | 'darkmode'
  | 'responsive'
  | 'i18n'
  | 'ux'
  | 'error'
  | 'interaction'
  | 'security';

export interface Issue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  screenshotPath: string;
  location: string;
  fixSuggestion: string;
}

export interface AnalysisResult {
  issues: Issue[];
  screenshotsAnalyzed: number;
  errorsAnalyzed: number;
}

// --- Reporter types ---

export interface Report {
  url: string;
  scanDate: string;
  duration: number;
  config: ScanConfig;
  summary: {
    pagesScanned: number;
    elementsClicked: number;
    screenshotsTaken: number;
    issuesFound: number;
    critical: number;
    warning: number;
    info: number;
    consoleErrors: number;
  };
  issues: Issue[];
  consoleErrors: ConsoleError[];
  interactionLog: InteractionLog[];
  screenshots: Screenshot[];
}
