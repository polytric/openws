using System;
using System.Threading.Tasks;

namespace Polytric.OpenWsSdk.Core {
    public class Network : INetwork {
        protected IWebSocketTransport _transport;
        protected ISerializer _serializer;

        public event Action OnOpen;
        public event Action<string> OnError;
        public event Action<string> OnClose;

        private class Message {
            public string handlerName;
            public string payload;
        }

        public async Task ConnectAsync(Endpoint endpoint) {
            _transport.OnMessage += HandleMessage;
            _transport.OnOpen += () => OnOpen?.Invoke();
            _transport.OnError += (error) => OnError?.Invoke(error);
            _transport.OnClose += (code) => OnClose?.Invoke(code.ToString());
            await _transport.OpenAsync(endpoint).ConfigureAwait(false);
        }

        public async Task DisconnectAsync() {
            await _transport.CloseAsync().ConfigureAwait(false);
        }

        public async Task SendAsync(string handlerName, string payload) {
            await _transport.SendMessageAsync(_serializer.Serialize(new Message { handlerName = handlerName, payload = payload })).ConfigureAwait(false);
        }

        private void HandleMessage(string rawMessage) {
            var message = _serializer.Deserialize<Message>(rawMessage);
            HandleMessage(message.handlerName, message.payload);
        }

        protected virtual void HandleMessage(string handlerName, string payload) {
            throw new NotImplementedException();
        }
    }
}