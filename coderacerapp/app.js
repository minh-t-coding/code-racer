console.log("-----started app.js-----");

const express = require("express");
const createError = require("http-errors");
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const fs = require("fs");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const safeEval = require("safe-eval");

// Routes
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");

// App setup
const app = express();
const server = http.createServer(app);
const io = socketio(server);
const port = process.env.PORT || 3000;

// Middleware
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/", indexRouter);
app.use("/users", usersRouter);

// 404 handler
app.use((req, res, next) => {
    next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};
    res.status(err.status || 500);
    res.render("error");
});

// Start server
server.listen(port, () => {
    console.log(`Server listening at port ${port}`);
});

// ===== SOCKET.IO SECTION =====
io.on("connection", (socket) => {
    const sessionId = socket.id;
    let roomId;

    console.log(`${sessionId} has joined`);

    socket.on("createLobby", (data) => {
        console.log(`request to make a lobby from ${sessionId}`);
        roomId = sessionId;
        socket.join(roomId);

        let room =
            io.sockets.adapter.rooms.get?.(roomId) ||
            io.sockets.adapter.rooms[roomId];

        socket.username = data.username;

        // Keep user data in memory
        io.sockets.adapter.rooms[roomId].users = {
            [sessionId]: data.username,
        };

        io.to(roomId).emit("listPlayers", [
            io.sockets.adapter.rooms[roomId].users,
        ]);
        socket.emit("createLobbyResponse", { id: roomId });
    });

    socket.on("joinLobby", (data) => {
        const room = io.sockets.adapter.rooms[data.joinID];
        if (room && io.sockets.adapter.rooms[data.joinID].users) {
            console.log(`${sessionId} is joining ${data.joinID}`);
            roomId = data.joinID;
            socket.join(roomId);
            io.sockets.adapter.rooms[roomId].users[sessionId] = data.username;

            io.to(roomId).emit("listPlayers", [
                io.sockets.adapter.rooms[roomId].users,
            ]);
            io.to(roomId).emit(
                "playerJoinMsg",
                `${data.username} has joined the room.`
            );
        } else {
            socket.emit("errJoinMsg", { invalidID: data.joinID });
            console.log(`Invalid join attempt: ${data.joinID}`);
        }
    });

    socket.on("sendCode", (data) => {
        console.log(`Received code from ${sessionId} for ${data.problem}`);

        const room = io.sockets.adapter.rooms[roomId];
        if (!room) return;

        const testsPath = path.join(
            __dirname,
            `../problems/${data.problem}/unitTests`
        );

        if (!fs.existsSync(testsPath)) {
            socket.emit("sendCodeResponse", {
                error: "Problem not found",
            });
            return;
        }

        let numPassed = 0;
        const unitTests = JSON.parse(fs.readFileSync(testsPath, "utf-8"));

        for (const test of unitTests) {
            try {
                const codeToRun = `
                  (function() {
                      ${data.code}
                      return ${data.problem}(${JSON.stringify(test.input)});
                  })()
              `;
                const result = safeEval(codeToRun);
                if (result === test.output) numPassed++;
            } catch (err) {
                console.error("Test failed:", err.message);
            }
        }

        const hasWon = numPassed === unitTests.length;
        if (hasWon) {
            room.placement = (room.placement || 0) + 1;
        }

        socket.emit("sendCodeResponse", {
            numPassed,
            numTotal: unitTests.length,
            hasWon,
            placement: room.placement,
        });
    });

    socket.on("startGame", () => {
        const room = io.sockets.adapter.rooms[roomId];
        if (!room) return;
        room.placement = 0;

        const problemsDir = path.join(__dirname, "../problems");
        fs.readdir(problemsDir, (err, items) => {
            if (err) return console.error(err);

            const problemName = items[Math.floor(Math.random() * items.length)];
            const basePath = path.join(problemsDir, problemName);

            try {
                const problem = fs.readFileSync(
                    path.join(basePath, "problem"),
                    "utf-8"
                );
                const header = fs.readFileSync(
                    path.join(basePath, "functionHeader"),
                    "utf-8"
                );
                const unitTests = JSON.parse(
                    fs.readFileSync(path.join(basePath, "unitTests"), "utf-8")
                );

                io.to(roomId).emit("startGameResponse", {
                    problemName,
                    problem,
                    header,
                    unitTests,
                });
            } catch (ex) {
                console.error(`Error reading problem ${problemName}:`, ex);
            }
        });
    });

    socket.on("disconnect", () => {
        const room = io.sockets.adapter.rooms[roomId];
        if (room && io.sockets.adapter.rooms[roomId].users) {
            delete io.sockets.adapter.rooms[roomId].users[sessionId];
            io.to(roomId).emit("playerDCMsg", `${sessionId} has left.`);
            io.to(roomId).emit("listPlayers", [
                io.sockets.adapter.rooms[roomId].users,
            ]);
        }
    });
});

console.log("~~~~~end of app.js~~~~~");
module.exports = app;
