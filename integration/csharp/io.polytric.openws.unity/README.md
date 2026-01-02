# Polytric OpenWS Unity

`io.polytric.openws.unity` is the Unity transport layer for OpenWS. It provides a NativeWebSocket-backed session implementation, lifecycle helpers, and an editor window to generate OpenWS specs from annotated C# types.

Key features:

- `NativeWebSocketSession` transport for WebSocket connections
- `OpenWsRunner` MonoBehaviour to dispatch socket message queues
- Unity editor window for spec generation

---

## Install

Add the package to your Unity `Packages/manifest.json` (via your UPM registry or Git source):

```json
{
    "dependencies": {
        "io.polytric.openws.core": "0.0.1",
        "io.polytric.openws.spec": "0.0.1",
        "io.polytric.openws.unity": "0.0.1"
    }
}
```

This package expects `NativeWebSocket` to be available in your Unity project.

---

## Quick start

Wire the Unity session factory into the core runtime:

```csharp
using Polytric.OpenWs.Core;
using Polytric.OpenWs.Spec.Serialization;
using Polytric.OpenWs.Spec.Serialization.Serializer;
using Polytric.OpenWs.Unity;

public class UnitySessionFactory : ISessionFactory
{
    public ISession CreateSession(Endpoint endpoint)
    {
        return new NativeWebSocketSession();
    }
}

var runtime = new Runtime(
    network: new ChatNetwork(),
    serializer: new NewtonSoftSerializer(),
    sessionFactory: new UnitySessionFactory()
);

await runtime.ConnectAsync<ClientRole>(new Endpoint
{
    Scheme = "ws",
    Host = "localhost",
    Port = 8080,
    Path = "/chat"
});
```

`OpenWsRunner` is automatically created on load and keeps WebSocket message queues pumping during `Update`.

---

## Spec generator window

Open **Window → OpenWS → Spec Gator** to generate an OpenWS JSON document from your annotated network and role classes.

---

## License

Apache-2.0
