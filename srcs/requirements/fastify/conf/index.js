const fastify = require('fastify')({logger: true})
const Database = require('better-sqlite3')

const db = new Database('./data/database.db')

const PORT = parseInt(process.env.FASTIFY_PORT, 10)
const HOST = process.env.FASTIFY_HOST

fastify.get('/', function handler (request, reply) {
    reply.send('Hello World!')
})

fastify.listen({host: HOST, port: PORT}, (err) => {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})