const websocket = require('@fastify/websocket')
const fp = require('fastify-plugin')
const Ajv = require('ajv')
const { WS } = require('@polytric/openws-spec')

const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    strictSchema: false
})

/**
 * Converts a string to PascalCase
 */
function toPascalCase(name) {
    return name
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('')
}

/**
 * Creates a unique key for validator lookup
 */
function getValidatorKey(role, handlerName) {
    return `${role}:${handlerName}`
}

/**
 * OpenWS Fastify Plugin - Type-safe WebSocket communication
 */
function openwsPlugin(fastify, options, done) {
    if (!fastify.hasDecorator('websocketServer')) {
        fastify.register(websocket)
    }
    if (fastify.hasDecorator('ws')) {
        done()
        return
    }
    
    function registerNetwork({ path, hostRole, network }, getState) {
        network = network.valueOf()
        const { [hostRole]: host, ...consumers } = network.roles
        if (!host) {
            const availableRoles = Object.keys(network.roles).join(', ')
            throw new Error(
                `Host role '${hostRole}' not found in participants.\n` +
                `Available roles: ${availableRoles || 'none'}`
            )
        }

        // validate spec, and precompile validators
        const validators = {}
        for (const [roleName, role] of Object.entries(network.roles)) {
            for (const [messageName, message] of Object.entries(role.messages)) {
                if (!message.payload) {
                    throw new Error(`Payload schema for role ${roleName}, message ${messageName} must be defined`)
                }
                const validatorKey = getValidatorKey(roleName, messageName)
                validators[validatorKey] = ajv.compile(message.payload.valueOf())
            }
        }

        fastify.get(path, { websocket: true, openwsData: [...arguments] }, async (conn, req) => {
            const connContext = {}
            for (const [roleName, role] of Object.entries(consumers)) {
                for (const messageName of Object.keys(role.messages)) {
                    const validate = validators[getValidatorKey(roleName, messageName)]
                    async function send(payload) {
                        if (!validate(payload)) {
                            console.error(`Invalid payload for message '${messageName}':`, validate.errors)
                            return
                        }
                        conn.send(JSON.stringify({
                            fromRole: hostRole,
                            messageName,
                            payload: JSON.stringify(payload)
                        }))
                    }
                    const functionName = `${toPascalCase(roleName)}${toPascalCase(messageName)}`
                    connContext[functionName] = send
                    connContext[`send${functionName}`] = send
                }
            }
            const state = await getState(connContext)

            conn.on('message', async (message) => {
                try {
                    const { fromRole, messageName, payload: rawPayload } = JSON.parse(message.toString())
                    const handle = state[`on${toPascalCase(fromRole)}${toPascalCase(messageName)}`]
                    if (!handle) {
                        const availableMessages = Object.keys(state).filter(k => k.startsWith('on')).join(', ')
                        console.error(
                            `Message 'on${toPascalCase(fromRole)}${toPascalCase(messageName)}' not found for '${fromRole}'.\n` +
                            `Available messages: ${availableMessages || 'none'}`
                        )
                        return
                    }
                    const payload = JSON.parse(rawPayload)
                    const validate = validators[getValidatorKey(hostRole, messageName)]
                    if (!validate) {
                        console.error(`Validator for message '${messageName}' not found for '${hostRole}'`)
                        return
                    }
                    if (!validate(payload)) {
                        console.error({
                            message: `Invalid payload for message '${messageName}'`,
                            errors: validate.errors,
                            payload
                        })
                        return;
                    }
                    await handle(payload)
                } catch (error) {
                    console.error(`Error handling WebSocket message:`, error)
                    if (state.onError) {
                        await state.onError(error)
                    }
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

    fastify.decorate('openws', registerNetwork)
    done()
}

module.exports = fp(openwsPlugin, {
    name: "openws"
})