
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
import { Trophy, RotateCcw, Share2, History, Radio, Cpu, UserPlus, Home, Users } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [inLobby, setInLobby] = useState(true);
  const [isJoining, setIsJoining] = useState(false); // 是否是通过链接加入
  const [aiDealerVoice, setAiDealerVoice] = useState("欢迎来到德州扑克俱乐部。");
  const [isLoading, setIsLoading] = useState(false);
  const [winners, setWinners] = useState<{player: Player, hand: HandResult}[]>([]);
  const [showInviteTooltip, setShowInviteTooltip] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  
  const npcTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.startsWith('room-')) {
      setIsJoining(true);
      realtime.init(hash, (remoteState) => {
        setGameState(remoteState);
        if (remoteState.players.some(p => p.name === userName)) {
          setInLobby(false);
        }
      });
      setAiDealerVoice("正在加入好友的房间...");
    }
  }, [userName]);

  const syncState = (state: GameState) => {
    setGameState(state);
    realtime.broadcast(state);
  };

  const createRoom = () => {
    const code = 'room-' + Math.random().toString(36).substring(7).toUpperCase();
    window.location.hash = code;
    return code;
  };

  const backToLobby = () => {
    window.location.hash = '';
    setInLobby(true);
    setIsJoining(false);
    setGameState(null);
    setWinners([]);
    if (npcTimerRef.current) window.clearTimeout(npcTimerRef.current);
  };

  // 处理好友通过链接加入
  const handleJoinFriend = () => {
    if (!userName || !gameState) return;
    
    const updatedPlayers = [...gameState.players];
    // 如果第二个位置是空的或者占位符，替换它
    if (updatedPlayers.length > 1 && (updatedPlayers[1].name === '等待好友...' || updatedPlayers[1].id === 'waiting')) {
      updatedPlayers[1] = {
        ...updatedPlayers[1],
        id: 'p2-' + Math.random().toString(36).substring(5),
        name: userName,
        isNpc: false,
        chips: INITIAL_CHIPS
      };
      const newState = { ...gameState, players: updatedPlayers };
      syncState(newState);
      setInLobby(false);
    }
  };

  const initGame = useCallback((mode: 'SINGLE' | 'MULTIPLAYER', isNextHand: boolean = false) => {
    if (!userName && !isNextHand) return;

    let players: Player[];
    const prevDealerIndex = gameState?.dealerIndex ?? -1;
    // 两人对战切换规则
    const playerCount = mode === 'SINGLE' ? 3 : 2;
    const nextDealerIndex = prevDealerIndex === -1 ? 0 : (prevDealerIndex + 1) % playerCount;
    
    // Heads-up 规则：庄家(D) 是小盲，另一个是大盲
    const nextSBIndex = nextDealerIndex;
    const nextBBIndex = (nextDealerIndex + 1) % playerCount;
    
    let roomCode = '';
    if (mode === 'MULTIPLAYER') {
      roomCode = window.location.hash.replace('#', '') || createRoom();
      realtime.init(roomCode, (remoteState) => {
        setGameState(remoteState);
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
          { id: 'p1', name: userName || '玩家', chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 0, isSmallBlind: nextSBIndex === 0, isBigBlind: nextBBIndex === 0, hasActed: false, isNpc: false, isHost: true },
          { id: 'p2', name: '王小明 (AI)', chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 1, isSmallBlind: nextSBIndex === 1, isBigBlind: nextBBIndex === 1, hasActed: false, isNpc: true },
          { id: 'p3', name: '李雷 (AI)', chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 2, isSmallBlind: nextSBIndex === 2, isBigBlind: nextBBIndex === 2, hasActed: false, isNpc: true, isHost: false },
        ];
      } else {
        // 多人房初始化：Host + 占位
        players = [
          { id: 'p1', name: userName, chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 0, isSmallBlind: nextSBIndex === 0, isBigBlind: nextBBIndex === 0, hasActed: false, isNpc: false, isHost: true },
          { id: 'waiting', name: '等待好友...', chips: INITIAL_CHIPS, bet: 0, cards: [], isFolded: false, isAllIn: false, isDealer: nextDealerIndex === 1, isSmallBlind: nextSBIndex === 1, isBigBlind: nextBBIndex === 1, hasActed: false, isNpc: false }
        ];
      }
    }

    const deck = createDeck();
    players.forEach(p => {
      p.cards = [deck.pop()!, deck.pop()!];
    });

    players[nextSBIndex].chips -= SMALL_BLIND;
    players[nextSBIndex].bet = SMALL_BLIND;
    players[nextBBIndex].chips -= BIG_BLIND;
    players[nextBBIndex].bet = BIG_BLIND;

    const handNum = (gameState?.handCounter || 0) + 1;
    const newState: GameState = {
      roomCode,
      stage: 'PREFLOP',
      pot: SMALL_BLIND + BIG_BLIND,
      communityCards: [],
      players: players,
      // Heads-up: Preflop 庄家(SB) 先行动
      currentPlayerIndex: nextSBIndex,
      dealerIndex: nextDealerIndex,
      deck: deck,
      minBet: BIG_BLIND,
      currentBet: BIG_BLIND,
      lastRaiseAmount: BIG_BLIND,
      handHistory: gameState?.handHistory || [],
      handCounter: handNum
    };

    if (mode === 'MULTIPLAYER') syncState(newState); else setGameState(newState);
    
    setInLobby(false);
    setWinners([]);
    setAiDealerVoice(mode === 'SINGLE' ? "单机模式：已为你安排两位对手。" : "对局已创建，请点击左上角分享链接给好友。");
  }, [userName, gameState]);

  const settleGame = async (state: GameState) => {
    const activePlayers = state.players.filter(p => !p.isFolded);
    const results = activePlayers.map(p => ({
      player: p,
      hand: evaluateHand(p.cards, state.communityCards)
    }));

    const maxScore = Math.max(...results.map(r => r.hand.score));
    const currentWinners = results.filter(r => r.hand.score === maxScore);
    
    setWinners(currentWinners);

    const winAmount = Math.floor(state.pot / currentWinners.length);
    const winnerNames = currentWinners.map(w => w.player.name).join(', ');
    const winnerHand = currentWinners[0].hand.label;
    
    const logContent = `[结算] 赢家: ${winnerNames}\n牌型: ${winnerHand}\n奖池: $${state.pot}`;
    const newEntry: GameLogEntry = { handNumber: state.handCounter, content: logContent, timestamp: Date.now() };

    const updatedPlayers = state.players.map(p => {
      const winner = currentWinners.find(w => w.player.id === p.id);
      if (winner) return { ...p, chips: p.chips + winAmount, lastAction: '赢家!' };
      return p;
    });

    const finalState = { ...state, players: updatedPlayers, stage: 'SHOWDOWN' as GameStage, handHistory: [...state.handHistory, newEntry] };
    if (state.roomCode.startsWith('room-')) syncState(finalState); else setGameState(finalState);

    const commentary = await getDealerCommentary(finalState, `${winnerNames} 以 ${winnerHand} 获胜`);
    setAiDealerVoice(commentary);
  };

  const handleAction = async (action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount?: number) => {
    if (!gameState || gameState.stage === 'SHOWDOWN') return;
    
    setIsLoading(true);
    const updatedPlayers = [...gameState.players];
    const currentPlayer = updatedPlayers[gameState.currentPlayerIndex];
    let betInThisAction = 0;
    let raiseBy = 0;

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
      raiseBy = amount - gameState.currentBet;
      currentPlayer.chips -= betInThisAction;
      currentPlayer.bet = amount;
      currentPlayer.lastAction = amount >= (currentPlayer.chips + betInThisAction) ? '全押!' : `加注至 $${amount}`;
      setShowRaiseModal(false);
    }

    currentPlayer.hasActed = true;
    const nextPot = gameState.pot + betInThisAction;
    let nextCurrentBet = action === 'RAISE' ? amount! : gameState.currentBet;
    let nextLastRaise = action === 'RAISE' ? raiseBy : gameState.lastRaiseAmount;

    if (action === 'RAISE') {
      updatedPlayers.forEach((p, idx) => { if (idx !== gameState.currentPlayerIndex) p.hasActed = false; });
    }

    let nextIndex = (gameState.currentPlayerIndex + 1) % updatedPlayers.length;
    while (updatedPlayers[nextIndex].isFolded && updatedPlayers.filter(p => !p.isFolded).length > 1) {
      nextIndex = (nextIndex + 1) % updatedPlayers.length;
    }

    const activePlayers = updatedPlayers.filter(p => !p.isFolded);
    const everyoneMatched = activePlayers.every(p => p.bet === nextCurrentBet || p.chips === 0);
    const everyoneActed = activePlayers.every(p => p.hasActed);
    const roundDone = everyoneMatched && everyoneActed;

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.chips += nextPot;
      const finalState = { ...gameState, players: updatedPlayers, pot: 0, stage: 'SHOWDOWN' as GameStage };
      if (gameState.roomCode.startsWith('room-')) syncState(finalState); else setGameState(finalState);
      setWinners([{ player: winner, hand: { score: 0, label: '独赢', handName: 'Win', winningCards: [] } }]);
      setIsLoading(false);
      return;
    }

    let nextStage = gameState.stage;
    let nextCommunity = [...gameState.communityCards];
    let nextDeck = [...gameState.deck];

    if (roundDone) {
      if (nextStage === 'PREFLOP') { nextStage = 'FLOP'; nextCommunity = [nextDeck.pop()!, nextDeck.pop()!, nextDeck.pop()!]; }
      else if (nextStage === 'FLOP') { nextStage = 'TURN'; nextCommunity.push(nextDeck.pop()!); }
      else if (nextStage === 'TURN') { nextStage = 'RIVER'; nextCommunity.push(nextDeck.pop()!); }
      else if (nextStage === 'RIVER') { nextStage = 'SHOWDOWN'; }
      
      updatedPlayers.forEach(p => { p.bet = 0; p.hasActed = false; p.lastAction = undefined; });
      nextCurrentBet = 0;
      nextLastRaise = BIG_BLIND;
      // Heads-up: Post-flop BB(非Dealer) 先行动
      nextIndex = (gameState.dealerIndex + 1) % updatedPlayers.length;
      while (updatedPlayers[nextIndex].isFolded) { nextIndex = (nextIndex + 1) % updatedPlayers.length; }
    }

    const nextState: GameState = { ...gameState, players: updatedPlayers, currentPlayerIndex: nextIndex, pot: nextPot, stage: nextStage, communityCards: nextCommunity, deck: nextDeck, currentBet: nextCurrentBet, lastRaiseAmount: nextLastRaise };

    if (nextStage === 'SHOWDOWN') { await settleGame(nextState); }
    else { if (gameState.roomCode.startsWith('room-')) syncState(nextState); else setGameState(nextState); }
    setIsLoading(false);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowInviteTooltip(true);
    setTimeout(() => setShowInviteTooltip(false), 2000);
  };

  const hero = gameState?.players.find(p => p.name === userName);
  const heroIndex = gameState?.players.findIndex(p => p.name === userName) ?? 0;
  const heroCallAmount = gameState ? gameState.currentBet - (hero?.bet || 0) : 0;
  const minRaise = gameState ? Math.max(gameState.currentBet + gameState.lastRaiseAmount, BIG_BLIND) : BIG_BLIND;
  const maxRaise = hero ? hero.chips + hero.bet : 0;

  useEffect(() => {
    if (gameState && gameState.stage !== 'SHOWDOWN' && gameState.currentPlayerIndex !== heroIndex) {
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
  }, [gameState?.currentPlayerIndex, gameState?.stage, heroIndex]);

  if (inLobby || !gameState) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans">
        <div className="max-w-2xl w-full flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-yellow-900/40">
            <Trophy className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">
            {isJoining ? '加入房间' : 'Gemini Poker Club'}
          </h1>
          <p className="text-neutral-500 text-sm mb-12 uppercase tracking-[0.3em]">
            {isJoining ? '你的好友正在牌桌等你' : '私人定制对局空间'}
          </p>
          
          <div className="w-full max-w-sm space-y-10">
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="输入你的昵称..." 
                value={userName} 
                onChange={(e) => setUserName(e.target.value)} 
                className="w-full bg-neutral-900 border border-white/5 rounded-2xl px-6 py-5 text-white font-bold text-center focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder:text-neutral-700" 
              />
            </div>
            
            {isJoining ? (
              <button 
                onClick={handleJoinFriend} 
                disabled={!userName} 
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-30 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all"
              >
                <Users size={20} />
                进入好友牌桌
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => initGame('SINGLE')} disabled={!userName} className="bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-3xl p-6 transition-all flex flex-col items-center gap-2">
                   <Cpu className="text-indigo-400" />
                   <span className="text-white font-bold text-xs">单机模式</span>
                 </button>
                 <button onClick={() => initGame('MULTIPLAYER')} disabled={!userName} className="bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-3xl p-6 transition-all flex flex-col items-center gap-2">
                   <UserPlus className="text-yellow-400" />
                   <span className="text-white font-bold text-xs">创建好友房</span>
                 </button>
              </div>
            )}
            
            {isJoining && (
              <button onClick={backToLobby} className="w-full text-neutral-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
                返回创建房间
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isShowdown = gameState.stage === 'SHOWDOWN';

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center pb-64 relative overflow-hidden font-sans select-none">
      
      {/* 顶部播报 */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ${isShowdown ? 'w-[600px]' : 'w-[400px]'}`}>
        <div className={`
          flex items-center gap-4 px-6 py-3 rounded-full border shadow-2xl transition-colors
          ${isShowdown ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-black/60 border-white/10'}
        `}>
          <div className="flex items-center gap-2 shrink-0">
            <Radio size={14} className={isShowdown ? "text-yellow-500" : "text-yellow-500 animate-pulse"} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isShowdown ? 'text-yellow-500' : 'text-neutral-500'}`}>
              {isShowdown ? '本局结果' : 'Gemini 荷官'}
            </span>
          </div>
          <div className={`text-xs truncate transition-all ${isShowdown ? 'text-white font-bold' : 'text-neutral-300'}`}>
            {isShowdown && winners.length > 0 ? (
              <span className="flex items-center gap-2">
                <Trophy size={14} className="text-yellow-500" />
                {winners[0].player.name} 以 <span className="text-yellow-400">{winners[0].hand.label}</span> 赢得 <span className="text-emerald-400">${gameState.pot}</span>
              </span>
            ) : aiDealerVoice}
          </div>
        </div>
      </div>

      {/* 侧边功能 */}
      <div className="fixed top-6 left-6 flex flex-col gap-3 z-50">
        <button onClick={backToLobby} className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl text-neutral-400 hover:text-white transition-all flex items-center gap-2 group">
          <Home size={14} />
          <span className="text-[10px] font-black uppercase">返回主页</span>
        </button>
        <div className={`px-4 py-2 rounded-xl flex items-center gap-2 border bg-black/40 transition-colors ${gameState.roomCode === 'LOCAL-PRACTICE' ? 'border-indigo-500/20 text-indigo-400' : 'border-emerald-500/20 text-emerald-500'}`}>
           {gameState.roomCode === 'LOCAL-PRACTICE' ? <Cpu size={14} /> : <Radio size={14} className="animate-pulse" />}
           <span className="text-[10px] font-black uppercase">{gameState.roomCode === 'LOCAL-PRACTICE' ? '单机练习' : '在线房: ' + gameState.roomCode.split('-')[1]}</span>
        </div>
        {gameState.roomCode.startsWith('room-') && (
          <button onClick={copyInviteLink} className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl text-neutral-400 hover:text-white transition-all flex items-center gap-2 group">
            <Share2 size={14} />
            <span className="text-[10px] font-black uppercase">{showInviteTooltip ? '链接已复制' : '分享房间'}</span>
          </button>
        )}
      </div>

      <div className="fixed top-6 right-6 flex flex-col gap-3 z-50">
        <button onClick={() => setIsLogOpen(true)} className="w-10 h-10 bg-black/40 border border-white/10 rounded-xl text-neutral-400 hover:text-white flex items-center justify-center transition-all">
          <History size={18} />
        </button>
        {isShowdown && (
          <button 
            onClick={() => initGame(gameState.roomCode === 'LOCAL-PRACTICE' ? 'SINGLE' : 'MULTIPLAYER', true)} 
            className="flex items-center gap-2 bg-yellow-600 border border-yellow-400 px-4 py-2 rounded-xl text-white shadow-lg animate-bounce transition-all hover:bg-yellow-500"
          >
            <RotateCcw size={16} />
            <span className="text-xs font-bold">下一局</span>
          </button>
        )}
      </div>

      <GameLog logs={gameState?.handHistory || []} isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} />
      {showRaiseModal && <RaiseModal minRaise={minRaise} maxRaise={maxRaise} currentPot={gameState?.pot || 0} currentBet={gameState?.currentBet || 0} playerBet={hero?.bet || 0} onConfirm={(val) => handleAction('RAISE', val)} onCancel={() => setShowRaiseModal(false)} />}

      {/* 牌桌主体 */}
      <div className="relative flex items-center justify-center w-full">
        <div className="relative w-[1100px] h-[600px] poker-felt border-[20px] border-[#2a1b10] rounded-[300px] flex items-center justify-center shadow-[0_0_120px_rgba(0,0,0,0.9)_inset]">
          
          {/* 座位布局 - 针对2人和3人动态调整 */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            {gameState?.players.map((p, i) => {
              // 2人对战使用 90和270度（上下对坐），3人使用原始布局
              let angles = [90, 270];
              if (gameState.players.length === 3) {
                angles = [90, 210, 330];
              }
              const angle = angles[i] * (Math.PI / 180);
              const xRadius = 42; 
              const yRadius = 37;
              return (
                <div key={p.id} style={{ top: `${50 + yRadius * Math.sin(angle)}%`, left: `${50 + xRadius * Math.cos(angle)}%`, transform: 'translate(-50%, -50%)' }} className="absolute pointer-events-auto">
                  <PlayerSeat player={p} isCurrent={gameState.currentPlayerIndex === i} isHero={p.name === userName} showCards={isShowdown} winningCards={winners[0]?.hand.winningCards} />
                </div>
              );
            })}
          </div>

          {/* 牌桌中心区域 */}
          <div className="flex flex-col items-center gap-10 z-10">
            <div className="flex flex-col items-center bg-black/40 px-8 py-3 rounded-full border border-white/5 shadow-2xl">
              <span className="text-yellow-500/40 font-black tracking-[0.3em] uppercase text-[8px] mb-1">Total Pot</span>
              <div className="text-3xl text-white font-mono font-black tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                ${gameState?.pot}
              </div>
            </div>
            
            <div className="flex gap-6">
              {gameState?.communityCards.map((c, i) => (
                <CardUI key={i} card={c} highlight={winners[0]?.hand.winningCards.some(wc => wc.rank === c.rank && wc.suit === c.suit)} />
              ))}
              {Array.from({ length: 5 - (gameState?.communityCards.length || 0) }).map((_, i) => (
                <div key={i} className="w-20 h-28 bg-white/5 border border-white/5 rounded-xl opacity-20"></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 底部控制台 */}
      <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center z-[80] pointer-events-none">
        <div className={`max-w-5xl w-full bg-neutral-900/30 border border-white/10 rounded-[32px] p-4 shadow-2xl transition-all duration-700 pointer-events-auto ${gameState?.currentPlayerIndex === heroIndex && !isShowdown ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-95 pointer-events-none'}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-start px-2 shrink-0">
                <p className="text-[9px] text-neutral-500 font-black uppercase mb-0.5 tracking-widest">我的筹码</p>
                <p className="text-emerald-400 font-mono text-2xl font-bold">${hero?.chips}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAction('FOLD')} 
                  className="bg-neutral-800 border border-white/10 text-neutral-300 hover:text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg active:scale-95"
                >
                  弃牌
                </button>
                <button 
                  onClick={() => handleAction('CHECK')} 
                  disabled={heroCallAmount > 0} 
                  className="bg-neutral-800 border border-white/10 text-white font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-30 transition-all shadow-lg active:scale-95"
                >
                  过牌
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => handleAction('CALL')} 
                disabled={heroCallAmount === 0} 
                className="bg-indigo-600/30 hover:bg-indigo-500/60 border border-indigo-400/30 text-white font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-10 shadow-lg transition-all"
              >
                跟注 ${heroCallAmount}
              </button>
              <button 
                onClick={() => setShowRaiseModal(true)} 
                className="bg-yellow-600/30 hover:bg-yellow-500/60 border border-yellow-400/30 text-white font-bold px-10 py-2.5 rounded-xl text-sm shadow-2xl shadow-yellow-900/20 transition-all active:scale-95"
              >
                加注
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
