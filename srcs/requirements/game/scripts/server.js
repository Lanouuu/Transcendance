import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { Game } from './gameClass.js'
import cors from '@fastify/cors'
import {WebSocketServer} from 'ws'

const fastify = Fastify({ logger: true })
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


const wss = new WebSocketServer({ port: 8081 });

wss.on('listening', () => {
  console.log("WebSocket server running on ws://localhost:8081")
})

wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    console.log("MESSAGE RECU")
    const res = JSON.parse(data.toString())

    if (!games.has(res.id)) {
      return reply.status(404).send({ error: "Game not found" });
    }
    const game = games.get(res.id)
    game.player1.key.up = res.key.a.pressed
    game.player1.key.down = res.key.d.pressed
    game.player2.key.up = res.key.up.pressed
    game.player2.key.down = res.key.down.pressed
    // ws.send(JSON.stringify(game))
  });

  ws.send('WELCOME TO THE WEBSOCKET SERVER');
});

setInterval(() => {
  for (const game of games.values()) {
    if (game.board === undefined)
      continue;
      // Player 1
    if (game.player1.key.up){

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
    if (game.player2.key.up){

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
    // ws.send(JSON.stringify(game))
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(game));
        }
      });
} 
}, 16)

fastify.get("/local", async (request, reply) => {
    try {
        const game = new Game({
            id: gameId++,
        })
        games.set(game.id, game)
        console.log("Local game created with id:", game.id)
        reply.send({game})
    } catch (e) {
        console.log(e.message)
        // a supprimer
        console.log("Error creating local game")
        reply.send([])
    }
})

fastify.post("/state/:id", async (request, reply) => {
    try {
        const id = parseInt(request.params.id, 10)
        if (!games.has(id)) {
            return reply.status(404).send({ error: "Game not found" });
        }
        const game = request.body.game
        games.set(id, game)
        console.log(game)
        reply.send({ status: 'Ok' })
    } catch (e) {
        console.log(e.message)
        reply.send({ status: 'Not ok' })
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
