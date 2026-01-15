import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { Game } from './gameClass.js';
import cors from '@fastify/cors';
import {WebSocketServer} from 'ws';
import fs from 'fs';
import { imageSize } from "image-size";

const fastify = Fastify({
    logger: true,
    connectionTimeout: 120000,
    keepAliveTimeout: 120000,
    https: {
        key: fs.readFileSync('/etc/ssl/transcendence.key'),
        cert: fs.readFileSync('/etc/ssl/transcendence.crt') 
    }
 })

const PORT = parseInt(process.env.GAME_PORT, 10);
const HOST = process.env.GAME_HOST;
const games = new Map();
let gameId = 1;
const filename = fileURLToPath(import.meta.url);
const dirname = join(filename, '..');
let queue = [];
let pendingRemoteGame = [];
const tournamentSocket = new Map();
let tournamentAlias = new Map();
let tournamentScore = new Map();

fastify.register(cors, { 
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
    credentials: true
});

fastify.register(fastifyStatic, {
  root: join(dirname, '..'),
});

function broadcastTournament(tournament_id) {
    const matchs = [];

    for (const [id, game] of games.entries()) {
        if (game.mode === "remote-tournament" && game.tournament_id === tournament_id) {
            const data = {
                id: game.id,
                player1: {
                    name: game.player1.name,
                    status: game.player1.status,
                    score: game.player1.score
                },
                player2: {
                    name: game.player2.name,
                    status: game.player2.status,
                    score: game.player2.score
                }             
            }
            matchs.push(data);

        }
    }

    for (const [userId, socket] of tournamentSocket.entries()) {
        if (socket.readyState === 1 && socket.tournament_id === tournament_id) {
            socket.send(JSON.stringify({ message: "TournamentMatchs", matchs: matchs}));
        }
    }
}

function startTimer(game) {
    game.intervalId = setInterval(() => {
        game.socket.forEach(socket => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify({
                    message: "Countdown",
                    timer: game.timer
                }));
            }
        });
        game.timer--;
        if (game.timer < 0) {
            clearInterval(game.intervalId)
            game.intervalId = null;
            if (game.message !== "Pause") {
                game.started = true;
                game.message = "Playing";
            } else {
                game.message = "END";
                console.log("status 1: ", game.player1.status);
                console.log("status 2: ", game.player2.status);
                if (game.player1.score === 5 || game.player2.status === "Disconnected") {
                    game.winner = game.player1.name;
                    game.player1.score = 5;
                }
                else if (game.player2.score === 5 || game.player1.status === "Disconnected") {
                    game.winner = game.player2.name;
                    game.player2.score = 5;
                }
                game.displayWinner = game.winner + " wins";
                game.socket.forEach(socket => {
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify(serialize(game)));
                    }
                });                
            }
        }
    }, 1000);
}

async function sendResult(game) {
    let winner_id = undefined;
    if (game.player1.status === "Disconnected" && game.player2.status === "Disconnected")
    {
        if (game.player1.score > game.player2.score)
            winner_id = game.player1.id;
        else if (game.player1.score < game.player2.score)
            winner_id = game.player2.id;
        else
            winner_id = undefined;
        console.log("ICI");
    }
    else if (game.player1.score === 5 || game.player2.status === "Disconnected")
        winner_id = game.player1.id;
    else if (game.player2.score === 5 || game.player1.status === "Disconnected")
        winner_id = game.player2.id;
    console.log("Winner id: ", winner_id);
    if (game.mode === "remote-tournament")
        game.mode = "tournament";
    try {
        const response = await fetch("http://users:3000/save-match", {
             method: "POST",
             headers: {"Content-Type": "application/json"},
             body: JSON.stringify({
               player1ID: game.player1.id,
               player2ID: game.player2.id,
               winnerID: winner_id,
               scoreP1: game.player1.score,
               scoreP2: game.player2.score,
               matchType: game.mode,
               gameType: "pong",
             }),
           });

        if(!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to send result");
        }
    } catch(e) {
        console.log(e.error);
    }
}

//#region getScore
function getScore(game) {

    console.log("TOURNAMENT SCORE AVANT: ", tournamentScore);
    if (!tournamentScore.has(Number(game.tournament_id))) {
        tournamentScore.set(Number(game.tournament_id), []);
        const value = tournamentScore.get(Number(game.tournament_id));
        value.push([game.player1.name, Number(game.player1.score - game.player2.score)]);
        value.push([game.player2.name, Number(game.player2.score - game.player1.score)]);
    }
    else {
        const value = tournamentScore.get(Number(game.tournament_id));
        const player1Score = value.filter(data => data[0] === game.player1.name);
        if (player1Score.length !== 0)
            player1Score[0][1] += Number(game.player1.score - game.player2.score);
        else 
            value.push([game.player1.name, Number(game.player1.score - game.player2.score)]);
        const player2Score = value.filter(data => data[0] === game.player2.name);
        if (player2Score.length !== 0)
            player2Score[0][1] += Number(game.player2.score - game.player1.score);
        else 
            value.push([game.player2.name, Number(game.player2.score - game.player1.score)]);
    }
    console.log("TOURNAMENT SCORE APRES: ", tournamentScore);
}

