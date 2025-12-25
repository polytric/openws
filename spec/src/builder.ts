type SpecValue = string | number | boolean | null | undefined | { [key: string]: SpecValue };

class Component {
    #name: string
    #metadata: Record<string, SpecValue>

    constructor(name: string) {
        this.#name = name
        this.#metadata = {}
    }

    get name(): string {
        return this.#name
    }

    #setMetadata(name: string, value: SpecValue): this {
        this.#metadata[name] = value
        return this
    }

    metadata(name: string, value: SpecValue): this {
        if (['description', 'version', 'title', 'openws'].includes(name)) {
            return this.#setMetadata(name, value)
        }
        if (!name.startsWith('x-')) {
            name = `x-${name}`
        }
        return this.#setMetadata(name, value)
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

    toJson(): Record<string, SpecValue> {
        return {
            ...this.#metadata,
        }
    }
}

export class Message extends Component {
    #payload?: Record<string, SpecValue> | { valueOf: () => Record<string, SpecValue> }

    getPayload(): Record<string, SpecValue> | { valueOf: () => Record<string, SpecValue> } | undefined {
        return this.#payload
    }

    payload(payload: Record<string, SpecValue> | { valueOf: () => Record<string, SpecValue> }): this {
        this.#payload = payload
        return this
    }

    toJson(): Record<string, SpecValue> {
        if (!this.payload) {
            throw new Error('Payload is required')
        }
        return {
            ...super.toJson(),
            payload: (this.#payload?.valueOf ? this.#payload.valueOf() : this.#payload) as Record<string, SpecValue>,        
        }
    }
}

export class Role extends Component {
    messages: Record<string, Message> = {}
    
    message(message: Message): this {  
        this.messages[message.name] = message
        return this
    }

    toJson(): Record<string, SpecValue> {
        const messages: Record<string, Record<string, SpecValue>> = {}
        for (const [name, message] of Object.entries(this.messages)) {
            messages[name] = message.toJson()
        }
        return {
            ...super.toJson(),
            messages,
        }
    }
}

export class Network extends Component {
    roles: Record<string, Role> = {}

    role(role: Role): this {
        this.roles[role.name] = role
        return this
    }

    toJson(): Record<string, SpecValue> {
        const roles: Record<string, Record<string, SpecValue>> = {}
        for (const [name, role] of Object.entries(this.roles)) {
            roles[name] = role.toJson()
        }
        return {
            ...super.toJson(),
            roles,
        }
    }
}

export class Spec extends Component {
    #title?: string
    #networks: Record<string, Network> = {}

    constructor(openws: string) {
        super('spec')
        this.metadata('openws', openws)
    }

    title(title: string): this {
        this.#title = title
        return this
    }

    network(network: Network): this {
        this.#networks[network.name] = network
        return this
    }

    toJson(): Record<string, SpecValue> {
        const { version, description, ...rest } = super.toJson()
        const networks: Record<string, Record<string, SpecValue>> = {}
        for (const [name, network] of Object.entries(this.#networks)) {
            networks[name] = network.toJson()
        }
        return {
            ...rest,
            info: {
                title: this.#title,
                version,
                description,
            },
            networks,
        }
    }
}

export const WS = {
    spec(version: string): Spec {
        return new Spec(version)
    },
    network(name: string): Network {
        return new Network(name)
    },
    role(name: string): Role {
        return new Role(name)
    },
    message(name: string): Message {
        return new Message(name)
    },
    fromJson(specJson: string | Record<string, SpecValue>): Spec {
        const { openws, networks: networksJson, ...rest } = typeof specJson === 'string' ? JSON.parse(specJson) : specJson
        const spec = new Spec(openws)
        
        const { title, version, description } = rest

        spec.title(title)
        spec.version(version)
        spec.description(description)

        for (const [name, networkJson] of Object.entries(networksJson as Record<string, Record<string, SpecValue>>)) {
            const network = new Network(name)
            spec.network(network)

            const { roles, ...rest } = networkJson
            for (const [prop, value] of Object.entries(rest as Record<string, SpecValue>)) {
                network.metadata(prop, value)
            }
            for (const [roleName, roleJson] of Object.entries(roles as Record<string, Record<string, SpecValue>>)) {
                const role = new Role(roleName)
                network.role(role)

                const { messages, ...rest } = roleJson
                for (const [prop, value] of Object.entries(rest as Record<string, SpecValue>)) {
                    role.metadata(prop, value)
                }
                for (const [messageName, messageJson] of Object.entries(messages as Record<string, Record<string, SpecValue>>)) {
                    const message = new Message(messageName)
                    role.message(message)

                    const { payload, ...rest } = messageJson
                    for (const [prop, value] of Object.entries(rest as Record<string, SpecValue>)) {
                        message.metadata(prop, value)
                    }
                    message.payload(payload as Record<string, SpecValue> | { valueOf: () => Record<string, SpecValue> })
                }
            }
        }

        return spec
    }
}
