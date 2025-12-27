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
            game.message = "Playing"
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
               matchType: game.mode,
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

function updatePlayersPosition(game) {
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
}

function updateBallPosition(game) {
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
        updatePlayersPosition(game)
        updateBallPosition(game)
        if (game.player1.score === 5) {
            game.message = "END"
            game.winner = game.player1.name
            game.displayWinner = game.player1.name + " wins"
        }
        else if (game.player2.score === 5) {
            game.message = "END"
            game.winner = game.player2.name
            game.displayWinner = game.player2.name + " wins"
        }
        game.socket.forEach(socket => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify(serialize(game)));
            }
        })
    }
    if (game.message === "END") {
        if (game.mode === "remote" || game.mode === "tournament")
            sendResult(game)
        clearInterval(game.loopId)
    }
}

function serialize(data) {
    const game = {
        id: data.id,
        message: data.message,
        displayWinner: data.displayWinner,
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
    return game
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
        ws.userId = game.player1.id
    } else if (ws.userId === undefined && game.socket.length === 1) {
        ws.userId = game.player2.id
        game.message = "start"
    }
    game.socket.push(ws)
    ws.send(JSON.stringify({game: serialize(game), message: "Init"}))
    if (game.message === "start")
        game.loopId = setInterval(() => gameLoop(game), 16)
}

function TournamentHandler(id, gameId, tournament_id, ws) {
    ws.userId = id
    ws.gameId = gameId
    ws.tournament_id = tournament_id
    tournamentSocket.set(parseInt(id, 10), ws)
}

function localInputHandler(game, key, event) {
    if (event === "keydown") {
        if (key === 'a')
            game.player1.key.up = true
        else if (key === 'd')
            game.player1.key.down = true
        else if (key === "ArrowLeft")
            game.player2.key.up = true
        else if (key === "ArrowRight")
            game.player2.key.down = true
    } else if (event === "keyup") {
         if (key === 'a')
            game.player1.key.up = false
        else if (key === 'd')
            game.player1.key.down = false
        else if (key === "ArrowLeft")
            game.player2.key.up = false
        else if (key === "ArrowRight")
            game.player2.key.down = false       
    }
}

function remoteInputHandler(game, userId, key, event) {
    console.log("USER ID: ", userId)
    console.log("int USER ID: ", parseInt(userId, 10))
    console.log("PLAYER 1 ID: ", parseInt(game.player1.id, 10))
    console.log("PLAYER 2 ID: ", parseInt(game.player2.id, 10))
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
        const res = JSON.parse(data.toString())
        if (res.message === "InitLocal") 
            localGamehandler(res.id, ws)
        else if (res.message === "InitRemote") 
            RemoteGamehandler(res.id, ws)
        else if (res.message === "InitTournament")
            TournamentHandler(res.id, res.gameId, res.tournament_id, ws)
        else if (res.message === "input") {
            if (!games.has(parseInt(res.id, 10))) {
                ws.send(JSON.stringify({ message: "Error", error: "Game not found" }))
                return
            }
            const game = games.get(parseInt(res.id, 10))
            if (game.mode === "local")
                localInputHandler(game, res.key, res.event)
            else if (game.mode === "remote" || game.mode === "tournament")
                remoteInputHandler(game, ws.userId, res.key, res.event)
            games.set(game.id, game)
        }
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
        games.set(game.id, game)
        reply.send({message: "Success"})
    } catch (e) {
        console.log("Error in local API route: ", e.message)
        reply.code(400).send({message: "error", error: e.message})
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
        console.log("getUserName error: ", e.message)
    }
}

