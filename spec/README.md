# OpenWS Specification <!-- omit in toc -->

OpenWS is a specification for describing `WebSocket-based systems` in the same way OpenAPI describes HTTP APIs.

An OpenWS document describes:

- Networks
- Participants (w/ named roles)
- Handlers (message names)
- Payload schemas
- Endpoints

It _does not_ describe behavior or execution.

- [Core Concepts](#core-concepts)
  - [Network](#network)
  - [Participants](#participants)
  - [Endpoints](#endpoints)
  - [Handlers](#handlers)
  - [Payloads](#payloads)
- [What the Spec Does NOT Do](#what-the-spec-does-not-do)
- [Intended Use Cases](#intended-use-cases)
- [Summary](#summary)


# Core Concepts

## Network

A network is a logical WebSocket system, and a single server may define multiple networks.

```json
"networks": {
  "chat": { ... },
  "chessGame": { ... },
  "ticketing": { ... },
}
```

## Participants

Participants take on roles in a network.

```json
"participants": {
  "server": { ... },
  "webapp": { ... },
  "mobile": { ... },
  "admin": { ... }
}
```

- A participant's role may represent a server, client, tool, or service
- Multiple instances of a participant may exist at runtime
- Participants are purely declarative

## Endpoints

Participants in a network typically have some that sits there and listens to incoming connections requests, and the rest proactively request to connect to the aforementioned participants. The listening participants may optionally provide one or more endpoints statically, to help clients determine how to connect.

```json
"endpoints": [
  { "host": "localhost", "url": "/abc", "port": 8082 }
]
```

## Handlers

A handler is a named message type.

```json
"message": {
  "payload": { ... },
  "description": { ... }
}
```

Handlers:

- Are invokable by other participants
- Define payload shape only
- Do not define behavior

## Payloads

Payloads are defined using `JSON Schema`.

```json
"payload": {
  "type": "string"
}
```

Implementations must:

- Validate payloads
- Encode/decode according to content type

# What the Spec Does NOT Do

The OpenWS spec intentionally does not define:

- Message handling logic
- Connection state
- Lifecycle hooks
- Transport implementation details

Those belong to runtime layers.

# Intended Use Cases

- Runtime enforcement
- SDK / client generation
- Documentation
- Cross-language interoperability
- Static analysis

# Summary

If OpenWS were HTTP:

- This package is OpenAPI
- Not Express
- Not Fastify
- Not application code
