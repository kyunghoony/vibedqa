import { GoogleGenAI, Type } from "@google/genai";
import { QaIssue, Severity, InteractiveElement, ConsoleLog } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are the VibedQA Autonomous Agent Brain. 
Your task is to analyze a state-capture of a web application and audit its "Interaction Integrity" and "Runtime Health".

Analysis Rules:
1. **Interactive Elements**: Identify every button, link, input, and dropdown visible.
2. **State Validation**: Check if the current view looks like an error state (404, blank screen, crash, mixed content).
3. **Form Integrity**: Audit inputs for labels, validation states, and data entry hazards.
4. **Fix Proposals**: For every issue found, provide a concrete developer-centric fix suggestion (e.g., CSS fix, React prop change).
5. **Console Analysis**: If provided with console logs, identify the root cause (CSP violations, missing assets, CORS).

Return a JSON object with 'issues', 'interactiveElements', and 'consoleAnalysis'.
`;

export const analyzeScreenshot = async (
  base64Image: string,
  mimeType: string,
  context: string,
  rawConsoleLogs?: string[]
): Promise<{ issues: QaIssue[], elements: InteractiveElement[], logs: ConsoleLog[] }> => {
  try {
    const prompt = `
      Current Browser State: ${context}
      Raw Console Logs: ${rawConsoleLogs?.join('\n') || 'No console logs captured.'}
      Analyze all interactive components, visual bugs, and console errors.
      If this screen is a 404 or a crash, mark as CRITICAL RUNTIME_ERROR.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Image } },
          { text: prompt },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, enum: ["LAYOUT", "TEXT", "CONTRAST", "I18N", "UX", "INTERACTION", "RUNTIME_ERROR", "SECURITY"] },
                  severity: { type: Type.STRING, enum: ["CRITICAL", "WARNING", "INFO"] },
                  description: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
                required: ["category", "severity", "description", "suggestion"],
              },
            },
            interactiveElements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["BUTTON", "LINK", "INPUT", "MENU", "DROPDOWN", "TOGGLE"] },
                  label: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ["REACHABLE", "BROKEN", "OBSCURED", "ERROR_STATE"] },
                },
                required: ["type", "label", "status"],
              },
            },
            consoleAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  level: { type: Type.STRING, enum: ["error", "warning", "info"] },
                  message: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
                required: ["level", "message"],
              },
            }
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    
    return {
      issues: (parsed.issues || []).map((i: any) => ({ ...i, id: Math.random().toString(36).substr(2, 9) })),
      elements: (parsed.interactiveElements || []).map((e: any) => ({ ...e, id: Math.random().toString(36).substr(2, 9) })),
      logs: (parsed.consoleAnalysis || []).map((l: any) => ({ ...l, id: Math.random().toString(36).substr(2, 9), source: 'Browser Context' })),
    };
  } catch (error) {
    console.error("Gemini Agent Audit Failed", error);
    return { issues: [], elements: [], logs: [] };
  }
};