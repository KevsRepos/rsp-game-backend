module.exports.gameLoop = (io, room) => {
    console.log('gameloop here');
    io.to(room).emit('initiateGame');

    // const players = io.sockets.clients(room); 

    const tenSeconds = 10000;

    setTimeout(() => {
        io.to(room).emit('timeover');    
    }, tenSeconds);

    // io.to(room).once('chooseFirstMove', (obj) => {
    //     // player.to(room).emit('opponentChoosed');
    // });
}