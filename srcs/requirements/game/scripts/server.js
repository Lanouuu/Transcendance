import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { Game } from './gameClass.js'
import cors from '@fastify/cors'
import {WebSocketServer} from 'ws'
import fs from 'fs'
import { imageSize } from "image-size"

const fastify = Fastify({
    logger: true,
    connectionTimeout: 120000,
    keepAliveTimeout: 120000,
    https: {
        key: fs.readFileSync('/etc/ssl/transcendence.key'),
        cert: fs.readFileSync('/etc/ssl/transcendence.crt') 
    }
 })
const PORT = parseInt(process.env.GAME_PORT, 10)
const HOST = process.env.GAME_HOST
const games = new Map()
let gameId = 0
const filename = fileURLToPath(import.meta.url)
const dirname = join(filename, '..')
let queue = []
let pendingRemoteGame = []
const tournamentSocket = new Map()
fastify.register(cors, { 
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
    credentials: true
})

fastify.register(fastifyStatic, {
  root: join(dirname, '..'),
})

function startTimer(game) {

    const intervalId = setInterval(() => {
        let i = 0
        game.socket.forEach(socket => {
            if (socket.readyState === 1) {
                i++
                socket.send(JSON.stringify({
                    message: "Countdown",
                    timer: game.timer
                }))
            }
        })
        game.timer--
        if (game.timer < 0) {
            clearInterval(intervalId)
            game.started = true
        }
    }, 1000)
}

async function sendResult(game) {
    let winner_id = undefined;
    if (game.player1.score === 5)
        winner_id = game.player1.id
    else
        winner_id = game.player2.id

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
               matchType: "remote",
               gameType: "pong",
             }),
           });

        if(!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to send result");
        }
    } catch(e) {
        console.log(e.error)
    }
}

function gameLoop(game) {
    if (game.board === undefined || game.socket === undefined) {
        console.log("Game not ready yet")
        return ;
    }
    if (game.timerStarted === false) {
        game.timerStarted = true
        startTimer(game)
    }
    if (game.started === true) {
        // Player 1
        if (game.player1.key.up) {

            if (game.player1.sprite.position.y - 15 <= 0)
                game.player1.sprite.position.y = 0
            else
                game.player1.sprite.position.y -=1 * 15
        }
        if (game.player1.key.down) {
            if (game.player1.sprite.position.y + 15 + game.player1.sprite.imgSize.height >= game.board.imgSize.height)
                game.player1.sprite.position.y = game.board.imgSize.height - game.player1.sprite.imgSize.height
            else
                game.player1.sprite.position.y +=1 * 15
        }
        // Player 2
        if (game.player2.key.up) {

            if (game.player2.sprite.position.y - 15 <= 0)
                game.player2.sprite.position.y = 0
            else
                game.player2.sprite.position.y -=1 * 15
        }
        if (game.player2.key.down) {
            if (game.player2.sprite.position.y + 15 + game.player2.sprite.imgSize.height >= game.board.imgSize.height)
                game.player2.sprite.position.y = game.board.imgSize.height - game.player2.sprite.imgSize.height
            else
                game.player2.sprite.position.y +=1 * 15
        }
        // Move Ball
        if (game.ball.position !== undefined) {
            game.ball.position.x += game.ball.velocity.x
            game.ball.position.y += game.ball.velocity.y

            if (game.ball.position.x + game.ball.imgSize.width < 0) {
                game.ball.position = {x: game.board.imgSize.width / 2, y:game.board.imgSize.height / 2}
                game.player2.score++
            }

            if (game.ball.position.x - game.ball.imgSize.width > game.board.imgSize.width) {
                game.ball.position = {x: game.board.imgSize.width / 2, y:game.board.imgSize.height / 2}
                game.player1.score++
            }
            if (game.ball.position.y <= 0 || game.ball.position.y + game.ball.imgSize.height >= game.board.imgSize.height)
                game.ball.velocity.y = -game.ball.velocity.y

            if (game.ball.position.x <= game.player1.sprite.position.x + game.player1.sprite.imgSize.width && game.ball.position.x >= game.player1.sprite.position.x && game.ball.position.y + game.ball.imgSize.height >= game.player1.sprite.position.y && game.ball.position.y <= game.player1.sprite.position.y + game.player1.sprite.imgSize.height) {
                game.ball.velocity.x = -game.ball.velocity.x
                game.ball.position.x = game.player1.sprite.position.x + game.player1.sprite.imgSize.width
            }
            
            if (game.ball.position.x + game.ball.imgSize.width >= game.player2.sprite.position.x && game.ball.position.x <= game.player2.sprite.position.x + game.player2.sprite.imgSize.width && game.ball.position.y + game.ball.imgSize.height >= game.player2.sprite.position.y && game.ball.position.y <= game.player2.sprite.position.y + game.player2.sprite.imgSize.height) {
                game.ball.velocity.x = -game.ball.velocity.x
                game.ball.position.x = game.player2.sprite.position.x - game.ball.imgSize.width
            }
        }
        game.message = "Playing"
        if (game.player1.score === 5) {
            game.message = "END"
            game.winner = "Player1"
            game.displayWinner = "Player 1 wins"
        }
        else if (game.player2.score === 5) {
            game.message = "END"
            game.winner = "Player2"
            game.displayWinner = "Player 2 wins"
        }
        game.socket.forEach(socket => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify(game));
            }
        })
    }
    if (game.message === "END") {
        if (game.mode === "remote" || game.mode === "tournament")
            sendResult(game)
        clearInterval(game.loopId)
    }
}

