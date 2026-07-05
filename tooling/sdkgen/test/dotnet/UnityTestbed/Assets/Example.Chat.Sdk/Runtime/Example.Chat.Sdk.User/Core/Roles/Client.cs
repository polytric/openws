using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Polytric.OpenWs.Core;
using Example.Chat.Core.Models.Client;
using Example.Chat.Core.Models.Server;

namespace Example.Chat.Core.Roles
{
    public partial class Client
    {
        partial void HandleOpen(Server server)
        {
            // TODO: Implement connection handling for Server
        }

        partial void HandleJoinedRoom(JToken payload)
        {
            // TODO: Handle joinedRoom
            // Or implement the concrete payload method above. You only need to implement one.
            // Removing this partial method will instruct the compiler to eliminate the call to save performance.
        }

        partial void HandleJoinedRoom(JoinedRoomPayload payload)
        {
            // TODO: Handle joinedRoom
            // Or implement the JToken method above. You only need to implement one.
            // Removing this partial method will instruct the compiler to eliminate the call to save performance.
        }

        partial void HandleMessage(JoinedRoomPayload payload, Server server)
        {
            // TODO: Handle joinedRoom from Server
            // Or implement the JToken method below. You only need to implement one.
            // Removing this partial method will instruct the compiler to eliminate the call to save performance.
        }

        partial void HandleJoinedRoom(JToken payload, Server server)
        {
            // TODO: Handle joinedRoom from Server
            // Or implement the concrete payload method above. You only need to implement one.
            // Removing this partial method will instruct the compiler to eliminate the call to save performance.
        }

        partial void HandleReceivedMessage(JToken payload)
        {
            // TODO: Handle receivedMessage
            // Or implement the concrete payload method above. You only need to implement one.
            // Removing this partial method will instruct the compiler to eliminate the call to save performance.
        }

        partial void HandleReceivedMessage(ReceivedMessagePayload payload)
        {
            // TODO: Handle receivedMessage
            // Or implement the JToken method above. You only need to implement one.
            // Removing this partial method will instruct the compiler to eliminate the call to save performance.
        }

        partial void HandleMessage(ReceivedMessagePayload payload, Server server)
        {
            // TODO: Handle receivedMessage from Server
            // Or implement the JToken method below. You only need to implement one.
            // Removing this partial method will instruct the compiler to eliminate the call to save performance.
        }

        partial void HandleReceivedMessage(JToken payload, Server server)
        {
            // TODO: Handle receivedMessage from Server
            // Or implement the concrete payload method above. You only need to implement one.
            // Removing this partial method will instruct the compiler to eliminate the call to save performance.
        }

    }
}
