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
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64 = imageBuffer.toString('base64');

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64 } },
          { text: `Page context: ${context}\n\n${SINGLE_SCREENSHOT_PROMPT}` },
        ],
      },
    });

    const text = response.text?.replace(/```json|```/g, '').trim() || '{}';
    const parsed = JSON.parse(text);

    const issues: Issue[] = (parsed.issues || []).map((item: Record<string, string>, idx: number) => ({
      id: `issue-${Date.now()}-${idx}`,
      severity: validateSeverity(item.severity),
      category: validateCategory(item.category),
      title: item.title || 'Untitled issue',
      description: item.description || '',
      screenshotPath,
      location: item.location || 'unknown',
      fixSuggestion: item.fixSuggestion || item.fix_suggestion || '',
    }));

    return issues;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`AI analysis failed for ${screenshotPath}: ${msg.slice(0, 80)}`);
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
