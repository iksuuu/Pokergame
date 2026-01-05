
import React from 'react';
import { Suit } from '../types';

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