function updatePlayersPosition(game) {
    // Player 1
    if (game.player1.key.up) {

        if (game.player1.sprite.position.y - 15 <= 0)
            game.player1.sprite.position.y = 0;
        else
            game.player1.sprite.position.y -=1 * 15;
    }
    if (game.player1.key.down) {
        if (game.player1.sprite.position.y + 15 + game.player1.sprite.imgSize.height >= game.board.imgSize.height)
            game.player1.sprite.position.y = game.board.imgSize.height - game.player1.sprite.imgSize.height;
        else
            game.player1.sprite.position.y +=1 * 15;
    }
    // Player 2
    if (game.player2.key.up) {

        if (game.player2.sprite.position.y - 15 <= 0)
            game.player2.sprite.position.y = 0;
        else
            game.player2.sprite.position.y -=1 * 15;
    }
    if (game.player2.key.down) {
        if (game.player2.sprite.position.y + 15 + game.player2.sprite.imgSize.height >= game.board.imgSize.height)
            game.player2.sprite.position.y = game.board.imgSize.height - game.player2.sprite.imgSize.height;
        else
            game.player2.sprite.position.y +=1 * 15;
    }
}

function updateBallPosition(game) {
    if (game.ball.position !== undefined) {
        game.ball.position.x += game.ball.velocity.x;
        game.ball.position.y += game.ball.velocity.y;

        if (game.ball.position.x + game.ball.imgSize.width < 0) {
            game.ball.position = {x: game.board.imgSize.width / 2, y:game.board.imgSize.height / 2};
            game.player2.score++;
        }

        if (game.ball.position.x - game.ball.imgSize.width > game.board.imgSize.width) {
            game.ball.position = {x: game.board.imgSize.width / 2, y:game.board.imgSize.height / 2};
            game.player1.score++;
        }
        if (game.ball.position.y <= 0 || game.ball.position.y + game.ball.imgSize.height >= game.board.imgSize.height)
            game.ball.velocity.y = -game.ball.velocity.y;

        if (game.ball.position.x <= game.player1.sprite.position.x + game.player1.sprite.imgSize.width && game.ball.position.x >= game.player1.sprite.position.x && game.ball.position.y + game.ball.imgSize.height >= game.player1.sprite.position.y && game.ball.position.y <= game.player1.sprite.position.y + game.player1.sprite.imgSize.height) {
            game.ball.velocity.x = -game.ball.velocity.x;
            game.ball.position.x = game.player1.sprite.position.x + game.player1.sprite.imgSize.width;
        }
        
        if (game.ball.position.x + game.ball.imgSize.width >= game.player2.sprite.position.x && game.ball.position.x <= game.player2.sprite.position.x + game.player2.sprite.imgSize.width && game.ball.position.y + game.ball.imgSize.height >= game.player2.sprite.position.y && game.ball.position.y <= game.player2.sprite.position.y + game.player2.sprite.imgSize.height) {
            game.ball.velocity.x = -game.ball.velocity.x;
            game.ball.position.x = game.player2.sprite.position.x - game.ball.imgSize.width;
        }
    }

}
// #region main loop
async function gameLoop(game) {
    if (game.board === undefined || game.socket === undefined) {
        console.log("Game not ready yet");
        return ;
    }
    if (game.timerStarted === false) {
        game.timerStarted = true;
        startTimer(game);
    }
    if (game.started === true) {
        updatePlayersPosition(game);
        updateBallPosition(game);
        if (game.player1.score === 5) {
            game.message = "END";
            game.winner = game.player1.name;
            game.displayWinner = game.player1.name + " wins";
        }
        else if (game.player2.score === 5) {
            game.message = "END";
            game.winner = game.player2.name;
            game.displayWinner = game.player2.name + " wins";
        }
        game.socket.forEach(socket => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify(serialize(game)));
            }
        });
    }
    if (game.mode === "remote-tournament")
        broadcastTournament(game.tournament_id);
    if (game.message === "END") {
        if (game.mode === "remote-tournament" || game.mode === "local-tournament")
            getScore(game);
        if (game.mode === "remote" || game.mode === "remote-tournament") {
            sendResult(game);
        }
        else if (game.mode === "remote" || game.mode === "local"){
            for (const socket of game.socket.values()) {
                    socket.close();
            }            
        }
        clearInterval(game.loopId);
        games.delete(parseInt(game.id, 10))
    }
}

