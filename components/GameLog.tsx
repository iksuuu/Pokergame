
import React from 'react';
import { GameLogEntry } from '../types';
import { ScrollText, Clock } from 'lucide-react';

interface GameLogProps {
  logs: GameLogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

const GameLog: React.FC<GameLogProps> = ({ logs, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-neutral-900/95 backdrop-blur-2xl border-l border-white/10 z-[150] shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="text-yellow-500" size={20} />
          <h2 className="text-white font-bold tracking-tight">对局记录历史</h2>
        </div>
        <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">关闭</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px]">
        {logs.length === 0 && (
          <div className="text-center py-20 text-neutral-600 italic">暂无对局历史...</div>
        )}
        {logs.slice().reverse().map((log, i) => (
          <div key={i} className="bg-white/5 p-3 rounded-lg border border-white/5 group hover:border-yellow-500/30 transition-all">
            <div className="flex items-center justify-between mb-1 opacity-50">
              <span className="text-yellow-500 font-bold">#HAND {log.handNumber}</span>
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {log.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameLog;
