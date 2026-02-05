import React, { useMemo } from 'react';
import { AnalyzedScreenshot, Severity, ConsoleLog } from '../types';
import { AlertTriangle, CheckCircle, XCircle, MousePointer2, Target, MoveRight, Layers, Bug, MapPin, Terminal as TerminalIcon, ShieldAlert } from 'lucide-react';

interface DashboardProps {
  results: AnalyzedScreenshot[];
}

export const Dashboard: React.FC<DashboardProps> = ({ results }) => {
  const summary = useMemo(() => {
    let pages = results.length;
    let interactions = results.reduce((acc, r) => acc + r.interactiveElements.length, 0);
    let critical = results.reduce((acc, r) => acc + r.issues.filter(i => i.severity === Severity.CRITICAL).length, 0);
    let warnings = results.reduce((acc, r) => acc + r.issues.filter(i => i.severity === Severity.WARNING).length, 0);
    let consoleErrors = results.reduce((acc, r) => acc + r.consoleLogs.filter(l => l.level === 'error').length, 0);
    
    return { pages, interactions, critical, warnings, consoleErrors };
  }, [results]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-10 animate-fade-in print:p-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-800 pb-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-widest">
            <Target size={12} /> Autonomous AI Report
          </div>
          <h2 className="text-5xl font-black text-white tracking-tighter leading-none">VQA_CRAWL_MANIFEST</h2>
          <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Bot Session: VQA-{Math.random().toString(36).substr(2, 5).toUpperCase()}</p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
           {[
             { label: 'Crawl Nodes', val: summary.pages, color: 'text-blue-400' },
             { label: 'Interactions', val: summary.interactions, color: 'text-purple-400' },
             { label: 'Failures', val: summary.critical, color: 'text-red-500' },
             { label: 'Warnings', val: summary.warnings, color: 'text-amber-500' }
           ].map((stat, i) => (
             <div key={i} className="bg-[#111114] border border-gray-800 p-4 rounded-2xl flex flex-col justify-center">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{stat.label}</span>
                <span className={`text-2xl font-black ${stat.color}`}>{stat.val}</span>
             </div>
           ))}
        </div>
      </header>

      {/* Global Console Error Audit */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
            <TerminalIcon className="text-gray-400" size={20} />
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Global_Console_Audit</h3>
            {summary.consoleErrors > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-black">{summary.consoleErrors} ERRORS</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.flatMap(r => r.consoleLogs).length === 0 ? (
                <div className="col-span-full p-6 bg-emerald-950/10 border border-emerald-900/30 rounded-2xl text-emerald-400 text-sm flex items-center gap-3">
                    <CheckCircle size={20} />
                    <span>No browser runtime errors detected across all interaction paths.</span>
                </div>
            ) : (
                results.flatMap(r => r.consoleLogs).map((log, i) => (
                    <div key={i} className="bg-[#0a0a0c] border border-gray-800 p-5 rounded-2xl flex gap-4">
                        <div className={`mt-1 p-2 rounded-lg ${log.level === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            <ShieldAlert size={20} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-mono text-gray-400 break-all">{log.message}</p>
                            {log.suggestion && (
                                <div className="bg-purple-500/5 border border-purple-500/10 p-3 rounded-xl">
                                    <span className="text-[9px] font-black text-purple-500 uppercase">Proposed Fix:</span>
                                    <p className="text-[11px] text-purple-300 italic">{log.suggestion}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
      </section>

      {/* Pages / Interaction Trace */}
      <section className="space-y-12 pt-10 border-t border-gray-800">
        <div className="flex items-center gap-3">
            <Bug className="text-purple-500" size={24} />
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Exploration_Timeline</h3>
        </div>
        {results.sort((a,b) => {
            const aCrit = a.issues.filter(i => i.severity === Severity.CRITICAL).length;
            const bCrit = b.issues.filter(i => i.severity === Severity.CRITICAL).length;
            return bCrit - aCrit;
        }).map((result, idx) => (
            <div key={result.id} className={`bg-[#111114] rounded-[40px] overflow-hidden border ${result.isBuggy ? 'border-red-900/40 shadow-[0_0_50px_rgba(239,68,68,0.05)]' : 'border-gray-800'} transition-all`}>
                <div className="p-8 bg-[#16161a] border-b border-gray-800 flex flex-col lg:flex-row justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl ${result.isBuggy ? 'bg-red-600 text-white' : 'bg-purple-600 text-white'}`}>
                            {idx + 1}
                        </div>
                        <div>
                            <h4 className="text-2xl font-black text-white uppercase tracking-tighter">{result.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <MapPin size={12} className="text-gray-500" />
                                <span className="text-[10px] text-gray-500 font-mono font-bold">{result.navigationPath.length > 0 ? 'REPRODUCTION_PATH_CAPTURED' : 'INITIAL_STATE'}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Interaction Trace */}
                    <div className="flex flex-wrap items-center gap-2 bg-black/40 p-4 rounded-2xl border border-gray-800/50">
                        <span className="text-[10px] font-black text-gray-600 uppercase mr-2 tracking-widest">Trace:</span>
                        {result.navigationPath.length === 0 ? (
                            <span className="text-[11px] text-gray-500 italic">No previous interactions.</span>
                        ) : (
                            result.navigationPath.map((step, si) => (
                                <React.Fragment key={si}>
                                    <div className="group relative">
                                        <span className="text-[10px] font-mono font-black text-purple-400 bg-purple-900/20 px-2 py-1 rounded border border-purple-500/20 cursor-help">
                                            {step.type}(<span className="text-gray-300">{step.target}</span>)
                                        </span>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-black border border-gray-800 p-2 rounded text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                            Recorded at {step.timestamp}
                                        </div>
                                    </div>
                                    {si < result.navigationPath.length - 1 && <MoveRight size={10} className="text-gray-700 mx-1" />}
                                </React.Fragment>
                            ))
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2">
                    <div className="p-8 bg-black flex items-center justify-center border-b lg:border-b-0 lg:border-r border-gray-800">
                        <div className="relative group/img overflow-hidden rounded-3xl border border-gray-800/50">
                            <img src={result.imageUrl} alt={result.name} className="w-full h-auto object-contain transition-transform group-hover/img:scale-[1.02]" />
                        </div>
                    </div>

                    <div className="p-8 space-y-8 bg-gray-900/20">
                        {/* Interactive Elements Overlay */}
                        <div>
                            <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <MousePointer2 size={12} /> Elements Clicked in Session
                            </h5>
                            <div className="flex flex-wrap gap-2">
                                {result.interactiveElements.map(el => (
                                    <span key={el.id} className="text-[10px] font-bold bg-[#1a1a1e] border border-gray-800 px-3 py-1 rounded-lg text-gray-300 flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${el.status === 'REACHABLE' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
                                        {el.type}: {el.label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Audit Details */}
                        <div className="space-y-4">
                            <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ShieldAlert size={12} /> Visual Audit Results
                            </h5>
                            {result.issues.length === 0 ? (
                                <div className="p-5 bg-emerald-950/10 border border-emerald-900/30 rounded-2xl text-emerald-500 text-xs font-bold flex items-center gap-3">
                                    <CheckCircle size={18} /> No regressions detected in this state.
                                </div>
                            ) : (
                                result.issues.map(issue => (
                                    <div key={issue.id} className={`p-5 rounded-3xl border ${issue.severity === Severity.CRITICAL ? 'bg-red-500/5 border-red-900/30' : 'bg-gray-800/30 border-gray-800'}`}>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                                                issue.severity === Severity.CRITICAL ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                                            }`}>
                                                {issue.category}
                                            </span>
                                            <span className="text-[9px] text-gray-600 font-mono">#{issue.id}</span>
                                        </div>
                                        <p className="text-sm text-gray-200 font-medium mb-4">{issue.description}</p>
                                        <div className="bg-black/40 p-4 rounded-2xl border border-gray-800/50">
                                            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block mb-2">Technical Resolution Path</span>
                                            <p className="text-xs text-purple-200/70 italic leading-relaxed">
                                                "{issue.suggestion}"
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        ))}
      </section>
    </div>
  );
};