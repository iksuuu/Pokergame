
import { Card, Rank, Suit } from '../types';
import { SUITS, RANKS } from '../constants.tsx';

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return shuffle(deck);
};

const shuffle = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

const rankToValue = (rank: Rank): number => {
  const values: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return values[rank];
};

export interface HandResult {
  score: number;
  label: string;
  handName: string;
  winningCards: Card[];
}

/**
 * 辅助函数：将 5 张牌转换为唯一的权重得分，解决踢脚牌问题
 * 使用 16 进制权重思想：第一张牌权重最高，以此类推。
 * 确保 A-A-K 大于 A-A-Q。
 */
const getWeightScore = (base: number, cards: Card[]): number => {
  return cards.reduce((acc, card, index) => {
    return acc + rankToValue(card.rank) * Math.pow(16, 4 - index);
  }, base);
};

export const evaluateHand = (holeCards: Card[], communityCards: Card[]): HandResult => {
  const allCards = [...holeCards, ...communityCards];
  const sorted = [...allCards].sort((a, b) => rankToValue(b.rank) - rankToValue(a.rank));

  // 1. 同花检查
  const suits: Record<string, Card[]> = {};
  allCards.forEach(c => {
    if (!suits[c.suit]) suits[c.suit] = [];
    suits[c.suit].push(c);
  });
  const flushSuit = Object.keys(suits).find(s => suits[s].length >= 5);
  const flushCardsFull = flushSuit ? suits[flushSuit].sort((a, b) => rankToValue(b.rank) - rankToValue(a.rank)) : null;

  // 2. 顺子检查辅助函数 (支持常规顺子和 A-5 Wheel)
  const getStraight = (cards: Card[]): Card[] | null => {
    const unique = cards.filter((c, i, self) => i === self.findIndex(t => t.rank === c.rank));
    if (unique.length < 5) return null;
    
    // 常规顺子
    for (let i = 0; i <= unique.length - 5; i++) {
      if (rankToValue(unique[i].rank) - rankToValue(unique[i + 4].rank) === 4) {
        return unique.slice(i, i + 5);
      }
    }
    // A-5 顺子 (Wheel)
    const wheelRanks: Rank[] = ['A', '5', '4', '3', '2'];
    if (wheelRanks.every(r => unique.some(c => c.rank === r))) {
      // 返回时将 5 排在第一位作为权重计算的基础，A 在最后 (在 Wheel 中 A 作为 1 使用)
      const wheelCards = ['5', '4', '3', '2', 'A'].map(r => unique.find(c => c.rank === r)!);
      return wheelCards;
    }
    return null;
  };

  // 3. 同花顺判定
  if (flushCardsFull) {
    const sfCards = getStraight(flushCardsFull);
    if (sfCards) {
      return { 
        score: getWeightScore(9000000, sfCards), 
        label: '同花顺', 
        handName: 'Straight Flush', 
        winningCards: sfCards 
      };
    }
  }

  // 4. 计数分配 (四条, 葫芦, 三条, 对子)
  const counts: Record<string, Card[]> = {};
  allCards.forEach(c => {
    if (!counts[c.rank]) counts[c.rank] = [];
    counts[c.rank].push(c);
  });
  // 先按数量排，数量相同按点数排
  const sortedCounts = Object.values(counts).sort((a, b) => b.length - a.length || rankToValue(b[0].rank) - rankToValue(a[0].rank));

  // 四条
  if (sortedCounts[0].length === 4) {
    const kicker = sorted.find(c => c.rank !== sortedCounts[0][0].rank)!;
    const finalCards = [...sortedCounts[0], kicker];
    return { score: getWeightScore(8000000, finalCards), label: '四条', handName: 'Four of a Kind', winningCards: finalCards };
  }

  // 葫芦
  if (sortedCounts[0].length === 3 && sortedCounts[1].length >= 2) {
    const finalCards = [...sortedCounts[0], ...sortedCounts[1].slice(0, 2)];
    return { score: getWeightScore(7000000, finalCards), label: '葫芦', handName: 'Full House', winningCards: finalCards };
  }

  // 同花
  if (flushCardsFull) {
    const finalCards = flushCardsFull.slice(0, 5);
    return { score: getWeightScore(6000000, finalCards), label: '同花', handName: 'Flush', winningCards: finalCards };
  }

  // 顺子
  const straightCards = getStraight(sorted);
  if (straightCards) {
    return { score: getWeightScore(5000000, straightCards), label: '顺子', handName: 'Straight', winningCards: straightCards };
  }

  // 三条
  if (sortedCounts[0].length === 3) {
    const kickers = sorted.filter(c => c.rank !== sortedCounts[0][0].rank).slice(0, 2);
    const finalCards = [...sortedCounts[0], ...kickers];
    return { score: getWeightScore(4000000, finalCards), label: '三条', handName: 'Three of a Kind', winningCards: finalCards };
  }

  // 两对
  if (sortedCounts[0].length === 2 && sortedCounts[1].length === 2) {
    const kicker = sorted.find(c => c.rank !== sortedCounts[0][0].rank && c.rank !== sortedCounts[1][0].rank)!;
    const finalCards = [...sortedCounts[0], ...sortedCounts[1], kicker];
    return { score: getWeightScore(3000000, finalCards), label: '两对', handName: 'Two Pair', winningCards: finalCards };
  }

  // 对子
  if (sortedCounts[0].length === 2) {
    const kickers = sorted.filter(c => c.rank !== sortedCounts[0][0].rank).slice(0, 3);
    const finalCards = [...sortedCounts[0], ...kickers];
    return { score: getWeightScore(2000000, finalCards), label: '对子', handName: 'One Pair', winningCards: finalCards };
  }

  // 高牌
  const highCards = sorted.slice(0, 5);
  return { score: getWeightScore(1000000, highCards), label: '高牌', handName: 'High Card', winningCards: highCards };
};
