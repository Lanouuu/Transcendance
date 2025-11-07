import { games} from "./script.js";

fastify.get("/state/:id", async (request, reply) => {
    try {
            const id = parseInt(request.params.id, 10)
        if (!games.has(id)) {
            return reply.status(404).send({ error: "Game not found" });
        }
        const game = games.get(id)
        reply.send(JSON.stringify(game));
    }catch(e) {
        reply.status(404).send({ error: e.message })
    }
});