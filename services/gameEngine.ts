
import { GameState, Player, Card, GameStage, HandResult } from '../types';
import { INITIAL_CHIPS, SMALL_BLIND, BIG_BLIND } from '../constants';
import { createDeck, evaluateHand } from './pokerLogic';

export const createNewGameState = (
    players: Player[],
    dealerIndex: number,
    roomCode: string,
    handCounter: number = 1,
    existingHistory: any[] = []
): GameState => {
    const playerCount = players.length;
    // Determine roles based on dealer position - 2 player rules vs 3+ player rules
    const nextSBIndex = playerCount === 2 ? dealerIndex : (dealerIndex + 1) % playerCount;
    const nextBBIndex = playerCount === 2 ? (dealerIndex + 1) % playerCount : (dealerIndex + 2) % playerCount;
    const firstActorIndex = playerCount === 2 ? nextSBIndex : (nextBBIndex + 1) % playerCount;

    // Reset player state for new hand
    const activePlayers = players.map((p, i) => ({
        ...p,
        bet: 0,
        cards: [] as Card[],
        isFolded: false,
        isAllIn: false,
        hasActed: false,
        isDealer: i === dealerIndex,
        isSmallBlind: i === nextSBIndex,
        isBigBlind: i === nextBBIndex,
        lastAction: undefined
    }));

    // Create and deal deck
    const deck = createDeck();
    activePlayers.forEach(p => {
        // In a real server implementation, we might hide other players' cards, 
        // but for shared logic state calculation we deal them all.
        p.cards = [deck.pop()!, deck.pop()!];
    });

    // Post blinds
    let pot = 0;
    // Small Blind
    if (activePlayers[nextSBIndex].chips > SMALL_BLIND) {
        activePlayers[nextSBIndex].chips -= SMALL_BLIND;
        activePlayers[nextSBIndex].bet = SMALL_BLIND;
        pot += SMALL_BLIND;
    } else {
        // All-in case for SB (simplified)
        const amount = activePlayers[nextSBIndex].chips;
        activePlayers[nextSBIndex].chips = 0;
        activePlayers[nextSBIndex].bet = amount;
        activePlayers[nextSBIndex].isAllIn = true;
        pot += amount;
    }

    // Big Blind
    if (activePlayers[nextBBIndex].chips > BIG_BLIND) {
        activePlayers[nextBBIndex].chips -= BIG_BLIND;
        activePlayers[nextBBIndex].bet = BIG_BLIND;
        pot += BIG_BLIND;
    } else {
        const amount = activePlayers[nextBBIndex].chips;
        activePlayers[nextBBIndex].chips = 0;
        activePlayers[nextBBIndex].bet = amount;
        activePlayers[nextBBIndex].isAllIn = true;
        pot += amount;
    }

    return {
        roomCode,
        stage: 'PREFLOP',
        pot,
        communityCards: [],
        players: activePlayers,
        currentPlayerIndex: firstActorIndex,
        dealerIndex: dealerIndex,
        deck,
        minBet: BIG_BLIND,
        currentBet: BIG_BLIND,
        lastRaiseAmount: BIG_BLIND,
        handHistory: existingHistory,
        handCounter: handCounter
    };
};

export interface ActionResult {
    newState: GameState;
    winners?: { player: Player, hand: HandResult }[];
}

