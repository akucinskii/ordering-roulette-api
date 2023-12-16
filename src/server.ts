import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

const roomUserMap = {};

io.on('connection', (socket) => {
  console.log('A user connected');

  const sendRoomUserList = (roomName: string): void => {
    const userList = Array.from(roomUserMap[roomName] || []);
    io.to(roomName).emit('updateUserList', userList);
  };

  socket.on('requestUserList', (roomName) => {
    sendRoomUserList(roomName);
  });

  // Join a room
  socket.on('joinRoom', ({ room, username }) => {
    socket.join(room);
    if (!roomUserMap[room]) {
      roomUserMap[room] = new Set();
    }
    roomUserMap[room].add(username);
    sendRoomUserList(room);
  });

  socket.on('startLottery', (room) => {
    const roomFromAdapter = io.sockets.adapter.rooms.get(room);
    const roomSize = roomFromAdapter ? roomFromAdapter.size : 0;
    const numberOfPartitions = roomSize;
    const randomNumber = Math.random() * 360;

    const winner = Math.ceil(randomNumber / (360 / numberOfPartitions));

    // Broadcast the winner data to all clients in the specified room
    io.to(room).emit('winnerData', { winner, randomNumber });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/', (_, res) => {
  res.send('Socket.io Lottery Server with Rooms');
});
