# fastify-openws-ui

**`@polytric/fastify-openws-ui`** integrates **OpenWS UI** into a **Fastify** server.

It:

- serves the OpenWS UI web app under a configurable prefix (default: `/openws/`)
- exposes your generated OpenWS spec JSON (default: `/openws/spec.json`)
- automatically collects OpenWS networks from your Fastify routes (via an `onRoute` hook)
- injects runtime config into the UI entry HTML so the UI knows:
    - where the spec is (`specUrl`)
    - which roles are "host" roles per network (`networkHosts`), used for connect presets

---

## Install

```bash
npm i @polytric/fastify-openws-ui
```

You will typically also use this alongside:

```bash
npm i @polytric/fastify-openws @polytric/openws @polytric/openws-spec @fastify/static
```

> This plugin will register the OpenWS Fastify plugin automatically if it's not already present on the Fastify instance.

---

## Quick start

```ts
import Fastify from 'fastify'
import openwsUi from '@polytric/fastify-openws-ui'

const app = Fastify()

await app.register(openwsUi, {
    name: 'My Service',
    prefix: '/openws', // optional (default: "/openws")
    exportPath: '/spec.json', // optional (default: "/spec.json")
})

// Define your OpenWS-enabled routes here…

await app.listen({ port: 8080 })

// UI:   http://localhost:8080/openws/
// Spec: http://localhost:8080/openws/spec.json
```

---

## How it discovers networks

This plugin watches routes as they are registered:

- If a route has an attached `openWsNetwork` (a `Network` from `@polytric/openws-spec/builder`),
  it will:
    - add that network to the generated spec
    - record "host roles" (roles where `role.isHost === true`) into `networkHosts[network.name]`

This enables OpenWS UI to show:

- network selection (if multiple)
- role/message navigation
- connect presets for host roles

---

## Expected route shape (conceptual)

The plugin looks for an `openWsNetwork` field on route options at registration time:

```ts
import type { Network } from "@polytric/openws-spec/builder";

const myNetwork: Network = /* build your network via openws/openws-spec tooling */;

app.get("/chat", {
  // your OpenWS route config/handler…
  openWsNetwork: myNetwork,
}, async (_req, reply) => {
  reply.send("ok");
});
```

> The exact way you attach networks depends on `@polytric/fastify-openws` / your OpenWS route setup. The important part for UI/spec export is that `openWsNetwork` is present in the route options when the route is registered.

---

## Plugin options

```ts
interface PluginOptions {
    prefix: string // where to mount the UI + spec endpoints (default "/openws")
    exportPath: string // spec JSON path relative to prefix (default "/spec.json")
    name: string // spec name, used when creating the OpenWS spec
}
```

Defaults (as implemented):

- `prefix`: `/openws`
- `exportPath`: `/spec.json`

---

## Routes added

Assuming defaults:

- `GET /openws/spec.json`  
  Returns the generated OpenWS spec JSON.

- `GET /openws`  
  Redirects to `/openws/` (trailing slash).

- `GET /openws/`  
  Serves `index.html` with injected runtime config:

    ```json
    {
        "specUrl": "/openws/spec.json",
        "networkHosts": {
            "Chat": ["Server"]
        }
    }
    ```

- Static assets served under:  
  `GET /openws/*` (from `openwsUiRoot` via `@fastify/static`)

---

## Runtime validation (development)

When `NODE_ENV === "development"`, the exported spec is validated using:

- `validate()` from `@polytric/openws-spec`

If validation fails, it logs `spec is invalid` and throws.

---

## Decorators

This plugin decorates the Fastify instance with:

```ts
fastify.openwsUi.getSpec(): JsonObject
```

That allows you to programmatically retrieve the spec (for tests, CI export, etc.).

---

## Example: Export the spec at startup

```ts
import fs from 'node:fs'

app.ready(() => {
    const spec = app.openwsUi.getSpec?.()
    if (spec) fs.writeFileSync('./openws-spec.json', JSON.stringify(spec, null, 2))
})
```

---

## License

Licensed under the **Apache License 2.0**. See `LICENSE.md`.
