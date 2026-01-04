
import { GameState } from '../types';

/**
 * 这是一个基于 BroadcastChannel 的实时同步引擎模拟。
 * 在同一浏览器的不同标签页打开应用即可实现同步。
 * 生产环境下，这里应替换为 Socket.io 或 Supabase Realtime 接口。
 */
class RealtimeService {
  private channel: BroadcastChannel | null = null;
  private onMessageCallback: ((state: GameState) => void) | null = null;

  init(roomCode: string, onMessage: (state: GameState) => void) {
    if (this.channel) this.channel.close();
    this.channel = new BroadcastChannel(`poker-${roomCode}`);
    this.onMessageCallback = onMessage;

    this.channel.onmessage = (event) => {
      console.log('Received remote update:', event.data);
      if (this.onMessageCallback) {
        this.onMessageCallback(event.data);
      }
    };
  }

  broadcast(state: GameState) {
    if (this.channel) {
      console.log('Broadcasting state update...');
      this.channel.postMessage(state);
    }
  }

  close() {
    if (this.channel) this.channel.close();
  }
}

export const realtime = new RealtimeService();