function serialize(data) {
    const game = {
        id: data.id,
        message: data.message,
        displayWinner: data.displayWinner,
        timer: data.timer,
        player1: {
            name: data.player1.name,
            score: data.player1.score,
            sprite: {
                position: {
                    x: data.player1.sprite.position.x,
                    y: data.player1.sprite.position.y
                },
                loaded: data.player1.sprite.loaded
            },
        },
        player2: {
            name: data.player2.name,
            score: data.player2.score,
            sprite: {
                position: {
                    x: data.player2.sprite.position.x,
                    y: data.player2.sprite.position.y
                },
                loaded: data.player2.sprite.loaded
            },
        },
        ball: {
            position: {
                x: data.ball.position.x,
                y: data.ball.position.y
            },
            loaded: undefined            
        },
        board: {
            position: {
                x: data.board.position.x,
                y: data.board.position.y
            },
            imgSize: {
                height: data.board.imgSize.height,
                width: data.board.imgSize.width
            },          
            loaded: undefined            
        }     
    }
    return game;
}

// #region WS // 

function localGamehandler(game, ws) {
    ws.userId = game.player1.id;
    game.socket.push(ws);
    ws.send(JSON.stringify({game, message: "Init"}))
    if (game.message === "start");
        game.loopId = setInterval(() => gameLoop(game), 16);
}

function remoteGamehandler(game, ws) {
    if (ws.userId === undefined && game.socket.length === 0 && game.message !== "Pause") { {
        ws.userId = game.player1.id;
        console.log("ICI");
    }
    } else if (ws.userId === undefined && game.socket.length === 1 && game.message !== "Pause") {
        ws.userId = game.player2.id;
        game.socket[0].send(JSON.stringify({name: game.player2.name}));
        game.message = "start";
        console.log("ICI2");
    }
    else if (game.message === "Pause") {
        console.log("GAME FOUND IN HANDLER");
        if (parseInt(game.socket[0].userId, 10) === parseInt(game.player1.id, 10)) {
            ws.userId = game.player2.id;
            game.player2.status = "Online";
            // if (game.mode === "remote-tournament")
            //     ws.surname = game.player2.name;
        }
        else {
            ws.userId = game.player1.id;
            game.player1.status = "Online";
            // if (game.mode === "remote-tournament")
            //     ws.surname = game.player1.name;
        }
    }
    if (game.mode === "remote-tournament") {
        ws.gameId = game.id;
        ws.tournament_id = game.tournament_id;
        tournamentSocket.delete(parseInt(ws.userId, 10));
        tournamentSocket.set(parseInt(ws.userId, 10), ws);
    }
    game.socket.push(ws);
    if (game.message === "Pause" && game.player1.status === "Online" && game.player2.status === "Online") {
        clearInterval(game.intervalId);
        game.intervalId = null;
        game.timer = 5;
        game.message = "Countdown";
        game.timerStarted = false;
    }
    ws.send(JSON.stringify({game: serialize(game), message: "Init"}))
    if (game.message === "start")
        game.loopId = setInterval(() => gameLoop(game), 16);
}

function tournamentHandler(userId, id, tournament_id, ws) {
    if (!userId) {
        ws.send(JSON.stringify({ message: "Error", error: "User id required"}))
        return;
    }
    if (!tournamentHandler) {
        ws.send(JSON.stringify({ message: "Error", error: "Tournament id required"}))
        return;
    }
    console.log("tournament id in handler: ", tournament_id);
    ws.userId = userId;
    ws.gameId = id;
    ws.tournament_id = tournament_id;
    tournamentSocket.set(parseInt(userId, 10), ws);
}

function localInputHandler(game, key, event) {
    if (event === "keydown") {
        if (key === 'a')
            game.player1.key.up = true;
        else if (key === 'd')
            game.player1.key.down = true;
        else if (key === "ArrowLeft")
            game.player2.key.up = true;
        else if (key === "ArrowRight")
            game.player2.key.down = true;
    } else if (event === "keyup") {
         if (key === 'a')
            game.player1.key.up = false;
        else if (key === 'd')
            game.player1.key.down = false;
        else if (key === "ArrowLeft")
            game.player2.key.up = false;
        else if (key === "ArrowRight")
            game.player2.key.down = false;
    }
}

function remoteInputHandler(game, userId, key, event) {
    if (parseInt(userId, 10) === parseInt(game.player1.id, 10)) {
        if (event === "keydown") {
            if (key === 'a' || key === "ArrowLeft")
                game.player1.key.up = true;
            else if (key === 'd' || key === "ArrowRight")
                game.player1.key.down = true;
        } else if (event === "keyup") {
            if (key === 'a' || key === "ArrowLeft")
                game.player1.key.up = false;
            else if (key === 'd' || key === "ArrowRight")
                game.player1.key.down = false;            
        }
    } else if (parseInt(userId, 10) === parseInt(game.player2.id, 10)) {
        if (event === "keydown") {
            if (key === 'a' || key === "ArrowLeft")
                game.player2.key.up = true;
            else if (key === 'd' || key === "ArrowRight")
                game.player2.key.down = true;
        } else if (event === "keyup") {
            if (key === 'a' || key === "ArrowLeft")
                game.player2.key.up = false;
            else if (key === 'd' || key === "ArrowRight")
                game.player2.key.down = false;            
        }
    }
}


