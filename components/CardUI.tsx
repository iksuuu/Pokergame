
import React from 'react';
import { Card as CardType } from '../types';
import { SuitIcon } from './SuitIcon';

interface CardProps {
  card?: CardType;
  hidden?: boolean;
  className?: string;
  highlight?: boolean;
}

const CardUI: React.FC<CardProps> = ({ card, hidden, className, highlight }) => {
  // 增大基础尺寸：从 w-14/h-20 增加到 w-20/h-28
  if (hidden || !card) {
    return (
      <div className={`w-14 h-20 md:w-20 md:h-28 bg-indigo-950 border-2 border-indigo-400/50 rounded-xl flex items-center justify-center shadow-2xl overflow-hidden relative ${className}`}>
        <div className="absolute inset-1 border border-indigo-500/20 rounded-lg bg-[radial-gradient(circle,_#1e1b4b_0%,_#0f172a_100%)] flex items-center justify-center">
          <div className="text-white/10 text-xs grid grid-cols-2 gap-2 rotate-45">
            <span>♠</span><span>♣</span>
            <span>♥</span><span>♦</span>
          </div>
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div className={`
      w-14 h-20 md:w-20 md:h-28 bg-white border rounded-xl flex flex-col justify-between p-2 shadow-2xl transition-all duration-300
      ${highlight ? 'ring-4 ring-yellow-400 scale-110 z-20 shadow-[0_0_20px_rgba(250,204,21,0.6)]' : 'border-neutral-300'}
      ${className}
    `}>
      <div className={`text-sm md:text-xl font-black leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>
        {card.rank}
      </div>
      <div className="flex justify-center text-3xl md:text-5xl -mt-1">
        <SuitIcon suit={card.suit} />
      </div>
      <div className={`text-sm md:text-xl font-black leading-none self-end rotate-180 ${isRed ? 'text-red-600' : 'text-black'}`}>
        {card.rank}
      </div>
    </div>
  );
};

export default CardUI;
