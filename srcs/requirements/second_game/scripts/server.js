import Fastify from "fastify";

export function runServer() {

    const fastify = Fastify({ logger: true });
    const PORT = parseInt(process.env.SECOND_GAME_PORT, 10);
    const HOST = process.env.SECOND_GAME_HOST;


    //implementer les differentes routes ici

    
    fastify.listen({host: HOST, port: PORT}, (err) => {
      if (err) {
          fastify.log.error(err);
          process.exit(1);
      }
    });
}

runServer();