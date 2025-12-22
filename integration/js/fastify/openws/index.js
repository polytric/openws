const websocket = require('@fastify/websocket')
const fp = require('fastify-plugin')
const Ajv = require('ajv')

const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    strictSchema: false
})

/**
 * Capitalizes the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Creates a unique key for validator lookup
 * @param {string} role - The role name
 * @param {string} handlerName - The handler name
 * @returns {string} The validator key
 */
function getValidatorKey(role, handlerName) {
    return `${role}:${handlerName}`
}

/**
 * OpenWS Fastify Plugin - Type-safe WebSocket communication
 * @param {import('fastify').FastifyInstance} fastify - The Fastify instance
 * @param {Object} options - Plugin options
 */
async function openwsPlugin(fastify, options) {
    if (!fastify.hasDecorator('websocketServer')) {
        await fastify.register(websocket)
    }
    if (fastify.hasDecorator('ws')) {
        return
    }
    
    /**
     * Registers a WebSocket network with typed message handlers
     * @param {Object} config - Network configuration
     * @param {string} config.path - WebSocket endpoint path
     * @param {string} config.name - Network name (for documentation)
     * @param {string} config.hostRole - The role of this host (e.g., 'server')
     * @param {Object} config.participants - Participant roles and their message handlers
     * @param {Function} getState - Function that receives context and returns state handlers
     * @returns {void}
     */
    function registerNetwork({ path, hostRole, participants }, getState) {
        const { [hostRole]: host, ...consumers } = participants
        if (!host) {
            const availableRoles = Object.keys(participants).join(', ')
            throw new Error(
                `Host role '${hostRole}' not found in participants.\n` +
                `Available roles: ${availableRoles || 'none'}`
            )
        }

        // validate spec, and precompile validators
        const validators = {}
        for (const [role, handlers] of Object.entries(participants)) {
            for (const [handlerName, { payload }] of Object.entries(handlers)) {
                if (!payload) {
                    throw new Error(`Payload for role ${role}, handler ${handlerName} must be defined`)
                }
                const validatorKey = getValidatorKey(role, handlerName)
                validators[validatorKey] = ajv.compile(payload.valueOf())
            }
        }

        fastify.get(path, { websocket: true, openwsData: [...arguments] }, async (conn, req) => {
            const ctx = {}
            for (const [role, consumer] of Object.entries(consumers)) {
                ctx[role] = {}
                for (const handlerName of Object.keys(consumer)) {
                    const validate = validators[getValidatorKey(role, handlerName)]
                    async function send(payload) {
                        if (!validate(payload)) {
                            const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ')
                            throw new Error(
                                `Invalid payload for ${role}.${handlerName}:\n` +
                                `Errors: ${errors || 'Unknown validation error'}\n` +
                                `Received: ${JSON.stringify(payload)}`
                            )
                        }
                        conn.send(JSON.stringify({
                            handlerName: handlerName,
                            payload: JSON.stringify(payload)
                        }))
                    }
                    ctx[role][handlerName] = send
                    ctx[role][`send${capitalize(handlerName)}`] = send
                }
            }
            const state = await getState(ctx)

            conn.on('message', async (message) => {
                try {
                    const { handlerName, payload: rawPayload } = JSON.parse(message.toString())
                    const handle = state[`on${capitalize(handlerName)}`]
                    if (!handle) {
                        const availableHandlers = Object.keys(state).filter(k => k.startsWith('on')).join(', ')
                        console.error(
                            `Handler 'on${capitalize(handlerName)}' not found for host '${hostRole}'.\n` +
                            `Available handlers: ${availableHandlers || 'none'}`
                        )
                        await conn.close()
                        return
                    }
                    const payload = JSON.parse(rawPayload)
                    const validate = validators[getValidatorKey(hostRole, handlerName)]
                    if (!validate(payload)) {
                        const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ')
                        console.error(
                            `Invalid payload for ${hostRole}.${handlerName}:\n` +
                            `Errors: ${errors || 'Unknown validation error'}\n` +
                            `Received: ${JSON.stringify(payload)}`
                        )
                        await conn.close()
                        return
                    }
                    await handle(payload, ctx)
                } catch (error) {
                    console.error(`Error handling WebSocket message:`, error)
                    if (state.onError) {
                        await state.onError(error)
                    }
                    await conn.close()
                }
            })
            conn.on('close', async () => {
                await state.onClose?.()
            })
            conn.on('error', async (error) => {
                await state.onError?.(error)
            })

            await state.onOpen?.()
        })
    }

    fastify.decorate('ws', registerNetwork)
}

module.exports = fp(openwsPlugin, {
    name: "openws"
})