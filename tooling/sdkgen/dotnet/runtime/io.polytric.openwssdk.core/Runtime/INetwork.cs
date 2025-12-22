using System;
using System.Threading.Tasks;

namespace Polytric.OpenWsSdk.Core {
    // A network is a interface to the network, from a participant's perspective.
    // It's a wrapper around the Transport layer to provide a higher level of abstraction.
    public interface INetwork {
        public Task ConnectAsync(Endpoint endpoint);
        public Task DisconnectAsync();
        
        public event Action OnOpen;
        public event Action<string> OnError;
        public event Action<string> OnClose;

        public Task SendAsync(string handlerName, string payload);        
    }
}