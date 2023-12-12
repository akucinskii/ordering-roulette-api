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

  socket.on('startLottery', () => {
    console.log("Let's start the lottery");
    // Implement your logic to determine the winner here
    const numberOfPartitions = 19; // Adjust according to your application
    const winner = Math.floor(Math.random() * numberOfPartitions);
    const randomNumber = Math.random() * 360;

    // Broadcast the winner data to all clients
    io.emit('winnerData', { winner, randomNumber });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/', (req, res) => {
  res.send('Socket.io Lottery Server');
});
