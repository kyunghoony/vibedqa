export enum Severity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

export interface InteractionStep {
  type: 'CLICK' | 'TYPE' | 'HOVER' | 'NAVIGATE' | 'SELECT';
  target: string;
  value?: string;
  timestamp: string;
}

export interface InteractiveElement {
  id: string;
  type: 'BUTTON' | 'LINK' | 'INPUT' | 'MENU' | 'DROPDOWN' | 'TOGGLE';
  label: string;
  status: 'REACHABLE' | 'BROKEN' | 'OBSCURED' | 'ERROR_STATE';
  pathSelector?: string;
}

export interface ConsoleLog {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  source: string;
  suggestion?: string;
}

export interface QaIssue {
  id: string;
  category: 'LAYOUT' | 'TEXT' | 'CONTRAST' | 'I18N' | 'UX' | 'INTERACTION' | 'RUNTIME_ERROR' | 'SECURITY';
  severity: Severity;
  description: string;
  element?: string;
  suggestion: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'success' | 'action' | 'system';
  message: string;
}

export interface AnalyzedScreenshot {
  id: string;
  imageUrl: string;
  name: string;
  issues: QaIssue[];
  interactiveElements: InteractiveElement[];
  navigationPath: InteractionStep[];
  consoleLogs: ConsoleLog[];
  status: 'pending' | 'analyzing' | 'done' | 'error';
  isBuggy: boolean;
}

export enum AppState {
  IDLE = 'IDLE',
  AGENT_EXPLORATION = 'AGENT_EXPLORATION',
  AI_AUDIT = 'AI_AUDIT',
  REPORT_READY = 'REPORT_READY',
  REPORT = 'REPORT',
}