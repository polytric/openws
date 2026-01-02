import type * as Types from './types'

const WELL_KNOWN_METADATA_KEYS = new Set<string>(['description', 'version', 'openws', 'name'])

export class Base {
    #metadata: Types.CommonMetadata

    constructor(name: string) {
        this.#metadata = { name }
    }

    #setMetadata(name: string, value: Types.JsonValue): this {
        this.#metadata[name] = value
        return this
    }

    #getMetadataKey(name: string): string {
        if (WELL_KNOWN_METADATA_KEYS.has(name)) {
            return name
        }
        if (!name.startsWith('x-')) {
            return `x-${name}`
        }
        return name
    }

    get name(): string {
        return this.#metadata['name'] as string
    }

    metadata(name: string, value: Types.JsonValue): this {
        return this.#setMetadata(this.#getMetadataKey(name), value)
    }

    getMetadata(name: string): Types.JsonValue | undefined {
        return this.#metadata[this.#getMetadataKey(name)] as Types.JsonValue | undefined
    }

    desc(description: string): this {
        return this.description(description)
    }

    description(description: string): this {
        return this.#setMetadata('description', description)
    }

    version(version: string): this {
        return this.#setMetadata('version', version)
    }

    title(title: string): this {
        return this.#setMetadata('title', title)
    }

    valueOf(): Types.CommonMetadata {
        return { ...this.#metadata }
    }

    toJson(): Types.CommonMetadata {
        return this.valueOf()
    }

    isValid(): boolean {
        return false
    }
}

export class Message extends Base {
    get isPolytricMessage(): boolean {
        return true
    }
    #payload?: any
    #from?: string[]

    constructor(name: string) {
        super(name)
    }

    getPayload(): any | undefined {
        return this.#payload
    }

    payload(payload: any): this {
        this.#payload = payload.valueOf()
        return this
    }

    from(...from: string[]): this {
        this.#from ??= []
        this.#from.push(...from)
        return this
    }

    valueOf(): Types.Message {
        if (!this.#payload) {
            throw new Error('Payload is required')
        }
        const ret: Types.Message = {
            ...super.valueOf(),
            payload: this.#payload,
        }
        if (this.#from) {
            ret.from = this.#from
        }
        return ret
    }

    static fromJson(json: Types.Message): Message {
        const { payload, from, ...metadata } = json
        const ret = new Message(json.name as string)
        for (const [key, value] of Object.entries(metadata)) {
            ret.metadata(key, value)
        }
        ret.payload(payload)
        if (from) {
            ret.from(...from)
        }
        return ret
    }

    assertValid(): boolean {
        if (this.#payload === undefined) {
            throw new Error('Payload is required')
        }
        return true
    }
}

export class Endpoint {
    #scheme: string = 'ws'
    #host: string
    #port: number = 433
    #path: string

    constructor(scheme: string, host: string, port: number, path: string) {
        this.#scheme = scheme
        this.#host = host
        this.#port = port
        this.#path = path
    }

    valueOf(): Types.Endpoint {
        return {
            scheme: this.#scheme,
            host: this.#host,
            port: this.#port,
            path: this.#path,
        }
    }

    toJson(): Types.Endpoint {
        return this.valueOf()
    }

    static fromJson(json: Types.Endpoint): Endpoint {
        return new Endpoint(json.scheme, json.host, json.port, json.path)
    }
}

export class Role extends Base {
    get isPolytricRole(): boolean {
        return true
    }
    #messages: { [key: string]: Message } = {}
    #endpoints: Endpoint[] = []

    isHost: boolean = false

    asHost(): this {
        this.isHost = true
        return this
    }

    message(message: Message): this {
        this.#messages[message.name] = message
        return this
    }

    get messages(): Record<string, Message> {
        return this.#messages
    }

    endpoint(endpoint: Endpoint): this {
        this.#endpoints.push(endpoint)
        return this
    }

