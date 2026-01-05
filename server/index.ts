
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './roomManager.js';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('createRoom', ({ userName }) => {
        // Use socket.id as temporary user ID or require client to send a UUID.
        // For simplicity, we use socket.id, but this breaks reconnects basically.
        // Better: Client sends a UUID.
        const userId = socket.handshake.auth.userId || socket.id;
        roomManager.createRoom(userId, userName, socket);
    });

    socket.on('joinRoom', ({ roomId, userName }) => {
        const userId = socket.handshake.auth.userId || socket.id;
        roomManager.joinRoom(roomId, userId, userName, socket);
    });

    socket.on('startGame', ({ roomId }) => {
        const userId = socket.handshake.auth.userId || socket.id;
        roomManager.startGame(roomId, userId);
    });

    socket.on('action', ({ roomId, action }) => {
        const userId = socket.handshake.auth.userId || socket.id;
        roomManager.handleAction(roomId, userId, action);
    });

    socket.on('nextHand', ({ roomId }) => {
        const userId = socket.handshake.auth.userId || socket.id;
        roomManager.startNextHand(roomId, userId);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        roomManager.handleDisconnect(socket);
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
