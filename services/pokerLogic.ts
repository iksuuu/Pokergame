
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

export const evaluateHand = (holeCards: Card[], communityCards: Card[]): HandResult => {
  const allCards = [...holeCards, ...communityCards];
  
  // 按点数降序排列
  const sorted = [...allCards].sort((a, b) => rankToValue(b.rank) - rankToValue(a.rank));

  // 同花检查
  const suits: Record<string, Card[]> = {};
  allCards.forEach(c => {
    if (!suits[c.suit]) suits[c.suit] = [];
    suits[c.suit].push(c);
  });
  const flushSuit = Object.keys(suits).find(s => suits[s].length >= 5);
  const flushCards = flushSuit ? suits[flushSuit].sort((a, b) => rankToValue(b.rank) - rankToValue(a.rank)).slice(0, 5) : null;

  // 顺子检查
  const uniqueSorted = sorted.filter((c, i, self) => i === self.findIndex(t => t.rank === c.rank));
  let straightCards: Card[] | null = null;
  for (let i = 0; i <= uniqueSorted.length - 5; i++) {
    if (rankToValue(uniqueSorted[i].rank) - rankToValue(uniqueSorted[i + 4].rank) === 4) {
      straightCards = uniqueSorted.slice(i, i + 5);
      break;
    }
  }
  // A-5 顺子
  if (!straightCards && [14, 5, 4, 3, 2].every(v => uniqueSorted.some(c => rankToValue(c.rank) === v))) {
    straightCards = [
      uniqueSorted.find(c => rankToValue(c.rank) === 14)!,
      uniqueSorted.find(c => rankToValue(c.rank) === 5)!,
      uniqueSorted.find(c => rankToValue(c.rank) === 4)!,
      uniqueSorted.find(c => rankToValue(c.rank) === 3)!,
      uniqueSorted.find(c => rankToValue(c.rank) === 2)!,
    ];
  }

  // 同花顺
  if (flushCards && straightCards) {
    // 检查是否有同花且成顺
    const flushSet = new Set(suits[flushSuit!]);
    let straightFlush: Card[] | null = null;
    const sortedFlush = suits[flushSuit!].sort((a, b) => rankToValue(b.rank) - rankToValue(a.rank));
    for (let i = 0; i <= sortedFlush.length - 5; i++) {
      if (rankToValue(sortedFlush[i].rank) - rankToValue(sortedFlush[i + 4].rank) === 4) {
        straightFlush = sortedFlush.slice(i, i + 5);
        break;
      }
    }
    if (straightFlush) return { score: 900000000 + rankToValue(straightFlush[0].rank), label: '同花顺', handName: 'Straight Flush', winningCards: straightFlush };
  }

  // 计数
  const counts: Record<string, Card[]> = {};
  allCards.forEach(c => {
    if (!counts[c.rank]) counts[c.rank] = [];
    counts[c.rank].push(c);
  });
  const sortedCounts = Object.values(counts).sort((a, b) => b.length - a.length || rankToValue(b[0].rank) - rankToValue(a[0].rank));

  // 四条
  if (sortedCounts[0].length === 4) {
    const kicker = sorted.find(c => c.rank !== sortedCounts[0][0].rank)!;
    return { score: 800000000 + rankToValue(sortedCounts[0][0].rank), label: '四条', handName: 'Four of a Kind', winningCards: [...sortedCounts[0], kicker] };
  }

  // 葫芦
  if (sortedCounts[0].length === 3 && sortedCounts[1].length >= 2) {
    return { score: 700000000 + rankToValue(sortedCounts[0][0].rank), label: '葫芦', handName: 'Full House', winningCards: [...sortedCounts[0], ...sortedCounts[1].slice(0, 2)] };
  }

  // 同花
  if (flushCards) return { score: 600000000 + rankToValue(flushCards[0].rank), label: '同花', handName: 'Flush', winningCards: flushCards };

  // 顺子
  if (straightCards) return { score: 500000000 + rankToValue(straightCards[0].rank), label: '顺子', handName: 'Straight', winningCards: straightCards };

  // 三条
  if (sortedCounts[0].length === 3) {
    const kickers = sorted.filter(c => c.rank !== sortedCounts[0][0].rank).slice(0, 2);
    return { score: 400000000 + rankToValue(sortedCounts[0][0].rank), label: '三条', handName: 'Three of a Kind', winningCards: [...sortedCounts[0], ...kickers] };
  }

  // 两对
  if (sortedCounts[0].length === 2 && sortedCounts[1].length === 2) {
    const kicker = sorted.find(c => c.rank !== sortedCounts[0][0].rank && c.rank !== sortedCounts[1][0].rank)!;
    return { score: 300000000 + rankToValue(sortedCounts[0][0].rank), label: '两对', handName: 'Two Pair', winningCards: [...sortedCounts[0], ...sortedCounts[1], kicker] };
  }

  // 对子
  if (sortedCounts[0].length === 2) {
    const kickers = sorted.filter(c => c.rank !== sortedCounts[0][0].rank).slice(0, 3);
    return { score: 200000000 + rankToValue(sortedCounts[0][0].rank), label: '对子', handName: 'One Pair', winningCards: [...sortedCounts[0], ...kickers] };
  }

  return { score: 100000000 + rankToValue(sorted[0].rank), label: '高牌', handName: 'High Card', winningCards: sorted.slice(0, 5) };
};
