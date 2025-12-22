const fastify = require('fastify')
const S = require('@pocketgems/schema')

const openws = require('..')

const app = fastify({ logger: true })

async function main() {
    await app.register(openws)
    
    function getState(ctx) {
        const state = {
            onOpen: () => {
                console.log('server opened')
            },
            onClose: () => {
                console.log('server closed')
            },
            onError: (error) => {
                console.error(error)
            },
            onMessage: (message) => {
                ctx.myClient.message(`got message: ${message}`)
            }
        }
        return state
    }

    // Register a WS network
    await app.ws({
        path: '/abc',
        name: 'chat',
        hostRole: 'server', 
        participants: {
            server: {
                message: {
                    payload: S.str,
                }
            },
            myClient: {
                message: {
                    payload: S.str,
                }
            }
        },
    },
    getState)
    // Registered a WS network
    
    await app.listen({ port: 8082, host: '0.0.0.0' })
}

main().catch(console.error)
