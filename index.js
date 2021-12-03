const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { connectPlayers, gameLoop } = require('./game');

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

let roomCounter = 1;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {

  let room = `room${roomCounter}`;

  socket.join(room);

  if(io.sockets.adapter.rooms.get(room).size > 1) {
    roomCounter++;
    console.log('gameLoop starts');

    io.to(room).emit('initiateGame');
    // gameLoop(io, room);
  }

  socket.on('firstMoveSet', figure => {
    console.log(figure);
    socket.broadcast.emit('opponentFirstMove', figure);
  })

  socket.on('disconnect', socket => {

    io.to(room).emit('Gegner verlassen');
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});