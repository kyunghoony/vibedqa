import React, { useState, useRef, useEffect } from 'react';
import { Terminal } from './components/Terminal';
import { Dashboard } from './components/Dashboard';
import { AppState, LogEntry, AnalyzedScreenshot, InteractionStep, Severity } from './types';
import { analyzeScreenshot } from './services/gemini';
import { 
  Play, 
  Globe, 
  Bot, 
  Settings, 
  Zap, 
  FileText, 
  Download, 
  Monitor, 
  ShieldAlert, 
  CheckCircle,
  Loader2,
  ArrowRight,
  Video,
  Github,
  Server,
  Code2,
  MousePointer2
} from 'lucide-react';

// Mock images to simulate a headless browser navigating a real app
const SIMULATION_URLS = [
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop', // Analytics Dashboard
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop', // Data Grid
  'https://images.unsplash.com/photo-1555421689-492a18d9c3ad?q=80&w=2670&auto=format&fit=crop'  // Settings/Code
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [url, setUrl] = useState('https://app.vibed-qa-test.com');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyzedData, setAnalyzedData] = useState<AnalyzedScreenshot[]>([]);
  const [currentSimulatedImage, setCurrentSimulatedImage] = useState<string | null>(null);

  const addLog = (message: string, level: LogEntry['level'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { timestamp, level, message }]);
  };

  // Helper to convert remote image to base64 for Gemini, capturing correct MIME type
  const fetchImageAsBase64 = async (imageUrl: string): Promise<{ base64: string, mimeType: string } | null> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          // Extract exact mime type from data URL
          const mimeMatch = result.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
          const mimeType = mimeMatch ? mimeMatch[1] : blob.type || 'image/png';
          resolve({ base64, mimeType });
        };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to fetch simulation image", e);
      return null;
    }
  };

  const startAgentExploration = async () => {
    setState(AppState.AGENT_EXPLORATION);
    setLogs([]);
    
    // 1. Initialize "Remote" Playwright Session
    addLog(`POST /api/v1/agent/session/start`, 'system');
    addLog(`Connecting to Headless Chromium instance...`, 'info');
    await new Promise(r => setTimeout(r, 1000));
    addLog(`Connected to ws://playwright-service:3000/browser`, 'success');

    // 2. Run Playwright Script Simulation
    const sequence = [
      { cmd: `await browser.newContext({ recordVideo: { dir: 'videos/' } })`, delay: 800 },
      { cmd: `await page.goto('${url}', { waitUntil: 'networkidle' })`, delay: 1500 },
      { cmd: `> Navigation confirmed. Status: 200 OK`, delay: 500, type: 'success' },
      { cmd: `await page.getByRole('button', { name: 'Analytics' }).click()`, delay: 2000 },
      { cmd: `await expect(page.locator('.dashboard-grid')).toBeVisible()`, delay: 1000 },
      { cmd: `> Visual regression check initiated on frame 234`, delay: 500, type: 'info' },
      { cmd: `await page.locator('input[name="settings"]').fill('dark_mode')`, delay: 1500 },
      { cmd: `await page.keyboard.press('Enter')`, delay: 800 },
    ];

    const capturedSnapshots: { base64: string, mimeType: string, name: string }[] = [];

    // Execute sequence
    for (let i = 0; i < SIMULATION_URLS.length; i++) {
        // Show simulated "live" view
        setCurrentSimulatedImage(SIMULATION_URLS[i]);
        
        // Log steps associated with this "page"
        const stepIdx = i * 3; 
        if (sequence[stepIdx]) addLog(sequence[stepIdx].cmd, 'action');
        if (sequence[stepIdx+1]) {
            await new Promise(r => setTimeout(r, sequence[stepIdx+1].delay));
            addLog(sequence[stepIdx+1].cmd, sequence[stepIdx+1].type as any || 'action');
        }
        
        // "Capture" the screenshot
        addLog(`[Playwright] Page.screenshot({ path: 'trace_${i}.png' })`, 'system');
        const imageData = await fetchImageAsBase64(SIMULATION_URLS[i]);
        
        if (imageData) {
            capturedSnapshots.push({ 
                base64: imageData.base64, 
                mimeType: imageData.mimeType, 
                name: `trace_step_${i+1}_${i===0?'home':i===1?'dashboard':'settings'}.png` 
            });
        }
        
        await new Promise(r => setTimeout(r, 1000));
    }

    addLog(`Browser context closed. 3 Traces exported.`, 'success');
    setCurrentSimulatedImage(null);
    runAiAnalysis(capturedSnapshots);
  };

  const runAiAnalysis = async (snapshots: { base64: string, mimeType: string, name: string }[]) => {
    setState(AppState.AI_AUDIT);
    addLog(`GEMINI_BRIDGE: Uploading ${snapshots.length} traces for analysis...`, 'system');

    const results: AnalyzedScreenshot[] = [];
    
    // Mock data to map to the visual simulation
    const mockPaths: InteractionStep[][] = [
        [{ type: 'NAVIGATE', target: '/', timestamp: '10:00:01' }],
        [{ type: 'CLICK', target: 'Analytics', timestamp: '10:00:05' }, { type: 'NAVIGATE', target: '/analytics', timestamp: '10:00:06' }],
        [{ type: 'TYPE', target: 'Search', value: 'dark_mode', timestamp: '10:00:15' }]
    ];

    const mockConsoleLogs = [
      ["[HMR] Waiting for update signal from WDS..."],
      ["Warning: Encountered two children with the same key, `14`."],
      ["POST /api/v1/search 403 (Forbidden)"]
    ];

    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      addLog(`Auditing Trace: ${snap.name}...`, 'action');
      
      try {
        const { issues, elements, logs: auditLogs } = await analyzeScreenshot(
          snap.base64, 
          snap.mimeType,
          snap.name, 
          mockConsoleLogs[i % mockConsoleLogs.length]
        );
        
        results.push({
          id: Math.random().toString(36).substr(2, 9),
          imageUrl: `data:${snap.mimeType};base64,${snap.base64}`,
          name: snap.name,
          issues,
          interactiveElements: elements,
          navigationPath: mockPaths[i % mockPaths.length],
          consoleLogs: auditLogs,
          status: 'done',
          isBuggy: issues.some(iss => iss.severity === Severity.CRITICAL)
        });
        
        addLog(`[Gemini] Analysis complete for ${snap.name}. Found ${issues.length} items.`, 'success');
      } catch (err) {
        addLog(`Failed to audit ${snap.name}`, 'error');
        console.error(err);
      }
    }

    setAnalyzedData(results);
    generateReportSummary(results);
    setState(AppState.REPORT_READY);
  };

  const generateReportSummary = (results: AnalyzedScreenshot[]) => {
    addLog('------------------------------------', 'system');
    addLog('PLAYWRIGHT AUTOMATION REPORT', 'system');
    addLog(`Execution Time: 8.42s`, 'info');
    const totalIssues = results.reduce((acc, r) => acc + r.issues.length, 0);
    const criticals = results.reduce((acc, r) => acc + r.issues.filter(i => i.severity === Severity.CRITICAL).length, 0);
    addLog(`Test Status: ${criticals > 0 ? 'FAILED' : 'PASSED'}`, criticals > 0 ? 'error' : 'success');
    addLog('------------------------------------', 'system');
  };

  const downloadReportAsHtml = () => {
    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>VibedQA Playwright Report</title>
          <style>
            body { font-family: sans-serif; background: #000; color: #fff; padding: 40px; }
            h1 { color: #a855f7; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .card { background: #111; border: 1px solid #333; padding: 20px; margin-bottom: 20px; border-radius: 10px; }
            .crit { border-left: 5px solid red; }
            .path { font-family: monospace; color: #a855f7; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>VibedQA Playwright Audit</h1>
          <p>Target: ${url}</p>
          <p>Engine: Playwright v1.42.1 (Chromium)</p>
          ${analyzedData.map(r => `
            <div class="card ${r.isBuggy ? 'crit' : ''}">
              <h2>${r.name}</h2>
              <p class="path">Action: ${r.navigationPath.map(p => `${p.type} ${p.target}`).join(' -> ') || 'Start'}</p>
              <ul>
                ${r.issues.map(i => `<li>[${i.severity}] ${i.category}: ${i.description}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </body>
      </html>
    `;
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `VQA-Playwright-Report-${new Date().getTime()}.html`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#060608] text-gray-100 flex flex-col font-sans selection:bg-purple-500/40">
      
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-900/10 blur-[120px] rounded-full"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-900/10 blur-[120px] rounded-full"></div>
      </div>

      <nav className="border-b border-gray-800/50 bg-[#060608]/80 backdrop-blur-xl sticky top-0 z-50 px-6">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setState(AppState.IDLE)}>
            <div className="relative">
                <div className="absolute inset-0 bg-purple-500 blur-md opacity-20 group-hover:opacity-60 transition-opacity"></div>
                <div className="relative p-2.5 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl group-hover:rotate-6 transition-transform shadow-2xl">
                    <Bot className="text-white" size={22} />
                </div>
            </div>
            <div className="flex flex-col">
                <span className="font-black text-2xl tracking-tighter uppercase leading-none">Vibed<span className="text-purple-500">QA</span></span>
                <span className="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase mt-1 leading-none">Playwright Integration</span>
            </div>
          </div>
          <div className="flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-gray-500">
             <a href="#" className="hover:text-purple-400 transition-colors flex items-center gap-2">
                <Server size={14} /> Agent: Online
             </a>
             <a href="#" className="flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-800 hover:text-white transition-all">
                <Github size={16}/> v3.0.0
             </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {state === AppState.IDLE && (
          <div className="max-w-4xl w-full space-y-16 animate-fade-in text-center py-10">
            <div className="space-y-6">
               <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1 rounded-full mb-4">
                  <Zap className="text-purple-500" size={14} fill="currentColor" />
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Headless Automation Core</span>
               </div>
              <h1 className="text-7xl font-black text-white leading-[0.9] tracking-tighter">
                PLAYWRIGHT. <br/> 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-indigo-500">AI VERIFIED.</span>
              </h1>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
                Launch a headless browser instance that recursively navigates your app. Gemini Vision audits every frame captured by Playwright for regressions.
              </p>
            </div>

            <div className="bg-[#111114]/80 backdrop-blur-md p-10 rounded-[40px] border border-gray-800 shadow-[0_30px_100px_rgba(0,0,0,0.6)] space-y-8 text-left relative overflow-hidden group">
              <div className="relative z-10 space-y-8">
                <div>
                    <div className="flex justify-between items-end mb-4">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Target Infrastructure URL</label>
                        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Playwright Service Ready</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1 group">
                        <Globe className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-purple-500 transition-colors" size={22} />
                        <input 
                        type="text" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full bg-[#0a0a0c] border border-gray-800 rounded-3xl py-6 pl-14 pr-6 text-white font-mono text-base focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500/50 outline-none transition-all shadow-inner placeholder:text-gray-700"
                        placeholder="https://app.yourdomain.com"
                        />
                    </div>
                    <button 
                        onClick={startAgentExploration}
                        className="bg-white hover:bg-gray-200 text-black px-12 py-6 rounded-3xl font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 group"
                    >
                        <Play size={20} fill="currentColor" className="group-hover:translate-x-0.5 transition-transform"/>
                        Begin Agent Session
                    </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 flex flex-col gap-4 hover:border-purple-500/30 transition-all">
                        <Code2 className="text-purple-500" size={24} />
                        <div className="text-sm">
                            <p className="text-white font-black uppercase tracking-tight">Playwright Script</p>
                            <p className="text-gray-500 text-xs mt-1">Executes <span className="font-mono bg-white/10 px-1 rounded">page.goto()</span> and interactions automatically.</p>
                        </div>
                    </div>
                    <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 flex flex-col gap-4 hover:border-blue-500/30 transition-all">
                        <FileText className="text-blue-400" size={24} />
                        <div className="text-sm">
                            <p className="text-white font-black uppercase tracking-tight">Gemini Audit</p>
                            <p className="text-gray-500 text-xs mt-1">Screenshots are piped to Gemini-3-Pro for visual analysis.</p>
                        </div>
                    </div>
                    <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 flex flex-col gap-4 hover:border-pink-500/30 transition-all">
                        <Monitor className="text-pink-400" size={24} />
                        <div className="text-sm">
                            <p className="text-white font-black uppercase tracking-tight">Headless View</p>
                            <p className="text-gray-500 text-xs mt-1">Live stream the headless browser state in the dashboard.</p>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(state === AppState.AGENT_EXPLORATION || state === AppState.AI_AUDIT || state === AppState.REPORT_READY) && (
          <div className="w-full max-w-4xl space-y-8 animate-fade-in py-10">
             <div className="flex flex-col md:flex-row justify-between items-stretch bg-[#111114] p-2 rounded-[32px] border border-gray-800 shadow-2xl gap-6 overflow-hidden relative">
                
                {/* Simulated Remote Browser View */}
                <div className="flex-1 bg-black rounded-3xl border border-gray-800/50 overflow-hidden relative min-h-[250px] flex items-center justify-center group">
                    {state === AppState.AGENT_EXPLORATION && currentSimulatedImage ? (
                        <>
                           <img src={currentSimulatedImage} alt="Headless Browser Stream" className="w-full h-full object-cover opacity-80" />
                           <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/80 backdrop-blur px-3 py-1.5 rounded-full border border-gray-700 z-10">
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                              <span className="text-[10px] font-mono font-bold text-gray-300 uppercase">Chromium: Headless</span>
                           </div>
                           {/* Mouse Cursor Simulation */}
                           <div className="absolute top-1/2 left-1/2 animate-bounce transition-all duration-1000 text-purple-500">
                               <MousePointer2 size={32} fill="currentColor" className="drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"/>
                           </div>
                        </>
                    ) : state === AppState.AI_AUDIT ? (
                        <div className="flex flex-col items-center gap-4">
                           <Loader2 size={40} className="text-purple-500 animate-spin" />
                           <p className="text-xs font-mono text-purple-400">PROCESSING_SNAPSHOTS</p>
                        </div>
                    ) : state === AppState.REPORT_READY ? (
                        <div className="flex flex-col items-center gap-4">
                            <CheckCircle size={50} className="text-emerald-500" />
                            <p className="text-xs font-black text-emerald-500 uppercase tracking-widest">Session Complete</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                             <Server size={32} className="text-gray-700" />
                             <p className="text-xs text-gray-600 font-mono">WAITING_FOR_STREAM</p>
                        </div>
                    )}
                </div>

                {/* Status Sidebar */}
                <div className="w-full md:w-72 p-6 flex flex-col justify-center">
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-4">
                        {state === AppState.AGENT_EXPLORATION ? 'EXECUTING SCRIPT' : 
                         state === AppState.AI_AUDIT ? 'ANALYZING' :
                         'AUDIT DONE'}
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Latency</span>
                                <span className="text-[10px] text-emerald-400 font-mono">24ms</span>
                            </div>
                            <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[80%]"></div>
                            </div>
                        </div>
                        {state === AppState.REPORT_READY && (
                            <button 
                                onClick={() => setState(AppState.REPORT)}
                                className="w-full bg-white hover:bg-gray-200 text-black py-4 rounded-xl font-black uppercase tracking-tight text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-white/10"
                            >
                                View Report <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
             </div>
             
             <Terminal logs={logs} />
          </div>
        )}

        {state === AppState.REPORT && (
             <div className="w-full animate-fade-in pb-32 pt-10">
                 <div className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-center px-6 gap-6">
                    <button 
                        onClick={() => setState(AppState.IDLE)} 
                        className="text-gray-500 hover:text-white flex items-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all group"
                    >
                        <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-purple-600 transition-colors">
                           <Play className="rotate-180" size={14} fill="currentColor" />
                        </div>
                        New Playwright Session
                    </button>
                    <div className="flex items-center gap-4">
                        <button 
                          onClick={downloadReportAsHtml}
                          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-gray-800 flex items-center gap-2"
                        >
                            <Download size={14} /> Export HTML
                        </button>
                        <button onClick={() => window.print()} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-purple-900/30 flex items-center gap-2">
                            <Monitor size={14} /> Print Audit
                        </button>
                    </div>
                 </div>
                 <Dashboard results={analyzedData} />
             </div>
        )}
      </main>

      <footer className="py-10 border-t border-gray-800/50 text-center relative z-10">
         <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.5em]">VibedQA Engine v3.0 — Powered by Playwright & Gemini</p>
      </footer>
    </div>
  );
};

export default App;