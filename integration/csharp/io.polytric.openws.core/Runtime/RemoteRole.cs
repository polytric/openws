using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Polytric.OpenWs.Spec.Serialization;
namespace Polytric.OpenWs.Core
{
    public class RemoteRole
    {
        public virtual string Name { get; set; }
        public virtual string Description { get; set; }
        public virtual IReadOnlyList<Endpoint> Endpoints { get; set; } = new List<Endpoint>();

        internal Func<string, string, JToken, Task> RawSendAsync { get; set; }

        // Subclasses call this to send messages to the remote role.
        public async Task SendMessageAsync<T>(string fromRole, string messageName, T payload)
        {
            if (RawSendAsync == null) throw new InvalidOperationException("RawSendAsync is not set");
            await RawSendAsync(fromRole, messageName, JToken.FromObject(payload)).ConfigureAwait(false);
        }
    }
}