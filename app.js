var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

app.get("/", function(req, res) {
    res.sendFile(__dirname + "/debug-html/game.html");
});

var users = [];
var inGame = false;

io.on("connection", function(socket) {
    console.log(socket.id + " (id) connected");
    
    socket.on("join game", function(nickname) {
        users.push({ id: socket.id, nickname: nickname });
        
        var list = [];
        users.forEach(function(element) {
            list.push(element.nickname);
        });
        
        
        socket.broadcast.emit("user connected", nickname);
        socket.emit("send player list", list);
        console.log(nickname + " joined the game");
    });
    
    socket.on("disconnect", function() {
        if (inGame) {
            endGame(users[findUserBySocketId(socket.id)]);
        } else {
            var index = findUserBySocketId(socket.id);
            
            var nickname = users[index].nickname;
            socket.broadcast.emit("user disconnected", nickname);
            console.log(nickname + " left the game");
            users.splice(index, index);
        }
    });
});

function endGame(userEnded)
{
    console.log("The game has ended by " + userEnded.nickname);
    
    io.emit("end game", userEnded);
    
    users = [];
}

function findUserBySocketId(socketId)
{
    for (var i = 0; i < users.length; i++) {
        if (users[i].id === socketId) {
            return i;
        }
    }
    
    return -1;
}

http.listen(3000, function() {
    console.log("Listening on 3000");
});
