using Polytric.OpenWs.Core;
using Polytric.OpenWs.Spec.Serialization;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

using Example.Chat.Core.Models.Server;


namespace Example.Chat.Core.Roles
{
    public partial class Server : RemoteRole
    {
        public override string Name { get; set; } = "server";
        public override string Description { get; set; } = "";
        public static IReadOnlyList<Endpoint> Endpoints => new List<Endpoint>
        {
            new Endpoint { Scheme = "ws", Host = "localhost", Port = 8082, Path = "/chat" },
        };

        public async Task CreateRoomAsync(string fromRole, CreateRoomPayload message)
        {
            await InternalSendMessageAsync(fromRole, "createRoom", message).ConfigureAwait(false);
        }

        public void CreateRoom(string fromRole, CreateRoomPayload message)
        {
            InternalQueueMessage(fromRole, "createRoom", message);
        }

        public async Task JoinRoomAsync(string fromRole, JoinRoomPayload message)
        {
            await InternalSendMessageAsync(fromRole, "joinRoom", message).ConfigureAwait(false);
        }

        public void JoinRoom(string fromRole, JoinRoomPayload message)
        {
            InternalQueueMessage(fromRole, "joinRoom", message);
        }

        public async Task SendMessageAsync(string fromRole, SendMessagePayload message)
        {
            await InternalSendMessageAsync(fromRole, "sendMessage", message).ConfigureAwait(false);
        }

        public void SendMessage(string fromRole, SendMessagePayload message)
        {
            InternalQueueMessage(fromRole, "sendMessage", message);
        }

        public async Task RequestRoomStatsAsync(string fromRole, RequestRoomStatsPayload message)
        {
            await InternalSendMessageAsync(fromRole, "requestRoomStats", message).ConfigureAwait(false);
        }

        public void RequestRoomStats(string fromRole, RequestRoomStatsPayload message)
        {
            InternalQueueMessage(fromRole, "requestRoomStats", message);
        }

    }
}

