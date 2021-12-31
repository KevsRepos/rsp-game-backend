'use strict';

module.exports = class Game {
    MoveNumber = 0;
    playerFirstMove = false;
    playerToMove = null;
    currentOpponent = null;
    columns = 8;
	rows = 8;
	figuresField = new Array(this.columns);

	constructor(room, players, io) {
        this.room = room;
        this.players = players;
        this.io = io;

		for (let row = 0; row < this.figuresField.length; row++) {
			this.figuresField[row] = new Array(this.columns);	
		}

		this.gameField = new Array(this.columns);

		for (let rows = 0; rows < this.gameField.length; rows++) {
		    this.gameField[rows] = new Array(this.columns);

			for (let columns = 0; columns < this.gameField[rows].length; columns++) {
				this.gameField[rows][columns] = {
					place: {
						column: columns, 
						row: rows
					},
					player: null,
					playerRevealed: false,
					freeSpace: null,
					figure: null
				}
			}
		}

		this.gameField.forEach((column, columnIndex) => {
			column.forEach((row, rowIndex) => {
				if(columnIndex === this.columns - 2 || columnIndex === this.columns - 1) {
					this.gameField[columnIndex][rowIndex].player = players[0];
				}else if(columnIndex === 0 || columnIndex === 1) {
					this.gameField[columnIndex][rowIndex].player = players[1];
				}else {
					this.gameField[columnIndex][rowIndex].freeSpace = true;
				}
			});
		});
	}

    invertFieldForPlayer2({row, column}, onlyOnPlayerToMove) {
        if(!onlyOnPlayerToMove || this.playerToMove === this.players[2]) {
            return {
                row: (row * -1) + (this.rows - 1),
                column: (column * -1) + (this.columns - 1)
            }
        }

        return {
            row: row,
            column: column
        }
    }

	start() {
		this.io.to(this.room).emit('start');
	}

	end() {
		this.io.to(this.room).emit('end');
	}

	toMove() {
		this.MoveNumber++;
		return this.MoveNumber % this.players.length; // 0, 1, 0, 1... abwechselnd
	}

  	setFigures(caller, figures) {
		//   console.log(figures);
		// let figuresField = new Array(this.columns);

		// console.table(this.figuresField);

		let player1Counter = 0;
		let player2Counter = figures.length - 1;
		for (let rows = 0; rows < this.figuresField.length; rows++) {
			for (let columns = 0; columns < this.figuresField[rows].length; columns++) {
				if(this.gameField[rows][columns].player === caller.id) {
					if(caller.id === this.players[0]) {
						this.figuresField[rows][columns] = figures[player1Counter];
						player1Counter++;
					}else {
						this.figuresField[rows][columns] = figures[player2Counter];
						player2Counter--;
					}
				}
			}
		}

		console.table(this.figuresField);

		player1Counter = 0;
		player2Counter = figures.length - 1;
		for (let rows = 0; rows < this.gameField.length; rows++) {
			for (let columns = 0; columns < this.gameField[rows].length; columns++) {
				if(this.gameField[rows][columns].player === caller.id) {
					if(caller.id === this.players[0]) {
						this.gameField[rows][columns].figure = figures[player1Counter];
						player1Counter++;
					}else {
						this.gameField[rows][columns].figure = figures[player2Counter];
						player2Counter--;
					}
				}
			}
		}
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

	getNextFields(playerPos, field) {
        // console.log(playerPos);
        // console.log(field);
		if(
			(playerPos.row === field.row - 1 && playerPos.column === field.column) ||
			(playerPos.row === field.row + 1 && playerPos.column === field.column) ||
			(playerPos.row === field.row && playerPos.column === field.column - 1) ||
			(playerPos.row === field.row && playerPos.column === field.column + 1)
		) {
			return true;
		}

		return false;
    }

	movePlayer(caller, {figure, playerPos, field}) {
		// player that is to move
		const player = this.playerToMove;
        const opponent = this.currentOpponent;

		console.log('hier');

        playerPos = this.invertFieldForPlayer2(playerPos, true);
        field = this.invertFieldForPlayer2(field, true);

		// disallow if the allowed player is not the caller
		if (player !== caller.id) {
			console.log("Player not caller");
			return;
		}

		if(!this.gameField[playerPos.row][playerPos.column].player === caller.id) {
			console.log('other self');
			return;
		}

		// for (let i = 0; i < this.gameField.length; i++) {
		// 	for (let j = 0; j < this.gameField[i].length; j++) {
		// 		console.log(this.gameField[i][j].figure);
		// 	}
		// }

		// console.log(this.getNextFields(playerPos, field));

		// if(this.getNextFields(playerPos, field)) {
		// 	if(this.gameField[playerPos.row][playerPos.column].player) {
		// 		caller.emit('moveAllowed', true);
		// 	}
		// }

		if(this.getNextFields(playerPos, field)) {
			if(this.gameField[playerPos.row][playerPos.column].player) {
				if(this.gameField[field.row][field.column].player !== caller && this.gameField[field.row][field.column].player) {
					//Angriff
					const opponentFigure = this.gameField[field.row][field.column].figure;
					if(figure === opponentFigure) {
						console.log('Angriff pat');
						//send Pat
					}else if(
						(opponentFigure === 'rock' && figure === 'paper') ||
						(opponentFigure === 'paper' && figure === 'scissor') ||
						(opponentFigure === 'scissor' && figure === 'rock')
					) {
						//Angriff gewonnen
						console.log('Angriff gewonnen');
						caller.broadcast.emit('opponentMoveTo', [
                            this.invertFieldForPlayer2(playerPos, false), 
                            this.invertFieldForPlayer2(field, false)
                        ]);
					}else {
						//Angriff verloren
                        caller.emit('moveAllowed', false);
						this.io.to(this.room).emit('callerLost', {
                            caller: player,
                            from: playerPos, 
                            to: field,
							fromInverted: this.invertFieldForPlayer2(playerPos, false),
							toInverted: this.invertFieldForPlayer2(field, false),
							opponent: opponentFigure
                        });
                        return;
					}
				}else {
                    // console.log('kein Angriff');
					//kein Angriff
					this.gameField[field.row][field.column].player = caller;
					this.gameField[field.row][field.column].figure = figure;
					// this.gameField[field.row][field.column].freeSpace = false;

					this.gameField[playerPos.row][playerPos.column].player = null;
					this.gameField[playerPos.row][playerPos.column].figure = null;
					// this.gameField[playerPos.row][playerPos.column].freeSpace = true;

                    // console.log(playerPos);
                    // console.log(this.invertFieldForPlayer2(playerPos.row, playerPos.column));

					caller.broadcast.emit('opponentMoveTo', [
                        this.invertFieldForPlayer2(playerPos, false), 
                        this.invertFieldForPlayer2(field, false)
                    ]);
				}

                caller.emit('moveAllowed', true);
			}
		}

		// console.table(this.figuresField);
	}
}