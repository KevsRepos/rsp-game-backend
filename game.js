'use strict';

module.exports = class Game1 {
	rows = 8;
	columns = 8;

	playerToMove = null;

	//first move decision
	storedFigureForFirstMove = false;

	//All these variables are only used for the pat situation (pretty complex, maybe find a tinier solution)
	patSituation = false;
	patChoosed = 0;
	currentFrom;
	currentTo;

	//figures
	figuresConstruct = {
		rock: {
			number: 5,
			attacker: true,
		},
		paper: {
			number: 5,
			attacker: true,
		},
		scissor: {
			number: 5,
			attacker: true,
		},
		king: {
			number: 1,
			attacker: false
		}
	}

	//timers
	figureTimer = 2;
	moveTimer = 30;

	constructor(io, room, players) {
		this.room = room;
		this.players = players;
		this.io = io;

		this.figures = {};

		this.figures[players[0].id] = structuredClone(this.figuresConstruct);
		this.figures[players[1].id] = structuredClone(this.figuresConstruct);

		this.settedFiguresCounter = {};
		this.settedFiguresCounter[players[0].id] = 0;
		this.settedFiguresCounter[players[1].id] = 0;


		this.gameField = new Array(this.rows);

		//create gamefield with properties
		for (let rows = 0; rows < this.rows; rows++) {
		    this.gameField[rows] = new Array(this.columns);

			for (let columns = 0; columns < this.columns; columns++) {
				this.gameField[rows][columns] = {
					coords: {
						column: columns, 
						row: rows
					},
					figure: null,
					revealed: false
				}

				//set both players on the field
				if(rows <= 1) {
					//player 1 on first two rows
					this.gameField[rows][columns].player = players[0].id;
					// console.log(players[0].id);
				}else if(rows >= this.gameField.length - 2) {
					//player 2 on last two rows
					this.gameField[rows][columns].player = players[1].id;
				}
			}
		}

		this.start();
	}

	getNextPlayer(callerId) {
		return callerId === this.players[0].id ? this.players[1].id : this.players[0].id;
	}

	emitWithoutEnemyFigures() {
		let player0Field = structuredClone(this.gameField);
		let player1Field = structuredClone(this.gameField);

		for (let i = 0; i < this.rows; i++) {
			for (let j = 0; j < this.columns; j++) {
				if(this.gameField[i][j].figure && !this.gameField[i][j].revealed) {
					if(this.gameField[i][j].player === this.players[0].id) {
						player1Field[i][j].figure = '';
					}else if(this.gameField[i][j].player === this.players[1].id) {
						player0Field[i][j].figure = '';
					}
				}
			}
		}

		this.players[0].emit('gameField', player0Field);
		this.players[1].emit('gameField', player1Field);
	}

	//starts the game
	start() {
		this.io.to(this.room).emit('start');

		//send first play information to rotate his gamefield with css, because its upside down for him
		this.players[0].emit('rotateField');

		setTimeout(() => {
			this.io.to(this.room).emit('gameField', this.gameField);
		}, 100);
	}

	//ends the game
	end(winner) {
		this.io.to(this.room).emit('end', winner.id);
	}

	placeFigure(caller, data) {
		const row = data.coords.row;
		const column = data.coords.column;

		if(this.gameField[row][column].player === caller.id && !this.gameField[row][column].figure) {
			
			if(!Object.keys(this.figuresConstruct).find(el => el === data.figure)) {
				//player sent non-existing figure
				console.log('non-existing');
				return;
			}else {
				if(this.figures[caller.id][data.figure].number <= 0) {
					//player tried to set more figures of the same type than allowed
					console.log('more than allowed');
					return;
				}
			}

			this.figures[caller.id][data.figure].number--;

			if(this.figures[caller.id][data.figure].number === 0) {
				delete this.figures[caller.id][data.figure];
			}

			this.gameField[row][column].figure = data.figure;

			this.settedFiguresCounter[caller.id]++;

			this.emitWithoutEnemyFigures();

			const summedNumbers = Object.values(this.settedFiguresCounter).reduce((acc, el) => acc + el);

			if(summedNumbers === 32) {
				this.io.emit('chooseStarter');
				return;
			}

			//When one player has set all his figures, start timer for the other user
			if(this.settedFiguresCounter[caller.id] === 16) {
				const timer = setInterval(() => {
					this.figureTimer--;

					caller.broadcast.emit('figureTimer', this.figureTimer);

					if(this.figureTimer <= 0) {
						clearInterval(timer);

						this.placeRandomFigures(this.getNextPlayer(caller.id));
					}
				}, 1000);
			}
		}
	}

	placeRandomFigures(player) {
		const figures = Object.keys(this.figures[player]);

		for (let i = 0; i < this.rows; i++) {
			for (let j = 0; j < this.columns; j++) {
				if(!this.gameField[i][j].figure && this.gameField[i][j].player === player) {
					//set a random figure
					const randomFigure = figures[Math.floor(Math.random() * figures.length)];

					this.figures[player][randomFigure].number--;

					if(this.figures[player][randomFigure].number === 0) {
						figures.splice(figures.indexOf(randomFigure), 1);
					}

					this.gameField[i][j].figure = randomFigure;
				}
			}
		}

		this.emitWithoutEnemyFigures();

		this.io.emit('chooseStarter');
	}

	//only to select who has the first move (casual rock-scissors-paper game)
	firstMove(caller, figure) {
		if(!this.storedFigureForFirstMove) {
			this.storedFigureForFirstMove = figure;
		}else {            
			if(this.storedFigureForFirstMove === figure) {
				//this is a pat, repeat
				this.storedFigureForFirstMove = null;

				this.io.to(this.room).emit('firstMoveHas', null);
			}else if(
				(this.storedFigureForFirstMove === 'rock' && figure === 'paper') ||
				(this.storedFigureForFirstMove === 'paper' && figure === 'scissor') ||
				(this.storedFigureForFirstMove === 'scissor' && figure === 'rock')
			) {
				//caller won, this player has the first move
                this.playerToMove = caller.id;

                this.io.to(this.room).emit('firstMoveHas', caller.id);

				this.setTimeCounter();
			}else {
				//caller lost, opposite player has first move
                this.playerToMove = this.getNextPlayer(caller.id);

                this.io.to(this.room).emit('firstMoveHas', this.playerToMove);

				this.setTimeCounter();
			}
		}
  	}

	//Method only for Pat Situation where both players have to choose a new figure
	newFigure(caller, figure) {
		if(this.patSituation) {
			let row, column;

			if(caller.id === this.playerToMove) {
				row = this.currentFrom.row;
				column = this.currentFrom.column;
			}else {
				row = this.currentTo.row;
				column = this.currentTo.column;
			}

			this.gameField[row][column].figure = figure;
			this.patChoosed++;
	
			if(this.patChoosed === 2) {
				this.patChoosed = 0;

				this.emitWithoutEnemyFigures(caller);

				this.movePlayer(this.currentCaller, {
					from: this.currentFrom,
					to: this.currentTo
				})
			}
		}
	}

	getNextFields(from, to) {
        // console.log(from);
        // console.log(to);
		if(
			(from.row === to.row - 1 && from.column === to.column) ||
			(from.row === to.row + 1 && from.column === to.column) ||
			(from.row === to.row && from.column === to.column - 1) ||
			(from.row === to.row && from.column === to.column + 1)
		) {
			return true;
		}

		return false;
    }

	setTimeCounter() {
		this.setTimeInterval = setInterval(() => {
			this.moveTimer--;

			this.io.to(this.room).emit('moveTimer', this.moveTimer);

			if(this.moveTimer <= 0) {
				clearInterval(this.setTimeInterval);

				this.moveTimer = 30;

				this.io.to(this.room).emit('moveTimer', this.moveTimer);

				this.playerToMove = this.getNextPlayer(this.playerToMove);

				this.io.to(this.room).emit('nextMove');

				this.setTimeCounter();
			}
		}, 1000);
	}

	movePlayer(caller, {from, to}) {
		clearInterval(this.setTimeInterval);
		this.moveTimer = 30;
		
		// player that is to move
		const player = this.playerToMove;

		//opponent ID
        const opponent = this.getNextPlayer(caller.id);

		// disallow if the allowed player is not the caller
		if (player !== caller.id) {
			console.log("Player not caller");
			return;
		}

		//to field is antoher figure, disallow
		if(!this.gameField[from.row][from.column].player === caller.id) {
			console.log('other self');
			return;
		}

		this.currentFrom = from;
		this.currentTo = to;
		this.currentCaller = caller;

		if(this.getNextFields(from, to)) {
			if(this.gameField[from.row][from.column].player) {
				const figure = this.gameField[from.row][from.column].figure;

				if(this.gameField[to.row][to.column].player !== caller && this.gameField[to.row][to.column].player) {
					//Attacks opponents field
					const opponentFigure = this.gameField[to.row][to.column].figure;

					if(opponentFigure === 'king') {
						this.end(caller);
						return;
					}

					if(figure === opponentFigure) {
						//Pat, both figures are same
						console.log('pat');
						this.patSituation = true;

						this.io.to(this.room).emit('pat');
						return;
					}else if(
						figure === 'rock' && opponentFigure === 'scissor' ||
						figure === 'paper' && opponentFigure === 'rock' ||
						figure === 'scissor' && opponentFigure === 'paper'
					) {
						//Caller won attack
						console.log('caller won');
						this.gameField[to.row][to.column].player = caller.id;
						this.gameField[to.row][to.column].figure = figure;
						this.gameField[to.row][to.column].revealed = true;

						this.gameField[from.row][from.column].player = null;
						this.gameField[from.row][from.column].figure = null;
						this.gameField[from.row][from.column].revealed = false;
					}else {
						//Caller lost attack, move opponent to from field and reveal opponent
						console.log('caller lost');
						this.gameField[from.row][from.column].player = opponent;
						this.gameField[from.row][from.column].figure = opponentFigure;
						this.gameField[from.row][from.column].revealed = true;

						this.gameField[to.row][to.column].player = null;
						this.gameField[to.row][to.column].figure = null;
						this.gameField[to.row][to.column].revealed = false;
					}
				}else {
					//No Attack, moves into free space
					// console.log('no Attack');
					this.gameField[to.row][to.column].player = caller.id;
					this.gameField[to.row][to.column].figure = figure;

					this.gameField[from.row][from.column].player = null;
					this.gameField[from.row][from.column].figure = null;
				}

				this.emitWithoutEnemyFigures(caller);
			}
		}

		this.playerToMove = opponent;
		this.io.to(this.room).emit('nextMove');

		this.setTimeCounter();
	}
}