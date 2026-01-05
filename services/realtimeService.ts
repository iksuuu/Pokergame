
import { GameState } from '../types';

/**
 * 云端同步引擎 (Cloud Sync Engine)
 * 使用公用的实时中继服务实现跨设备同步
 */
class RealtimeService {
  private roomCode: string | null = null;
  private onMessageCallback: ((state: any) => void) | null = null;
  private lastUpdate: number = 0;
  private pollInterval: number | null = null;

  init(roomCode: string, onMessage: (state: any) => void) {
    this.roomCode = roomCode;
    this.onMessageCallback = onMessage;
    this.stopPolling();
    this.startPolling();
  }

  // 广播状态到云端
  async broadcast(state: any) {
    if (!this.roomCode) return;
    try {
      // 使用公用的实时中继接口 (这里使用 ntfy.sh 作为演示中继，它支持 CORS 且无需 Key)
      await fetch(`https://ntfy.sh/poker_club_${this.roomCode}`, {
        method: 'POST',
        body: JSON.stringify({
          ...state,
          _timestamp: Date.now()
        }),
        headers: {
          'Title': 'Poker State Update',
          'Tags': 'poker,update'
        }
      });
    } catch (e) {
      console.error('Cloud Broadcast Error:', e);
    }
  }

  // 轮询云端状态
  private startPolling() {
    this.pollInterval = window.setInterval(async () => {
      if (!this.roomCode) return;
      try {
        // 获取最新的消息内容
        const response = await fetch(`https://ntfy.sh/poker_club_${this.roomCode}/json?poll=1&since=1m`);
        const text = await response.text();
        const lines = text.trim().split('\n');
        
        for (const line of lines) {
          if (!line) continue;
          const data = JSON.parse(line);
          // 只有解析出消息正文且时间戳更新时才触发回调
          if (data.message) {
            try {
              const state = JSON.parse(data.message);
              if (state._timestamp && state._timestamp > this.lastUpdate) {
                this.lastUpdate = state._timestamp;
                if (this.onMessageCallback) this.onMessageCallback(state);
              }
            } catch (innerError) {
              // 忽略非JSON消息
            }
          }
        }
      } catch (e) {
        // 轮询异常处理
      }
    }, 1500); // 1.5秒轮询一次，兼顾实时性与性能
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  close() {
    this.stopPolling();
    this.roomCode = null;
  }
}

export const realtime = new RealtimeService();
