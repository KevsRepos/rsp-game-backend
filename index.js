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

class Game {
  constructor(room, players) {
    this.room = room;
    this.players = players;
    this.MoveNumber = 0;

    console.log("Room", this.room);
    console.log("Players", this.players);
    console.log("MoveNumber", this.MoveNumber);

    const columns = 8;
    const rows = 8;

    this.gameField = new Array(columns);

    for (let rows = 0; rows < this.gameField.length; rows++) {
      this.gameField[rows] = new Array(columns);

      for (let columns = 0; columns < this.gameField[rows].length; columns++) {
        this.gameField[rows][columns] = {
            place: {
              column: columns, 
              row: rows
            },
            player1: false,
            player2: false,
            playerRevealed: false,
            freeSpace: false,
            figure: null
        }
      }
    }

    this.gameField.forEach((column, columnIndex) => {
      column.forEach((row, rowIndex) => {
          if(columnIndex === columns - 2 || columnIndex === columns - 1) {
              this.gameField[columnIndex][rowIndex].player1 = true;
              // this.gameField[columnIndex][rowIndex].playerSoldier = 'paper';
          }else if(columnIndex === 0 || columnIndex === 1) {
              this.gameField[columnIndex][rowIndex].player2 = true;
          }else {
              this.gameField[columnIndex][rowIndex].freeSpace = true;
          }
      });
    });

    // console.table(this.gameField);
  }

  start() {
    // starte das game
    io.to(this.room).emit('start');
  }

  end() {
    // sag allen clients das game ist vorbei
    io.to(this.room).emit('end');
  }

  movePiece(piece, position) {
    // send players the information that some piece has been moved
    io.to(this.room).emit('move', { piece, position });
  }

  // data ist default leer, um error handling manuell zu machen
  gameStep(caller, data = {}) {
    // player that is to move
    const player = this.players[this.toMove()];

    // disallow if the allowed player is not the caller
    if (player !== caller) {
      return;
    }

    // example events handled

    if (data.type === 'move') {
      this.movePiece(data.piece, data.position);
    }

    else if (data.type === 'forfeit') {
      io.to(this.room).emit('forfeit', { "player": caller });
      this.end();
    }

    // notify the other player he can now do whatever
    if (player.socketId !== caller) {
      io.to(caller).emit('yourTurn');
    }
  }

  toMove() {
    this.MoveNumber++;
    return this.MoveNumber % this.players.length; // 0, 1, 0, 1... abwechselnd
  }
};

let games = {};

io.on('connection', (socket) => {

  let room = `room${roomCounter}`;

  socket.join(room);
  socket.send({"room": roomCounter});

  if(io.sockets.adapter.rooms.get(room).size > 1) {
    roomCounter++;
    
    // get users for the room
    let users = io.sockets.adapter.rooms.get(room);

    //convert stupig map to goody array
    const players = [[...users][0], [...users][1]];

    // debug output
    // console.log(room);
    // console.log(users);

    // make game in this room and add players
    let game = new Game(room, players);

    // make this game globally available by room-number so we can access it later
    games[room] = game;

    // from here on, the game logic is in the class, not the socket.io connection
    games[room].start();
  }

  socket.on('figureLineUp', data => {
    //Platziere die Figuren des Clients auf das Server Spielfeld
    
  });
  
  socket.on("playerEvent", (data) => {
    // do whatever with the data

    // examples for data:
    // {"type": ANY TYPE YOU WANT TO ALLOW, "data": ANY DATA YOU WANT TO ALLOW}

    // {"type": "move", "data": {"Piece":"ROCK","Position": [3,5]"}}
    // Player sends event, event contains the player wanted to place something ("move"), he wants the piece to be a rock ("Piece") and the position he wants to place it ("Position")

    console.log(data);
    games[room].gameStep(socket, data);
  })

  socket.on('disconnect', socket => {

    io.to(room).emit('Gegner verlassen');
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});