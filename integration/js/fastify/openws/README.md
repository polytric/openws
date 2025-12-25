# OpenWS Fastify Plugin

OpenWS Fastify plugin provides a higher level abstraction for asymmetrical realtime mesh networks, by implementing the **OpenWS Specification**. OpenWS (the spec) is intentionally explicit and portable: it describes networks, roles, messages, payload shapes, and metadata. In JavaScript, you don’t need compile-time types or code generation to start getting value from that model. You can hand-roll clients, validate payloads at runtime, and keep your system spec-aligned. This plugin is part of an ecosystem that exists to streamline developing an end-to-end WS stack.

Instead of reconstructing the full OpenWS document shape inside application code, you define a compact **network definition** (roles → messages → payload schema) and the runtime provides the glue: per-connection state, role-based dispatch, and generated send helpers.

If you want a more structured, higher-level API with stronger ergonomics (including IntelliSense and more codegen-friendly surfaces), see `@polytric/ws`. If you want to emit a canonical OpenWS document from your Fastify runtime definitions (to feed into SDK generation), see `@polytric/fastify-openws-spec` (spec emitter) and `@polytric/openws-sdkgen` (codegen).

## Install

```bash
pnpm add @polytric/fastify-openws
```

This plugin will register `@fastify/websocket` automatically if it is not already registered.

## Network definition (DSL)

A naive WebSocket server starts simple and then becomes a pile of glue code: define an envelope, parse JSON, validate payloads, route to handlers, and hand-roll `send(...)` logic everywhere. None of that is your application logic, but almost every project ends up rebuilding it.

OpenWS already tells us what we actually want to declare: roles, messages, and payload shapes. `@polytric/fastify-openws` lets you express that information in a code-first way without having to manually build the full OpenWS document object.

You register one WebSocket endpoint (one “network”) by calling `app.openws(...)` with:

- `path`: the WebSocket route
- `hostRole`: the role of the current host (which inbound messages it accepts)
- `network`: a spec-aligned network definition built using the `WS` fluent builder from `@polytric/openws-spec`

This mirrors what you would see in an OpenWS document under:

`networks.<name>.roles.<role>.messages.<message>.payload`

…just without forcing you to hand-write the full JSON structure.

### Example: chat network

Imagine you are building a chat application. Clients can create rooms, join rooms, and send messages. In OpenWS terms you might have:

- a `server` role that receives `createRoom`, `joinRoom`, `sendMessage`, `requestStats`
- a `client` role that receives `roomJoined`, `messageReceived`
- a `portal` role that receives `channelStats` (monitoring / request-reply style flows)

You can define these contracts like this:

```js
const fastify = require('fastify')
const S = require('@pocketgems/schema')
const { WS } = require('@polytric/openws-spec')

const openws = require('@polytric/fastify-openws')
const app = fastify({ logger: true })

const serverRole = WS.role('server')
  .message(
    WS.message('createRoom')
      .payload(S.obj({ userId: S.str, name: S.str }))
      .desc('A room creation request')
  )
  .message(
    WS.message('joinRoom')
      .payload(S.obj({ userId: S.str, roomId: S.str }))
      .desc('Join an existing room')
  )
  .message(
    WS.message('sendMessage')
      .payload(S.obj({ userId: S.str, roomId: S.str, text: S.str }))
      .desc('Send a message to a room')
  )
  .message(
    WS.message('requestStats')
      .payload(S.obj({ roomId: S.str }))
      .desc('Request channel statistics')
  )

const clientRole = WS.role('client')
  .message(
    WS.message('roomJoined')
      .payload(S.obj({ roomId: S.str }))
      .desc('Emitted after a join succeeds')
  )
  .message(
    WS.message('messageReceived')
      .payload(S.obj({ roomId: S.str, text: S.str, senderId: S.str, sentAt: S.int }))
      .desc('Broadcast of a message to participants in a room')
  )

const portalRole = WS.role('portal')
  .message(
    WS.message('channelStats')
      .payload(S.obj({ roomId: S.str, members: S.int, messagesLastMinute: S.int }))
      .desc('Room-level metrics snapshot')
  )

const network = WS.network('chat')
  .role(serverRole)
  .role(clientRole)
  .role(portalRole)
  .desc('A chat network')
```

