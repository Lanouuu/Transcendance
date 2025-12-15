import Fastify from "fastify";
import { initDB } from "./database.js";
import { WebSocketServer } from 'ws'
import fs from 'fs'

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

class match {
  constructor({ player_1_id, player_2_id }) {
    this.player_1_id = player_1_id
    this.player_2_id = player_2_id
    this.status = "pending"
  }
}

const userSocket = new Map();

async function getUserName(id) {
    try {
        const res = await fetch(`http://users:3000/get-user/${id}`);
        if (!res.ok) {
            const text = await res.text();
            console.error(`Server error ${res.status}:`, text);
            throw new Error(`Failed to fetch user information`);
        }
        const user = await res.json();
        return user.name;
    } catch(e) {
        console.log("getUserName error: ", e.message);
        return `User_${id}`;
    }
}

function generateRoundRobin(teams) {
    if (teams.length % 2 !== 0) {
        teams.push("bye");
    }

    const n = teams.length;
    const rounds = n - 1;
    const half = n / 2;
    const schedule = [];

    for (let i = 0; i < rounds; i++) {
        const round = [];

        for (let j = 0; j < half; j++) {
            const t1 = teams[j];
            const t2 = teams[n - 1 - j];
            if (t1 !== "bye" && t2 !== "bye") {
                round.push([t1, t2]);
            }
        }

        schedule.push(round);

        teams = [teams[0]].concat([teams[n - 1]], teams.slice(1, n - 1));
    }

    return schedule;
}

export async function runServer() {

  const fastify = Fastify({
    logger: true,
    connectionTimeout: 120000,
    keepAliveTimeout: 120000,
    https: {
        key: fs.readFileSync('/etc/ssl/transcendence.key'),
        cert: fs.readFileSync('/etc/ssl/transcendence.crt') 
    }
  });

  const PORT = parseInt(process.env.TOURNAMENT_PORT, 10);
  const HOST = process.env.TOURNAMENT_HOST;

  const dbtour = await initDB();

  const wss = new WebSocketServer({ 
      server: fastify.server,
      path: '/ws'
  })

  fastify.post('/tournamentCreate', async (request, reply) => {
    if (!userSocket.has(request.headers["x-user-id"])) {
      return reply.code(400).send({error: "You must be connected via websocket first to create a tournament"})
    }
    const socket = userSocket.get(request.headers["x-user-id"])
    const { name, creator_id, nb_max_players } = request.body || {};
    console.log("event detected")
    if (!name || !creator_id || !nb_max_players) {
      console.log("name: ", name)
      console.log("creator_id: ", creator_id)
      console.log("nb_max_player: ", nb_max_players)
      console.log("MIssing information")
      return reply.code(400).send({ error: "name, creator_id, nb_max_players required" });
    }

    try {
      const playerId = request.headers["x-user-id"];
      const playerName = await getUserName(playerId);
      const result = await dbtour.run(
        "INSERT INTO tournament (name, creator_id, nb_max_players, players_ids, players_names, nb_current_players) VALUES (?, ?, ?, ?, ?, ?)",
        [name, creator_id, nb_max_players, `${creator_id}`, playerName, 1]
      );
      console.log(`✓ Tournament created: "${name}" (ID: ${result.lastID}) by user ${creator_id}`);
      reply.send({ message: "Success", tournament_id: result.lastID, name });
    } catch (err) {
      fastify.log.error({ err }, "Tournament creation failed");
      reply.code(500).send({ error: "Database insertion failed" });
    }
  });

  fastify.get('/tournamentList', async (request, reply) => {
    try {
      const tourList = await dbtour.all("SELECT * FROM tournament ORDER BY created_at DESC");
      reply.send(tourList);
    } catch (err) {
      fastify.log.error({ err }, "List tournaments failed");
      reply.code(400).send({ error: "Database read failed" });
    }
  });

  fastify.post('/tournamentJoin', async (request, reply) => {
    const { idTour } = request.body || {};
    if (!idTour) return reply.code(400).send({ error: "tournament id required" });

    //ajouter un check avec le nb_max_player

    try {
      const playerId = request.headers["x-user-id"];
      const playerName = await getUserName(playerId);
      const result = await dbtour.run(
        `UPDATE tournament
        SET players_ids = CASE
        WHEN players_ids IS NULL OR players_ids = '' THEN ?
        ELSE  players_ids || ',' || ?
        END,
        players_names = CASE
        WHEN players_names IS NULL OR players_names = '' THEN ?
        ELSE players_names || ',' || ?
        END,
        nb_current_players = nb_current_players + 1
        WHERE id = ?`, [playerId, playerId, playerName, playerName, idTour]
      );
      console.log(`✓ Player ${playerId} joined tournament ${idTour}`);
      reply.send({ message: "Success", text: "Player added to tournament" });
    } catch (err) {
      fastify.log.error({ err }, "Add player to tournament failed");
      reply.code(500).send({ error: "Database update failed" });
    }
  });

  fastify.post('/tournamentStart', async (request, reply) => {
    const creator = request.headers["x-user-id"];
    if(!creator) return reply.code(400).send({ error: "creator_id required" });

    try {

    const res = await dbtour.get(
      "SELECT players_ids, nb_current_players FROM tournament WHERE creator_id = ? ORDER BY created_at DESC LIMIT 1",
      [creator]
    );
    
      const nbPlayers = res.nb_current_players.map(id => parseInt(id, 10));

      const tour_ids = res.players_ids || '';
      const playersIds = tour_ids.split(',')
      .filter(Boolean)
      .map(id => parseInt(id, 10));
      console.log(playersIds);

      const schedule = generateRoundRobin(playersIds);
      console.log(schedule);
      
      for ( i = 0; i < schedule.length; i++) {
        
        for(j = 0; j < schedule[i].length; j++) {
          // int res1 = await fetch(`http://users:3002/game/${match}`)
          // int res2 = await fetch(`http://users:3002/game/${match}`)
          // int res3 = await fetch(`http://users:3002/game/${match}`)

        }

      }

      // clef 1 -> match
      // clef 2 -> match



    } catch (err) {
      request.log.error({ err }, "tournamentStart failed");
      return reply.code(400).send({ error: "Database read failed" });
    }

  });

  wss.on('listening', () => {
    console.log("WebSocket server running on ws://localhost:3004/ws");
  })

  wss.on('connection', function connection(ws) {
    ws.on('error', console.error);
    console.log("Connection detected")
    ws.initialized = false

    ws.on('message', function message(data) {
      const res = JSON.parse(data.toString())
      if (!ws.initialized) {
        if (res.message !== "Init") {
          ws.send(JSON.stringify({
            message: "Error",
            error: "Your first message has to be Init and send your userId"
          }))
          ws.close()
        } else {
          ws.initialized = true
          ws.userId = res.creator_id
          userSocket.set(ws.userId, ws)
          ws.send(JSON.stringify({message: "Initialized"}))
        }
      }

    });
  
    ws.on('close', () => {
      if (ws.userId) {
        userSocket.delete(ws.userId)
        console.log("User deleted from userSocket")
      }
    })
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