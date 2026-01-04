
import React from 'react';
import { Suit, Rank, Card } from './types';

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const INITIAL_CHIPS = 2000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

export const SuitIcon = ({ suit, className }: { suit: Suit; className?: string }) => {
  const s = suit.toLowerCase();
  switch (s) {
    case 'hearts': return <span className={`text-red-600 font-serif ${className}`}>♥</span>;
    case 'diamonds': return <span className={`text-red-600 font-serif ${className}`}>♦</span>;
    case 'clubs': return <span className={`text-black font-serif ${className}`}>♣</span>;
    case 'spades': return <span className={`text-black font-serif ${className}`}>♠</span>;
    default: return <span className={className}>?</span>;
  }
};
