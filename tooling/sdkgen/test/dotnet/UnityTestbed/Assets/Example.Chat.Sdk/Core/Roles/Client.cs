using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Polytric.OpenWs.Core;
using Example.Chat.Core.Models.Client;

namespace Example.Chat.Core.Roles
{
    public partial class Client : HostRole
    {
        public override string Name { get; set; } = "client";
        public override string Description { get; set; } = "";

        public override async Task HandleOpenAsync(RemoteRole remoteRole)
        {

            if (remoteRole is Server server)
            {
                await HandleOpenAsync(server).ConfigureAwait(false);
            }
        }

        private partial Task HandleOpenAsync(Server server);

        public override async Task HandleMessageAsync(string messageName, JToken payload, RemoteRole remoteRole)
        {
            switch (messageName)
            {

                case "joinedRoom":
                    {
                        var message = payload.ToObject<JoinedRoom>();

                        await HandleMessageAsync(message, remoteRole as Server).ConfigureAwait(false);
                        break;
                    }

                case "receivedMessage":
                    {
                        var message = payload.ToObject<ReceivedMessage>();

                        await HandleMessageAsync(message, remoteRole as Server).ConfigureAwait(false);
                        break;
                    }
            }
        }

        private partial Task HandleMessageAsync(JoinedRoom payload, Server server);
        private partial Task HandleMessageAsync(ReceivedMessage payload, Server server);
    }
}
