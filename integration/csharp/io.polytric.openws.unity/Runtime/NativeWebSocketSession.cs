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
            var opened = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

            void HandleOpen()
            {
                try
                {
                    OnOpen?.Invoke();
                }
                finally
                {
                    opened.TrySetResult(true);
                }
            }

            void HandleError(string errorMessage)
            {
                OnError?.Invoke(errorMessage);
                opened.TrySetException(new Exception($"WebSocket error: {errorMessage}"));
            }

            void HandleClose(string reason)
            {
                OnClose?.Invoke(reason);
                opened.TrySetException(new Exception($"WebSocket closed before open: {reason}"));
            }

            _webSocket.OnOpen += HandleOpen;
            _webSocket.OnError += HandleError;
            _webSocket.OnClose += (closeCode) => { HandleClose(closeCode.ToString()); };
            _webSocket.OnMessage += (message) => { OnMessage?.Invoke(System.Text.Encoding.UTF8.GetString(message)); };

            try
            {
                var lifetime = _webSocket.Connect();
                _ = ObserveLifetime(lifetime, HandleError);
            }
            catch (Exception ex)
            {
                HandleError(ex.Message);
            }

            await opened.Task.ConfigureAwait(false);
        }

        private static async Task ObserveLifetime(Task lifetime, Action<string> onError)
        {
            try
            {
                await lifetime.ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                onError(ex.Message);
            }
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
