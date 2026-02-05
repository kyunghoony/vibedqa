import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal as TerminalIcon, ChevronRight, Hash, Play, Map } from 'lucide-react';

interface TerminalProps {
  logs: LogEntry[];
}

export const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#0a0a0c] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden border border-gray-800/50 font-mono text-sm">
      <div className="bg-[#16161a] px-5 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
          <TerminalIcon size={16} className="text-purple-400" />
          <span className="text-gray-400 font-bold tracking-tight">VIBED_QA_AGENT_v2.5_CORE</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="h-[450px] overflow-y-auto p-5 terminal-scroll bg-black/40 backdrop-blur-sm"
      >
        {logs.map((log, idx) => (
          <div key={idx} className="mb-2 animate-fade-in flex items-start gap-3">
            <span className="text-gray-600 shrink-0 select-none">[{log.timestamp}]</span>
            {log.level === 'error' ? (
              <span className="text-red-400 bg-red-950/20 px-1 rounded flex items-center gap-1">
                 <Hash size={12}/> FATAL: {log.message}
              </span>
            ) : log.level === 'success' ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Play size={12} fill="currentColor" className="opacity-50"/> {log.message}
              </span>
            ) : log.level === 'action' ? (
              <span className="text-purple-400 border-l-2 border-purple-800 pl-2 py-0.5">
                <span className="opacity-50 font-black">AGENT_DO:</span> {log.message}
              </span>
            ) : log.level === 'system' ? (
              <span className="text-blue-400 font-bold bg-blue-950/20 px-2 rounded-sm flex items-center gap-2">
                <Map size={12} /> {log.message}
              </span>
            ) : (
              <span className="text-gray-300 opacity-80">{log.message}</span>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 text-purple-500 ml-1 mt-2">
          <ChevronRight size={16} className="animate-pulse" />
          <span className="w-2 h-5 bg-purple-500 animate-pulse inline-block"></span>
        </div>
      </div>
    </div>
  );
};