const wss = new WebSocketServer({ 
    server: fastify.server,
    path: '/ws'
})

wss.on('listening', () => {
  console.log("WebSocket server running on ws://localhost:3002/ws");
})

wss.on('connection', function connection(ws) {
    ws.on('error', console.error)
    ws.on('message', function message(data) {
        const res = JSON.parse(data.toString());

        if (!res) {
            console.log("RES EMPTY")
            ws.send(JSON.stringify({message: "Error", error: "Data is empty"}));
            return;
        }
        if (!res.id) {
            console.log("id EMPTY")
            ws.send(JSON.stringify({message: "Error", error: "Id is empty"}));
            return;            
        }
        if (!games.has(parseInt(res.id, 10)) && res.message !== "initTournament") {
            console.log("NO GAME FOUND: ", res.id)
            ws.send(JSON.stringify({ message: "Error", error: "Game not found" }));
            return;
        }
        const game = games.get(parseInt(res.id, 10));

        if (res.message === "InitLocal") 
            localGamehandler(game, ws);
        else if (res.message === "InitRemote" || game && game.mode === "remote-tournament" && game.message === "Pause" && res.message === "initTournament") {
            console.log("IN REMOTE HANDLER");
            remoteGamehandler(game, ws);
        }
        else if (res.message === "initTournament") {
            tournamentHandler(res.userId, res.id, res.tournamentId, ws);
        }
        else if (res.message === "input") {
            if (game.mode === "local" || game.mode === "local-tournament")
                localInputHandler(game, res.key, res.event);
            else if (game.mode === "remote" || game.mode === "remote-tournament")
                remoteInputHandler(game, ws.userId, res.key, res.event);
            games.set(game.id, game);
        }
    })
    ws.on('close', (data) => {
        console.log("=== WebSocket CLOSED ===");
        console.log("ws.userId:", ws.userId);
        tournamentSocket.delete(Number(ws.userId));
        for (const [gameId, game] of games.entries() ) {
            if (parseInt(game.player1.id, 10) === parseInt(ws.userId, 10) || parseInt(game.player2.id, 10) === parseInt(ws.userId, 10)) {
                if (game.mode === "local" || game.mode === "local-tournament") {
                    games.delete(parseInt(gameId, 10));
                    break;
                }
                // if (game.mode === "remote-tournament") {
                //     for (const [userId, socket] of tournamentSocket.entries()) {
                //         if (Number(ws.userId) === Number(userId))
                //     }
                // }
                if (game.mode === "remote" && game.message === "Waiting") {
                    const queueIndex = queue.findIndex(data => Number(data[0]) === Number(ws.userId));
                    if (queueIndex > -1) {
                        queue.splice(queueIndex, 1);
                        console.log("PLAYER REMOVED FROM QUEUE");
                    }
                    const pendingIndex = pendingRemoteGame.findIndex(game => Number(game.id) === Number(gameId));
                    if (pendingIndex > -1) {
                        pendingRemoteGame.splice(pendingIndex, 1);
                        console.log("GAME REMOVED FROM QUEUE");
                    }
                    games.delete(Number(gameId));
                }
                game.socket = game.socket.filter(socket => socket.readyState != 3)
                if (parseInt(game.player1.id, 10) === parseInt(ws.userId, 10))
                    game.player1.status = "Disconnected";
                else
                    game.player2.status = "Disconnected";
                console.log("PLAYER 1 STATUS: ", game.player1.status);
                console.log("PLAYER 2 STATUS: ", game.player2.status);
                console.log("GAME MODE: ", game.mode);
                if (game.player1.status === "Disconnected" && game.player2.status === "Disconnected" && game.mode === "remote") {
                    games.delete(parseInt(gameId, 10));
                    clearInterval(game.intervalId);
                    game.intervalId = null;
                    break ;
                }
                else if (game.player1.status === "Disconnected" && game.player2.status === "Disconnected" && game.mode === "remote-tournament") {
                    game.message = "END";
                    clearInterval(game.intervalId);
                    game.intervalId = null;
                    break ;
                }
                else if (game.message !== "END") {
                    console.log("GAME PAUSE");
                    clearInterval(game.intervalId);
                    game.intervalId = null;
                    game.message = "Pause";
                    game.started = false;
                    game.timerStarted = false;
                    game.timer = 30;
                    game.socket.forEach(socket => {
                        if (socket.readyState === 1) {
                            socket.send(JSON.stringify({message: "Pause"}));
                        }
                    });
                }
                break;
            }   
        }
        ws.close(); 
    })
})

