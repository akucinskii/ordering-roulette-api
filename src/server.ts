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

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('requestRoomSize', (roomName) => {
    console.log(`Room size requested for room: ${roomName}`);
    const room = io.sockets.adapter.rooms.get(roomName);
    const roomSize = room ? room.size : 0;

    // Send room size to the requesting client
    socket.emit('roomSize', roomSize);

    // Or, broadcast to the room
    io.to(roomName).emit('roomSize', roomSize);
  });
  // Join a room
  socket.on('joinRoom', (room) => {
    socket.join(room);
    const roomFromAdapter = io.sockets.adapter.rooms.get(room);
    const roomSize = roomFromAdapter ? roomFromAdapter.size : 0;
    io.to(room).emit('userJoined', roomSize);
    socket.emit('roomJoined', room);

    console.log(`room size`, roomSize);
    console.log(`User joined room: ${room}`);
  });

  // Start lottery in a specific room
  socket.on('startLottery', (room) => {
    // Get the number of clients in the room
    const roomFromAdapter = io.sockets.adapter.rooms.get(room);
    const roomSize = roomFromAdapter ? roomFromAdapter.size : 0;

    console.log(
      `Starting lottery in room: ${room}` + ` with ${roomSize} clients`,
    );
    const numberOfPartitions = roomSize;
    const randomNumber = Math.random() * 360;

    const winner = Math.ceil(randomNumber / (360 / numberOfPartitions));

    console.log(`Winner is: ${winner}`);
    console.log(`Random number is: ${randomNumber}`);
    console.log(`Room size is: ${roomSize}`);

    console.log(room);

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
