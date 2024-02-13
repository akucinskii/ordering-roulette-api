import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';

const app = express();
app.use(cors());
const httpServer = http.createServer(app);

const initializeDb = async (): Promise<
  Database<sqlite3.Database, sqlite3.Statement>
> => {
  const db = await open({
    filename: 'mydb.sqlite',
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, 
      username TEXT, 
      room TEXT
    );
    CREATE TABLE IF NOT EXISTS lotteries (
      id INTEGER PRIMARY KEY, 
      date TEXT, 
      room TEXT, 
      participants TEXT, 
      winner TEXT
    );
  `);

  return db;
};

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

const roomUserMap = {};

type Lottery = {
  date: string;
  room: string;
  participants: string;
  winner: string;
};

const addLotteryToDB = async (
  db,
  room,
  participants,
  winner,
): Promise<void> => {
  const date = new Date().toISOString();
  await db.run(
    'INSERT INTO lotteries (date, room, participants, winner) VALUES (?, ?, ?, ?)',
    [date, room, JSON.stringify(participants), winner],
  );
};

const getLotteries = async (db): Promise<Lottery[]> => {
  const lotteries = await db.all('SELECT * FROM lotteries');
  return lotteries;
};

const getLotteriesThatContainUser = async (
  db,
  username: string,
): Promise<Lottery[]> => {
  const lotteries = await db.all(
    'SELECT * FROM lotteries WHERE participants LIKE ? ORDER BY date DESC LIMIT 10',
    `%${username}%`,
  );
  return lotteries;
};

const getLottieriesThatUserWon = async (
  db,
  username: string,
): Promise<Lottery[]> => {
  const lotteries = await db.all(
    'SELECT * FROM lotteries WHERE winner = ?',
    username,
  );
  return lotteries;
};

const getRoomUserList = (roomName: string): string[] => {
  return Array.from(roomUserMap[roomName] || []);
};

const addNewRoom = (roomName: string): void => {
  if (!roomUserMap[roomName]) {
    roomUserMap[roomName] = new Set();
  }
};

const addNewUserToRoom = (roomName: string, username: string): void => {
  addNewRoom(roomName);
  roomUserMap[roomName].add(username);
};

initializeDb().then(async (db) => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`url: http://localhost:${PORT}`);
  }),
    io.on('connection', (socket) => {
      const sendRoomUserList = (roomName: string): void => {
        const userList = getRoomUserList(roomName);
        io.to(roomName).emit('updateUserList', userList);
      };

      socket.on('requestUserList', (roomName) => {
        sendRoomUserList(roomName);
      });

      // Join a room
      socket.on('joinRoom', ({ room, username }) => {
        socket.join(room);

        addNewRoom(room);

        addNewUserToRoom(room, username);

        sendRoomUserList(room);
      });

      socket.on('startLottery', async (room) => {
        const roomFromAdapter = io.sockets.adapter.rooms.get(room);
        const roomSize = roomFromAdapter ? roomFromAdapter.size : 0;
        const participants = getRoomUserList(room);
        const numberOfPartitions = roomSize;
        const randomNumber = Math.random() * 360;

        const winner = Math.ceil(randomNumber / (360 / numberOfPartitions));

        // Broadcast the winner data to all clients in the specified room
        await addLotteryToDB(db, room, participants, participants[winner - 1]);

        io.to(room).emit('winnerData', { winner, randomNumber });
      });

      socket.on('disconnect', () => {
        // Since we want the user to stay in the room even if they disconnect, we don't remove them from the room
        console.log('A user disconnected');
      });
    });
});

app.get('/', (_, res) => {
  res.send('Socket.io Lottery Server with Rooms');
});

app.get('/lotteries', async (_, res) => {
  const db = await initializeDb();
  const lotteries = await getLotteries(db);
  res.send(lotteries);
});

app.get('/lotteries/:username', async (req, res) => {
  const db = await initializeDb();
  const lotteries = await getLotteriesThatContainUser(db, req.params.username);
  res.send(lotteries);
});

app.get('/lotteries/won/:username', async (req, res) => {
  const db = await initializeDb();
  const lotteries = await getLottieriesThatUserWon(db, req.params.username);
  res.send(lotteries);
});