function loadSprite(game) {

    let size = imageSize("assets/Board.png");

    game.board.position.x = 0;
    game.board.position.y = 0;
    game.board.imgSize.height = size.height;
    game.board.imgSize.width = size.width;

    size = imageSize("assets/Ball.png");

    game.ball.imgSize.height = size.height;
    game.ball.imgSize.width = size.width;
    game.ball.position.x = game.board.imgSize.width / 2 - game.ball.imgSize.width / 2;
    game.ball.position.y = game.board.imgSize.height / 2 - game.ball.imgSize.height / 2;

    size = imageSize("assets/Player.png");

    game.player1.sprite.position.x = 0;
    game.player1.sprite.position.y = game.board.imgSize.height / 2 - size.height / 2;
    game.player1.sprite.imgSize.height = size.height;
    game.player1.sprite.imgSize.width = size.width;

    size = imageSize("assets/Player2.png");

    game.player2.sprite.position.x = game.board.imgSize.width - size.width;
    game.player2.sprite.position.y = game.board.imgSize.height / 2 - size.height / 2;
    game.player2.sprite.imgSize.height = size.height;
    game.player2.sprite.imgSize.width = size.width;
}

//#region Alias

fastify.post("/tournamentAlias", async (request, reply) => {
    const { alias, mode, tournament_id } = request.body || {};
    const userId = request.headers["x-user-id"];

    if (!alias) {
        return reply.code(400).send(JSON.stringify("Alias required"));
    }

    if (!mode) {
        return reply.code(400).send(JSON.stringify("Mode required"));
    }

    if (!tournament_id) {
        return reply.code(400).send(JSON.stringify("Tournament id required"));
    }
   
    try {
        if (mode === "remote") {
            console.log("ALIAS: ", alias);
            if (!tournamentAlias.has(Number(tournament_id)))
                tournamentAlias.set(Number(tournament_id), [[Number(userId), alias[0]]]);
            else {
                const aliasTab = tournamentAlias.get(Number(tournament_id));
                for (let i = 0; i < aliasTab.length; i++) {
                    console.log("aliastab: ", aliasTab[i][1]);
                    if (alias[0] === aliasTab[i][1])
                        throw new Error("Alias already taken");
                }
                aliasTab.push([Number(userId), alias[0]]);
            }
            console.log("TOURNAMENT ALIAS: ", tournamentAlias);
        }
        else if (mode === "local") {
            console.log("ALIAS: ", alias);
            tournamentAlias.set(Number(tournament_id), []);
            const aliasTab = tournamentAlias.get(Number(tournament_id));
            for (let i = 0; i < alias.length; i++) {
                aliasTab.push([Number(userId) + i, alias[i]]);
            }
            console.log("TOURNAMENT ALIAS: ", tournamentAlias);  
        }
        reply.code(200).send(JSON.stringify({message: "Success"}));
    }catch(error) {
        console.log("Error in alias API route: ", error.message);
        reply.code(400).send(JSON.stringify({message: "Error", error: error.message}));
    }
}) 
// END


//#region Delete Alias

fastify.post("/deleteAlias", async (request, reply) => {
    const { tournament_id, message } = request.body || {};
    const userId = request.headers["x-user-id"]
    if (!tournament_id) {
        return reply.code(400).send(JSON.stringify("Tournament id required"));
    }
    if (!message) {
        return reply.code(400).send(JSON.stringify("Message required"));
    }
    if (!userId) {
        return reply.code(400).send(JSON.stringify("User id required"));
    }
    
    try {
        if (message === "deleteAlias") {
            let found = false;
            if (!tournamentAlias.has(Number(tournament_id)))
                throw new Error("Tournament not found");
            console.log("userid = ", userId);
            let aliases = tournamentAlias.get(Number(tournament_id));
            for (const data of aliases.values()) {
                if (Number(data[0]) === Number(userId)) {
                    found = true;
                    console.log("IN DELETE ALIAS, BEFORE: ", aliases);
                    tournamentAlias.set(Number(tournament_id),  aliases.filter(data => Number(data[0]) !== Number(userId)));
                    console.log("IN DELETE ALIAS, AFTER: ", aliases);
                    console.log("IN DELETE TOURNAMENT ALIAS, AFTER: ", tournamentAlias);
                    break;
                }
            }
            if (!found)
                throw new Error("User not found");
        }
        else if (message === "deleteTournament") {
            console.log("IN DELETE TOURNAMENT, BEFORE: ", tournamentAlias)
            tournamentAlias.delete(Number(tournament_id));
            console.log("IN DELETE TOURNAMENT, AFTER: ", tournamentAlias)
        }
        reply.code(200).send(JSON.stringify({message: "Success"}));
    }catch(error) {
        console.log("Error in alias API route: ", error.message);
        reply.code(400).send(JSON.stringify({message: "Error", error: error.message}));
    }
}) 
// END

