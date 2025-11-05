var socket = io.connect("localhost:3000");

socket.on("createLobbyResponse", function (data) {
    console.log("My personal ID is: " + data.id);
    var load = frame.onload;
    frame.onload = function () {
        load();
        frame.contentWindow.document.getElementById("code").innerHTML = data.id;
    };
});

socket.on("playerJoinMsg", function (data) {
    console.log(data);
});

socket.on("players", function (data) {
    console.log(data);
});

socket.on("listPlayers", function (data) {
    console.log(data);
    updateLobby(data);
});

socket.on("playerDCMsg", function (data) {
    console.log(data);
});

socket.on("startGameResponse", function (data) {
    console.log(data);
    initGame(data);
});

socket.on("sendCodeResponse", function (data) {
    console.log(data);
    checkPlace(data);
});

function startGame() {
    socket.emit("startGame");
    console.log("Sending startGame message");
}

function joinLobby() {
    var lobbyCode = prompt("Paste Lobby Code");
    socket.emit("joinLobby", {
        username: uDisplay.innerHTML,
        joinID: lobbyCode,
    });
}

function createLobby() {
    socket.emit("createLobby", {
        username: uDisplay.innerHTML,
    });
}

function sendCode() {
    console.log(
        frame.contentWindow.document.getElementById("probName").innerHTML
    );
    socket.emit("sendCode", {
        problem:
            frame.contentWindow.document.getElementById("probName").innerHTML,
        code: frame.contentWindow.document.getElementById("codeInput").value,
    });
}
