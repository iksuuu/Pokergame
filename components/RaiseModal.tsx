
import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

interface RaiseModalProps {
  minRaise: number;
  maxRaise: number;
  currentPot: number;
  currentBet: number;
  playerBet: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

const RaiseModal: React.FC<RaiseModalProps> = ({
  minRaise,
  maxRaise,
  currentPot,
  currentBet,
  playerBet,
  onConfirm,
  onCancel
}) => {
  const [amount, setAmount] = useState(minRaise);

  useEffect(() => {
    setAmount(minRaise);
  }, [minRaise]);

  const handleQuickAmount = (ratio: number) => {
    const target = Math.floor(currentPot * ratio) + currentBet;
    const finalAmount = Math.min(Math.max(target, minRaise), maxRaise);
    setAmount(finalAmount);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-white font-black text-xl tracking-tight">精确加注</h3>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-1">最低: ${minRaise} / 最高: ${maxRaise}</p>
          </div>
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="bg-black/40 rounded-3xl p-8 mb-8 border border-white/5 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          <div className="text-neutral-500 text-[10px] font-black uppercase mb-2">加注总额</div>
          <div className="text-6xl text-white font-mono font-black tracking-tighter">${amount}</div>
        </div>

        <div className="space-y-6">
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value))}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />

          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => handleQuickAmount(0.33)} className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-3 rounded-xl transition-all border border-white/5">1/3 POT</button>
            <button onClick={() => handleQuickAmount(0.5)} className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-3 rounded-xl transition-all border border-white/5">1/2 POT</button>
            <button onClick={() => setAmount(maxRaise)} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs font-bold py-3 rounded-xl transition-all border border-red-500/20 uppercase tracking-widest">设置 All-in</button>
            <button onClick={() => onConfirm(maxRaise)} className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-widest col-span-3">确认 All-in</button>
          </div>

          <button
            onClick={() => onConfirm(amount)}
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-yellow-900/20 transition-all active:scale-95"
          >
            确认加注 ${amount}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RaiseModal;
