
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, HandResult } from './types';
import { INITIAL_CHIPS, BIG_BLIND } from './constants';
import { getDealerCommentary } from './services/geminiService';
import { realtime } from './services/realtimeService';
import { createNewGameState, processAction, settleGameLogic } from './services/gameEngine';
import PlayerSeat from './components/PlayerSeat';
import CardUI from './components/CardUI';
import GameLog from './components/GameLog';
import RaiseModal from './components/RaiseModal';
import { Trophy, RotateCcw, Share2, History, Radio, Cpu, UserPlus, Home, Users, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [inLobby, setInLobby] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [aiDealerVoice, setAiDealerVoice] = useState("欢迎来到德州扑克俱乐部。");
  const [isLoading, setIsLoading] = useState(false);
  const [winners, setWinners] = useState<{ player: Player, hand: HandResult }[]>([]);
  const [showInviteTooltip, setShowInviteTooltip] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);
  const [roomId, setRoomId] = useState<string>('');

  const npcTimerRef = useRef<number | null>(null);

  // Initialize Socket Listeners
  useEffect(() => {
    realtime.on('connect', () => {
      // console.log('Connected');
    });

    realtime.on('lobbyUpdate', (data: { players: any[], roomId: string }) => {
      setLobbyPlayers(data.players);
      setIsLoading(false);
      setInLobby(false);
    });

    realtime.on('gameStarted', (state: GameState) => {
      setGameState(state);
      setInLobby(false);
      setIsLoading(false);
      setWinners([]);
      setAiDealerVoice("对局开始，祝大家好运。");
    });

    realtime.on('gameState', (state: GameState) => {
      setGameState(state);
      setInLobby(false);
    });

    realtime.on('winners', (data: { player: Player, hand: HandResult }[]) => {
      setWinners(data);
      const winnerDetails = data.map(w => `${w.player.name} (${w.hand.label})`).join(', ');
      setAiDealerVoice(`${winnerDetails} 赢得了本局`);
    });

    realtime.on('error', (msg: string) => {
      alert(msg);
      setIsLoading(false);
      setInLobby(true);
      setGameState(null);
      setLobbyPlayers([]);
      setRoomId('');
      window.location.hash = '';
    });

    realtime.connect();

    // Check hash for join
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.length === 6 && !gameState && inLobby) {
      setIsJoining(true);
    }

    return () => {
      // realTime.off calls...
    };
  }, []);

  // Effect for Single Player Bot Logic and Audio
  useEffect(() => {
    if (!gameState) return;

    // NPC Logic (Only in Single Player mode)
    if (gameState.roomCode === 'LOCAL-PRACTICE' && gameState.stage !== 'SHOWDOWN' && gameState.currentPlayerIndex !== -1) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.isNpc) {
        if (npcTimerRef.current) window.clearTimeout(npcTimerRef.current);
        npcTimerRef.current = window.setTimeout(() => {
          const callAmount = gameState.currentBet - currentPlayer.bet;
          if (callAmount > 0) handleAction(Math.random() < 0.1 ? 'FOLD' : 'CALL');
          else handleAction(Math.random() < 0.15 ? 'RAISE' : 'CHECK', (gameState.currentBet || BIG_BLIND) + BIG_BLIND);
        }, 1500);
      }
    }
  }, [gameState?.currentPlayerIndex, gameState?.stage]);

  const handleCreateRoom = () => {
    if (!userName) return;
    setIsLoading(true);
    realtime.createRoom(userName, (newRoomId) => {
      setRoomId(newRoomId);
      window.location.hash = newRoomId;
    });
  };

  const handleJoinFriend = () => {
    if (!userName) return;
    setIsLoading(true);
    const code = window.location.hash.replace('#', '');
    setRoomId(code);
    realtime.joinRoom(code, userName);
    setIsJoining(false);
  };

  const initGameLocal = () => {
    const p1 = { id: 'p1', name: userName, chips: INITIAL_CHIPS, isHost: true, isNpc: false } as any;
    const p2 = { id: 'p2', name: 'AI 小王', chips: INITIAL_CHIPS, isNpc: true } as any;
    const p3 = { id: 'p3', name: 'AI 小李', chips: INITIAL_CHIPS, isNpc: true } as any;

    const newState = createNewGameState([p1, p2, p3], 0, 'LOCAL-PRACTICE');
    setGameState(newState);
    setInLobby(false);
    setWinners([]);
    setAiDealerVoice("单机练习开始。");
    window.location.hash = '';
  };

  const startGameMultiplayer = () => {
    const code = window.location.hash.replace('#', '');
    realtime.startGame(code);
  };

  const backToLobby = () => {
    window.location.hash = '';
    setInLobby(true);
    setIsJoining(false);
    setGameState(null);
    setWinners([]);
    setLobbyPlayers([]);
    setRoomId('');
  };

  const handleAction = async (action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount?: number) => {
    if (!gameState) return;

    if (gameState.roomCode === 'LOCAL-PRACTICE') {
      const result = processAction(gameState, action, amount);
      setGameState(result.newState);
      if (result.winners) {
        setWinners(result.winners);
        const winnerDetails = result.winners.map(w => `${w.player.name} (${w.hand.label})`).join(', ');
        const commentary = await getDealerCommentary(result.newState, `${winnerDetails} 赢得了本局`);
        setAiDealerVoice(commentary);
      }
      setShowRaiseModal(false);
    } else {
      realtime.sendAction(gameState.roomCode, action, amount);
      setShowRaiseModal(false);
    }
  };

  const handleNextHand = () => {
    if (!gameState) return;
    if (gameState.roomCode === 'LOCAL-PRACTICE') {
      const nextDealer = (gameState.dealerIndex + 1) % gameState.players.length;
      const newState = createNewGameState(gameState.players, nextDealer, 'LOCAL-PRACTICE', (gameState.handCounter || 0) + 1, gameState.handHistory);
      setGameState(newState);
      setWinners([]);
    } else {
      realtime.startNextHand(gameState.roomCode);
    }
  };

  const copyInviteLink = () => {
    const currentRoomId = roomId || window.location.hash.replace('#', '');
    if (!currentRoomId) {
      console.warn('No roomId found for sharing');
      return;
    }

    // Robust URL construction
    const baseUrl = window.location.href.split('#')[0];
    const url = `${baseUrl}#${currentRoomId}`;
    console.log('Attempting to copy URL:', url);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setShowInviteTooltip(true);
        setTimeout(() => setShowInviteTooltip(false), 2000);
      }).catch(err => {
        console.error('Clipboard API failed:', err);
        window.prompt('请手动复制链接:', url);
      });
    } else {
      window.prompt('请手动复制链接:', url);
    }
  };

  // Helper getters
  const heroIndex = gameState?.players.findIndex(p =>
    gameState.roomCode === 'LOCAL-PRACTICE' ? p.name === userName : p.id === realtime.getUserId()
  ) ?? -1;
  const isHeroTurn = heroIndex !== -1 && gameState?.currentPlayerIndex === heroIndex;
  const hero = heroIndex !== -1 ? gameState?.players[heroIndex] : null;
  const isShowdown = gameState?.stage === 'SHOWDOWN';
  const heroCallAmount = gameState ? gameState.currentBet - (hero?.bet || 0) : 0;

  const lobbyHost = lobbyPlayers.find(p => p.isHost);
  const isMeHost = lobbyHost?.id === realtime.getUserId();

  if (inLobby) {
    if (isJoining && !gameState) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full flex flex-col items-center">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"><Trophy className="text-white" size={40} /></div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">加入对局</h1>
            <input type="text" placeholder="你的昵称..." value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-center focus:outline-none mb-6" />
            <button onClick={handleJoinFriend} disabled={!userName || isLoading} className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-30 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 mb-4">
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
              {isLoading ? '正在连接...' : '确认加入'}
            </button>
            <button onClick={backToLobby} className="text-neutral-500 text-xs font-bold uppercase">返回主页</button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
            <Trophy className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">Gemini Poker Club</h1>
          <p className="text-neutral-500 text-xs mb-12 uppercase tracking-[0.3em] text-center">私人定制 · 跨网对战</p>

          <div className="w-full space-y-6">
            <input
              type="text"
              placeholder="你的昵称..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-center focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
            />

            <div className="grid grid-cols-2 gap-4">
              <button onClick={initGameLocal} disabled={!userName} className="bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-3xl p-6 transition-all flex flex-col items-center gap-2 disabled:opacity-50">
                <Cpu className="text-indigo-400" />
                <span className="text-white font-bold text-xs">单机练习</span>
              </button>
              <button onClick={handleCreateRoom} disabled={!userName} className="bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-3xl p-6 transition-all flex flex-col items-center gap-2 disabled:opacity-50">
                <UserPlus className="text-yellow-400" />
                <span className="text-white font-bold text-xs">创建好友房</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pre-game / Lobby on Table
  const isWaitingInLobby = !gameState && lobbyPlayers.length > 0;
  const displayPlayers = gameState ? gameState.players : lobbyPlayers.map(p => ({
    ...p,
    bet: 0,
    cards: [],
    isFolded: false,
    isAllIn: false,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    hasActed: false,
    isOnline: p.isOnline !== false // Default to true
  }));

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center pb-48 relative overflow-hidden font-sans select-none">
      {/* 顶部状态 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 w-[400px]">
        <div className={`flex items-center gap-4 px-6 py-3 rounded-full border shadow-2xl bg-black/60 border-white/10 ${isShowdown ? 'border-yellow-500/30' : ''}`}>
          <Radio size={14} className="text-yellow-500 animate-pulse" />
          <div className="text-xs truncate text-neutral-200">
            {isWaitingInLobby
              ? `等待玩家加入 (${lobbyPlayers.length}/6)...`
              : (isShowdown && winners.length > 0
                ? `${winners.map(w => `${w.player.name} (${w.hand.label})`).join(', ')} 获胜!`
                : aiDealerVoice)}
          </div>
        </div>
      </div>

      {/* 侧边功能 */}
      <div className="fixed top-6 left-6 flex flex-col gap-3 z-50">
        <button onClick={backToLobby} className="bg-black/40 border border-white/10 px-3 py-2 rounded-xl text-neutral-400 hover:text-white transition-all flex items-center gap-2">
          <Home size={14} />
          <span className="text-[10px] font-black uppercase">主页</span>
        </button>
        {(isWaitingInLobby || (gameState && gameState.roomCode !== 'LOCAL-PRACTICE')) && (
          <button onClick={copyInviteLink} className="bg-black/40 border border-white/10 px-3 py-2 rounded-xl text-neutral-400 hover:text-white transition-all flex items-center gap-2">
            <Share2 size={14} />
            <span className="text-[10px] font-black uppercase">{showInviteTooltip ? '链接已复制' : '分享房间'}</span>
          </button>
        )}
      </div>

      <div className="fixed top-6 right-6 flex flex-col gap-3 z-50">
        <button onClick={() => setIsLogOpen(true)} className="w-10 h-10 bg-black/40 border border-white/10 rounded-xl text-neutral-400 hover:text-white flex items-center justify-center"><History size={18} /></button>
        {isShowdown && (
          <button onClick={handleNextHand} className="bg-yellow-600 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg animate-bounce flex items-center gap-2">
            <RotateCcw size={14} />下一局
          </button>
        )}
      </div>

      {gameState && <GameLog logs={gameState.handHistory} isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} />}
      {showRaiseModal && gameState && <RaiseModal minRaise={Math.max(gameState.currentBet + gameState.lastRaiseAmount, BIG_BLIND)} maxRaise={(hero?.chips || 0) + (hero?.bet || 0)} currentPot={gameState.pot} currentBet={gameState.currentBet} playerBet={hero?.bet || 0} onConfirm={(val) => handleAction('RAISE', val)} onCancel={() => setShowRaiseModal(false)} />}

      {/* 牌桌 */}
      <div className="relative w-[1100px] h-[580px] poker-felt border-[16px] border-[#2a1b10] rounded-[290px] flex items-center justify-center shadow-[0_0_100px_rgba(0,0,0,0.8)_inset]">
        <div className="absolute inset-0 pointer-events-none">
          {displayPlayers.map((p, i) => {
            const count = Math.max(displayPlayers.length, 2);
            const is2P = count === 2;
            const angles = is2P ? [90, 270] : count === 3 ? [90, 210, 330] : [90, 180, 270, 0, 45, 135];
            const angle = (angles[i] || (i * (360 / count))) * (Math.PI / 180);
            return (
              <div key={p.id} style={{ top: `${50 + 36 * Math.sin(angle)}%`, left: `${50 + 42 * Math.cos(angle)}%`, transform: 'translate(-50%, -50%)' }} className="absolute pointer-events-auto">
                <PlayerSeat
                  player={p as any}
                  isCurrent={gameState?.currentPlayerIndex === i}
                  isHero={p.id === (gameState ? (gameState.roomCode === 'LOCAL-PRACTICE' ? 'p1' : realtime.getUserId()) : realtime.getUserId())}
                  showCards={isShowdown || (p.id === (gameState ? (gameState.roomCode === 'LOCAL-PRACTICE' ? 'p1' : realtime.getUserId()) : realtime.getUserId()))}
                  winningCards={winners[0]?.hand.winningCards}
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-8 z-10">
          {isWaitingInLobby ? (
            <div className="flex flex-col items-center gap-6">
              <div className="text-white/40 text-sm font-bold animate-pulse">等待其他玩家加入...</div>
              {isMeHost && (
                <button
                  onClick={startGameMultiplayer}
                  disabled={lobbyPlayers.length < 2}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white font-black px-12 py-4 rounded-2xl shadow-2xl transition-all transform hover:scale-105"
                >
                  开始对局 ({lobbyPlayers.length})
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="bg-black/30 px-6 py-2 rounded-full border border-white/5 text-center">
                <div className="text-[8px] text-neutral-500 uppercase font-black tracking-widest">Total Pot</div>
                <div className="text-2xl text-white font-mono font-black">${gameState?.pot}</div>
              </div>
              <div className="flex gap-4">
                {gameState?.communityCards.map((c, i) => (
                  <CardUI key={i} card={c} highlight={winners[0]?.hand.winningCards.some(wc => wc.rank === c.rank && wc.suit === c.suit)} />
                ))}
                {Array.from({ length: 5 - (gameState?.communityCards.length || 0) }).map((_, i) => (
                  <div key={i} className="w-16 h-24 md:w-20 md:h-28 bg-white/5 border border-white/5 rounded-xl opacity-20"></div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 控制台 */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 flex justify-center z-[80] pointer-events-none transition-all duration-500 ${isHeroTurn && !isShowdown ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
        <div className="max-w-4xl w-full bg-neutral-900/60 border border-white/10 rounded-[24px] p-3 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 px-2">
              <div className="flex flex-col"><span className="text-[8px] text-neutral-500 font-black uppercase">筹码</span><span className="text-emerald-400 font-mono font-bold text-xl">${hero?.chips}</span></div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="flex gap-1.5">
                <button onClick={() => handleAction('FOLD')} className="bg-neutral-800 border border-white/5 text-neutral-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">弃牌</button>
                <button onClick={() => handleAction('CHECK')} disabled={heroCallAmount > 0} className="bg-neutral-800 border border-white/5 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-20 transition-all">过牌</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleAction('CALL')} disabled={heroCallAmount === 0} className="bg-indigo-600/40 hover:bg-indigo-500 border border-indigo-400/20 text-white px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-0 transition-all">跟注 ${heroCallAmount}</button>
              <button onClick={() => setShowRaiseModal(true)} className="bg-yellow-600/40 hover:bg-yellow-500 border border-yellow-400/20 text-white px-8 py-2 rounded-xl text-xs font-bold transition-all">加注</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
