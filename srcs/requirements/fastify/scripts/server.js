import Fastify from 'fastify';

export function runServer() {
    const PORT = parseInt(process.env.FASTIFY_PORT, 10)
    const HOST = process.env.FASTIFY_HOST
    
    const fastify = Fastify({ logger: true });

    fastify.get('/', function handler (request, reply) {
        reply.send('Hello World!')
    })
    
    fastify.listen({host: HOST, port: PORT}, (err) => {
        if (err) {
            fastify.log.error(err)
            process.exit(1)
        }
    })
}