using System;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Polytric.OpenWs.Core;
using Example.Chat.Core.Models.Client;

namespace Example.Chat.Core.Roles
{
    public partial class Client : HostRole
    {
        public string Name => "client";
        public string Description => "";

        public override void HandleOpen(RemoteRole remoteRole)
        {

            if (remoteRole is Server server)
            {
                HandleOpen(server);
            }
        }

        partial void HandleOpen(Server server);

        public override void HandleMessage(string messageName, JToken payload, RemoteRole remoteRole)
        {
            switch (messageName)
            {

                case "joinedRoom":
                    {
                        var message = payload.ToObject<JoinedRoomPayload>();
                        HandleJoinedRoom(payload);
                        HandleJoinedRoom(message);
                        OnJoinedRoom?.Invoke(message);


                        HandleJoinedRoom(payload, remoteRole as Server);
                        HandleMessage(message, remoteRole as Server);
                        OnJoinedRoomFromServer?.Invoke(message, remoteRole as Server);

                        break;
                    }

                case "receivedMessage":
                    {
                        var message = payload.ToObject<ReceivedMessagePayload>();
                        HandleReceivedMessage(payload);
                        HandleReceivedMessage(message);
                        OnReceivedMessage?.Invoke(message);


                        HandleReceivedMessage(payload, remoteRole as Server);
                        HandleMessage(message, remoteRole as Server);
                        OnReceivedMessageFromServer?.Invoke(message, remoteRole as Server);

                        break;
                    }
            }
        }

        public event Action<JoinedRoomPayload> OnJoinedRoom;
        partial void HandleJoinedRoom(JToken payload);
        partial void HandleJoinedRoom(JoinedRoomPayload payload);

        public event Action<JoinedRoomPayload, Server> OnJoinedRoomFromServer;
        partial void HandleJoinedRoom(JToken payload, Server server);
        partial void HandleMessage(JoinedRoomPayload payload, Server server);
        
        public event Action<ReceivedMessagePayload> OnReceivedMessage;
        partial void HandleReceivedMessage(JToken payload);
        partial void HandleReceivedMessage(ReceivedMessagePayload payload);

        public event Action<ReceivedMessagePayload, Server> OnReceivedMessageFromServer;
        partial void HandleReceivedMessage(JToken payload, Server server);
        partial void HandleMessage(ReceivedMessagePayload payload, Server server);
        
    }
}
