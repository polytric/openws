# Polytric Fastify OpenWS Plugin <!-- omit in toc -->

`@polytric/fastify-openws` is a Fastify plugin that executes OpenWS-style WebSocket networks with:

- Schema validation
- Typed messaging
- Per-connection state
- Strict runtime enforcement

# Quick Start
## Installation

```bash
npm install @polytric/fastify-openws
```

## Register the Plugin

```js
const openws = require('@polytric/fastify-openws')

await fastifyApp.register(openws)
```

This adds:

```js
fastifyApp.ws(...)
```

## Register a OpenWS Network

```js
fastify.ws(
  {
    url: '/chat',
    name: 'chat',
    hostRole: 'server',
    participants
  },
  getState
)
```

### Participants

Participants closely follows the OpenWS spec, and:

- Defines what messages are allowed
- Used to compile validators
- No behavior is defined here

```js
participants: {
  server: {
    message: { payload: S.str }
  },
  client: {
    message: { payload: S.str }
  }
}
```

Note: You may use JSON schema libraries like `@pocketgems/schema` or `fluent-schema` or provide a raw JSON schema value as `payload`.

### `getState(ctx)`

`getState` is called once per WebSocket connection. Each call MUST return a new state object, with `on` callbacks like this:

```js
(ctx) => ({
  onMessage(payload) { ... }
})
```

# Message Dispatch

Incoming WS messages must match this shape `{ handlerName, payload }`. The payload must validate against the specified handler schema. The state object returned from `getState` must implement `on${handlerName}`. If a handler is not implemented, it results in connection closure.

Optional handlers on `state` object includes:

- onOpen()
- onClose()
- onError(error)

# Runtime guarantees

- Invalid payloads terminate connections
- Unknown handlers terminate connections
- All messages are schema-validated
- Each connection has isolated state

# Summary

This package is:

- A runtime executor
- A validator
- A WebSocket state manager

It is not opinionated about application structure.
