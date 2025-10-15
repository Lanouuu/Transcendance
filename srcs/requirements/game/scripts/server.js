import Fastify from 'fastify'

export function runServer() {
    
    const fastify = Fastify({ logger: true });
    const PORT = parseInt(process.env.GAME_PORT, 10);
    const HOST = process.env.GAME_HOST;
    

    fastify.listen({host: HOST, port: PORT}, (err) => {
        if (err) {
            fastify.log.error(err);
            process.exit(1);
        }
    })
}

runServer();