// #region local
fastify.get("/local", async (request, reply) => {
    const userId = request.headers["x-user-id"];
    
    for (const [gameId, game] of games.entries() ) {
        if (parseInt(game.player1.id, 10) === parseInt(userId, 10) || parseInt(game.player2.id, 10) === parseInt(userId, 10)) {
            console.log("GAME FOUND");
            // if (game.message === "Pause") {
            //     console.log("GAME PAUSED");
            if (game.message === "Pause")
                reply.send({message: "Success", id: game.id, state: "InitRemote"});
            else
                reply.code(400).send(JSON.stringify({message: "Error", error: "You're already in game"}));
            return ;
            // }
        }           
    }
    try {
        const game = new Game({
          id: parseInt(userId, 10),
          socket: [],
          mode: 'local',
          message: 'start'
        })
        loadSprite(game);
        game.player1.name = "Player1";
        game.player1.id = userId;
        game.player2.name = "Player2";
        games.set(game.id, game);
        reply.send({message: "Success", id: game.id, state: "InitLocal"});
    } catch (e) {
        console.log("Error in local API route: ", e.message);
        reply.code(400).send({message: "error", error: e.message});
    }
})
// END local

//remote

async function getUserName(id) {
    try {
        const res = await fetch(`http://users:3000/get-user/${id}`);
        if (!res) {
            const text = await res.text();
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to fetch user information`);
        }
        const user = await res.json();
        return user.name;
    } catch(e) {
        console.log("getUserName error: ", e.message);
        throw new Error("Fetch data from docker users failed")
    }
}
// #region getAlias
function getAlias(id, tournamentId) {
    if(!tournamentAlias.has(Number(tournamentId)))
        return null;
    const aliases = tournamentAlias.get(Number(tournamentId));
    for (const [userId, alias] of aliases) {
        if (parseInt(userId, 10) === parseInt(id, 10)) {
            return alias;
        }            
    }
    return null; 
}

async function private_matchmaking(message, userId, body, headers, reply) {
    console.log("Message: ", message);
    if (message === "invit") {
        const game = new Game({
            id: Number(userId),
            socket: [],
            mode: 'remote',
            message: "Waiting"
        })
        loadSprite(game);
        game.player1.id = userId;
        game.player1.name = await getUserName(userId);
        game.player1.status = "Online";
        games.set(game.id, game);
        console.log("GAME ID: ", game.id);
        reply.send({message: "Success", id: game.id, state: "InitRemote"});
    }
    else if (message === "accept-invit") {
        const {friendId} = body || {};

        if (!friendId)
            throw new Error("Friend id required");

        let gameFound = false;
        for (const [gameId, game] of games.entries() ) {
            if (parseInt(game.player1.id, 10) === parseInt(friendId, 10)) {
                gameFound = true;
                game.player2.id = userId;
                game.player2.name = await getUserName(userId);
                game.player2.status = "Online";
                games.set(game.id, game);
                reply.send({message: "Success", id: game.id, state: "InitRemote"});
                break;
            }            
        }
        const res = await fetch(`http://users:3000/clear-invit/${friendId}`, {
            method: "POST",
            headers: {
                "x-user-id": userId,
                "authorization": headers["authorization"],
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ gameType: `pong` })
        });
        if (!res.ok) {
            console.error("Could not clear invit");
            // return;
        }
        if (gameFound === false)
            return reply.send({message: "deny-invit"});
    }
    else if (message === "deny-invit") {
        const {friendId} = body || {};

        if (!friendId)
            throw new Error("Friend id required");

        for (const [gameId, game] of games.entries() ) {
            if (parseInt(game.player1.id, 10) === parseInt(friendId, 10)) {
                game.socket[0].send(JSON.stringify({message: "deny-invit"}));
                break;
            }           
        }
        const res = await fetch(`http://users:3000/clear-invit/${friendId}`, {
            method: "POST",
            headers: {
                "x-user-id": userId,
                "authorization": headers["authorization"],
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ gameType: `pong` })
        });
        if (!res.ok) {
            console.error("Could not clear invit");
            return;
        }
    }
}

async function public_matchmaking(userId, reply) {
    queue.push([userId, await getUserName(userId)]);
    if (findRemotePendingGame() === false) {
        const game = new Game({
            id: parseInt(userId, 10),
            socket: [],
            mode: 'remote',
            message: "Waiting"
        })
        loadSprite(game);
        game.player1.id = queue[0][0];
        game.player1.name = queue[0][1];
        game.player1.status = "Online";
        pendingRemoteGame.push(game);
        games.set(game.id, game);
        reply.send({message: "Success", id: game.id, state: "InitRemote"});
    }
    else {
        const gameTemp = pendingRemoteGame.shift();
        const game = games.get(gameTemp.id);
        game.player2.id = queue[0][0];
        game.player2.name = queue[0][1];
        game.player2.status = "Online";
        games.set(game.id, game);
        reply.send({message: "Success", id: game.id, state: "InitRemote"});
    }
    queue.shift();
}