And register it:

```js
await app.register(openws)

app.openws(
  {
    path: '/chat',
    name: 'chat',        // optional: useful for tooling/spec emission
    hostRole: 'server',  // MUST match a role name in network.roles
    network,             // WS.network(...) builder
  },
  getState
)

await app.listen({ port: 8082, host: '0.0.0.0' })
```

A few important implications fall out of this shape:

First, `network.roles[hostRole]` (here, `server`) is what the host accepts and validates on inbound messages. If it isn’t declared there, it isn’t part of the server’s incoming contract.

Second, the non-host roles (here, `client` and `portal`) describe what those roles can receive. That means the host can safely generate send helpers for those messages, because they are declared contracts.

Finally, the runtime does not require a specific schema authoring library. Internally it compiles validators from each `message.payload` by calling `.valueOf()` to obtain a JSON Schema object. This works with `@pocketgems/schema`, `fluent-schema`, or your own schema objects, as long as they can produce JSON Schema from `.valueOf()`.

The first two points enable procedurally generating SDKs for other roles in any programming language for asymmetrical communications.

## State

Once the network is established, the next thing you run into is state. WebSockets are stateful by default, and a “real” feature like chat is really a state problem: you need to know who is connected, which room they’re in, and who to broadcast to.

In the `test/` chat server, the first concrete problem is room-based broadcast. When user A sends a message to a room, the server needs to forward it to everyone else in that room, while avoiding loopback back to A.

The runtime gives you a natural place to put both kinds of state you need. Global state lives outside `getState(connCtx)` in normal JavaScript variables. Per-connection state lives in the `connCtx` object created for each connection.

Start by keeping two small registries outside `getState(connCtx)`:

```js
const userConnections = {} // userId -> connection context
const rooms = {}           // roomId -> { members: [...] }
```

When a client identifies itself (for example, when it creates or joins a room), bind that user id to the connection context:

```js
onClientJoinRoom: async ({ userId, roomId }) => {
  userConnections[userId] = connCtx
  connCtx.userId = userId
  // ...
}
```

Then keep room membership in global state:

```js
const room = rooms[roomId]
if (!room) return
if (!room.members.includes(userId)) room.members.push(userId)
```

With those two pieces in place, broadcasting becomes straightforward. Iterate the members, skip the sender to avoid loopback, and send to each recipient’s `connCtx`:

```js
for (const memberId of room.members) {
  if (memberId === userId) continue // avoid loopback
  const memberCtx = userConnections[memberId]
  if (memberCtx) {
    await memberCtx.sendClientMessageReceived({ roomId, text, senderId: userId, sentAt: Date.now() })
  }
}
```

Finally, because `getState(connCtx)` is per connection, cleanup is naturally scoped too:

```js
onClose: () => {
  if (connCtx.userId) delete userConnections[connCtx.userId]
}
```

This pattern scales naturally: room state, subscriptions, and timers all fit into the same “global registry + per-connection ctx” model.

## Role based dispatch

Without an abstraction, most WebSocket servers evolve into a generic message handler with a big router (`switch(messageName)`) plus repeated role checks. That structure is hard to read, hard to review, and easy to get wrong.

This runtime replaces the router with one convention: **role based dispatch**.

Inbound messages carry the sender role (`fromRole`) and a message name (`messageName`). The runtime uses those two strings to find a handler on your returned state object by name:

```txt
on{FromRole}{MessageName}
```

So if a `client` sends `createRoom`, the runtime looks for `onClientCreateRoom`. If a `portal` sends `requestStats`, the runtime looks for `onPortalRequestStats`.

