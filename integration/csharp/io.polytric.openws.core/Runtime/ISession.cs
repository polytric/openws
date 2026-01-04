using System;
using System.Threading.Tasks;
using Polytric.OpenWs.Spec.Serialization;

namespace Polytric.OpenWs.Core
{
    public interface ISession
    {
        Task ConnectAsync(Endpoint endpoint);
        Task CloseAsync();
        Task SendMessageAsync(string message);
        void QueueMessage(string message);

        event Action OnOpen;
        event Action<string> OnError;
        event Action<string> OnClose;
        event Action<string> OnMessage;
    }
}