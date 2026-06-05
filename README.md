# OpenWS

**OpenWS** is an **OpenAPI-style specification + toolkit** for **asymmetric, bidirectional messaging**, primarily over **WebSockets**, across an interconnected mesh of peers (“roles”).

Where OpenAPI documents request/response REST endpoints, **OpenWS documents roles and the messages they can exchange**, then uses that contract to power:

- portable specs (`spec.json`)
- runtime libraries (TypeScript + C#/Unity today)
- code generation (typed clients/servers)
- a Swagger-like UI for exploration and payload inspection

> **Status:** Early development (`0.0.x`). Expect breaking changes while the spec, runtime APIs, and generators stabilize.

---

## What’s included

- **Portable JSON spec** — a `spec.json` contract describing **networks**, **roles**, **endpoints**, and **messages**
- **Runtime libraries** — implementations across **TypeScript** and **C#/Unity** (with more planned)
- **Spec emission** — author specs from scratch, or **emit specs from code** (e.g., C# attributes/reflection)
- **SDK generation** — generate **typed clients/servers** from `spec.json`
- **Swagger-like UI** — explore specs, validate payloads, inspect messages, and prototype payloads

---

## Core concepts

An OpenWS **network** defines the communication contract:

| Concept       | Description                                                      |
| ------------- | ---------------------------------------------------------------- |
| **Network**   | Name, version, and description of the contract                   |
| **Roles**     | Peer types in the network (e.g., `client`, `server`, `portal`)    |
| **Endpoints** | How host roles are reached (`scheme://host:port/path`)           |
| **Messages**  | Named message types with directionality and JSON schemas         |

Specification details live in the [`spec`](https://github.com/polytric/openws/tree/main/spec) project.

### Authoring options

You can author contracts via:

- **Direct JSON** (`spec.json`)
- **Fluent API** (TypeScript) in [`@polytric/openws-spec`](https://github.com/polytric/openws/tree/main/spec)
- **Runtime definitions** (TS/JS/C#…) in:
    - [`@polytric/openws`](https://github.com/polytric/openws/tree/main/integration/js/openws)
    - [`io.polytric.openws.core`](https://github.com/polytric/openws/tree/main/integration/csharp/io.polytric.openws.core)

The resulting `spec.json` powers runtime validation, SDK generation, and UI rendering.

---

## How it fits together

```
1) Author / emit spec    -> spec.json
2) Generate SDKs         -> typed TS / C# bindings
3) Integrate runtime     -> plug into app/framework
4) Explore & validate    -> OpenWS UI for inspection
```

---

## Packages

### TypeScript / JavaScript

| Package                                                                                                        | Description                                    | npm                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [`@polytric/openws-spec`](https://github.com/polytric/openws/tree/main/spec)                                   | Spec model, validation, and builder utilities  | [![npm](https://img.shields.io/npm/v/@polytric/openws-spec)](https://www.npmjs.com/package/@polytric/openws-spec)             |
| [`@polytric/openws`](https://github.com/polytric/openws/tree/main/integration/js/openws)                       | Runtime and fluent authoring API               | [![npm](https://img.shields.io/npm/v/@polytric/openws)](https://www.npmjs.com/package/@polytric/openws)                       |
| [`@polytric/openws-ui`](https://github.com/polytric/openws/tree/main/integration/js/openws-ui)                 | Swagger-like spec renderer + payload inspector | [![npm](https://img.shields.io/npm/v/@polytric/openws-ui)](https://www.npmjs.com/package/@polytric/openws-ui)                 |
| [`@polytric/fastify-openws`](https://github.com/polytric/openws/tree/main/integration/js/fastify-openws)       | Fastify WebSocket integration                  | [![npm](https://img.shields.io/npm/v/@polytric/fastify-openws)](https://www.npmjs.com/package/@polytric/fastify-openws)       |
| [`@polytric/fastify-openws-ui`](https://github.com/polytric/openws/tree/main/integration/js/fastify-openws-ui) | Mount OpenWS UI in Fastify                     | [![npm](https://img.shields.io/npm/v/@polytric/fastify-openws-ui)](https://www.npmjs.com/package/@polytric/fastify-openws-ui) |

### C# / Unity

| Package                                                                                                                | Description                                            | npm (UPM)                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [`io.polytric.openws.spec`](https://github.com/polytric/openws/tree/main/integration/csharp/io.polytric.openws.spec)   | Attributes, DTOs, serialization, and schema generation | [![npm](https://img.shields.io/npm/v/io.polytric.openws.spec)](https://www.npmjs.com/package/io.polytric.openws.spec)   |
| [`io.polytric.openws.core`](https://github.com/polytric/openws/tree/main/integration/csharp/io.polytric.openws.core)   | Platform-agnostic runtime (roles, dispatch, envelope)  | [![npm](https://img.shields.io/npm/v/io.polytric.openws.core)](https://www.npmjs.com/package/io.polytric.openws.core)   |
| [`io.polytric.openws.unity`](https://github.com/polytric/openws/tree/main/integration/csharp/io.polytric.openws.unity) | Unity binding (NativeWebSocket + editor tooling)       | [![npm](https://img.shields.io/npm/v/io.polytric.openws.unity)](https://www.npmjs.com/package/io.polytric.openws.unity) |

**Architecture pattern (C#):**

- **HostRole** — what the local process implements (receives messages)
- **RemoteRole** — typed proxy to remote peers (sends messages)
- **Runtime** — orchestrates sessions, dispatch, and role instances

### SDK Generator

| Package                                                                                  | Description                                    | npm                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`@polytric/openws-sdkgen`](https://github.com/polytric/openws/tree/main/tooling/sdkgen) | CLI for generating typed SDKs from `spec.json` | [![npm](https://img.shields.io/npm/v/@polytric/openws-sdkgen)](https://www.npmjs.com/package/@polytric/openws-sdkgen) |

---

## Quick start (monorepo)

### Prerequisites

- Node.js **18+**
- pnpm
- .NET SDK (for C# packages)
- Unity **2022.3+** (for Unity integration)

### Install

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Run tests

```bash
pnpm test
```

> Tip: For focused iteration, filter to a package:
>
> ```bash
> pnpm -F @polytric/openws-ui dev
> pnpm -F @polytric/openws-spec test
> ```

---

## Repository structure

```
openws/
  spec/                     # @polytric/openws-spec
  integration/
    js/
      openws/               # @polytric/openws
      openws-ui/            # @polytric/openws-ui
      fastify-openws/       # @polytric/fastify-openws
      fastify-openws-ui/    # @polytric/fastify-openws-ui
    csharp/
      io.polytric.openws.core/
      io.polytric.openws.spec/
      io.polytric.openws.unity/
  tooling/
    sdkgen/                 # @polytric/openws-sdkgen
```

---

## Versioning & stability

OpenWS is currently in **pre-1.0** development. During `0.0.x`, breaking changes may occur as:

- the spec format and validation rules evolve
- SDK generator output stabilizes
- runtime ergonomics improve

If you need stronger stability guarantees, pin exact package versions.

---

## License

Apache-2.0
