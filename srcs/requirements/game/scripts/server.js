import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { join } from 'path'
import { fileURLToPath } from 'url'

export function runServer() {
    
    const fastify = Fastify({ logger: true });
    const PORT = parseInt(process.env.GAME_PORT, 10);
    const HOST = process.env.GAME_HOST;


    const filename = fileURLToPath(import.meta.url)
    const dirname = join(filename, '..')

    fastify.register(fastifyStatic, {
    root: join(dirname, './'),
    })

    fastify.listen({host: HOST, port: PORT}, (err) => {
        if (err) {
            fastify.log.error(err);
            process.exit(1);
        }
    })
}

runServer();