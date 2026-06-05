# OpenWS Specification <!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/@polytric/openws-spec)](https://www.npmjs.com/package/@polytric/openws-spec)
[![license](https://img.shields.io/npm/l/@polytric/openws-spec)](https://github.com/polytric/openws/blob/main/LICENSE)

OpenWS is a specification for describing **WebSocket-based systems** in the same way OpenAPI describes HTTP APIs. It models WebSocket communication as an **asymmetrical 2-way request-response mesh**: multiple components exchange named messages, and "responses" are simply messages sent back through the same network.

An OpenWS document describes:

- **Networks**: logical WebSocket systems where `message`s are exchanged
- **Roles**: peer types with statically defined `message` contracts
- **Messages**: named `message` definitions that contain a `payload`
- **Payload**: the shape of application data transmitted through WebSocket messages, defined with JSON Schema
- **Metadata & connection hints**: document metadata (title, version, description) and optional connection hints (endpoints)

Conceptually (at runtime), we also use the following terms throughout this document:

- **Peers**: runtime instances/connections that assume a `role` on a `network`
- **Handlers**: runtime message-processing functions invoked when a peer receives a `message`

Peers and handlers are **not serialized** in the OpenWS JSON document. They are explanatory terms used to describe how role/message contracts are typically implemented.

This spec intentionally does **not** describe behavior or execution.

- [Conventions](#conventions)
- [Document Structure](#document-structure)
- [Ecosystem](#ecosystem)
- [Core Concepts](#core-concepts)
  - [Networks](#networks)
  - [Roles](#roles)
  - [Messages](#messages)
    - [Request/response modeling](#requestresponse-modeling)
  - [Payload](#payload)
  - [Metadata \& Connection Hints](#metadata--connection-hints)
    - [Document metadata](#document-metadata)
    - [Connection hints](#connection-hints)
    - [Custom metadata and extensions](#custom-metadata-and-extensions)
  - [Complete Example](#complete-example)

# Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in RFC 2119.

Unless otherwise noted:

- OpenWS documents are JSON objects.
- Examples are written as valid JSON (no comments, no trailing commas).
- `payload` schemas use **JSON Schema**. A specific JSON Schema dialect may be chosen by downstream tooling; OpenWS itself describes shapes rather than enforcing a single validator implementation.

> Note: The OpenWS document describes _contracts_. Runtime details such as routing, correlation, authentication, and connection lifecycle are intentionally left to runtime layers.

# Document Structure

An OpenWS document is a JSON object with the following top-level fields:

- `openws` (**REQUIRED**): the OpenWS specification version as a string.
- `title` (**OPTIONAL**): a human-readable name for the document.
- `version` (**OPTIONAL**): the version of the described system/API (not the OpenWS spec version).
- `description` (**OPTIONAL**): a longer explanation of the document.
- `networks` (**REQUIRED**): a map of network names to network definitions.

An implementation:

- **MUST** ignore unknown fields (to allow forward compatibility and extensions).
- **SHOULD** preserve unknown fields when round-tripping documents (when feasible).
- **MAY** support custom extension fields anywhere in the document (see [Metadata & Connection Hints](#metadata--connection-hints)).

Minimal skeleton:

```json
{
    "openws": "0.0.2",
    "title": "My WebSocket System",
    "version": "1.0.0",
    "description": "Optional, human-readable description.",
    "networks": {
        "example": {
            "roles": {
                "server": {
                    "messages": {}
                }
            }
        }
    }
}
```

# Ecosystem

OpenWS is designed as a **tooling ecosystem**, similar in spirit to OpenAPI: a spec, plus runtimes, adapters, generators, and framework integrations.

This repository/spec is intended to support a full "fleet" of packages, including (but not limited to):

- **Spec & validation**
    - [`@polytric/openws-spec`](https://www.npmjs.com/package/@polytric/openws-spec) - This library

- **Runtime framework**
    - [`@polytric/openws`](https://www.npmjs.com/package/@polytric/openws) - OpenWS framework for JavaScript/TypeScript
    - [`@polytric/fastify-openws`](https://www.npmjs.com/package/@polytric/fastify-openws) - Fastify WebSocket integration

- **UI & tooling**
    - [`@polytric/openws-ui`](https://www.npmjs.com/package/@polytric/openws-ui) - Swagger-like spec explorer
    - [`@polytric/fastify-openws-ui`](https://www.npmjs.com/package/@polytric/fastify-openws-ui) - Mount OpenWS UI in Fastify

- **SDK generation**
    - [`@polytric/openws-sdkgen`](https://www.npmjs.com/package/@polytric/openws-sdkgen) - CLI for generating typed SDKs

> The spec intentionally stays framework-agnostic; framework integrations and SDKs belong to the ecosystem layer.

# Core Concepts

## Networks

A network is a logical WebSocket system, with multiple peers on the network forming a mesh. It is common to run multiple isolated features over WebSocket on a single host. For example, a chess game client may have a chat room, a tournament entry, and the actual chess game. They are logically separated like this in the spec:

```json
{
    "networks": {
        "chat": {},
        "tournament": {},
        "chess": {}
    }
}
```

> [!NOTE]
> Examples in the core concepts sections have omitted details for brevity; they are not valid standalone.
> Consult the complete example towards the bottom of the doc for a fully working example.

On the backend side, there may be a dedicated service for each of these components, so each service would typically define just one network:

Chat service:

```json
{
    "networks": {
        "chat": {}
    }
}
```

Tournament service:

```json
{
    "networks": {
        "tournament": {}
    }
}
```

Chess service:

```json
{
    "networks": {
        "chess": {}
    }
}
```

A network definition:

- **MUST** define `roles`.
- **MAY** include metadata such as `description`.
- **MAY** include custom extension fields.

## Roles

In the OpenWS document, we define **roles**. At runtime, a **peer** is a connected instance that assumes a `role` on a `network`.

Multiple peers of the same role may exist on the same network. For example, in a chat service, a `server` is normally connected to many `client`s. OpenWS defers modeling one-to-one, one-to-many, or many-to-many relationships to the application/runtime.

```json
{
    "networks": {
        "chat": {
            "roles": {
                "server": {},
                "client": {}
            }
        }
    }
}
```

It is common for different components of a system to expose different peer handles and provide different behaviors. This is naturally modeled by peers on the same network having different roles. Continuing the chat example, imagine we now have a mobile client, a customer web portal, and an admin console. To serve both customer and admin needs, the server is split into two separate roles, while a single backend may implement both roles. Distinct roles can be set up like this:

```json
{
    "roles": {
        "adminServer": {},
        "customerServer": {},
        "mobile": {},
        "portal": {},
        "console": {}
    }
}
```

IMPORTANT: this is not a role-based access control system, but the clean role boundary is intended to make layering an auth system trivial.

A role definition:

- **MUST** define `messages` (it MAY be empty).
- **MAY** include metadata such as `description` or connection hints such as `endpoints`.
- **MAY** include custom extension fields.

## Messages

In the OpenWS document, roles declare the data shapes they accept as messages. Messages are indexed by name.

Message definitions are **scoped to the receiving role**. At runtime:

- A peer receives a message by name, and dispatches it to a handler.
- A peer sends a message by targeting another peer whose role defines that message name and payload shape.

OpenWS intentionally describes **contracts**, not delivery semantics. Routing (broadcast, directed, room-based, etc.) is runtime-specific.

For example, a chat server may accept `message`, `join`, `createRoom`, while the customer portal may accept `channelStats`. The meaning of messages differs depending on perspective: the chat server accepts `join` as an incoming message and handles it to update its state, while the portal can send `join` to the server. Similarly, the portal accepts `channelStats` as an incoming message, while the server can send `channelStats` to the portal.

```json
{
    "roles": {
        "server": {
            "messages": {
                "message": {},
                "join": {},
                "createRoom": {}
            }
        },
        "portal": {
            "messages": {
                "channelStats": {}
            }
        }
    }
}
```

A message definition:

- **MUST** define `payload`.
- **MAY** include metadata such as `description`.
- **MUST** be uniquely named within its role (message names under the same role **MUST NOT** collide).
- **MAY** include custom extension fields.

### Request/response modeling

OpenWS supports request/response patterns, but does not mandate a single correlation mechanism. If your system uses request/response semantics, runtimes **SHOULD** define a correlation convention (for example, an ID field inside the payload or an envelope-level correlation ID).

## Payload

Each message declares its payload shape using JSON Schema:

```json
{
    "message": {
        "payload": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2048
        }
    }
}
```

Payload schemas:

- **MUST** be valid JSON Schema objects (as interpreted by the runtime/tooling).
- **SHOULD** be compatible with your chosen JSON Schema dialect across toolchains.
- **MAY** use common JSON Schema keywords such as `type`, `properties`, `required`, `enum`, and `format`.

A role's handlers are the runtime functions that process incoming messages whose payloads match the message definitions in the spec.

## Metadata & Connection Hints

OpenWS includes a small set of **well-known metadata fields** for product-grade tooling, while still allowing custom metadata anywhere in the document.

### Document metadata

OpenWS supports a small set of well-known metadata fields at the root of the document:

- `title` (**SHOULD**): a human-readable name for the document.
- `version` (**SHOULD**): the version of the described system/API (not the OpenWS spec version).
- `description` (**MAY**): a longer explanation of the document.

Tooling **MAY** use these fields for documentation, generation, and display.

### Connection hints

Endpoints are **optional connection hints** that help peers determine how to establish connections. They do not prescribe deployment topology, discovery, authentication, or load-balancing.

An endpoint is typically attached to a role definition:

```json
{
    "networks": {
        "chat": {
            "roles": {
                "server": {
                    "endpoints": [
                        { "scheme": "wss", "host": "localhost", "port": 8082, "path": "/abc" }
                    ]
                }
            }
        }
    }
}
```

Endpoint objects:

- **MAY** include `scheme` (`ws` or `wss`), `host`, `port`, and `path`.
- **SHOULD** be treated as hints. Implementations **MAY** connect using other configuration (service discovery, environment variables, user choice, etc.).
- Dynamic endpoint resolution is outside the scope of this spec.

### Custom metadata and extensions

Custom metadata fields **MAY** be added anywhere in the JSON structure. Implementations:

- **MUST** ignore fields they do not understand.
- **SHOULD** encourage a consistent prefix such as `x-...` for extension fields to reduce the chance of collisions with future spec fields.

## Complete Example

The following example is a minimal but complete OpenWS document modeling a chat system. It uses:

- a single `chat` network
- three roles (`server`, `client`, `portal`)
- message contracts scoped to the receiving role
- connection hints via `endpoints`
- one extension field (`x-routingNotes`) to document intended flows

```<!-- embed:./test/chat-spec.json:scope:{ -->
{
    "openws": "0.0.2",
    "title": "Example Chat Service",
    "version": "1.0.0",
    "description": "A minimal OpenWS document modeling a chat network.",
    "networks": {
        "chat": {
            "description": "Realtime chat network.",
            "roles": {
                "server": {
                    "description": "Backend that hosts rooms and broadcasts messages.",
                    "endpoints": [
                        {
                            "scheme": "wss",
                            "host": "chat.example.com",
                            "port": 443,
                            "path": "/ws/chat"
                        }
                    ],
                    "messages": {
                        "join": {
                            "description": "Request to join a room.",
                            "payload": {
                                "type": "object",
                                "additionalProperties": false,
                                "required": ["userId", "roomId"],
                                "properties": {
                                    "userId": { "type": "string", "minLength": 1 },
                                    "roomId": { "type": "string", "minLength": 1 }
                                }
                            }
                        },
                        "message": {
                            "description": "Send a chat message to a room.",
                            "payload": {
                                "type": "object",
                                "additionalProperties": false,
                                "required": ["userId", "roomId", "text"],
                                "properties": {
                                    "userId": { "type": "string", "minLength": 1 },
                                    "roomId": { "type": "string", "minLength": 1 },
                                    "text": { "type": "string", "minLength": 1, "maxLength": 2048 }
                                }
                            }
                        },
                        "createRoom": {
                            "description": "Create a new room.",
                            "payload": {
                                "type": "object",
                                "additionalProperties": false,
                                "required": ["userId", "name"],
                                "properties": {
                                    "userId": { "type": "string", "minLength": 1 },
                                    "name": { "type": "string", "minLength": 1, "maxLength": 128 }
                                }
                            }
                        },
                        "requestStats": {
                            "description": "Request channel statistics.",
                            "payload": {
                                "type": "object",
                                "additionalProperties": false,
                                "required": ["roomId"],
                                "properties": {
                                    "roomId": { "type": "string", "minLength": 1 }
                                }
                            }
                        }
                    }
                },
                "client": {
                    "description": "End-user client that receives events from the server.",
                    "messages": {
                        "roomJoined": {
                            "description": "Emitted after a join succeeds.",
                            "payload": {
                                "type": "object",
                                "additionalProperties": false,
                                "required": ["roomId"],
                                "properties": {
                                    "roomId": { "type": "string", "minLength": 1 }
                                }
                            }
                        },
                        "messageReceived": {
                            "description": "Broadcast of a message to peers in a room.",
                            "payload": {
                                "type": "object",
                                "additionalProperties": false,
                                "required": ["roomId", "text", "senderId", "sentAt"],
                                "properties": {
                                    "roomId": { "type": "string", "minLength": 1 },
                                    "text": { "type": "string", "minLength": 1, "maxLength": 2048 },
                                    "senderId": { "type": "string", "minLength": 1 },
                                    "sentAt": { "type": "integer" }
                                }
                            }
                        }
                    }
                },
                "portal": {
                    "description": "Internal web portal that receives aggregated stats.",
                    "messages": {
                        "channelStats": {
                            "description": "Room-level metrics snapshot.",
                            "payload": {
                                "type": "object",
                                "additionalProperties": false,
                                "required": ["roomId", "members", "messagesLastMinute"],
                                "properties": {
                                    "roomId": { "type": "string", "minLength": 1 },
                                    "members": { "type": "integer", "minimum": 0 },
                                    "messagesLastMinute": { "type": "integer", "minimum": 0 }
                                }
                            }
                        }
                    }
                }
            },
            "x-routingNotes": "Clients send server.join/server.message. Server emits client.roomJoined/client.messageReceived and portal.channelStats."
        }
    }
}
```
