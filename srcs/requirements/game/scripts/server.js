import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { Game } from './gameClass.js'
import fastifyWebsocket from '@fastify/websocket'
import cors from '@fastify/cors'

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

fastify.register(fastifyWebsocket)

fastify.get('/ws', { websocket: true }, (connection, req) => {
    console.log("CLIENT CONNECTER")
    connection.socket.on('message', message => {
        const input = JSON.parse(message.toString())
        console.log("Input reçu:", input)
    })
})

// A supprimer
fastify.get('/', (request, reply) => {
    reply.sendFile('scripts/index.html')
})

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
        reply.send({ status: 'Ok' })
    } catch (e) {
        console.log(e.message)
        reply.send({ status: 'Not ok' })
    }
})

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST })
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
