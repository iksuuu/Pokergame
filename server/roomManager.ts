
import { Server, Socket } from 'socket.io';
import { GameState, Player } from '../types.js';
import { createNewGameState, processAction, ActionResult } from '../services/gameEngine.js';
import { INITIAL_CHIPS } from '../constants.js';

interface LobbyPlayer {
    id: string;
    name: string;
    chips: number;
    isHost: boolean;
    isOnline: boolean;
    offlineSince?: number;
    disconnectTimeout?: NodeJS.Timeout;
}

interface Room {
    id: string;
    hostId: string;
    gameState: GameState | null;
    players: Map<string, LobbyPlayer>; // userId -> Data
}

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private socketToUser: Map<string, { userId: string, roomId: string }> = new Map();
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    createRoom(hostId: string, hostName: string, socket: Socket) {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

        const hostPlayer: LobbyPlayer = {
            id: hostId,
            name: hostName,
            chips: INITIAL_CHIPS,
            isHost: true,
            isOnline: true
        };

        const room: Room = {
            id: roomId,
            hostId,
            gameState: null,
            players: new Map([[hostId, hostPlayer]])
        };

        this.rooms.set(roomId, room);
        this.socketToUser.set(socket.id, { userId: hostId, roomId });
        socket.join(roomId);

        socket.emit('roomCreated', { roomId });
        this.broadcastLobby(roomId);
    }

    joinRoom(roomId: string, userId: string, userName: string, socket: Socket) {
        const room = this.rooms.get(roomId.toUpperCase());
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        // If user is already in (reconnect), update socket
        if (room.players.has(userId)) {
            const player = room.players.get(userId)!;
            player.isOnline = true;
            if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                player.disconnectTimeout = undefined;
                player.offlineSince = undefined;
            }
        } else {
            if (room.gameState && room.gameState.stage !== 'SHOWDOWN' && room.gameState.stage as any !== 'LOBBY') {
                socket.emit('error', 'Game in progress');
                return;
            }
            room.players.set(userId, {
                id: userId,
                name: userName,
                chips: INITIAL_CHIPS,
                isHost: false,
                isOnline: true
            });
        }

        this.socketToUser.set(socket.id, { userId, roomId });
        socket.join(roomId);

        if (room.gameState) {
            // Update gameState with online status
            const gamePlayer = room.gameState.players.find(p => p.id === userId);
            if (gamePlayer) {
                gamePlayer.isOnline = true;
                gamePlayer.offlineSince = undefined;
            }
            this.io.to(roomId).emit('gameState', room.gameState);
        } else {
            this.broadcastLobby(roomId);
        }
    }

    handleDisconnect(socket: Socket) {
        const info = this.socketToUser.get(socket.id);
        if (!info) return;

        const { userId, roomId } = info;
        this.socketToUser.delete(socket.id);

        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.players.get(userId);
        if (!player) return;

        player.isOnline = false;
        player.offlineSince = Date.now();
        console.log(`Player ${player.name} (${userId}) disconnected from room ${roomId}. Starting 2min timeout.`);

        // Update gameState status if exists
        if (room.gameState) {
            const gamePlayer = room.gameState.players.find(p => p.id === userId);
            if (gamePlayer) {
                gamePlayer.isOnline = false;
                gamePlayer.offlineSince = player.offlineSince;
            }
            this.io.to(roomId).emit('gameState', room.gameState);
        } else {
            this.broadcastLobby(roomId);
        }

        // 2 minute timeout
        player.disconnectTimeout = setTimeout(() => {
            console.log(`Timeout expired for player ${player.name} (${userId}) in room ${roomId}. Removing...`);
            this.removePlayerFromRoom(roomId, userId);
        }, 120000);
    }

    private removePlayerFromRoom(roomId: string, userId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.players.get(userId);
        if (!player) return;

        const wasHost = player.isHost;
        room.players.delete(userId);

        if (wasHost || room.players.size === 0) {
            this.io.to(roomId).emit('error', 'Room dissolved (Host left or room empty)');
            this.rooms.delete(roomId);
        } else {
            if (room.gameState) {
                this.io.to(roomId).emit('error', `${player.name} left the game. Room dissolved.`);
                this.rooms.delete(roomId); // For simplicity, dissolve if anyone leaves during game
            } else {
                this.broadcastLobby(roomId);
            }
        }
    }

    startGame(roomId: string, userId: string) {
        const room = this.rooms.get(roomId);
        if (!room || room.hostId !== userId) return;

        const lobbyPlayers = Array.from(room.players.values());
        if (lobbyPlayers.length < 2) return; // Need at least 2 players

        // Convert LobbyPlayer to Game Player
        const gamePlayers: Player[] = lobbyPlayers.map((p, i) => ({
            id: p.id,
            name: p.name,
            chips: p.chips,
            bet: 0,
            cards: [],
            isFolded: false,
            isAllIn: false,
            isDealer: i === 0, // Requestor is dealer usually? Or random.
            isSmallBlind: false,
            isBigBlind: false,
            hasActed: false,
            isHost: p.isHost,
            isOnline: p.isOnline,
            offlineSince: p.offlineSince
        }));

        const newState = createNewGameState(gamePlayers, 0, roomId);
        room.gameState = newState;
        this.io.to(roomId).emit('gameStarted', newState);
        this.io.to(roomId).emit('gameState', newState);
    }

    handleAction(roomId: string, userId: string, action: { type: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount?: number }) {
        const room = this.rooms.get(roomId);
        if (!room || !room.gameState) return;

        const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
        if (currentPlayer.id !== userId) return;

        const result = processAction(room.gameState, action.type, action.amount);
        room.gameState = result.newState;

        // Update lobby chips if hand ended
        if (result.newState.stage === 'SHOWDOWN') {
            result.newState.players.forEach((p: Player) => {
                const lp = room.players.get(p.id);
                if (lp) lp.chips = p.chips;
            });
        }

        this.io.to(roomId).emit('gameState', room.gameState);

        if (result.winners) {
            this.io.to(roomId).emit('winners', result.winners);
        }
    }

    startNextHand(roomId: string, userId: string) {
        const room = this.rooms.get(roomId);
        if (!room || !room.gameState) return;
        // Only host or winner can start next? Or voting? Let's say Host or anyone for now.

        // Rotate dealer
        const nextDealerIndex = (room.gameState.dealerIndex + 1) % room.gameState.players.length;
        const currentPlayers = room.gameState.players; // Carry over chips is implicit in createNewGameState input

        const newState = createNewGameState(currentPlayers, nextDealerIndex, roomId, (room.gameState.handCounter || 0) + 1, room.gameState.handHistory);
        room.gameState = newState;
        this.io.to(roomId).emit('gameState', newState);
    }

    private broadcastLobby(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const players = Array.from(room.players.values());
        this.io.to(roomId).emit('lobbyUpdate', { players, roomId });
    }
}
