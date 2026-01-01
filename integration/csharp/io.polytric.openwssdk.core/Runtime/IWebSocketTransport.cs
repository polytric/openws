using System;
using System.Threading.Tasks;
using NativeWebSocket;

namespace Polytric.OpenWsSdk.Core {

    public interface IWebSocketTransport
    {
        Task OpenAsync(Endpoint endpoint);
        Task CloseAsync();
        Task SendMessageAsync(string message);

        void Update();
        event Action OnOpen;
        event Action<string> OnError;
        event Action<WebSocketCloseCode> OnClose;

        event Action<string> OnMessage;
    }
}

