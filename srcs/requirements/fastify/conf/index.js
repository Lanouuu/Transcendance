const fastify = require('fastify')({logger: true})

const PORT = parseInt(process.env.FASTIFY_PORT, 10)
const HOST = process.env.FASTIFY_HOST

fastify.get('/', function handler (request, reply) {
    reply.send({hello: 'Hello World!'})
})

fastify.listen({host: HOST, port: PORT}, (err) => {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})