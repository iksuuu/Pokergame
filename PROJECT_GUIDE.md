# Poker Game Project Guide

Welcome to the **Gemini Poker Private Club** project! This document provides a high-level overview of the architecture, setup process, and deployment strategy for this multiplayer poker application.

---

## 1. Project Overview

This is a real-time, multiplayer Texas Hold'em poker game featuring:
- **Multiplayer Mode**: Create/Join private rooms via 6-character room codes.
- **AI Dealer**: Interactive game commentary powered by **Google Gemini AI**.
- **Responsive UI**: A premium, mobile-friendly design using React and high-fidelity CSS.
- **Real-time Engine**: Powered by **Socket.io** for low-latency synchronization between players.

---

## 2. Technical Architecture

### Frontend (React + Vite)
- **State Management**: React Hooks (`useState`, `useEffect`) manage the UI state and synchronization with the server.
- **Real-time Services**: `realtimeService.ts` handles the WebSocket connection, event emitting, and local player identification.
- **UI Components**: Modular components like `PlayerSeat`, `CardUI`, and `RaiseModal` ensure a maintainable codebase.

### Backend (Node.js + Express + Socket.io)
- **Monolith Design**: The backend server is responsible for both the game logic and serving the static frontend assets (`dist` folder).
- **Room Management**: `roomManager.ts` tracks room states, player connections, and manages the 2-minute "offline timeout" logic.
- **Game Engine**: `gameEngine.ts` handles the core rules (dealing, betting rounds, winner evaluation).

---

## 3. Local Development Setup

### Prerequisites
- Node.js 18 or 20+
- A Google AI Studio API Key (for the dealer commentary).

### Installation
1.  **Install Root Dependencies**:
    ```bash
    npm install
    ```
2.  **Install Server Dependencies**:
    ```bash
    cd server && npm install
    ```

### Running Locally
- **Option A (Frontend + Backend Development)**:
    1.  Start the backend (Port 3001): `npm run dev` inside the `server` folder.
    2.  Start the frontend (Port 3000): `npm run dev` in the root folder.
    3.  The frontend will automatically find the backend at `localhost:3001`.

- **Option B (Monolith Preview)**:
    1.  Build the frontend: `npm run build`.
    2.  Start the server: `npm start --prefix server`.
    3.  Access the game at `http://localhost:3001`.

---

## 4. Key Multiplayer Features

### Share Links
Invite links are constructed as `[Current-URL]#[Room-ID]`. The app detects the hash in the URL on load and automatically prompts the player to join the room.

### Connection Resilience
- **Persistent ID**: Players have a unique ID stored in `localStorage` to allow reconnecting to the same seat.
- **Offline Countdown**: If a player's connection drops, a 120-second timer starts. 
- **Room Dissolution**: If the host leaves or a player fails to reconnect within 120 seconds, the room state is cleaned up to prevent stale data.

---

## 5. Deployment (Google Cloud Run)

The project is optimized for deployment as a **Unified Monolith** on Cloud Run.

### The Build Process
Used a multi-stage `Dockerfile`:
1.  **Stage 1**: Builds the React project and generates the `dist` folder.
2.  **Stage 2**: Installs production dependencies and prepares the Node.js environment.
3.  **Result**: A single container that serves both the index page and the WebSocket server.

### Critical Cloud Run Settings
- **Port**: Must be set to **8080**.
- **Session Affinity**: MUST be enabled! Socket.io requires a stable connection to the same server instance.
- **Environment Variables**: `GEMINI_API_KEY` must be set in the GCP console.

---

## 6. Directory Structure

```text
├── components/          # React UI components
├── services/            # Business logic (Poker rules, AI, Real-time)
├── server/              # Node.js backend logic
│   ├── index.ts         # Server entry point & static file serving
│   └── roomManager.ts   # Socket.io event handling
├── types.ts             # Shared TypeScript interfaces
├── Dockerfile           # Deployment configuration
└── package.json         # Unified dependency management
```

---

## 7. Future Improvements
- [ ] Implement permanent user accounts/profiles.
- [ ] Add support for multiple game types (Omaha, etc.).
- [ ] Add more complex AI interaction (asking the dealer for advice).
