var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

//debugging
app.get("/", function(req, res) {
    res.sendFile(__dirname + "/debug-html/game.html");
});

/*deck of cards source:
https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Svg-cards-2.0.svg/1920px-Svg-cards-2.0.svg.png*/
app.get("/img/:name", function(req, res) {
    res.sendFile(__dirname + "/debug-html/img/" + req.params.name);
});

var users = [];
var move = 0;
var inGame = false;
var tableStack = [ 5 ];
var lastEnsured = 1;

io.on("connection", function(socket) {
    console.log(socket.id + " (id) connected");
    
    socket.on("join game", function(nickname) {
        if (!inGame && typeof nickname === "string" && nickname.length >= 3 && nickname.length <= 15) {
            users.push({ id: socket.id, nickname: nickname, cards: [] });

            var list = [];
            users.forEach(function(element) {
                list.push(element.nickname);
            });


            //emitting to users not in game
            socket.broadcast.emit("user connected", nickname);
            socket.emit("send player list", list);
            console.log(nickname + " joined the game");
        } else {
            socket.emit("join rejected");
            
            socket.disconnect();
            
            console.log("Joining has been rejected");
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
    
    socket.on("place cards", function(cards) {
        var userIndex = findUserBySocketId(socket.id);
        
        var checkingIsInputValid = function(cardsToCheck, ensured) {
            //checking values of cards
            try {
                return cardsToCheck.length === ensured.length &&
                        (cardsToCheck.length === 1 || cardsToCheck.length === 3 || cardsToCheck.length === 4) &&
                        checkArePermittedEnsuredCards(ensured);
            } catch (e) {
                return false;
            }
        };
        
        if (userIndex === move &&
                checkingIsInputValid(cards.realCards, cards.ensuredCards) &&
                checkArePermittedEnsuredCards(cards.ensuredCards) &&
                checkIfUserHasCards(userIndex, cards.realCards)) {

            
            //placing cards
            cards.ensuredCards.forEach(function(element) {
                tableStack.push(element);
            });
            
            lastEnsured = cards.ensuredCards[0];
            
            passNextMove();
            
            socket.broadcast.emit("cards placed", { "ensured": lastEnsured, "amountOfPlacedCards": cards.ensuredCards.length });
            
            
        } else {
            console.log("Unpermitted request for placing cards");
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
                users.splice(index, 1);
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
    
    var usersIndex = Math.floor(Math.random() * users.length);
    //debugging (to remove)
    if (usersIndex >= users.length) {
        throw "usersIndex out of range";
    }
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

function checkIfUserHasCards(userIndex, cardsToCheck)
{
    var cardsToCompare = users[userIndex].cards;
    
    cardsToCheck.forEach(function(element) {
        var exists = false;
        
        cardsToCompare.forEach(function(element2) {
            if (element === element2) {
                exists = true;
            }
        });
        
        if (!exists) {
            return false;
        }
    });
    
    return true;
}

function checkArePermittedEnsuredCards(cardsToCheck)
{
    var value = cardsToCheck[0];
    
    cardsToCheck.forEach(function(val) {
        if (val !== value || typeof val !== "number") {
            return false;
        }
    });
    
    if ((value >= lastEnsured || value === 1) && value > 0 && value <= 13) {
        return true;
    }
    
    return false;
}

function place2Heart()
{
    for (var i = 0; i < users.length; i++) {
        for (var i2 = 0; i2 < users[i].cards.length; i2++) {
            if (users[i].cards[i2] === 5) {
                users[i].cards.splice(i2, 1);
                
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
    
    users[userIndex].cards.splice(cardIndex, 1);
    
    passNextMove();
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
