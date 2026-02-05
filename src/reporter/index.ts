import type { Report } from '../types.js';
import type { FileManager } from '../utils/fileManager.js';
import { generateHtmlReport } from './html.js';
import { log } from '../utils/logger.js';

export async function generateReport(
  report: Report,
  fileManager: FileManager,
): Promise<string> {
  const html = generateHtmlReport(report);
  const reportPath = fileManager.writeReport(html);
  log.success(`HTML report saved: ${reportPath}`);
  return reportPath;
}