A subtle but powerful consequence of this convention is that the caller’s role is *already encoded in the handler boundary*. By the time your code is inside `onClientCreateRoom`, you don’t need to inspect the envelope or branch on `fromRole`—the role is implicit in the function you are currently executing. The control flow reads like a normal request handler: the intent is obvious at a glance, and you can reason about behavior without repeatedly “figuring out who called this”.

This is also an implicit capability boundary. If you do not implement a callback, that call path effectively does not exist. If `requestStats` is intended only for the `portal` role, you implement `onPortalRequestStats` and you simply do not implement `onClientRequestStats`. A client can still try to send the message, but there is no matching handler, so the library rejects it and you can treat it as an error or abuse.

This is not an authentication system, but it is an effective way to keep role surfaces clean and keep your server code aligned with OpenWS role/message contracts.

## Send APIs

After dispatch, the next source of repeated glue code is sending. In a naive implementation, every handler ends up rebuilding envelopes, serializing payloads, and duplicating validation logic. That is pure overhead.

This library turns your network definition into generated send functions attached to each connection’s `context`. The definition declares what each role can receive; from that, the server can derive what it is allowed to send to that role.

In the chat demo, when a room is created or joined, the server doesn’t assemble envelopes. It just calls a generated helper:

```js
await connCtx.sendClientRoomJoined({ roomId: room.id })
```

The biggest day-to-day payoff shows up when broadcasting. Instead of scattering raw `send(...)` calls throughout your codebase, you iterate room members, fetch each member’s connection context from your global registry, and call the generated send helper:

```js
for (const member of room.members) {
  const memberCtx = userConnections[member]
  if (!memberCtx || member === userId) continue

  await memberCtx.sendClientMessageReceived({
    roomId,
    text,
    senderId: userId,
    sentAt: Date.now(),
  })
}
```

Because these helpers are derived from the network definition, you get two important properties “for free”: you can’t accidentally send messages that aren’t part of the declared contract, and payloads are validated before being sent.

The same mechanism makes role extensions feel natural. In the demo, the portal requests stats and the server pushes periodic updates. The send path is just application logic plus a helper call:

```js
setInterval(async () => {
  await connCtx.sendPortalChannelStats({
    roomId,
    members: room.members.length,
    messagesLastMinute: room.messages.length,
  })
}, 1000)
```

Under the hood, the runtime enumerates the network definition at registration time and attaches a send surface onto each connection’s `connCtx`. The point isn’t that this is complex; it’s that you shouldn’t have to rebuild it for every project.

## Wire format

OpenWS the specification defines contracts and payload shapes, but it does not mandate a single on-the-wire encoding. This runtime uses a small JSON envelope so you can hand-roll clients easily (as shown in `test/client-a.js`, `test/client-b.js`, and `test/portal.js`) while keeping validation and dispatch deterministic.

In short, the envelope carries `fromRole`, `messageName`, and a JSON-encoded payload string. This is a Polytric implementation detail; it exists to make the runtime and the hand-rolled demo clients simple.

## Related packages

OpenWS is an ecosystem in the same spirit as OpenAPI: the spec is the stable interchange format, and runtimes and tooling exist around it.

If you want the canonical OpenWS document format and validation tooling, start with `@polytric/openws-spec`.

If you want to emit OpenWS documents from your Fastify runtime definitions (so you can attach richer metadata like `title` / `version` / `description`, role and message descriptions, endpoints, and custom extension fields), use `@polytric/fastify-openws-spec`.

If you want SDK generation workflows, OpenWS codegen tools such as `@polytric/openws-sdkgen` consume emitted OpenWS documents and generate clients for other languages and environments.

If you want a more structured, higher-level runtime foundation (more robust APIs, stronger editor ergonomics like IntelliSense, and a more codegen-friendly programming model), start with `@polytric/ws`.

## License

Apache-2.0
