import Ajv, { type ValidateFunction } from 'ajv'

import * as Builder from '@polytric/openws-spec/builder'

const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    strictSchema: false,
})

type HandlerBinder = {
    fromRole: string
    messageName: string
    validatePayload: ValidateFunction
    handler: (payload: any, api: ApiProto) => Promise<void>
}

export type SendFn = (fromRole: string, messageName: string, payload: any) => Promise<void>

export type ApiProto = {
    rawSend: SendFn
    [messageName: string]: (...args: any[]) => Promise<void>
}

export class ClientRoleBinder {
    private readonly hostMessages: { [messageName: string]: Builder.Message } = {}
    private readonly handlers: {
        [messageName: string]: HandlerBinder
    } = {}
    private readonly apiProto: { [key: string]: any } = {}

    constructor(
        private readonly role: Builder.Role,
        hostMessages: Builder.Message[]
    ) {
        for (const message of hostMessages) {
            this.hostMessages[message.name] = message
        }
        for (const message of Object.values(this.role.messages)) {
            const payloadSchema = message.getPayload()?.valueOf()
            const validate = payloadSchema
                ? ajv.compile(payloadSchema)
                : ((() => true) as unknown as ValidateFunction)
            this.apiProto[message.name] = async function (this: ApiProto, payload: any) {
                if (!validate(payload)) {
                    throw new Error(`Invalid payload for message ${message.name}`, {
                        cause: validate.errors,
                    })
                }
                return this.rawSend(role.name, message.name, payload)
            }
        }
    }

    onOpen(handler: (fromRole: string) => Promise<void>): this {
        this.handleOpen = handler
        return this
    }
    onClose(handler: (fromRole: string) => Promise<void>): this {
        this.handleClose = handler
        return this
    }
    onError(handler: (fromRole: string, error: Error) => Promise<void>): this {
        this.handleError = handler
        return this
    }

    on(messageName: string, handler: (payload: any, api: ApiProto) => Promise<void>): this {
        const message = this.hostMessages[messageName]
        if (!message) {
            throw new Error(`Message ${messageName} not found in host messages`)
        }
        const payloadSchema = message.getPayload()?.valueOf()
        const validate = payloadSchema ? ajv.compile(payloadSchema) : () => true
        this.handlers[messageName] = {
            fromRole: this.role.name,
            messageName: message.name,
            validatePayload: validate as ValidateFunction,
            handler,
        }
        return this
    }

    handleOpen: (fromRole: string) => Promise<void> = async () => {}
    handleClose: (fromRole: string) => Promise<void> = async () => {}
    handleError: (fromRole: string, error: Error) => Promise<void> = async () => {}

    async handleMessage(messageName: string, payload: any, api: ApiProto) {
        const handler = this.handlers[messageName]
        if (!handler) {
            throw new Error(`Handler for message ${messageName} not found`)
        }
        if (!handler.validatePayload(payload)) {
            throw new Error(`Invalid payload for message ${messageName}`, {
                cause: handler.validatePayload.errors,
            })
        }
        await handler.handler(payload, api)
    }

    createApi(send: SendFn) {
        const api = Object.create(this.apiProto) as ApiProto
        api.rawSend = send
        return api
    }
}

export class NetworkBinder {
    fromRoles: { [clientRoleName: string]: ClientRoleBinder } = {}

    #network: Builder.Network
    get network() {
        return this.#network
    }

    constructor(network: Builder.Network) {
        this.#network = network
        const hostMessages: Builder.Message[] = []
        const clientMessages: Builder.Message[] = []
        const clientRoles: Builder.Role[] = []
        for (const role of Object.values(network.roles)) {
            if (role.isHost) {
                for (const message of Object.values(role.messages)) {
                    hostMessages.push(message)
                }
            } else {
                clientRoles.push(role)
                for (const message of Object.values(role.messages)) {
                    clientMessages.push(message)
                }
            }
        }

        for (const clientRole of clientRoles) {
            this.fromRoles[clientRole.name] = new ClientRoleBinder(clientRole, hostMessages)
        }
    }
}
