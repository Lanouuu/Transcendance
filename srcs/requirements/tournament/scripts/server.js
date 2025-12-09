import Fastify from "fastify";
import { initDB } from "./database.js";
import { WebSocketServer } from 'ws'


class tournoi {
  constructor({ id, name, creator_id, nb_max_players }) {
    this.id = id
    this.name = name
    this.creator_id = creator_id
    this.nb_max_players = nb_max_players
  }
  winner_id
  nb_current_players
  created_at
}

export async function runServer() {

    const fastify = Fastify({ logger: true });
    const PORT = parseInt(process.env.TOURNAMENT_PORT, 10);
    const HOST = process.env.TOURNAMENT_HOST;

    const dbtour = await initDB();

    const wss = new WebSocketServer({ 
        server: fastify.server,
        path: '/ws'
    })

    wss.on('listening', () => {
      console.log("WebSocket server running on ws://localhost:3004/ws");
    })

  wss.on('connection', function connection(ws) {
    ws.on('error', console.error);
    console.log("Connection detected")
    ws.on('message', function message(data) {
      const res = JSON.parse(data.toString())

      if(res.message === "creationTour") {
        if(!res.name) {
          ws.send(JSON.stringify({
            message: "Error",
            error: "Missing name"
          }));
        }
        if(!res.creator_id) {
          ws.send(JSON.stringify({
            message: "Error",
            error: "Missing creator_id"
          }));
        }
        if(!res.nb_max_players) {
          ws.send(JSON.stringify({
            message: "Error",
            error: "Missing nb_max_players"
          }));
        }
      dbtour.run("INSERT INTO tournament (name, creator_id, nb_max_players) VALUES (?, ?, ?)", [res.name, res.creator_id, res.nb_max_players]);
      }

    });
  
  });


// fastify.get("/tournament", async (request, reply) => {
//     try {
//         console.log("GAME AT CREATION = ", game)
//         console.log("Local game created with id:", game.id)
//         reply.send(game)
//     } catch (e) {
//         console.log(e.message)
//         console.log("Error creating local game")
//     }
// })

    // creation tournoi
    // liste d'attente
    // lancement du tournoi
    // gestion des matchs, avec ajout des stats
    // declaration du gagnant, avec ajout de stats
    // fin tournoi

    fastify.listen({host: HOST, port: PORT}, (err) => {
      if (err) {
          fastify.log.error(err);
          process.exit(1);
      }
    });
}

runServer();