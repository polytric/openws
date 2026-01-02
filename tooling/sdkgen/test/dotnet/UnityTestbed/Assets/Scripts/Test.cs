using UnityEngine;
using Polytric.OpenWs.Core;
using Polytric.OpenWs.Spec.Serialization;
using Polytric.OpenWs.Spec.Serialization.Serializer;
using Polytric.OpenWs.Unity;
using Example.Chat.Core;
using Example.Chat.Core.Roles;
using Example.Chat.Core.Models.Server;
using Example.Chat.Core.Models.Client;

class Test : MonoBehaviour, ISessionFactory
{
    private Runtime _runtime;
    private Client _client;
    private Server _server;
    async void Start()
    {
        Debug.Log("Test started");
        _runtime = new Runtime(new CoreNetwork(), new NewtonSoftSerializer(), this);
        _client = _runtime.GetHostRole<Client>();
        Debug.Log("Connecting...");
        _server = await _runtime.ConnectAsync<Server>(new Endpoint { Host = "localhost", Port = 8082, Path = "/chat" });
        Debug.Log("Connected!");
    }

    public ISession CreateSession(Endpoint endpoint)
    {
        return new NativeWebSocketSession();
    }
}