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
                OpenWsRunner.RemoveWebSocket(_webSocket);
            }
        }

        public Task ConnectAsync(Endpoint endpoint)
        {
            var url = $"{endpoint.Scheme}://{endpoint.Host}:{endpoint.Port}{endpoint.Path}";
            _webSocket = new WebSocket(url);
            OpenWsRunner.AddWebSocket(_webSocket);
            var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            _webSocket.OnOpen += () => { OnOpen?.Invoke(); tcs.SetResult(true); };
            _webSocket.OnError += (errorMessage) => { OnError?.Invoke(errorMessage); tcs.SetException(new Exception(errorMessage)); };
            _webSocket.OnClose += (closeCode) => { OnClose?.Invoke(closeCode.ToString()); tcs.SetResult(true); };
            _webSocket.OnMessage += (message) => OnMessage?.Invoke(System.Text.Encoding.UTF8.GetString(message));
            _webSocket.Connect();
            return tcs.Task.ContinueWith(task => task.Result);
        }

        public async Task CloseAsync()
        {
            var webSocket = _webSocket;
            _webSocket = null;
            await webSocket.Close().ConfigureAwait(false);
        }

        public async Task SendMessageAsync(string message)
        {
            QueueMessage(message);
            await _messageQueue.ConfigureAwait(false);
        }

        public void QueueMessage(string message)
        {
            _messageQueue = _messageQueue.ContinueWith(
                async (task) =>
                {
                    if (task.IsFaulted) Debug.LogError(task.Exception);
                    return _webSocket.SendText(message).ConfigureAwait(false);
                },
                CancellationToken.None,
                TaskContinuationOptions.None,
                TaskScheduler.Default
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