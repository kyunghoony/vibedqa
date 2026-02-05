import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import type { Issue, IssueSeverity, IssueCategory } from '../types.js';
import { SINGLE_SCREENSHOT_PROMPT } from './prompts.js';
import { log } from '../utils/logger.js';

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is not set. ' +
        'Get one at https://aistudio.google.com/apikey',
      );
    }
    const masked = apiKey.slice(0, 4) + '****' + apiKey.slice(-4);
    log.verbose(`Gemini API key loaded: ${masked} (${apiKey.length} chars)`);
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function analyzeScreenshot(
  screenshotPath: string,
  context: string,
): Promise<Issue[]> {
  try {
    const client = getClient();

    if (!fs.existsSync(screenshotPath)) {
      log.warn(`Screenshot file not found: ${screenshotPath}`);
      return [];
    }

    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64 = imageBuffer.toString('base64');
    const sizeKB = Math.round(imageBuffer.length / 1024);
    log.verbose(`Sending screenshot to Gemini: ${screenshotPath} (${sizeKB} KB, ${base64.length} base64 chars)`);

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64 } },
          { text: `Page context: ${context}\n\n${SINGLE_SCREENSHOT_PROMPT}` },
        ],
      },
    });

    const rawText = response.text ?? '';
    log.verbose(`Gemini response received: ${rawText.length} chars`);

    if (!rawText.trim()) {
      log.warn(`Gemini returned empty response for ${screenshotPath}`);
      return [];
    }

    const text = rawText.replace(/```json|```/g, '').trim() || '{}';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      log.warn(`Failed to parse Gemini JSON response: ${text.slice(0, 120)}`);
      log.verbose(`Full Gemini response:\n${text}`);
      return [];
    }

    const issues: Issue[] = (
      (parsed.issues as Array<Record<string, string>>) || []
    ).map((item: Record<string, string>, idx: number) => ({
      id: `issue-${Date.now()}-${idx}`,
      severity: validateSeverity(item.severity),
      category: validateCategory(item.category),
      title: item.title || 'Untitled issue',
      description: item.description || '',
      screenshotPath,
      location: item.location || 'unknown',
      fixSuggestion: item.fixSuggestion || item.fix_suggestion || '',
    }));

    log.verbose(`Gemini found ${issues.length} issue(s) for ${screenshotPath}`);
    return issues;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`AI analysis failed for ${screenshotPath}: ${msg}`);
    log.verbose(`Full error: ${err instanceof Error ? err.stack || msg : msg}`);
    return [];
  }
}

function validateSeverity(s: string): IssueSeverity {
  if (s === 'critical' || s === 'warning' || s === 'info') return s;
  return 'info';
}

function validateCategory(c: string): IssueCategory {
  const valid: IssueCategory[] = [
    'layout', 'text', 'darkmode', 'responsive', 'i18n', 'ux', 'error', 'interaction', 'security',
  ];
  if (valid.includes(c as IssueCategory)) return c as IssueCategory;
  return 'ux';
}
