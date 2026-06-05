# Polytric OpenWS Framework <!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/@polytric/openws)](https://www.npmjs.com/package/@polytric/openws)
[![license](https://img.shields.io/npm/l/@polytric/openws)](https://github.com/polytric/openws/blob/main/LICENSE)

Polytric OpenWS Framework for JavaScript and TypeScript provides the runtime layer of the OpenWS stack.

It provides:

- A single source of truth for WebSocket message contracts (the network spec)
- Automatic binding between inbound messages and handler functions
- Typed and ergonomic peer handles (in JS and especially in TS)
- Connection-scoped state (one connection -> one object)
- Lifecycle hooks and consistent routing conventions
- A stable spec artifact for tooling (UI, SDK generation, validation)

This package is framework-agnostic. Server integrations are provided by adapters (for example `@polytric/fastify-openws`).

OpenWS supports three authoring styles:

1. Class-first using static configuration, supports both TS and JS without additional compilation setup
2. Class-first with decorators, supports better type hints and developer ergonomics, TS works out of box, while JS needs to add a compilation step
3. Fluent / functional spec definition

- [Installation](#installation)
- [Core Concepts](#core-concepts)
    - [Roles](#roles)
        - [HostRole and Handlers](#hostrole-and-handlers)
        - [Peer Type Hints](#peer-type-hints)
    - [Message Rejection](#message-rejection)
    - [Handler Bindings](#handler-bindings)
    - [Runtime and Sessions](#runtime-and-sessions)
- [OpenWS Spec Generation](#openws-spec-generation)
- [Framework Integration](#framework-integration)
    - [Establishing `fromRole`](#establishing-fromrole)
    - [Sending outbound messages](#sending-outbound-messages)
    - [Example integration shape](#example-integration-shape)
    - [Adapters](#adapters)
- [Tooling](#tooling)
- [Authoring Styles (Advanced)](#authoring-styles-advanced)
    - [Decorator style (TypeScript)](#decorator-style-typescript)
    - [Fluent / functional style](#fluent--functional-style)
- [Summary](#summary)

# Installation

Core runtime and binder:

```bash
npm i @polytric/openws
```

Fastify adapter (server integration):

```bash
npm i @polytric/fastify-openws
```

Optional tooling (when you are ready):

```bash
npm i @polytric/openws-ui @polytric/openws-sdkgen
```

---

# Core Concepts

Imagine you are building a miniature chat system with a server, a client, and a customer admin portal. Clients can create and join rooms, then send messages. The portal can request room status and other administrative information.

This translates to a network containing 3 roles in the OpenWS spec:

- A `client` role that connects to `server`
- A `portal` role that connects to `server`
- A `server` role that forwards `client` messages based on room membership, and reports stats to `portal`

We will first explore the class-first approach to build this system, and walk through core concepts along the way. Once the mental model is established, the decorator and fluent style APIs should become self explanatory later. A basic understanding of the OpenWS spec will help too.

## Roles

A role describes:

- Which messages exist for that peer role
- The contract (payload shape) for each message
- Metadata used to produce the normalized network spec

In the class-first style, to define a role you create a class with a static `CONFIG` object attached. The `CONFIG` object describes the role's messages as a map of:

- `messageName` -> `messageSpec`

For example, to define a `client` role:

```<!-- embed:./test/class.ts:scope:class Client -->
class Client {
    static CONFIG = {
        name: 'client',
        description: 'A chat client role',
        messages: {
            joinedRoom: {
                payload: S.obj({ joinerId: S.str, roomId: S.str }),
            },
            receivedMessage: {
                payload: S.obj({ senderId: S.str, roomId: S.str, text: S.str }),
            },
        },
    }
}
```

The same pattern applies to the `portal` role.

A role definition is intentionally declarative:

- It can be consumed by the binder to produce peer handles and validation rules.
- It can be exported as a stable spec artifact for tooling.

### HostRole and Handlers

While the OpenWS spec treats roles uniformly, the runtime distinguishes the peer role running on the host machine. The host peer differs because it must:

- Receive inbound messages and dispatch them to application logic
- Send validated outbound messages to connected peers

The runtime defines `hostRole` as the role the host peer implements.

For remote roles, the `CONFIG` object declares `messages`.

For the host role, the `CONFIG` object declares `handlers` instead of `messages`:

1. Host role defines `handlers` instead of `messages`.
2. Host role defines `async handler(payload, peer)` for each handler defined in `CONFIG`.

The `peer` argument is the connected peer handle for the connection that sent the message (for example a `client` peer or a `portal` peer). This is a critical part of the design: a handler receives both the validated payload and a capability-scoped peer handle for responding.

Concretely, the server role (that handles createRoom, joinRoom, sendMessage and requestRoomStats) would look like this:

```<!-- embed:./test/class.ts:scope:class Server -->
class Server {
    static CONFIG = {
        name: 'server',
        description: 'A chat server role',
        handlers: {
            createRoom: {
                payload: S.obj({ userId: S.str, roomId: S.str }),
                from: [Client],
            },
            joinRoom: {
                payload: S.obj({ userId: S.str, roomId: S.str }),
                from: [Client],
            },
            sendMessage: {
                payload: S.obj({ userId: S.str, roomId: S.str, text: S.str }),
                from: [Client, Portal],
            },
            requestRoomStats: {
                payload: S.obj({ roomId: S.str }),
                from: [Portal],
            },
        },
    }

    rooms: { [roomId: string]: { members: string[] } } = {}
    users: { [userId: string]: { userId: string; peer: WS.Peer<typeof Client> } } = {}

    async createRoom(
        { userId, roomId }: { userId: string; roomId: string },
        peer: WS.Peer<typeof Client>
    ) {
        this.rooms[roomId] = { members: [userId] }
        this.users[userId] = { userId, peer }
        await peer.joinedRoom({ roomId, joinerId: userId })
    }

    async joinRoom(
        { userId, roomId }: { userId: string; roomId: string },
        peer: WS.Peer<typeof Client>
    ) {
        this.rooms[roomId].members.push(userId)
        this.users[userId] = { userId, peer }
        for (const member of this.rooms[roomId].members) {
            await this.users[member].peer.joinedRoom({ roomId, joinerId: userId })
        }
    }

    async sendMessage(
        { userId, roomId, text }: { userId: string; roomId: string; text: string },
        _peer: WS.Peer<typeof Client> | WS.Peer<typeof Portal>
    ) {
        for (const member of this.rooms[roomId].members) {
            if (member !== userId) {
                await this.users[member].peer.receivedMessage({ roomId, senderId: userId, text })
            }
        }
    }

    async requestRoomStats({ roomId }: { roomId: string }, peer: WS.Peer<typeof Portal>) {
        await peer.receivedRoomStats({ roomId, members: this.rooms[roomId].members })
    }
}
```

### Peer Type Hints

Depending on the connected peer's role, a different `peer` object is passed to the `handler(payload, peer)` method.

In TypeScript, instead of using `any` for the `peer` parameter, you can use `Peer<typeof RoleClass>` to enable compiler type checks. This ensures that when a handler is invoked, the `peer` object is statically constrained to the messages that the connected peer is allowed to receive.

This is shown consistently in the embedded examples above.

## Message Rejection

The OpenWS spec allows modeling a sender whitelist per message. For example:

- Only clients may call `createRoom` and `joinRoom`
- Only the portal may call `requestRoomStats`
- Both the client and the portal may call `sendMessage`

This framework faithfully models these constraints in message configuration and enforces them at runtime. When a peer sends a message it is not permitted to send, the runtime rejects the message before it reaches application logic.

In other words:

- Message rejection is a protocol-level rule (derived from the spec), not a convention.
- Handlers can assume the `fromRole` has already been validated against the message spec.

Example configuration:

```<!-- embed:./test/class.ts:scope:Server:CONFIG:joinRoom -->
            joinRoom: {
                payload: S.obj({ userId: S.str, roomId: S.str }),
                from: [Client],
            },
```

## Handler Bindings

A key concept of this framework is handler bindings.

A handler binding maps messages defined in the OpenWS spec for the `hostRole` to a concrete handler implementation on the host role, while passing the connected peer handle (`client` or `portal` in this example) as the `peer` argument to the handler.

Bindings are created from `binding(networkConfig)`, where the config contains the name, description and roles of the network.

The binder is responsible for:

- Normalizing role configuration into a single network definition
- Producing role-aware peer handles for outbound messaging
- Producing handler dispatch rules for inbound messaging
- Holding lifecycle behavior for remote roles (`onOpen`, `onClose`, `onError`)
- Providing access to the network spec for export and tooling

The binder is created like this:

```<!-- embed:./test/class.ts:scope:const binder -->
const binder = WS.bindings({
    name: 'chat',
    description: 'A chat network',
    roles: [Server, Client, Portal],
})
```

In practice, you will typically keep the binder close to your application entrypoint:

- It is a pure artifact derived from static configuration.
- It can be reused across test harnesses and server integrations.
- It is the easiest place to centralize network metadata (name, description, versioning fields, etc.).
- It is where you attach behavior to the network before a runtime materializes that behavior.

## Runtime and Sessions

A concrete runtime is created from the bindings. The network is the declarative memory graph of the spec; bindings attach behavior to that graph; the runtime turns those bindings into concrete peer handles and per-connection sessions.

The runtime is intentionally lightweight and framework-agnostic. It provides an API to create session objects. Once defined, the runtime will:

- Validate message envelopes and payloads
- Dispatch inbound messages to instance methods
- Provide peer handles to talk to connected peers
- Invoke lifecycle callbacks when transport glue opens, closes, or reports an error on a session

```<!-- embed:./test/class.ts:section:runtime example start:runtime example end -->
const runtime = WS.runtime(binder)

const session1 = runtime.newSession(async (fromRole: string, messageName: string, payload: any) => {
    console.log(fromRole, messageName, payload)
})
```

A session object represents a connection established from a remote role to the host. Sessions provide a small, explicit lifecycle surface:

- `open(fromRole)`
- `handleMessage(fromRole, messageName, payload)`
- `close()`
- `error(error)`

Transport or adapter code should translate concrete socket events into those calls. For example, when a WebSocket is accepted and identified as the `client` role, the adapter calls `session.open('client')`. When the socket receives an OpenWS envelope, the adapter calls `session.handleMessage(...)`. When the socket closes or emits an error, the adapter calls `session.close()` or `session.error(error)`.

Remote-role lifecycle hooks are registered on the binder:

```ts
binder.fromRoles.client
    .onOpen(async fromRole => {
        console.log(`${fromRole} connected`)
    })
    .onClose(async fromRole => {
        console.log(`${fromRole} disconnected`)
    })
    .onError(async (fromRole, error) => {
        console.error(`${fromRole} connection error`, error)
    })
```

```<!-- embed:./test/class.ts:section:session example start:session example end -->
await session1.open('client')
await session2.open('client')

await session1.handleMessage('client', 'createRoom', { userId: 'userA', roomId: 'room1' })
await session2.handleMessage('client', 'joinRoom', { userId: 'userB', roomId: 'room1' })
await session1.handleMessage('client', 'sendMessage', {
    userId: 'userA',
    roomId: 'room1',
    text: 'Hello, world!',
})
await session2.handleMessage('client', 'sendMessage', {
    userId: 'userB',
    roomId: 'room1',
    text: 'Hello, world!',
})
```

This separation of concerns is deliberate:

- The network represents the protocol graph and can be exported as a clean JSON spec.
- Bindings attach runtime behavior to the network: message handlers, lifecycle callbacks, validation, and peer handle construction.
- The runtime materializes bindings into concrete helpers such as peer handles and sessions.
- A session represents a single connection, including state and lifecycle.
- Transport glue owns the socket and is responsible for calling the session lifecycle methods.

Because sessions are independent of any WebSocket framework, they are also suitable for unit tests and simulation harnesses.

Generated SDK clients follow the same network and binding model. Their `connect(...)` methods create a session, open it for the remote role, and return the connected peer handle. Their public error callbacks are transport-level helpers such as `onMessageError(...)` and `onSocketError(...)`. Those callbacks are generated SDK conveniences; they are not the same entry point as fluent `binder.fromRoles.<role>.onError(...)`, which is called through `Session.error(error)`.

# OpenWS Spec Generation

The `binder` (or `bindings`) object gives you access to the network definition in a form that can be converted into a full OpenWS spec.

In particular, you can use the fluent network spec builder from `@polytric/openws-spec`, and emit the spec using the binder's normalized `network` representation.

Conceptually:

```ts
import * as WS from '@polytric/openws-spec'

// binder.network is a normalized network definition derived from your CONFIG objects.
const spec = WS.spec('0.0.2').network(binder.network).valueOf()
```

The emitted spec is intended to be:

- Stable enough for tooling
- Machine-readable for SDK generation
- Precise enough for validation and compatibility checks

Read more on the builder in the specification repository.

# Framework Integration

The binder provides APIs to model messages, roles, network and runtime handlers for the host role. The runtime provides an API to integrate with WebSocket frameworks.

Notice the `createSession` and `open(fromRole)` split. Session creation is divided into two distinct steps because, in a naive WebSocket implementation, when a connection is established the identity of the peer on the other side of the connection is not established yet.

A typical integration flow is:

1. A socket connects.
2. The server creates a session immediately (`createSession`) to attach lifecycle and outbound send behavior.
3. The server delays `open(fromRole)` until it can determine the role of the remote peer.
4. For each inbound message frame, the server parses the envelope and calls `handleMessage(...)`.
5. On disconnect or error, the server calls `close()` or `error(err)`.

This design allows you to keep transport concerns separate from protocol concerns:

- The integration layer is responsible for sockets, frames, and connection establishment.
- The session is responsible for protocol validation, dispatch, and role-aware messaging.

## Establishing `fromRole`

You must decide how to determine the remote role. Common approaches include:

- One endpoint per role (role is implied by the URL path)
- A query parameter or header negotiated during the handshake
- A dedicated initial message (an explicit "hello" or "identify" message)

The runtime does not mandate the strategy. It only requires that, before messages are dispatched, you call `open(fromRole)` with a valid role name from the network.

For security and correctness, role establishment should be treated as authentication or capability negotiation:

- The server should not accept privileged messages until the role has been established.
- If the role is determined by URL or headers, validate those inputs before calling `open(fromRole)`.

## Sending outbound messages

Frameworks typically send raw WebSocket frames (often JSON strings). The runtime expects the integration layer to provide a transport function that can send an encoded message envelope back to the socket.

In other words:

- The session is responsible for protocol behavior and validation.
- The integration layer is responsible for bytes on the wire.

As long as you can deliver a string (or buffer) to the socket, the session can remain framework-agnostic.

## Example integration shape

The code below is intentionally conceptual. The canonical framework wiring should live in adapter packages (for example `@polytric/fastify-openws`) and in integration test cases.

If you maintain a minimal adapter in your application, it often looks like:

- Create a session on connect
- Parse inbound frames into `(fromRole, messageName, payload)`
- Call `session.open(fromRole)` once
- Call `session.handleMessage(fromRole, messageName, payload)` for each message
- On close/error, call `session.close()` / `session.error(err)`

A few practical recommendations:

- If role establishment happens via an initial "identify" message, perform `open(fromRole)` only after validating that message.
- If you accept messages before `open(fromRole)`, you must decide whether to buffer them or reject them. Rejecting by default is simpler and safer.
- Always treat the inbound `messageName` as untrusted input and let the runtime enforce the allow-list from the spec.

## Adapters

If you do not want to maintain your own framework wiring, use an adapter.

For Fastify, the adapter package is `@polytric/fastify-openws`. Adapters generally provide:

- WebSocket route registration
- Connection lifecycle management (session creation, close/error propagation)
- Optional spec exposure endpoints for tooling in non-production builds

Adapters should be considered the canonical reference for framework wiring. Application code should remain focused on roles, handlers, and business logic.

---

# Tooling

Once you have a stable spec artifact, you can enable additional tooling:

- `@polytric/openws-ui` can render an interactive view of your network and messages
- `@polytric/openws-sdkgen` can generate SDKs for other languages and environments

These tools are optional. Many applications begin with only the runtime binder and an adapter, and add tooling later.

Typical adoption sequence:

1. Start with class-first roles, binder, runtime, and a server adapter.
2. Export the spec when you need documentation or contract visibility.
3. Add UI and SDK generation when you need broader integration across teams or languages.

---

# Authoring Styles (Advanced)

The class-first static configuration style is the most direct approach for plain JavaScript. When you are ready for additional ergonomics, OpenWS also supports decorators and fluent APIs.

All authoring styles produce the same conceptual runtime pieces: a normalized network graph, a binder that attaches behavior to that graph, and a runtime that materializes bindings into peer handles and sessions. The class and decorator styles are convenience layers that compile down to the fluent model internally.

The remainder of this README is brief by design. It serves as orientation so you can recognize these styles when reading other examples.

## Decorator style (TypeScript)

Decorator style is still class-first, but uses decorators to keep spec and implementation close together and to improve type inference in TS.

This style typically requires TypeScript (and decorator support) or an equivalent build step.

In this style, `@role`, `@message`, and `@handler` record metadata on classes and methods. `WS.network(config)` reads that metadata into the normalized spec graph, while `WS.bindings(config)` also instantiates host roles and wires decorated handler methods into the runtime binder.

```ts
// Canonical example is embedded from tests.
```

```<!-- embed:./test/decorator.ts:section:decorator start:decorator end -->
import * as WS from '@polytric/openws/decorator'

@WS.role({ description: 'A chat client role' })
class Client {
    @WS.message({ payload: S.obj({ joinerId: S.str, roomId: S.str }) })
    async joinedRoom() {
        // reserved for later
    }

    @WS.message({ payload: S.obj({ senderId: S.str, roomId: S.str, text: S.str }) })
    async receivedMessage() {
        // reserved for later
    }
}

@WS.role({ description: 'A chat portal role' })
class Portal {
    @WS.message({ payload: S.obj({ roomId: S.str }) })
    async receivedRoomStats() {
        // reserved for later
    }
}

@WS.role({ description: 'A chat server role' })
class Server {
    rooms: { [roomId: string]: { members: string[] } } = {}
    users: { [userId: string]: { userId: string; peer: WS.Peer<typeof Client> } } = {}

    @WS.handler({ payload: S.obj({ userId: S.str, roomId: S.str }), from: [Client] })
    async createRoom(
        { userId, roomId }: { userId: string; roomId: string },
        peer: WS.Peer<typeof Client>
    ) {
        this.rooms[roomId] = { members: [userId] }
        this.users[userId] = { userId, peer }
        await peer.joinedRoom({ roomId, joinerId: userId })
    }

    @WS.handler({ payload: S.obj({ userId: S.str, roomId: S.str }), from: Client })
    async joinRoom(
        { userId, roomId }: { userId: string; roomId: string },
        peer: WS.Peer<typeof Client>
    ) {
        this.rooms[roomId].members.push(userId)
        this.users[userId] = { userId, peer }
        await peer.joinedRoom({ roomId, joinerId: userId })
    }

    @WS.handler({
        name: 'sendMessage',
        payload: S.obj({ userId: S.str, roomId: S.str, text: S.str }),
        from: [Client],
    })
    async sendMessage(
        { userId, roomId, text }: { userId: string; roomId: string; text: string },
        _peer: WS.Peer<typeof Client>
    ) {
        for (const member of this.rooms[roomId].members) {
            if (userId && member === userId) {
                continue
            }
            await this.users[member].peer.receivedMessage({
                roomId,
                senderId: userId,
                text,
            })
        }
    }

    @WS.handler({
        name: 'sendMessage',
        from: [Portal],
        // Payload shape must stay identical. It's a limitation that needs to be addressed in the future.
        payload: S.obj({ userId: S.str, roomId: S.str, text: S.str }),
    })
    async sendMessagePortal({
        userId,
        roomId,
        text,
    }: {
        userId: string
        roomId: string
        text: string
    }) {
        for (const member of this.rooms[roomId].members) {
            await this.users[member].peer.receivedMessage({ roomId, senderId: userId, text })
        }
    }

    @WS.handler({ payload: S.obj({ roomId: S.str }), from: [Portal] })
    async requestRoomStats({ roomId }: { roomId: string }, peer: WS.Peer<typeof Portal>) {
        await peer.receivedRoomStats({ roomId })
    }
}

```

Use this style when:

- You want stronger TS editor hints with minimal boilerplate
- You prefer to colocate message declarations and handlers
- You accept a build step for JS environments

## Fluent / functional style

Fluent and functional APIs are intended for:

- Programmatic spec generation
- Library use cases where you need to assemble information piece by piece (this framework converts class-first representation to fluent representation under the hood)
- Scenarios where composition and reuse are primary concerns

```ts
// Canonical example is embedded from tests.
```

```<!-- embed:./test/fluent.ts:section:fluent start:fluent end -->
import * as WS from '@polytric/openws/fluent'
import type { PeerProto } from '@polytric/openws/fluent'
import { validate } from '@polytric/openws-spec'

const globalCtx: AppContext = {
    rooms: {},
    users: {},
}

const clientRole = WS.role('client')
    .desc('A client role')
    .message(
        WS.message('joinedRoom')
            .payload(S.obj({ userId: S.str, roomId: S.str }))
            .desc('A room joined request')
    )
    .message(
        WS.message('receivedMessage')
            .payload(S.obj({ roomId: S.str, senderId: S.str, text: S.str, sentAt: S.int }))
            .desc('A message received request')
    )

const portalRole = WS.role('portal')
    .desc('A portal role')
    .message(
        WS.message('receivedRoomStats')
            .payload(S.obj({ roomId: S.str }))
            .desc('A room stats request')
    )

const serverRole = WS.role('server')
    .asHost()
    .desc('A server role')
    .endpoint(WS.endpoint('ws', 'localhost', 8082, '/chat'))
    .message(
        WS.message('createRoom')
            .payload(S.obj({ userId: S.str, roomId: S.str }))
            .desc('A room creation request')
    )
    .message(
        WS.message('joinRoom')
            .payload(S.obj({ userId: S.str, roomId: S.str }))
            .desc('A room join request')
    )
    .message(
        WS.message('sendMessage')
            .payload(S.obj({ userId: S.str, roomId: S.str, text: S.str }))
            .desc('A message send request')
    )
    .message(
        WS.message('requestRoomStats')
            .payload(S.obj({ roomId: S.str }))
            .desc('A room stats request')
    )

const network = WS.network('chat')
    .role(serverRole)
    .role(clientRole)
    .role(portalRole)
    .desc('A chat network')

const spec = WS.spec('0.0.1', 'Chat Example').network(network)
const specJson = spec.valueOf()
validate(specJson)

type AppContext = {
    rooms: { [roomId: string]: { users: Set<string> } }
    users: { [userId: string]: { userId: string; peer: PeerProto } }
}

const binder = WS.bindings(network)
binder.fromRoles.client
    .on('createRoom', async (payload: { userId: string; roomId: string }, peer: PeerProto) => {
        globalCtx.rooms[payload.roomId] = { users: new Set([payload.userId]) }
        globalCtx.users[payload.userId] = { userId: payload.userId, peer }
        peer.joinedRoom({ roomId: payload.roomId, userId: payload.userId })
    })
    .on('joinRoom', async (payload: { userId: string; roomId: string }, peer: PeerProto) => {
        globalCtx.rooms[payload.roomId].users.add(payload.userId)
        globalCtx.users[payload.userId] = { userId: payload.userId, peer }
        peer.joinedRoom({ roomId: payload.roomId, userId: payload.userId })
    })
    .on(
        'sendMessage',
        async (payload: { userId: string; roomId: string; text: string }, peer: PeerProto) => {
            const room = globalCtx.rooms[payload.roomId]
            if (!room) {
                throw new Error(`Room ${payload.roomId} not found`)
            }
            for (const userId of room.users) {
                const user = globalCtx.users[userId]
                if (!user || userId === payload.userId) {
                    continue
                }
                user.peer.receivedMessage({
                    roomId: payload.roomId,
                    senderId: payload.userId,
                    text: payload.text,
                    sentAt: Date.now(),
                })
            }
        }
    )
    .on('requestRoomStats', async (payload: { roomId: string }, peer: PeerProto) => {
        console.log('requestRoomStats', payload.roomId)
    })

binder.fromRoles.portal.on(
    'requestRoomStats',
    async (payload: { roomId: string }, peer: PeerProto) => {
        console.log('requestRoomStats', payload.roomId)
    }
)
```

Use this style when:

- Your spec is assembled dynamically (feature flags, plugins, modules)
- You want a purely functional and composable spec definition surface

---

# Summary

- `@polytric/openws` is the JS/TS binder and runtime layer for OpenWS.
- The network spec is the source of truth and can be exported for tooling.
- The class-first style supports plain JavaScript without a build step and is recommended as a starting point.
- Decorator and fluent styles are available for teams that prefer additional ergonomics or programmatic spec generation.
