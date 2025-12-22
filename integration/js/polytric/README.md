# Polytric OpenWS Framework

`@polytric/openws` is the application layer abstraction in OpenWS stack.

It provides:

- Class-based structure
- Lifecycle hooks
- Convention over configuration
- Clean separation of concerns

It is built on top of `@polytric/fastify-openws` and `@polytric/fastify-openws-spec` and have plans to expand to other frameworks like Express.

# The `Server` Base Class

```js
const { Server } = require('@polytric/openws')
```

A server defines a full OpenWS network, a `server` participant, and metadata to help SDK / code gen.

```js
class ChatServer extends Server {
  static config = {
    url: '/abc',
    name: 'Chat',
    hostRole: 'server',
    participants: { ... }
  }
}
```

# Registering the server

```js
await ChatServer.register(fastify)
```

This:
1. Registers necessary fastify plugins, and on non-prod builds expose `/open-ws.json` for tooling.
1. Registers `url` as the WS endpoint
1. State lifecycle management: Automatically instantiates a ChatServer instance per connection
1. Bind messages to instance methods

# Instance = Connection State

```js
class ChatServer extends Server {
  async onMessage(msg) {
    this.ctx.client.message(`echo: ${msg}`)
  }
}
```

Each instance:

- Has its own memory
- Owns its lifecycle
- Talks to peers via `this.ctx`

# Lifecycle Methods

Override as needed:

- onOpen()
- onClose()
- onError(error)
- on<handler>(payload)

No manual routing or binding required.

# Why this layer exists

Without it, applications tend to accumulate:

- Large switch statements
- Shared mutable state
- Ad-hoc routing logic

This layer enforces:

- One connection → one object
- Clear message ownership
- Testable, composable logic

# Summary

- `Spec`: `@polytric/openws-spec` defines contracts
- `Runtime`: `@polytric/fastify-openws` enforces correctness
- `Spec Generation`: `@polytric/fastify-openws-spec` emits spec from API definition
- `SDK Generation`: `@polytric/openws-sdkgen` emits SDKs for various languages
- `Framework`: `@polytric/openws` defines structure

You can stop at any layer — or use all three.
