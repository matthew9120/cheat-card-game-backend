var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

app.get("/", function(req, res) {
    res.sendFile(__dirname + "/debug-html/game.html");
});

var users = [];
var move = 0;
var inGame = false;
var tableStack = [ 5 ];
var lastPlacer = 0;

io.on("connection", function(socket) {
    console.log(socket.id + " (id) connected");
    
    socket.on("join game", function(nickname) {
        if (!inGame) {
            users.push({ id: socket.id, nickname: nickname, cards: [] });

            var list = [];
            users.forEach(function(element) {
                list.push(element.nickname);
            });


            socket.broadcast.emit("user connected", nickname);
            //emitting to users not in game
            socket.emit("send player list", list);
            console.log(nickname + " joined the game");
        } else {
            socket.emit("join rejected");
            
            socket.disconnect();
        }
    });
    
    socket.on("request begin game", function() {
        if (!inGame && findUserBySocketId(socket.id) > -1 && users.length >= 3) {
            //debug
            try {
            inGame = true;
            //remember to add checking is stack bigger than 1 card and do not compelately clean tableStack
            
            haveAllTheCards();
            
            var ownerOf2Heart = place2Heart();
            console.log("2 heart is from " + ownerOf2Heart);
            
            var numbersOfCards = prepareNumbersOfCarsForEachNickname();
            
            //sending "begin game" event
            for (var i = 0; i < users.length; i++) {
                if (users[i].id !== socket.id) {
                    socket.broadcast.to(users[i].id).emit("begin game", { "cards": users[i].cards, "numbersOfCards": numbersOfCards, "ownerOf2Heart": ownerOf2Heart });
                } else {
                    socket.emit("begin game", { "cards": users[i].cards, "numbersOfCards": numbersOfCards, "ownerOf2Heart": ownerOf2Heart });
                }
            }
            
            console.log("The game has been begun");
        } catch (e) {
            console.log(e);
            throw e;
        }
        }
    });
    
    socket.on("disconnect", function() {
        if (inGame && findUserBySocketId(socket.id) > -1) {
            endGame(users[findUserBySocketId(socket.id)]);
        } else if (findUserBySocketId(socket.id) > -1) {
            var index = findUserBySocketId(socket.id);
            
            var nickname = users[index].nickname;
            socket.broadcast.emit("user disconnected", nickname);
            console.log(nickname + " left the game");
            if (users.length > 1) {
                users.splice(index, index);
            } else {
                users = [];
            }
        }
        
        console.log(socket.id + " (id) disconnected");
    });
});

function haveAllTheCards()
{
    var deckOfCards = [];
    
    for (var i = 0; i < 52; i++) {
        deckOfCards[i] = i;
    }
    
    deckOfCards.sort(function() { return 0.5 - Math.random(); });
    
    var usersIndex = 0;
    for (var i = 0; i < 52; i++) {
        users[usersIndex++].cards.push(deckOfCards[i]);
        
        if (usersIndex >= users.length) {
            usersIndex = 0;
        }
    }
    
    console.log("Cards have been handed");
}

function prepareNumbersOfCarsForEachNickname()
{
    var numbers = [];
    
    for (var i = 0; i < users.length; i++) {
        numbers.push({ "nickname": users[i].nickname, "number": users[i].cards.length });
    }
    
    return numbers;
}

function place2Heart()
{
    for (var i = 0; i < users.length; i++) {
        for (var i2 = 0; i2 < users[i].cards.length; i2++) {
            if (users[i].cards[i2] === 5) {
                users[i].cards.splice(i2, i2);
                
                move = i;
                passNextMove();
                
                return users[i].nickname;
            }
        }
    }
    
    throw "No 2 heart";
}

function placeCard(userIndex, cardIndex)
{
    tableStack.push(users[userIndex].cards[cardIndex]);
    
    users[userIndex].cards.splice(cardIndex, cardIndex);
    
    lastPlacer = userIndex;
}

function passNextMove()
{
    if (++move === users.length) {
        move = 0;
    }
    
    console.log("Passing move");
}

function endGame(userEnded)
{
    console.log("The game has ended by " + userEnded.nickname);
    
    io.emit("end game", userEnded.nickname);
    
    users = [];
    
    inGame = false;
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
