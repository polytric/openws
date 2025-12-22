const fp = require('fastify-plugin')
const { validate } = require('@polytric/openws-spec')

async function openwsDocPlugin(fastify, options) {
    const {
        exportPath = '/open-ws.json',
        title,
        description,
        version,
        endpoints = {},
    } = options || {}
    
    const networks = {}
    const spec = {
        openws: '0.0.1',
        info: { title, description, version },
        networks
    }

    fastify.addHook('onRoute', ({ openwsData }) => {
        if (!openwsData) {
            return
        }
        const [options] = openwsData
        const { name, participants } = options

        if (networks[name]) {
            return
        }

        const participantsSpec = {}
        for (const [role, handlers] of Object.entries(participants)) {
            const handlersSpec = {}
            participantsSpec[role] = {
                endpoints: endpoints[role],
                handlers: handlersSpec
            }
            for (const [handlerName, handler] of Object.entries(handlers)) {
                handlersSpec[handlerName] = {
                    payload: handler.payload.valueOf(),
                    description: handler.description,
                }
            }
        }
        networks[name] = {
            participants: participantsSpec
        }
    })

    function getSpec() {
        if (process.env.NODE_ENV === 'development') {
            try {
                validate(spec)
            } catch (error) {
                console.error('spec is invalid', error)
                throw error
            }
        }
        return spec
    }

    if (fastify.ws) {
        fastify.ws.getSpec = getSpec
    }
    fastify.get(exportPath, { hide: true }, getSpec)
}

module.exports = fp(openwsDocPlugin, {
    name: "openws"
})