export const processAction = (
    gameState: GameState,
    action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE',
    amount: number = 0
): ActionResult => {
    if (gameState.stage === 'SHOWDOWN') return { newState: gameState };

    const updatedPlayers = [...gameState.players];
    const currentPlayer = updatedPlayers[gameState.currentPlayerIndex];
    let betInThisAction = 0;

    // 1. Process Player Move
    if (action === 'CALL') {
        const callAmount = gameState.currentBet - currentPlayer.bet;
        betInThisAction = Math.min(currentPlayer.chips, callAmount);
        currentPlayer.chips -= betInThisAction;
        currentPlayer.bet += betInThisAction;
        currentPlayer.lastAction = '跟注';
        if (callAmount >= currentPlayer.chips && callAmount > 0) currentPlayer.isAllIn = true;
    } else if (action === 'FOLD') {
        currentPlayer.isFolded = true;
        currentPlayer.lastAction = '弃牌';
    } else if (action === 'CHECK') {
        currentPlayer.lastAction = '过牌';
    } else if (action === 'RAISE') {
        betInThisAction = amount - currentPlayer.bet;
        // Validation should happen before calling this, but safe enforcement:
        if (currentPlayer.chips >= betInThisAction) {
            currentPlayer.chips -= betInThisAction;
            currentPlayer.bet = amount;
            currentPlayer.lastAction = `加注至 $${amount}`;
        } else {
            // Fallback to all-in if calculation error (shouldn't happen with valid input)
            betInThisAction = currentPlayer.chips;
            currentPlayer.chips = 0;
            currentPlayer.bet += betInThisAction;
            currentPlayer.isAllIn = true;
            currentPlayer.lastAction = 'All-in';
        }
    }

    currentPlayer.hasActed = true;
    const nextPot = gameState.pot + betInThisAction;

    // Update Global Bet State
    let nextCurrentBet = action === 'RAISE' ? amount : gameState.currentBet;
    let nextLastRaise = action === 'RAISE' ? (amount - gameState.currentBet) : gameState.lastRaiseAmount;

    // Reset other players' "hasActed" if raised
    if (action === 'RAISE') {
        updatedPlayers.forEach((p, idx) => {
            if (idx !== gameState.currentPlayerIndex && !p.isFolded && !p.isAllIn) {
                p.hasActed = false;
            }
        });
    }

    // 2. Find Next Player
    let nextIndex = (gameState.currentPlayerIndex + 1) % updatedPlayers.length;
    const activeCount = updatedPlayers.filter(p => !p.isFolded).length;

    // Find next non-folded player
    // Safety break to prevent infinite loop if everyone folded (handled by win check below)
    while (updatedPlayers[nextIndex].isFolded && activeCount > 1) {
        nextIndex = (nextIndex + 1) % updatedPlayers.length;
    }

    // 3. Application State Logic (Round Transition / Win)
    const nonFolded = updatedPlayers.filter(p => !p.isFolded);

    // Check Instant Win (Everyone else folded)
    if (nonFolded.length === 1) {
        const winner = nonFolded[0];
        winner.chips += nextPot;
        winner.lastAction = '赢家!';

        // Create Result
        const finalState: GameState = {
            ...gameState,
            players: updatedPlayers,
            currentPlayerIndex: -1, // No one acting
            pot: 0,
            stage: 'SHOWDOWN',
            currentBet: nextCurrentBet,
            lastRaiseAmount: nextLastRaise
        };

        // Construct dummy hand result for consistent return type
        const winners = [{
            player: winner,
            hand: { score: 0, label: '对手弃牌', handName: 'Win', winningCards: [] }
        }];

        return { newState: finalState, winners };
    }

    // Check Round Completion
    // Everyone active (not folded, not all-in) must have acted and matched the bet
    // Note: All-in players don't need to act again but are part of the detailed Pot logic (simplified here)
    const activeBettingPlayers = updatedPlayers.filter(p => !p.isFolded && !p.isAllIn);
    const everyoneMatched = activeBettingPlayers.every(p => p.bet === nextCurrentBet);
    const everyoneActed = activeBettingPlayers.every(p => p.hasActed);

    // Special case: if everyone is all-in or folded except maybe one person, and they matched, proceed.
    const allInPlayers = updatedPlayers.filter(p => !p.isFolded && p.isAllIn);
    const isAllInScenario = activeBettingPlayers.length <= 1 && everyoneMatched && everyoneActed; // One person matching all-ins

    if ((everyoneMatched && everyoneActed) || (activeBettingPlayers.length === 0 && allInPlayers.length > 0)) {
        // Move to next stage
        let nextStage: GameStage = gameState.stage;
        let nextCommunity = [...gameState.communityCards];
        let nextDeck = [...gameState.deck];

        if (nextStage === 'PREFLOP') {
            nextStage = 'FLOP';
            nextCommunity.push(nextDeck.pop()!, nextDeck.pop()!, nextDeck.pop()!);
        } else if (nextStage === 'FLOP') {
            nextStage = 'TURN';
            nextCommunity.push(nextDeck.pop()!);
        } else if (nextStage === 'TURN') {
            nextStage = 'RIVER';
            nextCommunity.push(nextDeck.pop()!);
        } else if (nextStage === 'RIVER') {
            nextStage = 'SHOWDOWN';
        }

        // Reset bets for next round
        updatedPlayers.forEach(p => {
            p.bet = 0;
            p.hasActed = false;
            p.lastAction = undefined;
        });
        nextCurrentBet = 0;
        nextLastRaise = BIG_BLIND; // Reset min raise

        // Reset Start Player (Dealer + 1)
        nextIndex = (gameState.dealerIndex + 1) % updatedPlayers.length;
        while (updatedPlayers[nextIndex].isFolded) {
            nextIndex = (nextIndex + 1) % updatedPlayers.length;
        }

        const nextStateBase: GameState = {
            ...gameState,
            players: updatedPlayers,
            currentPlayerIndex: nextIndex,
            pot: nextPot,
            stage: nextStage,
            communityCards: nextCommunity,
            deck: nextDeck,
            currentBet: nextCurrentBet,
            lastRaiseAmount: nextLastRaise
        };

        if (nextStage === 'SHOWDOWN') {
            return settleGameLogic(nextStateBase);
        }

        return { newState: nextStateBase };
    }

    // Continue current round
    return {
        newState: {
            ...gameState,
            players: updatedPlayers,
            currentPlayerIndex: nextIndex,
            pot: nextPot,
            currentBet: nextCurrentBet,
            lastRaiseAmount: nextLastRaise
        }
    };
};

export const settleGameLogic = (state: GameState): ActionResult => {
    const activePlayers = state.players.filter(p => !p.isFolded);
    const results = activePlayers.map(p => ({
        player: p,
        hand: evaluateHand(p.cards, state.communityCards)
    }));

    const maxScore = Math.max(...results.map(r => r.hand.score));
    const currentWinners = results.filter(r => r.hand.score === maxScore);

    const winAmount = Math.floor(state.pot / currentWinners.length);
    const updatedPlayers = state.players.map(p => {
        const winner = currentWinners.find(w => w.player.id === p.id);
        if (winner) return { ...p, chips: p.chips + winAmount, lastAction: '赢家!' };
        return p;
    });

    return {
        newState: {
            ...state,
            players: updatedPlayers,
            pot: 0,
            stage: 'SHOWDOWN'
        },
        winners: currentWinners
    };
};