function findRemotePendingGame() {
    if (pendingRemoteGame.length === 0)
        return false;
    return true;
}
// #region remote
fastify.post("/remote", async (request, reply) => {
    try {
        const {message} = request.body || {};
	    const userId = request.headers["x-user-id"];

        for (const [gameId, game] of games.entries() ) {
            if (parseInt(game.player1.id, 10) === parseInt(userId, 10) || parseInt(game.player2.id, 10) === parseInt(userId, 10)) {
                console.log("GAME FOUND");
                // if (game.message === "Pause") {
                //     console.log("GAME PAUSED");
                if (game.message === "Pause")
                    reply.send({message: "Success", id: game.id, state: "InitRemote"});
                else
                    reply.code(400).send(JSON.stringify({message: "Error", error: "You're already in game"}));
                return ;
                // }
            }           
        }
        if (!message)
            throw new Error("Pong server: Message required");

        if (message === "invit" || message === "accept-invit" || message === "deny-invit")
            await private_matchmaking(message, userId, request.body, request.headers, reply);
        else if (message === "matchmaking") 
            await public_matchmaking(userId, reply);
        else
            throw new Error("Pong server: Unknown game mode");
    } catch (e) {
        console.log("Error in remote API route: ", e.message);
        reply.code(400).send({message: "error", error: e.message});
    }
})
//END remote 

// #region local tournament
async function createLocalTournament(match, rmId, id) {
    return new Promise(async (resolve, reject) => {
        try {
            const game = new Game({
                id: parseInt(match[0], 10),
                socket: [],
                mode: 'local-tournament',
                status: 'Playing',
                message: "start",
            })
            loadSprite(game);
            game.player1.id = match[0];
            game.player1.name = getAlias(match[0], id);
            game.player2.id = match[1];
            game.player2.name = getAlias(match[1], id);
            console.log("RMID: ", rmId)
            game.socket.push(tournamentSocket.get(Number(rmId)));
            game.tournament_id = id;
            games.set(game.id, game);
            game.socket.forEach(socket => {
                if (socket.readyState === 1) {
                    socket.send(JSON.stringify({game, message: "Init"}));
                }
            })
            console.log("Starting match");
            game.loopId = setInterval(() => gameLoop(game), 16);
    
            const intervalId = setInterval(() => {
                if (game.message === "END") {
                    clearInterval(intervalId);
                    resolve();
                }
            }, 100)
        }catch(err) {
            console.log("ERROR IN CREATE TOURNAMENT: ", err);
            reject(err);
        }

    })
}


fastify.post("/localTournament", async (request, reply) => {
    const { schedule, rmId, id, nb_player } = request.body || {};
    
    if (!schedule) {
        return reply.code(400).send({error: "schedule is missing"});
    }

    if (!rmId) {
        return reply.code(400).send({error: "room master id is missing"});
    }
    if (!id) {
        return reply.code(400).send({error: "tournament id is missing"});
    }
    const names = [];
    let i = 0;
    let j = 0;
    for (const round of schedule) {
        const matchup = []
        for (const match of round) {
            const name1 = getAlias(match[0], id);
            const name2 = getAlias(match[1], id);
            matchup.push([name1, name2]);
        }
        names.push(matchup);
    }
    let webSocket = tournamentSocket.get(Number(rmId));
    try {
        for (const round of schedule) {
            for (const match of round) {
                const roundName = names[i][j];
                console.log("roundName: ", roundName)
                if (webSocket.readyState === 1)
                    webSocket.send(JSON.stringify({message: "Schedule", scheduleNames: [roundName]}));
                await new Promise(resolve => setTimeout(resolve, 4000));
                await createLocalTournament(match, rmId, id);
                j++;
            }
            j = 0;
            i++;
        }
        const winner = sendTournamentResult(id);
        reply.send({message: "Success", winner: winner});
        //cleanup
        tournamentAlias.delete(Number(id)); 
        tournamentSocket.delete(parseInt(rmId, 10));
        console.log("Tournament alias after tournament end: ", tournamentAlias);
        webSocket.close();
    }catch(err) {
        console.log("ERROR IN local TOURNAMENT: ", err.message);
        reply.code(400).send({error: "Fail to create game"});
    }
})

// #region remote tournament // 

async function createRemoteTournament(match, tournamentId) {
    return new Promise(async (resolve, reject) => {
        try {
            const game = new Game({
                id: parseInt(match[0], 10),
                socket: [],
                mode: 'remote-tournament',
                status: 'Playing',
                message: "start",
            })
            loadSprite(game);
            game.player1.id = match[0];
            game.player1.name = getAlias(match[0], tournamentId);
            game.player2.id = match[1];
            game.player2.name = getAlias(match[1], tournamentId);
            if (tournamentSocket.get(parseInt(match[0])) === undefined) {
                game.player1.status = "Disconnected";
                game.message = "Pause";
                game.timer = 30;
                console.log("Player 1 disconnected");
            }
            else {
                game.socket.push(tournamentSocket.get(parseInt(match[0])));
                // game.socket[0].surname = game.player1.name;
                game.player1.status = "Online";
            }
            if (tournamentSocket.get(parseInt(match[1])) === undefined) {
                game.player2.status = "Disconnected";
                game.message = "Pause";
                game.timer = 30;
                console.log("Player 2 disconnected");
            }
            else {
                game.socket.push(tournamentSocket.get(parseInt(match[1])));
                // game.socket[1].surname = game.player2.name;
                game.player2.status = "Online";
            }
            game.tournament_id = tournamentId;
            games.set(game.id, game);
            game.socket.forEach(socket => {
                if (socket.readyState === 1) {
                    socket.send(JSON.stringify({game, message: "Init"}));
                }
            })
            console.log("Starting match");
            game.loopId = setInterval(() => gameLoop(game), 16);
    
            const intervalId = setInterval(() => {
                if (game.message === "END") {
                    clearInterval(intervalId);
                    resolve();
                }
            }, 100)
        }catch(err) {
            console.log("ERROR IN CREATE TOURNAMENT: ", err);
            reject(err);
        }

    })
}

