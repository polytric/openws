import assert from 'node:assert/strict'

import * as WS from '@polytric/openws/class'

class Client {
    static CONFIG = {
        name: 'client',
        messages: {},
    }
}

class Portal {
    static CONFIG = {
        name: 'portal',
        messages: {},
    }
}

class Server {
    static CONFIG = {
        name: 'server',
        handlers: {},
    }

    events: string[] = []

    async handleOpen(fromRole: string) {
        this.events.push(`open:${fromRole}`)
    }

    async handleClose(fromRole: string) {
        this.events.push(`close:${fromRole}`)
    }

    async handleError(fromRole: string, error: Error) {
        this.events.push(`error:${fromRole}:${error.message}`)
    }
}

const server = new Server()
const binder = WS.bindings(
    {
        name: 'lifecycle',
        roles: [Server, Client, Portal],
    },
    {
        server,
    }
)
const runtime = WS.runtime(binder)
const clientSession = runtime.newSession(async () => {})
const portalSession = runtime.newSession(async () => {})

await clientSession.open('client')
await clientSession.error(new Error('socket failed'))
await clientSession.close()

await portalSession.open('portal')
await portalSession.error(new Error('portal failed'))
await portalSession.close()

assert.deepEqual(server.events, [
    'open:client',
    'error:client:socket failed',
    'close:client',
    'open:portal',
    'error:portal:portal failed',
    'close:portal',
])