    valueOf(): Types.Role {
        const messages: { [key: string]: Types.Message } = {}
        for (const [name, message] of Object.entries(this.#messages)) {
            messages[name] = message.valueOf()
        }
        const ret: Types.Role = {
            ...super.valueOf(),
            messages,
        }
        if (this.#endpoints.length > 0) {
            ret.endpoints = this.#endpoints.map(endpoint => endpoint.valueOf())
        }
        return ret
    }

    static fromJson(json: Types.Role): Role {
        const { messages, endpoints, ...metadata } = json
        const ret = new Role(json.name)
        for (const [key, value] of Object.entries(metadata)) {
            ret.metadata(key, value)
        }
        for (const message of Object.values(messages)) {
            ret.message(Message.fromJson(message))
        }
        for (const endpoint of endpoints ?? []) {
            ret.endpoint(Endpoint.fromJson(endpoint))
        }
        return ret
    }

    assertValid(): boolean {
        for (const message of Object.values(this.#messages)) {
            message.assertValid()
        }
        return true
    }
}

export class Network extends Base {
    get isPolytricNetwork(): boolean {
        return true
    }
    #roles: { [key: string]: Role } = {}

    role(role: Role): this {
        this.#roles[role.name] = role
        return this
    }

    get roles(): { [key: string]: Role } {
        return this.#roles
    }

    valueOf(): Types.Network {
        const roles: { [key: string]: Types.Role } = {}
        for (const [name, role] of Object.entries(this.#roles)) {
            roles[name] = role.valueOf()
        }
        return {
            ...super.valueOf(),
            roles,
        }
    }

    static fromJson(json: Types.Network): Network {
        const { roles, ...metadata } = json
        const ret = new Network(json.name as string)
        for (const [key, value] of Object.entries(metadata)) {
            ret.metadata(key, value)
        }
        for (const role of Object.values(roles)) {
            ret.role(Role.fromJson(role))
        }
        return ret
    }

    assertValid(): boolean {
        const hostRoles: Role[] = []
        const remoteRoles: Role[] = []
        for (const role of Object.values(this.#roles)) {
            role.assertValid()

            if (role.isHost) {
                hostRoles.push(role as Role)
            } else {
                remoteRoles.push(role as Role)
            }
        }
        if (remoteRoles.length === 0) {
            throw new Error('At least one remote role must be defined')
        }
        const messages = new Set<string>()
        for (const role of Object.values(this.#roles)) {
            if (!role.isHost) {
                continue
            }
            for (const message of Object.values(role.messages)) {
                if (messages.has(message.name)) {
                    throw new Error(
                        `Message '${message.name}' is defined in multiple host roles: ${hostRoles.map(role => role.name).join(', ')}`
                    )
                }
                messages.add(message.name)
            }
        }

        return true
    }
}

export class Spec extends Base {
    get isPolytricSpec(): boolean {
        return true
    }
    #networks: { [key: string]: Network } = {}

    constructor(openws: string, name: string) {
        super(name)
        this.metadata('openws', openws)
    }

    network(network: Network): this {
        this.#networks[network.name] = network
        return this
    }

    get networks(): Record<string, Network> {
        return this.#networks
    }

    valueOf(): Types.Spec {
        const networks: { [key: string]: Types.Network } = {}
        for (const [name, network] of Object.entries(this.#networks)) {
            networks[name] = network.valueOf()
        }
        return {
            ...super.valueOf(),
            openws: this.getMetadata('openws') as string,
            networks,
        }
    }

    static fromJson(json: Types.Spec): Spec {
        const { networks, ...metadata } = json
        const ret = new Spec(json.openws as string, json.name as string)
        for (const [key, value] of Object.entries(metadata)) {
            ret.metadata(key, value)
        }
        for (const network of Object.values(networks)) {
            ret.network(Network.fromJson(network))
        }
        return ret
    }

    assertValid(): boolean {
        for (const network of Object.values(this.#networks)) {
            network.assertValid()
        }
        return true
    }
}

export function spec(openws: string, name: string): Spec
export function spec(spec: Types.Spec): Spec
export function spec(openwsOrSpec: string | Types.Spec, name?: string): Spec {
    if (typeof openwsOrSpec === 'string') {
        return new Spec(openwsOrSpec, name!)
    } else {
        return Spec.fromJson(openwsOrSpec)
    }
}

export function network(network: string | Types.Network): Network {
    if (typeof network === 'string') {
        return new Network(network)
    } else {
        return Network.fromJson(network)
    }
}

export function role(role: string | Types.Role): Role {
    if (typeof role === 'string') {
        return new Role(role)
    } else {
        return Role.fromJson(role)
    }
}

export function message(msg: string | Types.Message): Message {
    if (typeof msg === 'string') {
        return new Message(msg)
    } else {
        return Message.fromJson(msg)
    }
}

export function endpoint(endpoint: Types.Endpoint): Endpoint
export function endpoint(scheme: string, host: string, port: number, path: string): Endpoint
export function endpoint(
    schemeOrEndpoint: string | Types.Endpoint,
    host?: string,
    port?: number,
    path?: string
): Endpoint {
    if (typeof schemeOrEndpoint === 'string') {
        return new Endpoint(schemeOrEndpoint, host!, port!, path!)
    } else {
        return Endpoint.fromJson(schemeOrEndpoint)
    }
}
