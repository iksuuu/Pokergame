
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Card, GameStage, GameLogEntry } from './types';
import { INITIAL_CHIPS, SMALL_BLIND, BIG_BLIND } from './constants.tsx';
import { createDeck, evaluateHand, HandResult } from './services/pokerLogic';
import { getDealerCommentary } from './services/geminiService';
import { realtime } from './services/realtimeService';
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
  const [winners, setWinners] = useState<{player: Player, hand: HandResult}[]>([]);
  const [showInviteTooltip, setShowInviteTooltip] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  
  const npcTimerRef = useRef<number | null>(null);
  const isHostRef = useRef(false);

  // 初始化实时监听
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.startsWith('room-')) {
      setIsJoining(true);
      realtime.init(hash, (remoteData) => {
        // 处理云端传来的各种指令
        if (remoteData.type === 'JOIN_REQUEST') {
          // 房主收到加入请求，同步当前状态
          if (isHostRef.current && gameState) {
            realtime.broadcast({ type: 'SYNC_STATE', state: gameState });
          }
        } else if (remoteData.type === 'SYNC_STATE') {
          // 加入者收到房主的同步状态
          const remoteState = remoteData.state as GameState;
          setGameState(remoteState);
          if (remoteState.players.some(p => p.name === userName && userName !== '')) {
            setInLobby(false);
          }
        } else if (!remoteData.type) {
          // 标准游戏状态更新
          setGameState(remoteData);
          if (remoteData.players.some(p => p.name === userName && userName !== '')) {
            setInLobby(false);
          }
        }
      });
      setAiDealerVoice("检测到邀请链接，准备加入...");
    }
  }, [userName, gameState]);

  const syncState = (state: GameState) => {
    setGameState(state);
    realtime.broadcast(state);
  };

  const createRoom = () => {
    const code = 'room-' + Math.random().toString(36).substring(7).toUpperCase();
    window.location.hash = code;
    isHostRef.current = true;
    return code;
  };

  const backToLobby = () => {
    window.location.hash = '';
    isHostRef.current = false;
    setInLobby(true);
    setIsJoining(false);
    setGameState(null);
    setWinners([]);
    realtime.close();
  };

  // 好友通过链接加入
  const handleJoinFriend = () => {
    if (!userName) return;
    setIsLoading(true);
    // 向房主发送加入请求
    realtime.broadcast({ type: 'JOIN_REQUEST', from: userName });
    
    // 设置一个超时提醒
    setTimeout(() => {
      if (inLobby) {
        setIsLoading(false);
        setAiDealerVoice("房主尚未响应，请重试或检查链接。");
      }
    }, 5000);
  };

  const initGame = useCallback((mode: 'SINGLE' | 'MULTIPLAYER', isNextHand: boolean = false) => {
    if (!userName && !isNextHand) return;

    let players: Player[];
    const prevDealerIndex = gameState?.dealerIndex ?? -1;
    const playerCount = mode === 'SINGLE' ? 3 : 2;
    const nextDealerIndex = prevDealerIndex === -1 ? 0 : (prevDealerIndex + 1) % playerCount;
    
    // Heads-up: 庄家是 SB
    const nextSBIndex = playerCount === 2 ? nextDealerIndex : (nextDealerIndex + 1) % playerCount;
    const nextBBIndex = playerCount === 2 ? (nextDealerIndex + 1) % playerCount : (nextDealerIndex + 2) % playerCount;
    
    let roomCode = '';
    if (mode === 'MULTIPLAYER') {
      roomCode = window.location.hash.replace('#', '') || createRoom();
      realtime.init(roomCode, (remoteData) => {
         // (这里的逻辑已在 useEffect 中统一处理)
      });
    } else {
      window.location.hash = ''; 
      roomCode = 'LOCAL-PRACTICE';
    }

    if (isNextHand && gameState) {
      players = gameState.players.map((p, i) => ({
        ...p,
        bet: 0,
        cards: [],
        isFolded: false,
        isAllIn: false,
        hasActed: false,
        isDealer: i === nextDealerIndex,
        isSmallBlind: i === nextSBIndex,
        isBigBlind: i === nextBBIndex,
        lastAction: undefined
      }));
    } else {
      if (mode === 'SINGLE') {
        players = [
          { id: 'p1', name: userName, chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 0, isSmallBlind: nextSBIndex === 0, isBigBlind: nextBBIndex === 0, hasActed: false, isNpc: false, isHost: true },
          { id: 'p2', name: 'AI 小王', chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 1, isSmallBlind: nextSBIndex === 1, isBigBlind: nextBBIndex === 1, hasActed: false, isNpc: true },
          { id: 'p3', name: 'AI 小李', chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 2, isSmallBlind: nextSBIndex === 2, isBigBlind: nextBBIndex === 2, hasActed: false, isNpc: true, isHost: false },
        ];
      } else {
        players = [
          { id: 'p1', name: userName, chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 0, isSmallBlind: nextSBIndex === 0, isBigBlind: nextBBIndex === 0, hasActed: false, isNpc: false, isHost: true },
          { id: 'waiting', name: '等待好友...', chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 1, isSmallBlind: nextSBIndex === 1, isBigBlind: nextBBIndex === 1, hasActed: false, isNpc: false }
        ];
      }
    }

    const deck = createDeck();
    players.forEach(p => {
      if (p.id !== 'waiting') p.cards = [deck.pop()!, deck.pop()!];
    });

    players[nextSBIndex].chips -= SMALL_BLIND;
    players[nextSBIndex].bet = SMALL_BLIND;
    players[nextBBIndex].chips -= BIG_BLIND;
    players[nextBBIndex].bet = BIG_BLIND;

    const newState: GameState = {
      roomCode,
      stage: 'PREFLOP',
      pot: SMALL_BLIND + BIG_BLIND,
      communityCards: [],
      players: players,
      currentPlayerIndex: playerCount === 2 ? nextSBIndex : (nextBBIndex + 1) % playerCount,
      dealerIndex: nextDealerIndex,
      deck: deck,
      minBet: BIG_BLIND,
      currentBet: BIG_BLIND,
      lastRaiseAmount: BIG_BLIND,
      handHistory: gameState?.handHistory || [],
      handCounter: (gameState?.handCounter || 0) + 1
    };

    if (mode === 'MULTIPLAYER') syncState(newState); else setGameState(newState);
    setInLobby(false);
    setWinners([]);
    setAiDealerVoice(mode === 'SINGLE' ? "单机练习开始。" : "在线房已创建，等待好友中...");
  }, [userName, gameState]);

  const settleGame = async (state: GameState) => {
    const activePlayers = state.players.filter(p => !p.isFolded && p.id !== 'waiting');
    const results = activePlayers.map(p => ({
      player: p,
      hand: evaluateHand(p.cards, state.communityCards)
    }));

    const maxScore = Math.max(...results.map(r => r.hand.score));
    const currentWinners = results.filter(r => r.hand.score === maxScore);
    setWinners(currentWinners);

    const winAmount = Math.floor(state.pot / currentWinners.length);
    const updatedPlayers = state.players.map(p => {
      const winner = currentWinners.find(w => w.player.id === p.id);
      if (winner) return { ...p, chips: p.chips + winAmount, lastAction: '赢家!' };
      return p;
    });

    // Fix: Explicitly set the stage to 'SHOWDOWN' and ensure the object satisfies GameState interface.
    const finalState: GameState = { ...state, players: updatedPlayers, stage: 'SHOWDOWN' };
    if (state.roomCode.startsWith('room-')) syncState(finalState); else setGameState(finalState);

    // 生成详细的胜利广播
    const winnerDetails = currentWinners.map(w => `${w.player.name} (${w.hand.label})`).join(', ');
    const commentary = await getDealerCommentary(finalState, `${winnerDetails} 赢得了本局`);
    setAiDealerVoice(commentary);
  };

  const handleAction = async (action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount?: number) => {
    // Fix: This comparison is now safe because 'SHOWDOWN' is a valid member of GameStage.
    if (!gameState || gameState.stage === 'SHOWDOWN') return;
    
    const updatedPlayers = [...gameState.players];
    const currentPlayer = updatedPlayers[gameState.currentPlayerIndex];
    let betInThisAction = 0;

    if (action === 'CALL') {
      betInThisAction = Math.min(currentPlayer.chips, gameState.currentBet - currentPlayer.bet);
      currentPlayer.chips -= betInThisAction;
      currentPlayer.bet += betInThisAction;
      currentPlayer.lastAction = '跟注';
    } else if (action === 'FOLD') {
      currentPlayer.isFolded = true;
      currentPlayer.lastAction = '弃牌';
    } else if (action === 'CHECK') {
      currentPlayer.lastAction = '过牌';
    } else if (action === 'RAISE' && amount) {
      betInThisAction = amount - currentPlayer.bet;
      currentPlayer.chips -= betInThisAction;
      currentPlayer.bet = amount;
      currentPlayer.lastAction = `加注至 $${amount}`;
      setShowRaiseModal(false);
    }

    currentPlayer.hasActed = true;
    const nextPot = gameState.pot + betInThisAction;
    let nextCurrentBet = action === 'RAISE' ? amount! : gameState.currentBet;
    let nextLastRaise = action === 'RAISE' ? (amount! - gameState.currentBet) : gameState.lastRaiseAmount;

    if (action === 'RAISE') {
      updatedPlayers.forEach((p, idx) => { if (idx !== gameState.currentPlayerIndex) p.hasActed = false; });
    }

    let nextIndex = (gameState.currentPlayerIndex + 1) % updatedPlayers.length;
    while (updatedPlayers[nextIndex].isFolded && updatedPlayers.filter(p => !p.isFolded).length > 1) {
      nextIndex = (nextIndex + 1) % updatedPlayers.length;
    }

    const activePlayers = updatedPlayers.filter(p => !p.isFolded && p.id !== 'waiting');
    const everyoneMatched = activePlayers.every(p => p.bet === nextCurrentBet || p.chips === 0);
    const everyoneActed = activePlayers.every(p => p.hasActed);

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.chips += nextPot;
      // Fix: Ensure finalState correctly transitions to SHOWDOWN with GameState type enforcement.
      const finalState: GameState = { ...gameState, players: updatedPlayers, pot: 0, stage: 'SHOWDOWN' };
      if (gameState.roomCode.startsWith('room-')) syncState(finalState); else setGameState(finalState);
      
      const soloWinResult = { player: winner, hand: { score: 0, label: '独赢', handName: 'Win', winningCards: [] } };
      setWinners([soloWinResult]);
      
      const commentary = await getDealerCommentary(finalState, `${winner.name} 因对手弃牌独赢本局`);
      setAiDealerVoice(commentary);
      return;
    }

    // Fix: Explicitly type nextStage as GameStage to allow 'SHOWDOWN' assignment.
    let nextStage: GameStage = gameState.stage;
    let nextCommunity = [...gameState.communityCards];
    let nextDeck = [...gameState.deck];

    if (everyoneMatched && everyoneActed) {
      if (nextStage === 'PREFLOP') { nextStage = 'FLOP'; nextCommunity = [nextDeck.pop()!, nextDeck.pop()!, nextDeck.pop()!]; }
      else if (nextStage === 'FLOP') { nextStage = 'TURN'; nextCommunity.push(nextDeck.pop()!); }
      else if (nextStage === 'TURN') { nextStage = 'RIVER'; nextCommunity.push(nextDeck.pop()!); }
      else if (nextStage === 'RIVER') { nextStage = 'SHOWDOWN'; }
      
      updatedPlayers.forEach(p => { p.bet = 0; p.hasActed = false; p.lastAction = undefined; });
      nextCurrentBet = 0;
      nextLastRaise = BIG_BLIND;
      nextIndex = (gameState.dealerIndex + 1) % updatedPlayers.length;
      while (updatedPlayers[nextIndex].isFolded) { nextIndex = (nextIndex + 1) % updatedPlayers.length; }
    }

    const nextState: GameState = { ...gameState, players: updatedPlayers, currentPlayerIndex: nextIndex, pot: nextPot, stage: nextStage, communityCards: nextCommunity, deck: nextDeck, currentBet: nextCurrentBet, lastRaiseAmount: nextLastRaise };

    if (nextStage === 'SHOWDOWN') { await settleGame(nextState); }
    else { if (gameState.roomCode.startsWith('room-')) syncState(nextState); else setGameState(nextState); }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowInviteTooltip(true);
    setTimeout(() => setShowInviteTooltip(false), 2000);
  };

  const heroIndex = gameState?.players.findIndex(p => p.name === userName) ?? -1;
  const isHeroTurn = heroIndex !== -1 && gameState?.currentPlayerIndex === heroIndex;
  const hero = heroIndex !== -1 ? gameState?.players[heroIndex] : null;

  useEffect(() => {
    if (gameState && gameState.stage !== 'SHOWDOWN' && gameState.currentPlayerIndex !== -1) {
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
  }, [gameState?.currentPlayerIndex, gameState?.stage, isHeroTurn]);

  if (inLobby || !gameState) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
            <Trophy className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">
            {isJoining ? '正在进入' : 'Gemini Poker Club'}
          </h1>
          <p className="text-neutral-500 text-xs mb-12 uppercase tracking-[0.3em] text-center">
            {isJoining ? '正在同步云端对局状态' : '私人定制 · 跨网对战'}
          </p>
          
          <div className="w-full space-y-6">
            <input 
              type="text" 
              placeholder="你的昵称..." 
              value={userName} 
              onChange={(e) => setUserName(e.target.value)} 
              className="w-full bg-neutral-900 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-center focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all" 
            />
            
            {isJoining ? (
              <button 
                onClick={handleJoinFriend} 
                disabled={!userName || isLoading} 
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-30 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
                {isLoading ? '正在连接房主...' : '确认加入'}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => initGame('SINGLE')} disabled={!userName} className="bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-3xl p-6 transition-all flex flex-col items-center gap-2">
                   <Cpu className="text-indigo-400" />
                   <span className="text-white font-bold text-xs">单机练习</span>
                 </button>
                 <button onClick={() => initGame('MULTIPLAYER')} disabled={!userName} className="bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-3xl p-6 transition-all flex flex-col items-center gap-2">
                   <UserPlus className="text-yellow-400" />
                   <span className="text-white font-bold text-xs">创建好友房</span>
                 </button>
              </div>
            )}
            
            {isJoining && (
              <button onClick={backToLobby} className="w-full text-neutral-600 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
                放弃并创建新对局
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isShowdown = gameState.stage === 'SHOWDOWN';
  const heroCallAmount = gameState.currentBet - (hero?.bet || 0);

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center pb-48 relative overflow-hidden font-sans select-none">
      
      {/* 顶部状态 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 w-[400px]">
        <div className={`flex items-center gap-4 px-6 py-3 rounded-full border shadow-2xl bg-black/60 border-white/10 ${isShowdown ? 'border-yellow-500/30' : ''}`}>
          <Radio size={14} className="text-yellow-500 animate-pulse" />
          <div className="text-xs truncate text-neutral-200">
            {isShowdown && winners.length > 0 
              ? `${winners.map(w => `${w.player.name} (${w.hand.label})`).join(', ')} 获胜!` 
              : aiDealerVoice}
          </div>
        </div>
      </div>

      {/* 侧边功能 */}
      <div className="fixed top-6 left-6 flex flex-col gap-3 z-50">
        <button onClick={backToLobby} className="bg-black/40 border border-white/10 px-3 py-2 rounded-xl text-neutral-400 hover:text-white transition-all flex items-center gap-2">
          <Home size={14} />
          <span className="text-[10px] font-black uppercase">主页</span>
        </button>
        {gameState.roomCode.startsWith('room-') && (
          <button onClick={copyInviteLink} className="bg-black/40 border border-white/10 px-3 py-2 rounded-xl text-neutral-400 hover:text-white transition-all flex items-center gap-2">
            <Share2 size={14} />
            <span className="text-[10px] font-black uppercase">{showInviteTooltip ? '链接已复制' : '分享房间'}</span>
          </button>
        )}
      </div>

      <div className="fixed top-6 right-6 flex flex-col gap-3 z-50">
        <button onClick={() => setIsLogOpen(true)} className="w-10 h-10 bg-black/40 border border-white/10 rounded-xl text-neutral-400 hover:text-white flex items-center justify-center"><History size={18} /></button>
        {isShowdown && (
          <button onClick={() => initGame(gameState.roomCode === 'LOCAL-PRACTICE' ? 'SINGLE' : 'MULTIPLAYER', true)} className="bg-yellow-600 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg animate-bounce flex items-center gap-2">
            <RotateCcw size={14} />下一局
          </button>
        )}
      </div>

      <GameLog logs={gameState.handHistory} isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} />
      {showRaiseModal && <RaiseModal minRaise={Math.max(gameState.currentBet + gameState.lastRaiseAmount, BIG_BLIND)} maxRaise={(hero?.chips || 0) + (hero?.bet || 0)} currentPot={gameState.pot} currentBet={gameState.currentBet} playerBet={hero?.bet || 0} onConfirm={(val) => handleAction('RAISE', val)} onCancel={() => setShowRaiseModal(false)} />}

      {/* 牌桌 */}
      <div className="relative w-[1100px] h-[580px] poker-felt border-[16px] border-[#2a1b10] rounded-[290px] flex items-center justify-center shadow-[0_0_100px_rgba(0,0,0,0.8)_inset]">
        <div className="absolute inset-0 pointer-events-none">
          {gameState.players.map((p, i) => {
            const is2P = gameState.players.length === 2;
            const angles = is2P ? [90, 270] : [90, 210, 330];
            const angle = angles[i] * (Math.PI / 180);
            return (
              <div key={p.id} style={{ top: `${50 + 36 * Math.sin(angle)}%`, left: `${50 + 42 * Math.cos(angle)}%`, transform: 'translate(-50%, -50%)' }} className="absolute pointer-events-auto">
                <PlayerSeat player={p} isCurrent={gameState.currentPlayerIndex === i} isHero={p.name === userName} showCards={isShowdown} winningCards={winners[0]?.hand.winningCards} />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-8 z-10">
          <div className="bg-black/30 px-6 py-2 rounded-full border border-white/5 text-center">
            <div className="text-[8px] text-neutral-500 uppercase font-black tracking-widest">Total Pot</div>
            <div className="text-2xl text-white font-mono font-black">${gameState.pot}</div>
          </div>
          <div className="flex gap-4">
            {gameState.communityCards.map((c, i) => (
              <CardUI key={i} card={c} highlight={winners[0]?.hand.winningCards.some(wc => wc.rank === c.rank && wc.suit === c.suit)} />
            ))}
            {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
              <div key={i} className="w-16 h-24 md:w-20 md:h-28 bg-white/5 border border-white/5 rounded-xl opacity-20"></div>
            ))}
          </div>
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
