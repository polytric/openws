# Polytric OpenWS Spec

[![npm](https://img.shields.io/npm/v/io.polytric.openws.spec)](https://www.npmjs.com/package/io.polytric.openws.spec)
[![license](https://img.shields.io/npm/l/io.polytric.openws.spec)](https://github.com/polytric/openws/blob/main/LICENSE)

`io.polytric.openws.spec` provides OpenWS specification tooling for C# and Unity. It includes attributes for describing networks/roles, serialization models, and generators for emitting OpenWS JSON.

Core capabilities:

- Attribute-based protocol declarations (`[Network]`, `[Role]`, `[Message]`, `[Handler]`)
- Serialization models for OpenWS documents and envelopes
- Reflection-based spec generation utilities for Unity and .NET

---

## Install

Add the package to your Unity `Packages/manifest.json` (via your UPM registry or Git source):

```json
{
    "dependencies": {
        "io.polytric.openws.spec": "0.0.1"
    }
}
```

---

## Authoring a spec

Annotate your network, roles, and messages:

```csharp
using Polytric.OpenWs.Spec.Attributes;

[Network("chat", description: "Chat example", version: "1.0.0", roles: new[] { typeof(ServerRole) })]
public class ChatNetwork
{
}

[Role("server")]
[Endpoint("ws", "localhost", 8080, "/chat")]
public class ServerRole
{
    [Handler("ping")]
    public void OnPing()
    {
    }
}
```

Generate an OpenWS JSON document using the reflection generator:

```csharp
using Polytric.OpenWs.Spec.Generation;

var spec = UnityOpenWsSpecGenerator.Generate(
    typeof(ChatNetwork).Assembly,
    new OpenWsSpecGeneratorOptions
    {
        NetworkBaseType = typeof(ChatNetwork),
        RoleBaseType = typeof(ServerRole),
        Openws = "0.0.1",
        Name = "chat"
    }
);
```

---

## Related packages

- [`io.polytric.openws.core`](https://www.npmjs.com/package/io.polytric.openws.core) - OpenWS runtime (roles, sessions, envelopes)
- [`io.polytric.openws.unity`](https://www.npmjs.com/package/io.polytric.openws.unity) - Unity transport and editor tooling

---

## License

Apache-2.0
