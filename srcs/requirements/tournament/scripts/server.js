import Fastify from "fastify";
import { initDB } from "./database.js";
import fs from 'fs'

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

  fastify.post('/deleteTournament', async(request, reply) => {
    const { tournament_id } = request.body;
    if(!tournament_id)
      return reply.code(400).send({error: "ID tournament missing"});
    const userId = request.headers["x-user-id"];
    if(!userId)
        return reply.code(400).send({error: "User ID missing"});

    try {
      const tourInfo = await dbtour.get("SELECT * FROM tournament WHERE id = ?", [tournament_id]);
      if (!tourInfo)
        return reply.code(400).send(JSON.stringify({error: "No tournament found"}))
      if (tourInfo.creator_id === userId && tourInfo.status === "pending") {
        await dbtour.run("DELETE FROM tournament WHERE id = ?", [tournament_id]);
      }
      else {
        if(tourInfo.creator_id !== userId)
          return reply.code(403).send({error: "Can't delete tournament, you're not the creator"});
        if(tourInfo.status !== "pending")
          return reply.code(403).send({error: "Can't delete a playing tournament"});
        reply.code(200).send({message: "Success"})
      }
    }catch(err) {
      return reply.code(400).send(JSON.stringify({error: "Failed to fetch tournament information"}))
    }
  });

  fastify.post('/leaveTournament', async(request, reply) => {
    const { tournament_id } = request.body;
    if(!tournament_id)
      return reply.code(400).send({error: "ID tournament missing"});
    const userId = request.headers["x-user-id"];
    if(!userId)
        return reply.code(400).send({error: "User ID missing"});

    try {
      const tourInfo = await dbtour.get(
        `SELECT id, players_ids, players_names, nb_current_players, status FROM tournament
        WHERE id = ?
        AND status IN ('pending')
        AND (',' || IFNULL(players_ids, '') || ',') LIKE '%,' || ? || ',%'`,
        [tournament_id, userId]
      );
      if(!tourInfo)
        return reply.code(400).send({error: "Tournament not found or user not in it"});
      
      const playerName = await getUserName(userId);
      
      if(tourInfo.nb_current_players === 1) {
        await dbtour.run("DELETE FROM tournament WHERE id = ?", [tournament_id]);
      }
      else if(tourInfo.status === "pending") {
        await dbtour.run(
          `UPDATE tournament
          SET players_ids = TRIM(REPLACE(',' || players_ids || ',', ',' || ? || ',', ','), ','),
          players_names = TRIM(REPLACE(',' || players_names || ',', ',' || ? || ',', ','), ','),
          nb_current_players = nb_current_players - 1
          WHERE id = ?`,
          [userId, playerName, tournament_id]
        );
        console.log(`Player ${userId} left tournament ${tournament_id}`);
      }
      reply.code(200).send({ message: "Success", text: "Player removed from tournament" });
    } catch(err) {
      fastify.log.error({ err }, "Leave tournament failed");
      reply.code(400).send({error: "Failed to leave tournament"});
    }
  });

  fastify.get('/isInTournament', async (request, reply) => {
      const userId = request.headers["x-user-id"];
      const id = await dbtour.get(
        `SELECT id FROM tournament
        WHERE status IN ('pending', 'playing')
        AND (',' || IFNULL(players_ids, '') || ',') LIKE '%,' || ? || ',%'`,
        [userId]
      );
      if (id) {
        return reply.code(200).send(JSON.stringify({ tournamentId: id.id, isRegistered: true}));
      }
      return reply.code(200).send(JSON.stringify({tournamentId: undefined, isRegistered: false }));

  })

  fastify.get('/getTournamentInfo/:id', async (request, reply) => {
    const userId = request.headers["x-user-id"];
    const tournamentId = request.params.id;
    try {

        const checkId = await dbtour.get(
        `SELECT id FROM tournament
        WHERE id = ?
          AND status IN ('pending', 'playing')
          AND (',' || IFNULL(players_ids, '') || ',') LIKE '%,' || ? || ',%'`,
        [tournamentId, userId]
      );
      if (!checkId || !checkId.id) {
        return reply.code(403).send(JSON.stringify({error: "User not in tournament"}))
      }

      const tourInfo = await dbtour.get("SELECT * FROM tournament WHERE id = ?", [tournamentId]);

      if (tourInfo)
          return reply.code(200).send(JSON.stringify({tournament: tourInfo}))
      return reply.code(400).send(JSON.stringify({error: "No tournament found"}))
    }catch(err) {
      return reply.code(400).send(JSON.stringify({error: "Failed to fetch tournament information"}))
    }
  })

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
      const playerStr = String(playerId);

      const alreadyIn = await dbtour.get(
        "SELECT id, name FROM tournament \
        WHERE status IN ('pending','playing') \
         AND (',' || IFNULL(players_ids, '') || ',') LIKE '%,' || ? || ',%' \
        ORDER BY created_at DESC LIMIT 1",
        [playerStr]
      );
      if (alreadyIn) {
        return reply.code(409).send({
          error: "User already registered in another tournament",
          tournament_id: alreadyIn.id,
          name: alreadyIn.name
        });
      }

      const playerName = await getUserName(playerId);
      const result = await dbtour.run(
        "INSERT INTO tournament (name, mode, creator_id, nb_max_players, players_ids, players_names, nb_current_players) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [name, mode, creator_id, nb_max_players, `${creator_id}`, playerName, 1]
      );
      console.log(`✓ Tournament created: "${name}" (ID: ${result.lastID}) by user ${creator_id}`);
      reply.send({ message: "Success", tournament_id: result.lastID, name , id: creator_id});
    } catch (err) {
      fastify.log.error({ err }, "Tournament creation failed");
      reply.code(400).send({ error: "Database insertion failed" });
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
      if (!res) return reply.code(400).send({ error: "Tournament not found" });

      if (parseInt(res.nb_current_players, 10) === parseInt(res.nb_max_players, 10)) {
        return reply.code(400).send({error: "Tournament already full"});
      }

      const playerId = request.headers["x-user-id"];
      const playerName = await getUserName(playerId);
      const playerStr = String(playerId);

      const alreadyHere = await dbtour.get(
        "SELECT 1 FROM tournament " +
        "WHERE id = ? " +
        "  AND (',' || IFNULL(players_ids, '') || ',') LIKE '%,' || ? || ',%'",
        [idTour, playerStr]
      );
      if (alreadyHere) {
        return reply.code(409).send({ error: "User already registered in this tournament" });
      }

      const other = await dbtour.get(
        "SELECT id, name FROM tournament \
        WHERE id <> ? \
         AND status IN ('pending','playing') \
         AND (',' || IFNULL(players_ids, '') || ',') LIKE '%,' || ? || ',%' \
        ORDER BY created_at DESC LIMIT 1",
        [idTour, playerStr]
      );
      if (other) {
        return reply.code(409).send({
          error: "User already registered in another tournament",
          tournament_id: other.id,
          name: other.name
        });
      }

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
      reply.code(400).send({ error: "Database update failed" });
    }
  });

  fastify.post('/tournamentStart', async (request, reply) => {
    const creator = request.headers["x-user-id"];
    if(!creator) return reply.code(400).send({ error: "creator_id required" });

    try {

      const res = await dbtour.get(
        "SELECT players_ids, mode, nb_current_players, nb_max_players, status, id FROM tournament WHERE creator_id = ? ORDER BY created_at DESC LIMIT 1",
        [creator]
      );
      if (!res){
        return reply.code(404).send({error: "Tournament not found"});
      }
      if (res.mode === "local") {
        console.log("current player: ", res.nb_max_players)
        res.players_ids = generateGuestPlayer(res.nb_max_players, res.players_ids, creator)
      }
      if (res.status !== "pending") {
        return reply.code(400).send({error: "Tournament is playing or finished"});
      }
      const nbPlayers = parseInt(res.nb_current_players, 10);
      if (nbPlayers < 3 && res.mode === "remote") {
        return reply.code(400).send({error: "Minimum 3 players required"});
      }
      const tour_ids = res.players_ids || '';
      const playersIds = tour_ids.split(',')
      .filter(Boolean)
      .map(id => parseInt(id, 10));
      console.log(playersIds);

      const upd = await dbtour.run(
        "UPDATE tournament \
        SET status = 'playing' \
        WHERE id = (SELECT id FROM tournament WHERE creator_id = ? ORDER BY created_at DESC LIMIT 1) \
          AND status = 'pending'",
        [creator]
      );
      if(upd.changes !== 1) {
        return reply.code(409).send({error: "Tournament not updated"});
      }

      const schedule = generateRoundRobin(playersIds);
      console.log(schedule);
      
      if (res.mode === "remote") {
        const data = await fetch(`https://game:3002/remoteTournament`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ schedule, id: res.id })
        })
        const response = await data.json()
        if (response.message !== "Success")
          throw new Error("Fail to create match")
        else {
          console.log("Winner: ", response.winner)
          const upd = await dbtour.run(
          "UPDATE tournament SET status='finished', winner_alias = ? WHERE id=? AND status='playing'",
          [response.winner, res.id]
          );
          if (upd.changes !== 1) {
            return reply.code(409).send({ error: "Tournament is not in playing state" });
          }
        }
      } else if (res.mode === "local") {
          const data = await fetch(`https://game:3002/localTournament`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ schedule, mode: res.mode, rmId: creator })
        })
        const response = await data.json()
        if (response.message !== "Success")
          throw new Error("Fail to create match")
        else {
          const upd = await dbtour.run(
          "UPDATE tournament SET status='finished' WHERE id=? AND status='playing'",
          [res.id]
          );
          if (upd.changes !== 1) {
            return reply.code(409).send({ error: "Tournament is not in playing state" });
          }
        }
      }
      reply.send({message: "Success"})
      console.log("MESSAGE SENDED");
      
    } catch (err) {
      request.log.error({ err }, "tournamentStart failed");
      console.log("tournamentStart ERROR: ", err.message)
      return reply.code(400).send({ error: err.message });
    }
    
  });

  fastify.listen({host: HOST, port: PORT}, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
  });
}

runServer();