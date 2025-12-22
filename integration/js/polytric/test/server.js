const fastify = require('fastify')
const Server = require('..')
const openws = require('@polytric/fastify-openws')
const openwsDoc = require('@polytric/fastify-openws-spec')
const S = require('@pocketgems/schema')

const app = fastify({ logger: true })

const MessageSchema = S.obj({
    content: S.str,
    sender: S.str,
    mentions: S.arr(S.str),
}).desc('A message sent by a user')

class ChatServer extends Server {
    static config = {
        ...super.config,
        path: '/chat',
        description: 'A simple chat server with one client using WS.',
        version: '1.0.0',
        participants: {
            server: {
                message: {
                    payload: MessageSchema,
                }
            },
            unityClient: {
                broadcastMessage: {
                    payload: MessageSchema.copy().props({
                        timestamp: S.int,
                    }),
                }
            }
        }
    }

    async onMessage(message, { unityClient }) {
        message.timestamp = Math.floor(Date.now() / 1000)
        await unityClient.broadcastMessage(message)
    }
}

async function main() {
    await app.register(openws)
    await app.register(openwsDoc, {
        title: 'Chat Example',
        description: 'A simple chat server with one client using WS.',
        version: '1.0.0',
        endpoints: {
            server: [{
                host: 'localhost',
                port: 8082,
                path: '/chat'
            }]
        }
    })
    await ChatServer.register(app)
    await app.listen({ port: 8082, host: '0.0.0.0' })
}

main()