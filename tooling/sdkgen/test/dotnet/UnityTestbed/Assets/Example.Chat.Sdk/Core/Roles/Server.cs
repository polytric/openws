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
        public override IReadOnlyList<Endpoint> Endpoints { get; set; } = new List<Endpoint>
        {
            new Endpoint { Scheme = "ws", Host = "localhost", Port = 8082, Path = "/chat" },
        };

        public async Task CreateRoomAsync(string fromRole, CreateRoom message)
        {
            await SendMessageAsync(fromRole, "createRoom", message).ConfigureAwait(false);
        }

        public async Task JoinRoomAsync(string fromRole, JoinRoom message)
        {
            await SendMessageAsync(fromRole, "joinRoom", message).ConfigureAwait(false);
        }

        public async Task SendMessageAsync(string fromRole, SendMessage message)
        {
            await SendMessageAsync(fromRole, "sendMessage", message).ConfigureAwait(false);
        }

        public async Task RequestRoomStatsAsync(string fromRole, RequestRoomStats message)
        {
            await SendMessageAsync(fromRole, "requestRoomStats", message).ConfigureAwait(false);
        }

    }
}

