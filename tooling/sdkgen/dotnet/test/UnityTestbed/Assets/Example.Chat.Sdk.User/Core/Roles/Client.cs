using System.Threading.Tasks;
using Polytric.OpenWs.Core;
using Example.Chat.Core.Models.Client;
using Example.Chat.Core.Models.Server;

namespace Example.Chat.Core.Roles
{
    public partial class Client
    {
        private partial async Task HandleOpenAsync(Server server)
        {
            await server.CreateRoomAsync(Name, new CreateRoom { UserId = "1", RoomId = "1" }).ConfigureAwait(false);
        }

        private partial Task HandleMessageAsync(JoinedRoom payload, Server server)
        {
            // TODO: Handle joinedRoom from Server
            return Task.CompletedTask;
        }

        private partial Task HandleMessageAsync(ReceivedMessage payload, Server server)
        {
            // TODO: Handle receivedMessage from Server
            return Task.CompletedTask;
        }

    }
}
