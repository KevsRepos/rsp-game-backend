'use strict';

module.exports = class Game {
    MoveNumber = 0;
    playerFirstMove = false;
    playerToMove = null;
    currentOpponent = null;
    columns = 8;
	rows = 8;

	patSituation = false;
	patChoosed = 0;
	currentFrom;
	currentTo;
	currentCaller;
	settedFiguresCounter = 0;

	constructor(room, players, io) {
        this.room = room;
        this.players = players;
        this.io = io;

		this.gameField = new Array(this.columns);

		for (let rows = 0; rows < this.gameField.length; rows++) {
		    this.gameField[rows] = new Array(this.columns);

			for (let columns = 0; columns < this.gameField[rows].length; columns++) {
				this.gameField[rows][columns] = {
					coords: {
						column: columns, 
						row: rows
					},
					player: null,
					figure: null,
					revealed: false
				}
			}
		}

		//Set both players on the field
		this.gameField.forEach((column, columnIndex) => {
			column.forEach((row, rowIndex) => {
				if(columnIndex === this.columns - 2 || columnIndex === this.columns - 1) {
					this.gameField[columnIndex][rowIndex].player = players[0];
				}else if(columnIndex === 0 || columnIndex === 1) {
					this.gameField[columnIndex][rowIndex].player = players[1];
				}
			});
		});
	}

	figurePlaced(caller, data) {
		const row = data.coords.row;
		const column = data.coords.column;

		if(this.gameField[row][column].player === caller.id && !this.gameField[row][column].figure) {
			this.gameField[row][column].figure = data.figure;

			this.settedFiguresCounter++;

			this.emitWithoutEnemyFigures(caller);

			if(this.settedFiguresCounter === 32) {
				this.io.emit('chooseStarter');
			}
		}
	}

	emitWithoutEnemyFigures(caller) {
		let callerField = structuredClone(this.gameField);
		let opponentField = structuredClone(this.gameField);

		for (let i = 0; i < this.gameField.length; i++) {
			for (let j = 0; j < this.columns; j++) {
				if(this.gameField[i][j].figure && !this.gameField[i][j].revealed) {
					if(this.gameField[i][j].player === caller.id) {
						opponentField[i][j].figure = '';
						// console.log(this.gameField[i][j]);
					}else if(this.gameField[i][j].player !== caller.id && this.gameField[i][j].player) {
						callerField[i][j].figure = '';
					}
				}
			}
		}

		caller.emit('gameField', callerField);
		caller.broadcast.emit('gameField', opponentField);
	}

	start() {
		this.io.to(this.room).emit('start');

		setTimeout(() => {
			this.io.to(this.room).emit('gameField', this.gameField);
		}, 100);
	}

	gameWon(winner) {
		this.io.to(this.room).emit('gameWinner', winner.id);
	}

	firstMove(caller, figure) {
        // console.log(caller.id);
        // console.log(figure);
		if(!this.playerFirstMove) {
			// console.log('first');
			this.playerFirstMove = figure;
            this.currentOpponent = caller.id;
		}else {            
			if(this.playerFirstMove === figure) {
				this.playerFirstMove = null;
                this.currentOpponent = null;
				this.io.to(this.room).emit('firstMoveHas', null);
			}else if(
				(this.playerFirstMove === 'rock' && figure === 'paper') ||
				(this.playerFirstMove === 'paper' && figure === 'scissor') ||
				(this.playerFirstMove === 'scissor' && figure === 'rock')
			) {
				// console.log('caller won');
                this.playerToMove = caller.id;
                this.io.to(this.room).emit('firstMoveHas', caller.id);
			}else {
				// console.log('caller lost');
                this.playerToMove = this.currentOpponent;
                this.currentOpponent = caller.id;
                this.io.to(this.room).emit('firstMoveHas', this.playerToMove);
			}
		}
  	}

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

	movePlayer(caller, {from, to}) {
		// player that is to move
		const player = this.playerToMove;

		//opponent ID
        const opponent = this.currentOpponent;

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
						this.gameWon(caller);
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
		this.currentOpponent = caller.id;
		this.io.to(this.room).emit('nextMove');
	}
}