async function private_matchmaking(message, userId, body, headers, reply) {
    if (message === "invit") {
        const game = new Game({
            id: gameId++,
            socket: [],
            mode: 'remote',
            message: "Waiting"
        })
        loadSprite(game)
        game.player1.id = userId
        game.player1.name = await getUserName(userId)
        games.set(game.id, game)
        reply.send({message: "Success", id: game.id})
    }
    else if (message === "accept-invit") {
        const {friendId} = body || {}

        if (!friendId)
            throw new Error("Friend id required")

        let gameFound = false
        for (const [gameId, game] of games.entries() ) {
            if (parseInt(game.player1.id, 10) === parseInt(friendId, 10)) {
                gameFound = true
                game.player2.id = userId
                game.player2.name = await getUserName(userId)
                games.set(game.id, game);
                reply.send({message: "Success", id: game.id})
                break
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
            return reply.send({message: "deny-invit"})
    }
    else if (message === "deny-invit") {
        const {friendId} = body || {}

        if (!friendId)
            throw new Error("Friend id required")

        for (const [gameId, game] of games.entries() ) {
            if (parseInt(game.player1.id, 10) === parseInt(friendId, 10)) {
                game.socket[0].send(JSON.stringify({message: "deny-invit"}))
                break
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
    queue.push([userId, await getUserName(userId)])
    console.log(queue)
    if (findRemotePendingGame() === false) {
        const game = new Game({
            id: parseInt(userId, 10),
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
        games.set(game.id, game)
        reply.send({message: "Success", id: game.id})
    }
    queue.shift()
}

function findRemotePendingGame() {
    if (pendingRemoteGame.length === 0)
        return false
    return true
}

fastify.post("/remote", async (request, reply) => {
    try {
        const {message} = request.body || {}
	    const userId = request.headers["x-user-id"]

        if (!message)
            throw new Error("Pong server: Message required")

        if (message === "invit" || message === "accept-invit" || message === "deny-invit")
            await private_matchmaking(message, userId, request.body, request.headers, reply)
        else if (message === "matchmaking") 
            await public_matchmaking(userId, reply)
        else
            throw new Error("Pong server: Unknown game mode")
    } catch (e) {
        console.log("Error in remote API route: ", e.message)
        reply.code(400).send({message: "error", error: e.message})
    }
})
//END remote 

async function createLocalTournament(match, rmId) {
    return new Promise(async (resolve, reject) => {
        try {
            const game = new Game({
                id: parseInt(match[0], 10),
                socket: [],
                mode: 'local',
                status: 'Playing',
                message: "start",
            })
            loadSprite(game)
            game.player1.id = match[0]
            game.player1.name = "player1"
            game.player2.id = match[1]
            game.player2.name = "player2"
            game.socket.push(tournamentSocket.get(parseInt(rmId)))
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

async function createRemoteTournament(match) {
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

fastify.post("/localTournament", async (request, reply) => {
    const { schedule, rmId } = request.body || {}

    if (!schedule || !rmId) {
        return reply.code(400).send({error: "schedule is empty"})
    }

    try {
        for (const round of schedule) {
            for (const match of round) {
                    await createLocalTournament(match, rmId)
            }
        }
        reply.send({message: "Success"})
    }catch(err) {
        console.log("ERROR IN local TOURNAMENT: ", err.message)
        reply.code(400).send({error: "Fail to create game"});
    }
})

fastify.post("/remoteTournament", async (request, reply) => {
    const { schedule } = request.body || {}

    if (!schedule) {
        return reply.code(400).send({error: "schedule is empty"})
    }

    try {
        for (const round of schedule) {
            await Promise.all(round.map(match => createRemoteTournament(match)))
        }
        reply.send({message: "Success"})
    }catch(err) {
        console.log("ERROR IN REMOTE TOURNAMENT: ", err.message)
        reply.code(400).send({error: "Fail to create game"});
    }
})


fastify.post("/input", async (request, reply) => {
    const {gameId, key} = request.body || {}
    const userId = request.headers["x-user-id"]
    try {
        if (!gameId)
            throw new Error("Game id required")
        if (!userId)
            throw new Error("User id required")
        if (key) {
            if (!games.has(parseInt(gameId, 10))) {
                reply.send(JSON.stringify({ error: "Game not found" }))
                return
            }
            const game = games.get(parseInt(gameId, 10))
            if (game.message === "Playing") {
                if (game.mode === "local") {
                    localInputHandler(game, key, "keydown")
                    updatePlayersPosition(game)
                    localInputHandler(game, key, "keyup")
                }
                else if (game.mode === "remote" || game.mode === "tournament") {
                    remoteInputHandler(game, userId, key, "keydown")
                    updatePlayersPosition(game)
                    remoteInputHandler(game, userId, key, "keyup")
                }
            }
            else
                throw new Error("Game haven't started yet")
        }
    } catch (e) {
        console.log("Error, in API ROUTE INPUT: ", e.message)
        reply.send(JSON.stringify({ error: e.message }))
    }
})


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