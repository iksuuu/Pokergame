# How to Run and Test the Poker Game

The application consists of two parts: the **Server** (backend) and the **Client** (frontend). You need to run both simultaneously to test the multiplayer features.

## 1. Start the Server (Backend)
Open a terminal in the `server` directory and run:

```bash
cd server
npm install
npm run dev
```
*The server will start on `http://localhost:3001`.*

## 2. Start the Client (Frontend)
Open a **new** terminal in the root directory and run:

```bash
npm install
npm run dev
```
*The client will start on `http://localhost:5173`.*

## 3. How to Test Multiplayer
To test the multiplayer flow on your local machine:

1.  Open `http://localhost:5173` in your browser.
2.  Enter a nickname and click **"创建好友房" (Create Room)**.
3.  Click the **"分享对局" (Share Link)** button on the top-left to copy the invite link (e.g., `http://localhost:5173/#ABCDEF`).
4.  Open a **New Incognito Window** (or a different browser like Safari/Firefox).
5.  Paste the invite link and press Enter.
6.  Enter a different nickname and click **"确认加入" (Join)**.
7.  Go back to the first window (the host) and click **"开始对局" (Start Game)**.

## 4. Testing Disconnect/Reconnect
1.  While in a game, close one of the browser tabs.
2.  In the other tab, you will see the player appear as **"Offline" (正在重连...)**.
3.  Refresh the tab you closed (or reopen the same link) within **2 minutes**.
4.  The player should automatically reconnect and resume their seat.
