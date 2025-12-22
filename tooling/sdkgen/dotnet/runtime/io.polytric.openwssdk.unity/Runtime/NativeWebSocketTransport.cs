using UnityEngine;
using System;
using System.Threading.Tasks;
using NativeWebSocket;
using Polytric.OpenWsSdk.Core;

namespace Polytric.OpenWsSdk.Unity {
    public class NativeWebSocketTransport : IWebSocketTransport {
        private WebSocket _webSocket;

        public NativeWebSocketTransport() {
            OpenWsRunner.AddTransport(this);
            Debug.Log("NativeWebSocketTransport created");
        }

        ~NativeWebSocketTransport() {
            OpenWsRunner.RemoveTransport(this);
            Debug.Log("NativeWebSocketTransport destroyed");
        }

        public async Task OpenAsync(Endpoint endpoint) {
            Debug.Log("Opening NativeWebSocketTransport to " + endpoint.Url);
            _webSocket = new WebSocket(endpoint.Url);
            _webSocket.OnOpen += () => OnOpen?.Invoke();
            _webSocket.OnError += (exception) => OnError?.Invoke(exception);
            _webSocket.OnClose += (closeCode) => OnClose?.Invoke(closeCode);
            _webSocket.OnMessage += (message) => OnMessage?.Invoke(System.Text.Encoding.UTF8.GetString(message));
            await _webSocket.Connect().ConfigureAwait(false);
        }

        public async Task CloseAsync() {
            var webSocket = _webSocket;
            _webSocket = null;
            await webSocket.Close().ConfigureAwait(false);
        }

        public async Task SendMessageAsync(string message) {
            await _webSocket.SendText(message).ConfigureAwait(false);
        }

        public void Update() {
            #if !UNITY_WEBGL || UNITY_EDITOR
                _webSocket.DispatchMessageQueue();
            #endif
        }

        public event Action OnOpen;
        public event Action<string> OnError;
        public event Action<WebSocketCloseCode> OnClose;
        public event Action<string> OnMessage;
    }
}