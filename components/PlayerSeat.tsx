
import React from 'react';
import { Player, Card } from '../types';
import CardUI from './CardUI';

interface PlayerSeatProps {
  player: Player;
  isCurrent: boolean;
  isHero: boolean;
  showCards?: boolean;
  winningCards?: Card[];
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({ player, isCurrent, isHero, showCards, winningCards }) => {
  const isWinner = player.lastAction === '赢家!';
  
  const isWinningCard = (card: Card) => {
    return winningCards?.some(wc => wc.rank === card.rank && wc.suit === card.suit) || false;
  };

  return (
    <div className={`relative flex flex-col items-center gap-3 transition-transform duration-500 ${isWinner ? 'scale-110' : ''}`}>
      {/* 获胜光环动画 */}
      {isWinner && (
        <div className="absolute inset-0 -m-8 bg-yellow-500/20 rounded-full blur-3xl animate-pulse"></div>
      )}

      {/* 角色标识：庄家/小盲/大盲 */}
      <div className="absolute -left-16 top-1/2 -translate-y-1/2 flex flex-col gap-2">
        {player.isDealer && (
          <div className="w-8 h-8 rounded-full bg-white text-black text-xs flex items-center justify-center font-black shadow-lg border border-neutral-300">D</div>
        )}
        {player.isSmallBlind && (
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-black shadow-lg border border-blue-400">SB</div>
        )}
        {player.isBigBlind && (
          <div className="w-8 h-8 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-black shadow-lg border border-red-400">BB</div>
        )}
      </div>

      {/* Bet Bubble */}
      {player.bet > 0 && !isWinner && (
        <div className="absolute -top-12 bg-yellow-600/90 text-white text-xs px-3 py-1.5 rounded-full border border-yellow-400/50 font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2">
          ${player.bet}
        </div>
      )}

      {/* Cards - 增大手牌间距和缩放 */}
      <div className="flex gap-2 relative z-10">
        {player.isFolded ? (
          <div className="text-neutral-600 italic text-xs py-6 uppercase font-bold tracking-widest">Folded</div>
        ) : (
          player.cards.map((c, i) => (
            <CardUI 
              key={i} 
              card={c} 
              hidden={!isHero && !showCards && !isWinner} 
              // Hero 的牌尺寸最大，其余玩家缩小
              className={isHero ? "scale-100" : "scale-75 origin-center"} 
              highlight={isWinner && isWinningCard(c)}
            />
          ))
        )}
      </div>

      {/* Profile */}
      <div className={`
        flex flex-col items-center p-4 rounded-3xl border-2 transition-all duration-300 w-32 md:w-40 relative z-10
        ${isWinner ? 'bg-yellow-900/60 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.6)]' : 
          (isCurrent ? 'bg-indigo-900/60 border-indigo-400 scale-105 shadow-xl' : 'bg-black/60 border-neutral-800')}
        ${player.isFolded ? 'opacity-40 grayscale blur-[0.5px]' : ''}
      `}>
        <div className="text-white font-bold text-sm truncate w-full text-center">
          {player.name}
        </div>
        <div className="text-green-500 font-mono text-xs mt-1">
          ${player.chips}
        </div>
        {player.lastAction && (
          <div className={`mt-1 text-[10px] uppercase font-black tracking-tighter ${isWinner ? 'text-yellow-400 animate-bounce' : 'text-indigo-300 animate-pulse'}`}>
            {player.lastAction}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerSeat;
