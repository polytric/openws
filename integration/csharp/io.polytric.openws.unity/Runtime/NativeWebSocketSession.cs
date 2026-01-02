using UnityEngine;
using System;
using System.Threading.Tasks;
using NativeWebSocket;
using Polytric.OpenWs.Core;
using Polytric.OpenWs.Spec.Serialization;

namespace Polytric.OpenWs.Unity
{
    public class NativeWebSocketSession : ISession
    {
        private WebSocket _webSocket;

        ~NativeWebSocketSession()
        {
            if (_webSocket != null)
            {
                OpenWsRunner.RemoveWebSocket(_webSocket);
            }
            Debug.Log("NativeWebSocketSession destroyed");
        }

        public async Task ConnectAsync(Endpoint endpoint)
        {
            var url = $"{endpoint.Scheme}://{endpoint.Host}:{endpoint.Port}{endpoint.Path}";
            Debug.Log("Opening NativeWebSocketTransport to " + url);
            _webSocket = new WebSocket(url);
            OpenWsRunner.AddWebSocket(_webSocket);
            Debug.Log("NativeWebSocketSession created");
            _webSocket.OnOpen += () => OnOpen?.Invoke();
            _webSocket.OnError += (errorMessage) => OnError?.Invoke(errorMessage);
            _webSocket.OnClose += (closeCode) => OnClose?.Invoke(closeCode.ToString());
            _webSocket.OnMessage += (message) => OnMessage?.Invoke(System.Text.Encoding.UTF8.GetString(message));
            await _webSocket.Connect().ConfigureAwait(false);
        }

        public async Task CloseAsync()
        {
            var webSocket = _webSocket;
            _webSocket = null;
            await webSocket.Close().ConfigureAwait(false);
        }

        public async Task SendMessageAsync(string message)
        {
            await _webSocket.SendText(message).ConfigureAwait(false);
        }

        public void Update()
        {
#if !UNITY_WEBGL || UNITY_EDITOR
            _webSocket.DispatchMessageQueue();
#endif
        }

        public event Func<Task> OnOpen;
        public event Func<string, Task> OnError;
        public event Func<string, Task> OnClose;
        public event Func<string, Task> OnMessage;
    }
}