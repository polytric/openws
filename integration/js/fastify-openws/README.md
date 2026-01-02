# OpenWS Fastify Plugin

`@polytric/fastify-openws` is the Fastify adapter for the OpenWS framework (`@polytric/openws`).

This package is transport-focused:

- Register WebSocket endpoints in Fastify for an OpenWS network
- Create one OpenWS session per WebSocket connection
- Forward inbound frames into the OpenWS framework runtime for validation and dispatch
- Send outbound frames using the same envelope shape

Protocol authoring (roles, handlers, and bindings) is done in `@polytric/openws`. This README focuses on the plugin behavior and integration points.

---

## Install

```bash
pnpm add @polytric/fastify-openws
```

The plugin will register `@fastify/websocket` automatically if it is not already registered.

---

## Registering an endpoint

The plugin decorates Fastify with one method:

- `app.openws({ path, bindings })`

Where:

- `path` is the WebSocket route (for example `'/chat'`)
- `bindings` is a `NetworkBinder` created by the OpenWS framework

Minimal wiring:

```ts
import fastify from 'fastify'
import openws from '@polytric/fastify-openws'

// bindings are created using the OpenWS framework.
import { bindings } from './chat.bindings'

const app = fastify()

async function main() {
    await app.register(openws)

    app.openws({
        path: '/chat',
        bindings,
    })

    await app.listen({ port: 8082 })
}

main()
```

You may register multiple endpoints by calling `app.openws(...)` multiple times (one OpenWS network per route).

---

## What the plugin does

When you call:

```ts
app.openws({ path, bindings })
```

the plugin:

1. derives the network from the bindings (`bindings.network`)
2. validates the network (`network.assertValid()`)
3. builds an OpenWS runtime from the bindings
4. registers a Fastify `GET` route at `path` with `{ websocket: true }`
5. for each WebSocket connection:
    - creates a new OpenWS session (`runtime.newSession(...)`)
    - wires WebSocket events into the session lifecycle:
        - `message` -> parse envelope, `session.open(fromRole)`, `session.handleMessage(...)`
        - `close` -> `session.close()`
        - `error` -> `session.error(err)`
    - provides a transport callback so outbound envelopes are written via `conn.send(...)`

Conceptually:

- the OpenWS framework owns the protocol surface (roles, payload validation, handler bindings)
- a session executes that protocol for one connection
- this plugin bridges WebSocket frames to session calls

---

## Wire format (payload is a JSON string)

Each WebSocket frame is a JSON string with the following shape:

```json
{
    "fromRole": "client",
    "messageName": "joinRoom",
    "payload": "{\"userId\":\"u1\",\"roomId\":\"general\"}"
}
```

Notes:

- `fromRole` is the sender role name (string).
- `messageName` is the message name (string).
- `payload` an object that matches the payload's JSON schema.

This is consistent for both directions:

- Inbound: the plugin parses the outer envelope JSON, then passes `payload` to `session.handleMessage(...)`.
- Outbound: the OpenWS runtime provides `payload` to the plugin's transport callback.

If you are hand-rolling a client, you must JSON-encode your payload before placing it in the envelope.

---

## Role establishment and trust

The plugin calls `session.open(fromRole)` on each inbound message. `open(fromRole)` is expected to be idempotent; subsequent calls are cheap.

`fromRole` must be treated as untrusted input if your roles imply privileges (for example an admin/portal role). Authenticate and authorize the connection before allowing it to operate as a privileged role. The OpenWS runtime validates protocol correctness; it is not an authentication layer.

---

## Spec discovery for emitters and tooling

The plugin attaches the resolved network to the Fastify route options as:

- `openWsNetwork`

This allows companion tooling (for example a spec emitter plugin) to discover registered OpenWS networks from the Fastify instance without maintaining a separate registry.

---

## Related packages

- `@polytric/openws` - OpenWS framework (bindings, runtime, sessions)
- `@polytric/openws-spec` - specification builder and validation primitives
- `@polytric/fastify-openws-spec` - emit OpenWS documents from Fastify-registered networks
- `@polytric/openws-sdkgen` - generate SDKs from emitted OpenWS documents

---

## License

Apache-2.0
