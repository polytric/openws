const S = require('@pocketgems/schema')
const openws = require('@polytric/fastify-openws')

const ConfigSchema = S.obj({
    path: S.str,
    name: S.str.optional().desc('The name of the network, default to the class name'),
    description: S.str.optional(),
    version: S.str.optional(),
    hostRole: S.str.default('server'),
    participants: S.map.min(1).keyPattern("[a-zA-Z][a-zA-Z0-9_-]*[a-zA-Z0-9]").value(
        S.map.min(1).keyPattern("[a-zA-Z][a-zA-Z0-9_-]*[a-zA-Z0-9]").value(
            S.obj({
                payload: S.obj({}),
                description: S.str.optional().desc('The description of the handler'),
            })
        ).desc('A mapping from handler names (keys) to handler definitions (values)')
    ).desc('A mapping from role names (keys) to handlers (values)')
})

const validateConfig = ConfigSchema.compile('ConfigValidator')

class Server {
    static config = {
        path: undefined,
        name: undefined, // Defaults to the class name
        description: undefined, // Defaults to the class description
        version: undefined, // Defaults to the class version
        hostRole: 'server', // Defaults to 'server'
        participants: {}
    }

    static async register(fastify) {
        if (!fastify.hasDecorator('ws')) {
            await fastify.register(openws)
        }

        for (const handlers of Object.values(this.config.participants)) {
            for (const handler of Object.values(handlers)) {
                handler.payload = handler.payload.valueOf()
            }
        }

        validateConfig(this.config)
        const participants = {}
        for (const [role, handlers] of Object.entries(this.config.participants)) {
            participants[role] = {}
            for (const [handlerName, handler] of Object.entries(handlers)) {
                participants[role][handlerName] = {
                    payload: handler.payload,
                    description: handler.description,
                }
            }
        }
        const name = this.config.name || this.name
        fastify.ws({
            ...this.config,
            name,
            participants,
        }, async (ctx) => {
            return new this(ctx)
        })
    }

    async onOpen() {}

    async onClose() {}

    async onError(error) {
        console.error(error)
    }
}

module.exports = Server