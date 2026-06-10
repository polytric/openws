import type { WebSocket } from '@fastify/websocket'
import websocket from '@fastify/websocket'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import * as Fluent from '@polytric/openws/fluent'
import type { Network } from '@polytric/openws-spec/builder'

// Extend Fastify types to include custom route options
declare module 'fastify' {
    interface RouteShorthandOptions {
        openWsNetwork?: Network
    }
}

/**
 * OpenWS Fastify Plugin - Type-safe WebSocket communication
 */
async function openwsPlugin(fastify: FastifyInstance, _options: any) {
    if (!fastify.hasDecorator('websocketServer')) {
        await fastify.register(websocket)
    }
    if (fastify.hasDecorator('openws')) {
        return
    }

    function registerNetwork({ path, bindings }: { path: string; bindings: Fluent.NetworkBinder }) {
        const network = bindings.network
        network.assertValid()
        const runtime = Fluent.runtime(bindings)

        fastify.get(
            path,
            { websocket: true, openWsNetwork: network },
            async (conn: WebSocket, _req: FastifyRequest) => {
                const session = runtime.newSession(
                    async (fromRole, messageName, payload) => {
                        conn.send(
                            JSON.stringify({
                                fromRole,
                                messageName,
                                payload,
                            })
                        )
                    },
                    () => {
                        conn.close()
                    }
                )

                conn.on('message', async (msg: Buffer) => {
                    try {
                        const { fromRole, messageName, payload } = JSON.parse(msg.toString())
                        await session.open(fromRole) // idempotent open, subsequent calls are cheap
                        await session.handleMessage(fromRole, messageName, payload)
                    } catch (error) {
                        console.error(`Error handling WebSocket message:`, error)
                    }
                })
                conn.on('close', async () => {
                    await session.close()
                })
                conn.on('error', async (error: Error) => {
                    await session.error(error)
                })
            }
        )
    }

    fastify.decorate('openws', registerNetwork)
}

export default fp(openwsPlugin, {
    name: 'openws',
})

declare module 'fastify' {
    interface FastifyInstance {
        openws(params: { path: string; bindings: Fluent.NetworkBinder }): void
    }
}