function sendTournamentResult(id) {
    console.log("TOURNAMENT SCORE: ", tournamentScore);
    const scores = tournamentScore.get(Number(id));
    if (scores === undefined)
        throw new Error(`NO SCORE FOUND FOR THIS TOURNAMENT`);
    console.log("AVANT LE TRI: ", scores);
    scores.sort((score1, score2) => score2[1] - score1[1]);
    console.log("APRES LE TRI: ", scores);
    for (const socket of tournamentSocket.values()) {
        if (parseInt(socket.tournament_id, 10) === parseInt(id, 10))
            socket.send(JSON.stringify({message: "TournamentEnd", winner: scores[0][0]}))
    }
    return scores[0][0];
}

fastify.post("/remoteTournament", async (request, reply) => {
    const { schedule, id } = request.body || {};
    const names = [];
    if (!schedule) {
        return reply.code(400).send({error: "schedule is empty"});
    }

    if (!id) {
        return reply.code(400).send({error: "id is empty"});
    }
    for (const round of schedule) {
        const matchup = []
        for (const match of round) {
            const name1 = getAlias(match[0], id);
            const name2 = getAlias(match[1], id);
            matchup.push([name1, name2]);
        }
        names.push(matchup);
    }
    console.log("schedule : ", schedule);
    console.log("scheduleNames : ", names);
    let i = 0;
    try {
        for (const round of schedule) {
            for (const socket of tournamentSocket.values()) {
                if (parseInt(socket.tournament_id, 10) === parseInt(id, 10)) {
                    const roundName = names[i].filter(data => String(data[0]) === String(getAlias(socket.userId, id)) || String(data[1]) === String(getAlias(socket.userId, id)));
                    console.log("roundName: ", roundName)
                    if (roundName) {
                        if (socket.readyState === 1)
                            socket.send(JSON.stringify({message: "Schedule", scheduleNames: roundName}));
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, 4000));        
            await Promise.all(round.map(match => createRemoteTournament(match, id)));
            i++;
        }
        const winner = sendTournamentResult(id);
        reply.send({message: "Success", winner: winner});
        //Cleanup
        for (const [userId, socket] of tournamentSocket.entries()) {
            if (Number(socket.tournament_id) === Number(id)) {
                tournamentSocket.delete(parseInt(userId, 10));
                socket.close();
            }
        }
        tournamentAlias.delete(Number(id));
        console.log("Tournament alias after tournament end: ", tournamentAlias);
        console.log("Tournament socket: ", tournamentSocket);
    }catch(err) {
        console.log("ERROR IN REMOTE TOURNAMENT: ", err.message);
        reply.code(400).send({error: err.message});
    }
})
// #endregion remote tournament //

fastify.post("/input", async (request, reply) => {
    const {gameId, key} = request.body || {};
    const userId = request.headers["x-user-id"];
    try {
        if (!gameId)
            throw new Error("Game id required");
        if (!userId)
            throw new Error("User id required");
        if (key) {
            if (!games.has(parseInt(gameId, 10))) {
                reply.send(JSON.stringify({ error: "Game not found" }));
                return;
            }
            const game = games.get(parseInt(gameId, 10));
            if (game.message === "Playing") {
                if (game.mode === "local") {
                    localInputHandler(game, key, "keydown");
                    updatePlayersPosition(game);
                    localInputHandler(game, key, "keyup");
                }
                else if (game.mode === "remote" || game.mode === "tournament") {
                    remoteInputHandler(game, userId, key, "keydown");
                    updatePlayersPosition(game);
                    remoteInputHandler(game, userId, key, "keyup");
                }
            }
            else
                throw new Error("Game haven't started yet");
        }
    } catch (e) {
        console.log("Error, in API ROUTE INPUT: ", e.message);
        reply.send(JSON.stringify({ error: e.message }));
    }
})


fastify.get("/state/:id", async (request, reply) => {
    try {
        const id = parseInt(request.params.id, 10);
        if (!games.has(id)) {
            return reply.status(404).send({ error: "Game not found" });
        }
        const game = games.get(id);
        console.log("GAME FOUND");
        reply.send(JSON.stringify(game));
    }catch(e) {
        reply.status(404).send({ error: e.message });
    }
})

const start = async () => {
  try {
    const server = await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening at ${server}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();