function localGamehandler(id, ws) {
    if (!games.has(parseInt(id, 10))) {
        ws.send(JSON.stringify({ message: "Error", error: "Game not found" }))
        return
    }
    const game = games.get(parseInt(id, 10))
    game.socket.push(ws)
    ws.send(JSON.stringify({game, message: "Init"}))
    if (game.message === "start")
        game.loopId = setInterval(() => gameLoop(game), 16)
}

function RemoteGamehandler(id, ws) {
    if (!games.has(parseInt(id, 10))) {
        ws.send(JSON.stringify({ message: "Error", error: "Game not found" }))
        return
    }

    const game = games.get(parseInt(id, 10))
    
    if (ws.userId === undefined && game.socket.length === 0) {
        console.log("PARING WEBSOCKET WITH PLAYER1")
        ws.userId = game.player1.id
        console.log("websocket is = ", ws.userId)
    } else if (ws.userId === undefined && game.socket.length === 1) {
        console.log("PARING WEBSOCKET WITH PLAYER2")
        ws.userId = game.player2.id
        console.log("websocket is = ", ws.userId)
        game.message = "start"
    }
    game.socket.push(ws)

    ws.send(JSON.stringify({game, message: "Init"}))
    if (game.message === "start")
        game.loopId = setInterval(() => gameLoop(game), 16)
}

function RemoteTournamentHandler(id, gameId, tournament_id, ws) {
    ws.userId = id
    ws.gameId = gameId
    ws.tournament_id = tournament_id
    tournamentSocket.set(parseInt(id, 10), ws)
}

function localInputHandler(game, res) {
    game.player1.key.up = res.game.player1.key.up
    game.player1.key.down = res.game.player1.key.down
    game.player2.key.up = res.game.player2.key.up
    game.player2.key.down = res.game.player2.key.down
}

