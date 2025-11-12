import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { Game } from './gameClass.js'
import cors from '@fastify/cors'
import {WebSocketServer} from 'ws'
import fs from 'fs'

const fastify = Fastify({
    logger: true,
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

fastify.register(cors, { 
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
    credentials: true
});

fastify.register(fastifyStatic, {
  root: join(dirname, '..'),
})

// A supprimer
fastify.get('/', (request, reply) => {
    reply.sendFile('scripts/index.html')
})


const wss = new WebSocketServer({ 
    host: '0.0.0.0',
    port: 8081,
});

wss.on('listening', () => {
  console.log("WebSocket server running on ws://localhost:8081")
})

wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    const res = JSON.parse(data.toString())
    // console.log("DATA RECEIVED IN WS CONNECTION = ", res)
    if (!games.has(parseInt(res.id, 10))) {
        ws.send(JSON.stringify({ message: "Error", error: "Game not found" }))
        return;
    }
    let game = games.get(res.id)
    if (res.message == "Init")
    {
        game = res
        game.socket.push(ws)
    }
    else {
        game.player1.key.up = res.player1.key.up
        game.player1.key.down = res.player1.key.down
        game.player2.key.up = res.player2.key.up
        game.player2.key.down = res.player2.key.down
    }
    games.set(game.id, game)
    // console.log("GAME AFTER SET IN WS CONNECTION = ", game)
  });
});

setInterval(() => {
    for (const game of games.values()) {
        if (game.board === undefined || game.socket === undefined) {
            continue;
        }
        // Player 1
        if (game.player1.key.up) {

            if (game.player1.position.y - 15 <= 0)
                game.player1.position.y = 0
            else
                game.player1.position.y -=1 * 15
        }
        if (game.player1.key.down) {
            if (game.player1.position.y + 15 + game.player1.height >= game.board.height)
                game.player1.position.y = game.board.height - game.player1.height
            else
                game.player1.position.y +=1 * 15
        }
        // Player 2
        if (game.player2.key.up) {

            if (game.player2.position.y - 15 <= 0)
                game.player2.position.y = 0
            else
                game.player2.position.y -=1 * 15
        }
        if (game.player2.key.down) {
            if (game.player2.position.y + 15 + game.player2.height >= game.board.height)
                game.player2.position.y = game.board.height - game.player2.height
            else
                game.player2.position.y +=1 * 15
        }
        // Move Ball
        if (game.ball.position !== undefined) {
            game.ball.position.x += game.ball.velocity.x
            game.ball.position.y += game.ball.velocity.y

            if (game.ball.position.x <= 0) {
                game.ball.position = {x: game.board.width / 2, y:game.board.height / 2}
                game.player2.score++
            }

            if (game.ball.position.x >= game.board.width) {
                game.ball.position = {x: game.board.width / 2, y:game.board.height / 2}
                game.player1.score++
            }
            if (game.ball.position.y <= 0 || game.ball.position.y + game.ball.height >= game.board.height)
                game.ball.velocity.y = -game.ball.velocity.y

            if (game.ball.position.x <= game.player1.position.x + game.player1.width && game.ball.position.x >= game.player1.position.x && game.ball.position.y + game.ball.height >= game.player1.position.y && game.ball.position.y <= game.player1.position.y + game.player1.height) {
                game.ball.velocity.x = -game.ball.velocity.x
                game.ball.position.x = game.player1.position.x + game.player1.width
            }

            if (game.ball.position.x + game.ball.width >= game.player2.position.x && game.ball.position.x <= game.player2.position.x + game.player2.width && game.ball.position.y + game.ball.height >= game.player2.position.y && game.ball.position.y <= game.player2.position.y + game.player2.height) {
                game.ball.velocity.x = -game.ball.velocity.x
                game.ball.position.x = game.player2.position.x - game.ball.width
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
        });
    } 
}, 16)

fastify.get("/local", async (request, reply) => {
    try {
        const game = new Game({
          id: gameId++,
          socket: [],
          mode: 'local',
        })
        // console.log("GAME AT CREATION = ", game)
        games.set(game.id, game)
        console.log("Local game created with id:", game.id)
        reply.send(game)
    } catch (e) {
        console.log(e.message)
        // a supprimer
        console.log("Error creating local game")
        reply.send([])
    }
})

// fastify.get("/remote", async (request, reply) => {
//     try {
//         const game = new Game({
//           id: gameId++,
//           socket: [],
//           mode: 'remote',
//         })
//         games.set(game.id, game)
//         console.log("Local game created with id:", game.id)
//         reply.send(game)
//     } catch (e) {
//         console.log(e.message)
//         // a supprimer
//         console.log("Error creating local game")
//         reply.send([])
//     }
// })

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
});

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

// export function runServer() {
    
//     const fastify = Fastify({ logger: true });
//     const PORT = parseInt(process.env.GAME_PORT, 10);
//     const HOST = process.env.GAME_HOST;


//     const filename = fileURLToPath(import.meta.url)
//     const dirname = join(filename, '..')

//     fastify.register(fastifyStatic, {
//         root: join(dirname, '..'),
//     })

//     // A supprimer
//     fastify.get('/', (request, reply) => {
//         reply.sendFile('scripts/index.html')
//     })
//     // A supprimer
//     fastify.get('/game', (request, reply) => {
//         reply.send( {obj: 'hello'})
//     })

//     // fastify.post("/state", async (request, reply) => {
//     //     reply.send({board: board, player: player, player2: player2, ball: ball});
//     // })

//     fastify.listen({host: HOST, port: PORT}, (err) => {
//         if (err) {
//             fastify.log.error(err);
//             process.exit(1);
//         }
//     })
// }

// runServer();
