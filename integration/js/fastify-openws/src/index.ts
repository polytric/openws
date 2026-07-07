import type { WebSocket } from '@fastify/websocket'
import websocket from '@fastify/websocket'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import * as Fluent from '@polytric/openws/fluent'
import type { Network } from '@polytric/openws-spec/builder'

export interface OpenWsContract {
    name?: string
    version?: string
    description?: string
}

export interface OpenWsPluginOptions extends OpenWsContract {}

export interface RegisterNetworkOptions {
    path: string
    bindings: Fluent.NetworkBinder
    version?: string
    description?: string
}

// Extend Fastify types to include custom route options
declare module 'fastify' {
    interface RouteShorthandOptions {
        openWsNetwork?: Network
    }
}

function trimMetadata(value: string | undefined): string | undefined {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}

function normalizeContract(options: OpenWsPluginOptions): OpenWsContract {
    const name = trimMetadata(options.name)
    const version = trimMetadata(options.version)
    const description = trimMetadata(options.description)
    return {
        ...(name ? { name } : {}),
        ...(version ? { version } : {}),
        ...(description ? { description } : {}),
    }
}

/**
 * OpenWS Fastify Plugin - Type-safe WebSocket communication
 */
async function openwsPlugin(fastify: FastifyInstance, options: OpenWsPluginOptions) {
    const contract = normalizeContract(options ?? {})
    if (!fastify.hasDecorator('websocketServer')) {
        await fastify.register(websocket)
    }
    if (fastify.hasDecorator('openws')) {
        if (fastify.hasDecorator('openwsContract')) {
            Object.assign(fastify.openwsContract, contract)
        }
        return
    }

    fastify.decorate('openwsContract', contract)

    function registerNetwork({ path, bindings, version, description }: RegisterNetworkOptions) {
        const network = bindings.network
        const routeVersion = trimMetadata(version)
        if (routeVersion) {
            network.version(routeVersion)
        }
        const routeDescription = trimMetadata(description)
        if (routeDescription) {
            network.description(routeDescription)
        }
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
        openwsContract: OpenWsContract
        openws(params: RegisterNetworkOptions): void
    }
}
