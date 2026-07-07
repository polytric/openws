import fs from 'node:fs'
import path from 'node:path'

import staticPlugin from '@fastify/static'
import type { FastifyInstance, RouteOptions } from 'fastify'
import fp from 'fastify-plugin'

import * as WS from '@polytric/openws/fluent'
import { validate } from '@polytric/openws-spec'
import type { Network } from '@polytric/openws-spec/builder'
import { openwsUiRoot } from '@polytric/openws-ui'

import openWsPlugin from '../../fastify-openws/dist'

type JsonObject = Record<string, any>

interface OpenWsContract {
    name?: string
    version?: string
    description?: string
}

interface PluginOptions {
    prefix?: string
    exportPath?: string
    name?: string
    description?: string
}

declare module 'fastify' {
    interface OpenWSDecorator {
        getSpec?: () => JsonObject
    }
}

// Hide from @fastify/swagger if present
const hiddenSchema = { schema: { hide: true } as object }

async function openwsDocPlugin(fastify: FastifyInstance, options: PluginOptions = {}) {
    if (!fastify.hasDecorator('openws')) {
        await fastify.register(openWsPlugin, {
            name: options.name,
            description: options.description,
        })
    }
    const { prefix = '/openws', exportPath = '/spec.json', name, description } = options
    const contract =
        (fastify as FastifyInstance & { openwsContract?: OpenWsContract }).openwsContract ?? {}
    const specName = contract.name ?? name
    if (!specName) {
        throw new Error(
            'OpenWS spec name is required. Set app.register(openws, { name }) or openwsUi({ name }).'
        )
    }

    const spec = WS.spec('0.0.2', specName)
    if (contract.version) {
        spec.version(contract.version)
    }
    const specDescription = contract.description ?? description
    if (specDescription) {
        spec.description(specDescription)
    }
    const networkHosts: Record<string, string[]> = {}

    fastify.addHook('onRoute', (routeOptions: RouteOptions) => {
        const network = (routeOptions as any).openWsNetwork as Network | undefined
        if (!network) {
            return
        }

        networkHosts[network.name] = []
        for (const role of Object.values(network.roles)) {
            if (role.isHost) {
                networkHosts[network.name].push(role.name)
            }
        }

        // Add the network to the spec
        spec.network(network)
    })

    function getSpec() {
        const specJson = spec.toJson()
        if (process.env.NODE_ENV === 'development') {
            try {
                validate(specJson)
            } catch (error) {
                console.error('spec is invalid', error)
                throw error
            }
        }

        return specJson
    }

    // Attach getSpec to the openws function object
    fastify.decorate('openwsUi', {
        getSpec,
    })
    fastify.get(`${prefix}${exportPath}`, hiddenSchema, async (_req, reply) =>
        reply.type('application/json').send(getSpec())
    )

    fastify.get(prefix, hiddenSchema, async (_req, reply) => reply.redirect(`${prefix}/`))

    fastify.register(staticPlugin, {
        root: openwsUiRoot,
        prefix: `${prefix}/`,
        index: false,
        decorateReply: false,
    })

    const indexTemplate = fs.readFileSync(path.join(openwsUiRoot, 'index.html'), 'utf8')
    fastify.get(`${prefix}/`, hiddenSchema, async (_req, reply) => {
        const runtimeConfig = {
            specUrl: `${prefix}${exportPath}`,
            networkHosts,
        }

        const injected = indexTemplate.replace(
            '<!--OPENWS_UI_CONFIG-->',
            `<script id="openws-ui-config" type="application/json">${JSON.stringify(runtimeConfig)}</script>`
        )

        reply.type('text/html; charset=utf-8').send(injected)
    })
}

export default fp(openwsDocPlugin, {
    name: 'openws-spec',
})

declare module 'fastify' {
    interface FastifyInstance {
        openwsUi: {
            getSpec?: () => JsonObject
        }
    }
}