function remoteInputHandler(game, res, ws) {
    if (parseInt(ws.userId, 10) === parseInt(game.player1.id, 10)) {
        game.player1.key.up = res.game.player1.key.up
        game.player1.key.down = res.game.player1.key.down
    } else if (parseInt(ws.userId, 10) === parseInt(game.player2.id, 10)) {
        game.player2.key.up = res.game.player2.key.up
        game.player2.key.down = res.game.player2.key.down
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

  ws.initialized = false
  ws.on('message', function message(data) {
    const res = JSON.parse(data.toString())
    if (res.message === "InitLocal") 
        localGamehandler(res.id, ws)
    else if (res.message === "InitRemote") 
        RemoteGamehandler(res.id, ws)
    else if (res.message === "InitRemoteTournament")
        RemoteTournamentHandler(res.id, res.gameId, res.tournament_id, ws)
    else if (res.message === "input") {
        if (!games.has(parseInt(res.game.id, 10))) {
            ws.send(JSON.stringify({ message: "Error", error: "Game not found" }))
            return
        }
        const game = games.get(parseInt(res.game.id, 10))
        if (game.mode === "local")
            localInputHandler(game, res)
        else if (game.mode === "remote" || game.mode === "tournament")
            remoteInputHandler(game, res, ws)
        games.set(game.id, game)
    }
    // if (res.game.mode === "tournament" && !ws.initialized) {
    //     if (res.message !== "InitSocket") {
    //         ws.send(JSON.stringify({
    //             message: "Error",
    //             error: "Your first message has to be InitSocket and send your userId"
    //         }))
    //         ws.close()
    //         return
    //     } else {
    //         ws.initialized = true
    //         ws.userId = res.game.creator_id
    //         ws.gameId = res.game.id
    //         tournamentSocket.set(parseInt(ws.userId, 10), ws)
    //         // console.log("When user send initSocket: ", tournamentSocket)
    //         // console.log("When user send initSocket: ", tournamentSocket.get(ws.userId))
    //         ws.send(JSON.stringify({message: "Initialized"}))
    //         return
    //     }
    // }
    // if (!games.has(parseInt(res.game.id, 10))) {
    //     ws.send(JSON.stringify({ message: "Error", error: "Game not found" }))
    //     return
    // }
    // const game = games.get(parseInt(res.game.id, 10))

    // if (res.message == "Init")
    // {
    //     if (game.mode === "remote") {
    //         if (ws.userId === undefined && game.socket.length === 0) {
    //             console.log("PARING WEBSOCKET WITH PLAYER1")
    //             ws.userId = game.player1.id
    //             console.log("websocket is = ", ws.userId)
    //         } else if (ws.userId === undefined && game.socket.length === 1) {
    //             console.log("PARING WEBSOCKET WITH PLAYER2")
    //             ws.userId = game.player2.id
    //             console.log("websocket is = ", ws.userId)
    //         }
    //     }
    //     game.socket.push(ws)
    //     if (game.message === "start")
    //         game.loopId = setInterval(() => gameLoop(game), 16)
    // }
    // else {
    //     if (game.mode === "remote") {
    //         if (ws.userId === game.player1.id) {
    //             game.player1.key.up = res.game.player1.key.up
    //             game.player1.key.down = res.game.player1.key.down
    //         } else if (ws.userId === game.player2.id) {
    //             game.player2.key.up = res.game.player2.key.up
    //             game.player2.key.down = res.game.player2.key.down
    //         }
    //     } else {
    //         game.player1.key.up = res.game.player1.key.up
    //         game.player1.key.down = res.game.player1.key.down
    //         game.player2.key.up = res.game.player2.key.up
    //         game.player2.key.down = res.game.player2.key.down
    //     }
    // }
    // games.set(game.id, game)
    // console.log("GAME AFTER SET IN WS CONNECTION = ", game)
  })
})

function loadSprite(game) {

    let size = imageSize("assets/Board.png")

    game.board.position.x = 0;
    game.board.position.y = 0;
    game.board.imgSize.height = size.height
    game.board.imgSize.width = size.width

    size = imageSize("assets/Ball.png")

    game.ball.imgSize.height = size.height
    game.ball.imgSize.width = size.width
    game.ball.position.x = game.board.imgSize.width / 2 - game.ball.imgSize.width / 2;
    game.ball.position.y = game.board.imgSize.height / 2 - game.ball.imgSize.height / 2;

    size = imageSize("assets/Player.png")

    game.player1.sprite.position.x = 0;
    game.player1.sprite.position.y = game.board.imgSize.height / 2 - size.height / 2;;
    game.player1.sprite.imgSize.height = size.height
    game.player1.sprite.imgSize.width = size.width

    size = imageSize("assets/Player2.png")

    game.player2.sprite.position.x = game.board.imgSize.width - size.width;
    game.player2.sprite.position.y = game.board.imgSize.height / 2 - size.height / 2;;
    game.player2.sprite.imgSize.height = size.height
    game.player2.sprite.imgSize.width = size.width
}

// local
fastify.get("/local", async (request, reply) => {
    try {
        const game = new Game({
          id: parseInt(request.headers["x-user-id"], 10),
          socket: [],
          mode: 'local',
          message: 'start'
        })
        loadSprite(game)
        console.log("GAME AT CREATION = ", game)
        games.set(game.id, game)
        console.log("Local game created with id:", game.id)
        reply.send({message: "Success"})
    } catch (e) {
        console.log(e.message)
        // a supprimer
        console.log("Error creating local game")
        reply.send([])
    }
})
// END local

//remote

