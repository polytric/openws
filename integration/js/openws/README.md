# Polytric OpenWS Framework <!-- omit in toc -->

`@polytric/openws` is the JavaScript and TypeScript binder and runtime layer for the OpenWS stack.

It provides:

- A single source of truth for WebSocket message contracts (the network spec)
- Automatic binding between inbound messages and handler functions
- Typed and ergonomic outbound message APIs (in JS and especially in TS)
- Connection-scoped state (one connection -> one object)
- Lifecycle hooks and consistent routing conventions
- A stable spec artifact for tooling (UI, SDK generation, validation)

This package is framework-agnostic. Server integrations are provided by adapters (for example `@polytric/fastify-openws`).

OpenWS supports three authoring styles:

1. Class-first using static configuration, supports both TS and JS without additional compilation setup
2. Class-first with decorators, supports better type hints and developer ergonomics, TS works out of box, while JS needs to add a compilation step
3. Fluent / functional spec definition

# Table of Contents <!-- omit in toc -->

- [Installation](#installation)
- [Core Concepts](#core-concepts)
    - [Roles](#roles)

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

- Which messages exist for that participant
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
