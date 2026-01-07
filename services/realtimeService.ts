
import { io, Socket } from 'socket.io-client';
import { GameState } from '../types';

// Detect environment or hardcode for now. 
// For Google Cloud deployment, this should be an env var or the production URL.
// For local dev, localhost:3001.
// For production, this should point to your Cloud Run URL.
// We can use an environment variable set during build or runtime detection.
const SERVER_URL = ((import.meta as any).env?.VITE_SERVER_URL) ||
  (window.location.port && window.location.port !== '3001' ? 'http://localhost:3001' : window.location.origin);

class RealtimeService {
  private socket: Socket | null = null;
  private userId: string;

  constructor() {
    // Persistent User ID for reconnects
    let storedId = localStorage.getItem('poker_user_id');
    if (!storedId) {
      storedId = 'user_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('poker_user_id', storedId);
    }
    this.userId = storedId;

    // Initialize socket immediately
    this.socket = io(SERVER_URL, {
      auth: { userId: this.userId },
      autoConnect: false // We'll manage connection explicitly
    });
  }

  getUserId() {
    return this.userId;
  }

  connect() {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  createRoom(userName: string, onCreated: (roomId: string) => void) {
    if (!this.socket) this.connect();
    this.socket?.emit('createRoom', { userName });
    this.socket?.once('roomCreated', ({ roomId }) => {
      onCreated(roomId);
    });
  }

  joinRoom(roomId: string, userName: string) {
    if (!this.socket) this.connect();
    this.socket?.emit('joinRoom', { roomId, userName });
  }

  startGame(roomId: string) {
    this.socket?.emit('startGame', { roomId });
  }

  startNextHand(roomId: string) {
    this.socket?.emit('nextHand', { roomId });
  }

  sendAction(roomId: string, action: string, amount?: number) {
    this.socket?.emit('action', { roomId, action: { type: action, amount } });
  }

  on(event: string, callback: (data: any) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string) {
    this.socket?.off(event);
  }

  close() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const realtime = new RealtimeService();
