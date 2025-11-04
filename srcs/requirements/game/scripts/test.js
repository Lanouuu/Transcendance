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

// Keep input state on the server and run a fixed tick loop that updates
// the game state and broadcasts it at a steady rate. This improves
// smoothness because all clients receive regular authoritative updates
// and we avoid doing expensive work on every single incoming message.

// We'll expect client messages like: { id, type: 'key', key: 'a', state: true }
wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    try {
      const res = JSON.parse(data.toString());
      // Validate
      if (!res || typeof res.id === 'undefined') return;
      if (!games.has(res.id)) {
        // send an error back to client, don't attempt to use Fastify reply here
        ws.send(JSON.stringify({ error: 'Game not found', id: res.id }));
        return;
      }
      const game = games.get(res.id);

      // Handle input messages: set key state rather than immediately mutating positions
      if (res.type === 'key') {
        // Initialize key objects if missing
        game.player1.key = game.player1.key || { up: false, down: false };
        game.player2.key = game.player2.key || { up: false, down: false };

        switch (res.key) {
          case 'a':
            game.player1.key.up = !!res.state;
            break;
          case 'd':
            game.player1.key.down = !!res.state;
            break;
          case 'ArrowLeft':
            game.player2.key.up = !!res.state;
            break;
          case 'ArrowRight':
            game.player2.key.down = !!res.state;
            break;
          default:
            break;
        }
      }
    } catch (e) {
      console.error('ws message parse error', e);
    }
  });

  ws.send(JSON.stringify({ msg: 'WELCOME TO THE WEBSOCKET SERVER' }));
});

// Game tick: update physics/positions at fixed rate and broadcast
const TICK_RATE = 30; // Hz — choose 30 for reasonable bandwidth/CPU tradeoff
setInterval(() => {
  try {
    for (const [id, game] of games) {
      if (!game) continue;

      // Move players based on their input state
      const speed = 8; // pixels per tick
      // Ensure key objects exist
      game.player1.key = game.player1.key || { up: false, down: false };
      game.player2.key = game.player2.key || { up: false, down: false };

      if (game.player1.key.up) {
        game.player1.position.y = Math.max(0, game.player1.position.y - speed);
      }
      if (game.player1.key.down) {
        game.player1.position.y = Math.min(game.board.image.height - game.player1.image.height, game.player1.position.y + speed);
      }
      if (game.player2.key.up) {
        game.player2.position.y = Math.max(0, game.player2.position.y - speed);
      }
      if (game.player2.key.down) {
        game.player2.position.y = Math.min(game.board.image.height - game.player2.image.height, game.player2.position.y + speed);
      }

      // Move ball and collisions (adapted from previous code)
      if (game.ball && game.ball.position) {
        game.ball.position.x += game.ball.velocity.x;
        game.ball.position.y += game.ball.velocity.y;

        if (game.ball.position.x <= 0) {
          game.ball.position = { x: game.board.image.width / 2, y: game.board.image.height / 2 };
          game.player2.score++;
        }

        if (game.ball.position.x >= game.board.image.width) {
          game.ball.position = { x: game.board.image.width / 2, y: game.board.image.height / 2 };
          game.player1.score++;
        }

        if (game.ball.position.y <= 0 || game.ball.position.y + game.ball.image.height >= game.board.image.height) {
          game.ball.velocity.y = -game.ball.velocity.y;
        }

        // collisions with paddles
        if (game.ball.position.x <= game.player1.position.x + game.player1.image.width &&
            game.ball.position.x >= game.player1.position.x &&
            game.ball.position.y + game.ball.image.height >= game.player1.position.y &&
            game.ball.position.y <= game.player1.position.y + game.player1.image.height) {
          game.ball.velocity.x = -game.ball.velocity.x;
          game.ball.position.x = game.player1.position.x + game.player1.image.width;
        }

        if (game.ball.position.x + game.ball.image.width >= game.player2.position.x &&
            game.ball.position.x <= game.player2.position.x + game.player2.image.width &&
            game.ball.position.y + game.ball.image.height >= game.player2.position.y &&
            game.ball.position.y <= game.player2.position.y + game.player2.image.height) {
          game.ball.velocity.x = -game.ball.velocity.x;
          game.ball.position.x = game.player2.position.x - game.ball.image.width;
        }
      }

      // Broadcast the updated game state to all connected websocket clients
      const payload = JSON.stringify({ game });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(payload);
        }
      });
    }
  } catch (e) {
    console.error('game tick error', e);
  }
}, Math.round(1000 / TICK_RATE));

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
