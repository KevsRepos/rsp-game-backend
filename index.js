const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const Game = require('./game');

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

// const __dirname = 'www';

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let roomCounter = 1;
let games = {};

io.on('connection', (socket) => {
	let room = `room${roomCounter}`;

	socket.join(room);
	socket.send({"room": roomCounter});

	if(io.sockets.adapter.rooms.get(room).size > 1) {
		roomCounter++;

		let users = io.sockets.adapter.rooms.get(room);

		//convert stupid map to goody array
		const socketIds = [[...users][0], [...users][1]];

		let players = [
			io.sockets.sockets.get(socketIds[0]),
			io.sockets.sockets.get(socketIds[1])
		];

		// make game in this room and add players
		let game = new Game(io, room, players);

		// make this game globally available by room-number so we can access it later
		games[room] = game;
	}

	socket.onAny((event, data) => {
		// games[room].currentCaller = socket;
		
		games[room][event](socket, data);

		// games[room].currentOpponent = socket;
	});

	socket.on('disconnect', socket => {
		io.to(room).emit('Gegner verlassen');
	});
});

server.listen(5000, () => {
  	console.log('listening on *:5000');
});