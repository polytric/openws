# Polytric OpenWS Core

`io.polytric.openws.core` is the C# runtime for OpenWS sessions and roles. It provides the core abstractions used by OpenWS host/remote role implementations.

Core responsibilities:

- Define the `Runtime` orchestration for OpenWS sessions
- Provide `HostRole` and `RemoteRole` base classes
- Describe envelope and session interfaces shared by transports

---

## Install

Add the package to your Unity `Packages/manifest.json` (via your UPM registry or Git source):

```json
{
    "dependencies": {
        "io.polytric.openws.core": "0.0.1",
        "io.polytric.openws.spec": "0.0.1"
    }
}
```

---

## Usage

Create a runtime with a serializer and a session factory (transport-specific):

```csharp
using Polytric.OpenWs.Core;
using Polytric.OpenWs.Spec.Serialization;
using Polytric.OpenWs.Spec.Serialization.Serializer;

public class ChatNetwork : Network
{
    public ChatNetwork()
    {
        Name = "chat";
        Description = "Chat example";
        Version = "1.0.0";
        Roles = new[] { typeof(ServerRole) };
    }
}

public class ServerRole : HostRole
{
    public ServerRole()
    {
        Name = "server";
    }

    public override async Task HandleMessageAsync(string messageName, JToken payload, RemoteRole remote)
    {
        if (messageName == "ping")
        {
            await remote.SendMessageAsync("server", "pong", new { ok = true });
        }
    }
}

var network = new ChatNetwork();
var serializer = new NewtonSoftSerializer();
var sessionFactory = new MySessionFactory();

var runtime = new Runtime(network, serializer, sessionFactory);
var remote = await runtime.ConnectAsync<ClientRole>(new Endpoint
{
    Scheme = "ws",
    Host = "localhost",
    Port = 8080,
    Path = "/chat"
});
```

---

## Related packages

- `io.polytric.openws.spec` - OpenWS attributes, serialization, and spec generators
- `io.polytric.openws.unity` - Unity transport and editor tooling

---

## License

Apache-2.0
