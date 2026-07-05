using UnityEngine;
using System;
using System.Threading;
using System.Threading.Tasks;
using NativeWebSocket;
using Polytric.OpenWs.Core;
using Polytric.OpenWs.Spec.Serialization;

namespace Polytric.OpenWs.Unity
{
    public class NativeWebSocketSession : ISession
    {
        private WebSocket _webSocket;
        private Task _messageQueue = Task.CompletedTask;

        ~NativeWebSocketSession()
        {
            if (_webSocket != null)
            {
                OpenWsRunner.RemoveSession(this);
            }
        }

        public async Task ConnectAsync(Endpoint endpoint)
        {
            var url = $"{endpoint.Scheme}://{endpoint.Host}:{endpoint.Port}{endpoint.Path}";
            _webSocket = new WebSocket(url);
            OpenWsRunner.AddSession(this);
            _webSocket.OnOpen += () => { OnOpen?.Invoke(); };
            _webSocket.OnError += (errorMessage) => { OnError?.Invoke(errorMessage); };
            _webSocket.OnClose += (closeCode) => { OnClose?.Invoke(closeCode.ToString()); };
            _webSocket.OnMessage += (message) => { OnMessage?.Invoke(System.Text.Encoding.UTF8.GetString(message)); };
            await _webSocket.Connect().ConfigureAwait(false);
        }

        public async Task CloseAsync()
        {
            var webSocket = _webSocket;
            _webSocket = null;
            await webSocket.Close().ConfigureAwait(false);
            OpenWsRunner.RemoveSession(this);
        }

        public async Task SendMessageAsync(string message)
        {
            QueueMessage(message);
            await _messageQueue.ConfigureAwait(false);
        }

        public void QueueMessage(string message)
        {
            var scheduler = TaskScheduler.FromCurrentSynchronizationContext();
            _messageQueue = _messageQueue.ContinueWith(
                async (task) =>
                {
                    if (task.IsFaulted) Debug.LogError(task.Exception);
                    await _webSocket.SendText(message).ConfigureAwait(false);
                },
                CancellationToken.None,
                TaskContinuationOptions.None,
                scheduler
            ).Unwrap();
        }

        public void Update()
        {
#if !UNITY_WEBGL || UNITY_EDITOR
            _webSocket.DispatchMessageQueue();
#endif
        }

        public event Action OnOpen;
        public event Action<string> OnError;
        public event Action<string> OnClose;
        public event Action<string> OnMessage;
    }
}
