
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Ensure 'SHOWDOWN' is included in the union to avoid type mismatch in the game logic.
export type GameStage = 'LOBBY' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export interface GameLogEntry {
  handNumber: number;
  content: string;
  timestamp: number;
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  bet: number;
  cards: Card[];
  isFolded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  hasActed: boolean;
  lastAction?: string;
  isNpc?: boolean;
  isHost?: boolean; // 房主，负责逻辑计算
}

export interface GameState {
  roomCode: string;
  stage: GameStage;
  pot: number;
  communityCards: Card[];
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  deck: Card[];
  minBet: number;
  currentBet: number;
  lastRaiseAmount: number; // 记录上一次加注的额度，用于计算最小加注
  handHistory: GameLogEntry[];
  handCounter: number;
}
