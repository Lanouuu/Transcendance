import Fastify from "fastify";
import { initDB } from "./database.js";
import fs from 'fs'
import { error } from "console";

// Désactiver la vérification SSL pour appels inter-services
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
        teams.push("null");
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
            if (t1 !== "null" && t2 !== "null") {
                round.push([t1, t2]);
            }
        }

        schedule.push(round);

        teams = [teams[0]].concat([teams[n - 1]], teams.slice(1, n - 1));
    }

    return schedule;
}

function generateGuestPlayer(nbPlayer, ids, creator){
  for (let i = 0; i < parseInt(nbPlayer, 10) - 1; i++) {
    ids += "," + String(parseInt(creator, 10) + i + 1)
  }
  console.log("IDS FOR LOCAL TOURNAMENT: ", ids)
  return ids
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

  fastify.post('/tournamentCreate', async (request, reply) => {
    const { name, creator_id, nb_max_players, mode } = request.body || {};
    console.log("event detected")
    if (!name || !creator_id || !nb_max_players || !mode) {
      console.log("name: ", name)
      console.log("creator_id: ", creator_id)
      console.log("nb_max_player: ", nb_max_players)
      console.log("nb_max_player: ", mode)
      console.log("MIssing information")
      return reply.code(400).send({ error: "name, creator_id, nb_max_players required, mode required" });
    }

    try {
      const playerId = request.headers["x-user-id"];
      const playerName = await getUserName(playerId);
      const result = await dbtour.run(
        "INSERT INTO tournament (name, mode, creator_id, nb_max_players, players_ids, players_names, nb_current_players) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [name, mode, creator_id, nb_max_players, `${creator_id}`, playerName, 1]
      );
      console.log(`✓ Tournament created: "${name}" (ID: ${result.lastID}) by user ${creator_id}`);
      reply.send({ message: "Success", tournament_id: result.lastID, name , id: creator_id});
    } catch (err) {
      fastify.log.error({ err }, "Tournament creation failed");
      reply.code(500).send({ error: "Database insertion failed" });
    }
  });

  fastify.get('/tournamentList', async (request, reply) => {
    try {
      const tourList = await dbtour.all("SELECT * FROM tournament WHERE mode = ? ORDER BY created_at DESC", ["remote"]);
      reply.send(tourList);
    } catch (err) {
      fastify.log.error({ err }, "List tournaments failed");
      reply.code(400).send({ error: "Database read failed" });
    }
  });

  fastify.post('/tournamentJoin', async (request, reply) => {
    const { idTour } = request.body || {};
    if (!idTour) return reply.code(400).send({ error: "tournament id required" });

    try {
      const res = await dbtour.get(
        "SELECT creator_id, nb_current_players, nb_max_players FROM tournament WHERE id = ? ORDER BY created_at DESC LIMIT 1",
        [idTour]
      );
      if (parseInt(res.nb_current_players, 10) === parseInt(res.nb_max_players, 10)) {
        return reply.code(400).send({error: "Tournament already full"});
      }
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
      reply.send({ message: "Success", text: "Player added to tournament", tournament_id: idTour, id: res.creator_id });
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
        "SELECT players_ids, mode, nb_current_players, nb_max_players FROM tournament WHERE creator_id = ? ORDER BY created_at DESC LIMIT 1",
        [creator]
      );
      if (res.mode === "local") {
        console.log("current player: ", res.nb_max_players)
        res.players_ids = generateGuestPlayer(res.nb_max_players, res.players_ids, creator)
      }

      const nbPlayers = parseInt(res.nb_current_players, 10);
      if (nbPlayers < 3) {
        return reply.code(400).send({error: "Minimum 3 players required"});
      }
      const tour_ids = res.players_ids || '';
      const playersIds = tour_ids.split(',')
      .filter(Boolean)
      .map(id => parseInt(id, 10));
      console.log(playersIds);

      const schedule = generateRoundRobin(playersIds);
      console.log(schedule);
      
      if (res.mode === "remote") {
        const data = await fetch(`https://game:3002/remoteTournament`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ schedule, mode: res.mode })
        })
      } else if (res.mode === "local") {
          const data = await fetch(`https://game:3002/localTournament`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ schedule, mode: res.mode, rmId: creator })
        })
      }
      // const response = await data.json()
      // if (response.message !== "Success")
      //   throw new Error("Fail to create match")
      reply.send({message: "Success"})
      
    } catch (err) {
      request.log.error({ err }, "tournamentStart failed");
      console.log("tournamentStart ERROR: ", err.message)
      return reply.code(400).send({ error: err.message });
    }

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