async function getUserName(id) {
    try {
        const res = await fetch(`http://users:3000/get-user/${id}`)
        if (!res) {
            const text = await res.text()
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to fetch user information`);
        }
        const user = await res.json()
        return user.name
    } catch(e) {
        console.log("getUserName error: ", e.error)
    }
}

function findRemotePendingGame() {
    if (pendingRemoteGame.length === 0)
        return false
    return true
}

fastify.get("/remote", async (request, reply) => {
    try {
	    const userId = request.headers["x-user-id"]
        queue.push([userId, await getUserName(userId), reply])
        console.log(queue)
        if (findRemotePendingGame() === false) {
            const game = new Game({
                id: gameId++,
                socket: [],
                mode: 'remote',
                message: "Waiting"
            })
            loadSprite(game)
            game.player1.id = queue[0][0]
            game.player1.name = queue[0][1]
            pendingRemoteGame.push(game)
            games.set(game.id, game)
            reply.send({message: "Success", id: game.id})
        }
        else {
            const gameTemp = pendingRemoteGame.shift()
            const game = games.get(gameTemp.id)
            game.player2.id = queue[0][0]
            game.player2.name = queue[0][1]
            // game.message = "start"
            games.set(game.id, game)
            reply.send({message: "Success", id: game.id})
            // if (game.socket[0].readyState === WebSocket.OPEN) {
            //     game.socket.forEach(socket => {
            //        if (socket.readyState === 1) {
            //            socket.send(JSON.stringify(game));
            //        }
            //    })
            // }
        }
        queue.shift()
    } catch (e) {
        console.log(e.message)
        // a supprimer
        console.log("Error creating local game")
        reply.send([])
    }
})
//END remote 


async function createTournament(match) {
    return new Promise(async (resolve, reject) => {
        try {
            const game = new Game({
                id: parseInt(match[0], 10),
                socket: [],
                mode: 'tournament',
                status: 'Playing',
                message: "start",
            })
            loadSprite(game)
            game.player1.id = match[0]
            game.player1.name = await getUserName(match[0])
            game.player2.id = match[1]
            game.player2.name = await getUserName(match[1])
            game.socket.push(tournamentSocket.get(parseInt(match[0])))
            game.socket.push(tournamentSocket.get(parseInt(match[1])))
            // game.tournament_id = game.socket[0].tournament_id
            games.set(game.id, game)
            game.socket.forEach(socket => {
                if (socket.readyState === 1) {
                    socket.send(JSON.stringify({game, message: "Init"}));
                }
            })
            console.log("Starting match")
            game.loopId = setInterval(() => gameLoop(game), 16)
    
            const intervalId = setInterval(() => {
                if (game.message === "END") {
                    clearInterval(intervalId)
                    resolve()
                }
            }, 100)
        }catch(err) {
            console.log("ERROR IN CREATE TOURNAMENT: ", err)
            reject(err)
        }

    })
}

fastify.post("/remoteTournament", async (request, reply) => {
    const { schedule } = request.body || {}

    if (!schedule) {
        return reply.code(400).send({error: "schedule is empty"})
    }

    try {
        for (const round of schedule) {
            await Promise.all(round.map(match => createTournament(match)))
        }
    }catch(err) {
        console.log("ERROR IN REMOTE TOURNAMENT: ", err.message)
        reply.code(400).send({error: "Fail to create game"});
    }
})


// fastify.post("/input", async (request, reply) => {
//     try {
//         const id = parseInt()
//         reply.send(game)
//     } catch (e) {
//         console.log(e.message)
//         // a supprimer
//         console.log("Error creating local game")
//         reply.send([])
//     }
// })


fastify.get("/state/:id", async (request, reply) => {
    try {
        const id = parseInt(request.params.id, 10)
        if (!games.has(id)) {
            return reply.status(404).send({ error: "Game not found" });
        }
        const game = games.get(id)
        console.log("GAME FOUND")
        reply.send(JSON.stringify(game));
    }catch(e) {
        reply.status(404).send({ error: e.message })
    }
})

// fastify.post("/state/:id", async (request, reply) => {
//     try {
//         const id = parseInt(request.params.id, 10)
//         if (!games.has(id)) {
//             return reply.status(404).send({ error: "Game not found" });
//         }
//         const game = request.body.game
//         console.log("GAME AFTER FRONT POST = ", game)
//         games.set(id, game)
//         reply.send({ status: 'Ok' })
//     } catch (e) {
//         console.log(e.message)
//         reply.send({ status: 'Not ok' })
//     }
// })

const start = async () => {
  try {
    const server = await fastify.listen({ port: PORT, host: HOST })
    console.log(`Server listening at ${server}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()