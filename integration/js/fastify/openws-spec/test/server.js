const fastify = require('fastify')
const S = require('@pocketgems/schema')
const openws = require('@polytric/fastify-openws')
const openwsDoc = require('..')

const app = fastify({ logger: true })

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
                path: '/abc'
            }]
        }
    })
    await app.ws({ 
        path: '/abc', 
        name: 'chat',
        hostRole: 'server', 
        participants: {
            server: {
                message: {
                    payload: S.obj({
                        message: S.str
                    }),
                    description: 'Send a message to the client',
                    handle: ({ message }, { myClient }) => {
                        myClient.sendMessage({ message })
                    }
                }
            },
            myClient: {
                message: {
                    payload: S.obj({
                        message: S.str
                    })
                }
            }
        }
    }, 
    (ctx) => {
        return {
            onMessage: ({ message }) => {
                console.log('message', message)
            }
        }
    })
    
    await app.listen({ port: 8082, host: '0.0.0.0' })
}

main().catch(console.error)
